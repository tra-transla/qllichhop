import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Schedule {
  id: number;
  date: string;
  time: string;
  content: string;
  leader_id: number;
  location: string;
  leader_name: string;
  leader_position: string;
}

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          leaders (
            name,
            position
          )
        `)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;

      const formattedSchedules = (data || []).map(s => ({
        ...s,
        leader_name: s.leaders?.name,
        leader_position: s.leaders?.position
      }));

      setSchedules(formattedSchedules);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const updateData = () => {
      const now = new Date();
      setCurrentDate(now);
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      fetchSchedules(start, end);
    };

    updateData();
    // Poll every 10 seconds for real-time updates and date changes
    const interval = setInterval(updateData, 10000);
    return () => clearInterval(interval);
  }, []);

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const endDate = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Pagination & Auto-flip logic
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const calculatePages = () => {
      const container = document.getElementById('schedule-scroll-container');
      if (container) {
        const header = container.querySelector('thead');
        const headerHeight = header ? header.clientHeight : 0;
        const viewHeight = container.clientHeight - headerHeight;
        const contentHeight = container.scrollHeight - headerHeight;
        
        if (viewHeight > 0) {
          const pages = Math.ceil(contentHeight / viewHeight);
          setTotalPages(pages > 0 ? pages : 1);
        }
      }
    };

    const timeoutId = setTimeout(calculatePages, 1000);
    window.addEventListener('resize', calculatePages);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', calculatePages);
    };
  }, [schedules]);

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
      const container = document.getElementById('schedule-scroll-container');
      if (container) container.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (totalPages <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setIsFlipping(true);
      
      setTimeout(() => {
        setCurrentPage(prev => {
          const next = (prev + 1) % totalPages;
          const container = document.getElementById('schedule-scroll-container');
          if (container) {
            const header = container.querySelector('thead');
            const headerHeight = header ? header.clientHeight : 0;
            const viewHeight = container.clientHeight - headerHeight;
            
            container.scrollTo({ 
              top: next * viewHeight, 
              behavior: 'instant' 
            });
          }
          return next;
        });
        
        setIsFlipping(false);
      }, 400); // Wait for fade out

    }, 10000);

    return () => clearInterval(interval);
  }, [totalPages, isHovered]);

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  // Group schedules by date and then by morning/afternoon
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.date]) {
      acc[schedule.date] = { morning: [], afternoon: [] };
    }
    const hour = parseInt(schedule.time.split(':')[0], 10);
    if (hour < 12) {
      acc[schedule.date].morning.push(schedule);
    } else {
      acc[schedule.date].afternoon.push(schedule);
    }
    return acc;
  }, {} as Record<string, { morning: Schedule[], afternoon: Schedule[] }>);

  // Generate array of dates for the current week
  const weekDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return format(d, 'yyyy-MM-dd');
  });

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="text-center space-y-2 shrink-0">
        <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">
          Thông báo: Lịch công tác
        </h1>
        <p className="text-lg font-medium text-slate-600 italic">
          Từ ngày {format(startDate, 'dd/MM/yyyy')} đến ngày {format(endDate, 'dd/MM/yyyy')}
        </p>
      </div>

      <div 
        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          id="schedule-scroll-container" 
          className={`overflow-y-auto flex-1 transition-opacity duration-500 ${isFlipping ? 'opacity-0' : 'opacity-100'}`}
        >
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr className="bg-indigo-600">
                <th className="py-4 px-6 font-semibold text-white border-b border-r border-indigo-700 w-48 text-center uppercase tracking-wider text-sm bg-indigo-600">Ngày</th>
                <th className="py-4 px-4 font-semibold text-white border-b border-r border-indigo-700 w-24 text-center uppercase tracking-wider text-sm bg-indigo-600">Buổi</th>
                <th className="py-4 px-4 font-semibold text-white border-b border-r border-indigo-700 w-24 text-center uppercase tracking-wider text-sm bg-indigo-600">Thời gian</th>
                <th className="py-4 px-6 font-semibold text-white border-b border-r border-indigo-700 text-center uppercase tracking-wider text-sm bg-indigo-600">Nội dung</th>
                <th className="py-4 px-6 font-semibold text-white border-b border-r border-indigo-700 w-64 text-center uppercase tracking-wider text-sm bg-indigo-600">Đồng chí</th>
                <th className="py-4 px-6 font-semibold text-white border-b w-64 text-center uppercase tracking-wider text-sm bg-indigo-600">Địa điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : weekDates.map((dateStr) => {
                const dayData = groupedSchedules[dateStr] || { morning: [], afternoon: [] };
                const hasMorning = dayData.morning.length > 0;
                const hasAfternoon = dayData.afternoon.length > 0;
                const totalRows = Math.max(1, dayData.morning.length + dayData.afternoon.length);
                const dateObj = new Date(dateStr);
                const dayName = format(dateObj, 'EEEE', { locale: vi });
                const formattedDate = format(dateObj, 'dd/MM/yyyy');

                // If no schedules for the day, render an empty row
                if (!hasMorning && !hasAfternoon) {
                  return (
                    <tr key={dateStr} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 border-r border-slate-200 text-center align-middle">
                        <div className="font-medium text-slate-900 capitalize">{dayName}</div>
                        <div className="text-sm text-slate-500">{formattedDate}</div>
                      </td>
                      <td className="py-4 px-4 border-r border-slate-200 text-center text-slate-400">-</td>
                      <td className="py-4 px-4 border-r border-slate-200 text-center text-slate-400">-</td>
                      <td className="py-4 px-6 border-r border-slate-200 text-slate-400 italic">Không có lịch</td>
                      <td className="py-4 px-6 border-r border-slate-200 text-slate-400">-</td>
                      <td className="py-4 px-6 text-slate-400">-</td>
                    </tr>
                  );
                }

                const rows = [];
                let isFirstRow = true;

                // Render morning schedules
                if (hasMorning) {
                  dayData.morning.forEach((schedule, idx) => {
                    rows.push(
                      <tr key={`m-${schedule.id}`} className="hover:bg-slate-50 transition-colors">
                        {isFirstRow && (
                          <td rowSpan={totalRows} className="py-4 px-6 border-r border-slate-200 text-center align-middle bg-white">
                            <div className="font-medium text-slate-900 capitalize">{dayName}</div>
                            <div className="text-sm text-slate-500">{formattedDate}</div>
                          </td>
                        )}
                        {idx === 0 && (
                          <td rowSpan={dayData.morning.length} className="py-4 px-4 border-r border-slate-200 text-center align-middle font-medium text-slate-700 bg-slate-50/50">
                            Sáng
                          </td>
                        )}
                        <td className="py-4 px-4 border-r border-slate-200 text-center font-mono text-sm text-slate-700">
                          {schedule.time.substring(0, 5)}
                        </td>
                        <td className="py-4 px-6 border-r border-slate-200 text-slate-900">
                          {schedule.content}
                        </td>
                        <td className="py-4 px-6 border-r border-slate-200">
                          <div className="font-medium text-slate-900">{schedule.leader_position} <span className="font-bold">{schedule.leader_name}</span></div>
                        </td>
                        <td className="py-4 px-6 text-slate-700">
                          {schedule.location}
                        </td>
                      </tr>
                    );
                    isFirstRow = false;
                  });
                }

                // Render afternoon schedules
                if (hasAfternoon) {
                  dayData.afternoon.forEach((schedule, idx) => {
                    rows.push(
                      <tr key={`a-${schedule.id}`} className="hover:bg-slate-50 transition-colors border-t border-slate-100">
                        {isFirstRow && (
                          <td rowSpan={totalRows} className="py-4 px-6 border-r border-slate-200 text-center align-middle bg-white">
                            <div className="font-medium text-slate-900 capitalize">{dayName}</div>
                            <div className="text-sm text-slate-500">{formattedDate}</div>
                          </td>
                        )}
                        {idx === 0 && (
                          <td rowSpan={dayData.afternoon.length} className="py-4 px-4 border-r border-slate-200 text-center align-middle font-medium text-slate-700 bg-slate-50/50">
                            Chiều
                          </td>
                        )}
                        <td className="py-4 px-4 border-r border-slate-200 text-center font-mono text-sm text-slate-700">
                          {schedule.time.substring(0, 5)}
                        </td>
                        <td className="py-4 px-6 border-r border-slate-200 text-slate-900">
                          {schedule.content}
                        </td>
                        <td className="py-4 px-6 border-r border-slate-200">
                          <div className="font-medium text-slate-900">{schedule.leader_position} <span className="font-bold">{schedule.leader_name}</span></div>
                        </td>
                        <td className="py-4 px-6 text-slate-700">
                          {schedule.location}
                        </td>
                      </tr>
                    );
                    isFirstRow = false;
                  });
                }

                return rows;
              })}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex justify-center items-center gap-2 text-sm font-medium text-slate-600 shrink-0">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <div 
                key={idx} 
                className={`w-2.5 h-2.5 rounded-full transition-colors ${idx === currentPage ? 'bg-indigo-600' : 'bg-slate-300'}`}
              />
            ))}
            <span className="ml-2">Trang {currentPage + 1} / {totalPages}</span>
          </div>
        )}
      </div>
    </div>
  );
}

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
    // Poll every 20 seconds for real-time updates and date changes
    const interval = setInterval(updateData, 20000);
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

    }, 20000);

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
    <div className="relative h-[calc(100vh-4rem)] flex flex-col p-6 overflow-hidden">
      {/* Background Image with Opacity */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url("https://i.postimg.cc/q7kryhnB/bglt.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.5
        }}
      />
      
      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col h-full space-y-6">
        <div className="text-center space-y-2 shrink-0">
          <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter drop-shadow-sm">
            Thông báo: Lịch công tác
          </h1>
          <p className="text-2xl font-bold text-indigo-900 italic bg-white/40 backdrop-blur-sm inline-block px-6 py-1 rounded-full border border-white/20">
            Từ ngày {format(startDate, 'dd/MM/yyyy')} đến ngày {format(endDate, 'dd/MM/yyyy')}
          </p>
        </div>

        <div 
          className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/50 overflow-hidden flex-1 flex flex-col min-h-0"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div 
            id="schedule-scroll-container" 
            className={`overflow-y-hidden flex-1 transition-opacity duration-500 ${isFlipping ? 'opacity-0' : 'opacity-100'}`}
          >
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-30 shadow-md">
                <tr className="bg-indigo-700">
                  <th className="py-5 px-4 font-bold text-white border-b border-r border-indigo-800 w-32 text-center uppercase tracking-widest text-lg bg-indigo-700">Buổi</th>
                  <th className="py-5 px-4 font-bold text-white border-b border-r border-indigo-800 w-32 text-center uppercase tracking-widest text-lg bg-indigo-700">Thời gian</th>
                  <th className="py-5 px-8 font-bold text-white border-b border-r border-indigo-800 text-center uppercase tracking-widest text-lg bg-indigo-700">Nội dung công việc</th>
                  <th className="py-5 px-8 font-bold text-white border-b border-r border-indigo-800 w-80 text-center uppercase tracking-widest text-lg bg-indigo-700">Thành phần/Lãnh đạo</th>
                  <th className="py-5 px-8 font-bold text-white border-b w-80 text-center uppercase tracking-widest text-lg bg-indigo-700">Địa điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {loading && schedules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-600 text-2xl font-medium">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : weekDates.map((dateStr) => {
                  const dayData = groupedSchedules[dateStr] || { morning: [], afternoon: [] };
                  const hasMorning = dayData.morning.length > 0;
                  const hasAfternoon = dayData.afternoon.length > 0;
                  const dateObj = new Date(dateStr);
                  const dayName = format(dateObj, 'EEEE', { locale: vi });
                  const formattedDate = format(dateObj, 'dd/MM/yyyy');

                  const dateHeader = (
                    <tr key={`header-${dateStr}`} className="bg-indigo-50/80 border-y-2 border-indigo-200">
                      <td colSpan={5} className="py-4 px-8">
                        <div className="flex items-center gap-4">
                          <span className="text-3xl font-black text-indigo-950 uppercase tracking-tight">{dayName}</span>
                          <span className="text-2xl font-bold text-indigo-700/80">({formattedDate})</span>
                        </div>
                      </td>
                    </tr>
                  );

                  if (!hasMorning && !hasAfternoon) {
                    return [
                      dateHeader,
                      <tr key={`empty-${dateStr}`} className="hover:bg-white/50 transition-colors">
                        <td className="py-6 px-4 border-r border-slate-200 text-center text-slate-400 text-xl">-</td>
                        <td className="py-6 px-4 border-r border-slate-200 text-center text-slate-400 text-xl">-</td>
                        <td className="py-6 px-8 border-r border-slate-200 text-slate-400 italic text-xl">Không có lịch công tác</td>
                        <td className="py-6 px-8 border-r border-slate-200 text-slate-400 text-xl">-</td>
                        <td className="py-6 px-8 text-slate-400 text-xl">-</td>
                      </tr>
                    ];
                  }

                  const rows = [dateHeader];

                  // Render morning schedules
                  if (hasMorning) {
                    dayData.morning.forEach((schedule, idx) => {
                      rows.push(
                        <tr key={`m-${schedule.id}`} className="hover:bg-white/50 transition-colors">
                          {idx === 0 && (
                            <td rowSpan={dayData.morning.length} className="py-6 px-4 border-r border-slate-200 text-center align-middle font-bold text-indigo-900 bg-indigo-50/30 text-xl">
                              Sáng
                            </td>
                          )}
                          <td className="py-6 px-4 border-r border-slate-200 text-center font-mono text-2xl font-bold text-slate-800">
                            {schedule.time.substring(0, 5)}
                          </td>
                          <td className="py-6 px-8 border-r border-slate-200 text-slate-950 text-2xl font-medium leading-relaxed">
                            {schedule.content}
                          </td>
                          <td className="py-6 px-8 border-r border-slate-200">
                            <div className="text-xl text-slate-700 font-semibold mb-1">{schedule.leader_position}</div>
                            <div className="text-2xl font-black text-indigo-900">{schedule.leader_name}</div>
                          </td>
                          <td className="py-6 px-8 text-slate-800 text-2xl font-bold">
                            {schedule.location}
                          </td>
                        </tr>
                      );
                    });
                  }

                  // Render afternoon schedules
                  if (hasAfternoon) {
                    dayData.afternoon.forEach((schedule, idx) => {
                      rows.push(
                        <tr key={`a-${schedule.id}`} className="hover:bg-white/50 transition-colors border-t border-slate-200">
                          {idx === 0 && (
                            <td rowSpan={dayData.afternoon.length} className="py-6 px-4 border-r border-slate-200 text-center align-middle font-bold text-orange-900 bg-orange-50/30 text-xl">
                              Chiều
                            </td>
                          )}
                          <td className="py-6 px-4 border-r border-slate-200 text-center font-mono text-2xl font-bold text-slate-800">
                            {schedule.time.substring(0, 5)}
                          </td>
                          <td className="py-6 px-8 border-r border-slate-200 text-slate-950 text-2xl font-medium leading-relaxed">
                            {schedule.content}
                          </td>
                          <td className="py-6 px-8 border-r border-slate-200">
                            <div className="text-xl text-slate-700 font-semibold mb-1">{schedule.leader_position}</div>
                            <div className="text-2xl font-black text-indigo-900">{schedule.leader_name}</div>
                          </td>
                          <td className="py-6 px-8 text-slate-800 text-2xl font-bold">
                            {schedule.location}
                          </td>
                        </tr>
                      );
                    });
                  }

                  return rows;
                })}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="bg-white/10 backdrop-blur-md p-2 flex justify-center items-center gap-3 text-sm font-semibold text-white/90 shrink-0 border-t border-white/10">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentPage ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'bg-white/20'}`}
                />
              ))}
              <span className="ml-2 uppercase tracking-widest text-[10px] opacity-80">Trang {currentPage + 1} / {totalPages}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

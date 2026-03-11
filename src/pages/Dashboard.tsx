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

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const endDate = endOfWeek(currentDate, { weekStartsOn: 1 });

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      
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
    fetchSchedules();
    // Poll every 10 seconds for real-time updates
    const interval = setInterval(fetchSchedules, 10000);
    return () => clearInterval(interval);
  }, [currentDate]);

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
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">
          Thông báo: Lịch công tác
        </h1>
        <p className="text-lg font-medium text-slate-600 italic">
          Từ ngày {format(startDate, 'dd/MM/yyyy')} đến ngày {format(endDate, 'dd/MM/yyyy')}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-600 border-b border-indigo-700">
                <th className="py-4 px-6 font-semibold text-white border-r border-indigo-500 w-48 text-center uppercase tracking-wider text-sm">Ngày</th>
                <th className="py-4 px-4 font-semibold text-white border-r border-indigo-500 w-24 text-center uppercase tracking-wider text-sm">Buổi</th>
                <th className="py-4 px-4 font-semibold text-white border-r border-indigo-500 w-24 text-center uppercase tracking-wider text-sm">Thời gian</th>
                <th className="py-4 px-6 font-semibold text-white border-r border-indigo-500 text-center uppercase tracking-wider text-sm">Nội dung</th>
                <th className="py-4 px-6 font-semibold text-white border-r border-indigo-500 w-64 text-center uppercase tracking-wider text-sm">Đồng chí</th>
                <th className="py-4 px-6 font-semibold text-white w-64 text-center uppercase tracking-wider text-sm">Địa điểm</th>
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
      </div>
    </div>
  );
}

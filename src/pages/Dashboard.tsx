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
  program_document?: string;
  preparation?: string;
  location: string;
  host?: string;
  participants: {
    name: string;
    position: string;
  }[];
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
          schedule_participants (
            leaders (
              name,
              position
            )
          )
        `)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;

      const formattedSchedules = (data || []).map(s => ({
        ...s,
        participants: (s.schedule_participants || []).map((p: any) => ({
          name: p.leaders?.name,
          position: p.leaders?.position
        }))
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

    }, 20000); // 20 seconds interval

    return () => clearInterval(interval);
  }, [totalPages, isHovered]);

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  // TV Remote Control Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch(e.keyCode) {
        case 37: // Left
          prevWeek();
          break;
        case 39: // Right
          nextWeek();
          break;
        case 38: // Up
          if (totalPages > 1) {
            setCurrentPage(prev => (prev - 1 + totalPages) % totalPages);
          }
          break;
        case 40: // Down
          if (totalPages > 1) {
            setCurrentPage(prev => (prev + 1) % totalPages);
          }
          break;
        case 13: // Enter
          today();
          break;
        case 10009: // Samsung Return/Back
          // Handle back button if needed, e.g., go to home or exit
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  // Hide cursor for TV mode after inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      document.body.style.cursor = 'default';
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        document.body.style.cursor = 'none';
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    handleMouseMove(); // Initial hide

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.style.cursor = 'default';
      clearTimeout(timeout);
    };
  }, []);

  // Sync scroll position when currentPage changes manually via remote
  useEffect(() => {
    const container = document.getElementById('schedule-scroll-container');
    if (container) {
      const header = container.querySelector('thead');
      const headerHeight = header ? header.clientHeight : 0;
      const viewHeight = container.clientHeight - headerHeight;
      
      container.scrollTo({ 
        top: currentPage * viewHeight, 
        behavior: 'smooth' 
      });
    }
  }, [currentPage]);

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
          opacity: 0.3
        }}
      />
      
      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col h-full space-y-6">
        {/* Header Section: Logo, Title Box, and Org Info aligned horizontally */}
        <div className="flex justify-between items-center px-12 pt-6 shrink-0 gap-8">
          {/* Logo on the left */}
          <div className="w-[280px] flex justify-start items-center">
            <img 
              src="https://special.nhandan.vn/vung-buoc-tien-len-duoi-la-co-ve-vang-cua-Dang/assets/xbdprWoiui/thie-t-ke-chu-a-co-te-n-45-1000x1000.png" 
              alt="Logo" 
              className="w-[150px] h-[150px] object-contain drop-shadow-[0_5px_15px_rgba(0,0,0,0.4)]"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Decorative Main Title Box in the center */}
          <div className="relative px-12 py-5 bg-gradient-to-b from-[#a31d1d] to-[#7a1515] rounded-lg border-2 border-[#d4af37] shadow-2xl flex-1 max-w-[850px]">
            <h1 className="text-3xl font-black text-white uppercase tracking-[0.15em] drop-shadow-lg text-center leading-tight">
              Thông báo: Lịch công tác tuần
            </h1>
            <div className="w-40 h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent my-2 mx-auto"></div>
            <p className="text-lg font-bold text-[#ffd700] italic text-center">
              Từ ngày {format(startDate, 'dd/MM/yyyy')} đến ngày {format(endDate, 'dd/MM/yyyy')}
            </p>
          </div>

          {/* Organization info on the right */}
          <div className="w-[280px] text-[#7f1d1d] font-bold uppercase leading-tight text-center drop-shadow-sm">
            <p className="text-xl mb-1">Tỉnh uỷ Sơn La</p>
            <p className="text-3xl">Ban Tổ chức</p>
          </div>
        </div>

        <div 
          className="bg-transparent rounded-xl shadow-2xl border border-[#fca5a5] overflow-hidden flex-1 flex flex-col min-h-0"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div 
            id="schedule-scroll-container" 
            className={`overflow-y-hidden flex-1 transition-opacity duration-500 ${isFlipping ? 'opacity-0' : 'opacity-100'}`}
          >
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-30 shadow-md">
                <tr className="bg-[#8b0000]">
                  <th className="py-3 px-2 font-bold text-white border-b border-r border-[#7f1d1d] w-35 text-center uppercase tracking-wider text-base bg-[#8b0000]">Thứ</th>
                  <th className="py-3 px-2 font-bold text-white border-b border-r border-[#7f1d1d] w-24 text-center uppercase tracking-wider text-base bg-[#8b0000]">Buổi</th>
                  <th className="py-3 px-2 font-bold text-white border-b border-r border-[#7f1d1d] w-24 text-center uppercase tracking-wider text-base bg-[#8b0000]">Thời gian</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] text-center uppercase tracking-wider text-base bg-[#8b0000]">Nội dung công việc</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] w-56 text-center uppercase tracking-wider text-base bg-[#8b0000]">Chương trình/Văn bản</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] w-56 text-center uppercase tracking-wider text-base bg-[#8b0000]">Chủ trì</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] w-56 text-center uppercase tracking-wider text-base bg-[#8b0000]">Thành phần/Lãnh đạo</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] w-56 text-center uppercase tracking-wider text-base bg-[#8b0000]">Chuẩn bị</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] w-56 text-center uppercase tracking-wider text-base bg-[#8b0000]">Địa điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#fca5a5]">
                {loading && schedules.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-[#7f1d1d] text-xl font-medium">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : weekDates.map((dateStr) => {
                  const dayData = groupedSchedules[dateStr] || { morning: [], afternoon: [] };
                  const hasMorning = dayData.morning.length > 0;
                  const hasAfternoon = dayData.afternoon.length > 0;
                  const dateObj = new Date(dateStr);
                  const dayName = format(dateObj, 'EEEE', { locale: vi });
                  const formattedDate = format(dateObj, 'dd/MM');

                  if (!hasMorning && !hasAfternoon) return null;

                  const rows: any[] = [];
                  const totalDayRows = dayData.morning.length + dayData.afternoon.length;

                  // Render morning schedules
                  if (hasMorning) {
                    dayData.morning.forEach((schedule, idx) => {
                      rows.push(
                        <tr key={`m-${schedule.id}`} className="hover:bg-[rgba(254,242,242,0.5)] transition-colors">
                          {idx === 0 && (
                            <td rowSpan={totalDayRows} className="py-3 px-2 border-r border-[#fca5a5] text-center align-middle font-black text-[#7f1d1d]">
                              <div className="text-xl uppercase">{dayName}</div>
                              <div className="text-base opacity-70">{formattedDate}</div>
                            </td>
                          )}
                          {idx === 0 && (
                            <td rowSpan={dayData.morning.length} className="py-3 px-2 border-r border-[#fca5a5] text-center align-middle font-bold text-[#7f1d1d] text-base">
                              Sáng
                            </td>
                          )}
                          <td className="py-3 px-2 border-r border-[#fca5a5] text-center font-mono text-xl font-bold text-[#1e293b]">
                            {schedule.time.substring(0, 5)}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5] text-[#020617] text-xl font-medium leading-relaxed">
                            {schedule.content}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5] text-slate-800 text-xl font-medium">
                            {schedule.program_document || '-'}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5] text-[#7f1d1d] font-bold text-xl">
                            {schedule.host || '-'}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5]">
                            {schedule.participants.map((p, pIdx) => (
                              <div key={pIdx} className="mb-2 last:mb-0">
                                <div className="text-lg text-slate-700 font-semibold mb-0.5">{p.position}</div>
                                <div className="text-xl font-black text-[#7f1d1d]">{p.name}</div>
                              </div>
                            ))}
                            {schedule.participants.length === 0 && '-'}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5] text-slate-800 text-xl font-medium">
                            {schedule.preparation || '-'}
                          </td>
                          <td className="py-3 px-4 text-[#1e293b] text-xl font-bold">
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
                        <tr key={`a-${schedule.id}`} className="hover:bg-[rgba(254,242,242,0.5)] transition-colors border-t border-[#fca5a5]">
                          {!hasMorning && idx === 0 && (
                            <td rowSpan={totalDayRows} className="py-3 px-2 border-r border-[#fca5a5] text-center align-middle font-black text-[#7f1d1d]">
                              <div className="text-xl uppercase">{dayName}</div>
                              <div className="text-base opacity-70">{formattedDate}</div>
                            </td>
                          )}
                          {idx === 0 && (
                            <td rowSpan={dayData.afternoon.length} className="py-3 px-2 border-r border-[#fca5a5] text-center align-middle font-bold text-orange-900 text-base">
                              Chiều
                            </td>
                          )}
                          <td className="py-3 px-2 border-r border-[#fca5a5] text-center font-mono text-xl font-bold text-[#1e293b]">
                            {schedule.time.substring(0, 5)}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5] text-[#020617] text-xl font-medium leading-relaxed">
                            {schedule.content}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5] text-slate-800 text-xl font-medium">
                            {schedule.program_document || '-'}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5] text-[#7f1d1d] font-bold text-xl">
                            {schedule.host || '-'}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5]">
                            {schedule.participants.map((p, pIdx) => (
                              <div key={pIdx} className="mb-2 last:mb-0">
                                <div className="text-lg text-slate-700 font-semibold mb-0.5">{p.position}</div>
                                <div className="text-xl font-black text-[#7f1d1d]">{p.name}</div>
                              </div>
                            ))}
                            {schedule.participants.length === 0 && '-'}
                          </td>
                          <td className="py-3 px-4 border-r border-[#fca5a5] text-slate-800 text-xl font-medium">
                            {schedule.preparation || '-'}
                          </td>
                          <td className="py-3 px-4 text-[#1e293b] text-xl font-bold">
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
            <div className="bg-transparent p-2 flex justify-center items-center gap-3 text-sm font-semibold text-white/90 shrink-0 border-t border-[#fca5a5]">
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

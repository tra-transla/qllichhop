import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock as ClockIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ResizeObserver from 'resize-observer-polyfill';

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-end text-[#7f1d1d] font-bold">
      <div className="flex items-center gap-2 text-3xl sm:text-4xl tracking-tighter">
        <ClockIcon className="w-6 h-6 sm:w-8 sm:h-8" />
        <span>{format(time, 'HH:mm:ss')}</span>
      </div>
      <div className="text-sm sm:text-base opacity-80 uppercase">
        {format(time, 'eeee, dd/MM/yyyy', { locale: vi })}
      </div>
    </div>
  );
}

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
  const [todayStr, setTodayStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  console.log('Dashboard rendering, loading:', loading, 'schedules:', schedules.length);

  const fetchSchedules = async (start: Date, end: Date) => {
    console.log('Fetching schedules for:', format(start, 'yyyy-MM-dd'), 'to', format(end, 'yyyy-MM-dd'));
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

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Fetched data:', data?.length || 0, 'rows');

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
    const fetchCurrentSchedules = () => {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      fetchSchedules(start, end);
    };

    fetchCurrentSchedules();
    // Poll every 10 seconds for real-time updates
    const interval = setInterval(fetchCurrentSchedules, 10000);
    
    // Update todayStr if day changes
    const todayInterval = setInterval(() => {
      const now = new Date();
      const currentToday = format(now, 'yyyy-MM-dd');
      if (currentToday !== todayStr) {
        setTodayStr(currentToday);
      }
    }, 60000);

    // Full page reload every 24 hours to clear memory on TV boxes
    const reloadInterval = setInterval(() => {
      window.location.reload();
    }, 24 * 60 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(todayInterval);
      clearInterval(reloadInterval);
    };
  }, [currentDate, todayStr]);

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const endDate = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Pagination & Auto-flip logic
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageOffsets, setPageOffsets] = useState<number[]>([0]);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const calculatePages = () => {
      const container = document.getElementById('schedule-scroll-container');
      if (container) {
        const header = container.querySelector('thead');
        const headerHeight = header ? header.getBoundingClientRect().height : 0;
        const viewHeight = container.clientHeight - headerHeight;
        
        if (viewHeight > 0) {
          const rows = Array.from(container.querySelectorAll('tbody tr'));
          const offsets = [0];
          let currentAccumulatedHeight = 0;
          let currentPageHeight = 0;

          rows.forEach((row) => {
            const rowHeight = (row as HTMLElement).getBoundingClientRect().height;
            
            // Use a small tolerance (1px) for sub-pixel issues
            if (currentPageHeight + rowHeight > viewHeight + 1 && currentPageHeight > 0) {
              currentAccumulatedHeight += currentPageHeight;
              offsets.push(currentAccumulatedHeight);
              currentPageHeight = rowHeight;
            } else {
              currentPageHeight += rowHeight;
            }
          });

          // Only update if offsets actually changed to avoid unnecessary re-renders
          setPageOffsets(prev => {
            if (JSON.stringify(prev) === JSON.stringify(offsets)) return prev;
            return offsets;
          });
          setTotalPages(offsets.length > 0 ? offsets.length : 1);
        }
      }
    };

    const timeoutId = setTimeout(calculatePages, 1000);
    
    const container = document.getElementById('schedule-scroll-container');
    let resizeObserverInstance: any = null;
    if (container) {
      resizeObserverInstance = new ResizeObserver(() => {
        calculatePages();
      });
      resizeObserverInstance.observe(container);
    }
    
    window.addEventListener('resize', calculatePages);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', calculatePages);
      if (resizeObserverInstance) resizeObserverInstance.disconnect();
    };
  }, [schedules, todayStr, currentDate]);

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
        setCurrentPage(prev => (prev + 1) % totalPages);
        setIsFlipping(false);
      }, 500); // Wait for fade out

    }, 10000); // 10 seconds interval

    return () => clearInterval(interval);
  }, [totalPages, isHovered]);

  // Sync scroll position when currentPage changes
  useEffect(() => {
    const container = document.getElementById('schedule-scroll-container');
    if (container && pageOffsets[currentPage] !== undefined) {
      container.scrollTo({ 
        top: pageOffsets[currentPage], 
        behavior: isFlipping ? 'instant' : 'smooth' 
      });
    }
  }, [currentPage, pageOffsets, isFlipping]);

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  // TV Remote Control Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Log key code for debugging on different TV boxes
      console.log('Key pressed:', e.keyCode, e.key);

      switch(e.keyCode) {
        case 37: // Left
        case 21: // Android Left
          prevWeek();
          break;
        case 39: // Right
        case 22: // Android Right
          nextWeek();
          break;
        case 38: // Up
        case 19: // Android Up
          if (totalPages > 1) {
            setCurrentPage(prev => (prev - 1 + totalPages) % totalPages);
          }
          break;
        case 40: // Down
        case 20: // Android Down
          if (totalPages > 1) {
            setCurrentPage(prev => (prev + 1) % totalPages);
          }
          break;
        case 13: // Enter
        case 23: // Android Center/Enter
        case 66: // Android B (Enter)
          today();
          break;
        case 10009: // Samsung Return/Back
        case 4:     // Android Back
        case 27:    // ESC
          // Prevent default back behavior if needed
          // e.g., if in a modal, close it. Here we just log.
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

  // Generate array of dates for the current week, filtering out past days
  const weekDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return format(d, 'yyyy-MM-dd');
  }).filter(date => date >= todayStr);

  return (
    <div className="relative h-screen w-full flex flex-col p-6 sm:p-10 overflow-hidden select-none" style={{ height: '100vh' }}>
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
        <div className="flex justify-between items-center px-4 sm:px-12 pt-4 sm:pt-6 shrink-0">
          {/* Logo on the left */}
          <div className="flex-1 flex justify-start items-center min-w-0 pr-4 sm:pr-8">
            <img 
              src="https://i.ibb.co/KjvsbZby/logo-codang.png" 
              alt="Logo" 
              className="w-24 h-24 sm:w-[150px] sm:h-[150px] object-contain drop-shadow-[0_5px_15px_rgba(0,0,0,0.4)]"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Decorative Main Title Box in the center */}
          <div className="relative px-4 sm:px-12 py-3 sm:py-5 bg-gradient-to-b from-[#a31d1d] to-[#7a1515] rounded-lg border-2 border-[#d4af37] shadow-2xl flex-[2] max-w-[850px] mx-2 sm:mx-4">
            <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-[0.1em] sm:tracking-[0.15em] drop-shadow-lg text-center leading-tight">
              Thông báo: Lịch công tác tuần
            </h1>
            <div className="w-20 sm:w-40 h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent my-1 sm:my-2 mx-auto"></div>
            <p className="text-sm sm:text-lg font-bold text-[#ffd700] italic text-center">
              Từ ngày {format(startDate, 'dd/MM/yyyy')} đến ngày {format(endDate, 'dd/MM/yyyy')}
            </p>
          </div>

          {/* Organization info on the right */}
          <div className="flex-1 flex flex-col items-end gap-2 min-w-0 pl-4 sm:pl-8">
            <div className="text-[#7f1d1d] font-bold uppercase leading-tight text-right drop-shadow-sm">
              <p className="text-sm sm:text-xl mb-0 sm:mb-1">Tỉnh uỷ Sơn La</p>
              <p className="text-lg sm:text-3xl">Ban Tổ chức</p>
            </div>
            <Clock />
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
                  <th className="py-3 px-2 font-bold text-white border-b border-r border-[#7f1d1d] w-24 sm:w-32 text-center uppercase tracking-wider text-sm sm:text-base bg-[#8b0000]">Thứ</th>
                  <th className="py-3 px-2 font-bold text-white border-b border-r border-[#7f1d1d] w-16 sm:w-24 text-center uppercase tracking-wider text-sm sm:text-base bg-[#8b0000]">Buổi</th>
                  <th className="py-3 px-2 font-bold text-white border-b border-r border-[#7f1d1d] w-16 sm:w-24 text-center uppercase tracking-wider text-sm sm:text-base bg-[#8b0000]">Thời gian</th>
                  <th className="py-3 px-5 font-bold text-white border-b border-r border-[#7f1d1d] text-center uppercase tracking-wider text-sm sm:text-base bg-[#8b0000]">Nội dung công việc</th>
                  <th className="py-3 px-3 font-bold text-white border-b border-r border-[#7f1d1d] w-32 sm:w-56 text-center uppercase tracking-wider text-sm sm:text-base bg-[#8b0000]">Chương trình/Văn bản</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] w-32 sm:w-56 text-center uppercase tracking-wider text-sm sm:text-base bg-[#8b0000]">Chủ trì</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] w-32 sm:w-56 text-center uppercase tracking-wider text-sm sm:text-base bg-[#8b0000]">Thành phần</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] w-32 sm:w-56 text-center uppercase tracking-wider text-sm sm:text-base bg-[#8b0000]">Chuẩn bị</th>
                  <th className="py-3 px-4 font-bold text-white border-b border-r border-[#7f1d1d] w-32 sm:w-56 text-center uppercase tracking-wider text-sm sm:text-base bg-[#8b0000]">Địa điểm</th>
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
                              <div className="sticky top-24 py-4">
                                <div className="text-xl uppercase">{dayName}</div>
                                <div className="text-base opacity-70">{formattedDate}</div>
                              </div>
                            </td>
                          )}
                          {idx === 0 && (
                            <td rowSpan={dayData.morning.length} className="py-3 px-2 border-r border-[#fca5a5] text-center align-middle font-bold text-[#7f1d1d] text-base">
                              <div className="sticky top-24 py-4">Sáng</div>
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
                              <div className="sticky top-24 py-4">
                                <div className="text-xl uppercase">{dayName}</div>
                                <div className="text-base opacity-70">{formattedDate}</div>
                              </div>
                            </td>
                          )}
                          {idx === 0 && (
                            <td rowSpan={dayData.afternoon.length} className="py-3 px-2 border-r border-[#fca5a5] text-center align-middle font-bold text-orange-900 text-base">
                              <div className="sticky top-24 py-4">Chiều</div>
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
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentPage ? 'bg-[#8b0000] shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'bg-[#8b0000]/20'}`}
                />
              ))}
              <span className="ml-2 uppercase tracking-widest text-[10px] opacity-80">Trang {currentPage + 1} / {totalPages}</span>
            </div>
          )}
        </div>

        {/* TV Remote Navigation Guide */}
        <div className="shrink-0 flex justify-center items-center py-2 bg-black/40 rounded-full border border-white/10 text-white/60 text-xs sm:text-sm font-medium uppercase tracking-widest">
          <div className="flex items-center mx-4">
            <span className="px-2 py-0.5 bg-white/20 rounded border border-white/30 text-white mr-2">← / →</span>
            <span>Tuần trước / sau</span>
          </div>
          <div className="flex items-center mx-4">
            <span className="px-2 py-0.5 bg-white/20 rounded border border-white/30 text-white mr-2">↑ / ↓</span>
            <span>Chuyển trang</span>
          </div>
          <div className="flex items-center mx-4">
            <span className="px-2 py-0.5 bg-white/20 rounded border border-white/30 text-white mr-2">OK / ENTER</span>
            <span>Về hôm nay</span>
          </div>
        </div>
      </div>
    </div>
  );
}

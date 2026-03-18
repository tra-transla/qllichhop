import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, LayoutDashboard, Settings, LogOut, Shield, Maximize, Minimize } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith('/admin');
  const { session, signOut } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {isAdmin ? (
        <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-10">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link to="/" className="flex items-center gap-2 font-semibold text-[#0f172a] text-lg">
                  <Calendar className="w-6 h-6 text-[#4f46e5]" />
                  <span>Hệ thống quản lý lịch công tác tuần</span>
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to="/"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    !isAdmin ? "bg-[#eef2ff] text-[#4338ca]" : "text-[#475569] hover:bg-[#f1f5f9]"
                  )}
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isAdmin ? "bg-[#eef2ff] text-[#4338ca]" : "text-[#475569] hover:bg-[#f1f5f9]"
                  )}
                >
                  Quản lý
                </Link>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-[#475569] hover:bg-[#f1f5f9] rounded-md transition-colors"
                  title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
                {session && (
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>
      ) : (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-white/80 backdrop-blur-sm border border-[#e2e8f0] rounded-full shadow-sm text-[#94a3b8] hover:text-[#4f46e5] hover:bg-white transition-all flex items-center justify-center"
            title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          <Link
            to="/admin"
            className="p-2 bg-white/80 backdrop-blur-sm border border-[#e2e8f0] rounded-full shadow-sm text-[#94a3b8] hover:text-[#4f46e5] hover:bg-white transition-all flex items-center justify-center"
            title="Quản lý"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white border-b border-[#e2e8f0]">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              <Link
                to="/admin/schedules"
                className={cn(
                  "py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2",
                  location.pathname === '/admin/schedules'
                    ? "border-[#6366f1] text-[#4f46e5]"
                    : "border-transparent text-[#64748b] hover:text-[#334155] hover:border-[#cbd5e1]"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                Lịch công tác
              </Link>
              <Link
                to="/admin/leaders"
                className={cn(
                  "py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2",
                  location.pathname === '/admin/leaders'
                    ? "border-[#6366f1] text-[#4f46e5]"
                    : "border-transparent text-[#64748b] hover:text-[#334155] hover:border-[#cbd5e1]"
                )}
              >
                <Users className="w-4 h-4" />
                Danh sách Lãnh đạo
              </Link>
              <Link
                to="/admin/users"
                className={cn(
                  "py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2",
                  location.pathname === '/admin/users'
                    ? "border-[#6366f1] text-[#4f46e5]"
                    : "border-transparent text-[#64748b] hover:text-[#334155] hover:border-[#cbd5e1]"
                )}
              >
                <Shield className="w-4 h-4" />
                Quản lý tài khoản
              </Link>
            </nav>
          </div>
        </div>
      )}

      <main className={cn("flex-1 w-full mx-auto", isAdmin ? "px-4 sm:px-6 lg:px-8 py-8" : "p-0")}>
        <Outlet />
      </main>
    </div>
  );
}

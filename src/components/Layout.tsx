import { Outlet, Link, useLocation } from 'react-router-dom';
import { Calendar, Users, LayoutDashboard, Settings } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {isAdmin ? (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900 text-lg">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                  <span>Hệ thống quản lý lịch công tác tuần</span>
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to="/"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    !isAdmin ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isAdmin ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Quản lý
                </Link>
              </div>
            </div>
          </div>
        </header>
      ) : (
        <div className="fixed top-4 right-4 z-50">
          <Link
            to="/admin"
            className="p-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full shadow-sm text-slate-400 hover:text-indigo-600 hover:bg-white transition-all flex items-center justify-center"
            title="Quản lý"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              <Link
                to="/admin/schedules"
                className={cn(
                  "py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2",
                  location.pathname === '/admin/schedules'
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
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
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                )}
              >
                <Users className="w-4 h-4" />
                Danh sách Lãnh đạo
              </Link>
            </nav>
          </div>
        </div>
      )}

      <main className={cn("flex-1 w-full mx-auto", isAdmin ? "max-w-7xl px-4 sm:px-6 lg:px-8 py-8" : "px-2 sm:px-4 py-6")}>
        <Outlet />
      </main>
    </div>
  );
}

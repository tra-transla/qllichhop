import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Lock, User, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session } = useAuth();

  // If already logged in, redirect to admin
  if (session) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: `${username}@system.local`,
        password,
      });

      if (error) throw error;
      navigate('/admin');
      } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tên đăng nhập và mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e4fee4] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-[#4f46e5] rounded-xl flex items-center justify-center shadow-sm">
            <Lock className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-[#0f172a]">
          Đăng nhập hệ thống
        </h2>
        <p className="mt-2 text-center text-sm text-[#475569]">
          Dành cho quản trị viên và người cập nhật lịch
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-[#e2e8f0]">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#334155]">
                Tên đăng nhập
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-[#94a3b8]" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 rounded-lg border-[#cbd5e1] focus:border-[#6366f1] focus:ring-[#6366f1] sm:text-sm py-2.5 border"
                  placeholder="Ví dụ: admin"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#334155]">
                Mật khẩu
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[#94a3b8]" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 rounded-lg border-[#cbd5e1] focus:border-[#6366f1] focus:ring-[#6366f1] sm:text-sm py-2.5 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center items-center gap-2 rounded-lg border border-transparent bg-[#4f46e5] py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

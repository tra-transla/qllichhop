import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Shield, User as UserIcon, AlertCircle } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'editor';
}

export default function Users() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'editor'>('editor');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('email');

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist
          setError('Bảng profiles chưa được tạo trong Supabase. Vui lòng xem hướng dẫn bên dưới.');
        } else {
          throw error;
        }
      } else {
        setProfiles(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching profiles:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      // 1. Create user in auth.users
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Create profile in public.profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              email: newEmail,
              role: newRole,
            }
          ]);

        if (profileError) {
          // If profile creation fails, we might have a trigger that already created it,
          // so let's try to update it instead
          if (profileError.code === '23505') { // unique violation
             await supabase
              .from('profiles')
              .update({ role: newRole })
              .eq('id', authData.user.id);
          } else {
            throw profileError;
          }
        }
      }

      setNewEmail('');
      setNewPassword('');
      setNewRole('editor');
      setIsAdding(false);
      fetchProfiles();
    } catch (err: any) {
      console.error('Error creating user:', err);
      alert('Lỗi khi tạo tài khoản: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài khoản này? (Lưu ý: Chỉ xóa profile, user trong Auth cần xóa thủ công trong Supabase Dashboard)')) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchProfiles();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert('Lỗi khi xóa tài khoản: ' + err.message);
    }
  };

  const handleUpdateRole = async (id: string, newRole: 'admin' | 'editor') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', id);

      if (error) throw error;
      fetchProfiles();
    } catch (err: any) {
      console.error('Error updating role:', err);
      alert('Lỗi khi cập nhật quyền: ' + err.message);
    }
  };

  if (error && error.includes('chưa được tạo')) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 text-amber-600 mb-4">
          <AlertCircle className="w-8 h-8" />
          <h2 className="text-xl font-bold">Cần thiết lập Database</h2>
        </div>
        <p className="text-slate-600 mb-4">
          Để sử dụng tính năng quản lý tài khoản, bạn cần tạo bảng <strong>profiles</strong> trong Supabase.
          Vui lòng chạy đoạn mã SQL sau trong phần <strong>SQL Editor</strong> của Supabase:
        </p>
        <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
{`-- Tạo bảng profiles
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  role text default 'editor' check (role in ('admin', 'editor'))
);

-- Bật RLS
alter table public.profiles enable row level security;

-- Tạo policy cho phép đọc/ghi
create policy "Cho phép tất cả đọc profiles" on public.profiles for select using (true);
create policy "Cho phép tất cả thêm profiles" on public.profiles for insert with check (true);
create policy "Cho phép tất cả sửa profiles" on public.profiles for update using (true);
create policy "Cho phép tất cả xóa profiles" on public.profiles for delete using (true);`}
        </pre>
        <button 
          onClick={fetchProfiles}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Tôi đã chạy SQL, thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Quản lý tài khoản</h1>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Thêm tài khoản
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-4">Thêm tài khoản mới</h2>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Ít nhất 6 ký tự"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phân quyền</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'editor')}
                className="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="editor">Người cập nhật lịch (Editor)</option>
                <option value="admin">Quản trị viên (Admin)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? 'Đang tạo...' : 'Lưu'}
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-3 px-4 font-semibold text-slate-600">Email</th>
              <th className="py-3 px-4 font-semibold text-slate-600">Phân quyền</th>
              <th className="py-3 px-4 font-semibold text-slate-600 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-slate-500">Đang tải...</td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-slate-500">Chưa có tài khoản nào</td>
              </tr>
            ) : (
              profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-slate-900">{profile.email}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={profile.role}
                      onChange={(e) => handleUpdateRole(profile.id, e.target.value as 'admin' | 'editor')}
                      className="rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="editor">Người cập nhật lịch</option>
                      <option value="admin">Quản trị viên</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDeleteUser(profile.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa tài khoản"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';

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

interface Leader {
  id: number;
  name: string;
  position: string;
}

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Default to tomorrow 08:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const [formData, setFormData] = useState({
    date: format(tomorrow, 'yyyy-MM-dd'),
    time: '08:00',
    content: '',
    leader_id: '',
    location: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schedRes, leadRes] = await Promise.all([
        supabase
          .from('schedules')
          .select(`
            *,
            leaders (
              name,
              position
            )
          `)
          .order('date', { ascending: false })
          .order('time', { ascending: false }),
        supabase
          .from('leaders')
          .select('*')
          .order('id', { ascending: false })
      ]);

      if (schedRes.error) throw schedRes.error;
      if (leadRes.error) throw leadRes.error;

      const formattedSchedules = (schedRes.data || []).map(s => ({
        ...s,
        leader_name: s.leaders?.name,
        leader_position: s.leaders?.position
      }));

      setSchedules(formattedSchedules);
      setLeaders(leadRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        leader_id: parseInt(formData.leader_id, 10)
      };

      if (editingId) {
        const { error } = await supabase
          .from('schedules')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('schedules')
          .insert([payload]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ ...formData, content: '', location: '' }); // keep date/time/leader for quick entry
      fetchData();
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', deletingId);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    } finally {
      setIsDeleteModalOpen(false);
      setDeletingId(null);
    }
  };

  const openEdit = (schedule: Schedule) => {
    setEditingId(schedule.id);
    setFormData({
      date: schedule.date,
      time: schedule.time.substring(0, 5), // Ensure HH:mm format
      content: schedule.content,
      leader_id: schedule.leader_id.toString(),
      location: schedule.location || ''
    });
    setIsModalOpen(true);
  };

  const openAdd = () => {
    setEditingId(null);
    setIsModalOpen(true);
  };

  const downloadTemplate = () => {
    const wsData = [
      ['Ngày (YYYY-MM-DD)', 'Giờ (HH:MM)', 'Nội dung', 'ID Lãnh đạo', 'Địa điểm'],
      [format(tomorrow, 'yyyy-MM-dd'), '08:00', 'Họp giao ban thường kỳ', leaders[0]?.id || 1, 'Phòng họp số 1']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const leadersData = [['ID', 'Họ tên', 'Chức vụ', 'Phòng/Ban']];
    leaders.forEach(l => leadersData.push([l.id, l.name, l.position, (l as any).department || '']));
    const wsLeaders = XLSX.utils.aoa_to_sheet(leadersData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LichCongTac');
    XLSX.utils.book_append_sheet(wb, wsLeaders, 'DanhSachLanhDao');

    XLSX.writeFile(wb, 'Mau_Nhap_Lich_Cong_Tac.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const payloads = jsonData.map((row: any) => {
        let date = row['Ngày (YYYY-MM-DD)'];
        if (date instanceof Date) {
          date = format(date, 'yyyy-MM-dd');
        }
        
        let time = row['Giờ (HH:MM)'];
        if (time instanceof Date) {
          time = format(time, 'HH:mm');
        } else if (typeof time === 'number') {
           const totalSeconds = Math.round(time * 86400);
           const hours = Math.floor(totalSeconds / 3600);
           const minutes = Math.floor((totalSeconds % 3600) / 60);
           time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }

        return {
          date: date,
          time: time,
          content: row['Nội dung'],
          leader_id: parseInt(row['ID Lãnh đạo'], 10),
          location: row['Địa điểm'] || ''
        };
      }).filter((p: any) => p.date && p.time && p.content && !isNaN(p.leader_id));

      if (payloads.length === 0) {
        alert('Không tìm thấy dữ liệu hợp lệ trong file. Vui lòng kiểm tra lại định dạng.');
        return;
      }

      const { error } = await supabase.from('schedules').insert(payloads);
      if (error) throw error;

      alert(`Đã nhập thành công ${payloads.length} lịch công tác!`);
      fetchData();
    } catch (error) {
      console.error('Lỗi khi nhập file:', error);
      alert('Có lỗi xảy ra khi nhập dữ liệu. Vui lòng kiểm tra lại định dạng file.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Quản lý Lịch công tác</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition-colors font-medium"
            title="Tải file mẫu"
          >
            <Download className="w-4 h-4" />
            File mẫu
          </button>
          
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
          </button>

          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Thêm lịch mới
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-3 px-6 font-semibold text-slate-900 w-32">Ngày</th>
              <th className="py-3 px-6 font-semibold text-slate-900 w-24">Giờ</th>
              <th className="py-3 px-6 font-semibold text-slate-900">Nội dung</th>
              <th className="py-3 px-6 font-semibold text-slate-900 w-48">Đồng chí</th>
              <th className="py-3 px-6 font-semibold text-slate-900 w-48">Địa điểm</th>
              <th className="py-3 px-6 font-semibold text-slate-900 text-right w-24">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">Đang tải dữ liệu...</td>
              </tr>
            ) : schedules.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">Chưa có lịch công tác nào</td>
              </tr>
            ) : (
              schedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-6 font-medium text-slate-900">
                    {format(parseISO(schedule.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="py-3 px-6 text-slate-600 font-mono text-sm">{schedule.time}</td>
                  <td className="py-3 px-6 text-slate-900">{schedule.content}</td>
                  <td className="py-3 px-6 text-slate-600">
                    <span className="font-medium text-slate-900">{schedule.leader_position}</span> {schedule.leader_name}
                  </td>
                  <td className="py-3 px-6 text-slate-600">{schedule.location}</td>
                  <td className="py-3 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(schedule)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        title="Sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(schedule.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? 'Sửa lịch công tác' : 'Thêm lịch công tác mới'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian *</label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung công việc *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="Nhập nội dung công việc..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Đồng chí (Lãnh đạo) *</label>
                  <select
                    required
                    value={formData.leader_id}
                    onChange={(e) => setFormData({ ...formData, leader_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="" disabled>-- Chọn Lãnh đạo --</option>
                    {leaders.map(leader => (
                      <option key={leader.id} value={leader.id}>
                        {leader.position} {leader.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Địa điểm *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="VD: Phòng họp BCH"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Lưu lịch công tác
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-slate-500 mb-6">
              Bạn có chắc chắn muốn xóa lịch công tác này? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingId(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Xóa lịch công tác
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

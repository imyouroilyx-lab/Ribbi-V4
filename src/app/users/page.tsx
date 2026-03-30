'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  UserCheck, 
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  AtSign
} from 'lucide-react';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    checkAuthAndFetchUsers();
  }, []);

  const checkAuthAndFetchUsers = async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error: supabaseError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // กรองข้อมูลโดยใช้เฉพาะฟิลด์ที่มีใน Type User (display_name, username)
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const displayName = user.display_name || '';
      const username = user.username || '';
      const search = searchTerm.toLowerCase();
      
      return displayName.toLowerCase().includes(search) || 
             username.toLowerCase().includes(search);
    });
  }, [users, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <img 
            src="https://iili.io/qbtgKBt.png" 
            className="w-16 h-16 mx-auto mb-4 animate-bounce opacity-50" 
            alt="Loading" 
          />
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
          <p className="text-gray-500 mt-2 text-sm">กำลังโหลดรายชื่อสมาชิก...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">จัดการสมาชิก</h1>
            <p className="text-slate-500 text-sm">แสดงรายชื่อผู้ใช้งานทั้งหมดในระบบ</p>
          </div>
          <button className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-sm font-semibold">
            <UserPlus size={18} />
            <span>เพิ่มสมาชิกใหม่</span>
          </button>
        </div>

        {/* Stats Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">สมาชิกทั้งหมด</p>
            <p className="text-2xl font-black text-slate-800">{users.length} <span className="text-sm font-normal text-slate-400">คน</span></p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 rounded-t-2xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="ค้นหาด้วยชื่อแสดงตัวตน หรือ username..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchUsers}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-all text-sm font-medium"
          >
            <Filter size={18} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-b-2xl border border-slate-200 overflow-hidden shadow-sm">
          {error ? (
            <div className="p-16 text-center">
              <AlertCircle size={48} className="mx-auto mb-4 text-red-200" />
              <p className="font-bold text-slate-800">เกิดข้อผิดพลาด</p>
              <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">{error}</p>
              <button onClick={fetchUsers} className="mt-4 text-indigo-600 font-semibold text-sm hover:underline">ลองใหม่อีกครั้ง</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <th className="px-6 py-4">โปรไฟล์</th>
                    <th className="px-6 py-4">ชื่อผู้ใช้ (Username)</th>
                    <th className="px-6 py-4">วันที่เข้าร่วม</th>
                    <th className="px-6 py-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full border-2 border-white shadow-sm bg-slate-200 flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                              {user.profile_img_url ? (
                                <img src={user.profile_img_url} alt={user.display_name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black uppercase">
                                  {user.display_name?.charAt(0) || user.username?.charAt(0) || '?'}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 truncate leading-tight">{user.display_name || 'General Member'}</div>
                              <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter mt-0.5">Verified User</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <AtSign size={14} className="text-slate-400" />
                            <span className="text-sm">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-100 transition-all">
                              <Edit2 size={16} />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-100 transition-all">
                              <Trash2 size={16} />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-100 transition-all">
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <div className="text-slate-300 mb-2 flex justify-center">
                          <Search size={40} />
                        </div>
                        <p className="text-slate-400 text-sm font-medium">
                          {searchTerm ? `ไม่พบข้อมูลที่ตรงกับ "${searchTerm}"` : 'ยังไม่มีสมาชิกในระบบ'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Total: {filteredUsers.length} Users
            </span>
            <div className="flex gap-2">
              <button disabled className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-300 cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <button disabled className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-300 cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

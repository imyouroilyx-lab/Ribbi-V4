'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Mail, 
  Shield, 
  UserCheck, 
  UserX, 
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react';

// เราจะดึง Layout หรือสไตล์ที่คล้ายกับหน้าเพื่อนมาใช้เพื่อให้ UI ไปในทิศทางเดียวกัน
export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  useEffect(() => {
    checkAuthAndFetchUsers();
  }, []);

  const checkAuthAndFetchUsers = async () => {
    try {
      setLoading(true);
      // ตรวจสอบ Auth เหมือนในตัวอย่าง friends/page.tsx
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

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const name = user.display_name || user.username || '';
      const email = user.email || '';
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           email.toLowerCase().includes(searchTerm.toLowerCase());
      
      // หมายเหตุ: ถ้าใน table users ไม่มี column role ให้ปรับตรงนี้
      // สำหรับตอนนี้เราจะรองรับเผื่อไว้ หรือกรองแค่ search ถ้าไม่มี role
      return matchesSearch;
    });
  }, [users, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-gray-600">กำลังโหลดรายชื่อสมาชิก...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">รายชื่อสมาชิกทั้งหมด</h1>
            <p className="text-slate-500 text-sm">จัดการและตรวจสอบข้อมูลผู้ใช้งานในระบบ</p>
          </div>
          <button className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm text-sm font-medium">
            <UserPlus size={18} />
            <span>เพิ่มสมาชิกใหม่</span>
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <UserCheck size={20} />
              </div>
              <div>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">สมาชิกทั้งหมด</p>
                <p className="text-xl font-bold">{users.length}</p>
              </div>
            </div>
          </div>
          {/* เพิ่ม Stats อื่นๆ ได้ตามต้องการ */}
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="ค้นหาด้วยชื่อ, username หรือ อีเมล..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchUsers}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors text-sm"
          >
            <Filter size={18} />
            <span>รีเฟรช</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          {error ? (
            <div className="p-12 text-center text-red-500">
              <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-semibold">ไม่สามารถโหลดข้อมูลได้</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">ข้อมูลสมาชิก</th>
                    <th className="px-6 py-4">Username</th>
                    <th className="px-6 py-4">วันที่สมัคร</th>
                    <th className="px-6 py-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-100 flex-shrink-0 overflow-hidden">
                              {user.profile_img_url ? (
                                <img src={user.profile_img_url} alt={user.display_name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-200 text-sm font-bold uppercase">
                                  {user.display_name?.charAt(0) || user.username?.charAt(0) || '?'}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate">{user.display_name || 'ไม่มีชื่อแสดง'}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1 truncate">
                                <Mail size={12} /> {user.email || 'ไม่มีอีเมล'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono text-slate-600">@{user.username}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                              <Edit2 size={16} />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                              <Trash2 size={16} />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        {searchTerm ? 'ไม่พบสมาชิกที่ตรงกับการค้นหา' : 'ยังไม่มีข้อมูลสมาชิกในระบบ'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer / Pagination Placeholder */}
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              พบทั้งหมด {filteredUsers.length} รายการ
            </p>
            <div className="flex gap-1">
              <button disabled className="p-1.5 border border-slate-200 rounded-md bg-white disabled:opacity-50 text-slate-400">
                <ChevronLeft size={16} />
              </button>
              <button disabled className="p-1.5 border border-slate-200 rounded-md bg-white disabled:opacity-50 text-slate-400">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
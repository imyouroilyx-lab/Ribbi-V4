'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Users, 
  ChevronRight, 
  AtSign, 
  Calendar,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';

/**
 * หน้าแสดงรายการสมาชิก (Member Directory)
 * เชื่อมต่อกับ Supabase จริง และเน้นการคลิกเข้าดูโปรไฟล์
 */

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
      
      // ตรวจสอบการ Login
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

  // กรองข้อมูลสมาชิกตามชื่อหรือ username
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const displayName = user.display_name || '';
      const username = user.username || '';
      const search = searchTerm.toLowerCase();
      
      return displayName.toLowerCase().includes(search) || 
             username.toLowerCase().includes(search);
    });
  }, [users, searchTerm]);

  const handleViewProfile = (username: string) => {
    if (!username) return;
    router.push(`/profile/${username}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <Users className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
        </div>
        <p className="mt-4 text-slate-500 font-medium animate-pulse">กำลังโหลดข้อมูลสมาชิกจากระบบ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider">
                <Sparkles size={16} />
                <span>Member Directory</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">ทำความรู้จักสมาชิก</h1>
              <p className="text-slate-500 text-sm md:text-base">ค้นหาและเชื่อมต่อกับผู้ใช้งานคนอื่นๆ ในระบบ</p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="ค้นหาด้วยชื่อ หรือ username..."
                className="w-full pl-11 pr-4 py-3 bg-slate-100 border-transparent border focus:border-indigo-500 focus:bg-white rounded-2xl focus:outline-none transition-all shadow-inner text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 mt-8">
        {error ? (
          <div className="bg-white p-12 rounded-3xl border border-red-100 shadow-sm text-center max-w-md mx-auto">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h3 className="text-lg font-bold text-slate-800">เกิดข้อผิดพลาด</h3>
            <p className="text-slate-500 mt-2 text-sm">{error}</p>
            <button 
              onClick={fetchUsers}
              className="mt-6 bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Users size={14} />
                <span>พบสมาชิก {filteredUsers.length} คน</span>
              </div>
            </div>

            {filteredUsers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredUsers.map((user) => (
                  <div 
                    key={user.id}
                    onClick={() => handleViewProfile(user.username || '')}
                    className="group bg-white border border-slate-200 rounded-3xl p-5 flex items-center gap-4 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-50 group-hover:border-indigo-100 transition-colors shadow-sm">
                        {user.profile_img_url ? (
                          <img 
                            src={user.profile_img_url} 
                            alt={user.display_name || 'User'} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${user.display_name || user.username}&background=random`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 font-bold text-xl uppercase">
                            {user.display_name?.charAt(0) || user.username?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full"></div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                        {user.display_name || 'General Member'}
                      </h3>
                      <div className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                        <AtSign size={12} className="text-indigo-400" />
                        <span className="font-medium truncate">{user.username || 'unknown'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-2 font-medium uppercase tracking-tighter">
                        <Calendar size={10} />
                        เข้าร่วมเมื่อ {user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }) : '-'}
                      </div>
                    </div>

                    {/* Action Icon */}
                    <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 text-slate-300 transition-all">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={32} className="text-slate-300" />
                </div>
                <h3 className="font-bold text-slate-800">ไม่พบข้อมูลที่ค้นหา</h3>
                <p className="text-slate-500 text-sm mt-1">ลองใช้คำค้นหาอื่น หรือตรวจสอบตัวสะกดอีกครั้ง</p>
                <button 
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-indigo-600 text-sm font-bold hover:underline"
                >
                  ล้างการค้นหา
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile Indicator */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-sm font-semibold whitespace-nowrap md:hidden pointer-events-none">
        <Users size={16} className="text-indigo-400" />
        <span>เลือกชมโปรไฟล์สมาชิก</span>
      </div>
    </div>
  );
}

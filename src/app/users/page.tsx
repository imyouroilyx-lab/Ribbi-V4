'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { 
  Search, 
  Users, 
  ChevronRight, 
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  UserCheck
} from 'lucide-react';

const USERS_PER_PAGE = 20;
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface UserWithFriendship extends User {
  isFriend?: boolean;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithFriendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. ตรวจสอบ Session ผู้ใช้ปัจจุบัน
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }

      // 2. สร้าง Query สำหรับดึงรายชื่อผู้ใช้พร้อมนับจำนวนทั้งหมด (Server-side Filter)
      let query = supabase
        .from('users')
        .select('id, username, display_name, profile_img_url, created_at', { count: 'exact' });

      // กรองตามตัวอักษรที่ขึ้นต้น
      if (selectedLetter) {
        query = query.ilike('display_name', `${selectedLetter}%`);
      }

      // กรองตามคำค้นหา (Search)
      if (searchTerm) {
        query = query.or(`display_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`);
      }

      // 3. ทำ Pagination (ดึงเฉพาะช่วงที่ต้องการ)
      const from = (currentPage - 1) * USERS_PER_PAGE;
      const to = from + USERS_PER_PAGE - 1;

      const { data: userData, count, error: userError } = await query
        .order('display_name', { ascending: true })
        .range(from, to);

      if (userError) throw userError;
      setTotalCount(count || 0);

      if (userData && userData.length > 0) {
        // 4. ดึงข้อมูลสถานะเพื่อนเฉพาะ User IDs ที่แสดงในหน้านี้ (ประหยัด Bandwidth)
        const userIdsInPage = userData.map(u => u.id);
        
        const { data: friendshipData, error: friendError } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(`and(user_id.eq.${authUser.id},friend_id.in.(${userIdsInPage.join(',')})),and(friend_id.eq.${authUser.id},user_id.in.(${userIdsInPage.join(',')}))`);

        if (friendError) throw friendError;

        // สร้าง Set ของ ID เพื่อนเพื่อเปรียบเทียบข้อมูล
        const friendIdSet = new Set();
        friendshipData?.forEach(f => {
          friendIdSet.add(f.user_id === authUser.id ? f.friend_id : f.user_id);
        });

        // รวมข้อมูลเข้าด้วยกัน
        const finalUsers = userData.map(u => ({
          ...u,
          isFriend: friendIdSet.has(u.id)
        }));

        setUsers(finalUsers);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedLetter, router]);

  // ใช้ Debounce สำหรับการพิมพ์ค้นหาเพื่อลดการยิง API
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchUsers();
    }, 400);
    return () => clearTimeout(handler);
  }, [fetchUsers]);

  const totalPages = Math.ceil(totalCount / USERS_PER_PAGE);

  return (
    <NavLayout>
      <div className="min-h-screen bg-[#F8FAFC] pb-20">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Users className="text-indigo-600" size={24} />
                  สมาชิก Ribbi
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">ค้นพบเพื่อนใหม่ ({totalCount.toLocaleString()} รายการ)</p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="ค้นหาชื่อ..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent border focus:border-indigo-500 focus:bg-white rounded-xl focus:outline-none transition-all text-sm font-medium"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            {/* Alphabet Filter */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-shrink-0 text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <Filter size={12} /> กรอง A-Z
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar items-center">
                <button 
                  onClick={() => { setSelectedLetter(null); setCurrentPage(1); }}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${!selectedLetter ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  ทั้งหมด
                </button>
                {ALPHABETS.map(letter => (
                  <button 
                    key={letter}
                    onClick={() => { setSelectedLetter(letter); setCurrentPage(1); }}
                    className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${selectedLetter === letter ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <main className="max-w-5xl mx-auto px-4 mt-6">
          {loading && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="mt-4 text-slate-400 text-sm font-medium">กำลังโหลดข้อมูล...</p>
            </div>
          ) : users.length > 0 ? (
            <>
              <div className="mb-4 px-1 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  แสดง {users.length} รายการ จากทั้งหมด {totalCount}
                </span>
                {loading && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                {users.map((user) => (
                  <div 
                    key={user.id}
                    onClick={() => router.push(`/profile/${user.username}`)}
                    className="group bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                      <img 
                        src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} 
                        alt={user.display_name || ''} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 truncate">
                          {user.display_name}
                        </h3>
                        {user.isFriend && (
                          <span className="flex-shrink-0 flex items-center gap-0.5 bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-emerald-100">
                            <UserCheck size={10} />
                            เพื่อน
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">@{user.username}</p>
                    </div>

                    <div className="text-slate-300 group-hover:text-indigo-600 transition-colors">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  <button 
                    disabled={currentPage === 1 || loading}
                    onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0 }); }}
                    className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="bg-white border border-slate-200 px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600">
                    หน้า {currentPage} จาก {totalPages}
                  </div>
                  <button 
                    disabled={currentPage === totalPages || loading}
                    onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0 }); }}
                    className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRightIcon size={18} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center">
              <p className="text-slate-400 text-sm">ไม่พบสมาชิกที่ตรงตามเงื่อนไข</p>
              {(searchTerm || selectedLetter) && (
                <button 
                  onClick={() => {setSearchTerm(''); setSelectedLetter(null); setCurrentPage(1);}} 
                  className="mt-2 text-indigo-600 text-xs font-bold hover:underline"
                >
                  ล้างการกรองทั้งหมด
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </NavLayout>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { supabase, User } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '../../components/NavLayout';
import { Search, Users, ChevronLeft, ChevronRight, UserPlus, UserCheck, Clock, Loader2 } from 'lucide-react';

const USERS_PER_PAGE = 20;
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface UserWithFriendship {
  id: string;
  username: string;
  display_name: string;
  profile_img_url?: string;
  is_online?: boolean;
  friendshipStatus: 'none' | 'pending' | 'accepted' | 'sent';
  friendshipId?: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithFriendship[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. เช็ค Auth ครั้งแรก
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
      } else {
        router.push('/login');
      }
    };
    initAuth();
  }, [router]);

  // 2. ระบบ Debounce ค้นหา (✅ จูนให้ฉลาดขึ้น ไม่รันซ้ำซ้อนตอนโหลดครั้งแรก)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedSearch !== searchTerm) {
        setDebouncedSearch(searchTerm);
        setCurrentPage(1); // กลับไปหน้า 1 เฉพาะตอนที่คำค้นหาเปลี่ยนจริงๆ
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearch]);

  // 3. ดึงข้อมูล
  useEffect(() => {
    if (!currentUserId) return;

    const fetchUsers = async () => {
      if (users.length > 0) setRefreshing(true);
      else setInitialLoading(true);

      try {
        const from = (currentPage - 1) * USERS_PER_PAGE;

        // ✅ ใช้ RPC ดึงข้อมูลรวดเดียวจบ (เร็วและประหยัด Bandwidth ที่สุด)
        const { data, error } = await supabase.rpc('get_users_with_friendship', {
          p_current_user_id: currentUserId,
          p_search: debouncedSearch || null,
          p_letter: selectedLetter || null,
          p_from: from,
          p_to: from + USERS_PER_PAGE - 1
        });

        if (error) throw error;

        const result = data as { count: number; users: any[] };
        setTotalCount(result.count);
        setUsers(
          result.users.map(u => ({
            id: u.id,
            username: u.username,
            display_name: u.display_name,
            profile_img_url: u.profile_img_url,
            is_online: u.is_online,
            friendshipStatus: u.friendship_status,
            friendshipId: u.friendship_id ?? undefined,
          }))
        );
      } catch (err: any) {
        console.error('Fetch error:', err.message);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    };

    fetchUsers();
  }, [currentPage, debouncedSearch, selectedLetter, currentUserId]); // ถอด users ออกจาก Dependency ป้องกัน Loop

  const handleAddFriend = async (targetId: string) => {
    if (!currentUserId || actionId) return;
    setActionId(targetId);
    try {
      const { data: newFriendship, error } = await supabase
        .from('friendships')
        .insert({ sender_id: currentUserId, receiver_id: targetId, status: 'pending' })
        .select('id').single();
      if (error) throw error;

      supabase.from('notifications').insert({
        receiver_id: targetId, sender_id: currentUserId, type: 'friend_request'
      });

      setUsers(prev => prev.map(u =>
        u.id === targetId ? { ...u, friendshipStatus: 'sent', friendshipId: newFriendship.id } : u
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  };

  const handleCancelOrRemove = async (targetUser: UserWithFriendship) => {
    if (!currentUserId || !targetUser.friendshipId || actionId) return;
    setActionId(targetUser.id);
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', targetUser.friendshipId);
      if (error) throw error;
      setUsers(prev => prev.map(u =>
        u.id === targetUser.id ? { ...u, friendshipStatus: 'none', friendshipId: undefined } : u
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / USERS_PER_PAGE);

  return (
    <NavLayout>
      <div className="min-h-screen bg-[#F8FAFC] pb-20">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm animate-in fade-in duration-300">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Users className="text-indigo-600" size={24} />
                  สมาชิก Ribbi
                </h1>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
                  MEMBER DIRECTORY ({totalCount.toLocaleString()})
                </p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white focus:outline-none transition-all text-sm font-medium shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => { setSelectedLetter(null); setCurrentPage(1); }}
                className={`flex-shrink-0 px-3 py-1 rounded-lg text-[10px] font-black transition-all ${!selectedLetter ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                ทั้งหมด
              </button>
              {ALPHABETS.map(letter => (
                <button
                  key={letter}
                  onClick={() => { setSelectedLetter(letter); setCurrentPage(1); }}
                  className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${selectedLetter === letter ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-4 mt-6">
          {initialLoading ? (
            <div className="flex flex-col justify-center items-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
              <p className="text-xs font-black text-slate-400 tracking-widest uppercase">กำลังดึงข้อมูลสมาชิก...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
              <Users size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 text-sm font-black uppercase tracking-widest">ไม่พบสมาชิกที่คุณต้องการ</p>
            </div>
          ) : (
            <div className={`transition-opacity duration-300 ${refreshing ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => router.push(`/profile/${user.username}`)}
                    className="group bg-white border border-slate-200 rounded-[1.5rem] p-3 flex items-center gap-3 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <div className="w-full h-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-50">
                        <img
                          src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      {user.is_online && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-sm z-10" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-sm text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{user.display_name}</h3>
                      <p className="text-[10px] text-slate-500 truncate font-bold uppercase">@{user.username}</p>
                    </div>

                    <div className="flex-shrink-0">
                      {user.friendshipStatus === 'none' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddFriend(user.id); }}
                          disabled={actionId === user.id}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm active:scale-90"
                        >
                          {actionId === user.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={14} />}
                          เพิ่มเพื่อน
                        </button>
                      )}
                      {user.friendshipStatus === 'sent' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelOrRemove(user); }}
                          disabled={actionId === user.id}
                          className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black hover:text-red-500 hover:bg-red-50 transition flex items-center gap-1.5 active:scale-90"
                        >
                          {actionId === user.id ? <Loader2 size={12} className="animate-spin" /> : <Clock size={14} />}
                          ยกเลิกคำขอ
                        </button>
                      )}
                      {user.friendshipStatus === 'accepted' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelOrRemove(user); }}
                          disabled={actionId === user.id}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition flex items-center gap-1.5 shadow-sm active:scale-90"
                        >
                          {actionId === user.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={14} className="text-green-500" />}
                          เพื่อนกัน
                        </button>
                      )}
                      {user.friendshipStatus === 'pending' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push('/friends'); }}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black hover:bg-indigo-100 transition flex items-center gap-1.5 border border-indigo-100 active:scale-90"
                        >
                          <Clock size={14} />
                          รอยืนยัน
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-3">
                  <button
                    disabled={currentPage === 1 || refreshing}
                    onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="p-3 bg-white border border-slate-200 rounded-2xl disabled:opacity-30 shadow-sm hover:bg-slate-50 active:scale-90 transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="bg-white border border-slate-200 px-6 py-2.5 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                    Page {currentPage} of {totalPages}
                  </div>
                  <button
                    disabled={currentPage === totalPages || refreshing}
                    onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="p-3 bg-white border border-slate-200 rounded-2xl disabled:opacity-30 shadow-sm hover:bg-slate-50 active:scale-90 transition-all"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </NavLayout>
  );
}

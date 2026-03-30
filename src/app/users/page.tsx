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
  UserPlus,
  UserMinus
} from 'lucide-react';

const USERS_PER_PAGE = 20;
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// แก้ไข Type Error โดยการ Omit field ที่มีปัญหาออกก่อนแล้วกำหนดใหม่เป็น optional
interface UserWithFriendship extends Omit<User, 'updated_at'> {
  isFriend?: boolean;
  updated_at?: string; 
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithFriendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }
      setCurrentUserId(authUser.id);

      // ดึงข้อมูลพื้นฐาน
      let query = supabase
        .from('users')
        .select('id, username, display_name, profile_img_url, created_at, updated_at', { count: 'exact' });

      if (selectedLetter) {
        query = query.ilike('display_name', `${selectedLetter}%`);
      }

      if (searchTerm) {
        query = query.or(`display_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`);
      }

      const from = (currentPage - 1) * USERS_PER_PAGE;
      const to = from + USERS_PER_PAGE - 1;

      const { data: userData, count, error: userError } = await query
        .order('display_name', { ascending: true })
        .range(from, to);

      if (userError) throw userError;
      setTotalCount(count || 0);

      if (userData && userData.length > 0) {
        const userIdsInPage = userData.map(u => u.id);
        
        // ตรวจสอบความเป็นเพื่อน
        const { data: friendshipData, error: friendError } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(`and(user_id.eq.${authUser.id},friend_id.in.(${userIdsInPage.join(',')})),and(friend_id.eq.${authUser.id},user_id.in.(${userIdsInPage.join(',')}))`);

        if (friendError) throw friendError;

        const friendIdSet = new Set();
        friendshipData?.forEach(f => {
          friendIdSet.add(f.user_id === authUser.id ? f.friend_id : f.user_id);
        });

        const finalUsers: UserWithFriendship[] = userData.map(u => ({
          ...u,
          isFriend: friendIdSet.has(u.id)
        }));

        setUsers(finalUsers);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      console.error('Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedLetter, router]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchUsers();
    }, 400);
    return () => clearTimeout(handler);
  }, [fetchUsers]);

  const handleToggleFriend = async (e: React.MouseEvent, targetUser: UserWithFriendship) => {
    e.stopPropagation();
    if (!currentUserId || actionId) return;

    try {
      setActionId(targetUser.id);
      
      if (targetUser.isFriend) {
        // ลบเพื่อน
        const { error } = await supabase
          .from('friendships')
          .delete()
          .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${currentUserId})`);
        
        if (error) throw error;
      } else {
        // เพิ่มเพื่อน
        const { error } = await supabase
          .from('friendships')
          .insert({
            user_id: currentUserId,
            friend_id: targetUser.id,
            status: 'accepted'
          });
        
        if (error) throw error;
      }

      // Optimistic UI Update
      setUsers(prev => prev.map(u => 
        u.id === targetUser.id ? { ...u, isFriend: !u.isFriend } : u
      ));

    } catch (err: any) {
      console.error('Toggle error:', err.message);
    } finally {
      setActionId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / USERS_PER_PAGE);

  return (
    <NavLayout>
      <div className="min-h-screen bg-[#F8FAFC] pb-20">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Users className="text-indigo-600" size={24} />
                  สมาชิก Ribbi
                </h1>
                <p className="text-slate-500 text-xs">ค้นพบเพื่อนใหม่ ({totalCount.toLocaleString()} รายการ)</p>
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

            <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button 
                onClick={() => { setSelectedLetter(null); setCurrentPage(1); }}
                className={`flex-shrink-0 px-3 py-1 rounded-lg text-[10px] font-black transition-all ${!selectedLetter ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
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

        <main className="max-w-5xl mx-auto px-4 mt-6">
          {loading && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : users.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {users.map((user) => (
                  <div 
                    key={user.id}
                    onClick={() => router.push(`/profile/${user.username}`)}
                    className="group bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                      <img 
                        src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} 
                        alt="" 
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{user.display_name}</h3>
                      <p className="text-[10px] text-slate-500 truncate">@{user.username}</p>
                    </div>

                    <div className="flex-shrink-0">
                      {user.id !== currentUserId ? (
                        <button
                          onClick={(e) => handleToggleFriend(e, user)}
                          disabled={actionId === user.id}
                          className={`min-w-[90px] px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border shadow-sm flex items-center justify-center gap-1.5
                            ${user.isFriend 
                              ? 'bg-white border-slate-200 text-slate-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600' 
                              : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700'
                            }`}
                        >
                          {actionId === user.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : user.isFriend ? (
                            <><UserMinus size={14} /> ลบเพื่อน</>
                          ) : (
                            <><UserPlus size={14} /> เพิ่มเพื่อน</>
                          )}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-bold px-2 italic">คุณ</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  <button 
                    disabled={currentPage === 1 || loading}
                    onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0 }); }}
                    className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="bg-white border border-slate-200 px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600">
                    หน้า {currentPage} / {totalPages}
                  </div>
                  <button 
                    disabled={currentPage === totalPages || loading}
                    onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0 }); }}
                    className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm"
                  >
                    <ChevronRightIcon size={18} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-slate-400 text-sm">ไม่พบสมาชิก</div>
          )}
        </main>
      </div>
    </NavLayout>
  );
}

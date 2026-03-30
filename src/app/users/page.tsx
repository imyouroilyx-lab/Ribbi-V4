'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Search, 
  Users, 
  ChevronRight, 
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  UserCheck,
  UserPlus,
  UserMinus,
  Home,
  MessageSquare,
  Bell,
  User as UserIcon
} from 'lucide-react';

// --- Initialization for Supabase (Empty strings for placeholder) ---
const apiKey = "";
const supabaseUrl = ''; 
const supabase = createClient(supabaseUrl, apiKey);

// --- Interface Definitions ---
// ปรับให้เป็น optional (?) เพื่อป้องกันความผิดพลาดจากการขาดหายของข้อมูลบางฟิลด์
interface User {
  id: string;
  username: string;
  display_name: string;
  profile_img_url?: string;
  created_at?: string;
  updated_at?: string; 
}

interface UserWithFriendship extends User {
  isFriend?: boolean;
}

// --- Mock NavLayout Component ---
const NavLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1">{children}</div>
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center md:hidden">
        <Home className="text-slate-400" size={24} />
        <Users className="text-indigo-600" size={24} />
        <MessageSquare className="text-slate-400" size={24} />
        <Bell className="text-slate-400" size={24} />
        <UserIcon className="text-slate-400" size={24} />
      </nav>
    </div>
  );
};

const USERS_PER_PAGE = 20;
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function UsersPage() {
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
      
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      
      if (!authUser) return;
      setCurrentUserId(authUser.id);

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

      if (userData) {
        const userIdsInPage = userData.map(u => u.id);
        
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

        // กำหนดข้อมูลโดยระบุ Type ให้ชัดเจน
        const finalUsers: UserWithFriendship[] = userData.map(u => ({
          ...u,
          isFriend: friendIdSet.has(u.id)
        }));

        setUsers(finalUsers);
      }
    } catch (err: any) {
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedLetter]);

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
        await supabase
          .from('friendships')
          .delete()
          .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${currentUserId})`);
      } else {
        await supabase
          .from('friendships')
          .insert({
            user_id: currentUserId,
            friend_id: targetUser.id,
            status: 'accepted'
          });
      }

      setUsers(prev => prev.map(u => 
        u.id === targetUser.id ? { ...u, isFriend: !u.isFriend } : u
      ));
    } catch (err: any) {
      console.error('Action error:', err.message);
    } finally {
      setActionId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / USERS_PER_PAGE);

  return (
    <NavLayout>
      <div className="min-h-screen bg-[#F8FAFC] pb-20">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Users className="text-indigo-600" size={24} />
                  สมาชิก Ribbi
                </h1>
                <p className="text-slate-500 text-xs">พบสมาชิก {totalCount.toLocaleString()} รายการ</p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="ค้นหาชื่อ..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl focus:outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>

            <div className="mt-4 flex gap-1 overflow-x-auto pb-2 no-scrollbar">
              <button 
                onClick={() => { setSelectedLetter(null); setCurrentPage(1); }}
                className={`flex-shrink-0 px-3 py-1 rounded-lg text-[10px] font-bold ${!selectedLetter ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                ทั้งหมด
              </button>
              {ALPHABETS.map(letter => (
                <button 
                  key={letter}
                  onClick={() => { setSelectedLetter(letter); setCurrentPage(1); }}
                  className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-bold ${selectedLetter === letter ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </div>

        <main className="max-w-5xl mx-auto px-4 mt-6">
          {loading && users.length === 0 ? (
            <div className="py-20 text-center"><Loader2 className="mx-auto animate-spin text-indigo-600" /></div>
          ) : users.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map((user) => (
                <div key={user.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                    <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{user.display_name}</h3>
                    <p className="text-[10px] text-slate-500">@{user.username}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {user.id !== currentUserId ? (
                      <button
                        onClick={(e) => handleToggleFriend(e, user)}
                        disabled={actionId === user.id}
                        className={`min-w-[90px] px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border shadow-sm flex items-center justify-center gap-1
                          ${user.isFriend 
                            ? 'bg-white border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200' 
                            : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700'
                          }`}
                      >
                        {actionId === user.id ? <Loader2 size={12} className="animate-spin" /> : 
                         user.isFriend ? <><UserMinus size={14} /> ลบเพื่อน</> : <><UserPlus size={14} /> เพิ่มเพื่อน</>}
                      </button>
                    ) : <span className="text-[10px] text-slate-300 italic">คุณ</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="py-20 text-center text-slate-400">ไม่พบข้อมูล</div>}

          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="p-2 bg-white border rounded-lg disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span className="text-xs font-bold text-slate-600">หน้า {currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="p-2 bg-white border rounded-lg disabled:opacity-30"><ChevronRightIcon size={16} /></button>
            </div>
          )}
        </main>
      </div>
    </NavLayout>
  );
}

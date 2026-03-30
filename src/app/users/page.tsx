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
  UserCheck,
  Clock,
  UserMinus
} from 'lucide-react';

const USERS_PER_PAGE = 20;
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ปรับปรุง Interface ให้รองรับสถานะความสัมพันธ์
interface UserWithFriendship extends Omit<User, 'updated_at'> {
  friendshipStatus?: 'none' | 'pending' | 'accepted' | 'sent';
  friendshipId?: string;
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

      // 1. ดึงข้อมูล User ทั้งหมดที่เข้าเงื่อนไข
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
        
        // 2. ตรวจสอบสถานะความสัมพันธ์จากตาราง friendships (ใช้ sender_id/receiver_id)
        const { data: friendshipData } = await supabase
          .from('friendships')
          .select('id, sender_id, receiver_id, status')
          .or(`sender_id.in.(${userIdsInPage.join(',')}),receiver_id.in.(${userIdsInPage.join(',')})`)
          .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`);

        // สร้างแผนผังความสัมพันธ์เพื่อความเร็วในการ Map
        const finalUsers: UserWithFriendship[] = userData.map(u => {
          const rel = friendshipData?.find(f => 
            (f.sender_id === authUser.id && f.receiver_id === u.id) || 
            (f.sender_id === u.id && f.receiver_id === authUser.id)
          );

          let status: 'none' | 'pending' | 'accepted' | 'sent' = 'none';
          if (rel) {
            if (rel.status === 'accepted') {
              status = 'accepted';
            } else if (rel.sender_id === authUser.id) {
              status = 'sent'; // เราส่งไปหาเขา
            } else {
              status = 'pending'; // เขาส่งมาหาเรา
            }
          }

          return {
            ...u,
            friendshipStatus: status,
            friendshipId: rel?.id || null
          };
        });

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

  // ✅ แก้ไขฟังก์ชันจัดการเพิ่มเพื่อน: ดึง ID ที่เพิ่งสร้างมาใช้งานต่อทันที
  const handleAddFriend = async (targetId: string) => {
    if (!currentUserId || actionId) return;
    setActionId(targetId);
    try {
      // 1. ส่งคำขอลงตาราง friendships เป็น pending และดึงข้อมูลที่เพิ่งสร้างกลับมา (เพื่อเอา ID)
      const { data: newFriendship, error } = await supabase
        .from('friendships')
        .insert({
          sender_id: currentUserId,
          receiver_id: targetId,
          status: 'pending'
        })
        .select('id')
        .single();

      if (error) throw error;

      // 2. ส่ง Notification
      await supabase.from('notifications').insert({
        receiver_id: targetId,
        sender_id: currentUserId,
        type: 'friend_request'
      });

      // Update UI ทันที พร้อมกับเซ็ต friendshipId ที่ได้มาจากฐานข้อมูล
      setUsers(prev => prev.map(u => 
        u.id === targetId ? { ...u, friendshipStatus: 'sent', friendshipId: newFriendship.id } : u
      ));
    } catch (error) {
      console.error(error);
    } finally {
      setActionId(null);
    }
  };

  // ฟังก์ชันลบเพื่อน หรือ ยกเลิกคำขอ
  const handleCancelOrRemove = async (targetUser: UserWithFriendship) => {
    if (!currentUserId || !targetUser.friendshipId || actionId) return;
    setActionId(targetUser.id);
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', targetUser.friendshipId);
      
      if (error) throw error;

      setUsers(prev => prev.map(u => 
        u.id === targetUser.id ? { ...u, friendshipStatus: 'none', friendshipId: undefined } : u
      ));
    } catch (error) {
      console.error(error);
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
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-50">
                      <img 
                        src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} 
                        alt="" 
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{user.display_name}</h3>
                      <p className="text-[10px] text-slate-500 truncate font-medium">@{user.username}</p>
                    </div>

                    <div className="flex-shrink-0">
                      {user.id !== currentUserId ? (
                        <div className="flex items-center">
                          {user.friendshipStatus === 'none' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddFriend(user.id); }}
                              disabled={actionId === user.id}
                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm"
                            >
                              {actionId === user.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={14} />}
                              เพิ่มเพื่อน
                            </button>
                          )}
                          
                          {user.friendshipStatus === 'sent' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelOrRemove(user); }}
                              disabled={actionId === user.id}
                              className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black hover:text-red-500 hover:bg-red-50 transition flex items-center gap-1.5"
                            >
                              {actionId === user.id ? <Loader2 size={12} className="animate-spin" /> : <Clock size={14} />}
                              ยกเลิกคำขอ
                            </button>
                          )}

                          {user.friendshipStatus === 'accepted' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelOrRemove(user); }}
                              disabled={actionId === user.id}
                              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black hover:text-red-500 hover:border-red-200 transition flex items-center gap-1.5 shadow-sm"
                            >
                              {actionId === user.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={14} className="text-green-500" />}
                              เพื่อน
                            </button>
                          )}

                          {user.friendshipStatus === 'pending' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push('/friends'); }}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black hover:bg-indigo-100 transition flex items-center gap-1.5 shadow-sm border border-indigo-100"
                            >
                              <Clock size={14} />
                              รอยืนยัน
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-300 font-black px-2 uppercase tracking-widest italic">You</span>
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
                    className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm hover:bg-slate-50"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  
                  <div className="bg-white border border-slate-200 px-4 py-1.5 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                    Page {currentPage} of {totalPages}
                  </div>

                  <button 
                    disabled={currentPage === totalPages || loading}
                    onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0 }); }}
                    className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm hover:bg-slate-50"
                  >
                    <ChevronRightIcon size={18} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-slate-400 text-sm font-medium">
               ไม่พบสมาชิกที่คุณต้องการ
            </div>
          )}
        </main>
      </div>
    </NavLayout>
  );
}

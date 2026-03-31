'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import { 
  UserPlus, 
  Trash2, 
  Search, 
  Check, 
  X, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Send,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { notifyFriendAccept } from '@/lib/notifications';

interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  sender?: User;
  receiver?: User;
}

const FRIENDS_PER_PAGE = 20;

export default function FriendsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // ✅ เก็บรายชื่อเพื่อนทั้งหมดไว้ใน State เดียวเพื่อไม่ให้หน่วงตอนค้นหา
  const [allFriends, setAllFriends] = useState<any[]>([]); 
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [sentRequests, setSentRequests] = useState<Friendship[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); 
  const [currentPage, setCurrentPage] = useState(1);
  
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [selectedFriendshipId, setSelectedFriendshipId] = useState<string | null>(null);

  // 1. Debounce Search (หน่วงเวลาพิมพ์)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // กลับไปหน้าแรกเสมอเวลาค้นหา
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. โหลดข้อมูลทุกอย่าง "ครั้งเดียวจบ" ตอนเข้าหน้าเว็บ
  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { router.push('/login'); return; }

        const { data: userData } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url')
          .eq('id', session.user.id)
          .single();
        
        setCurrentUser(userData as any);

        // โหลด คำขอเข้า, คำขอออก, และ เพื่อนทั้งหมด พร้อมกัน
        const [pending, sent, accepted] = await Promise.all([
          supabase.from('friendships')
            .select('*, sender:sender_id(id, username, display_name, profile_img_url)')
            .eq('receiver_id', session.user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(30),
            
          supabase.from('friendships')
            .select('*, receiver:receiver_id(id, username, display_name, profile_img_url)')
            .eq('sender_id', session.user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(30),

          // ✅ ดึงเพื่อนทั้งหมดแบบไม่จำกัดหน้า (ดึงสูงสุด 3000 คน ซึ่งเกินพอ)
          supabase.from('friendships')
            .select(`
              id, sender_id, receiver_id,
              sender:users!friendships_sender_id_fkey(id, username, display_name, profile_img_url, is_online),
              receiver:users!friendships_receiver_id_fkey(id, username, display_name, profile_img_url, is_online)
            `)
            .eq('status', 'accepted')
            .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
            .limit(3000)
        ]);
        
        setPendingRequests(pending.data || []);
        setSentRequests(sent.data || []);

        // สกัดเฉพาะข้อมูลเพื่อนออกมา
        const friendsList = (accepted.data || []).map((f: any) => {
          const friendData = f.sender_id === session.user.id ? f.receiver : f.sender;
          return friendData ? { ...friendData, friendshipId: f.id } : null;
        }).filter(Boolean);

        setAllFriends(friendsList);

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllData();
  }, [router]);

  // ✅ 3. กรองชื่อเพื่อนจาก RAM และสั่งเรียง ก-ฮ / A-Z (โคตรเร็ว ค้นหาเจอ 100%)
  const filteredFriends = useMemo(() => {
    let list = allFriends;
    
    // ถ้ามีการพิมพ์ค้นหา ให้กรองก่อน
    if (debouncedSearch) {
      const lowerSearch = debouncedSearch.toLowerCase();
      list = list.filter(f => 
        f.display_name.toLowerCase().includes(lowerSearch) || 
        f.username.toLowerCase().includes(lowerSearch)
      );
    }

    // ✅ เรียงลำดับตัวอักษรภาษาไทยและอังกฤษด้วย localeCompare
    return [...list].sort((a, b) => a.display_name.localeCompare(b.display_name, 'th'));
    
  }, [allFriends, debouncedSearch]);

  // ✅ 4. ตัดแบ่งหน้า (Pagination) จากข้อมูลที่กรองและเรียงแล้ว
  const displayedFriends = useMemo(() => {
    const from = (currentPage - 1) * FRIENDS_PER_PAGE;
    return filteredFriends.slice(from, from + FRIENDS_PER_PAGE);
  }, [filteredFriends, currentPage]);

  const totalFriendsCount = filteredFriends.length;
  const totalPages = Math.max(1, Math.ceil(totalFriendsCount / FRIENDS_PER_PAGE));

  const handleAcceptRequest = async (id: string, senderId: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
      if (error) throw error;
      
      await notifyFriendAccept(senderId, currentUser.id);
      
      const acceptedUser = pendingRequests.find(r => r.id === id);
      setPendingRequests(prev => prev.filter(r => r.id !== id));
      
      if (acceptedUser?.sender) {
        // เพิ่มเข้า allFriends ทันที (useMemo จะจับเรียงตัวอักษรให้อัตโนมัติ)
        setAllFriends(prev => [{ ...acceptedUser.sender, friendshipId: id }, ...prev]);
      }
    } catch (error) { console.error('Error accepting friend:', error); }
  };

  const handleCancelRequest = async (id: string, type: 'pending' | 'sent') => {
    try {
      await supabase.from('friendships').delete().eq('id', id);
      if (type === 'pending') {
        setPendingRequests(prev => prev.filter(r => r.id !== id));
      } else {
        setSentRequests(prev => prev.filter(r => r.id !== id));
      }
    } catch (error) { console.error(error); }
  };

  const handleRemoveFriend = async () => {
    if (!selectedFriendshipId) return;
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', selectedFriendshipId);
      if (error) throw error;
      
      setAllFriends(prev => prev.filter(f => f.friendshipId !== selectedFriendshipId));
      setShowRemoveConfirm(false);
      setSelectedFriendshipId(null);
    } catch (error) { console.error('Error removing friend:', error); }
  };

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
          <Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" />
          <p className="text-gray-400 font-black uppercase tracking-widest text-xs">กำลังโหลดข้อมูล...</p>
        </div>
      </NavLayout>
    );
  }

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">เพื่อนของฉัน</h1>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">ทั้งหมด {allFriends.length} คน</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ค้นหาชื่อเพื่อน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-frog-500 outline-none transition-all text-sm font-bold shadow-inner"
            />
          </div>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && !debouncedSearch && (
          <div className="space-y-3 animate-in slide-in-from-bottom-2">
            <h2 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <UserPlus size={14} /> คำขอเป็นเพื่อน ({pendingRequests.length})
            </h2>
            <div className="bg-indigo-50/50 rounded-[2rem] p-4 border border-indigo-100 grid grid-cols-1 sm:grid-cols-2 gap-3 shadow-inner">
               {pendingRequests.map(r => (
                 <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-indigo-50 group hover:scale-[1.02] transition-transform">
                   <img src={r.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-indigo-100 shadow-sm" alt="" />
                   <div className="flex-1 min-w-0">
                     <p className="font-bold text-xs truncate text-gray-900">{r.sender?.display_name}</p>
                     <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">ส่งคำขอมาถึงคุณ</p>
                   </div>
                   <div className="flex gap-1.5">
                      <button onClick={() => handleAcceptRequest(r.id, r.sender_id)} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-md active:scale-90"><Check size={14} strokeWidth={3} /></button>
                      <button onClick={() => handleCancelRequest(r.id, 'pending')} className="p-2 bg-gray-100 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition active:scale-90"><X size={14} strokeWidth={3} /></button>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* Sent Requests */}
        {sentRequests.length > 0 && !debouncedSearch && (
          <div className="space-y-3 animate-in slide-in-from-bottom-2">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <Send size={14} /> คำขอที่ส่งไปแล้ว ({sentRequests.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {sentRequests.map(r => (
                 <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl border border-gray-100 opacity-80 hover:opacity-100 transition-opacity">
                   <img src={r.receiver?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover opacity-60 grayscale" alt="" />
                   <div className="flex-1 min-w-0">
                     <p className="font-bold text-[10px] truncate text-gray-500">{r.receiver?.display_name}</p>
                   </div>
                   <button onClick={() => handleCancelRequest(r.id, 'sent')} className="text-[9px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors">ยกเลิก</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* Friends List Grid */}
        <div className="space-y-4 relative">
          <h2 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <Users size={14} /> {debouncedSearch ? 'ผลการค้นหา' : 'รายชื่อเพื่อน'} ({totalFriendsCount})
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayedFriends.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 shadow-sm animate-in zoom-in">
                <Users size={40} className="mx-auto mb-4 text-gray-100" />
                <p className="text-gray-400 text-xs font-black uppercase tracking-widest">
                  {debouncedSearch ? 'ไม่พบชื่อเพื่อนที่ค้นหา' : 'ไม่พบรายชื่อเพื่อน'}
                </p>
              </div>
            ) : (
              displayedFriends.map(f => (
                <div key={f.id} className="p-3 bg-white border border-gray-100 rounded-[1.5rem] hover:border-frog-200 hover:shadow-xl hover:shadow-frog-500/5 transition-all group flex items-center gap-3 animate-in slide-in-from-bottom-2">
                  <Link href={`/profile/${f.username}`} className="relative flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-2xl object-cover border border-gray-50 shadow-sm" loading="lazy" alt="" />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full shadow-sm ${f.is_online ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${f.username}`} className="font-black text-sm hover:text-frog-600 truncate block transition-colors leading-tight">{f.display_name}</Link>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">@{f.username}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setSelectedFriendshipId(f.friendshipId); setShowRemoveConfirm(true); }} className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90" title="ลบเพื่อน"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3 pb-10">
            <button disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-3 bg-white border border-gray-100 rounded-2xl disabled:opacity-20 shadow-sm hover:bg-gray-50 active:scale-90 transition-all"><ChevronLeft size={18} /></button>
            <div className="bg-white border border-gray-100 px-6 py-2.5 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest shadow-sm">PAGE {currentPage} OF {totalPages}</div>
            <button disabled={currentPage === totalPages} onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-3 bg-white border border-gray-100 rounded-2xl disabled:opacity-20 shadow-sm hover:bg-gray-50 active:scale-90 transition-all"><ChevronRight size={18} /></button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemoveFriend}
        title="เลิกเป็นเพื่อน?"
        message="การลบเพื่อนจะทำให้คุณไม่เห็นโพสต์ของเขาในหน้า Feed อีกต่อไป"
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

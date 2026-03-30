'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Send
} from 'lucide-react';
import Link from 'next/link';

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
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function FriendsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [sentRequests, setSentRequests] = useState<Friendship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalFriends, setTotalFriends] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [selectedFriendshipId, setSelectedFriendshipId] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentUser) loadFriendsData();
  }, [currentPage, searchQuery, selectedLetter, currentUser]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setCurrentUser(userData);

      const [pending, sent] = await Promise.all([
        supabase.from('friendships')
          .select('*, sender:sender_id(id, username, display_name, profile_img_url)')
          .eq('receiver_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase.from('friendships')
          .select('*, receiver:receiver_id(id, username, display_name, profile_img_url)')
          .eq('sender_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      ]);
      
      setPendingRequests(pending.data || []);
      setSentRequests(sent.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriendsData = async () => {
    if (!currentUser) return;
    const from = (currentPage - 1) * FRIENDS_PER_PAGE;
    const to = from + FRIENDS_PER_PAGE - 1;

    try {
      let query = supabase
        .from('friendships')
        .select(`
          id, sender_id, receiver_id,
          sender:users!friendships_sender_id_fkey(id, username, display_name, profile_img_url, is_online),
          receiver:users!friendships_receiver_id_fkey(id, username, display_name, profile_img_url, is_online)
        `, { count: 'exact' })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      if (searchQuery) {
        query = query.or(`sender.display_name.ilike.%${searchQuery}%,receiver.display_name.ilike.%${searchQuery}%`);
      }
      
      if (selectedLetter) {
        query = query.or(`sender.display_name.ilike.${selectedLetter}%,receiver.display_name.ilike.${selectedLetter}%`);
      }

      const { data, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      setTotalFriends(count || 0);
      
      const friendsList = (data || []).map((f: any) => {
        return f.sender_id === currentUser.id ? f.receiver : f.sender;
      }).filter(u => u !== null);

      setFriends(friendsList as any);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAcceptRequest = async (id: string) => {
    // ✅ แก้ไข: ลบบรรทัดการ insert notification ออก เพราะจะซ้ำซ้อนกับระบบ Database Trigger
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', id);
        
      if (error) throw error;
      
      loadInitialData();
      loadFriendsData();
    } catch (error) {
      console.error('Error accepting friend:', error);
    }
  };

  const handleCancelRequest = async (id: string) => {
    await supabase.from('friendships').delete().eq('id', id);
    loadInitialData();
  };

  const handleRemoveFriend = async () => {
    if (!selectedFriendshipId) return;
    await supabase.from('friendships').delete().eq('id', selectedFriendshipId);
    setShowRemoveConfirm(false);
    loadFriendsData();
  };

  const totalPages = Math.ceil(totalFriends / FRIENDS_PER_PAGE);

  if (isLoading) return <NavLayout><div className="flex justify-center py-20 animate-pulse text-gray-400 font-bold uppercase tracking-widest text-xs">Loading Friends...</div></NavLayout>;

  return (
    <NavLayout>
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">เพื่อนของฉัน</h1>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Manage your connections</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ค้นหาชื่อเพื่อน..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent rounded-xl focus:ring-2 focus:ring-frog-500 outline-none transition-all text-sm font-medium"
            />
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2 px-1">
              <UserPlus size={14} /> คำขอเป็นเพื่อน ({pendingRequests.length})
            </h2>
            <div className="bg-indigo-50/50 rounded-3xl p-4 border border-indigo-100 grid grid-cols-1 sm:grid-cols-2 gap-3 shadow-inner">
               {pendingRequests.map(r => (
                 <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-indigo-50 group">
                   <img src={r.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-indigo-100" />
                   <div className="flex-1 min-w-0">
                     <p className="font-bold text-xs truncate text-gray-900">{r.sender?.display_name}</p>
                     <p className="text-[10px] text-gray-400">ส่งคำขอมาถึงคุณ</p>
                   </div>
                   <div className="flex gap-1.5">
                      <button 
                        onClick={() => handleAcceptRequest(r.id)} 
                        className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-sm"
                        title="รับเป็นเพื่อน"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => handleCancelRequest(r.id)} 
                        className="p-2 bg-gray-100 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition"
                        title="ปฏิเสธ"
                      >
                        <X size={14} />
                      </button>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {sentRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
              <Send size={14} /> คำขอที่ส่งไปแล้ว ({sentRequests.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {sentRequests.map(r => (
                 <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl border border-gray-100">
                   <img src={r.receiver?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover opacity-60 grayscale" />
                   <div className="flex-1 min-w-0">
                     <p className="font-bold text-[10px] truncate text-gray-500">{r.receiver?.display_name}</p>
                   </div>
                   <button 
                    onClick={() => handleCancelRequest(r.id)} 
                    className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-tighter"
                   >
                     ยกเลิก
                   </button>
                 </div>
               ))}
            </div>
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar items-center">
          <button onClick={() => { setSelectedLetter(null); setCurrentPage(1); }} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${!selectedLetter ? 'bg-frog-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>ทั้งหมด</button>
          {ALPHABETS.map(l => (
            <button key={l} onClick={() => { setSelectedLetter(l); setCurrentPage(1); }} className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-[10px] font-black transition-all ${selectedLetter === l ? 'bg-frog-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{l}</button>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest px-1 flex items-center gap-2">
            <Users size={14} /> รายชื่อเพื่อน ({totalFriends})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {friends.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-gray-200">
                <Users size={40} className="mx-auto mb-4 text-gray-100" />
                <p className="text-gray-400 text-sm font-bold">ไม่พบรายชื่อเพื่อน</p>
              </div>
            ) : (
              friends.map(f => (
                <div key={f.id} className="p-3 bg-white border border-gray-100 rounded-[1.5rem] hover:border-frog-200 hover:shadow-lg transition-all group flex items-center gap-3">
                  <Link href={`/profile/${f.username}`} className="relative flex-shrink-0 group-hover:scale-105 transition-transform">
                    <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-2xl object-cover border border-gray-50 shadow-sm" loading="lazy" />
                    {f.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${f.username}`} className="font-black text-sm hover:text-frog-600 truncate block transition-colors">{f.display_name}</Link>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">@{f.username}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setSelectedFriendshipId(f.id); setShowRemoveConfirm(true); }} 
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="ลบเพื่อน"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2 pb-10">
            <button disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-20 shadow-sm hover:bg-gray-50"><ChevronLeft size={18} /></button>
            <div className="bg-white border border-gray-100 px-6 py-2 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest shadow-sm">PAGE {currentPage} OF {totalPages}</div>
            <button disabled={currentPage === totalPages} onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-20 shadow-sm hover:bg-gray-50"><ChevronRight size={18} /></button>
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

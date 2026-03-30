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
  Clock, 
  Users, 
  Filter, 
  ChevronLeft, 
  ChevronRight 
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
  
  // State สำหรับค้นหาและ Pagination
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

      // โหลดคำขอเป็นเพื่อน (ไม่ต้องทำ Pagination เพราะปกติมีไม่เยอะ)
      const [pending, sent] = await Promise.all([
        supabase.from('friendships').select('*, sender:sender_id(id, username, display_name, profile_img_url)').eq('receiver_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('friendships').select('*, receiver:receiver_id(id, username, display_name, profile_img_url)').eq('sender_id', user.id).eq('status', 'pending').order('created_at', { ascending: false })
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

      // การกรองชื่อ (ทำฝั่ง Server เพื่อความเร็ว)
      if (searchQuery) {
        // ค้นหาในชื่อ sender หรือ receiver ที่ไม่ใช่เรา
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

  const handleAcceptRequest = async (id: string, senderId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    await supabase.from('notifications').insert({ receiver_id: senderId, sender_id: currentUser?.id, type: 'friend_accept' });
    loadInitialData();
    loadFriendsData();
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
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">เพื่อนของฉัน</h1>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent rounded-xl focus:ring-2 focus:ring-frog-500 outline-none transition-all text-sm font-medium"
            />
          </div>
        </div>

        {/* Alphabet Filter - A-Z Only & Compact */}
        <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar items-center">
          <button onClick={() => { setSelectedLetter(null); setCurrentPage(1); }} className={`flex-shrink-0 px-3 py-1 rounded-lg text-[10px] font-black transition-all ${!selectedLetter ? 'bg-frog-600 text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>ทั้งหมด</button>
          {ALPHABETS.map(l => (
            <button key={l} onClick={() => { setSelectedLetter(l); setCurrentPage(1); }} className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${selectedLetter === l ? 'bg-frog-600 text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{l}</button>
          ))}
        </div>

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="bg-indigo-50/50 rounded-3xl p-4 border border-indigo-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
             {pendingRequests.map(r => (
               <div key={r.id} className="flex items-center gap-3 p-2 bg-white rounded-2xl shadow-sm border border-indigo-50">
                 <img src={r.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" />
                 <div className="flex-1 min-w-0"><p className="font-bold text-xs truncate">{r.sender?.display_name}</p></div>
                 <div className="flex gap-1">
                    <button onClick={() => handleAcceptRequest(r.id, r.sender_id)} className="p-1.5 bg-indigo-600 text-white rounded-lg"><Check size={14} /></button>
                    <button onClick={() => supabase.from('friendships').delete().eq('id', r.id).then(() => loadInitialData())} className="p-1.5 bg-gray-100 text-gray-400 rounded-lg"><X size={14} /></button>
                 </div>
               </div>
             ))}
          </div>
        )}

        {/* Friends List Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {friends.map(f => (
            <div key={f.id} className="p-3 bg-white border border-gray-100 rounded-2xl hover:border-frog-200 hover:shadow-md transition-all group flex items-center gap-3">
              <Link href={`/profile/${f.username}`} className="relative flex-shrink-0">
                <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-xl object-cover border border-gray-50" loading="lazy" />
                {f.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${f.username}`} className="font-bold text-sm hover:text-frog-600 truncate block">{f.display_name}</Link>
                <p className="text-[10px] text-gray-400">@{f.username}</p>
              </div>
              <button onClick={() => { setSelectedFriendshipId(f.id); setShowRemoveConfirm(true); }} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2 pb-10">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 bg-white border rounded-xl disabled:opacity-20"><ChevronLeft size={18} /></button>
            <div className="bg-white border px-4 py-1.5 rounded-xl text-[10px] font-black text-gray-500">PAGE {currentPage} OF {totalPages}</div>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 bg-white border rounded-xl disabled:opacity-20"><ChevronRight size={18} /></button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemoveFriend}
        title="เลิกเป็นเพื่อน?"
        message="การลบเพื่อนจะทำให้คุณไม่เห็นโพสต์ของเขาในหน้าแรก"
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

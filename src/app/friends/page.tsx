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
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [selectedFriendship, setSelectedFriendship] = useState<string | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  
  // State สำหรับค้นหาและกรอง
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: currentUserData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (currentUserData) {
        setCurrentUser(currentUserData);
        await loadAllFriendData(currentUserData.id);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllFriendData = async (userId: string) => {
    try {
      // 1. โหลดเพื่อนที่รับแอดแล้ว
      const { data: friendsData } = await supabase
        .from('friendships')
        .select('*, sender:sender_id(id, username, display_name, profile_img_url, bio, is_online), receiver:receiver_id(id, username, display_name, profile_img_url, bio, is_online)')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      setFriendships(friendsData || []);

      const friendsList = (friendsData || []).map((friendship: Friendship) => {
        return friendship.sender_id === userId 
          ? friendship.receiver 
          : friendship.sender;
      }).filter((friend): friend is User => friend !== undefined);

      // เรียงลำดับตามชื่อ
      friendsList.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '', 'th'));
      setFriends(friendsList);

      // 2. โหลดคำขอเป็นเพื่อนที่ได้รับ
      const { data: pendingData } = await supabase
        .from('friendships')
        .select('*, sender:sender_id(id, username, display_name, profile_img_url)')
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      setPendingRequests(pendingData || []);

      // 3. โหลดคำขอที่ส่งไป
      const { data: sentData } = await supabase
        .from('friendships')
        .select('*, receiver:receiver_id(id, username, display_name, profile_img_url)')
        .eq('sender_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      setSentRequests(sentData || []);

    } catch (error) {
      console.error('Error loading friend data:', error);
    }
  };

  // ระบบกรองข้อมูล
  const filteredFriends = useMemo(() => {
    let result = friends;

    if (selectedLetter) {
      result = result.filter(f => f.display_name?.toUpperCase().startsWith(selectedLetter));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => 
        f.display_name?.toLowerCase().includes(q) || 
        f.username?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [friends, searchQuery, selectedLetter]);

  // ระบบ Pagination
  const totalPages = Math.ceil(filteredFriends.length / FRIENDS_PER_PAGE);
  const currentFriends = useMemo(() => {
    const start = (currentPage - 1) * FRIENDS_PER_PAGE;
    return filteredFriends.slice(start, start + FRIENDS_PER_PAGE);
  }, [filteredFriends, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedLetter]);

  const handleAcceptRequest = async (friendshipId: string, senderId: string) => {
    if (!currentUser) return;
    try {
      await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
      await supabase.from('notifications').insert({ receiver_id: senderId, sender_id: currentUser.id, type: 'friend_accept' });
      await loadAllFriendData(currentUser.id);
    } catch (error) { console.error(error); }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    if (!currentUser) return;
    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      await loadAllFriendData(currentUser.id);
    } catch (error) { console.error(error); }
  };

  const handleCancelRequest = async (friendshipId: string) => {
    if (!currentUser) return;
    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      await loadAllFriendData(currentUser.id);
    } catch (error) { console.error(error); }
  };

  const handleRemoveFriend = async () => {
    if (!selectedFriendship || !currentUser) return;
    try {
      await supabase.from('friendships').delete().eq('id', selectedFriendship);
      await loadAllFriendData(currentUser.id);
      setSelectedFriendship(null);
    } catch (error) { console.error(error); }
  };

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center animate-pulse">
            <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 mx-auto mb-4 animate-bounce" />
            <p className="text-gray-500 font-medium">กำลังโหลดรายการเพื่อน...</p>
          </div>
        </div>
      </NavLayout>
    );
  }

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">เพื่อนของฉัน</h1>
            <p className="text-gray-500 text-xs mt-1">จัดการคำขอและรายชื่อเพื่อนทั้งหมดของคุณ</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent rounded-xl focus:ring-2 focus:ring-frog-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* 1. คำขอเป็นเพื่อนที่ได้รับ */}
        {pendingRequests.length > 0 && (
          <section className="bg-indigo-50/50 rounded-3xl p-4 border border-indigo-100">
            <h2 className="text-sm font-black mb-3 flex items-center gap-2 text-indigo-700 uppercase tracking-wider">
              <UserPlus className="w-4 h-4" />
              คำขอรอการยืนยัน ({pendingRequests.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pendingRequests.map(request => (
                <div key={request.id} className="flex items-center gap-3 p-2.5 bg-white rounded-2xl shadow-sm border border-indigo-50">
                  <Link href={`/profile/${request.sender?.username}`} className="flex-shrink-0">
                    <img src={request.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-gray-100" alt="" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${request.sender?.username}`} className="font-bold text-xs hover:underline truncate block text-gray-900">{request.sender?.display_name}</Link>
                    <p className="text-[10px] text-gray-400">@{request.sender?.username}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleAcceptRequest(request.id, request.sender_id)} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleRejectRequest(request.id)} className="p-1.5 bg-gray-100 text-gray-400 rounded-lg hover:bg-gray-200 transition"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </section> section
        )}

        {/* 2. คำขอที่ส่งไป */}
        {sentRequests.length > 0 && (
          <section className="bg-gray-50 rounded-3xl p-4 border border-gray-200">
            <h2 className="text-[10px] font-black mb-3 flex items-center gap-2 text-gray-500 uppercase tracking-widest">
              <Clock className="w-3.5 h-3.5" />
              คำขอที่ส่งแล้ว ({sentRequests.length})
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {sentRequests.map(request => (
                <div key={request.id} className="flex-shrink-0 flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[160px]">
                  <img src={request.receiver?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[10px] truncate">{request.receiver?.display_name}</p>
                  </div>
                  <button onClick={() => handleCancelRequest(request.id)} className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg">ยกเลิก</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. รายชื่อเพื่อนพร้อม Filter & Pagination */}
        <section className="space-y-4">
          <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black flex items-center gap-2 text-gray-900">
                <Users className="w-5 h-5 text-green-500" />
                เพื่อน ({filteredFriends.length})
              </h2>
            </div>

            {/* Alphabet Filter Bar - Compact Version */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                <Filter size={12} /> กรองตามตัวอักษร
              </div>
              <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar items-center">
                <button 
                  onClick={() => setSelectedLetter(null)} 
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${!selectedLetter ? 'bg-frog-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  ทั้งหมด
                </button>
                {ALPHABETS.map(l => (
                  <button 
                    key={l} 
                    onClick={() => setSelectedLetter(l)} 
                    className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${selectedLetter === l ? 'bg-frog-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Friends Grid */}
            {currentFriends.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">ไม่พบรายชื่อเพื่อน</p>
                <button onClick={() => {setSearchQuery(''); setSelectedLetter(null);}} className="mt-2 text-frog-600 text-xs font-bold hover:underline">ล้างการกรอง</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentFriends.map((friend) => {
                  const friendship = friendships.find(f => f.sender_id === friend.id || f.receiver_id === friend.id);
                  return (
                    <div key={friend.id} className="p-3 bg-white border border-gray-100 rounded-2xl hover:border-frog-200 hover:shadow-md transition-all group">
                      <div className="flex items-center gap-3">
                        <Link href={`/profile/${friend.username}`} className="flex-shrink-0 relative">
                          <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-xl object-cover border border-gray-50" alt="" loading="lazy" />
                          {friend.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={`/profile/${friend.username}`} className="font-bold text-sm hover:text-frog-600 truncate block transition-colors">{friend.display_name}</Link>
                          <p className="text-[10px] text-gray-400 truncate">@{friend.username}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={() => { setSelectedFriendship(friendship?.id || null); setShowRemoveConfirm(true); }} 
                             className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-1.5">
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(prev => prev - 1)} 
                  className="p-1.5 bg-gray-100 rounded-lg disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const p = i + 1;
                    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                      return (
                        <button 
                          key={i} 
                          onClick={() => setCurrentPage(p)} 
                          className={`w-8 h-8 rounded-lg text-[10px] font-black transition ${currentPage === p ? 'bg-frog-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {p}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
                <button 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(prev => prev + 1)} 
                  className="p-1.5 bg-gray-100 rounded-lg disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => { setShowRemoveConfirm(false); setSelectedFriendship(null); }}
        onConfirm={handleRemoveFriend}
        title="เลิกเป็นเพื่อน?"
        message="การกระทำนี้จะลบเขาออกจากรายชื่อเพื่อนของคุณ"
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

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
const THAI_ALPHABETS = "กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ".split("");

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
      // 1. โหลดเพื่อนที่รับแอดแล้ว (ดึงเฉพาะที่จำเป็น)
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

      // เรียง A-Z
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

  // กรองข้อมูล
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

  // Pagination Logic
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
          <div className="text-center">
            <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 mx-auto mb-4 animate-bounce" />
            <p className="text-gray-600">กำลังโหลดรายการเพื่อน...</p>
          </div>
        </div>
      </NavLayout>
    );
  }

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-4xl mx-auto px-4 py-4 md:py-8 space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-2">
            เพื่อนของฉัน
          </h1>
          <p className="text-gray-500 text-sm md:text-base">
            ค้นหาและจัดการความสัมพันธ์กับเพื่อนๆ ใน Ribbi
          </p>
        </div>

        {/* 1. คำขอเป็นเพื่อน */}
        {pendingRequests.length > 0 && (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-indigo-100">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-600">
              <UserPlus className="w-5 h-5" />
              คำขอเป็นเพื่อน ({pendingRequests.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.map(request => (
                <div key={request.id} className="flex items-center gap-3 p-3 bg-indigo-50/30 rounded-2xl border border-indigo-50">
                  <Link href={`/profile/${request.sender?.username}`} className="flex-shrink-0">
                    <img src={request.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${request.sender?.username}`} className="font-bold text-sm hover:underline truncate block text-gray-900">{request.sender?.display_name}</Link>
                    <p className="text-xs text-gray-500">@{request.sender?.username}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleAcceptRequest(request.id, request.sender_id)} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-sm"><Check className="w-4 h-4" /></button>
                    <button onClick={() => handleRejectRequest(request.id)} className="p-2 bg-gray-200 text-gray-600 rounded-xl hover:bg-gray-300 transition"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. คำขอที่ส่งแล้ว */}
        {sentRequests.length > 0 && (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-600">
              <Clock className="w-5 h-5" />
              คำขอที่ส่งแล้ว ({sentRequests.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentRequests.map(request => (
                <div key={request.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <Link href={`/profile/${request.receiver?.username}`} className="flex-shrink-0">
                    <img src={request.receiver?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover border border-white" alt="" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${request.receiver?.username}`} className="font-bold text-sm hover:underline truncate block text-gray-900">{request.receiver?.display_name}</Link>
                    <p className="text-xs text-gray-500">@{request.receiver?.username}</p>
                  </div>
                  <button onClick={() => handleCancelRequest(request.id)} className="text-xs font-bold px-3 py-2 bg-gray-200 text-gray-600 rounded-xl hover:bg-red-100 hover:text-red-600 transition">ยกเลิก</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. รายชื่อเพื่อนพร้อม Filter & Pagination */}
        <section className="space-y-6">
          <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <Users className="w-5 h-5 text-green-500" />
                เพื่อนทั้งหมด ({filteredFriends.length})
              </h2>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ หรือ @username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-frog-500 transition-all text-sm"
                />
              </div>
            </div>

            {/* Alphabet Filter Bar */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <Filter size={10} /> กรองตามตัวอักษร
              </div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setSelectedLetter(null)} className={`px-3 py-1 rounded-lg text-xs font-bold transition ${!selectedLetter ? 'bg-frog-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>ทั้งหมด</button>
                {ALPHABETS.map(l => (
                  <button key={l} onClick={() => setSelectedLetter(l)} className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition ${selectedLetter === l ? 'bg-frog-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 overflow-x-auto pb-2 no-scrollbar">
                {THAI_ALPHABETS.map(l => (
                  <button key={l} onClick={() => setSelectedLetter(l)} className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition ${selectedLetter === l ? 'bg-frog-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
                ))}
              </div>
            </div>

            {/* Friends Grid */}
            {currentFriends.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium">ไม่พบรายชื่อเพื่อน</p>
                <button onClick={() => {setSearchQuery(''); setSelectedLetter(null);}} className="mt-2 text-frog-600 text-sm font-bold hover:underline">ล้างตัวกรอง</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentFriends.map((friend) => {
                  const friendship = friendships.find(f => f.sender_id === friend.id || f.receiver_id === friend.id);
                  return (
                    <div key={friend.id} className="p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-md transition-all group">
                      <div className="flex items-start gap-4">
                        <Link href={`/profile/${friend.username}`} className="flex-shrink-0 relative">
                          <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-2xl object-cover border border-gray-50" alt="" loading="lazy" />
                          {friend.is_online && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={`/profile/${friend.username}`} className="font-bold text-base hover:text-frog-600 truncate block transition-colors">{friend.display_name}</Link>
                          <p className="text-xs text-gray-400 truncate">@{friend.username}</p>
                          {friend.bio && <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">{friend.bio}</p>}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                           <button onClick={() => { setSelectedFriendship(friendship?.id || null); setShowRemoveConfirm(true); }} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition">
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
              <div className="mt-8 flex items-center justify-center gap-2">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 bg-gray-100 rounded-xl disabled:opacity-30"><ChevronLeft size={20} /></button>
                <div className="flex gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-9 h-9 rounded-xl text-xs font-bold transition ${currentPage === i + 1 ? 'bg-frog-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</button>
                  ))}
                </div>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 bg-gray-100 rounded-xl disabled:opacity-30"><ChevronRight size={20} /></button>
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => { setShowRemoveConfirm(false); setSelectedFriendship(null); }}
        onConfirm={handleRemoveFriend}
        title="ต้องการเลิกเป็นเพื่อน?"
        message="คุณจะไม่เห็นโพสต์ของเขาในหน้าแรกอีกต่อไป และต้องส่งคำขอใหม่หากต้องการกลับมาเป็นเพื่อนกัน"
        confirmText="เลิกเป็นเพื่อน"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

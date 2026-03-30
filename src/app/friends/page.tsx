'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import { UserPlus, Trash2, ArrowLeft, Search, Check, X, Clock, Users } from 'lucide-react';
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
  
  // State สำหรับช่องค้นหาเพื่อน
  const [searchQuery, setSearchQuery] = useState('');

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
        .select('*, sender:sender_id(*), receiver:receiver_id(*)')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      setFriendships(friendsData || []);

      const friendsList = (friendsData || []).map((friendship: Friendship) => {
        return friendship.sender_id === userId 
          ? friendship.receiver 
          : friendship.sender;
      }).filter((friend): friend is User => friend !== undefined);

      setFriends(friendsList);

      // 2. โหลดคำขอเป็นเพื่อนที่ได้รับ (คนอื่นส่งมา)
      const { data: pendingData } = await supabase
        .from('friendships')
        .select('*, sender:sender_id(*)')
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      setPendingRequests(pendingData || []);

      // 3. โหลดคำขอเป็นเพื่อนที่ส่งไป (เราส่งไป)
      const { data: sentData } = await supabase
        .from('friendships')
        .select('*, receiver:receiver_id(*)')
        .eq('sender_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      setSentRequests(sentData || []);

    } catch (error) {
      console.error('Error loading friend data:', error);
    }
  };

  const handleAcceptRequest = async (friendshipId: string, senderId: string) => {
    if (!currentUser) return;
    try {
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      // สร้างการแจ้งเตือน
      await supabase.from('notifications').insert({
        receiver_id: senderId,
        sender_id: currentUser.id,
        type: 'friend_accept'
      });

      await loadAllFriendData(currentUser.id);
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    if (!currentUser) return;
    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      await loadAllFriendData(currentUser.id);
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    }
  };

  const handleCancelRequest = async (friendshipId: string) => {
    if (!currentUser) return;
    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      await loadAllFriendData(currentUser.id);
    } catch (error) {
      console.error('Error canceling friend request:', error);
    }
  };

  const handleRemoveFriend = async () => {
    if (!selectedFriendship || !currentUser) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', selectedFriendship);

      if (error) throw error;

      await loadAllFriendData(currentUser.id);
      setSelectedFriendship(null);
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  // กรองรายชื่อเพื่อนตามช่องค้นหา
  const filteredFriends = friends.filter(friend => {
    const search = searchQuery.toLowerCase();
    return (
      (friend.display_name?.toLowerCase() || '').includes(search) ||
      (friend.username?.toLowerCase() || '').includes(search)
    );
  });

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <img 
              src="https://iili.io/qbtgKBt.png"
              alt="Loading"
              className="w-16 h-16 mx-auto mb-4 animate-bounce"
            />
            <p className="text-gray-600">กำลังโหลด...</p>
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
          <Link 
            href={`/profile/${currentUser.username}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm md:text-base transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปโปรไฟล์ของฉัน
          </Link>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
            จัดการเพื่อน
          </h1>
        </div>

        {/* 1. คำขอเป็นเพื่อน (Pending Requests) */}
        {pendingRequests.length > 0 && (
          <section className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-indigo-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-indigo-900">
              <UserPlus className="w-5 h-5 text-indigo-500" />
              คำขอเป็นเพื่อน ({pendingRequests.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.map(request => (
                <div key={request.id} className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-2xl border border-indigo-50">
                  <Link href={`/profile/${request.sender?.username}`} className="flex-shrink-0">
                    <img
                      src={request.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                      alt={request.sender?.display_name}
                      className="w-12 h-12 rounded-full object-cover border border-white shadow-sm hover:opacity-80 transition"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${request.sender?.username}`} className="font-bold text-sm md:text-base hover:text-indigo-600 truncate block text-gray-900">
                      {request.sender?.display_name}
                    </Link>
                    <p className="text-xs text-gray-500 truncate">@{request.sender?.username}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAcceptRequest(request.id, request.sender_id)}
                      className="p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition shadow-sm"
                      title="รับเป็นเพื่อน"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRejectRequest(request.id)}
                      className="p-2 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition"
                      title="ลบคำขอ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. คำขอที่ส่งแล้ว (Sent Requests) */}
        {sentRequests.length > 0 && (
          <section className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-gray-700">
              <Clock className="w-5 h-5 text-gray-400" />
              คำขอที่ส่งแล้ว ({sentRequests.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentRequests.map(request => (
                <div key={request.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <Link href={`/profile/${request.receiver?.username}`} className="flex-shrink-0">
                    <img
                      src={request.receiver?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                      alt={request.receiver?.display_name}
                      className="w-12 h-12 rounded-full object-cover border border-white shadow-sm hover:opacity-80 transition"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${request.receiver?.username}`} className="font-bold text-sm md:text-base hover:text-indigo-600 truncate block text-gray-900">
                      {request.receiver?.display_name}
                    </Link>
                    <p className="text-xs text-gray-500 truncate">@{request.receiver?.username}</p>
                  </div>
                  <button
                    onClick={() => handleCancelRequest(request.id)}
                    className="text-xs font-bold px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-red-100 hover:text-red-600 transition whitespace-nowrap"
                  >
                    ยกเลิกคำขอ
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. รายชื่อเพื่อน (Friends List) */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-gray-900">
              <Users className="w-5 h-5 text-green-500" />
              เพื่อนของฉัน ({friends.length})
            </h2>
            
            {/* ช่องค้นหาเพื่อน */}
            {friends.length > 0 && (
              <div className="relative w-full md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อเพื่อน..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm text-sm"
                />
              </div>
            )}
          </div>

          {/* Friends Grid/List */}
          {friends.length === 0 ? (
            <div className="card-minimal text-center py-12 md:py-20 border border-gray-100 bg-gray-50/50">
              <UserPlus className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 font-medium mb-1 text-base md:text-lg">
                คุณยังไม่มีเพื่อน
              </p>
              <p className="text-sm text-gray-400">
                เริ่มเพิ่มเพื่อนเพื่อเชื่อมต่อกับคนที่คุณรู้จัก
              </p>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center py-12 border border-gray-100 bg-white rounded-3xl shadow-sm">
              <p className="text-gray-500 font-medium text-base">ไม่พบรายชื่อเพื่อนที่ค้นหา "{searchQuery}"</p>
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-2 text-indigo-600 text-sm hover:underline font-medium"
              >
                ดูเพื่อนทั้งหมด
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFriends.map((friend) => {
                const friendship = friendships.find(f => f.sender_id === friend.id || f.receiver_id === friend.id);
                
                return (
                  <div key={friend.id} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all group">
                    <div className="flex items-start gap-3 md:gap-4">
                      <Link href={`/profile/${friend.username}`} className="flex-shrink-0 relative">
                        <img
                          src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          alt={friend.display_name}
                          className="w-14 h-14 rounded-full object-cover group-hover:scale-105 transition-transform duration-300 border border-gray-50"
                        />
                        {friend.is_online && (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
                        )}
                      </Link>

                      <div className="flex-1 min-w-0 py-1">
                        <Link 
                          href={`/profile/${friend.username}`}
                          className="font-bold text-base hover:text-indigo-600 block truncate transition-colors text-gray-900"
                        >
                          {friend.display_name}
                        </Link>
                        <p className="text-xs text-gray-400 truncate">@{friend.username}</p>
                        {friend.bio && (
                          <p className="text-xs text-gray-600 mt-1.5 line-clamp-1 leading-relaxed">{friend.bio}</p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 pt-1">
                        <Link
                          href={`/profile/${friend.username}`}
                          className="bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap transition-colors"
                        >
                          ดูโปรไฟล์
                        </Link>
                        
                        {friendship && (
                          <button
                            onClick={() => {
                              setSelectedFriendship(friendship.id);
                              setShowRemoveConfirm(true);
                            }}
                            className="bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 font-bold p-2 rounded-xl transition-colors flex items-center justify-center"
                            title="ลบเพื่อน"
                          >
                            <Trash2 className="w-4 h-4 md:mr-1" />
                            <span className="hidden md:inline text-xs">ลบ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false);
          setSelectedFriendship(null);
        }}
        onConfirm={handleRemoveFriend}
        title="ต้องการลบเพื่อน?"
        message="คุณจะไม่เห็นโพสต์ของเขาในหน้าแรก และต้องส่งคำขอใหม่ถ้าต้องการเป็นเพื่อนอีกครั้ง"
        confirmText="ลบเพื่อนถาวร"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

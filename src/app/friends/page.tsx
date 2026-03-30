'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import { UserPlus, Trash2, Search, Check, X, Clock, Users } from 'lucide-react';
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

      // สร้างการแจ้งเตือนกลับไปยังผู้ส่ง
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
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-2">
            เพื่อนของฉัน
          </h1>
          <p className="text-gray-500 text-sm md:text-base">
            จัดการคำขอและรายชื่อเพื่อนของคุณทั้งหมดที่นี่
          </p>
        </div>

        {/* 1. คำขอเป็นเพื่อน (Pending Requests) */}
        {pendingRequests.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-600">
              <UserPlus className="w-5 h-5" />
              คำขอเป็นเพื่อน ({pendingRequests.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.map(request => (
                <div key={request.id} className="card-minimal border-indigo-100 bg-indigo-50/30">
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${request.sender?.username}`} className="flex-shrink-0">
                      <img
                        src={request.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                        alt={request.sender?.display_name}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-white shadow-sm hover:opacity-80 transition"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/profile/${request.sender?.username}`} className="font-bold text-base hover:text-indigo-600 truncate block text-gray-900">
                        {request.sender?.display_name}
                      </Link>
                      <p className="text-xs text-gray-500 truncate">@{request.sender?.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id, request.sender_id)}
                        className="p-2 md:px-3 md:py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-sm flex items-center gap-1"
                        title="รับเป็นเพื่อน"
                      >
                        <Check className="w-4 h-4" />
                        <span className="hidden md:inline text-sm font-bold">ยืนยัน</span>
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className="p-2 md:px-3 md:py-2 bg-gray-200 text-gray-600 rounded-xl hover:bg-gray-300 transition flex items-center gap-1"
                        title="ลบคำขอ"
                      >
                        <X className="w-4 h-4" />
                        <span className="hidden md:inline text-sm font-bold">ลบ</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. คำขอที่ส่งแล้ว (Sent Requests) */}
        {sentRequests.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-600">
              <Clock className="w-5 h-5 text-gray-400" />
              คำขอที่ส่งแล้ว ({sentRequests.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentRequests.map(request => (
                <div key={request.id} className="card-minimal bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${request.receiver?.username}`} className="flex-shrink-0">
                      <img
                        src={request.receiver?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                        alt={request.receiver?.display_name}
                        className="w-12 h-12 rounded-full object-cover border border-white shadow-sm hover:opacity-80 transition"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/profile/${request.receiver?.username}`} className="font-bold text-sm md:text-base hover:underline truncate block text-gray-900">
                        {request.receiver?.display_name}
                      </Link>
                      <p className="text-xs text-gray-500 truncate">@{request.receiver?.username}</p>
                    </div>
                    <button
                      onClick={() => handleCancelRequest(request.id)}
                      className="text-xs font-bold px-3 py-2 bg-gray-200 text-gray-600 rounded-xl hover:bg-red-100 hover:text-red-600 transition whitespace-nowrap"
                    >
                      ยกเลิกคำขอ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. รายชื่อเพื่อน (Friends List) */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
              <Users className="w-5 h-5 text-green-500" />
              เพื่อนทั้งหมด ({friends.length})
            </h2>
            
            {/* ช่องค้นหาเพื่อน */}
            {friends.length > 0 && (
              <div className="relative w-full md:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ หรือ @username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm text-sm"
                />
              </div>
            )}
          </div>

          {/* Friends Grid/List */}
          {friends.length === 0 ? (
            <div className="card-minimal text-center py-16">
              <UserPlus className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 font-medium mb-1 text-base md:text-lg">
                คุณยังไม่มีเพื่อน
              </p>
              <p className="text-sm text-gray-400">
                เริ่มเพิ่มเพื่อนเพื่อเชื่อมต่อกับคนที่คุณรู้จัก
              </p>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="card-minimal text-center py-12">
              <p className="text-gray-500 font-medium text-base">ไม่พบรายชื่อเพื่อนที่ค้นหา "{searchQuery}"</p>
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-3 text-indigo-600 text-sm hover:underline font-bold"
              >
                ล้างการค้นหา
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFriends.map((friend) => {
                const friendship = friendships.find(f => f.sender_id === friend.id || f.receiver_id === friend.id);
                
                return (
                  <div key={friend.id} className="card-minimal">
                    <div className="flex items-start gap-3 md:gap-4">
                      <Link href={`/profile/${friend.username}`} className="flex-shrink-0 relative">
                        <img
                          src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          alt={friend.display_name}
                          className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover hover:opacity-80 transition"
                        />
                        {friend.is_online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </Link>

                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/profile/${friend.username}`}
                          className="font-bold text-base md:text-lg hover:underline block truncate text-gray-900"
                        >
                          {friend.display_name}
                        </Link>
                        <p className="text-xs md:text-sm text-gray-500 truncate">@{friend.username}</p>
                        {friend.bio && (
                          <p className="text-xs md:text-sm text-gray-600 mt-1 line-clamp-2">{friend.bio}</p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                        <Link
                          href={`/profile/${friend.username}`}
                          className="btn-secondary text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 whitespace-nowrap"
                        >
                          ดูโปรไฟล์
                        </Link>
                        
                        {friendship && (
                          <button
                            onClick={() => {
                              setSelectedFriendship(friendship.id);
                              setShowRemoveConfirm(true);
                            }}
                            className="text-red-500 hover:bg-red-50 hover:text-red-600 p-2 md:px-3 rounded-xl transition flex items-center justify-center"
                            title="ลบเพื่อน"
                          >
                            <Trash2 className="w-4 h-4 md:mr-1" />
                            <span className="hidden md:inline text-xs font-bold">ลบ</span>
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
        message="คุณจะไม่เห็นโพสต์ของเขาอีกต่อไป และต้องส่งคำขอใหม่ถ้าต้องการเป็นเพื่อนอีกครั้ง"
        confirmText="ลบเพื่อน"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

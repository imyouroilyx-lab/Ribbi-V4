'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import { UserPlus, UserCheck, UserX, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending';
  created_at: string;
  sender?: User;
  receiver?: User;
}

interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'accepted';
  created_at: string;
  sender?: User;
  receiver?: User;
}

export default function FriendsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'sent'>('friends');
  
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [selectedFriendship, setSelectedFriendship] = useState<string | null>(null);

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

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      setCurrentUser(userData);
      await Promise.all([
        loadFriends(user.id),
        loadFriendRequests(user.id),
        loadSentRequests(user.id)
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriends = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('*, sender:sender_id(*), receiver:receiver_id(*)')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      const friendsList = (data || []).map((friendship: Friendship) => {
        return friendship.sender_id === userId 
          ? friendship.receiver 
          : friendship.sender;
      }).filter((friend): friend is User => friend !== undefined);

      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadFriendRequests = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('*, sender:sender_id(*)')
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setFriendRequests(data || []);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  };

  const loadSentRequests = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('*, receiver:receiver_id(*)')
        .eq('sender_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setSentRequests(data || []);
    } catch (error) {
      console.error('Error loading sent requests:', error);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      if (currentUser) {
        await Promise.all([
          loadFriends(currentUser.id),
          loadFriendRequests(currentUser.id)
        ]);
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      if (currentUser) {
        await loadFriendRequests(currentUser.id);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      if (currentUser) {
        await loadSentRequests(currentUser.id);
      }
    } catch (error) {
      console.error('Error canceling request:', error);
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

      await loadFriends(currentUser.id);
      setSelectedFriendship(null);
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

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
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">เพื่อน</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl transition whitespace-nowrap text-sm md:text-base ${
              activeTab === 'friends'
                ? 'bg-frog-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            เพื่อน ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl transition whitespace-nowrap text-sm md:text-base relative ${
              activeTab === 'requests'
                ? 'bg-frog-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            คำขอเป็นเพื่อน ({friendRequests.length})
            {friendRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {friendRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl transition whitespace-nowrap text-sm md:text-base ${
              activeTab === 'sent'
                ? 'bg-frog-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            คำขอที่ส่งไป ({sentRequests.length})
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === 'friends' && (
            friends.length === 0 ? (
              <div className="card-minimal text-center py-12">
                <UserPlus className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-sm md:text-base">คุณยังไม่มีเพื่อน</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friends.map((friend) => (
                  <div key={friend.id} className="card-minimal">
                    <div className="flex items-start gap-3 md:gap-4">
                      <Link href={`/profile/${friend.username}`} className="flex-shrink-0">
                        <img
                          src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          alt={friend.display_name}
                          className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover hover:opacity-80 transition"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/profile/${friend.username}`}
                          className="font-bold text-base md:text-lg hover:underline block truncate"
                        >
                          {friend.display_name}
                        </Link>
                        <p className="text-xs md:text-sm text-gray-500 truncate">@{friend.username}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedFriendship(friend.id);
                          setShowRemoveConfirm(true);
                        }}
                        className="text-red-500 hover:text-red-700 p-2 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'requests' && (
            friendRequests.length === 0 ? (
              <div className="card-minimal text-center py-12">
                <UserCheck className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-sm md:text-base">ไม่มีคำขอเป็นเพื่อน</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {friendRequests.map((request) => (
                  <div key={request.id} className="card-minimal">
                    <div className="flex items-start gap-3 md:gap-4">
                      <Link href={`/profile/${request.sender?.username}`} className="flex-shrink-0">
                        <img
                          src={request.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          alt={request.sender?.display_name}
                          className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover hover:opacity-80 transition"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/profile/${request.sender?.username}`}
                          className="font-bold text-base md:text-lg hover:underline block truncate"
                        >
                          {request.sender?.display_name}
                        </Link>
                        <p className="text-xs md:text-sm text-gray-500 truncate">@{request.sender?.username}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          className="btn-primary text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 whitespace-nowrap"
                        >
                          ยอมรับ
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="btn-secondary text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 whitespace-nowrap"
                        >
                          ปฏิเสธ
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'sent' && (
            sentRequests.length === 0 ? (
              <div className="card-minimal text-center py-12">
                <UserX className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 text-sm md:text-base">ไม่มีคำขอที่ส่งไป</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {sentRequests.map((request) => (
                  <div key={request.id} className="card-minimal">
                    <div className="flex items-start gap-3 md:gap-4">
                      <Link href={`/profile/${request.receiver?.username}`} className="flex-shrink-0">
                        <img
                          src={request.receiver?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          alt={request.receiver?.display_name}
                          className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover hover:opacity-80 transition"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/profile/${request.receiver?.username}`}
                          className="font-bold text-base md:text-lg hover:underline block truncate"
                        >
                          {request.receiver?.display_name}
                        </Link>
                        <p className="text-xs md:text-sm text-gray-500 truncate">@{request.receiver?.username}</p>
                        <p className="text-xs md:text-sm text-gray-400 mt-1">รอการตอบรับ</p>
                      </div>
                      <button
                        onClick={() => handleCancelRequest(request.id)}
                        className="btn-secondary text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 whitespace-nowrap flex-shrink-0"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

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
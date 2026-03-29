'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import { UserPlus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'accepted';
  created_at: string;
  sender?: User;
  receiver?: User;
}

export default function ProfileFriendsPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [selectedFriendship, setSelectedFriendship] = useState<string | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    loadData();
  }, [username]);

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

      setCurrentUser(currentUserData);

      const { data: profileUserData } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (!profileUserData) {
        router.push('/');
        return;
      }

      setProfileUser(profileUserData);
      await loadFriends(profileUserData.id);

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

      setFriendships(data || []);

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

  const handleRemoveFriend = async () => {
    if (!selectedFriendship || !currentUser || !profileUser) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', selectedFriendship);

      if (error) throw error;

      await loadFriends(profileUser.id);
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

  if (!currentUser || !profileUser) return null;

  return (
    <NavLayout>
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href={`/profile/${username}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปโปรไฟล์
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">
            เพื่อนของ {profileUser.display_name}
          </h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">
            {friends.length} คน
          </p>
        </div>

        {/* Friends Grid/List */}
        {friends.length === 0 ? (
          <div className="card-minimal text-center py-12">
            <UserPlus className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-2 text-sm md:text-base">
              {isOwnProfile ? 'คุณยังไม่มีเพื่อน' : `${profileUser.display_name} ยังไม่มีเพื่อน`}
            </p>
            <p className="text-xs md:text-sm text-gray-400">
              {isOwnProfile && 'เริ่มเพิ่มเพื่อนเพื่อเชื่อมต่อกับคนที่คุณรู้จัก'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friends.map((friend, index) => {
              const friendship = friendships[index];
              
              return (
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
                      
                      {isOwnProfile && friendship && (
                        <button
                          onClick={() => {
                            setSelectedFriendship(friendship.id);
                            setShowRemoveConfirm(true);
                          }}
                          className="text-red-500 hover:text-red-700 p-2"
                          title="ลบเพื่อน"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
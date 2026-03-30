'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import { UserPlus, Trash2, ArrowLeft, Search } from 'lucide-react';
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
  
  // State สำหรับช่องค้นหา
  const [searchQuery, setSearchQuery] = useState('');

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

  if (!currentUser || !profileUser) return null;

  return (
    <NavLayout>
      <div className="max-w-4xl mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href={`/profile/${username}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm md:text-base transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปโปรไฟล์
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                เพื่อนของ {profileUser.display_name}
              </h1>
              <p className="text-gray-500 mt-1 text-sm font-medium">
                ทั้งหมด {friends.length} คน
              </p>
            </div>
          </div>
        </div>

        {/* ช่องค้นหาเพื่อน */}
        {friends.length > 0 && (
          <div className="mb-6 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อเพื่อน หรือ @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm text-sm"
            />
          </div>
        )}

        {/* Friends Grid/List */}
        {friends.length === 0 ? (
          <div className="card-minimal text-center py-12 md:py-20 border border-gray-100 bg-gray-50/50">
            <UserPlus className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium mb-1 text-base md:text-lg">
              {isOwnProfile ? 'คุณยังไม่มีเพื่อน' : `${profileUser.display_name} ยังไม่มีเพื่อน`}
            </p>
            <p className="text-sm text-gray-400">
              {isOwnProfile && 'เริ่มเพิ่มเพื่อนเพื่อเชื่อมต่อกับคนที่คุณรู้จัก'}
            </p>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="text-center py-12 border border-gray-100 bg-white rounded-3xl">
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
                <div key={friend.id} className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all group">
                  <div className="flex items-start gap-3 md:gap-4">
                    <Link href={`/profile/${friend.username}`} className="flex-shrink-0 relative">
                      <img
                        src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                        alt={friend.display_name}
                        className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover group-hover:scale-105 transition-transform duration-300 border border-gray-50"
                      />
                      {friend.is_online && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0 py-1">
                      <Link 
                        href={`/profile/${friend.username}`}
                        className="font-bold text-base md:text-lg hover:text-indigo-600 block truncate transition-colors text-gray-900"
                      >
                        {friend.display_name}
                      </Link>
                      <p className="text-xs md:text-sm text-gray-400 truncate">@{friend.username}</p>
                      {friend.bio && (
                        <p className="text-xs md:text-sm text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">{friend.bio}</p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 pt-1">
                      <Link
                        href={`/profile/${friend.username}`}
                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs md:text-sm font-bold px-3 md:px-4 py-2 rounded-xl whitespace-nowrap transition-colors"
                      >
                        ดูโปรไฟล์
                      </Link>
                      
                      {isOwnProfile && friendship && (
                        <button
                          onClick={() => {
                            setSelectedFriendship(friendship.id);
                            setShowRemoveConfirm(true);
                          }}
                          className="bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 font-bold p-2 md:px-3 rounded-xl transition-colors flex items-center justify-center"
                          title="ลบเพื่อน"
                        >
                          <Trash2 className="w-4 h-4 md:mr-1" />
                          <span className="hidden md:inline text-sm">ลบ</span>
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
        message="คุณจะไม่เห็นโพสต์ของเขาในหน้าแรก และต้องส่งคำขอใหม่ถ้าต้องการเป็นเพื่อนอีกครั้ง"
        confirmText="ลบเพื่อนถาวร"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import { 
  UserPlus, 
  Trash2, 
  ArrowLeft, 
  Search, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
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

const FRIENDS_PER_PAGE = 20;

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
  
  // State สำหรับค้นหาและ Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    loadData();
  }, [username]);

  const loadData = async () => {
    try {
      setIsLoading(true);
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
        .select('*, sender:sender_id(id, username, display_name, profile_img_url, bio, is_online), receiver:receiver_id(id, username, display_name, profile_img_url, bio, is_online)')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      setFriendships(data || []);

      const friendsList = (data || []).map((friendship: Friendship) => {
        return friendship.sender_id === userId 
          ? friendship.receiver 
          : friendship.sender;
      }).filter((friend): friend is User => friend !== undefined);

      // ✅ เรียงลำดับจาก A-Z
      friendsList.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '', 'th'));
      
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
      setShowRemoveConfirm(false);
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  // กรองรายชื่อเพื่อนตามช่องค้นหา
  const filteredFriends = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return friends.filter(friend => 
      (friend.display_name?.toLowerCase() || '').includes(q) ||
      (friend.username?.toLowerCase() || '').includes(q)
    );
  }, [friends, searchQuery]);

  // Logic การแบ่งหน้า (Pagination)
  const totalPages = Math.ceil(filteredFriends.length / FRIENDS_PER_PAGE);
  const currentFriends = useMemo(() => {
    const start = (currentPage - 1) * FRIENDS_PER_PAGE;
    return filteredFriends.slice(start, start + FRIENDS_PER_PAGE);
  }, [filteredFriends, currentPage]);

  // เมื่อมีการค้นหา ให้รีเซ็ตกลับหน้า 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 mx-auto mb-4 animate-bounce" />
            <p className="text-gray-500 font-medium">กำลังโหลดรายชื่อเพื่อน...</p>
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
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-4 text-xs font-black uppercase tracking-widest transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปยังโปรไฟล์
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">
                เพื่อนของ {profileUser.display_name}
              </h1>
              <p className="text-gray-400 mt-1 text-xs font-bold uppercase tracking-wider">
                TOTAL {friends.length} FRIENDS
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="ค้นหาชื่อเพื่อน หรือ @username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm font-medium"
          />
        </div>

        {/* Friends Grid */}
        {friends.length === 0 ? (
          <div className="card-minimal text-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-[2rem]">
            <UserPlus className="w-16 h-16 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500 font-bold text-lg">
              {isOwnProfile ? 'คุณยังไม่มีเพื่อน' : `${profileUser.display_name} ยังไม่มีเพื่อน`}
            </p>
            {isOwnProfile && <p className="text-gray-400 text-sm">เริ่มเพิ่มเพื่อนเพื่อเชื่อมต่อกับคนที่คุณรู้จัก</p>}
          </div>
        ) : currentFriends.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <p className="text-gray-400 font-bold">ไม่พบข้อมูลเพื่อนที่คุณค้นหา</p>
            <button onClick={() => setSearchQuery('')} className="mt-2 text-indigo-600 text-sm font-black hover:underline">แสดงทั้งหมด</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {currentFriends.map((friend) => {
              const friendship = friendships.find(f => f.sender_id === friend.id || f.receiver_id === friend.id);
              
              return (
                <div key={friend.id} className="bg-white rounded-2xl p-3 md:p-4 shadow-sm border border-gray-50 hover:border-indigo-100 transition-all group flex items-center gap-3">
                  <Link href={`/profile/${friend.username}`} className="flex-shrink-0 relative">
                    <img
                      src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                      alt={friend.display_name}
                      className="w-12 h-12 md:w-16 md:h-16 rounded-2xl object-cover border border-gray-50 group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {friend.is_online && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link 
                      href={`/profile/${friend.username}`}
                      className="font-black text-sm md:text-base hover:text-indigo-600 truncate block transition-colors text-gray-900"
                    >
                      {friend.display_name}
                    </Link>
                    <p className="text-[10px] md:text-xs text-gray-400 font-bold truncate uppercase tracking-tight">@{friend.username}</p>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <Link
                      href={`/profile/${friend.username}`}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                      title="ดูโปรไฟล์"
                    >
                      <ArrowLeft className="w-5 h-5 rotate-180" />
                    </Link>
                    
                    {isOwnProfile && friendship && (
                      <button
                        onClick={() => {
                          setSelectedFriendship(friendship.id);
                          setShowRemoveConfirm(true);
                        }}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="ลบเพื่อน"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button 
              disabled={currentPage === 1} 
              onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-30 shadow-sm hover:bg-slate-50 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const p = i + 1;
                // แสดงแค่หน้าแรก หน้าสุดท้าย และหน้าใกล้เคียงปัจจุบัน
                if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                  return (
                    <button 
                      key={i} 
                      onClick={() => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                      className={`w-9 h-9 rounded-xl text-[10px] font-black transition-all shadow-sm ${currentPage === p ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-100 text-gray-500 hover:bg-slate-50'}`}
                    >
                      {p}
                    </button>
                  );
                }
                if (p === currentPage - 2 || p === currentPage + 2) {
                  return <span key={i} className="text-gray-300 text-xs px-1">...</span>;
                }
                return null;
              })}
            </div>

            <button 
              disabled={currentPage === totalPages} 
              onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-30 shadow-sm hover:bg-slate-50 transition-all"
            >
              <ChevronRight size={20} />
            </button>
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
        title="ต้องการเลิกเป็นเพื่อน?"
        message="การลบเพื่อนจะทำให้คุณไม่เห็นโพสต์ของเขาในหน้า Feed อีกต่อไป"
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

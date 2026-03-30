'use client';

import { useState, useEffect, useCallback } from 'react'; // ✅ เพิ่ม useCallback
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
  ChevronRight,
  Loader2 
} from 'lucide-react';
import Link from 'next/link';

const FRIENDS_PER_PAGE = 20;

export default function ProfileFriendsPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFriendsLoading, setIsFriendsLoading] = useState(false); // ✅ แยกสถานะโหลดเพื่อน
  const [totalFriends, setTotalFriends] = useState(0);
  
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [selectedFriendship, setSelectedFriendship] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const isOwnProfile = currentUser?.username === username;

  // 1. Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 2. Load Initial User Data
  useEffect(() => {
    loadUserData();
  }, [username]);

  // 3. Load Friends when User ID or Search/Page changes
  useEffect(() => {
    if (profileUser?.id) {
      loadFriends(profileUser.id);
    }
  }, [profileUser?.id, debouncedSearch, currentPage]);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      // ✅ Optimize: ดึงเฉพาะ Column ที่จำเป็น
      const [currentUserRes, profileUserRes] = await Promise.all([
        supabase.from('users').select('id, username').eq('id', authUser.id).single(),
        supabase.from('users').select('id, username, display_name').eq('username', username).single()
      ]);

      if (!profileUserRes.data) { router.push('/'); return; }

      setCurrentUser(currentUserRes.data as any);
      setProfileUser(profileUserRes.data as any);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriends = async (userId: string) => {
    try {
      setIsFriendsLoading(true);
      const from = (currentPage - 1) * FRIENDS_PER_PAGE;
      const to = from + FRIENDS_PER_PAGE - 1;

      // ✅ Optimize: ใช้ SQL ในการกรองและแบ่งหน้า (Server-side)
      let query = supabase
        .from('friendships')
        .select(`
          id,
          sender:sender_id(id, username, display_name, profile_img_url, is_online),
          receiver:receiver_id(id, username, display_name, profile_img_url, is_online)
        `, { count: 'exact' })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      // ถ้ามีการค้นหา ให้กรองผ่าน SQL ilike
      if (debouncedSearch) {
        query = query.or(`sender.display_name.ilike.%${debouncedSearch}%,receiver.display_name.ilike.%${debouncedSearch}%,sender.username.ilike.%${debouncedSearch}%,receiver.username.ilike.%${debouncedSearch}%`);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setTotalFriends(count || 0);
      
      const formattedFriends = (data || []).map((f: any) => {
        const friend = f.sender.id === userId ? f.receiver : f.sender;
        return { ...friend, friendshipId: f.id };
      });

      setFriends(formattedFriends);
    } catch (error) {
      console.error(error);
    } finally {
      setIsFriendsLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!selectedFriendship) return;
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', selectedFriendship);
      if (error) throw error;
      
      // Optimistic Update: ลบออกจากหน้าจอทันที
      setFriends(prev => prev.filter(f => (f as any).friendshipId !== selectedFriendship));
      setTotalFriends(prev => prev - 1);
      setShowRemoveConfirm(false);
    } catch (error) {
      console.error(error);
    }
  };

  const totalPages = Math.ceil(totalFriends / FRIENDS_PER_PAGE);

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64 animate-pulse">
           <img src="https://iili.io/qbtgKBt.png" className="w-12 h-12 grayscale opacity-30" alt="loading" />
        </div>
      </NavLayout>
    );
  }

  if (!currentUser || !profileUser) return null;

  return (
    <NavLayout>
      <div className="max-w-4xl mx-auto px-4 py-4 md:py-8">
        <Link 
          href={`/profile/${username}`}
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-6 text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> กลับไปยังโปรไฟล์
        </Link>

        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">
              เพื่อนของ {profileUser.display_name}
            </h1>
            <p className="text-gray-400 mt-1 text-[10px] font-black uppercase tracking-widest">
              สมาชิกทั้งหมด {totalFriends} คน
            </p>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ค้นหาเพื่อน..."
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }}
              className="w-full pl-11 pr-4 py-3 bg-gray-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold shadow-inner"
            />
          </div>
        </div>

        {isFriendsLoading && friends.length === 0 ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-200" size={40} /></div>
        ) : (
          <>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 transition-opacity ${isFriendsLoading ? 'opacity-50' : 'opacity-100'}`}>
              {friends.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2.5rem]">
                  <p className="text-gray-400 font-black uppercase text-xs tracking-widest">ไม่พบรายชื่อเพื่อน</p>
                </div>
              ) : (
                friends.map((friend: any) => (
                  <div key={friend.id} className="bg-white rounded-3xl p-3 border border-gray-100 hover:border-indigo-200 hover:shadow-xl transition-all group flex items-center gap-4">
                    <Link href={`/profile/${friend.username}`} className="flex-shrink-0 relative">
                      <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 md:w-16 md:h-16 rounded-[1.25rem] object-cover shadow-sm group-hover:scale-105 transition-transform" alt="" />
                      {friend.is_online && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white rounded-full"></div>}
                    </Link>

                    <div className="flex-1 min-w-0">
                      <Link href={`/profile/${friend.username}`} className="font-black text-sm md:text-base text-gray-900 truncate block hover:text-indigo-600 transition-colors">
                        {friend.display_name}
                      </Link>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">@{friend.username}</p>
                    </div>

                    {isOwnProfile && (
                      <button 
                        onClick={() => { setSelectedFriendship(friend.friendshipId); setShowRemoveConfirm(true); }}
                        className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-3">
                <button 
                  disabled={currentPage === 1 || isFriendsLoading}
                  onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="p-3 bg-white border border-gray-100 rounded-2xl disabled:opacity-20 hover:bg-gray-50 transition-all shadow-sm"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 bg-gray-100 px-5 py-2.5 rounded-full">
                  PAGE {currentPage} / {totalPages}
                </span>
                <button 
                  disabled={currentPage === totalPages || isFriendsLoading}
                  onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="p-3 bg-white border border-gray-100 rounded-2xl disabled:opacity-20 hover:bg-gray-50 transition-all shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemoveFriend}
        title="ยกเลิกความเป็นเพื่อน?"
        message="หากคุณกดยืนยัน รายชื่อเพื่อนจะถูกลบออกจากทั้งสองฝ่ายทันที"
        variant="danger"
      />
    </NavLayout>
  );
}

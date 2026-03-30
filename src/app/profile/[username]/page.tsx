'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, type User, type Post } from '../../../lib/supabase'; // ✅ Use relative path
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '../../../components/NavLayout';
import PostCardV3 from '../../../components/PostCardV3';
import CreatePostV3 from '../../../components/CreatePostV3';
import ConfirmModal from '../../../components/ConfirmModal';
import { 
  MapPin, Calendar, Briefcase, Home as HomeIcon, 
  Edit, UserPlus, UserCheck, Heart, Users, Music, ExternalLink,
  MessageCircle, Ban, EyeOff, Trash2, X, Plus, Clock, ChevronRight, CheckCircle2, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { calculateAge } from '../../../lib/utils';

const POSTS_PER_PAGE = 10;

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<any | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted' | 'sent'>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [isAlreadyInMyFamily, setIsAlreadyInMyFamily] = useState(false);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [newRelationship, setNewRelationship] = useState('');
  const [blockStatus, setBlockStatus] = useState<'none' | 'blocked' | 'ignored'>('none');
  const [friends, setFriends] = useState<User[]>([]);
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => { if (entries[0].isIntersecting && hasMore) setPage(p => p + 1); });
    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, hasMore]);

  useEffect(() => { loadInitialData(); }, [username, refreshTrigger]);
  useEffect(() => { if (page > 0) loadMorePosts(); }, [page]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      // 1. ดึงข้อมูล User หลักก่อนเพื่อความเร็ว
      const { data: profileData } = await supabase.from('users').select('*').eq('username', username).single();
      if (!profileData) { router.push('/'); return; }
      setProfileUser(profileData);

      // 2. ดึงข้อมูลประกอบแบบขนาน และใช้ RPC เพื่อลด API calls
      const [currentUserRes, batchDataRes, postsRes, familyRes, friendsRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.rpc('get_profile_initial_data', { current_uid: authUser.id, target_uid: profileData.id }),
        supabase.from('posts').select('*, author:author_id(id, username, display_name, profile_img_url), target:target_id(id, username, display_name, profile_img_url)').eq('target_id', profileData.id).order('created_at', { ascending: false }).range(0, POSTS_PER_PAGE - 1),
        supabase.from('family_members').select('*, member:member_user_id(*)').eq('user_id', profileData.id),
        supabase.from('friendships').select('*, sender:sender_id(*), receiver:receiver_id(*)').eq('status', 'accepted').or(`sender_id.eq.${profileData.id},receiver_id.eq.${profileData.id}`).limit(4)
      ]);

      setCurrentUser(currentUserRes.data);
      
      // จัดการ Batch Data (RPC result)
      if (batchDataRes.data) {
        const bd = batchDataRes.data;
        setBlockStatus(bd.block_status || 'none');
        setIsAlreadyInMyFamily(bd.is_in_my_family);
        if (bd.friendship) {
          setFriendshipId(bd.friendship.id);
          if (bd.friendship.status === 'accepted') setFriendshipStatus('accepted');
          else if (bd.friendship.sender_id === authUser.id) setFriendshipStatus('sent');
          else setFriendshipStatus('pending');
        } else {
          setFriendshipStatus('none');
        }
      }

      setPosts(postsRes.data || []);
      setHasMore((postsRes.data?.length || 0) === POSTS_PER_PAGE);
      setFamilyMembers(familyRes.data || []);
      
      const friendList = (friendsRes.data || []).map((f: any) => f.sender_id === profileData.id ? f.receiver : f.sender);
      setFriends(friendList);

      // ✅ Throttled View Count: บันทึกวิวเฉพาะถ้ายังไม่ได้ดูใน 1 ชม. ล่าสุด
      const viewKey = `v_${profileData.id}`;
      const lastView = sessionStorage.getItem(viewKey);
      if (!lastView && authUser.id !== profileData.id) {
        await supabase.from('profile_views').insert({ profile_id: profileData.id, visitor_id: authUser.id });
        sessionStorage.setItem(viewKey, Date.now().toString());
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || !profileUser) return;
    setIsLoadingMore(true);
    const start = page * POSTS_PER_PAGE;
    const { data } = await supabase.from('posts').select('*, author:author_id(id, username, display_name, profile_img_url), target:target_id(id, username, display_name, profile_img_url)').eq('target_id', profileUser.id).order('created_at', { ascending: false }).range(start, start + POSTS_PER_PAGE - 1);
    if (data && data.length > 0) {
      setPosts(prev => [...prev, ...data]);
      setHasMore(data.length === POSTS_PER_PAGE);
    } else { setHasMore(false); }
    setIsLoadingMore(false);
  };

  const handleSendMessage = async () => {
    if (!currentUser || !profileUser) return;
    // ✅ ใช้ RPC เพื่อหาหรือสร้างห้องแชทในครั้งเดียว (เร็วมาก)
    const { data: chatId, error } = await supabase.rpc('get_or_create_dm', { uid_a: currentUser.id, uid_b: profileUser.id });
    if (chatId) router.push(`/messages?chat=${chatId}`);
  };

  const handleAddFriend = async () => {
    if (!currentUser || !profileUser) return;
    const { data } = await supabase.from('friendships').insert({ sender_id: currentUser.id, receiver_id: profileUser.id, status: 'pending' }).select().single();
    if (data) { setFriendshipId(data.id); setFriendshipStatus('sent'); }
  };

  const handleAcceptFriend = async () => {
    if (!friendshipId) return;
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    setFriendshipStatus('accepted');
    setRefreshTrigger(t => t + 1);
  };

  const handleRemoveFriend = async () => {
    if (!friendshipId) return;
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setFriendshipStatus('none');
    setFriendshipId(null);
    setRefreshTrigger(t => t + 1);
  };

  if (isLoading && page === 0) return <NavLayout><div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-frog-500" /></div></NavLayout>;
  if (!profileUser || !currentUser) return null;

  const themeColor = profileUser.theme_color || '#9de5a8';

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            {/* Profile Header */}
            <div className="card-minimal overflow-hidden p-0 border border-gray-100 shadow-sm bg-white rounded-[2rem]">
              <div className="h-32 md:h-56" style={profileUser.cover_img_url ? { backgroundImage: `url(${profileUser.cover_img_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)` }} />
              <div className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6 -mt-20 mb-6">
                  <div className="w-24 h-24 md:w-36 md:h-36 rounded-full p-1.5 shadow-xl bg-white flex-shrink-0" style={{ borderColor: themeColor, borderWidth: '4px' }}>
                    <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full h-full rounded-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 md:mt-20 flex flex-wrap justify-start md:justify-end gap-2">
                    {currentUser.id === profileUser.id ? (
                      <Link href="/profile/edit" className="btn-secondary font-bold px-6 py-2.5 rounded-2xl flex items-center gap-2 border border-gray-200"><Edit size={18} /> แก้ไขโปรไฟล์</Link>
                    ) : (
                      <>
                        <button onClick={handleSendMessage} className="btn-secondary font-bold px-6 py-2.5 rounded-2xl flex items-center gap-2 border border-gray-200"><MessageCircle size={18} /> ข้อความ</button>
                        {friendshipStatus === 'none' && <button onClick={handleAddFriend} className="btn-primary font-bold px-6 py-2.5 rounded-2xl flex items-center gap-2 bg-slate-900 text-white shadow-lg"><UserPlus size={18} /> เพิ่มเพื่อน</button>}
                        {friendshipStatus === 'sent' && <button className="btn-secondary font-bold px-6 py-2.5 rounded-2xl opacity-50 cursor-default" disabled>รอการตอบรับ</button>}
                        {friendshipStatus === 'pending' && <button onClick={handleAcceptFriend} className="btn-primary font-bold px-6 py-2.5 rounded-2xl bg-frog-600 text-white shadow-lg">ตอบรับคำขอ</button>}
                        {friendshipStatus === 'accepted' && <button onClick={handleRemoveFriend} className="btn-secondary font-bold px-6 py-2.5 rounded-2xl flex items-center gap-2 border border-gray-200 text-red-500 hover:bg-red-50"><UserCheck size={18} /> เลิกเป็นเพื่อน</button>}
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div><h1 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight">{profileUser.display_name}</h1><p className="text-gray-400 font-bold uppercase text-xs tracking-widest">@{profileUser.username}</p></div>
                  {profileUser.bio && <p className="text-gray-600 font-medium leading-relaxed italic border-l-4 border-gray-100 pl-4">"{profileUser.bio}"</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-500 font-bold">
                    {profileUser.birthday && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-frog-500" /> {calculateAge(profileUser.birthday)} ปี</div>}
                    {profileUser.occupation && <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-frog-500" /> {profileUser.occupation}</div>}
                    {profileUser.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500" /> {profileUser.address}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Posts */}
            {(friendshipStatus === 'accepted' || currentUser.id === profileUser.id) && (
              <div className="space-y-6">
                <CreatePostV3 currentUser={currentUser} targetUser={profileUser} onPostCreated={() => setRefreshTrigger(t => t + 1)} />
                <div className="space-y-4">
                  {posts.map((p, i) => (
                    <div ref={posts.length === i + 1 ? lastPostElementRef : null} key={p.id}>
                      <PostCardV3 post={p} currentUserId={currentUser.id} profileOwnerId={profileUser.id} onDelete={(id) => { setPostToDelete(id); setShowDeletePostConfirm(true); }} />
                    </div>
                  ))}
                  {isLoadingMore && <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-200" /></div>}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-80 space-y-6">
            <div className="card-minimal bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm sticky top-4">
              <h3 className="font-black text-gray-900 mb-4 flex items-center justify-between">เพื่อน <span className="text-xs text-gray-400">{friends.length} คน</span></h3>
              <div className="grid grid-cols-2 gap-3">
                {friends.map(f => (
                  <Link key={f.id} href={`/profile/${f.username}`} className="flex flex-col items-center gap-2 p-2 hover:bg-gray-50 rounded-2xl transition">
                    <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-16 h-16 rounded-2xl object-cover shadow-sm" alt="" />
                    <p className="text-[10px] font-black text-center truncate w-full">{f.display_name.split(' ')[0]}</p>
                  </Link>
                ))}
              </div>
              <Link href={`/profile/${profileUser.username}/friends`} className="mt-4 block text-center py-2 text-[10px] font-black uppercase text-frog-600 hover:bg-frog-50 rounded-xl border border-frog-100 transition">ดูเพื่อนทั้งหมด</Link>
            </div>
          </div>
        </div>
      </div>
      
      <ConfirmModal isOpen={showDeletePostConfirm} onClose={() => setShowDeletePostConfirm(false)} onConfirm={async () => { if(postToDelete) { await supabase.from('posts').delete().eq('id', postToDelete); setPosts(prev => prev.filter(p => p.id !== postToDelete)); setShowDeletePostConfirm(false); } }} title="ลบโพสต์?" message="ต้องการลบโพสต์นี้ถาวรใช่หรือไม่" variant="danger" />
    </NavLayout>
  );
}

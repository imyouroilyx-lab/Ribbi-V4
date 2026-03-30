'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
// ✅ แก้ไข path ให้ Build ผ่านแน่นอน
import { supabase, type User, type Post } from '../../../lib/supabase'; 
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
  
  // ✅ คืนค่าข้อมูลครอบครัวและความสัมพันธ์
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [isAlreadyInMyFamily, setIsAlreadyInMyFamily] = useState(false);
  const [blockStatus, setBlockStatus] = useState<'none' | 'blocked' | 'ignored'>('none');
  const [friends, setFriends] = useState<User[]>([]);
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => { 
      if (entries[0].isIntersecting && hasMore) setPage(p => p + 1); 
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, hasMore]);

  useEffect(() => { loadInitialData(); }, [username, refreshTrigger]);
  useEffect(() => { if (page > 0) loadMorePosts(); }, [page]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      // 1. ดึงข้อมูล Profile หลัก (รวม Bio และ Hobbies)
      const { data: profileData } = await supabase.from('users').select('*').eq('username', username).single();
      if (!profileData) { router.push('/'); return; }
      setProfileUser(profileData);

      // 2. ดึงข้อมูลประกอบแบบขนาน
      const [currentUserRes, batchDataRes, postsRes, familyRes, friendsRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.rpc('get_profile_initial_data', { current_uid: authUser.id, target_uid: profileData.id }),
        supabase.from('posts').select('*, author:author_id(id, username, display_name, profile_img_url), target:target_id(id, username, display_name, profile_img_url)').eq('target_id', profileData.id).order('created_at', { ascending: false }).range(0, POSTS_PER_PAGE - 1),
        supabase.from('family_members').select('*, member:member_user_id(*)').eq('user_id', profileData.id),
        supabase.from('friendships').select('*, sender:sender_id(*), receiver:receiver_id(*)').eq('status', 'accepted').or(`sender_id.eq.${profileData.id},receiver_id.eq.${profileData.id}`).limit(6)
      ]);

      setCurrentUser(currentUserRes.data);
      setPosts(postsRes.data || []);
      setHasMore((postsRes.data?.length || 0) === POSTS_PER_PAGE);
      setFamilyMembers(familyRes.data || []);
      
      const friendList = (friendsRes.data || []).map((f: any) => f.sender_id === profileData.id ? f.receiver : f.sender);
      setFriends(friendList);

      if (batchDataRes.data) {
        setBlockStatus(batchDataRes.data.block_status || 'none');
        setIsAlreadyInMyFamily(batchDataRes.data.is_in_my_family);
        if (batchDataRes.data.friendship) {
          setFriendshipId(batchDataRes.data.friendship.id);
          if (batchDataRes.data.friendship.status === 'accepted') setFriendshipStatus('accepted');
          else if (batchDataRes.data.friendship.sender_id === authUser.id) setFriendshipStatus('sent');
          else setFriendshipStatus('pending');
        }
      }

      // Throttled View Count
      const viewKey = `v_${profileData.id}`;
      if (!sessionStorage.getItem(viewKey) && authUser.id !== profileData.id) {
        await supabase.from('profile_views').insert({ profile_id: profileData.id, visitor_id: authUser.id });
        sessionStorage.setItem(viewKey, '1');
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
    const { data: chatId } = await supabase.rpc('get_or_create_dm', { uid_a: currentUser.id, uid_b: profileUser.id });
    if (chatId) router.push(`/messages?chat=${chatId}`);
  };

  const handleAddFriend = async () => {
    if (!currentUser || !profileUser) return;
    const { data } = await supabase.from('friendships').insert({ sender_id: currentUser.id, receiver_id: profileUser.id, status: 'pending' }).select().single();
    if (data) { setFriendshipId(data.id); setFriendshipStatus('sent'); }
  };

  if (isLoading && page === 0) return <NavLayout><div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-frog-500" /></div></NavLayout>;
  if (!profileUser || !currentUser) return null;

  const themeColor = profileUser.theme_color || '#9de5a8';

  // ✅ UI ส่วนความสัมพันธ์ (Relationship Section)
  const relationshipSection = (
    <div className="card-minimal bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
      <h3 className="font-black text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wider"><Heart className="w-4 h-4 text-red-500" /> ความสัมพันธ์</h3>
      
      {profileUser.relationship_status && (
        <div className="p-3 bg-red-50/50 rounded-2xl border border-red-50">
          <p className="text-[10px] font-black text-red-400 uppercase mb-1">สถานะหัวใจ</p>
          <p className="text-sm font-bold text-gray-800">
            {profileUser.relationship_status === 'single' && '👤 โสด'}
            {profileUser.relationship_status === 'in_relationship' && '❤️ มีแฟนแล้ว'}
            {profileUser.relationship_status === 'engaged' && '💍 หมั้นแล้ว'}
            {profileUser.relationship_status === 'married' && '💒 แต่งงานแล้ว'}
            {profileUser.relationship_custom_name && <span className="text-frog-600"> กับ {profileUser.relationship_custom_name}</span>}
          </p>
        </div>
      )}

      {familyMembers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">ครอบครัวและคนใกล้ชิด</p>
          {familyMembers.map((fm) => (
            <Link key={fm.id} href={`/profile/${fm.member.username}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl transition group">
              <img src={fm.member.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-9 h-9 rounded-xl object-cover shadow-sm" alt="" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs text-gray-800 truncate">{fm.member.display_name}</p>
                <p className="text-[10px] text-gray-400 font-medium uppercase">{fm.relationship_label}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            <div className="card-minimal overflow-hidden p-0 border border-gray-100 shadow-sm bg-white rounded-[2rem]">
              <div className="h-32 md:h-56" style={profileUser.cover_img_url ? { backgroundImage: `url(${profileUser.cover_img_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)` }} />
              <div className="p-4 md:p-8">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6 -mt-24 mb-6">
                  <div className="w-28 h-28 md:w-40 md:h-40 rounded-full p-1.5 shadow-2xl bg-white flex-shrink-0" style={{ borderColor: themeColor, borderWidth: '5px' }}>
                    <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full h-full rounded-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 md:mt-24 flex flex-wrap justify-start md:justify-end gap-2">
                    {currentUser.id === profileUser.id ? (
                      <Link href="/profile/edit" className="btn-secondary font-bold px-6 py-2.5 rounded-2xl flex items-center gap-2 border border-gray-200"><Edit size={18} /> แก้ไขโปรไฟล์</Link>
                    ) : (
                      <>
                        <button onClick={handleSendMessage} className="btn-secondary font-bold px-6 py-2.5 rounded-2xl flex items-center gap-2 border border-gray-200"><MessageCircle size={18} /> ข้อความ</button>
                        {friendshipStatus === 'none' && <button onClick={handleAddFriend} className="btn-primary font-bold px-6 py-2.5 rounded-2xl flex items-center gap-2 bg-slate-900 text-white shadow-lg"><UserPlus size={18} /> เพิ่มเพื่อน</button>}
                        {friendshipStatus === 'accepted' && <button className="btn-secondary font-bold px-6 py-2.5 rounded-2xl flex items-center gap-2 border border-gray-200 text-frog-600"><UserCheck size={18} /> เพื่อนกันแล้ว</button>}
                      </>
                    )}
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl md:text-5xl font-black text-gray-900 leading-none mb-2">{profileUser.display_name}</h1>
                    <p className="text-gray-400 font-bold uppercase text-xs tracking-[0.2em]">@{profileUser.username}</p>
                  </div>

                  {/* ✅ Bio รองรับหลายบรรทัด */}
                  {profileUser.bio && (
                    <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap break-words border-l-4 border-gray-100 pl-5 text-lg italic">
                      {profileUser.bio}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-500 font-bold">
                    {profileUser.birthday && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-frog-500" /> {calculateAge(profileUser.birthday)} ปี ({profileUser.birthday})</div>}
                    {profileUser.occupation && <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-frog-500" /> {profileUser.occupation}</div>}
                    {profileUser.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500" /> {profileUser.address}</div>}
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> เป็นสมาชิกเมื่อ {new Date(profileUser.created_at).toLocaleDateString('th-TH')}</div>
                  </div>

                  {/* ✅ กู้คืนงานอดิเรก (Hobbies) */}
                  {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {profileUser.hobbies.map((h: any, i: number) => (
                        <span key={i} className="px-4 py-2 rounded-2xl text-xs font-black border transition-all hover:scale-105 uppercase tracking-tighter" style={{ backgroundColor: `${themeColor}15`, color: themeColor, borderColor: `${themeColor}30` }}>
                          # {typeof h === 'string' ? h : h.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Posts Area */}
            {(friendshipStatus === 'accepted' || currentUser.id === profileUser.id) && (
              <div className="space-y-6">
                <CreatePostV3 currentUser={currentUser} targetUser={profileUser} onPostCreated={() => setRefreshTrigger(t => t + 1)} />
                <div className="space-y-4">
                  {posts.map((p, i) => (
                    <div ref={posts.length === i + 1 ? lastPostElementRef : null} key={p.id}>
                      <PostCardV3 post={p} currentUserId={currentUser.id} profileOwnerId={profileUser.id} onDelete={(id) => { setPostToDelete(id); setShowDeletePostConfirm(true); }} />
                    </div>
                  ))}
                  {isLoadingMore && <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-85 space-y-6">
            {/* Friends Widget */}
            <div className="card-minimal bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest">เพื่อนล่าสุด</h3>
                <Link href={`/profile/${profileUser.username}/friends`} className="text-[10px] font-black text-frog-600 hover:underline">ดูทั้งหมด</Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {friends.slice(0, 6).map(f => (
                  <Link key={f.id} href={`/profile/${f.username}`} className="flex flex-col items-center gap-1.5 group">
                    <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-16 h-16 rounded-2xl object-cover border border-gray-100 group-hover:scale-105 transition-transform shadow-sm" alt="" />
                    <p className="text-[9px] font-black text-center truncate w-full text-gray-500 uppercase">{f.display_name.split(' ')[0]}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* ✅ แสดงสถานะความสัมพันธ์และครอบครัวใน Sidebar */}
            {relationshipSection}
            
            <div className="text-center opacity-30"><p className="text-[10px] font-black uppercase tracking-[0.3em]">Ribbi Community</p></div>
          </div>
        </div>
      </div>
      
      <ConfirmModal isOpen={showDeletePostConfirm} onClose={() => setShowDeletePostConfirm(false)} onConfirm={async () => { if(postToDelete) { await supabase.from('posts').delete().eq('id', postToDelete); setPosts(prev => prev.filter(p => p.id !== postToDelete)); setShowDeletePostConfirm(false); } }} title="ลบโพสต์?" message="ต้องการลบโพสต์นี้ถาวรใช่หรือไม่" variant="danger" />
    </NavLayout>
  );
}

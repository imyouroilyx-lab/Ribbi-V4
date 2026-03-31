'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, type User, type Post } from '../../../lib/supabase'; 
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '../../../components/NavLayout';
import PostCardV3 from '../../../components/PostCardV3';
import CreatePostV3 from '../../../components/CreatePostV3';
import ConfirmModal from '../../../components/ConfirmModal';
import { 
  MapPin, Calendar, Briefcase, Home as HomeIcon, 
  Edit, UserPlus, UserCheck, Heart, Users, Music, 
  MessageCircle, Clock, Loader2, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { calculateAge } from '../../../lib/utils';

const POSTS_PER_PAGE = 10;

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  } catch { return dateString; }
};

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
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

      const { data: profileData } = await supabase.from('users').select('*').eq('username', username).single();
      if (!profileData) { router.push('/'); return; }
      setProfileUser(profileData);

      const [currentUserRes, batchDataRes, postsRes, familyRes, friendsRes] = await Promise.all([
        supabase.from('users').select('id, username, display_name, profile_img_url').eq('id', authUser.id).single(),
        supabase.rpc('get_profile_initial_data', { current_uid: authUser.id, target_uid: profileData.id }),
        supabase.from('posts').select('*, author:author_id(id, username, display_name, profile_img_url), target:target_id(id, username, display_name, profile_img_url)').eq('target_id', profileData.id).order('created_at', { ascending: false }).range(0, POSTS_PER_PAGE - 1),
        supabase.from('family_members').select('*, member:member_user_id(*)').eq('user_id', profileData.id),
        supabase.from('friendships').select('*, sender:sender_id(*), receiver:receiver_id(*)').eq('status', 'accepted').or(`sender_id.eq.${profileData.id},receiver_id.eq.${profileData.id}`).order('created_at', { ascending: false }).limit(9)
      ]);

      setCurrentUser(currentUserRes.data as any);
      setPosts(postsRes.data || []);
      setHasMore((postsRes.data?.length || 0) === POSTS_PER_PAGE);
      setFamilyMembers(familyRes.data || []);
      
      const friendList = (friendsRes.data || []).map((f: any) => f.sender_id === profileData.id ? f.receiver : f.sender);
      setFriends(friendList);

      if (batchDataRes.data?.friendship) {
        const f = batchDataRes.data.friendship;
        if (f.status === 'accepted') setFriendshipStatus('accepted');
        else if (f.sender_id === authUser.id) setFriendshipStatus('sent');
        else setFriendshipStatus('pending');
      } else { setFriendshipStatus('none'); }
    } catch (err) { console.error(err); } 
    finally { setIsLoading(false); }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || !profileUser) return;
    setIsLoadingMore(true);
    const start = page * POSTS_PER_PAGE;
    const { data } = await supabase.from('posts').select('*, author:author_id(id, username, display_name, profile_img_url), target:target_id(id, username, display_name, profile_img_url)').eq('target_id', profileUser.id).order('created_at', { ascending: false }).range(start, start + POSTS_PER_PAGE - 1);
    if (data?.length) {
      setPosts(prev => [...prev, ...data]);
      setHasMore(data.length === POSTS_PER_PAGE);
    } else { setHasMore(false); }
    setIsLoadingMore(false);
  };

  const handleSendMessage = async () => {
    const { data: chatId } = await supabase.rpc('get_or_create_dm', { uid_a: currentUser?.id, uid_b: profileUser.id });
    if (chatId) router.push(`/messages?chat=${chatId}`);
  };

  const handleAddFriend = async () => {
    await supabase.from('friendships').insert({ sender_id: currentUser?.id, receiver_id: profileUser.id, status: 'pending' });
    setFriendshipStatus('sent');
  };

  if (isLoading && page === 0) return <NavLayout><div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" /><p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">กำลังโหลดโปรไฟล์...</p></div></NavLayout>;
  if (!profileUser || !currentUser) return null;

  const themeColor = profileUser.theme_color || '#9de5a8';

  // --- Widgets ---

  const MusicWidget = () => {
    if (!profileUser.profile_song_url) return null;
    let embedUrl = profileUser.profile_song_url;
    // ปรับ Logic การเปลี่ยน Spotify Link
    if (embedUrl.includes('spotify.com')) {
       embedUrl = embedUrl.replace('/track/', '/embed/track/');
    }
    return (
      <div className="card-minimal bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-soft">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-black text-gray-900 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]"><Music className="w-3 h-3 text-indigo-500" /> กำลังฟัง</h3>
          {profileUser.profile_song_name && <span className="text-[9px] font-black text-gray-400 truncate max-w-[100px]">{profileUser.profile_song_name}</span>}
        </div>
        <iframe src={embedUrl} width="100%" height="80" frameBorder="0" allow="encrypted-media" className="rounded-2xl shadow-sm"></iframe>
      </div>
    );
  };

  const FriendsWidget = () => (
    <div className="card-minimal bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-soft">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="font-black text-gray-900 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2"><Users className="w-3 h-3 text-frog-500" /> เพื่อน </h3>
        <Link href={`/profile/${profileUser.username}/friends`} className="text-[9px] font-black text-frog-600 bg-frog-50 px-2 py-1 rounded-lg uppercase">ทั้งหมด</Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {friends.slice(0, 9).map(f => (
          <Link key={f.id} href={`/profile/${f.username}`} className="flex flex-col items-center gap-1.5 group">
            <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full aspect-square rounded-2xl object-cover border border-gray-100 group-hover:scale-105 transition-transform shadow-sm" alt="" />
            <p className="text-[9px] font-black text-center truncate w-full text-gray-500 uppercase tracking-tighter">{f.display_name.split(' ')[0]}</p>
          </Link>
        ))}
      </div>
    </div>
  );

  const RelationshipWidget = () => {
    if (!profileUser.relationship_status && familyMembers.length === 0) return null;
    return (
      <div className="card-minimal bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-soft space-y-4">
        <h3 className="font-black text-gray-900 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] mb-1 ml-1"><Heart className="w-3 h-3 text-red-500" /> ความสัมพันธ์</h3>
        {profileUser.relationship_status && (
          <div className="p-3 bg-red-50/30 rounded-2xl border border-red-50">
            <p className="text-[10px] font-black text-red-400 uppercase mb-1">สถานะ</p>
            <p className="text-sm font-bold text-gray-800">
              {profileUser.relationship_status === 'single' ? '👤 โสด' : 
               profileUser.relationship_status === 'in_relationship' ? '❤️ มีแฟนแล้ว' : 
               profileUser.relationship_status === 'engaged' ? '💍 หมั้นแล้ว' : '💒 แต่งงานแล้ว'}
              {profileUser.relationship_custom_name && <span className="text-frog-600"> กับ {profileUser.relationship_custom_name}</span>}
            </p>
          </div>
        )}
        {familyMembers.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">ครอบครัว</p>
            {familyMembers.map((fm) => (
              <Link key={fm.id} href={`/profile/${fm.member.username}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl transition group">
                <img src={fm.member.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-xl object-cover shadow-sm" alt="" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[11px] text-gray-800 truncate">{fm.member.display_name}</p>
                  <p className="text-[9px] text-gray-400 font-black uppercase">{fm.relationship_label}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto px-2 md:px-4 pb-10">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            <div className="card-minimal overflow-hidden p-0 border border-gray-100 shadow-soft bg-white rounded-[2.5rem]">
              <div className="h-40 md:h-64" style={profileUser.cover_img_url ? { backgroundImage: `url(${profileUser.cover_img_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)` }} />
              <div className="p-6 md:p-10">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-8 -mt-28 md:-mt-36 mb-8">
                  <div className="w-36 h-36 md:w-52 md:h-52 rounded-full p-2 shadow-2xl bg-white flex-shrink-0" style={{ borderColor: themeColor, borderWidth: '8px' }}>
                    <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full h-full rounded-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 md:mt-36 flex flex-wrap justify-start md:justify-end gap-3 w-full">
                    {currentUser.id === profileUser.id ? (
                      <Link href="/profile/edit" className="flex-1 md:flex-none justify-center btn-secondary font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl flex items-center gap-2 border border-gray-200 hover:bg-slate-900 hover:text-white transition-all"><Edit size={18} /> แก้ไขโปรไฟล์</Link>
                    ) : (
                      <>
                        <button onClick={handleSendMessage} className="flex-1 md:flex-none justify-center btn-secondary font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl flex items-center gap-2 border border-gray-200 hover:bg-slate-900 hover:text-white transition-all"><MessageCircle size={18} /> ข้อความ</button>
                        {friendshipStatus === 'none' && <button onClick={handleAddFriend} className="flex-1 md:flex-none justify-center btn-primary font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl flex items-center gap-2 bg-frog-500 text-white shadow-lg active:scale-95 transition-all"><UserPlus size={18} /> เพิ่มเพื่อน</button>}
                        {friendshipStatus === 'accepted' && <button className="flex-1 md:flex-none justify-center btn-secondary font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl flex items-center gap-2 border border-frog-200 text-frog-600 bg-frog-50"><UserCheck size={18} /> เป็นเพื่อนแล้ว</button>}
                        {friendshipStatus === 'sent' && <button className="flex-1 md:flex-none justify-center btn-secondary font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl flex items-center gap-2 border border-gray-200 text-gray-400 bg-gray-50" disabled>ส่งคำขอแล้ว</button>}
                      </>
                    )}
                  </div>
                </div>
                
                <div className="space-y-8">
                  <div>
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight mb-2">{profileUser.display_name}</h1>
                    <p className="text-gray-400 font-black uppercase text-[11px] tracking-[0.4em]">@{profileUser.username}</p>
                  </div>
                  {profileUser.bio && <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap break-words border-l-4 border-frog-100 pl-6 text-xl italic">{profileUser.bio}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-[13px] text-gray-500 font-bold uppercase tracking-tight">
                    {profileUser.birthday && <div className="flex items-center gap-3"><Calendar className="w-4 h-4 text-frog-500" /> {formatDate(profileUser.birthday)} ({calculateAge(profileUser.birthday)} ปี)</div>}
                    {profileUser.occupation && <div className="flex items-center gap-3"><Briefcase className="w-4 h-4 text-frog-500" /> {profileUser.occupation}</div>}
                    {profileUser.workplace && <div className="flex items-center gap-3"><HomeIcon className="w-4 h-4 text-frog-500" /> ที่ {profileUser.workplace}</div>}
                    {profileUser.address && <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-red-400" /> {profileUser.address}</div>}
                  </div>

                  {/* --- งานอดิเรก (Hobbies) - Bubble Style --- */}
                  {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
                    <div className="pt-6 border-t border-gray-50">
                      <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">งานอดิเรกและความสนใจ</p>
                      <div className="flex flex-wrap gap-2">
                        {profileUser.hobbies.map((h: any, i: number) => (
                          <span key={i} className="px-5 py-2.5 rounded-full text-[11px] font-black border transition-all hover:scale-105 tracking-wide uppercase shadow-sm" style={{ backgroundColor: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>
                            {typeof h === 'string' ? h : h.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* --- Mobile Only Widgets --- */}
            <div className="lg:hidden space-y-6">
              <MusicWidget />
              <FriendsWidget />
              <RelationshipWidget />
            </div>

            {/* --- Posts Area --- */}
            {(friendshipStatus === 'accepted' || currentUser.id === profileUser.id) ? (
              <div className="space-y-6">
                <CreatePostV3 currentUser={currentUser} targetUser={profileUser} onPostCreated={() => setRefreshTrigger(t => t + 1)} />
                <div className="space-y-6">
                  {posts.length === 0 ? <div className="card-minimal text-center py-20 bg-white/50 rounded-[2.5rem]"><p className="text-gray-300 font-black text-[10px] uppercase tracking-[0.2em]">ยังไม่มีโพสต์</p></div> : posts.map((p, i) => (
                    <div ref={posts.length === i + 1 ? lastPostElementRef : null} key={p.id}><PostCardV3 post={p} currentUserId={currentUser.id} profileOwnerId={profileUser.id} onDelete={(id) => { setPostToDelete(id); setShowDeletePostConfirm(true); }} /></div>
                  ))}
                </div>
              </div>
            ) : <div className="card-minimal bg-white/50 border border-dashed border-gray-200 p-20 text-center rounded-[2.5rem]"><p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.2em]">เป็นเพื่อนเพื่อดูไทม์ไลน์</p></div>}
          </div>

          {/* --- Desktop Sidebar --- */}
          <div className="hidden lg:block w-80 space-y-6">
            <MusicWidget />
            <FriendsWidget />
            <RelationshipWidget />
            <div className="text-center opacity-20"><p className="text-[10px] font-black uppercase tracking-[0.5em]">Ribbi 2026</p></div>
          </div>
        </div>
      </div>
      <ConfirmModal isOpen={showDeletePostConfirm} onClose={() => setShowDeletePostConfirm(false)} onConfirm={async () => { if(postToDelete) { await supabase.from('posts').delete().eq('id', postToDelete); setPosts(prev => prev.filter(p => p.id !== postToDelete)); setShowDeletePostConfirm(false); } }} title="ลบโพสต์?" message="ต้องการลบโพสต์นี้ถาวรใช่หรือไม่" variant="danger" />
    </NavLayout>
  );
}

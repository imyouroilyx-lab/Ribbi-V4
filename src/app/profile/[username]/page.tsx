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
  MessageCircle, Loader2, ExternalLink, Award, Star
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

  if (isLoading && page === 0) return <NavLayout><div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" /><p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">LOADING RIBBI...</p></div></NavLayout>;
  if (!profileUser || !currentUser) return null;

  const themeColor = profileUser.theme_color || '#9de5a8';

  // --- Widgets ---

  const MusicWidget = () => {
    if (!profileUser.music_url) return null;
    return (
      <div className="card-minimal bg-white p-5 rounded-[2rem] border border-gray-100 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}><Music size={20} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">กำลังฟัง</p>
            <p className="text-xs font-black text-gray-900 truncate">{profileUser.music_name || 'My Song'}</p>
          </div>
          <a href={profileUser.music_url} target="_blank" rel="noopener noreferrer" className="p-2.5 text-white rounded-xl transition-all shadow-md active:scale-95" style={{ backgroundColor: themeColor }}><ExternalLink size={16} /></a>
        </div>
      </div>
    );
  };

  const FriendsWidget = () => (
    <div className="card-minimal bg-white p-6 rounded-[2rem] border border-gray-100 shadow-soft">
      <div className="flex items-center justify-between mb-5 px-1">
        <h3 className="font-black text-gray-900 text-[11px] uppercase tracking-[0.2em] flex items-center gap-2"><Users className="w-4 h-4" style={{ color: themeColor }} /> เพื่อน</h3>
        <Link href={`/profile/${profileUser.username}/friends`} className="text-[10px] font-black px-3 py-1.5 rounded-xl uppercase transition-colors" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>ดูทั้งหมด</Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {friends.slice(0, 9).map(f => (
          <Link key={f.id} href={`/profile/${f.username}`} className="flex flex-col items-center gap-2 group">
            <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full aspect-square rounded-2xl object-cover border border-gray-50 group-hover:scale-105 transition-transform shadow-sm" alt="" />
            <p className="text-[10px] font-black text-center truncate w-full text-gray-500 uppercase tracking-tighter">{f.display_name.split(' ')[0]}</p>
          </Link>
        ))}
      </div>
    </div>
  );

  const RelationshipWidget = () => {
    const hasFamily = familyMembers.length > 0;
    const hasCloseFriends = profileUser.close_friends && Array.isArray(profileUser.close_friends) && profileUser.close_friends.length > 0;
    if (!profileUser.relationship_status && !hasFamily && !hasCloseFriends) return null;

    return (
      <div className="card-minimal bg-white p-6 rounded-[2rem] border border-gray-100 shadow-soft space-y-6">
        <h3 className="font-black text-gray-900 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]"><Heart className="w-4 h-4 text-red-500" /> ความสัมพันธ์</h3>
        
        {profileUser.relationship_status && (
          <div className="p-4 rounded-3xl border" style={{ backgroundColor: `${themeColor}05`, borderColor: `${themeColor}15` }}>
            <p className="text-[10px] font-black uppercase mb-1" style={{ color: themeColor }}>สถานะ</p>
            <p className="text-sm font-bold text-gray-800">
              {profileUser.relationship_status === 'single' ? '👤 โสด' : 
               profileUser.relationship_status === 'in_relationship' ? '❤️ มีแฟนแล้ว' : 
               profileUser.relationship_status === 'engaged' ? '💍 หมั้นแล้ว' : '💒 แต่งงานแล้ว'}
              {profileUser.relationship_custom_name && <span className="font-black" style={{ color: themeColor }}> กับ {profileUser.relationship_custom_name}</span>}
            </p>
          </div>
        )}

        {/* ครอบครัว (Family Members) */}
        {hasFamily && (
          <div className="space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">ครอบครัว</p>
            {familyMembers.map((fm) => (
              <Link key={fm.id} href={`/profile/${fm.member.username}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl transition-all">
                <img src={fm.member.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-9 h-9 rounded-xl object-cover shadow-sm" alt="" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-gray-800 truncate">{fm.member.display_name}</p>
                  <p className="text-[9px] text-gray-400 font-black uppercase">{fm.relationship_label}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* เพื่อนสนิท (Close Friends) */}
        {hasCloseFriends && (
          <div className="space-y-3">
            <p className="text-[10px] font-black text-frog-500 uppercase tracking-widest px-1 flex items-center gap-1.5"><Star size={10} fill="currentColor" /> เพื่อนสนิท</p>
            <div className="grid grid-cols-4 gap-2">
              {profileUser.close_friends.map((cf: any, i: number) => (
                <img key={i} src={cf.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full aspect-square rounded-xl object-cover border border-frog-100 shadow-xs" title={cf.display_name} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0 space-y-8">
            
            {/* --- Profile Header V8: รูปบน ชื่อล่าง ไม่เบียดปุ่ม --- */}
            <div className="card-minimal overflow-hidden p-0 border border-gray-100 shadow-soft bg-white rounded-[3rem]">
              <div className="h-44 md:h-72 relative" style={profileUser.cover_img_url ? { backgroundImage: `url(${profileUser.cover_img_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)` }} />
              
              <div className="px-6 md:px-10 pb-8">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 -mt-20 md:-mt-28 relative z-10">
                  
                  {/* Left: Avatar + Name (ย้ายชื่อมาไว้ใต้รูป) */}
                  <div className="flex flex-col items-center lg:items-start gap-4 flex-1">
                    <div className="w-40 h-40 md:w-52 md:h-52 rounded-full p-2 shadow-2xl bg-white border-[8px]" style={{ borderColor: themeColor }}>
                      <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full h-full rounded-full object-cover" alt="" />
                    </div>
                    <div className="text-center lg:text-left space-y-1">
                      <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">{profileUser.display_name}</h1>
                      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                        <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em]">@{profileUser.username}</p>
                        <div className="hidden lg:block w-1 h-1 rounded-full bg-gray-200" />
                        <div className="flex items-center justify-center lg:justify-start gap-1.5 text-[9px] font-black text-gray-300 uppercase tracking-widest">
                          <Award size={10} style={{ color: themeColor }} /> Member since {new Date(profileUser.created_at).getFullYear()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Action Buttons (กะทัดรัด ไม่เบียดชื่อ) */}
                  <div className="flex flex-row gap-2 w-full lg:w-auto justify-center lg:mb-4">
                    {currentUser.id === profileUser.id ? (
                      <Link href="/profile/edit" className="flex-1 lg:flex-none justify-center font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl flex items-center gap-2 text-white shadow-md transition-all hover:scale-105" style={{ backgroundColor: themeColor }}><Edit size={14} /> แก้ไขโปรไฟล์</Link>
                    ) : (
                      <>
                        <button onClick={handleSendMessage} className="flex-1 lg:flex-none justify-center btn-secondary font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl flex items-center gap-2 border border-gray-200 bg-white hover:bg-slate-900 hover:text-white transition-all shadow-sm"><MessageCircle size={14} /> ข้อความ</button>
                        {friendshipStatus === 'none' && <button onClick={handleAddFriend} className="flex-1 lg:flex-none justify-center font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl flex items-center gap-2 text-white shadow-md active:scale-95 transition-all" style={{ backgroundColor: themeColor }}><UserPlus size={14} /> เพิ่มเพื่อน</button>}
                        {friendshipStatus === 'accepted' && <button className="flex-1 lg:flex-none justify-center font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl flex items-center gap-2 border" style={{ backgroundColor: `${themeColor}10`, borderColor: themeColor, color: themeColor }}><UserCheck size={14} /> เพื่อนกันแล้ว</button>}
                      </>
                    )}
                  </div>
                </div>

                {/* Details Area */}
                <div className="mt-10 space-y-8">
                  {profileUser.bio && <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap break-words border-l-4 pl-6 text-lg italic" style={{ borderColor: `${themeColor}20` }}>{profileUser.bio}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-10 text-[12px] text-gray-500 font-bold uppercase tracking-tight">
                    {profileUser.birthday && <div className="flex items-center gap-3"><Calendar className="w-4 h-4" style={{ color: themeColor }} /> เกิด {formatDate(profileUser.birthday)} ({calculateAge(profileUser.birthday)} ปี)</div>}
                    {profileUser.occupation && <div className="flex items-center gap-3"><Briefcase className="w-4 h-4" style={{ color: themeColor }} /> {profileUser.occupation}</div>}
                    {profileUser.workplace && <div className="flex items-center gap-3"><HomeIcon className="w-4 h-4" style={{ color: themeColor }} /> ที่ {profileUser.workplace}</div>}
                    {profileUser.address && <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-red-400" /> {profileUser.address}</div>}
                  </div>

                  {/* Hobbies */}
                  {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
                    <div className="pt-6 border-t border-gray-50 flex flex-wrap gap-2">
                      {profileUser.hobbies.map((h: any, i: number) => (
                        <span key={i} className="px-4 py-2 rounded-full text-[10px] font-black border tracking-wide uppercase" style={{ backgroundColor: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>{typeof h === 'string' ? h : h.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Sidebar */}
            <div className="lg:hidden space-y-8 px-2">
              <MusicWidget />
              <FriendsWidget />
              <RelationshipWidget />
            </div>

            {/* Posts */}
            {(friendshipStatus === 'accepted' || currentUser.id === profileUser.id) ? (
              <div className="space-y-8">
                <CreatePostV3 currentUser={currentUser} targetUser={profileUser} onPostCreated={() => setRefreshTrigger(t => t + 1)} />
                <div className="space-y-8">
                  {posts.length === 0 ? <div className="card-minimal text-center py-20 bg-white/50 rounded-[3rem] border-dashed border-gray-200 border-2"><p className="text-gray-300 font-black text-xs uppercase tracking-[0.3em]">No posts yet</p></div> : posts.map((p, i) => (
                    <div ref={posts.length === i + 1 ? lastPostElementRef : null} key={p.id}><PostCardV3 post={p} currentUserId={currentUser.id} profileOwnerId={profileUser.id} onDelete={(id) => { setPostToDelete(id); setShowDeletePostConfirm(true); }} /></div>
                  ))}
                </div>
              </div>
            ) : <div className="card-minimal bg-white/50 border-2 border-dashed border-gray-200 p-24 text-center rounded-[3rem]"><p className="text-gray-400 font-black text-xs uppercase tracking-[0.3em]">Become friends to see posts</p></div>}
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden lg:block w-[380px] space-y-8">
            <MusicWidget />
            <FriendsWidget />
            <RelationshipWidget />
            <div className="text-center opacity-20 py-10"><p className="text-[10px] font-black uppercase tracking-[0.6em]">Ribbi 2026</p></div>
          </div>
        </div>
      </div>
      <ConfirmModal isOpen={showDeletePostConfirm} onClose={() => setShowDeletePostConfirm(false)} onConfirm={async () => { if(postToDelete) { await supabase.from('posts').delete().eq('id', postToDelete); setPosts(prev => prev.filter(p => p.id !== postToDelete)); setShowDeletePostConfirm(false); } }} title="ลบโพสต์?" message="ต้องการลบโพสต์นี้ถาวรใช่หรือไม่" variant="danger" />
    </NavLayout>
  );
}

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
  MessageCircle, Loader2, ExternalLink, Trash2, Plus, Clock, Eye
} from 'lucide-react';
import Link from 'next/link';
import { calculateAge } from '../../../lib/utils';

const POSTS_PER_PAGE = 10;

interface FamilyMember {
  id: string;
  member_user_id: string;
  relationship_label: string;
  member: User;
}

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
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<User[]>([]);
  
  // ✅ เพิ่ม State ที่หายไปกลับมาให้แล้วครับ
  const [isAddedToFamily, setIsAddedToFamily] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [familyLabel, setFamilyLabel] = useState('');
  const [showFamilyDeleteConfirm, setShowFamilyDeleteConfirm] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<string | null>(null);
  
  // ✅ เพิ่ม State สำหรับ Modal ลบเพื่อน
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);

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

      const [currentUserRes, postsRes, familyRes, friendsRes, friendStatusRes, checkFamilyRes, viewsRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('posts').select('*, author:author_id(*), target:target_id(*)').eq('target_id', profileData.id).order('created_at', { ascending: false }).range(0, POSTS_PER_PAGE - 1),
        supabase.from('family_members').select('*, member:member_user_id(*)').eq('user_id', profileData.id),
        supabase.from('friendships').select('*, sender:sender_id(*), receiver:receiver_id(*)').eq('status', 'accepted').or(`sender_id.eq.${profileData.id},receiver_id.eq.${profileData.id}`).order('created_at', { ascending: false }).limit(6),
        supabase.from('friendships').select('*').or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${profileData.id}),and(sender_id.eq.${profileData.id},receiver_id.eq.${authUser.id})`).maybeSingle(),
        supabase.from('family_members').select('id').eq('user_id', authUser.id).eq('member_user_id', profileData.id).maybeSingle(),
        supabase.from('profile_views').select('visitor_id, viewed_at, visitor:visitor_id(id, username, display_name, profile_img_url)').eq('profile_id', profileData.id).order('viewed_at', { ascending: false }).limit(20)
      ]);

      setCurrentUser(currentUserRes.data);
      setPosts(postsRes.data || []);
      setHasMore((postsRes.data?.length || 0) === POSTS_PER_PAGE);
      setFamilyMembers(familyRes.data || []);
      setFriends((friendsRes.data || []).map((f: any) => f.sender_id === profileData.id ? f.receiver : f.sender));
      
      // อัปเดตสถานะ isAddedToFamily ว่าเราเพิ่มคนนี้เป็นคนสำคัญหรือยัง
      setIsAddedToFamily(!!checkFamilyRes.data);

      if (friendStatusRes.data) {
        setFriendshipId(friendStatusRes.data.id); // เก็บ ID ไว้เผื่อใช้ลบเพื่อน
        if (friendStatusRes.data.status === 'accepted') setFriendshipStatus('accepted');
        else if (friendStatusRes.data.sender_id === authUser.id) setFriendshipStatus('sent');
        else setFriendshipStatus('pending');
      } else { 
        setFriendshipId(null);
        setFriendshipStatus('none'); 
      }

      // กรองคนเข้าชมซ้ำ เอาแค่ 5 คน
      const viewsData = viewsRes.data || [];
      const uniqueVisitors: any[] = [];
      const seenIds = new Set();
      
      for (const row of viewsData) {
        if (row.visitor && !seenIds.has(row.visitor_id)) {
          seenIds.add(row.visitor_id);
          uniqueVisitors.push(row.visitor);
          if (uniqueVisitors.length === 5) break; 
        }
      }
      setRecentVisitors(uniqueVisitors);

      // นับ View
      const viewKey = `v_${profileData.id}`;
      if (!sessionStorage.getItem(viewKey) && authUser.id !== profileData.id) {
        await supabase.from('profile_views').insert({ profile_id: profileData.id, visitor_id: authUser.id });
        sessionStorage.setItem(viewKey, '1');
      }

    } catch (err) { console.error(err); } 
    finally { setIsLoading(false); }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || !profileUser) return;
    setIsLoadingMore(true);
    const start = page * POSTS_PER_PAGE;
    const { data } = await supabase.from('posts').select('*, author:author_id(*), target:target_id(*)').eq('target_id', profileUser.id).order('created_at', { ascending: false }).range(start, start + POSTS_PER_PAGE - 1);
    if (data && data.length > 0) {
      setPosts(prev => [...prev, ...data]);
      setHasMore(data.length === POSTS_PER_PAGE);
    } else { setHasMore(false); }
    setIsLoadingMore(false);
  };

  const handleSendMessage = async () => {
    if (!currentUser || !profileUser) return;
    try {
      const { data: chatId, error } = await supabase.rpc('get_or_create_dm', { uid_a: currentUser.id, uid_b: profileUser.id });
      if (error) throw error;
      router.push(`/messages?chat=${chatId}`);
    } catch (err) { router.push('/messages'); }
  };

  const handleAddFriend = async () => {
    if (!currentUser || !profileUser) return;
    const { data } = await supabase.from('friendships').insert({ sender_id: currentUser.id, receiver_id: profileUser.id, status: 'pending' }).select().single();
    if (data) { 
      setFriendshipId(data.id); 
      setFriendshipStatus('sent'); 
    }
  };

  // ✅ ฟังก์ชันใหม่สำหรับลบเพื่อน (Unfriend)
  const handleRemoveFriend = async () => {
    if (!friendshipId) return;
    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      setFriendshipStatus('none');
      setFriendshipId(null);
      setShowUnfriendConfirm(false);
      setRefreshTrigger(t => t + 1); // รีเฟรชหน้าเพื่อเอาโพสต์ของเพื่อนออกและอัปเดต Widget
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  const handleAddFamilyMember = async () => {
    if (!currentUser || !profileUser || !familyLabel.trim()) return;
    const { error } = await supabase.from('family_members').insert({
      user_id: currentUser.id,
      member_user_id: profileUser.id,
      relationship_label: familyLabel.trim()
    });
    if (!error) {
      setShowAddFamilyModal(false);
      setFamilyLabel('');
      setIsAddedToFamily(true);
      setRefreshTrigger(t => t + 1);
    }
  };

  const handleRemoveFamilyMember = async () => {
    if (!familyToDelete) return;
    await supabase.from('family_members').delete().eq('id', familyToDelete);
    setFamilyMembers(prev => prev.filter(fm => fm.id !== familyToDelete));
    setShowFamilyDeleteConfirm(false);
  };

  if (isLoading || !profileUser || !currentUser) return (
    <NavLayout>
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" />
        <p className="text-gray-500 font-bold text-xs uppercase tracking-wide">LOADING RIBBI...</p>
      </div>
    </NavLayout>
  );

  const themeColor = profileUser.theme_color || '#9de5a8';
  const isOwnProfile = currentUser.id === profileUser.id;

  // --- Widgets ---
  const MusicWidget = () => {
    if (!profileUser.music_url) return null;
    return (
      <div className="card-minimal bg-white p-6 rounded-[2.5rem] border border-gray-100 flex items-center gap-4 transition-all shadow-sm">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
          <Music size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-500 mb-0.5">กำลังฟัง</p>
          <p className="text-sm font-black text-gray-900 truncate">{profileUser.music_name || 'My Song'}</p>
        </div>
        <a href={profileUser.music_url} target="_blank" rel="noopener noreferrer" className="p-2.5 text-white rounded-xl shadow-sm transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: themeColor }}>
          <ExternalLink size={16} />
        </a>
      </div>
    );
  };

  const RecentVisitorsWidget = () => {
    if (recentVisitors.length === 0) return null;
    return (
      <div className="card-minimal bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-5">
        <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-500" /> ผู้เข้าชมล่าสุด
        </h3>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {recentVisitors.map((v, i) => (
            <Link key={i} href={`/profile/${v.username}`} className="group flex flex-col items-center gap-1.5 flex-shrink-0 w-16 transition-all hover:scale-105">
              <img src={v.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-full object-cover shadow-sm border border-gray-100" />
              <p className="text-[10px] font-black text-center truncate w-full text-gray-500 uppercase group-hover:text-gray-900">{v.display_name.split(' ')[0]}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  const FriendsWidget = () => (
    <div className="card-minimal bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-gray-900 text-sm flex items-center gap-2"><Users className="w-5 h-5" style={{ color: themeColor }} /> เพื่อนล่าสุด</h3>
        <Link href={`/profile/${profileUser.username}/friends`} className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-50 text-gray-600 border border-gray-100">ดูทั้งหมด</Link>
      </div>
      {friends.length === 0 ? (
        <p className="text-sm text-center text-gray-500 font-bold py-4">ยังไม่มีเพื่อน</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {friends.map(f => (
            <Link key={f.id} href={`/profile/${f.username}`} className="group flex flex-col items-center gap-2 transition-all hover:scale-105">
              <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-gray-100" />
              <p className="text-xs font-bold text-center truncate w-full text-gray-700 group-hover:text-gray-900">{f.display_name.split(' ')[0]}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  const RelationshipWidget = () => {
    const hasFamily = familyMembers.length > 0;
    if (!profileUser.relationship_status && !hasFamily) return null;

    return (
      <div className="card-minimal bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
        <h3 className="font-black text-gray-900 flex items-center gap-2 text-sm"><Heart className="w-5 h-5 text-red-500" /> ความสัมพันธ์</h3>
        
        {profileUser.relationship_status && (
          <div className="p-4 rounded-2xl border" style={{ backgroundColor: `${themeColor}05`, borderColor: `${themeColor}15` }}>
            <p className="text-[11px] font-bold mb-1" style={{ color: themeColor }}>สถานะหัวใจ</p>
            <p className="text-sm font-black text-gray-800 break-words">
              {profileUser.relationship_status === 'single' ? 'โสด' : 
               profileUser.relationship_status === 'in_relationship' ? 'มีแฟนแล้ว' : 
               profileUser.relationship_status === 'married' ? 'แต่งงานแล้ว' : 
               profileUser.relationship_status === 'divorced' ? 'หย่าร้าง' : 'หมั้นแล้ว'}
              {profileUser.relationship_custom_name && <span className="font-black" style={{ color: themeColor }}> กับ {profileUser.relationship_custom_name}</span>}
            </p>
          </div>
        )}

        {hasFamily && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 px-1">ครอบครัวและคนสำคัญ</p>
            <div className="space-y-2">
              {familyMembers.map((fm) => (
                <div key={fm.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl group transition-all hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100">
                  <img src={fm.member?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${fm.member?.username}`} className="font-bold text-sm hover:underline block truncate text-gray-900">{fm.member?.display_name}</Link>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">{fm.relationship_label}</p>
                  </div>
                  {isOwnProfile && <button onClick={() => { setFamilyToDelete(fm.id); setShowFamilyDeleteConfirm(true); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-24">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          
          {/* --- Main Content Area --- */}
          <div className="flex-1 min-w-0 space-y-6 lg:space-y-8">
            
            {/* Profile Header */}
            <div className="card-minimal overflow-hidden p-0 border border-gray-100 shadow-sm bg-white rounded-[3rem]">
              
              <div className="h-48 md:h-72 relative bg-gray-100" style={profileUser.cover_img_url ? { backgroundImage: `url(${profileUser.cover_img_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)` }}>
                <div className="absolute inset-x-0 bottom-0 h-32 md:h-48 bg-gradient-to-t from-white via-white/70 to-transparent"></div>
              </div>
              
              <div className="px-6 md:px-10 pb-8 bg-white relative z-10">
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-20 md:-mt-24 relative z-20 mb-4">
                  <div className="w-36 h-36 md:w-48 md:h-48 rounded-full p-2 shadow-2xl bg-white flex-shrink-0 mx-auto md:mx-0 border-4 md:border-[6px]" style={{ borderColor: themeColor }}>
                    <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full h-full rounded-full object-cover shadow-inner bg-gray-50" />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 pb-2">
                    {isOwnProfile ? (
                      <Link href="/profile/edit" className="font-black text-xs px-5 py-3 rounded-xl flex items-center gap-2 text-white shadow-md hover:opacity-90 transition-all" style={{ backgroundColor: themeColor }}><Edit size={16} /> แก้ไขโปรไฟล์</Link>
                    ) : (
                      <>
                        <button onClick={handleSendMessage} className="font-black text-xs px-5 py-3 rounded-xl flex items-center gap-2 border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 transition-all shadow-sm"><MessageCircle size={16} /> ข้อความ</button>
                        
                        {!isOwnProfile && friendshipStatus === 'accepted' && !isAddedToFamily && (
                          <button onClick={() => setShowAddFamilyModal(true)} className="font-black text-xs px-5 py-3 rounded-xl border flex items-center gap-2 transition-all shadow-sm active:scale-95" style={{ backgroundColor: `${themeColor}10`, color: themeColor, borderColor: themeColor }}><Plus size={16} /> เพิ่มคนสำคัญ</button>
                        )}
                        
                        {friendshipStatus === 'none' && (
                          <button onClick={handleAddFriend} className="text-white font-black text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-md hover:opacity-90 transition-all active:scale-95" style={{ backgroundColor: themeColor }}><UserPlus size={16} /> เพิ่มเพื่อน</button>
                        )}
                        {friendshipStatus === 'sent' && (
                          <button className="px-5 py-3 rounded-xl bg-gray-50 text-gray-500 font-black text-xs flex items-center gap-2 cursor-default border border-gray-200"><Clock size={16} /> ส่งคำขอแล้ว</button>
                        )}
                        {/* ✅ ปุ่มเพื่อนกันแล้ว (สามารถกดเพื่อลบเพื่อนได้) */}
                        {friendshipStatus === 'accepted' && (
                          <button 
                            onClick={() => setShowUnfriendConfirm(true)} 
                            className="px-5 py-3 rounded-xl border font-black text-xs flex items-center gap-2 bg-gray-50 text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm active:scale-95"
                          >
                            <UserCheck size={16} /> เพื่อนกัน
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="text-center md:text-left space-y-1 relative z-20">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-none mb-2">{profileUser.display_name}</h1>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm font-bold text-gray-500">
                    <span>@{profileUser.username}</span>
                    <span className="hidden md:inline-block w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                    <span className="flex items-center gap-1.5"><Calendar size={16} style={{ color: themeColor }} /> วันที่สมัคร {formatDate(profileUser.created_at)}</span>
                  </div>
                </div>

                <div className="mt-8 space-y-8">
                  {profileUser.bio && (
                    <div className="border-l-4 pl-4 py-1" style={{ borderColor: themeColor }}>
                      <p className="text-gray-800 font-medium whitespace-pre-wrap break-words text-base leading-relaxed">
                        {profileUser.bio}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-bold text-gray-700">
                    {profileUser.birthday && <div className="flex items-center gap-3"><Calendar className="w-5 h-5 text-frog-500" /> เกิดวันที่ {formatDate(profileUser.birthday)} (อายุ {calculateAge(profileUser.birthday)} ปี)</div>}
                    {profileUser.occupation && <div className="flex items-center gap-3"><Briefcase className="w-5 h-5 text-frog-500" /> {profileUser.occupation}</div>}
                    {profileUser.workplace && <div className="flex items-center gap-3"><HomeIcon className="w-5 h-5 text-frog-500" /> ทำงานที่ {profileUser.workplace}</div>}
                    {profileUser.address && <div className="flex items-center gap-3"><MapPin className="w-5 h-5 text-red-500" /> {profileUser.address}</div>}
                  </div>

                  {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
                    <div className="pt-6 border-t border-gray-100">
                      <p className="text-xs font-bold text-gray-500 mb-3">สิ่งที่สนใจ</p>
                      <div className="flex flex-wrap gap-2">
                        {profileUser.hobbies.map((h: any, i: number) => (
                          <span key={i} className="px-4 py-2 rounded-xl text-xs font-bold border transition-transform hover:-translate-y-0.5 shadow-sm" style={{ backgroundColor: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>
                            {typeof h === 'string' ? h : h.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile-only Widgets */}
            <div className="lg:hidden space-y-6">
              <MusicWidget />
              <RecentVisitorsWidget />
              <FriendsWidget />
              <RelationshipWidget />
            </div>

            {/* Posts Feed */}
            {(friendshipStatus === 'accepted' || isOwnProfile) ? (
              <div className="space-y-6 lg:space-y-8">
                <CreatePostV3 currentUser={currentUser} targetUser={profileUser} onPostCreated={() => setRefreshTrigger(t => t + 1)} />
                <div className="space-y-6 lg:space-y-8">
                  {posts.length === 0 ? <div className="card-minimal text-center py-20 bg-white/50 rounded-[3rem] border-dashed border-gray-200 border-2"><p className="text-gray-400 font-bold text-sm">ยังไม่มีโพสต์ให้แสดง</p></div> : 
                    posts.map((p) => (<PostCardV3 key={p.id} post={p} currentUserId={currentUser.id} profileOwnerId={profileUser.id} onDelete={() => {}} />))}
                  {isLoadingMore && <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}
                </div>
              </div>
            ) : <div className="card-minimal bg-white/50 border-2 border-dashed border-gray-200 p-20 text-center rounded-[3rem] text-gray-500 font-bold">เพิ่มเพื่อนเพื่อดูโพสต์ของ {profileUser.display_name}</div>}
          </div>

          {/* --- Right Sidebar (Desktop) --- */}
          <div className="hidden lg:flex flex-col w-[320px] xl:w-[340px] flex-shrink-0 space-y-6">
            <MusicWidget />
            <RecentVisitorsWidget />
            <FriendsWidget />
            <RelationshipWidget />
            <div className="text-center py-8"><p className="text-xs font-bold text-gray-300">Ribbi Community 2026</p></div>
          </div>

        </div>
      </div>

      {/* Modal: เพิ่มคนสำคัญ */}
      {showAddFamilyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl p-8 text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-frog-50 text-frog-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4"><Heart size={32} /></div>
            <h2 className="text-xl font-black text-gray-900 mb-2">เพิ่มคนสำคัญ</h2>
            <p className="text-sm text-gray-500 font-medium mb-6">ระบุความสัมพันธ์ที่จะแสดงที่หน้าโปรไฟล์ของคุณ</p>
            <input type="text" value={familyLabel} onChange={(e) => setFamilyLabel(e.target.value)} placeholder="เช่น พี่ชาย, เพื่อนสนิท" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-base font-bold mb-6 focus:ring-2 focus:ring-frog-500 outline-none" autoFocus />
            <div className="flex gap-3">
              <button onClick={handleAddFamilyMember} className="flex-1 py-3 rounded-xl font-bold text-white shadow-md transition-opacity hover:opacity-90" style={{ backgroundColor: themeColor }}>บันทึก</button>
              <button onClick={() => setShowAddFamilyModal(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold transition-colors hover:bg-gray-200">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={showFamilyDeleteConfirm} onClose={() => setShowFamilyDeleteConfirm(false)} onConfirm={handleRemoveFamilyMember} title="ลบข้อมูล?" message="คุณแน่ใจนะว่าจะลบความสัมพันธ์นี้?" variant="danger" />
      
      {/* ✅ Modal: ยืนยันการลบเพื่อน */}
      <ConfirmModal 
        isOpen={showUnfriendConfirm} 
        onClose={() => setShowUnfriendConfirm(false)} 
        onConfirm={handleRemoveFriend} 
        title="เลิกเป็นเพื่อน?" 
        message={`คุณต้องการเลิกเป็นเพื่อนกับ ${profileUser?.display_name} ใช่หรือไม่? หากเลิกเป็นเพื่อนคุณจะไม่เห็นโพสต์ของกันและกันอีกต่อไป`} 
        variant="danger" 
        confirmText="เลิกเป็นเพื่อน"
      />
      
      <ConfirmModal isOpen={showDeletePostConfirm} onClose={() => setShowDeletePostConfirm(false)} onConfirm={async () => { if(postToDelete) { await supabase.from('posts').delete().eq('id', postToDelete); setPosts(prev => prev.filter(p => p.id !== postToDelete)); setShowDeletePostConfirm(false); } }} title="ลบโพสต์?" message="ต้องการลบโพสต์นี้ถาวรใช่หรือไม่" variant="danger" />
    </NavLayout>
  );
}

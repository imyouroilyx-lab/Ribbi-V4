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
  MessageCircle, Loader2, ExternalLink, Trash2, Plus, Clock
} from 'lucide-react';
import Link from 'next/link';
import { calculateAge } from '../../../lib/utils';

interface FamilyMember {
  id: string;
  member_user_id: string;
  relationship_label: string;
  member: User;
}

// ✅ จัดรูปแบบวันที่ให้เป็น dd-mm-yyyy ทั้งหมด
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
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAddedToFamily, setIsAddedToFamily] = useState(false);

  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [familyLabel, setFamilyLabel] = useState('');
  const [showFamilyDeleteConfirm, setShowFamilyDeleteConfirm] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<string | null>(null);

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

      // ✅ ดึงเพื่อน 6 คนล่าสุด (order by created_at descending)
      const [currentUserRes, postsRes, familyRes, friendsRes, friendStatusRes, checkFamilyRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('posts').select('*, author:author_id(*), target:target_id(*)').eq('target_id', profileData.id).order('created_at', { ascending: false }).range(0, POSTS_PER_PAGE - 1),
        supabase.from('family_members').select('*, member:member_user_id(*)').eq('user_id', profileData.id),
        supabase.from('friendships').select('*, sender:sender_id(*), receiver:receiver_id(*)').eq('status', 'accepted').or(`sender_id.eq.${profileData.id},receiver_id.eq.${profileData.id}`).order('created_at', { ascending: false }).limit(6),
        supabase.from('friendships').select('*').or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${profileData.id}),and(sender_id.eq.${profileData.id},receiver_id.eq.${authUser.id})`).maybeSingle(),
        supabase.from('family_members').select('id').eq('user_id', authUser.id).eq('member_user_id', profileData.id).maybeSingle()
      ]);

      setCurrentUser(currentUserRes.data);
      setPosts(postsRes.data || []);
      setHasMore((postsRes.data?.length || 0) === POSTS_PER_PAGE);
      setFamilyMembers(familyRes.data || []);
      setFriends((friendsRes.data || []).map((f: any) => f.sender_id === profileData.id ? f.receiver : f.sender));
      setIsAddedToFamily(!!checkFamilyRes.data);

      if (friendStatusRes.data) {
        if (friendStatusRes.data.status === 'accepted') setFriendshipStatus('accepted');
        else if (friendStatusRes.data.sender_id === authUser.id) setFriendshipStatus('sent');
        else setFriendshipStatus('pending');
      } else { setFriendshipStatus('none'); }

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
    await supabase.from('friendships').insert({ sender_id: currentUser.id, receiver_id: profileUser.id, status: 'pending' });
    setFriendshipStatus('sent');
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
              <div className="h-48 md:h-72 relative" style={profileUser.cover_img_url ? { backgroundImage: `url(${profileUser.cover_img_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)` }} />
              
              <div className="px-6 md:px-10 pb-8">
                {/* ✅ เปลี่ยนเป็น Flexbox ที่จัดเรียง Avatar และ Info ไปทางซ้าย ส่วนปุ่มไปทางขวา */}
                <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-20 md:-mt-24 relative z-10">
                  
                  {/* Avatar */}
                  <div className="w-36 h-36 md:w-48 md:h-48 rounded-full p-2 shadow-xl bg-white flex-shrink-0 mx-auto md:mx-0 border-4 md:border-[6px]" style={{ borderColor: themeColor }}>
                    <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full h-full rounded-full object-cover shadow-inner" />
                  </div>
                  
                  {/* Text & Action Buttons Wrapper */}
                  <div className="flex-1 flex flex-col gap-4 text-center md:text-left mb-2 md:mb-4">
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-none">{profileUser.display_name}</h1>
                    
                    {/* ✅ Flexbox สำหรับ @username, วันที่สมัคร และ ปุ่มต่างๆ */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm font-bold text-gray-600">
                        <span>@{profileUser.username}</span>
                        <span className="hidden md:inline-block w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                        <span className="flex items-center gap-1.5"><Calendar size={16} style={{ color: themeColor }} /> วันที่สมัคร {formatDate(profileUser.created_at)}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
                        {isOwnProfile ? (
                          <Link href="/profile/edit" className="font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 text-white shadow-md hover:opacity-90 transition-all" style={{ backgroundColor: themeColor }}><Edit size={16} /> แก้ไขโปรไฟล์</Link>
                        ) : (
                          <>
                            <button onClick={handleSendMessage} className="font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 transition-all shadow-sm"><MessageCircle size={16} /> ข้อความ</button>
                            
                            {!isOwnProfile && friendshipStatus === 'accepted' && !isAddedToFamily && (
                              <button onClick={() => setShowAddFamilyModal(true)} className="font-black text-xs px-5 py-2.5 rounded-xl border flex items-center gap-2 transition-all shadow-sm" style={{ backgroundColor: `${themeColor}10`, color: themeColor, borderColor: themeColor }}><Plus size={16} /> เพิ่มคนสำคัญ</button>
                            )}
                            
                            {friendshipStatus === 'none' && (
                              <button onClick={handleAddFriend} className="text-white font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:opacity-90 transition-all" style={{ backgroundColor: themeColor }}><UserPlus size={16} /> เพิ่มเพื่อน</button>
                            )}
                            {friendshipStatus === 'sent' && (
                              <button className="px-5 py-2.5 rounded-xl bg-gray-50 text-gray-500 font-black text-xs flex items-center gap-2 cursor-default border border-gray-200"><Clock size={16} /> ส่งคำขอแล้ว</button>
                            )}
                            {friendshipStatus === 'accepted' && (
                              <button className="px-5 py-2.5 rounded-xl border font-black text-xs flex items-center gap-2 cursor-default bg-gray-50 text-gray-600 border-gray-200"><UserCheck size={16} /> เพื่อนกัน</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-8">
                  {/* ✅ Bio หลายบรรทัด ตัวหนังสือชัดเจน ไม่เว้นห่าง */}
                  {profileUser.bio && (
                    <div className="border-l-4 pl-4 py-1" style={{ borderColor: themeColor }}>
                      <p className="text-gray-800 font-medium whitespace-pre-wrap break-words text-base leading-relaxed">
                        {profileUser.bio}
                      </p>
                    </div>
                  )}

                  {/* ✅ ข้อมูลส่วนตัว Grid (กู้สถานที่ทำงานกลับมา) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-bold text-gray-700">
                    {profileUser.birthday && <div className="flex items-center gap-3"><Calendar className="w-5 h-5 text-frog-500" /> เกิดวันที่ {formatDate(profileUser.birthday)} (อายุ {calculateAge(profileUser.birthday)} ปี)</div>}
                    {profileUser.occupation && <div className="flex items-center gap-3"><Briefcase className="w-5 h-5 text-frog-500" /> {profileUser.occupation}</div>}
                    {profileUser.workplace && <div className="flex items-center gap-3"><HomeIcon className="w-5 h-5 text-frog-500" /> ทำงานที่ {profileUser.workplace}</div>}
                    {profileUser.address && <div className="flex items-center gap-3"><MapPin className="w-5 h-5 text-red-500" /> {profileUser.address}</div>}
                  </div>

                  {/* ✅ งานอดิเรกเป็นบับเบิ้ลเฉยๆ ไม่มี # */}
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
    </NavLayout>
  );
}

'use client';

import { useState, useEffect } from 'react';
// แก้ไข Path จาก @/ เป็น Relative Path เพื่อให้ Build ผ่าน
import { supabase, type User, type Post } from '../../../lib/supabase'; 
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '../../../components/NavLayout';
import PostCardV3 from '../../../components/PostCardV3';
import CreatePostV3 from '../../../components/CreatePostV3';
import ConfirmModal from '../../../components/ConfirmModal';
import { 
  MapPin, Calendar, Briefcase, Home as HomeIcon, 
  Edit, UserPlus, UserCheck, Heart, Users, Music, 
  MessageCircle, Loader2, ExternalLink, Award, Star, Trash2, Plus, Clock
} from 'lucide-react';
import Link from 'next/link';
import { calculateAge } from '../../../lib/utils';

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
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted' | 'sent'>('none');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modals
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [familyLabel, setFamilyLabel] = useState('');
  const [showFamilyDeleteConfirm, setShowFamilyDeleteConfirm] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<string | null>(null);

  useEffect(() => { loadInitialData(); }, [username, refreshTrigger]);

  const loadInitialData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const { data: profileData } = await supabase.from('users').select('*').eq('username', username).single();
      if (!profileData) { router.push('/'); return; }
      setProfileUser(profileData);

      const [currentUserRes, postsRes, familyRes, friendsRes, friendStatusRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('posts').select('*, author:author_id(*), target:target_id(*)').eq('target_id', profileData.id).order('created_at', { ascending: false }),
        supabase.from('family_members').select('*, member:member_user_id(*)').eq('user_id', profileData.id),
        supabase.from('friendships').select('*, sender:sender_id(*), receiver:receiver_id(*)').eq('status', 'accepted').or(`sender_id.eq.${profileData.id},receiver_id.eq.${profileData.id}`).order('created_at', { ascending: false }).limit(9),
        supabase.from('friendships').select('*').or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${profileData.id}),and(sender_id.eq.${profileData.id},receiver_id.eq.${authUser.id})`).maybeSingle()
      ]);

      setCurrentUser(currentUserRes.data);
      setPosts(postsRes.data || []);
      setFamilyMembers(familyRes.data || []);
      setFriends((friendsRes.data || []).map((f: any) => f.sender_id === profileData.id ? f.receiver : f.sender));

      if (friendStatusRes.data) {
        if (friendStatusRes.data.status === 'accepted') setFriendshipStatus('accepted');
        else if (friendStatusRes.data.sender_id === authUser.id) setFriendshipStatus('sent');
        else setFriendshipStatus('pending');
      } else { setFriendshipStatus('none'); }
    } catch (err) { console.error('Error loading profile:', err); } 
    finally { setIsLoading(false); }
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
    await supabase.from('family_members').insert({
      user_id: currentUser.id,
      member_user_id: profileUser.id,
      relationship_label: familyLabel.trim()
    });
    setShowAddFamilyModal(false);
    setFamilyLabel('');
    setRefreshTrigger(t => t + 1);
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
        <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">LOADING PROFILE...</p>
      </div>
    </NavLayout>
  );

  const themeColor = profileUser.theme_color || '#9de5a8';
  const isOwnProfile = currentUser.id === profileUser.id;

  const RelationshipWidget = () => {
    const hasFamily = familyMembers.length > 0;
    const hasCloseFriends = profileUser.close_friends && Array.isArray(profileUser.close_friends) && profileUser.close_friends.length > 0;
    if (!profileUser.relationship_status && !hasFamily && !hasCloseFriends) return null;

    return (
      <div className="card-minimal bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-soft space-y-6">
        <h3 className="font-black text-gray-900 flex items-center gap-2 text-[11px] uppercase tracking-widest"><Heart className="w-4 h-4 text-red-500" /> ความสัมพันธ์</h3>
        {profileUser.relationship_status && (
          <div className="p-4 rounded-2xl border" style={{ backgroundColor: `${themeColor}05`, borderColor: `${themeColor}15` }}>
            <p className="text-[10px] font-black uppercase mb-1" style={{ color: themeColor }}>สถานะปัจจุบัน</p>
            <p className="text-sm font-bold text-gray-800">
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
            <p className="text-[10px] font-black text-gray-400 uppercase px-1">ครอบครัวและคนสำคัญ</p>
            {familyMembers.map((fm) => (
              <div key={fm.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-2xl group transition-all">
                <img src={fm.member?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-9 h-9 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${fm.member?.username}`} className="font-bold text-xs hover:underline block truncate text-gray-800">{fm.member?.display_name}</Link>
                  <p className="text-[9px] text-gray-400 font-black uppercase">{fm.relationship_label}</p>
                </div>
                {isOwnProfile && <button onClick={() => { setFamilyToDelete(fm.id); setShowFamilyDeleteConfirm(true); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <NavLayout>
      {/* ✅ ขยายความกว้าง Desktop เป็น 1440px ตามสั่ง */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 pb-20">
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1 min-w-0 space-y-8">
            {/* Profile Header */}
            <div className="card-minimal overflow-hidden p-0 border border-gray-100 shadow-soft bg-white rounded-[3.5rem]">
              <div className="h-52 md:h-80 relative" style={profileUser.cover_img_url ? { backgroundImage: `url(${profileUser.cover_img_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)` }} />
              <div className="px-8 md:px-12 pb-10">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 -mt-24 md:-mt-32 relative z-10">
                  <div className="flex flex-col items-center lg:items-start gap-5 flex-1">
                    <div className="w-44 h-44 md:w-60 md:h-60 rounded-full p-2.5 shadow-2xl bg-white border-[10px]" style={{ borderColor: themeColor }}>
                      <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div className="text-center lg:text-left space-y-2">
                      <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">{profileUser.display_name}</h1>
                      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        {/* ✅ @username ใหญ่ขึ้น + lowercase ตามสั่ง */}
                        <p className="text-gray-400 font-bold text-base md:text-xl lowercase">@{profileUser.username}</p>
                        <div className="hidden lg:block w-1.5 h-1.5 rounded-full bg-gray-200 mx-2" />
                        <div className="flex items-center justify-center lg:justify-start gap-2 text-[11px] font-black text-gray-300 uppercase tracking-widest">
                          <Award size={14} style={{ color: themeColor }} /> Since {new Date(profileUser.created_at).getFullYear()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row flex-wrap gap-3 justify-center lg:mb-6">
                    {isOwnProfile ? (
                      <Link href="/profile/edit" className="flex-1 lg:flex-none justify-center font-black text-[11px] uppercase tracking-widest px-10 py-4 rounded-2xl flex items-center gap-2 text-white shadow-xl hover:scale-105 transition-all" style={{ backgroundColor: themeColor }}><Edit size={18} /> แก้ไขโปรไฟล์</Link>
                    ) : (
                      <>
                        <button onClick={handleSendMessage} className="flex-1 lg:flex-none justify-center btn-secondary font-black text-[11px] uppercase tracking-widest px-10 py-4 rounded-2xl flex items-center gap-2 border border-gray-200 bg-white hover:bg-slate-900 hover:text-white transition-all shadow-md"><MessageCircle size={18} /> ข้อความ</button>
                        {!isOwnProfile && friendshipStatus === 'accepted' && (
                          <button onClick={() => setShowAddFamilyModal(true)} className="px-8 py-4 rounded-2xl border font-black text-[11px] uppercase flex items-center gap-2 transition-all hover:scale-105 shadow-sm" style={{ backgroundColor: `${themeColor}15`, color: themeColor, borderColor: themeColor }}><Plus size={18} /> เพิ่มคนสำคัญ</button>
                        )}
                        {/* ✅ แสดงสถานะ "ส่งคำขอเป็นเพื่อนแล้ว" */}
                        {friendshipStatus === 'none' && (
                          <button onClick={handleAddFriend} className="px-10 py-4 rounded-2xl text-white font-black text-[11px] uppercase flex items-center gap-2 shadow-xl hover:scale-105 transition-all" style={{ backgroundColor: themeColor }}><UserPlus size={18} /> เพิ่มเพื่อน</button>
                        )}
                        {friendshipStatus === 'sent' && (
                          <button className="px-10 py-4 rounded-2xl bg-gray-100 text-gray-400 font-black text-[11px] uppercase flex items-center gap-2 cursor-default border border-gray-200"><Clock size={18} /> ส่งคำขอแล้ว</button>
                        )}
                        {friendshipStatus === 'accepted' && (
                          <button className="px-10 py-4 rounded-2xl border font-black text-[11px] uppercase flex items-center gap-2" style={{ backgroundColor: `${themeColor}10`, borderColor: themeColor, color: themeColor }}><UserCheck size={18} /> เพื่อนกันแล้ว</button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-12 space-y-10">
                  {profileUser.bio && <p className="text-gray-600 font-medium leading-relaxed border-l-8 pl-8 text-xl md:text-2xl italic" style={{ borderColor: `${themeColor}20` }}>{profileUser.bio}</p>}
                  
                  {profileUser.music_url && (
                    <div className="card-minimal bg-white p-6 rounded-3xl border border-gray-100 flex items-center gap-5 transition-all hover:scale-[1.01] shadow-soft">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}><Music size={28} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">กำลังฟัง</p>
                        <p className="text-base font-black text-gray-900 truncate">{profileUser.music_name}</p>
                      </div>
                      <a href={profileUser.music_url} target="_blank" className="p-3.5 text-white rounded-2xl shadow-lg transition-all hover:opacity-90" style={{ backgroundColor: themeColor }}><ExternalLink size={20} /></a>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12 text-[14px] text-gray-500 font-bold uppercase tracking-tight">
                    {profileUser.birthday && <div className="flex items-center gap-4"><Calendar className="w-5 h-5" style={{ color: themeColor }} /> {formatDate(profileUser.birthday)} ({calculateAge(profileUser.birthday)} ปี)</div>}
                    {profileUser.occupation && <div className="flex items-center gap-4"><Briefcase className="w-5 h-5" style={{ color: themeColor }} /> {profileUser.occupation}</div>}
                    {profileUser.workplace && <div className="flex items-center gap-4"><HomeIcon className="w-5 h-5" style={{ color: themeColor }} /> {profileUser.workplace}</div>}
                    {profileUser.address && <div className="flex items-center gap-4"><MapPin className="w-5 h-5 text-red-400" /> {profileUser.address}</div>}
                  </div>

                  {/* ✅ คืนชีพ "งานอดิเรก" (Hobbies) กลับมาตามสั่ง */}
                  {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
                    <div className="pt-8 border-t border-gray-50">
                      <p className="text-[11px] font-black text-gray-300 uppercase tracking-[0.3em] mb-5">งานอดิเรกและความสนใจ</p>
                      <div className="flex flex-wrap gap-3">
                        {profileUser.hobbies.map((h: any, i: number) => (
                          <span key={i} className="px-6 py-3 rounded-full text-xs font-black border tracking-widest uppercase transition-all hover:scale-105 shadow-sm" style={{ backgroundColor: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>
                            {typeof h === 'string' ? h : h.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:hidden space-y-8 px-2"><RelationshipWidget /></div>

            {(friendshipStatus === 'accepted' || isOwnProfile) ? (
              <div className="space-y-8">
                <CreatePostV3 currentUser={currentUser} targetUser={profileUser} onPostCreated={() => setRefreshTrigger(t => t + 1)} />
                <div className="space-y-8">{posts.map((p) => (<PostCardV3 key={p.id} post={p} currentUserId={currentUser.id} profileOwnerId={profileUser.id} onDelete={() => {}} />))}</div>
              </div>
            ) : <div className="card-minimal bg-white/50 border-2 border-dashed border-gray-200 p-24 text-center rounded-[3.5rem] text-gray-400 font-black text-xs uppercase tracking-widest">Become friends to see posts</div>}
          </div>

          <div className="hidden lg:block w-[400px] space-y-8">
            <RelationshipWidget />
            <div className="card-minimal bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-soft">
              <div className="flex items-center justify-between mb-6 px-1">
                <h3 className="font-black text-gray-900 text-[12px] uppercase tracking-widest flex items-center gap-2"><Users className="w-5 h-5" style={{ color: themeColor }} /> เพื่อน</h3>
                <Link href={`/profile/${profileUser.username}/friends`} className="text-[11px] font-black text-frog-600 bg-frog-50 px-3 py-1.5 rounded-xl">ดูทั้งหมด</Link>
              </div>
              <div className="grid grid-cols-3 gap-4">{friends.slice(0, 9).map(f => (
                <Link key={f.id} href={`/profile/${f.username}`} className="group flex flex-col items-center gap-2.5 transition-all hover:scale-105">
                  <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full aspect-square rounded-[1.5rem] object-cover shadow-md" />
                  <p className="text-[11px] font-black text-center truncate w-full text-gray-500 uppercase tracking-tighter">{f.display_name.split(' ')[0]}</p>
                </Link>
              ))}</div>
            </div>
            <div className="text-center opacity-20 py-10"><p className="text-[11px] font-black uppercase tracking-[0.6em]">Ribbi Community 2026</p></div>
          </div>
        </div>
      </div>

      {showAddFamilyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl p-10 text-center animate-in zoom-in duration-200">
            <div className="w-24 h-24 bg-frog-50 text-frog-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><Heart size={48} /></div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">เพิ่มคนสำคัญ</h2>
            <p className="text-sm text-gray-500 font-bold mb-10">ระบุความสัมพันธ์ที่จะแสดงที่หน้าโปรไฟล์ของคุณ</p>
            <input type="text" value={familyLabel} onChange={(e) => setFamilyLabel(e.target.value)} placeholder="เช่น พี่ชาย, เพื่อนสนิท" className="input-minimal w-full mb-8 text-center text-xl" autoFocus />
            <div className="flex gap-4">
              <button onClick={handleAddFamilyMember} className="btn-primary flex-1 py-5 rounded-[1.5rem] font-black text-white shadow-xl" style={{ backgroundColor: themeColor }}>บันทึกข้อมูล</button>
              <button onClick={() => setShowAddFamilyModal(false)} className="px-8 py-5 bg-gray-100 text-gray-500 rounded-[1.5rem] font-black transition-all hover:bg-gray-200">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={showFamilyDeleteConfirm} onClose={() => setShowFamilyDeleteConfirm(false)} onConfirm={handleRemoveFamilyMember} title="ลบข้อมูล?" message="คุณแน่ใจนะว่าจะลบความสัมพันธ์นี้?" variant="danger" />
    </NavLayout>
  );
}

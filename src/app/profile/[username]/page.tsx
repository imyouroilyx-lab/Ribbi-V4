'use client';

import { useState, useEffect } from 'react';
// แก้ไข Path เป็น Relative เพื่อป้องกัน Error ในการ Resolve Path
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
  const [isAddedToFamily, setIsAddedToFamily] = useState(false); // สถานะว่าเราเพิ่มเขาเป็นครอบครัวหรือยัง

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

      const [currentUserRes, postsRes, familyRes, friendsRes, friendStatusRes, checkFamilyRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('posts').select('*, author:author_id(*), target:target_id(*)').eq('target_id', profileData.id).order('created_at', { ascending: false }),
        // ดึงข้อมูลจากตาราง family_members ของเจ้าของโปรไฟล์
        supabase.from('family_members').select('*, member:member_user_id(*)').eq('user_id', profileData.id),
        supabase.from('friendships').select('*, sender:sender_id(*), receiver:receiver_id(*)').eq('status', 'accepted').or(`sender_id.eq.${profileData.id},receiver_id.eq.${profileData.id}`).order('created_at', { ascending: false }).limit(9),
        supabase.from('friendships').select('*').or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${profileData.id}),and(sender_id.eq.${profileData.id},receiver_id.eq.${authUser.id})`).maybeSingle(),
        // เช็คว่า currentUser ได้เพิ่ม profileUser เข้า family หรือยัง
        supabase.from('family_members').select('id').eq('user_id', authUser.id).eq('member_user_id', profileData.id).maybeSingle()
      ]);

      setCurrentUser(currentUserRes.data);
      setPosts(postsRes.data || []);
      setFamilyMembers(familyRes.data || []);
      setFriends((friendsRes.data || []).map((f: any) => f.sender_id === profileData.id ? f.receiver : f.sender));
      setIsAddedToFamily(!!checkFamilyRes.data);

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
        <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">กำลังโหลดโปรไฟล์...</p>
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
      <div className="card-minimal bg-white p-8 rounded-[3rem] border border-gray-100 shadow-soft space-y-8">
        <h3 className="font-black text-gray-900 flex items-center gap-3 text-[12px] uppercase tracking-[0.2em]"><Heart className="w-5 h-5 text-red-500" /> ความสัมพันธ์</h3>
        
        {profileUser.relationship_status && (
          <div className="p-6 rounded-[2rem] border" style={{ backgroundColor: `${themeColor}05`, borderColor: `${themeColor}15` }}>
            <p className="text-[11px] font-black uppercase mb-2" style={{ color: themeColor }}>สถานะปัจจุบัน</p>
            <p className="text-lg font-bold text-gray-800">
              {profileUser.relationship_status === 'single' ? 'โสด' : 
               profileUser.relationship_status === 'in_relationship' ? 'มีแฟนแล้ว' : 
               profileUser.relationship_status === 'married' ? 'แต่งงานแล้ว' : 
               profileUser.relationship_status === 'divorced' ? 'หย่าร้าง' : 'หมั้นแล้ว'}
              {profileUser.relationship_custom_name && <span className="font-black" style={{ color: themeColor }}> กับ {profileUser.relationship_custom_name}</span>}
            </p>
          </div>
        )}

        {hasFamily && (
          <div className="space-y-4">
            <p className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">ครอบครัวและคนสำคัญ</p>
            <div className="space-y-3">
              {familyMembers.map((fm) => (
                <div key={fm.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-3xl group transition-all hover:bg-white hover:shadow-md">
                  <img src={fm.member?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-2xl object-cover shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${fm.member?.username}`} className="font-bold text-sm hover:underline block truncate text-gray-800">{fm.member?.display_name}</Link>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-tight">{fm.relationship_label}</p>
                  </div>
                  {isOwnProfile && <button onClick={() => { setFamilyToDelete(fm.id); setShowFamilyDeleteConfirm(true); }} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"><Trash2 size={16} /></button>}
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
      {/* ✅ ขยายความกว้างสูงสุดเป็น 1600px เพื่อให้ Desktop ดูโปร่งขึ้น */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pb-24">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Main Content Area */}
          <div className="flex-1 min-w-0 space-y-10">
            {/* Profile Header Card */}
            <div className="card-minimal overflow-hidden p-0 border border-gray-100 shadow-soft bg-white rounded-[4rem]">
              <div className="h-60 md:h-96 relative" style={profileUser.cover_img_url ? { backgroundImage: `url(${profileUser.cover_img_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)` }} />
              
              <div className="px-10 md:px-16 pb-12">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 -mt-28 md:-mt-40 relative z-10">
                  
                  {/* Left: Avatar & Name Stack */}
                  <div className="flex flex-col items-center lg:items-start gap-6 flex-1">
                    <div className="w-48 h-48 md:w-64 md:h-64 rounded-full p-3 shadow-2xl bg-white border-[12px]" style={{ borderColor: themeColor }}>
                      <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full h-full rounded-full object-cover" />
                    </div>
                    
                    <div className="text-center lg:text-left space-y-3">
                      <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-none">{profileUser.display_name}</h1>
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* ✅ @username ใหญ่ขึ้น และเป็น lowercase 100% */}
                        <p className="text-gray-400 font-bold text-lg md:text-2xl lowercase tracking-tight">@{profileUser.username}</p>
                        <div className="hidden lg:block w-2 h-2 rounded-full bg-gray-200 mx-1" />
                        <div className="flex items-center justify-center lg:justify-start gap-2.5 text-xs font-black text-gray-300 uppercase tracking-[0.2em]">
                          <Award size={18} style={{ color: themeColor }} /> Since {new Date(profileUser.created_at).getFullYear()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Buttons */}
                  <div className="flex flex-row flex-wrap gap-3 justify-center lg:mb-8">
                    {isOwnProfile ? (
                      <Link href="/profile/edit" className="flex-1 lg:flex-none justify-center font-black text-[12px] uppercase tracking-widest px-12 py-5 rounded-[2rem] flex items-center gap-2 text-white shadow-xl hover:scale-105 transition-all active:scale-95" style={{ backgroundColor: themeColor }}><Edit size={20} /> แก้ไขโปรไฟล์</Link>
                    ) : (
                      <>
                        <button onClick={handleSendMessage} className="flex-1 lg:flex-none justify-center btn-secondary font-black text-[12px] uppercase tracking-widest px-10 py-5 rounded-[2rem] flex items-center gap-2 border border-gray-200 bg-white hover:bg-slate-900 hover:text-white transition-all shadow-md active:scale-95"><MessageCircle size={20} /> ข้อความ</button>
                        
                        {/* ✅ ถ้ายังไม่ได้เพิ่มเป็นคนสำคัญ และเป็นเพื่อนกันแล้ว ถึงจะโชว์ปุ่ม */}
                        {!isOwnProfile && friendshipStatus === 'accepted' && !isAddedToFamily && (
                          <button onClick={() => setShowAddFamilyModal(true)} className="px-10 py-5 rounded-[2rem] border font-black text-[12px] uppercase flex items-center gap-2 transition-all hover:scale-105 shadow-sm active:scale-95" style={{ backgroundColor: `${themeColor}15`, color: themeColor, borderColor: themeColor }}><Plus size={20} /> เพิ่มคนสำคัญ</button>
                        )}
                        
                        {friendshipStatus === 'none' && (
                          <button onClick={handleAddFriend} className="px-12 py-5 rounded-[2rem] text-white font-black text-[12px] uppercase flex items-center gap-2 shadow-xl hover:scale-105 transition-all active:scale-95" style={{ backgroundColor: themeColor }}><UserPlus size={20} /> เพิ่มเพื่อน</button>
                        )}
                        {friendshipStatus === 'sent' && (
                          <button className="px-12 py-5 rounded-[2rem] bg-gray-100 text-gray-400 font-black text-[12px] uppercase flex items-center gap-2 cursor-default border border-gray-200"><Clock size={20} /> ส่งคำขอแล้ว</button>
                        )}
                        {friendshipStatus === 'accepted' && (
                          <button className="px-12 py-5 rounded-[2rem] border font-black text-[12px] uppercase flex items-center gap-2 cursor-default shadow-inner" style={{ backgroundColor: `${themeColor}08`, borderColor: `${themeColor}30`, color: themeColor }}><UserCheck size={20} /> เพื่อนกันแล้ว</button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Profile Details Area */}
                <div className="mt-16 space-y-12">
                  {profileUser.bio && <p className="text-gray-600 font-medium leading-relaxed border-l-[10px] pl-10 text-2xl md:text-3xl italic" style={{ borderColor: `${themeColor}20` }}>{profileUser.bio}</p>}
                  
                  {profileUser.music_url && (
                    <div className="card-minimal bg-white p-8 rounded-[3rem] border border-gray-100 flex items-center gap-8 transition-all hover:scale-[1.01] shadow-soft">
                      <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-inner" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}><Music size={32} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">กำลังฟัง</p>
                        <p className="text-xl font-black text-gray-900 truncate">{profileUser.music_name || 'My Favorite Song'}</p>
                      </div>
                      <a href={profileUser.music_url} target="_blank" className="p-4 text-white rounded-3xl shadow-lg transition-all hover:opacity-90 active:scale-90" style={{ backgroundColor: themeColor }}><ExternalLink size={24} /></a>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-16 text-base md:text-lg text-gray-500 font-bold uppercase tracking-tight">
                    {profileUser.birthday && <div className="flex items-center gap-5"><Calendar className="w-6 h-6" style={{ color: themeColor }} /> {formatDate(profileUser.birthday)} ({calculateAge(profileUser.birthday)} ปี)</div>}
                    {profileUser.occupation && <div className="flex items-center gap-5"><Briefcase className="w-6 h-6" style={{ color: themeColor }} /> {profileUser.occupation}</div>}
                    {profileUser.workplace && <div className="flex items-center gap-5"><HomeIcon className="w-6 h-6" style={{ color: themeColor }} /> {profileUser.workplace}</div>}
                    {profileUser.address && <div className="flex items-center gap-5"><MapPin className="w-6 h-6 text-red-400" /> {profileUser.address}</div>}
                  </div>

                  {/* ✅ คืนชีพ "งานอดิเรก" (Hobbies) กลับมาโชว์ */}
                  {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
                    <div className="pt-10 border-t border-gray-50">
                      <p className="text-[12px] font-black text-gray-300 uppercase tracking-[0.1em] mb-6">งานอดิเรกและความสนใจ</p>
                      <div className="flex flex-wrap gap-4">
                        {profileUser.hobbies.map((h: any, i: number) => (
                          <span key={i} className="px-8 py-4 rounded-full text-sm font-black border tracking-widest uppercase transition-all hover:translate-y-[-2px] shadow-sm" style={{ backgroundColor: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>
                            {typeof h === 'string' ? h : h.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:hidden space-y-10 px-2"><RelationshipWidget /></div>

            {/* Posts Area */}
            {(friendshipStatus === 'accepted' || isOwnProfile) ? (
              <div className="space-y-10">
                <CreatePostV3 currentUser={currentUser} targetUser={profileUser} onPostCreated={() => setRefreshTrigger(t => t + 1)} />
                <div className="space-y-10">
                  {posts.length === 0 ? <div className="card-minimal text-center py-24 bg-white/50 rounded-[4rem] border-dashed border-gray-200 border-2"><p className="text-gray-300 font-black text-sm uppercase tracking-[0.4em]">ยังไม่มีความเคลื่อนไหว</p></div> : 
                    posts.map((p) => (<PostCardV3 key={p.id} post={p} currentUserId={currentUser.id} profileOwnerId={profileUser.id} onDelete={() => {}} />))}
                </div>
              </div>
            ) : <div className="card-minimal bg-white/50 border-2 border-dashed border-gray-200 p-32 text-center rounded-[4rem] text-gray-400 font-black text-sm uppercase tracking-[0.4em]">Become friends to see posts</div>}
          </div>

          {/* Right Sidebar */}
          <div className="hidden lg:block w-[450px] space-y-10">
            <RelationshipWidget />
            <div className="card-minimal bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-soft">
              <div className="flex items-center justify-between mb-8 px-2">
                <h3 className="font-black text-gray-900 text-[14px] uppercase tracking-[0.3em] flex items-center gap-3"><Users className="w-6 h-6" style={{ color: themeColor }} /> เพื่อน</h3>
                <Link href={`/profile/${profileUser.username}/friends`} className="text-[12px] font-black text-frog-600 bg-frog-50 px-4 py-2 rounded-2xl transition-colors hover:bg-frog-100">ดูทั้งหมด</Link>
              </div>
              <div className="grid grid-cols-3 gap-6">
                {friends.slice(0, 9).map(f => (
                  <Link key={f.id} href={`/profile/${f.username}`} className="group flex flex-col items-center gap-3 transition-all hover:scale-110">
                    <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full aspect-square rounded-[2rem] object-cover shadow-md border-4 border-transparent group-hover:border-white transition-all" />
                    <p className="text-[12px] font-black text-center truncate w-full text-gray-500 uppercase tracking-tighter">{f.display_name.split(' ')[0]}</p>
                  </Link>
                ))}
              </div>
            </div>
            <div className="text-center opacity-20 py-12"><p className="text-[11px] font-black uppercase tracking-[0.2em]">Ribbi Application 2026</p></div>
          </div>
        </div>
      </div>

      {/* Modal: เพิ่มความสัมพันธ์ */}
      {showAddFamilyModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg overflow-hidden shadow-2xl p-12 text-center animate-in zoom-in duration-300">
            <div className="w-28 h-28 bg-frog-50 text-frog-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><Heart size={56} /></div>
            <h2 className="text-3xl font-black text-gray-900 mb-3">เพิ่ม {profileUser.display_name}</h2>
            <p className="text-sm text-gray-500 font-bold mb-10 leading-relaxed uppercase tracking-widest">ระบุความสัมพันธ์ที่จะแสดงบนหน้าโปรไฟล์ของคุณ</p>
            <input type="text" value={familyLabel} onChange={(e) => setFamilyLabel(e.target.value)} placeholder="เช่น พี่ชาย, เพื่อนสนิท, แฟน" className="input-minimal w-full mb-10 text-center text-2xl font-bold border-b-4 rounded-none focus:border-frog-500" autoFocus />
            <div className="flex gap-4">
              <button onClick={handleAddFamilyMember} className="btn-primary flex-1 py-6 rounded-[2rem] font-black text-lg text-white shadow-xl hover:scale-105 transition-all" style={{ backgroundColor: themeColor }}>บันทึกข้อมูล</button>
              <button onClick={() => setShowAddFamilyModal(false)} className="px-10 py-6 bg-gray-100 text-gray-500 rounded-[2rem] font-black text-lg transition-all hover:bg-gray-200">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={showFamilyDeleteConfirm} onClose={() => setShowFamilyDeleteConfirm(false)} onConfirm={handleRemoveFamilyMember} title="ลบข้อมูลความสัมพันธ์?" message="คุณแน่ใจหรือไม่ว่าต้องการลบรายชื่อนี้ออกจากคนสำคัญของคุณ?" variant="danger" />
    </NavLayout>
  );
}

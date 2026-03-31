'use client';

import { useState, useEffect } from 'react';
import { supabase, type User, type Post } from '@/lib/supabase'; 
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import PostCardV3 from '@/components/PostCardV3';
import CreatePostV3 from '@/components/CreatePostV3';
import ConfirmModal from '@/components/ConfirmModal';
import { 
  MapPin, Calendar, Briefcase, Home as HomeIcon, 
  Edit, UserPlus, UserCheck, Heart, Users, Music, 
  MessageCircle, Loader2, ExternalLink, Award, Star, Trash2, Plus, X
} from 'lucide-react';
import Link from 'next/link';
import { calculateAge } from '@/lib/utils';

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
    } catch (err) { console.error(err); } 
    finally { setIsLoading(false); }
  };

  const handleAddFamilyMember = async () => {
    if (!currentUser || !profileUser || !familyLabel.trim()) return;
    const { error } = await supabase.from('family_members').insert({
      user_id: currentUser.id,
      member_user_id: profileUser.id,
      relationship_label: familyLabel.trim()
    });
    if (!error) {
      alert("เพิ่มเป็นคนสำคัญของคุณแล้ว (จะแสดงที่หน้าโปรไฟล์ของคุณ)");
      setShowAddFamilyModal(false);
      setFamilyLabel('');
    }
  };

  const handleRemoveFamilyMember = async () => {
    if (!familyToDelete) return;
    await supabase.from('family_members').delete().eq('id', familyToDelete);
    setFamilyMembers(prev => prev.filter(fm => fm.id !== familyToDelete));
    setShowFamilyDeleteConfirm(false);
  };

  if (isLoading || !profileUser || !currentUser) return null;
  const themeColor = profileUser.theme_color || '#9de5a8';
  const isOwnProfile = currentUser.id === profileUser.id;

  const RelationshipWidget = () => {
    const hasFamily = familyMembers.length > 0;
    const hasCloseFriends = profileUser.close_friends && Array.isArray(profileUser.close_friends) && profileUser.close_friends.length > 0;
    if (!profileUser.relationship_status && !hasFamily && !hasCloseFriends) return null;

    return (
      <div className="card-minimal bg-white p-6 rounded-[2rem] border border-gray-100 shadow-soft space-y-6">
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
            <p className="text-[10px] font-black text-gray-400 uppercase px-1">คนสำคัญในครอบครัว</p>
            {familyMembers.map((fm) => (
              <div key={fm.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-2xl">
                <img src={fm.member?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-9 h-9 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${fm.member?.username}`} className="font-bold text-xs hover:underline block truncate">{fm.member?.display_name}</Link>
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
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0 space-y-8">
            {/* --- Profile Header --- */}
            <div className="card-minimal overflow-hidden p-0 border border-gray-100 shadow-soft bg-white rounded-[3rem]">
              <div className="h-44 md:h-72 relative" style={profileUser.cover_img_url ? { backgroundImage: `url(${profileUser.cover_img_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)` }} />
              <div className="px-6 md:px-10 pb-8">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 -mt-20 md:-mt-28 relative z-10">
                  <div className="flex flex-col items-center lg:items-start gap-4 flex-1">
                    <div className="w-40 h-40 md:w-52 md:h-52 rounded-full p-2 shadow-2xl bg-white border-[8px]" style={{ borderColor: themeColor }}>
                      <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div className="text-center lg:text-left">
                      <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">{profileUser.display_name}</h1>
                      <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em]">@{profileUser.username}</p>
                    </div>
                  </div>

                  {/* Buttons Area */}
                  <div className="flex flex-row flex-wrap gap-2 justify-center lg:mb-4">
                    {isOwnProfile ? (
                      <Link href="/profile/edit" className="btn-primary px-6 py-3 rounded-xl text-white font-black text-[10px] uppercase flex items-center gap-2" style={{ backgroundColor: themeColor }}><Edit size={14} /> แก้ไขโปรไฟล์</Link>
                    ) : (
                      <>
                        <button onClick={() => {}} className="btn-secondary px-6 py-3 rounded-xl border border-gray-200 bg-white font-black text-[10px] uppercase flex items-center gap-2"><MessageCircle size={14} /> ข้อความ</button>
                        {!isOwnProfile && friendshipStatus === 'accepted' && (
                          <button onClick={() => setShowAddFamilyModal(true)} className="px-6 py-3 rounded-xl border font-black text-[10px] uppercase flex items-center gap-2 transition-all hover:scale-105 shadow-sm" style={{ backgroundColor: `${themeColor}10`, color: themeColor, borderColor: themeColor }}><Plus size={14} /> เพิ่มเป็นคนสำคัญ</button>
                        )}
                        {friendshipStatus === 'none' && <button onClick={() => {}} className="px-6 py-3 rounded-xl text-white font-black text-[10px] uppercase flex items-center gap-2 shadow-md" style={{ backgroundColor: themeColor }}><UserPlus size={14} /> เพิ่มเพื่อน</button>}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-10 space-y-8">
                  {profileUser.bio && <p className="text-gray-600 font-medium leading-relaxed border-l-4 pl-6 text-lg italic" style={{ borderColor: `${themeColor}20` }}>{profileUser.bio}</p>}
                  
                  {profileUser.music_url && (
                    <div className="card-minimal bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}><Music size={20} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-gray-400 uppercase">กำลังฟัง</p>
                        <p className="text-xs font-black text-gray-900 truncate">{profileUser.music_name}</p>
                      </div>
                      <a href={profileUser.music_url} target="_blank" className="p-2 text-white rounded-lg" style={{ backgroundColor: themeColor }}><ExternalLink size={14} /></a>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-10 text-[12px] text-gray-500 font-bold uppercase tracking-tight">
                    {profileUser.birthday && <div className="flex items-center gap-3"><Calendar className="w-4 h-4" style={{ color: themeColor }} /> {formatDate(profileUser.birthday)} ({calculateAge(profileUser.birthday)} ปี)</div>}
                    {profileUser.occupation && <div className="flex items-center gap-3"><Briefcase className="w-4 h-4" style={{ color: themeColor }} /> {profileUser.occupation}</div>}
                    {profileUser.workplace && <div className="flex items-center gap-3"><HomeIcon className="w-4 h-4" style={{ color: themeColor }} /> {profileUser.workplace}</div>}
                    {profileUser.address && <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-red-400" /> {profileUser.address}</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:hidden space-y-8"><RelationshipWidget /></div>

            {(friendshipStatus === 'accepted' || isOwnProfile) ? (
              <div className="space-y-8">
                <CreatePostV3 currentUser={currentUser} targetUser={profileUser} onPostCreated={() => setRefreshTrigger(t => t + 1)} />
                <div className="space-y-8">{posts.map((p) => (<PostCardV3 key={p.id} post={p} currentUserId={currentUser.id} profileOwnerId={profileUser.id} onDelete={() => {}} />))}</div>
              </div>
            ) : <div className="card-minimal bg-white/50 border-2 border-dashed border-gray-200 p-24 text-center rounded-[3rem] text-gray-400 font-black text-xs uppercase tracking-widest">Become friends to see posts</div>}
          </div>

          <div className="hidden lg:block w-[380px] space-y-8">
            <RelationshipWidget />
            <div className="card-minimal bg-white p-6 rounded-3xl border border-gray-100 shadow-soft">
              <div className="flex items-center justify-between mb-5 px-1"><h3 className="font-black text-gray-900 text-[11px] uppercase tracking-widest flex items-center gap-2"><Users className="w-4 h-4" style={{ color: themeColor }} /> เพื่อน</h3><Link href={`/profile/${profileUser.username}/friends`} className="text-[10px] font-black text-frog-600">ดูทั้งหมด</Link></div>
              <div className="grid grid-cols-3 gap-3">{friends.slice(0, 9).map(f => (<Link key={f.id} href={`/profile/${f.username}`} className="group flex flex-col items-center gap-2"><img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-full aspect-square rounded-2xl object-cover shadow-sm group-hover:scale-105 transition" /><p className="text-[10px] font-black text-center truncate w-full text-gray-500">{f.display_name.split(' ')[0]}</p></Link>))}</div>
            </div>
            <div className="text-center opacity-20 py-10"><p className="text-[10px] font-black uppercase tracking-[0.6em]">Ribbi 2026</p></div>
          </div>
        </div>
      </div>

      {/* --- Modal: เพิ่มความสัมพันธ์ --- */}
      {showAddFamilyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-frog-50 text-frog-500 rounded-3xl flex items-center justify-center mx-auto mb-6"><Heart size={40} /></div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">เพิ่ม {profileUser.display_name}</h2>
              <p className="text-sm text-gray-500 font-bold mb-8">ระบุความสัมพันธ์ที่จะแสดงที่หน้าโปรไฟล์ของคุณ</p>
              <input type="text" value={familyLabel} onChange={(e) => setFamilyLabel(e.target.value)} placeholder="เช่น พี่ชาย, น้องสาว, เพื่อนสนิท" className="input-minimal w-full mb-6 text-center text-lg" autoFocus />
              <div className="flex gap-3">
                <button onClick={handleAddFamilyMember} className="btn-primary flex-1 py-4 rounded-2xl font-black text-white shadow-lg" style={{ backgroundColor: themeColor }}>บันทึกข้อมูล</button>
                <button onClick={() => setShowAddFamilyModal(false)} className="px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black">ยกเลิก</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={showFamilyDeleteConfirm} onClose={() => setShowFamilyDeleteConfirm(false)} onConfirm={handleRemoveFamilyMember} title="ลบข้อมูล?" message="คุณแน่ใจนะว่าจะลบความสัมพันธ์นี้?" variant="danger" />
    </NavLayout>
  );
}

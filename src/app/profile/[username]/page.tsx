'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, User, Post } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import PostCardV3 from '@/components/PostCardV3';
import CreatePostV3 from '@/components/CreatePostV3';
import ConfirmModal from '@/components/ConfirmModal';
import { 
  MapPin, Calendar, Briefcase, Home as HomeIcon, 
  Edit, UserPlus, UserCheck, Heart, Palette, Users, Music, ExternalLink,
  MessageCircle, Ban, EyeOff, Trash2, X, Plus, Clock, ChevronRight, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { calculateAge } from '@/lib/utils';

const POSTS_PER_PAGE = 10;

interface FamilyMember {
  id: string;
  member_user_id: string;
  relationship_label: string;
  member: User;
}

interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'accepted';
  sender?: User;
  receiver?: User;
}

async function getOrCreateChat(currentUserId: string, targetUserId: string): Promise<string | null> {
  try {
    const { data: currentUserChats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', currentUserId);

    const { data: targetUserChats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', targetUserId);

    if (currentUserChats && targetUserChats) {
      const currentChatIds = currentUserChats.map(c => c.chat_id);
      const targetChatIds = targetUserChats.map(c => c.chat_id);
      const sharedChatIds = currentChatIds.filter(id => targetChatIds.includes(id));

      if (sharedChatIds.length > 0) {
        const { data: dmChats } = await supabase
          .from('chats')
          .select('id')
          .in('id', sharedChatIds)
          .eq('is_group', false)
          .limit(1);

        if (dmChats && dmChats.length > 0) {
          return dmChats[0].id;
        }
      }
    }

    const { data: newChat, error: chatError } = await supabase
      .from('chats')
      .insert({ is_group: false })
      .select()
      .single();

    if (chatError || !newChat) return null;

    await supabase.from('chat_participants').insert([
      { chat_id: newChat.id, user_id: currentUserId, role: 'member' },
      { chat_id: newChat.id, user_id: targetUserId, role: 'member' }
    ]);

    return newChat.id;
  } catch (error) {
    console.error(error);
    return null;
  }
}

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
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [newRelationship, setNewRelationship] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [blockStatus, setBlockStatus] = useState<'none' | 'blocked' | 'ignored'>('none');
  const [friends, setFriends] = useState<User[]>([]);
  
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showFamilyDeleteConfirm, setShowFamilyDeleteConfirm] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<string | null>(null);
  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, hasMore]);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    loadInitialData();
  }, [username, refreshTrigger]);

  useEffect(() => {
    if (page > 0) {
      loadMorePosts();
    }
  }, [page]);

  useEffect(() => {
    if (profileUser?.theme_color) {
      document.documentElement.style.setProperty('--profile-theme', profileUser.theme_color);
    }
    return () => {
      document.documentElement.style.removeProperty('--profile-theme');
    };
  }, [profileUser?.theme_color]);

  const formatBirthday = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const day = date.getDate();
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      const age = calculateAge(dateStr);
      return `${day} ${month} ${year} (${age} ปี)`;
    } catch {
      return dateStr;
    }
  };

  const formatJoinDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const day = date.getDate();
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return dateStr;
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    setPage(0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: currentUserData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setCurrentUser(currentUserData);

      const { data: profileUserData } = await supabase.from('users').select('*').eq('username', username).single();
      if (!profileUserData) { router.push('/'); return; }
      setProfileUser(profileUserData);

      const { data: postsData } = await supabase
        .from('posts')
        .select('*, author:author_id(id, username, display_name, profile_img_url), target:target_id(id, username, display_name, profile_img_url)')
        .eq('target_id', profileUserData.id)
        .order('created_at', { ascending: false })
        .range(0, POSTS_PER_PAGE - 1);

      setPosts(postsData || []);
      setHasMore((postsData?.length || 0) === POSTS_PER_PAGE);

      if (currentUserData.id !== profileUserData.id) {
        await Promise.all([
          checkFriendshipStatus(currentUserData.id, profileUserData.id),
          checkBlockStatus(currentUserData.id, profileUserData.id),
          supabase.from('profile_views').insert({ profile_id: profileUserData.id, visitor_id: currentUserData.id })
        ]);
      }

      await Promise.all([
        loadFamilyMembers(profileUserData.id),
        loadFriends(profileUserData.id)
      ]);

    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || !profileUser) return;

    setIsLoadingMore(true);
    const start = page * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE - 1;

    try {
      const { data: newPosts } = await supabase
        .from('posts')
        .select('*, author:author_id(id, username, display_name, profile_img_url), target:target_id(id, username, display_name, profile_img_url)')
        .eq('target_id', profileUser.id)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (newPosts && newPosts.length > 0) {
        setPosts(prev => [...prev, ...newPosts]);
        setHasMore(newPosts.length === POSTS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadFamilyMembers = async (userId: string) => {
    try {
      const { data } = await supabase.from('family_members').select('*, member:member_user_id(*)').eq('user_id', userId);
      setFamilyMembers(data || []);
    } catch (error) { console.error(error); }
  };

  const loadFriends = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('*, sender:sender_id(id, username, display_name, profile_img_url), receiver:receiver_id(id, username, display_name, profile_img_url)')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(4);

      const friendsList = (data || []).map((friendship: Friendship) => {
        return friendship.sender_id === userId ? friendship.receiver : friendship.sender;
      }).filter((friend): friend is User => friend !== undefined);

      setFriends(friendsList);
    } catch (error) { console.error(error); }
  };

  const checkFriendshipStatus = async (userId: string, profileId: string) => {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${userId})`)
        .maybeSingle();

      if (data) {
        setFriendshipId(data.id);
        if (data.status === 'accepted') setFriendshipStatus('accepted');
        else if (data.sender_id === userId) setFriendshipStatus('sent');
        else setFriendshipStatus('pending');
      }
    } catch (error) { console.error(error); }
  };

  const checkBlockStatus = async (userId: string, profileId: string) => {
    try {
      const { data } = await supabase.from('blocks').select('*').eq('blocker_id', userId).eq('blocked_id', profileId).maybeSingle();
      if (data) setBlockStatus(data.block_type === 'block' ? 'blocked' : 'ignored');
    } catch (error) { console.error(error); }
  };

  const handleSendMessage = async () => {
    if (!currentUser || !profileUser) return;
    const chatId = await getOrCreateChat(currentUser.id, profileUser.id);
    if (chatId) router.push(`/messages?chat=${chatId}`);
    else alert('ไม่สามารถเปิดแชทได้');
  };

  const handleAddFriend = async () => {
    if (!currentUser || !profileUser) return;
    try {
      await supabase.from('friendships').insert({ sender_id: currentUser.id, receiver_id: profileUser.id, status: 'pending' });
      setFriendshipStatus('sent');
    } catch (error) { console.error(error); }
  };

  const handleAcceptFriend = async () => {
    if (!friendshipId) return;
    try {
      await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
      setFriendshipStatus('accepted');
      loadFriends(profileUser.id);
    } catch (error) { console.error(error); }
  };

  const handleRemoveFriend = async () => {
    if (!friendshipId) return;
    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      setFriendshipStatus('none');
      setFriendshipId(null);
      setShowUnfriendModal(false);
      setShowUnfriendConfirm(false);
      loadFriends(profileUser.id);
    } catch (error) { console.error(error); }
  };

  const handleAddFamilyMember = async () => {
    if (!currentUser || !profileUser || !newRelationship.trim()) return;
    try {
      await supabase.from('family_members').insert({ 
        user_id: currentUser.id, 
        member_user_id: profileUser.id, 
        relationship_label: newRelationship.trim() 
      });
      
      if (isOwnProfile) {
        await loadFamilyMembers(currentUser.id);
      } else {
        setIsSaved(true);
        setTimeout(() => {
          setIsSaved(false);
          setShowAddFamily(false);
        }, 2000);
      }
      
      setNewRelationship('');
    } catch (error) { console.error(error); }
  };

  const handleRemoveFamilyMember = async () => {
    if (!familyToDelete) return;
    try {
      await supabase.from('family_members').delete().eq('id', familyToDelete);
      if (profileUser) await loadFamilyMembers(profileUser.id);
      setFamilyToDelete(null);
    } catch (error) { console.error(error); }
  };

  const handleBlock = async (type: 'block' | 'ignore') => {
    if (!currentUser || !profileUser) return;
    try {
      await supabase.from('blocks').upsert({ blocker_id: currentUser.id, blocked_id: profileUser.id, block_type: type });
      setBlockStatus(type === 'block' ? 'blocked' : 'ignored');
    } catch (error) { console.error(error); }
  };

  const handleUnblock = async () => {
    if (!currentUser || !profileUser) return;
    try {
      await supabase.from('blocks').delete().eq('blocker_id', currentUser.id).eq('blocked_id', profileUser.id);
      setBlockStatus('none');
    } catch (error) { console.error(error); }
  };

  const handlePostCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    try {
      await supabase.from('posts').delete().eq('id', postToDelete);
      setPosts(prev => prev.filter(p => p.id !== postToDelete));
      setPostToDelete(null);
    } catch (error) { console.error(error); }
  };

  if (isLoading && page === 0) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 mx-auto mb-4 animate-bounce" />
            <p className="text-gray-600 font-bold uppercase tracking-widest text-xs">กำลังโหลดข้อมูลโปรไฟล์...</p>
          </div>
        </div>
      </NavLayout>
    );
  }

  if (!profileUser || !currentUser) return null;

  const themeColor = profileUser.theme_color || '#9de5a8';

  const RelationshipWidget = () => {
    const hasData = profileUser.relationship_status || familyMembers.length > 0;
    const canInteract = isOwnProfile || friendshipStatus === 'accepted';

    if (!hasData && !canInteract) return null;

    return (
      <div className="card-minimal bg-white shadow-sm border border-gray-100">
        <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          ความสัมพันธ์
        </h3>
        
        {profileUser.relationship_status && (
          <div className="mb-4 p-3 bg-red-50/50 rounded-2xl border border-red-50">
             <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 opacity-70">สถานะหัวใจ</p>
             <p className="text-sm font-bold text-gray-900">
                {profileUser.relationship_status === 'single' && '👤 โสด'}
                {profileUser.relationship_status === 'in_relationship' && '❤️ มีแฟนแล้ว'}
                {profileUser.relationship_status === 'engaged' && '💍 หมั้นแล้ว'}
                {profileUser.relationship_status === 'married' && '💒 แต่งงานแล้ว'}
                {profileUser.relationship_status === 'complicated' && '❓ ไม่ชัดเจน'}
                {profileUser.relationship_custom_name && <span className="text-frog-600"> กับ {profileUser.relationship_custom_name}</span>}
             </p>
          </div>
        )}

        {familyMembers.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">ครอบครัวและคนใกล้ชิด</p>
            {familyMembers.map((fm) => (
              <div key={fm.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-2xl group transition hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100">
                <img src={fm.member.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-9 h-9 rounded-xl object-cover shadow-sm" alt="" />
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${fm.member.username}`} className="font-bold text-xs hover:text-frog-600 truncate block">{fm.member.display_name}</Link>
                  <p className="text-[10px] text-gray-400 font-medium">{fm.relationship_label}</p>
                </div>
                {isOwnProfile && (
                  <button onClick={() => { setFamilyToDelete(fm.id); setShowFamilyDeleteConfirm(true); }} className="p-1.5 text-gray-300 hover:text-red-500 transition opacity-0 lg:group-hover:opacity-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : hasData && (
          <p className="text-[10px] text-gray-400 italic px-1">ยังไม่มีรายชื่อคนใกล้ชิด</p>
        )}

        {!isOwnProfile && friendshipStatus === 'accepted' && (
          <div className="mt-4">
            {!showAddFamily ? (
              <button onClick={() => setShowAddFamily(true)} className="w-full py-2.5 text-[10px] font-black uppercase text-frog-600 hover:bg-frog-50 rounded-xl transition border border-dashed border-frog-200 flex items-center justify-center gap-2">
                <Plus size={14} /> เพิ่มไปยังโปรไฟล์ของฉัน
              </button>
            ) : (
              <div className="p-3 bg-frog-50 rounded-2xl border border-frog-100 animate-in fade-in slide-in-from-top-1">
                {isSaved ? (
                  <div className="flex flex-col items-center py-2 text-frog-600 animate-in zoom-in">
                    <CheckCircle2 size={32} className="mb-2" />
                    <p className="text-xs font-black">บันทึกเรียบร้อย!</p>
                    <p className="text-[10px] opacity-70">ดูได้ที่หน้าโปรไฟล์ของคุณ</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-frog-700">เพิ่ม {profileUser.display_name} เป็น...</p>
                      <button onClick={() => setShowAddFamily(false)}><X className="w-4 h-4 text-frog-400" /></button>
                    </div>
                    <input 
                      type="text" 
                      value={newRelationship} 
                      onChange={(e) => setNewRelationship(e.target.value)} 
                      placeholder="เช่น พี่ชาย, เพื่อนสนิท..." 
                      className="w-full px-3 py-2 bg-white border border-frog-200 rounded-xl text-xs focus:ring-2 focus:ring-frog-500 outline-none mb-2" 
                    />
                    <button 
                      onClick={handleAddFamilyMember} 
                      disabled={!newRelationship.trim()}
                      className="w-full py-2 bg-frog-600 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                    >
                      บันทึกความสัมพันธ์
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            {/* Profile Header */}
            <div className="card-minimal overflow-hidden p-0 border border-gray-100 shadow-sm">
              <div 
                className="h-32 md:h-56"
                style={profileUser.cover_img_url ? { 
                  backgroundImage: `url(${profileUser.cover_img_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                } : {
                  background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)`
                }}
              />

              <div className="p-4 md:p-6 bg-white">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6 -mt-20 mb-6">
                  <div 
                    className="w-24 h-24 md:w-36 md:h-36 rounded-full p-1.5 shadow-xl bg-white flex-shrink-0"
                    style={{ borderColor: themeColor, borderWidth: '4px' }}
                  >
                    <img 
                      src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                      alt={profileUser.display_name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>

                  <div className="flex-1 md:mt-20 flex flex-wrap justify-start md:justify-end gap-2">
                    {isOwnProfile ? (
                      <Link href="/profile/edit" className="btn-secondary inline-flex items-center gap-2 font-bold px-5">
                        <Edit className="w-4 h-4" />
                        <span>แก้ไขโปรไฟล์</span>
                      </Link>
                    ) : (
                      <>
                        <button onClick={handleSendMessage} className="btn-secondary flex items-center gap-2 font-bold px-5">
                          <MessageCircle className="w-4 h-4" />
                          <span>ข้อความ</span>
                        </button>

                        {friendshipStatus === 'none' && (
                          <button onClick={handleAddFriend} className="btn-primary flex items-center gap-2 font-bold px-5">
                            <UserPlus className="w-4 h-4" />
                            <span>เพิ่มเพื่อน</span>
                          </button>
                        )}
                        {friendshipStatus === 'sent' && (
                          <button className="btn-secondary text-sm font-bold" disabled>ส่งคำขอแล้ว</button>
                        )}
                        {friendshipStatus === 'pending' && (
                          <button onClick={handleAcceptFriend} className="btn-primary flex items-center gap-2 font-bold px-5">
                            <UserCheck className="w-4 h-4" />
                            <span>ตอบรับ</span>
                          </button>
                        )}
                        {friendshipStatus === 'accepted' && (
                          <div className="relative">
                            <button 
                              onClick={() => setShowUnfriendConfirm(!showUnfriendConfirm)}
                              className="btn-secondary flex items-center gap-2 font-bold px-5"
                            >
                              <UserCheck className="w-4 h-4" />
                              <span>เพื่อน</span>
                            </button>
                            {showUnfriendConfirm && (
                              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-20">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="font-bold text-gray-900 text-sm">เลิกเป็นเพื่อน?</p>
                                  <button onClick={() => setShowUnfriendConfirm(false)}>
                                    <X className="w-4 h-4 text-gray-400" />
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                  คุณต้องการลบ {profileUser.display_name} ออกจากรายชื่อเพื่อนหรือไม่?
                                </p>
                                <div className="flex gap-2">
                                  <button onClick={() => setShowUnfriendModal(true)} className="flex-1 px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition text-xs font-bold shadow-sm">ลบเพื่อน</button>
                                  <button onClick={() => setShowUnfriendConfirm(false)} className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-xs font-bold">ยกเลิก</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="relative group">
                          <button className="btn-secondary px-3 font-bold">•••</button>
                          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                            {blockStatus === 'none' && (
                              <>
                                <button onClick={() => handleBlock('ignore')} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 font-medium">
                                  <EyeOff className="w-4 h-4 text-gray-400" /> ซ่อนโพสต์
                                </button>
                                <button onClick={() => handleBlock('block')} className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600 font-bold border-t border-gray-50">
                                  <Ban className="w-4 h-4" /> บล็อก
                                </button>
                              </>
                            )}
                            {blockStatus !== 'none' && (
                              <button onClick={handleUnblock} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 font-bold">
                                <UserCheck className="w-4 h-4" /> ปลดบล็อก
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900">{profileUser.display_name}</h1>
                    <p className="text-gray-400 text-sm font-medium">@{profileUser.username}</p>
                  </div>

                  {profileUser.bio && <p className="text-gray-700 leading-relaxed">{profileUser.bio}</p>}

                  {profileUser.music_url && profileUser.music_name && (
                    <a 
                      href={profileUser.music_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl transition-all hover:translate-y-[-2px] hover:shadow-md w-full md:w-auto border border-transparent shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${themeColor}10, ${themeColor}20)`,
                        borderColor: `${themeColor}30`,
                      }}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner"
                        style={{ backgroundColor: `${themeColor}40` }}
                      >
                        <Music className="w-5 h-5" style={{ color: themeColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate">{profileUser.music_name}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest opacity-70">Profile Music</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </a>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm text-gray-500 font-medium">
                    {profileUser.birthday && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{formatBirthday(profileUser.birthday)}</span>
                      </div>
                    )}
                    {profileUser.created_at && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>สมาชิกตั้งแต่: {formatJoinDate(profileUser.created_at)}</span>
                      </div>
                    )}
                    {profileUser.occupation && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{profileUser.occupation}</span>
                      </div>
                    )}
                    {profileUser.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{profileUser.address}</span>
                      </div>
                    )}
                    {profileUser.workplace && (
                      <div className="flex items-center gap-2">
                        <HomeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{profileUser.workplace}</span>
                      </div>
                    )}
                  </div>

                  {/* ส่วนแสดงงานอดิเรก (Hobbies) */}
                  {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {profileUser.hobbies.map((hobby: any, index: number) => (
                        <span 
                          key={index}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:scale-105"
                          style={{ 
                            backgroundColor: `${themeColor}10`,
                            color: themeColor,
                            borderColor: `${themeColor}30`,
                          }}
                        >
                          {hobby.emoji} {hobby.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Widgets - Mobile Only */}
            <div className="lg:hidden space-y-4">
              <div className="card-minimal bg-white shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-gray-900">เพื่อน</h3>
                  <Link href={`/profile/${profileUser.username}/friends`} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                    ดูทั้งหมด <ChevronRight size={14} />
                  </Link>
                </div>
                {friends.length === 0 ? <p className="text-xs text-gray-400 text-center py-4 italic">ยังไม่มีเพื่อน</p> : (
                  <div className="grid grid-cols-4 gap-3">
                    {friends.map((friend) => (
                      <Link key={friend.id} href={`/profile/${friend.username}`} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        <div className="relative">
                          <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-2xl object-cover border border-gray-100" alt="" />
                          {friend.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                        </div>
                        <p className="text-[10px] font-bold truncate w-full text-center text-gray-700">{friend.display_name.split(' ')[0]}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <RelationshipWidget />
            </div>

            {(friendshipStatus === 'accepted' || isOwnProfile) && blockStatus === 'none' && (
              <CreatePostV3 currentUser={currentUser} targetUser={profileUser} onPostCreated={handlePostCreated} />
            )}

            <div className="space-y-6">
              <h2 className="text-xl font-black text-gray-900 px-1">โพสต์ของ {profileUser.display_name}</h2>
              {posts.length === 0 && !isLoading ? (
                <div className="card-minimal text-center py-16 bg-gray-50 border border-dashed border-gray-200">
                  <img src="https://iili.io/qbtgKBt.png" alt="No posts" className="w-20 h-20 mx-auto mb-4 opacity-30 grayscale" />
                  <p className="text-gray-400 font-medium">ยังไม่มีโพสต์ให้แสดง</p>
                </div>
              ) : (
                <>
                  {posts.map((post, index) => {
                    const isLast = posts.length === index + 1;
                    return (
                      <div ref={isLast ? lastPostElementRef : null} key={post.id}>
                        <PostCardV3 
                          post={post} 
                          currentUserId={currentUser.id} 
                          profileOwnerId={profileUser.id} 
                          onDelete={(id) => { setPostToDelete(id); setShowDeletePostConfirm(true); }} 
                        />
                      </div>
                    );
                  })}
                  
                  {isLoadingMore && (
                    <div className="text-center py-6 animate-pulse">
                      <img src="https://iili.io/qbtgKBt.png" className="w-10 h-10 mx-auto mb-2 animate-bounce" alt="" />
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Loading more...</p>
                    </div>
                  )}

                  {!hasMore && posts.length > 0 && (
                    <div className="py-12 text-center">
                      <div className="h-px bg-gray-100 w-full mb-4"></div>
                      <p className="text-gray-400 text-xs italic">สิ้นสุดโพสต์แล้ว</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-4 space-y-6">
              <div className="card-minimal bg-white shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-gray-900">เพื่อน</h3>
                  <Link href={`/profile/${profileUser.username}/friends`} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                    ดูทั้งหมด <ChevronRight size={14} />
                  </Link>
                </div>
                {friends.length === 0 ? <p className="text-xs text-gray-400 text-center py-6 italic">ยังไม่มีเพื่อน</p> : (
                  <div className="space-y-1">
                    {friends.map((friend) => (
                      <Link key={friend.id} href={`/profile/${friend.username}`} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 transition group">
                        <div className="relative">
                          <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-2xl object-cover border border-gray-100 group-hover:scale-105 transition shadow-sm" alt="" />
                          {friend.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-900 truncate">{friend.display_name}</p>
                          <p className="text-[10px] text-gray-400 truncate">@{friend.username}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <RelationshipWidget />

              <div className="text-center opacity-40 hover:opacity-100 transition">
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Ribbi Community</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeletePostConfirm}
        onClose={() => { setShowDeletePostConfirm(false); setPostToDelete(null); }}
        onConfirm={handleDeletePost}
        title="ลบโพสต์ถาวร?"
        message="คุณจะไม่สามารถกู้คืนโพสต์นี้กลับมาได้อีกครั้ง"
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showFamilyDeleteConfirm}
        onClose={() => { setShowFamilyDeleteConfirm(false); setFamilyToDelete(null); }}
        onConfirm={handleRemoveFamilyMember}
        title="ลบความสัมพันธ์?"
        message="ข้อมูลความสัมพันธ์ครอบครัวจะถูกลบออกจากโปรไฟล์ของคุณ"
        confirmText="ลบออก"
        cancelText="ยกเลิก"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showUnfriendModal}
        onClose={() => setShowUnfriendModal(false)}
        onConfirm={handleRemoveFriend}
        title="เลิกเป็นเพื่อน?"
        message={`หากเลิกเป็นเพื่อน คุณจะไม่เห็นโพสต์ของ ${profileUser.display_name} ในหน้าแรกอีกต่อไป`}
        confirmText="ลบเพื่อน"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

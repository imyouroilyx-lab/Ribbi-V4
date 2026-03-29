'use client';

import { useState, useEffect } from 'react';
import { supabase, User, Post } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import PostCardV3 from '@/components/PostCardV3';
import CreatePostV3 from '@/components/CreatePostV3';
import ConfirmModal from '@/components/ConfirmModal';
import { 
  MapPin, Calendar, Briefcase, Home as HomeIcon, 
  Edit, UserPlus, UserCheck, Heart, Palette, Users, Music, ExternalLink,
  MessageCircle, Ban, EyeOff, Trash2, X, Plus
} from 'lucide-react';
import Link from 'next/link';
import { calculateAge } from '@/lib/utils';

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

// ✅ แก้ไขฟังก์ชัน getOrCreateChat ให้ทำงานได้อย่างถูกต้อง
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
      
      // หา Chat ID ที่ทั้งคู่มีร่วมกัน
      const sharedChatIds = currentChatIds.filter(id => targetChatIds.includes(id));

      if (sharedChatIds.length > 0) {
        // ต้องตรวจสอบให้แน่ใจว่าเป็นแชตส่วนตัว (DM) ไม่ใช่แชตกลุ่ม
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

    // ถ้าไม่มีแชตส่วนตัว ให้สร้างใหม่โดยระบุว่าไม่ใช่กลุ่ม
    const { data: newChat, error: chatError } = await supabase
      .from('chats')
      .insert({ is_group: false })
      .select()
      .single();

    if (chatError || !newChat) {
      console.error('Error creating chat:', chatError);
      return null;
    }

    // เพิ่มผู้เข้าร่วมพร้อมกับระบุ role ให้ครบถ้วน
    const { error: partError } = await supabase.from('chat_participants').insert([
      { chat_id: newChat.id, user_id: currentUserId, role: 'member' },
      { chat_id: newChat.id, user_id: targetUserId, role: 'member' }
    ]);

    if (partError) {
      console.error('Error adding participants:', partError);
      return null;
    }

    return newChat.id;
  } catch (error) {
    console.error('Error in getOrCreateChat:', error);
    return null;
  }
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted' | 'sent'>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [newRelationship, setNewRelationship] = useState('');
  const [blockStatus, setBlockStatus] = useState<'none' | 'blocked' | 'ignored'>('none');
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showFamilyDeleteConfirm, setShowFamilyDeleteConfirm] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<string | null>(null);
  const [showUnfriendModal, setShowUnfriendModal] = useState(false);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    loadData();
  }, [username]);

  useEffect(() => {
    if (profileUser?.theme_color) {
      document.documentElement.style.setProperty('--profile-theme', profileUser.theme_color);
    }
    return () => {
      document.documentElement.style.removeProperty('--profile-theme');
    };
  }, [profileUser?.theme_color]);

  const handleSendMessage = async () => {
    if (!currentUser || !profileUser) return;

    const chatId = await getOrCreateChat(currentUser.id, profileUser.id);

    if (chatId) {
      router.push(`/messages?chat=${chatId}`);
    } else {
      alert('ไม่สามารถเปิดแชทได้');
    }
  };
  
  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: currentUserData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      setCurrentUser(currentUserData);

      const { data: profileUserData } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (!profileUserData) {
        router.push('/');
        return;
      }

      setProfileUser(profileUserData);

      const { data: postsData } = await supabase
        .from('posts')
        .select('*, author:author_id(*), target:target_id(*)')
        .eq('target_id', profileUserData.id)
        .order('created_at', { ascending: false });

      setPosts(postsData || []);

      if (currentUserData.id !== profileUserData.id) {
        await checkFriendshipStatus(currentUserData.id, profileUserData.id);
        await checkBlockStatus(currentUserData.id, profileUserData.id);
      }

      await loadFamilyMembers(profileUserData.id);
      await loadFriends(profileUserData.id);

      if (currentUserData.id !== profileUserData.id) {
        await supabase.from('profile_views').insert({
          profile_id: profileUserData.id,
          visitor_id: currentUserData.id
        });
      }

    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFamilyMembers = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('family_members')
        .select('*, member:member_user_id(*)')
        .eq('user_id', userId);

      setFamilyMembers(data || []);
    } catch (error) {
      console.error('Error loading family members:', error);
    }
  };

  const loadFriends = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('*, sender:sender_id(*), receiver:receiver_id(*)')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(10);

      const friendsList = (data || []).map((friendship: Friendship) => {
        return friendship.sender_id === userId 
          ? friendship.receiver 
          : friendship.sender;
      }).filter((friend): friend is User => friend !== undefined);

      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
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
        
        if (data.status === 'accepted') {
          setFriendshipStatus('accepted');
        } else if (data.sender_id === userId) {
          setFriendshipStatus('sent');
        } else {
          setFriendshipStatus('pending');
        }
      }
    } catch (error) {
      console.error('Error checking friendship:', error);
    }
  };

  const checkBlockStatus = async (userId: string, profileId: string) => {
    try {
      const { data } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocker_id', userId)
        .eq('blocked_id', profileId)
        .maybeSingle();

      if (data) {
        setBlockStatus(data.block_type === 'block' ? 'blocked' : 'ignored');
      }
    } catch (error) {
      console.error('Error checking block status:', error);
    }
  };

  const handleAddFriend = async () => {
    if (!currentUser || !profileUser) return;

    try {
      const { error } = await supabase.from('friendships').insert({
        sender_id: currentUser.id,
        receiver_id: profileUser.id,
        status: 'pending'
      });

      if (error) throw error;

      setFriendshipStatus('sent');
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const handleAcceptFriend = async () => {
    if (!friendshipId) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) throw error;

      setFriendshipStatus('accepted');
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const handleRemoveFriend = async () => {
    if (!friendshipId) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      setFriendshipStatus('none');
      setFriendshipId(null);
      setShowUnfriendConfirm(false);
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  const handleAddFamilyMember = async () => {
    if (!currentUser || !profileUser || !newRelationship.trim()) return;

    try {
      const { error } = await supabase.from('family_members').insert({
        user_id: currentUser.id,
        member_user_id: profileUser.id,
        relationship_label: newRelationship.trim()
      });

      if (error) throw error;

      await loadFamilyMembers(currentUser.id);
      setNewRelationship('');
      setShowAddFamily(false);
    } catch (error) {
      console.error('Error adding family member:', error);
    }
  };

  const handleRemoveFamilyMember = async () => {
    if (!familyToDelete) return;

    try {
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', familyToDelete);

      if (error) throw error;

      if (currentUser) await loadFamilyMembers(currentUser.id);
      setFamilyToDelete(null);
    } catch (error) {
      console.error('Error removing family member:', error);
    }
  };

  const handleBlock = async (type: 'block' | 'ignore') => {
    if (!currentUser || !profileUser) return;

    try {
      const { error } = await supabase.from('blocks').upsert({
        blocker_id: currentUser.id,
        blocked_id: profileUser.id,
        block_type: type
      });

      if (error) throw error;

      setBlockStatus(type === 'block' ? 'blocked' : 'ignored');
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const handleUnblock = async () => {
    if (!currentUser || !profileUser) return;

    try {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', profileUser.id);

      if (error) throw error;

      setBlockStatus('none');
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const handlePostCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    loadData();
  };

  const handleDeletePost = async () => {
    const idToDelete = postToDelete;
    if (!idToDelete) return;

    try {
      const { error } = await supabase.from('posts').delete().eq('id', idToDelete);
      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== idToDelete));
      setPostToDelete(null);
      setShowDeletePostConfirm(false);
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <img 
              src="https://iili.io/qbtgKBt.png"
              alt="Loading"
              className="w-16 h-16 mx-auto mb-4 animate-bounce"
            />
            <p className="text-gray-600">กำลังโหลด...</p>
          </div>
        </div>
      </NavLayout>
    );
  }

  if (!profileUser || !currentUser) return null;

  const age = profileUser.birthday ? calculateAge(profileUser.birthday) : null;
  const themeColor = profileUser.theme_color || '#9de5a8';

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            {/* Profile Header */}
            <div className="card-minimal overflow-hidden p-0">
              <div 
                className="h-32 md:h-48"
                style={profileUser.cover_img_url ? { 
                  backgroundImage: `url(${profileUser.cover_img_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                } : {
                  background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}80)`
                }}
              />

              <div className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6 -mt-20 mb-6">
                  <div 
                    className="w-24 h-24 md:w-32 md:h-32 rounded-3xl p-2 shadow-lg"
                    style={{ backgroundColor: 'white', borderColor: themeColor, borderWidth: '4px' }}
                  >
                    <img 
                      src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                      alt={profileUser.display_name}
                      className="w-full h-full rounded-2xl object-cover"
                    />
                  </div>

                  <div className="flex-1 md:mt-16 flex flex-wrap justify-start md:justify-end gap-2">
                    {isOwnProfile ? (
                      <Link href="/profile/edit" className="btn-secondary inline-flex items-center gap-2">
                        <Edit className="w-4 h-4" />
                        <span className="hidden sm:inline">แก้ไขโปรไฟล์</span>
                        <span className="sm:hidden">แก้ไข</span>
                      </Link>
                    ) : (
                      <>
                          <button 
                            onClick={handleSendMessage}
                            className="btn-secondary flex items-center gap-2"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">ส่งข้อความ</span>
                          </button>

                        {friendshipStatus === 'none' && (
                          <button onClick={handleAddFriend} className="btn-primary flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            <span className="hidden sm:inline">เพิ่มเพื่อน</span>
                          </button>
                        )}
                        {friendshipStatus === 'sent' && (
                          <button className="btn-secondary text-sm" disabled>
                            ส่งคำขอแล้ว
                          </button>
                        )}
                        {friendshipStatus === 'pending' && (
                          <button onClick={handleAcceptFriend} className="btn-primary flex items-center gap-2">
                            <UserCheck className="w-4 h-4" />
                            <span className="hidden sm:inline">ยอมรับ</span>
                          </button>
                        )}
                        {friendshipStatus === 'accepted' && (
                          <div className="relative">
                            <button 
                              onClick={() => setShowUnfriendConfirm(!showUnfriendConfirm)}
                              className="btn-secondary flex items-center gap-2"
                            >
                              <UserCheck className="w-4 h-4" />
                              <span className="hidden sm:inline">เป็นเพื่อนแล้ว</span>
                            </button>
                            
                            {showUnfriendConfirm && (
                              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-10">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="font-medium text-gray-900 text-sm">ยืนยันการลบเพื่อน?</p>
                                  <button onClick={() => setShowUnfriendConfirm(false)}>
                                    <X className="w-4 h-4 text-gray-400" />
                                  </button>
                                </div>
                                <p className="text-sm text-gray-600 mb-3">
                                  คุณต้องการลบ {profileUser.display_name} ออกจากรายชื่อเพื่อนหรือไม่?
                                </p>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => setShowUnfriendModal(true)}
                                    className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
                                  >
                                    ลบเพื่อน
                                  </button>
                                  <button 
                                    onClick={() => setShowUnfriendConfirm(false)}
                                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="relative group">
                          <button className="btn-secondary px-3">
                            •••
                          </button>
                          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            {blockStatus === 'none' && (
                              <>
                                <button
                                  onClick={() => handleBlock('ignore')}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 rounded-t-xl"
                                >
                                  <EyeOff className="w-4 h-4" />
                                  ซ่อนโพสต์
                                </button>
                                <button
                                  onClick={() => handleBlock('block')}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 rounded-b-xl"
                                >
                                  <Ban className="w-4 h-4" />
                                  บล็อกผู้ใช้
                                </button>
                              </>
                            )}
                            {blockStatus !== 'none' && (
                              <button
                                onClick={handleUnblock}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 rounded-xl"
                              >
                                <UserCheck className="w-4 h-4" />
                                ปลดบล็อก
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-1">{profileUser.display_name}</h1>
                  <p className="text-gray-500 mb-4">@{profileUser.username}</p>

                  {profileUser.bio && (
                    <p className="text-gray-700 mb-4">{profileUser.bio}</p>
                  )}

                  {profileUser.music_url && profileUser.music_name && (
                    <a 
                      href={profileUser.music_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-4 inline-flex items-center gap-3 px-4 py-3 rounded-2xl transition-all hover:scale-[1.02] w-full md:w-auto"
                      style={{
                        background: `linear-gradient(135deg, ${themeColor}15, ${themeColor}25)`,
                        borderColor: `${themeColor}40`,
                        borderWidth: '1px'
                      }}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${themeColor}30` }}
                      >
                        <Music className="w-5 h-5" style={{ color: themeColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {profileUser.music_name}
                        </p>
                        <p className="text-xs text-gray-500">เพลงประจำโปรไฟล์</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </a>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                    {profileUser.birthday && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>อายุ {age} ปี</span>
                      </div>
                    )}
                    {profileUser.occupation && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Briefcase className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{profileUser.occupation}</span>
                      </div>
                    )}
                    {profileUser.address && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{profileUser.address}</span>
                      </div>
                    )}
                    {profileUser.workplace && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <HomeIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{profileUser.workplace}</span>
                      </div>
                    )}
                  </div>

                  {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Heart className="w-4 h-4" />
                        <span className="font-medium">งานอดิเรก:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profileUser.hobbies.map((hobby: any, index: number) => (
                          <span 
                            key={index}
                            className="px-3 py-1 rounded-full text-sm"
                            style={{ 
                              backgroundColor: `${themeColor}20`,
                              color: themeColor,
                              borderColor: `${themeColor}40`,
                              borderWidth: '1px'
                            }}
                          >
                            {hobby.emoji} {hobby.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {profileUser.relationship_status && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                        <Users className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">สถานะ:</span>
                        <span>
                          {profileUser.relationship_status === 'single' && '👤 โสด'}
                          {profileUser.relationship_status === 'in_relationship' && '❤️ เป็นแฟน'}
                          {profileUser.relationship_status === 'engaged' && '💍 หมั้น'}
                          {profileUser.relationship_status === 'married' && '💒 แต่งงาน'}
                          {profileUser.relationship_status === 'complicated' && '❓ ไม่ชัดเจน'}
                          {profileUser.relationship_custom_name && ` กับ ${profileUser.relationship_custom_name}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {familyMembers.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Users className="w-4 h-4" />
                        <span className="font-medium">ครอบครัวและเพื่อนสนิท:</span>
                      </div>
                      <div className="space-y-2">
                        {familyMembers.map((fm) => (
                          <div key={fm.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            <img 
                              src={fm.member.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                              alt={fm.member.display_name}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <Link 
                                href={`/profile/${fm.member.username}`}
                                className="font-medium text-sm hover:underline truncate block"
                              >
                                {fm.member.display_name}
                              </Link>
                              <p className="text-xs text-gray-500 truncate">{fm.relationship_label}</p>
                            </div>
                            {isOwnProfile && (
                              <button
                                onClick={() => {
                                  setFamilyToDelete(fm.id);
                                  setShowFamilyDeleteConfirm(true);
                                }}
                                className="text-red-500 hover:text-red-700 flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isOwnProfile && friendshipStatus === 'accepted' && (
                    <div className="mb-4">
                      {!showAddFamily ? (
                        <button
                          onClick={() => setShowAddFamily(true)}
                          className="text-sm text-frog-600 hover:text-frog-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          เพิ่มเป็นสมาชิกครอบครัว/เพื่อนสนิท
                        </button>
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">เพิ่มเป็นสมาชิกครอบครัว</p>
                            <button onClick={() => setShowAddFamily(false)}>
                              <X className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={newRelationship}
                            onChange={(e) => setNewRelationship(e.target.value)}
                            placeholder="ความสัมพันธ์ เช่น พี่ชาย, เพื่อนสนิท"
                            className="input-minimal mb-2 w-full"
                          />
                          <button
                            onClick={handleAddFamilyMember}
                            className="btn-primary w-full text-sm"
                          >
                            บันทึก
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                      <Palette className="w-4 h-4" />
                      <span className="font-medium">สีธีม:</span>
                      <div 
                        className="w-6 h-6 rounded-lg border-2 border-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: themeColor }}
                      />
                      <span className="text-xs text-gray-400">{themeColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Friends List - Mobile Only (ก่อนโพสต์) */}
            <div className="lg:hidden">
              <div className="card-minimal">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">เพื่อน</h3>
                  <Link 
                    href={`/profile/${profileUser.username}/friends`}
                    className="text-sm text-frog-600 hover:text-frog-700"
                  >
                    ดูทั้งหมด
                  </Link>
                </div>

                {friends.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">ยังไม่มีเพื่อน</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {friends.slice(0, 8).map((friend) => (
                      <Link
                        key={friend.id}
                        href={`/profile/${friend.username}`}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition"
                      >
                        <img
                          src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          alt={friend.display_name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                        <div className="text-center w-full">
                          <p className="font-medium text-sm truncate">{friend.display_name}</p>
                          <p className="text-xs text-gray-500 truncate">@{friend.username}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Create Post */}
            {currentUser && (friendshipStatus === 'accepted' || isOwnProfile) && blockStatus === 'none' && (
              <CreatePostV3 
                currentUser={currentUser}
                targetUser={profileUser}
                onPostCreated={handlePostCreated}
              />
            )}

            {/* Posts */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">โพสต์</h2>
              
              {posts.length === 0 ? (
                <div className="card-minimal text-center py-12">
                  <img 
                    src="https://iili.io/qbtgKBt.png"
                    alt="No posts"
                    className="w-24 h-24 mx-auto mb-4 opacity-50"
                  />
                  <p className="text-gray-500">ยังไม่มีโพสต์</p>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCardV3
                    key={post.id}
                    post={post}
                    currentUserId={currentUser.id}
                    profileOwnerId={profileUser.id}
                    onDelete={(postId) => {
                      setPostToDelete(postId);
                      setShowDeletePostConfirm(true);
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Sidebar - Friends List (Desktop Only) */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-4">
              <div className="card-minimal">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">เพื่อน</h3>
                  <Link 
                    href={`/profile/${profileUser.username}/friends`}
                    className="text-sm text-frog-600 hover:text-frog-700"
                  >
                    ดูทั้งหมด
                  </Link>
                </div>

                {friends.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">ยังไม่มีเพื่อน</p>
                ) : (
                  <div className="space-y-3">
                    {friends.map((friend) => (
                      <Link
                        key={friend.id}
                        href={`/profile/${friend.username}`}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition"
                      >
                        <img
                          src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          alt={friend.display_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{friend.display_name}</p>
                          <p className="text-xs text-gray-500 truncate">@{friend.username}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={showDeletePostConfirm}
        onClose={() => {
          setShowDeletePostConfirm(false);
          setPostToDelete(null);
        }}
        onConfirm={() => {
          setShowDeletePostConfirm(false);
          handleDeletePost();
        }}
        title="ต้องการลบโพสต์นี้?"
        message="คุณจะไม่สามารถกู้คืนโพสต์นี้ได้อีก"
        confirmText="ลบโพสต์"
        cancelText="ยกเลิก"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showFamilyDeleteConfirm}
        onClose={() => {
          setShowFamilyDeleteConfirm(false);
          setFamilyToDelete(null);
        }}
        onConfirm={handleRemoveFamilyMember}
        title="ต้องการลบสมาชิกครอบครัว?"
        message="การลบจะถูกบันทึกทันที"
        confirmText="ลบ"
        cancelText="ยกเลิก"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showUnfriendModal}
        onClose={() => setShowUnfriendModal(false)}
        onConfirm={() => {
          handleRemoveFriend();
          setShowUnfriendModal(false);
        }}
        title="ต้องการลบเพื่อน?"
        message={`คุณจะไม่เห็นโพสต์ของ ${profileUser.display_name} อีกต่อไป และต้องส่งคำขอใหม่ถ้าต้องการเป็นเพื่อนอีกครั้ง`}
        confirmText="ลบเพื่อน"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

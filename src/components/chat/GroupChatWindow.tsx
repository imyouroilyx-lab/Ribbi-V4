'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical, Trash2, Palette, Users, UserPlus, LogOut, X, Check, Pencil, Image as ImageIcon, Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  images: string[] | null;
  created_at: string;
  updated_at?: string | null;
  event?: string | null;
  sender: {
    id: string;
    username: string;
    display_name: string;
    profile_img_url: string | null;
  } | null;
}

interface GroupChatWindowProps {
  chatId: string;
  currentUser: any;
  onBack: () => void;
  onRefreshChats: () => void;
}

const PRESET_COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#ef4444', '#14b8a6', '#f59e0b',
  '#6366f1', '#64748b',
];

const MESSAGE_LIMIT = 30;

export default function GroupChatWindow({ chatId, currentUser, onBack, onRefreshChats }: GroupChatWindowProps) {
  const router = useRouter();
  const [groupData, setGroupData] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  // UI States
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [themeColor, setThemeColor] = useState('#22c55e');
  const [isSavingColor, setIsSavingColor] = useState(false);

  // Modals
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);

  // Add Member States
  const [friendsToAdd, setFriendsToAdd] = useState<any[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // Edit Group States
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupImgUrl, setEditGroupImgUrl] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    loadGroupData();
    markAsRead();
    
    // ตั้งค่า Realtime Subscription
    const channel = supabase
      .channel(`group-chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload) => {
        const newMessage = payload.new as any;
        if (newMessage.event) {
          if (['member_added', 'member_removed', 'member_left', 'group_updated'].includes(newMessage.event)) {
            await loadGroupData();
            scrollToBottom();
            return;
          }
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, { ...newMessage, sender: null } as any];
          });
          scrollToBottom();
          return;
        }
        const { data: sender } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url')
          .eq('id', newMessage.sender_id)
          .single();
        if (!sender) return;
        
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, { ...newMessage, sender } as any];
        });
        markAsRead();
        scrollToBottom();
        onRefreshChats();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload) => {
        const updatedMessage = payload.new as any;
        if (updatedMessage.deleted_by?.includes(currentUser.id)) {
          setMessages(prev => prev.filter(msg => msg.id !== updatedMessage.id));
          return;
        }
        const { data: sender } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url')
          .eq('id', updatedMessage.sender_id)
          .single();
        if (!sender) return;
        setMessages(prev => prev.map(msg =>
          msg.id === updatedMessage.id ? { ...updatedMessage, sender } as any : msg
        ));
      })
      .on('postgres_changes', { 
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        if (payload.old?.id) setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats',
        filter: `id=eq.${chatId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.theme_color) setThemeColor(updated.theme_color);
        if (updated.name !== undefined || updated.group_img_url !== undefined) {
          setGroupData((prev: any) => ({ ...prev, ...updated }));
        }
      })
      .on('postgres_changes', { 
        event: 'DELETE',
        schema: 'public',
        table: 'chat_participants',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        if (payload.old?.user_id === currentUser.id) {
          alert('คุณถูกลบออกจากกลุ่มนี้แล้ว');
          onBack();
        } else {
          loadGroupData();
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId]);

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom('auto');
      isInitialLoad.current = false;
    }
  }, [messages]);

  const loadGroupData = async () => {
    try {
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (chatError || !chatData) {
        alert('ไม่พบกลุ่ม หรือคุณไม่ได้เป็นสมาชิกของกลุ่มนี้แล้ว');
        onBack();
        return;
      }

      setGroupData(chatData);
      if (chatData.theme_color) setThemeColor(chatData.theme_color);

      const { data: participants, error: participantsError } = await supabase
        .from('chat_participants')
        .select('role, user_id')
        .eq('chat_id', chatId);

      if (participantsError || !participants || !participants.some(p => p.user_id === currentUser.id)) {
        alert('คุณถูกลบออกจากกลุ่มนี้แล้ว');
        onBack();
        return;
      }

      const userIds = participants.map(p => p.user_id);
      const { data: usersData } = await supabase
        .from('users')
        .select('id, username, display_name, profile_img_url, is_online')
        .in('id', userIds);

      const formattedMembers = participants.map(p => {
        const user = usersData?.find(u => u.id === p.user_id);
        return { ...user, role: p.role };
      }).filter(m => m.id);

      setMembers(formattedMembers);

      const me = formattedMembers.find(m => m.id === currentUser.id);
      setIsAdmin(me?.role === 'admin' || chatData?.created_by === currentUser.id);

      // Load initial messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('id, sender_id, content, images, created_at, updated_at, deleted_by, event')
        .eq('chat_id', chatId)
        .not('deleted_by', 'cs', `{${currentUser.id}}`)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT);

      if (messagesData) {
        setHasMore(messagesData.length === MESSAGE_LIMIT);
        const reversed = [...messagesData].reverse();
        
        const senderIds = [...new Set(
          reversed.filter(m => !m.event && m.sender_id).map(m => m.sender_id)
        )];
        const { data: sendersData } = senderIds.length > 0
          ? await supabase.from('users').select('id, username, display_name, profile_img_url').in('id', senderIds)
          : { data: [] };

        setMessages(reversed.map(msg => ({
          ...msg,
          sender: sendersData?.find(s => s.id === msg.sender_id) || null
        })) as any);
      }
    } catch (error) {
      console.error('Error loading group data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;
    
    setIsLoadingMore(true);
    const oldestMessageDate = messages[0].created_at;
    const scrollContainer = scrollContainerRef.current;
    const previousHeight = scrollContainer?.scrollHeight || 0;

    try {
      const { data: olderMessages } = await supabase
        .from('messages')
        .select('id, sender_id, content, images, created_at, updated_at, deleted_by, event')
        .eq('chat_id', chatId)
        .not('deleted_by', 'cs', `{${currentUser.id}}`)
        .lt('created_at', oldestMessageDate)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT);

      if (olderMessages && olderMessages.length > 0) {
        setHasMore(olderMessages.length === MESSAGE_LIMIT);
        
        const senderIds = [...new Set(
          olderMessages.filter(m => !m.event && m.sender_id).map(m => m.sender_id)
        )];
        const { data: sendersData } = senderIds.length > 0
          ? await supabase.from('users').select('id, username, display_name, profile_img_url').in('id', senderIds)
          : { data: [] };

        const formattedOlder = olderMessages.reverse().map(msg => ({
          ...msg,
          sender: sendersData?.find(s => s.id === msg.sender_id) || null
        }));

        setMessages(prev => [...formattedOlder as any, ...prev]);

        // Restore scroll position
        setTimeout(() => {
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight - previousHeight;
          }
        }, 0);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !isLoadingMore) {
      loadMoreMessages();
    }
  };

  const markAsRead = async () => {
    await supabase
      .from('chat_participants')
      .update({ unread_count: 0, last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', currentUser.id);
    onRefreshChats();
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  };

  const saveThemeColor = async (color: string) => {
    setThemeColor(color);
    setIsSavingColor(true);
    try {
      await supabase.from('chats').update({ theme_color: color }).eq('id', chatId);
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        content: `${currentUser.display_name} เปลี่ยนธีมสีแชท`,
        event: 'theme_change',
      });
    } catch (error) {
      console.error('Error saving theme color:', error);
    } finally {
      setIsSavingColor(false);
    }
  };

  const handleDeleteHistory = async () => {
    if (!confirm('ต้องการลบประวัติข้อความทั้งหมดในกลุ่มนี้?\n(เฉพาะฝั่งของคุณ สมาชิกอื่น ๆ ยังเห็นอยู่)')) return;
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) { setShowMenu(false); return; }

    try {
      const { data: currentMessages } = await supabase
        .from('messages').select('id, deleted_by').in('id', messageIds);

      const updates = currentMessages?.map(msg => {
        const existing: string[] = msg.deleted_by || [];
        if (!existing.includes(currentUser.id)) existing.push(currentUser.id);
        return supabase.from('messages').update({ deleted_by: existing }).eq('id', msg.id);
      }) || [];

      await Promise.all(updates);
      setMessages([]); 
      setShowMenu(false); 
      onRefreshChats();
    } catch (error) {
      alert('ไม่สามารถลบประวัติได้');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('คุณต้องการออกจากกลุ่มใช่หรือไม่?')) return;
    try {
      if (members.length <= 1) {
        await supabase.from('chats').delete().eq('id', chatId);
        onRefreshChats();
        onBack();
        return;
      }

      await supabase.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', currentUser.id);
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        content: `${currentUser.display_name} ออกจากกลุ่ม`,
        event: 'member_left',
      });
      onRefreshChats();
      onBack();
    } catch (error) {
      console.error('Error leaving group:', error);
      alert('ไม่สามารถออกจากกลุ่มได้');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`คุณต้องการลบ ${memberName} ออกจากกลุ่มใช่หรือไม่?`)) return;
    try {
      await supabase.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', memberId);
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        content: `${currentUser.display_name} ลบ ${memberName} ออกจากกลุ่ม`,
        event: 'member_removed',
      });
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (error) {
      console.error('Error removing member:', error);
      alert('ไม่สามารถลบสมาชิกได้');
    }
  };

  const loadFriendsToAdd = async () => {
    setIsLoadingFriends(true);
    setSelectedFriendIds([]);
    try {
      const { data: sent } = await supabase.from('friendships').select('receiver_id').eq('sender_id', currentUser.id).eq('status', 'accepted');
      const { data: received } = await supabase.from('friendships').select('sender_id').eq('receiver_id', currentUser.id).eq('status', 'accepted');
      const allFriendIds = [...new Set([...(sent?.map(f => f.receiver_id) || []), ...(received?.map(f => f.sender_id) || [])])];
      
      const existingMemberIds = members.map(m => m.id);
      const availableFriendIds = allFriendIds.filter(id => !existingMemberIds.includes(id));

      if (availableFriendIds.length === 0) {
        setFriendsToAdd([]);
        return;
      }

      const { data } = await supabase.from('users').select('id, username, display_name, profile_img_url').in('id', availableFriendIds);
      setFriendsToAdd(data || []);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedFriendIds.length === 0) return;
    setIsAddingMembers(true);
    try {
      const newParticipants = selectedFriendIds.map(id => ({
        chat_id: chatId,
        user_id: id,
        role: 'member'
      }));
      await supabase.from('chat_participants').insert(newParticipants);

      const addedFriends = friendsToAdd.filter(f => selectedFriendIds.includes(f.id));
      const addedNames = addedFriends.map(f => f.display_name).join(', ');

      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        content: `${currentUser.display_name} เพิ่ม ${addedNames} เข้าสู่กลุ่ม`,
        event: 'member_added',
      });

      setShowAddMemberModal(false);
      await loadGroupData();
      onRefreshChats();
    } catch (error) {
      console.error('Error adding members:', error);
      alert('ไม่สามารถเพิ่มสมาชิกได้');
    } finally {
      setIsAddingMembers(false);
    }
  };

  const openEditGroup = () => {
    setEditGroupName(groupData.name || '');
    setEditGroupImgUrl(groupData.group_img_url || '');
    setShowEditGroupModal(true);
    setShowMenu(false);
  };

  const saveGroupInfo = async () => {
    if (!editGroupName.trim()) return;
    setIsSavingGroup(true);
    try {
      await supabase.from('chats').update({
        name: editGroupName.trim(),
        group_img_url: editGroupImgUrl.trim() || null
      }).eq('id', chatId);

      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        content: `${currentUser.display_name} อัปเดตข้อมูลกลุ่ม`,
        event: 'group_updated'
      });

      setShowEditGroupModal(false);
    } catch (error) {
      console.error('Error updating group:', error);
      alert('ไม่สามารถอัปเดตข้อมูลกลุ่มได้');
    } finally {
      setIsSavingGroup(false);
    }
  };

  if (isLoading || !groupData) {
    return (
      <div className="h-full flex items-center justify-center">
        <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 animate-bounce" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3 transition-colors duration-300"
        style={{ borderColor: `${themeColor}40` }}>
        <button onClick={onBack} className="md:hidden p-2 hover:bg-gray-100 rounded-full -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowMembersModal(true)}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition text-left"
        >
          <div className="relative flex-shrink-0">
            {groupData.group_img_url ? (
               <img
               src={groupData.group_img_url}
               alt={groupData.name}
               className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
               style={{ borderWidth: 2, borderStyle: 'solid', borderColor: themeColor }}
             />
            ) : (
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: `${themeColor}20`, borderWidth: 2, borderStyle: 'solid', borderColor: themeColor }}>
                <Users className="w-6 h-6" style={{ color: themeColor }} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate hover:underline text-gray-900">
              {groupData.name || 'กลุ่มไม่มีชื่อ'}
            </h3>
            <p className="text-xs text-gray-500">{members.length} สมาชิก</p>
          </div>
        </button>

        <div className="relative">
          <button onClick={() => { setShowColorPicker(!showColorPicker); setShowMenu(false); }}
            className="p-2 hover:bg-gray-100 rounded-full transition" title="เปลี่ยนธีมสี">
            <Palette className="w-5 h-5" style={{ color: themeColor }} />
          </button>
          {showColorPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 z-20 p-4 w-64">
                <p className="text-sm font-semibold text-gray-700 mb-3">เลือกสีธีม</p>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {PRESET_COLORS.map(color => (
                    <button key={color} onClick={() => { saveThemeColor(color); setShowColorPicker(false); }}
                      className="w-10 h-10 rounded-full transition hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: color }}>
                      {themeColor === color && <span className="text-white text-lg font-bold">✓</span>}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-200 cursor-pointer hover:scale-110 transition flex-shrink-0"
                    style={{ backgroundColor: themeColor }} onClick={() => colorInputRef.current?.click()} />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">เลือกสีเอง</p>
                    <input ref={colorInputRef} type="color" value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      onBlur={(e) => { saveThemeColor(e.target.value); setShowColorPicker(false); }}
                      className="w-full h-8 rounded cursor-pointer border border-gray-200" />
                  </div>
                </div>
                {isSavingColor && <p className="text-xs text-gray-400 text-center mt-2">กำลังบันทึก...</p>}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button onClick={() => { setShowMenu(!showMenu); setShowColorPicker(false); }}
            className="p-2 hover:bg-gray-100 rounded-full">
            <MoreVertical className="w-5 h-5" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden">
                <button onClick={() => { setShowMembersModal(true); setShowMenu(false); }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                  <Users className="w-4 h-4" />สมาชิกกลุ่ม
                </button>
                {isAdmin && (
                  <>
                    <button onClick={openEditGroup}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                      <Pencil className="w-4 h-4" />แก้ไขข้อมูลกลุ่ม
                    </button>
                    <button onClick={() => { loadFriendsToAdd(); setShowAddMemberModal(true); setShowMenu(false); }}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                      <UserPlus className="w-4 h-4" />เพิ่มสมาชิก
                    </button>
                  </>
                )}
                <button onClick={handleDeleteHistory}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 border-t border-gray-100">
                  <Trash2 className="w-4 h-4" />ลบประวัติข้อความ
                </button>
                <button onClick={() => { handleLeaveGroup(); setShowMenu(false); }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 border-t border-gray-100">
                  <LogOut className="w-4 h-4" />ออกจากกลุ่ม
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: themeColor }} />
          </div>
        )}
        
        {messages.length === 0 && !isLoadingMore ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Users className="w-20 h-20 mb-4 opacity-30" style={{ color: themeColor }} />
            <p>ยังไม่มีข้อความ</p>
            <p className="text-sm mt-1">เริ่มสนทนากับเพื่อน ๆ ในกลุ่มเลย!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              if (message.event && ['member_added', 'member_removed', 'member_left', 'group_updated', 'group_created'].includes(message.event)) {
                return (
                  <div key={message.id} className="flex items-center justify-center my-2">
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full text-xs text-gray-500">
                      <Users className="w-3 h-3 flex-shrink-0" />
                      <span>{message.content}</span>
                    </div>
                  </div>
                );
              }

              return (
                <MessageBubble
                  key={message.id}
                  message={message as any}
                  isOwn={message.sender_id === currentUser.id}
                  currentUserId={currentUser.id}
                  themeColor={themeColor}
                  showSenderName={true}
                />
              );
            })}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <MessageInput
        chatId={chatId}
        currentUserId={currentUser.id}
        themeColor={themeColor}
        onMessageSent={() => { scrollToBottom(); markAsRead(); }}
      />

      {/* Edit Group Modal */}
      {showEditGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">แก้ไขข้อมูลกลุ่ม</h3>
              <button onClick={() => setShowEditGroupModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ชื่อกลุ่ม</label>
                <input type="text" value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)}
                  placeholder="ชื่อกลุ่ม" maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 text-sm"
                  style={{ '--tw-ring-color': themeColor } as any} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">URL รูปกลุ่ม (ไม่บังคับ)</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0"
                       style={{ borderWidth: 2, borderStyle: 'solid', borderColor: themeColor }}>
                    {editGroupImgUrl ? (
                      <img src={editGroupImgUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = '')} />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <input type="url" value={editGroupImgUrl} onChange={(e) => setEditGroupImgUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 text-sm"
                    style={{ '--tw-ring-color': themeColor } as any} />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button onClick={() => setShowEditGroupModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition">ยกเลิก</button>
              <button 
                onClick={saveGroupInfo} 
                disabled={isSavingGroup || !editGroupName.trim()}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: themeColor }}>
                {isSavingGroup ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">สมาชิกกลุ่ม ({members.length})</h3>
              <button onClick={() => setShowMembersModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <img src={member.profile_img_url || 'https://iili.io/qbtgKBt.png'} alt={member.display_name} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="font-medium text-sm text-gray-900 flex items-center gap-2">
                        {member.display_name} {member.id === currentUser.id && '(คุณ)'}
                        {member.role === 'admin' && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-bold">Admin</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">@{member.username}</p>
                    </div>
                  </div>
                  {isAdmin && member.id !== currentUser.id && (
                    <button 
                      onClick={() => handleRemoveMember(member.id, member.display_name)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                      title="ลบออกจากกลุ่ม"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
               <div className="p-4 border-t border-gray-200">
                 <button 
                  onClick={() => { setShowMembersModal(false); loadFriendsToAdd(); setShowAddMemberModal(true); }}
                  className="w-full py-2.5 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                  style={{ backgroundColor: themeColor }}>
                  <UserPlus className="w-4 h-4" /> เพิ่มสมาชิกใหม่
                 </button>
               </div>
            )}
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMemberModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
         <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[80vh]">
           <div className="p-4 border-b border-gray-200 flex items-center justify-between">
             <h3 className="font-bold text-lg">เพิ่มสมาชิก</h3>
             <button onClick={() => setShowAddMemberModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
               <X className="w-5 h-5" />
             </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4">
             {isLoadingFriends ? (
               <div className="flex justify-center py-8">
                 <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-10 h-10 animate-bounce" />
               </div>
             ) : friendsToAdd.length === 0 ? (
               <div className="text-center text-gray-400 py-8">
                 <p>ไม่มีเพื่อนที่สามารถเพิ่มได้</p>
                 <p className="text-sm mt-1 text-gray-300">(เพื่อนของคุณอยู่ในกลุ่มนี้ครบแล้ว)</p>
               </div>
             ) : (
               <div className="space-y-2">
                 {friendsToAdd.map((friend) => {
                   const isSelected = selectedFriendIds.includes(friend.id);
                   return (
                     <button key={friend.id}
                       onClick={() => setSelectedFriendIds(prev => 
                        prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id]
                       )}
                       className={`w-full p-3 flex items-center gap-3 rounded-xl transition ${isSelected ? 'bg-opacity-10 border-2' : 'hover:bg-gray-50 border-2 border-transparent'}`}
                       style={{ 
                         backgroundColor: isSelected ? `${themeColor}20` : '',
                         borderColor: isSelected ? themeColor : 'transparent' 
                       }}>
                       <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} alt={friend.display_name} className="w-12 h-12 rounded-full object-cover" />
                       <div className="flex-1 text-left">
                         <p className="font-semibold">{friend.display_name}</p>
                         <p className="text-sm text-gray-500">@{friend.username}</p>
                       </div>
                       {isSelected && <Check className="w-5 h-5 flex-shrink-0" style={{ color: themeColor }} />}
                     </button>
                   );
                 })}
               </div>
             )}
           </div>

           <div className="p-4 border-t border-gray-200 flex gap-2">
              <button onClick={() => setShowAddMemberModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition">ยกเลิก</button>
              <button 
                onClick={handleAddMembers} 
                disabled={isAddingMembers || selectedFriendIds.length === 0}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: themeColor }}>
                {isAddingMembers ? 'กำลังเพิ่ม...' : `เพิ่ม ${selectedFriendIds.length > 0 ? `(${selectedFriendIds.length})` : ''}`}
              </button>
            </div>
         </div>
       </div>
      )}
    </div>
  );
}

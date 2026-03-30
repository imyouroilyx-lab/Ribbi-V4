'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  
  const membersRef = useRef<any[]>([]);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    setIsLoading(true);
    setGroupData(null);
    setMessages([]);
    setMembers([]);
    membersRef.current = [];
    setHasMore(true);
    isInitialLoad.current = true;

    loadGroupData();
    markAsRead();
    
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [chatId]);

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom('auto');
      isInitialLoad.current = false;
    }
  }, [messages]);

  const loadGroupData = async () => {
    try {
      const [chatRes, participantsRes] = await Promise.all([
        supabase.from('chats').select('*').eq('id', chatId).single(),
        supabase.from('chat_participants').select('role, user_id').eq('chat_id', chatId)
      ]);

      if (chatRes.error || !chatRes.data) {
        alert('ไม่พบกลุ่ม หรือคุณไม่ได้เป็นสมาชิกแล้ว');
        onBack();
        return;
      }

      const chatData = chatRes.data;
      const participants = participantsRes.data || [];
      setGroupData(chatData);
      if (chatData.theme_color) setThemeColor(chatData.theme_color);

      const userIds = participants.map(p => p.user_id);
      const [usersRes, messagesRes] = await Promise.all([
        supabase.from('users').select('id, username, display_name, profile_img_url, is_online').in('id', userIds),
        supabase.from('messages')
          .select('id, sender_id, content, images, created_at, updated_at, deleted_by, event')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(MESSAGE_LIMIT)
      ]);

      const usersData = usersRes.data || [];
      const formattedMembers = participants.map(p => {
        const user = usersData.find(u => u.id === p.user_id);
        return { ...user, role: p.role };
      }).filter(m => m.id);

      setMembers(formattedMembers);
      membersRef.current = formattedMembers;

      const me = formattedMembers.find(m => m.id === currentUser.id);
      setIsAdmin(me?.role === 'admin' || chatData?.created_by === currentUser.id);

      const messagesData = messagesRes.data;
      if (messagesData) {
        setHasMore(messagesData.length === MESSAGE_LIMIT);
        
        // ✅ ระบุ Type เพื่อป้องกัน Error บน Vercel
        const formattedMessages: Message[] = [];
        for (let i = messagesData.length - 1; i >= 0; i--) {
          const msg = messagesData[i];
          if (!(msg.deleted_by || []).includes(currentUser.id)) {
            formattedMessages.push({
              ...(msg as any),
              sender: formattedMembers.find(m => m.id === msg.sender_id) || null
            });
          }
        }
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading group chat:', error);
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
        .lt('created_at', oldestMessageDate)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT);

      if (olderMessages && olderMessages.length > 0) {
        setHasMore(olderMessages.length === MESSAGE_LIMIT);
        
        // ✅ ระบุ Type เพื่อป้องกัน Error บน Vercel
        const formattedOlder: Message[] = [];
        for (let i = olderMessages.length - 1; i >= 0; i--) {
          const msg = olderMessages[i];
          if (!(msg.deleted_by || []).includes(currentUser.id)) {
            formattedOlder.push({
              ...(msg as any),
              sender: membersRef.current.find(m => m.id === msg.sender_id) || null
            });
          }
        }

        setMessages(prev => [...formattedOlder, ...prev]);

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

  const setupRealtimeSubscription = () => {
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
            loadGroupData();
            return;
          }
          setMessages(prev => [...prev, { ...newMessage, sender: null } as any]);
          scrollToBottom();
          return;
        }

        const sender = membersRef.current.find(m => m.id === newMessage.sender_id) || null;
        
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, { ...newMessage, sender } as any];
        });
        
        if (newMessage.sender_id !== currentUser.id) markAsRead();
        scrollToBottom();
        onRefreshChats();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        const updatedMessage = payload.new as any;
        if (updatedMessage.deleted_by?.includes(currentUser.id)) {
          setMessages(prev => prev.filter(msg => msg.id !== updatedMessage.id));
          return;
        }
        const sender = membersRef.current.find(m => m.id === updatedMessage.sender_id) || null;
        setMessages(prev => prev.map(msg =>
          msg.id === updatedMessage.id ? { ...updatedMessage, sender } as any : msg
        ));
      })
      .on('postgres_changes', { 
        event: 'DELETE',
        schema: 'public',
        table: 'chat_participants',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        if (payload.old?.user_id === currentUser.id) {
          alert('คุณไม่ได้เป็นสมาชิกของกลุ่มนี้แล้ว');
          onBack();
        } else {
          loadGroupData();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats',
        filter: `id=eq.${chatId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.theme_color) setThemeColor(updated.theme_color);
        setGroupData((prev: any) => ({ ...prev, ...updated }));
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
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
    } catch (error) { console.error(error); } finally { setIsSavingColor(false); }
  };

  const handleDeleteHistory = async () => {
    if (!confirm('ต้องการลบประวัติข้อความทั้งหมดในกลุ่มนี้?')) return;
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) { setShowMenu(false); return; }
    try {
      const { data: currentMessages } = await supabase.from('messages').select('id, deleted_by').in('id', messageIds);
      const updates = currentMessages?.map(msg => {
        const existing: string[] = msg.deleted_by || [];
        if (!existing.includes(currentUser.id)) existing.push(currentUser.id);
        return supabase.from('messages').update({ deleted_by: existing }).eq('id', msg.id);
      }) || [];
      await Promise.all(updates);
      setMessages([]); setShowMenu(false); onRefreshChats();
    } catch (error) { alert('ไม่สามารถลบประวัติได้'); }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('คุณต้องการออกจากกลุ่มใช่หรือไม่?')) return;
    try {
      if (members.length <= 1) {
        await supabase.from('chats').delete().eq('id', chatId);
      } else {
        await supabase.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', currentUser.id);
        await supabase.from('messages').insert({
          chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} ออกจากกลุ่ม`, event: 'member_left',
        });
      }
      onRefreshChats(); onBack();
    } catch (error) { alert('ไม่สามารถออกจากกลุ่มได้'); }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`ต้องการลบ ${memberName} ออกจากกลุ่ม?`)) return;
    try {
      await supabase.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', memberId);
      await supabase.from('messages').insert({
        chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} ลบ ${memberName} ออกจากกลุ่ม`, event: 'member_removed',
      });
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (error) { alert('ไม่สามารถลบสมาชิกได้'); }
  };

  const loadFriendsToAdd = async () => {
    setIsLoadingFriends(true);
    setSelectedFriendIds([]);
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select(`
          sender:users!friendships_sender_id_fkey(id, username, display_name, profile_img_url),
          receiver:users!friendships_receiver_id_fkey(id, username, display_name, profile_img_url)
        `)
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .eq('status', 'accepted');

      if (!friendships || friendships.length === 0) {
        setFriendsToAdd([]);
        return;
      }

      const allFriends = friendships.map(f => {
        const sender = f.sender as any;
        const receiver = f.receiver as any;
        return sender.id === currentUser.id ? receiver : sender;
      }).filter(Boolean);

      const existingMemberIds = new Set(members.map(m => m.id));
      const availableFriends = allFriends.filter(f => !existingMemberIds.has(f.id));
      const uniqueAvailableFriends = Array.from(new Map(availableFriends.map(f => [f.id, f])).values());

      setFriendsToAdd(uniqueAvailableFriends);
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsLoadingFriends(false); 
    }
  };

  const handleAddMembers = async () => {
    if (selectedFriendIds.length === 0) return;
    setIsAddingMembers(true);
    try {
      const newParticipants = selectedFriendIds.map(id => ({ chat_id: chatId, user_id: id, role: 'member' }));
      await supabase.from('chat_participants').insert(newParticipants);
      const addedNames = friendsToAdd.filter(f => selectedFriendIds.includes(f.id)).map(f => f.display_name).join(', ');
      await supabase.from('messages').insert({
        chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} เพิ่ม ${addedNames} เข้าสู่กลุ่ม`, event: 'member_added',
      });
      setShowAddMemberModal(false);
      loadGroupData();
      onRefreshChats();
    } catch (error) { alert('ไม่สามารถเพิ่มสมาชิกได้'); } finally { setIsAddingMembers(false); }
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
      await supabase.from('chats').update({ name: editGroupName.trim(), group_img_url: editGroupImgUrl.trim() || null }).eq('id', chatId);
      await supabase.from('messages').insert({
        chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} อัปเดตข้อมูลกลุ่ม`, event: 'group_updated'
      });
      setShowEditGroupModal(false);
    } catch (error) { alert('ไม่สามารถอัปเดตกลุ่มได้'); } finally { setIsSavingGroup(false); }
  };

  if (isLoading || !groupData) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-200 h-full w-full">
        <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 animate-bounce" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-200 overflow-hidden h-full min-h-0 w-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3 transition-colors duration-300 bg-white z-10"
        style={{ borderColor: `${themeColor}40` }}>
        <button onClick={onBack} className="md:hidden p-2 hover:bg-gray-100 rounded-full -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button onClick={() => setShowMembersModal(true)} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition text-left">
          <div className="relative flex-shrink-0">
            {groupData.group_img_url ? (
               <img src={groupData.group_img_url} alt={groupData.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shadow-sm" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: themeColor }} />
            ) : (
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center overflow-hidden shadow-sm" style={{ backgroundColor: `${themeColor}20`, borderWidth: 2, borderStyle: 'solid', borderColor: themeColor }}>
                <Users className="w-6 h-6" style={{ color: themeColor }} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold truncate hover:underline text-gray-900 leading-tight">
              {groupData.name || 'กลุ่มไม่มีชื่อ'}
            </h3>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter">{members.length} MEMBERS</p>
          </div>
        </button>

        <div className="relative flex items-center gap-1">
          <button onClick={() => { setShowColorPicker(!showColorPicker); setShowMenu(false); }}
            className="p-2 hover:bg-gray-100 rounded-full transition" title="เปลี่ยนธีมสี">
            <Palette className="w-5 h-5" style={{ color: themeColor }} />
          </button>
          <button onClick={() => { setShowMenu(!showMenu); setShowColorPicker(false); }} className="p-2 hover:bg-gray-100 rounded-full transition"><MoreVertical className="w-5 h-5 text-gray-500" /></button>
          
          {showColorPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 z-20 p-4 w-64 animate-in zoom-in-95 duration-200">
                <p className="text-sm font-black text-gray-700 mb-3 uppercase tracking-tighter">SELECT THEME</p>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {PRESET_COLORS.map(color => (
                    <button key={color} onClick={() => { saveThemeColor(color); setShowColorPicker(false); }}
                      className="w-10 h-10 rounded-full transition hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: color }}>
                      {themeColor === color && <Check className="text-white w-6 h-6" strokeWidth={4} />}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-200 cursor-pointer hover:scale-110 transition flex-shrink-0"
                    style={{ backgroundColor: themeColor }} onClick={() => colorInputRef.current?.click()} />
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase">Custom</p>
                    <div className="flex items-center gap-2">
                      <input ref={colorInputRef} type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-full h-8 rounded cursor-pointer border border-gray-200 p-0" />
                      <button onClick={() => { saveThemeColor(themeColor); setShowColorPicker(false); }} className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition">OK</button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden animate-in zoom-in-95 duration-200">
                <button onClick={() => { setShowMembersModal(true); setShowMenu(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700 transition-colors"><Users className="w-4 h-4" />สมาชิกกลุ่ม</button>
                {isAdmin && (
                  <>
                    <button onClick={openEditGroup} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700 border-t border-gray-50 transition-colors"><Pencil className="w-4 h-4" />แก้ไขข้อมูลกลุ่ม</button>
                    <button onClick={() => { loadFriendsToAdd(); setShowAddMemberModal(true); setShowMenu(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700 border-t border-gray-50 transition-colors"><UserPlus className="w-4 h-4" />เพิ่มสมาชิก</button>
                  </>
                )}
                <button onClick={handleDeleteHistory} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700 border-t border-gray-50 transition-colors"><Trash2 className="w-4 h-4" />ลบประวัติแชท</button>
                <button onClick={handleLeaveGroup} className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 flex items-center gap-2 font-bold text-red-600 border-t border-red-50 transition-colors"><LogOut className="w-4 h-4" />ออกจากกลุ่ม</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {isLoadingMore && (
          <div className="flex justify-center py-2 sticky top-0 z-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: themeColor }} /></div>
        )}
        {messages.length === 0 && !isLoadingMore ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Users className="w-20 h-20 mb-4 opacity-20" style={{ color: themeColor }} />
            <p className="font-bold">ยังไม่มีข้อความ</p>
            <p className="text-[10px] mt-1 uppercase tracking-widest">Start the conversation</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              if (message.event && ['member_added', 'member_removed', 'member_left', 'group_updated', 'group_created', 'theme_change'].includes(message.event)) {
                return (
                  <div key={message.id} className="flex items-center justify-center my-2 animate-in fade-in duration-300">
                    <div className="px-4 py-1 bg-gray-200/50 rounded-full text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{message.content}</div>
                  </div>
                );
              }
              return (
                <MessageBubble key={message.id} message={message as any} isOwn={message.sender_id === currentUser.id} currentUserId={currentUser.id} themeColor={themeColor} showSenderName={true} />
              );
            })}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <MessageInput chatId={chatId} currentUserId={currentUser.id} themeColor={themeColor} onMessageSent={() => { scrollToBottom(); markAsRead(); }} />

      {/* Modals - Same UI as Nickname Modal in ChatWindow for consistency */}
      {showEditGroupModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-black text-gray-800 tracking-tight">แก้ไขข้อมูลกลุ่ม</h3>
              <button onClick={() => setShowEditGroupModal(false)} className="p-2 hover:bg-white rounded-full transition text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-1">ชื่อกลุ่ม</label>
                <input type="text" value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 text-sm font-bold" style={{ '--tw-ring-color': themeColor } as any} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-1">URL รูปกลุ่ม</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: themeColor }}>
                    {editGroupImgUrl ? <img src={editGroupImgUrl} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = '')} /> : <ImageIcon className="w-5 h-5 text-gray-400" />}
                  </div>
                  <input type="url" value={editGroupImgUrl} onChange={(e) => setEditGroupImgUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 text-xs font-medium" style={{ '--tw-ring-color': themeColor } as any} />
                </div>
              </div>
            </div>
            <div className="p-5 bg-gray-50/50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowEditGroupModal(false)} className="flex-1 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold transition">ยกเลิก</button>
              <button onClick={saveGroupInfo} disabled={isSavingGroup} className="flex-1 py-3 text-white rounded-2xl text-sm font-bold transition disabled:opacity-50 shadow-lg" style={{ backgroundColor: themeColor }}>
                {isSavingGroup ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-black text-gray-800 tracking-tight uppercase text-xs tracking-widest">สมาชิกกลุ่ม ({members.length})</h3>
              <button onClick={() => setShowMembersModal(false)} className="p-2 hover:bg-white rounded-full transition text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-2 overflow-y-auto flex-1 space-y-1">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition group">
                  <div className="flex items-center gap-3">
                    <img src={member.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate flex items-center gap-2">
                        {member.display_name} {member.id === currentUser.id && <span className="text-[9px] text-gray-400 font-normal italic">(Me)</span>}
                        {member.role === 'admin' && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] rounded-full font-black uppercase shadow-sm">Admin</span>}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium tracking-tight">@{member.username}</p>
                    </div>
                  </div>
                  {isAdmin && member.id !== currentUser.id && (
                    <button onClick={() => handleRemoveMember(member.id, member.display_name)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition opacity-0 group-hover:opacity-100"><LogOut size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                <button onClick={() => { setShowMembersModal(false); loadFriendsToAdd(); setShowAddMemberModal(true); }}
                  className="w-full py-3 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
                  style={{ backgroundColor: themeColor }}><UserPlus size={16} /> เพิ่มสมาชิกใหม่</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-black text-gray-800 tracking-tight uppercase text-xs tracking-widest">เชิญเพื่อนเข้ากลุ่ม</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="p-2 hover:bg-white rounded-full transition text-gray-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingFriends ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-frog-500 animate-spin" /></div>
              ) : friendsToAdd.length === 0 ? (
                <div className="text-center text-gray-400 py-12"><p className="font-bold">ไม่มีเพื่อนที่สามารถเพิ่มได้</p><p className="text-[10px] mt-1">(เพื่อนทั้งหมดอยู่ในกลุ่มนี้แล้ว)</p></div>
              ) : (
                <div className="space-y-1">
                  {friendsToAdd.map((friend) => {
                    const isSelected = selectedFriendIds.includes(friend.id);
                    return (
                      <button key={friend.id} onClick={() => setSelectedFriendIds(prev => isSelected ? prev.filter(id => id !== friend.id) : [...prev, friend.id])}
                        className={`w-full p-3 flex items-center gap-3 rounded-2xl transition border-2 ${isSelected ? 'bg-frog-50/50 border-frog-400' : 'hover:bg-gray-50 border-transparent'}`}>
                        <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-bold text-sm">{friend.display_name}</p>
                          <p className="text-[10px] text-gray-400 font-medium">@{friend.username}</p>
                        </div>
                        {isSelected && <div className="w-6 h-6 bg-frog-500 text-white rounded-full flex items-center justify-center shadow-sm"><Check size={14} strokeWidth={4} /></div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-5 bg-gray-50/50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowAddMemberModal(false)} className="flex-1 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold transition">ยกเลิก</button>
              <button onClick={handleAddMembers} disabled={isAddingMembers || selectedFriendIds.length === 0} className="flex-1 py-3 text-white rounded-2xl text-sm font-bold transition disabled:opacity-50 shadow-lg" style={{ backgroundColor: themeColor }}>
                {isAddingMembers ? <Loader2 size={16} className="animate-spin mx-auto" /> : `เพิ่ม (${selectedFriendIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

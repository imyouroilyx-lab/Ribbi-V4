'use client';

import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { Search, Plus, X, Users, Check, Loader2 } from 'lucide-react'; // ✅ เพิ่ม Loader2 ตรงนี้
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Chat } from '@/components/MessagesPage';

interface ChatListProps {
  chats: Chat[];
  currentUserId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onRefresh: () => void;
}

export default function ChatList({ chats, currentUserId, selectedChatId, onSelectChat, onRefresh }: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'dm' | 'group'>('dm');

  // ระบบ Cache เพื่อนเพื่อความลื่นไหล
  const [cachedFriends, setCachedFriends] = useState<any[] | null>(null);
  
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupImgUrl, setGroupImgUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  const sortedAndFilteredChats = useMemo(() => {
    const filtered = chats.filter(chat => {
      const name = chat.is_group
        ? (chat.name || '').toLowerCase()
        : (chat.other_user?.nickname || chat.other_user?.display_name || '').toLowerCase();
      const username = chat.is_group ? '' : (chat.other_user?.username || '').toLowerCase();
      const search = searchQuery.toLowerCase();
      return name.includes(search) || username.includes(search);
    });

    return [...filtered].sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      if (timeB === timeA) return b.id.localeCompare(a.id);
      return timeB - timeA;
    });
  }, [chats, searchQuery]);

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    try { 
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: th }); 
    } catch { return ''; }
  };

  const loadFriendsData = async () => {
    if (cachedFriends && cachedFriends.length > 0) return;
    setIsLoadingFriends(true);
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .eq('status', 'accepted');

      if (!friendships || friendships.length === 0) {
        setCachedFriends([]);
        return;
      }

      const allIds = [...new Set(friendships.map(f => 
        f.sender_id === currentUserId ? f.receiver_id : f.sender_id
      ))];

      const { data: users } = await supabase
        .from('users')
        .select('id, username, display_name, profile_img_url')
        .in('id', allIds);

      setCachedFriends(users || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const dmFriendList = useMemo(() => {
    if (!cachedFriends) return [];
    const existingIds = chats.filter(c => !c.is_group).map(c => c.other_user?.id).filter(Boolean);
    return cachedFriends.filter(f => !existingIds.includes(f.id));
  }, [cachedFriends, chats]);

  const openModal = (mode: 'dm' | 'group') => {
    setModalMode(mode);
    setSelectedFriendId(null);
    setSelectedMemberIds([]);
    setGroupName('');
    setGroupImgUrl('');
    setShowModal(true);
    loadFriendsData();
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFriendId(null);
    setSelectedMemberIds([]);
  };

  const createDM = async () => {
    if (!selectedFriendId) return;
    setIsCreating(true);
    try {
      const { data: newChat, error } = await supabase.from('chats').insert({ is_group: false }).select().single();
      if (error || !newChat) return;
      await supabase.from('chat_participants').insert([
        { chat_id: newChat.id, user_id: currentUserId, role: 'member' },
        { chat_id: newChat.id, user_id: selectedFriendId, role: 'member' },
      ]);
      onRefresh();
      onSelectChat(newChat.id);
      closeModal();
    } finally {
      setIsCreating(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedMemberIds.length === 0) return;
    setIsCreating(true);
    try {
      const { data: newChat, error } = await supabase.from('chats').insert({
        is_group: true,
        name: groupName.trim(),
        group_img_url: groupImgUrl.trim() || null,
        created_by: currentUserId,
      }).select().single();
      if (error || !newChat) return;
      await supabase.from('chat_participants').insert([
        { chat_id: newChat.id, user_id: currentUserId, role: 'admin' },
        ...selectedMemberIds.map(id => ({ chat_id: newChat.id, user_id: id, role: 'member' })),
      ]);
      await supabase.from('messages').insert({
        chat_id: newChat.id, sender_id: currentUserId, content: `สร้างกลุ่ม "${groupName.trim()}"`, event: 'group_created',
      });
      onRefresh();
      onSelectChat(newChat.id);
      closeModal();
    } finally {
      setIsCreating(false);
    }
  };

  const getChatDisplay = (chat: Chat) => {
    if (chat.is_group) {
      return {
        name: chat.name || 'กลุ่มไม่มีชื่อ',
        img: chat.group_img_url,
        isOnline: false,
        isGroup: true,
        memberCount: (chat.members?.length || 0) + 1,
      };
    }
    return {
      name: chat.other_user?.nickname || chat.other_user?.display_name || '',
      img: chat.other_user?.profile_img_url,
      isOnline: chat.other_user?.is_online || false,
      isGroup: false,
      memberCount: 0,
    };
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">ข้อความ</h2>
          <div className="flex gap-1">
            <button onClick={() => openModal('group')} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"><Users className="w-5 h-5" /></button>
            <button onClick={() => openModal('dm')} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"><Plus className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ค้นหาแชท..." className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-full focus:bg-white focus:ring-2 focus:ring-frog-500 transition-all outline-none text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedAndFilteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <p className="text-center">{searchQuery ? 'ไม่พบแชท' : 'ยังไม่มีแชท'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedAndFilteredChats.map((chat) => {
              const display = getChatDisplay(chat);
              return (
                <button key={chat.id} onClick={() => onSelectChat(chat.id)} className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition text-left ${selectedChatId === chat.id ? 'bg-frog-50' : ''}`}>
                  <div className="relative flex-shrink-0">
                    {display.isGroup ? (
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-frog-100 flex items-center justify-center border border-gray-50">
                        {display.img ? <img src={display.img} className="w-full h-full object-cover rounded-full" /> : <Users className="w-6 h-6 text-frog-500" />}
                      </div>
                    ) : (
                      <div className="relative">
                        <img src={display.img || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border border-gray-50" />
                        {display.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 bg-green-500 border-2 border-white rounded-full" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <div className="flex items-center gap-1 min-w-0"><h3 className={`font-bold truncate ${chat.unread_count > 0 ? 'text-gray-900' : 'text-gray-700'}`}>{display.name}</h3>{display.isGroup && <span className="text-[10px] text-gray-400 flex-shrink-0">({display.memberCount})</span>}</div>
                      {chat.last_message_at && <span className="text-[10px] text-gray-400 ml-2 font-medium">{formatTime(chat.last_message_at)}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate ${chat.unread_count > 0 ? 'font-black text-gray-900' : 'text-gray-500'}`}>{chat.last_message_at && <>{chat.last_message_sender_id === currentUserId && <span className="opacity-60">คุณ: </span>}{chat.last_message_content || 'ส่งรูปภาพ'}</>}</p>
                      {chat.unread_count > 0 && <div className="ml-2 min-w-[18px] h-4.5 px-1.5 bg-frog-500 text-white text-[10px] rounded-full flex items-center justify-center font-black shadow-sm">{chat.unread_count > 99 ? '99+' : chat.unread_count}</div>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex gap-1.5 p-1 bg-gray-200 rounded-xl">
                <button onClick={() => setModalMode('dm')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${modalMode === 'dm' ? 'bg-white text-frog-600 shadow-sm' : 'text-gray-500'}`}>แชทส่วนตัว</button>
                <button onClick={() => setModalMode('group')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${modalMode === 'group' ? 'bg-white text-frog-600 shadow-sm' : 'text-gray-500'}`}>สร้างกลุ่ม</button>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-white rounded-full transition text-gray-400"><X size={20} /></button>
            </div>

            {modalMode === 'group' && (
              <div className="p-4 border-b border-gray-100 space-y-3 bg-white">
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="ชื่อกลุ่ม *" maxLength={50} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-frog-500 text-sm font-bold" />
                <input type="url" value={groupImgUrl} onChange={(e) => setGroupImgUrl(e.target.value)} placeholder="URL รูปกลุ่ม" className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-frog-500 text-xs" />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 bg-white">
              {isLoadingFriends ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-frog-500 animate-spin" /></div>
              ) : (modalMode === 'dm' ? dmFriendList : (cachedFriends || [])).length === 0 ? (
                <div className="text-center text-gray-400 py-12"><p className="font-bold text-sm">ไม่มีเพื่อนให้เลือก</p></div>
              ) : (
                <div className="space-y-1">
                  {(modalMode === 'dm' ? dmFriendList : (cachedFriends || [])).map((friend) => {
                    const isSelected = modalMode === 'dm' ? selectedFriendId === friend.id : selectedMemberIds.includes(friend.id);
                    return (
                      <button key={friend.id} onClick={() => modalMode === 'dm' ? setSelectedFriendId(friend.id) : setSelectedMemberIds(prev => isSelected ? prev.filter(id => id !== friend.id) : [...prev, friend.id])} className={`w-full p-3 flex items-center gap-3 rounded-2xl transition-all border-2 ${isSelected ? 'bg-frog-50 border-frog-400' : 'hover:bg-gray-50 border-transparent'}`}>
                        <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" />
                        <div className="flex-1 text-left min-w-0"><p className="font-bold text-sm text-gray-800 truncate">{friend.display_name}</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">@{friend.username}</p></div>
                        {isSelected && (modalMode === 'group' ? <div className="w-6 h-6 bg-frog-500 text-white rounded-full flex items-center justify-center shadow-sm"><Check size={14} strokeWidth={4} /></div> : <div className="w-3 h-3 bg-frog-500 rounded-full animate-pulse"></div>)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <button onClick={modalMode === 'dm' ? createDM : createGroup} disabled={isCreating || (modalMode === 'dm' ? !selectedFriendId : (!groupName.trim() || selectedMemberIds.length === 0))} className="w-full py-3.5 bg-frog-500 text-white rounded-2xl hover:bg-frog-600 disabled:opacity-50 transition-all font-black text-sm shadow-lg active:scale-[0.98]">
                {isCreating ? 'กำลังสร้าง...' : 'ตกลง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

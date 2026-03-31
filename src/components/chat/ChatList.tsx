'use client';

import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { Search, Plus, X, Users, Check, Loader2 } from 'lucide-react'; 
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
// ✅ แก้ไข: Import Type จาก MessagesPage โดยตรง
import type { Chat } from '../MessagesPage'; 

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
      return timeB - timeA;
    });
  }, [chats, searchQuery]);

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    try { return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: th }); } catch { return ''; }
  };

  const loadFriendsData = async () => {
    if (cachedFriends) return;
    setIsLoadingFriends(true);
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select(`
          sender:users!friendships_sender_id_fkey(id, username, display_name, profile_img_url),
          receiver:users!friendships_receiver_id_fkey(id, username, display_name, profile_img_url)
        `)
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .eq('status', 'accepted');

      const friendsList = (friendships || []).map((f: any) => f.sender.id === currentUserId ? f.receiver : f.sender);
      setCachedFriends(friendsList);
    } catch (e) { console.error(e); } finally { setIsLoadingFriends(false); }
  };

  const createDM = async () => {
    if (!selectedFriendId || isCreating) return;
    setIsCreating(true);
    try {
      const { data: newChat } = await supabase.from('chats').insert({ is_group: false }).select().single();
      if (newChat) {
        await supabase.from('chat_participants').insert([
          { chat_id: newChat.id, user_id: currentUserId, role: 'member' },
          { chat_id: newChat.id, user_id: selectedFriendId, role: 'member' }
        ]);
        onRefresh();
        onSelectChat(newChat.id);
        setShowModal(false);
      }
    } finally { setIsCreating(false); }
  };

  const getChatDisplay = (chat: Chat) => {
    if (chat.is_group) return { name: chat.name || 'กลุ่ม', img: chat.group_img_url, isOnline: false, isGroup: true };
    return { 
      name: chat.other_user?.nickname || chat.other_user?.display_name || 'User', 
      img: chat.other_user?.profile_img_url, 
      isOnline: chat.other_user?.is_online || false, 
      isGroup: false 
    };
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">ข้อความ</h2>
          <div className="flex gap-1">
            <button onClick={() => { setModalMode('group'); setShowModal(true); loadFriendsData(); }} className="p-2 hover:bg-gray-100 rounded-full"><Users className="w-5 h-5" /></button>
            <button onClick={() => { setModalMode('dm'); setShowModal(true); loadFriendsData(); }} className="p-2 hover:bg-gray-100 rounded-full"><Plus className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ค้นหาแชท..." className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full outline-none text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y">
        {sortedAndFilteredChats.map((chat) => {
          const display = getChatDisplay(chat);
          return (
            <button key={chat.id} onClick={() => onSelectChat(chat.id)} className={`w-full p-4 flex gap-3 hover:bg-gray-50 ${selectedChatId === chat.id ? 'bg-frog-50' : ''}`}>
              <div className="relative flex-shrink-0">
                <img src={display.img || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover" />
                {display.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-bold truncate text-sm">{display.name}</h3>
                  <span className="text-[10px] text-gray-400">{formatTime(chat.last_message_at)}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{chat.last_message_content || 'ส่งรูปภาพ'}</p>
              </div>
              {chat.unread_count > 0 && <div className="bg-frog-500 text-white text-[10px] rounded-full px-1.5 h-4 flex items-center justify-center font-black">{chat.unread_count}</div>}
            </button>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <span className="font-bold">เริ่มแชทใหม่</span>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingFriends ? <Loader2 className="animate-spin mx-auto" /> : (
                <div className="space-y-2">
                  {(cachedFriends || []).map(friend => (
                    <button key={friend.id} onClick={() => setSelectedFriendId(friend.id)} className={`w-full p-3 flex items-center gap-3 rounded-2xl border-2 ${selectedFriendId === friend.id ? 'border-frog-500 bg-frog-50' : 'border-transparent hover:bg-gray-50'}`}>
                      <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" />
                      <span className="font-bold text-sm">{friend.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button onClick={createDM} disabled={!selectedFriendId || isCreating} className="w-full py-3 bg-frog-500 text-white rounded-2xl font-bold disabled:opacity-50">ตกลง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

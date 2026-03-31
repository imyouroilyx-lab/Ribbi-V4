'use client';

import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { Search, Plus, X, Users, Check, Loader2 } from 'lucide-react'; 
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
// ✅ แก้ไข: ใช้ Path สัมพัทธ์เพื่อความชัวร์ในการ build
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
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  const sortedAndFilteredChats = useMemo(() => {
    return chats.filter(chat => {
      const name = (chat.is_group ? chat.name : (chat.other_user?.nickname || chat.other_user?.display_name)) || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    }).sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
  }, [chats, searchQuery]);

  const loadFriendsData = async () => {
    if (cachedFriends) return;
    setIsLoadingFriends(true);
    try {
      const { data } = await supabase.from('friendships').select(`sender:users!friendships_sender_id_fkey(id, username, display_name, profile_img_url), receiver:users!friendships_receiver_id_fkey(id, username, display_name, profile_img_url)`).or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`).eq('status', 'accepted');
      const list = (data || []).map((f: any) => f.sender?.id === currentUserId ? f.receiver : f.sender).filter(Boolean);
      setCachedFriends(list);
    } catch (e) { console.error(e); } finally { setIsLoadingFriends(false); }
  };

  const createDM = async () => {
    if (!selectedFriendId || isCreating) return;
    setIsCreating(true);
    try {
      const { data: newChat } = await supabase.from('chats').insert({ is_group: false }).select().single();
      if (newChat) {
        await supabase.from('chat_participants').insert([{ chat_id: newChat.id, user_id: currentUserId, role: 'member' }, { chat_id: newChat.id, user_id: selectedFriendId, role: 'member' }]);
        onRefresh(); onSelectChat(newChat.id); setShowModal(false);
      }
    } finally { setIsCreating(false); }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">ข้อความ</h2><div className="flex gap-1"><button onClick={() => { setModalMode('dm'); setShowModal(true); loadFriendsData(); }} className="p-2 hover:bg-gray-100 rounded-full"><Plus className="w-5 h-5" /></button></div></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ค้นหาแชท..." className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full outline-none text-sm" /></div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y">
        {sortedAndFilteredChats.map((chat) => (
          <button key={chat.id} onClick={() => onSelectChat(chat.id)} className={`w-full p-4 flex gap-3 hover:bg-gray-50 ${selectedChatId === chat.id ? 'bg-frog-50' : ''}`}>
            <img src={(chat.is_group ? chat.group_img_url : chat.other_user?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover" />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex justify-between items-baseline"><h3 className="font-bold truncate text-sm">{(chat.is_group ? chat.name : (chat.other_user?.nickname || chat.other_user?.display_name)) || 'Unknown'}</h3><span className="text-[10px] text-gray-400">{chat.last_message_at ? formatDistanceToNow(new Date(chat.last_message_at), { locale: th }) : ''}</span></div>
              <p className="text-xs text-gray-500 truncate">{chat.last_message_content || 'ส่งรูปภาพ'}</p>
            </div>
            {chat.unread_count > 0 && <div className="bg-frog-500 text-white text-[10px] rounded-full px-1.5 h-4 flex items-center justify-center font-black">{chat.unread_count}</div>}
          </button>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center"><b>แชทใหม่</b><button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button></div>
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingFriends ? <Loader2 className="animate-spin mx-auto" /> : (cachedFriends || []).map(f => (
                <button key={f.id} onClick={() => setSelectedFriendId(f.id)} className={`w-full p-3 flex items-center gap-3 rounded-2xl border-2 ${selectedFriendId === f.id ? 'border-frog-500 bg-frog-50' : 'border-transparent'}`}><img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" /><span className="font-bold text-sm">{f.display_name}</span></button>
              ))}
            </div>
            <div className="p-4 border-t"><button onClick={createDM} disabled={!selectedFriendId || isCreating} className="w-full py-3 bg-frog-500 text-white rounded-2xl font-bold">เริ่มแชท</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

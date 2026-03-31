'use client';

import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { Search, Plus, X, Users, Check, Loader2 } from 'lucide-react'; 
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
// ✅ Import Type จาก MessagesPage
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
  const [cachedFriends, setCachedFriends] = useState<any[] | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filteredChats = useMemo(() => {
    return chats.filter(c => {
      const name = (c.is_group ? c.name : (c.other_user?.nickname || c.other_user?.display_name)) || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [chats, searchQuery]);

  const loadFriends = async () => {
    if (cachedFriends) return;
    try {
      const { data } = await supabase.from('friendships').select(`sender:users!friendships_sender_id_fkey(id, username, display_name, profile_img_url), receiver:users!friendships_receiver_id_fkey(id, username, display_name, profile_img_url)`).or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`).eq('status', 'accepted');
      const list = (data || []).map((f: any) => f.sender?.id === currentUserId ? f.receiver : f.sender);
      setCachedFriends(list);
    } catch (e) { console.error(e); }
  };

  const startDM = async () => {
    if (!selectedFriendId || isCreating) return;
    setIsCreating(true);
    try {
      const { data: newChat } = await supabase.from('chats').insert({ is_group: false }).select().single();
      if (newChat) {
        await supabase.from('chat_participants').insert([{ chat_id: newChat.id, user_id: currentUserId }, { chat_id: newChat.id, user_id: selectedFriendId }]);
        onRefresh(); onSelectChat(newChat.id); setShowModal(false);
      }
    } finally { setIsCreating(false); }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">ข้อความ</h2><button onClick={() => { setShowModal(true); loadFriends(); }} className="p-2 hover:bg-gray-100 rounded-full"><Plus size={20} /></button></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ค้นหา..." className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm outline-none" /></div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map(c => (
          <button key={c.id} onClick={() => onSelectChat(c.id)} className={`w-full p-4 flex gap-3 hover:bg-gray-50 ${selectedChatId === c.id ? 'bg-frog-50' : ''}`}>
            <img src={(c.is_group ? c.group_img_url : c.other_user?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover" />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex justify-between items-baseline"><h3 className="font-bold truncate text-sm">{(c.is_group ? c.name : (c.other_user?.nickname || c.other_user?.display_name)) || 'Unknown'}</h3></div>
              <p className="text-xs text-gray-500 truncate">{c.last_message_content || 'ส่งรูปภาพ'}</p>
            </div>
            {c.unread_count > 0 && <div className="bg-frog-500 text-white text-[10px] rounded-full px-1.5 h-4 flex items-center justify-center">{c.unread_count}</div>}
          </button>
        ))}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-4 overflow-hidden flex flex-col">
            <div className="flex justify-between mb-4"><b>แชทใหม่</b><button onClick={() => setShowModal(false)}><X size={20}/></button></div>
            <div className="flex-1 overflow-y-auto max-h-[50vh] space-y-2">
              {(cachedFriends || []).map(f => (
                <button key={f.id} onClick={() => setSelectedFriendId(f.id)} className={`w-full p-3 flex items-center gap-3 rounded-2xl border-2 ${selectedFriendId === f.id ? 'border-frog-500 bg-frog-50' : 'border-transparent hover:bg-gray-50'}`}>
                  <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" />
                  <span className="font-bold text-sm">{f.display_name}</span>
                </button>
              ))}
            </div>
            <button onClick={startDM} disabled={!selectedFriendId || isCreating} className="w-full mt-4 py-3 bg-frog-500 text-white rounded-2xl font-bold">ตกลง</button>
          </div>
        </div>
      )}
    </div>
  );
}

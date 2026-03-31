'use client';

import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { Search, Plus, X, Loader2 } from 'lucide-react'; 
import { useState, useMemo } from 'react';
import type { Chat } from '../MessagesPage'; 

interface ChatListProps {
  chats: Chat[];
  currentUserId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onRefresh: () => void;
}

export default function ChatList({ chats, selectedChatId, onSelectChat }: ChatListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return chats.filter(c => {
      const name = c.is_group ? c.name : c.other_user?.display_name;
      return (name || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [chats, search]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold mb-4">ข้อความ</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." className="w-full p-2 bg-gray-100 rounded-xl text-sm outline-none" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map(c => (
          <button key={c.id} onClick={() => onSelectChat(c.id)} className={`w-full p-4 flex gap-3 hover:bg-gray-50 ${selectedChatId === c.id ? 'bg-frog-50' : ''}`}>
            <img src={(c.is_group ? c.group_img_url : c.other_user?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover" />
            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className="font-bold truncate text-sm">
                  {(c.is_group ? c.name : c.other_user?.display_name) || 'ผู้ใช้ Ribbi'}
                </h3>
              </div>
              <p className="text-xs text-gray-500 truncate">{c.last_message_content || 'ส่งรูปภาพ'}</p>
            </div>
            {c.unread_count > 0 && <div className="bg-frog-500 text-white text-[10px] rounded-full px-1.5 h-4 flex items-center">{c.unread_count}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

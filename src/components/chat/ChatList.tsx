'use client';

import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
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

  const sortedChats = useMemo(() => {
    return chats.filter(c => {
      const name = c.is_group ? c.name : c.other_user?.display_name;
      return (name || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [chats, search]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold mb-4">ข้อความ</h2>
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="ค้นหา..." 
          className="w-full p-2.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-500/20" 
        />
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {sortedChats.map(c => {
          const displayName = c.is_group ? c.name : c.other_user?.display_name;
          const displayImg = c.is_group ? c.group_img_url : c.other_user?.profile_img_url;
          
          return (
            <button 
              key={c.id} 
              onClick={() => onSelectChat(c.id)} 
              className={`w-full p-4 flex gap-3 hover:bg-gray-50 transition-colors ${selectedChatId === c.id ? 'bg-frog-50' : ''}`}
            >
              <div className="relative flex-shrink-0">
                <img src={displayImg || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover shadow-sm" alt="" />
                {!c.is_group && c.other_user?.is_online && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-bold truncate text-sm text-gray-900">{displayName || 'Ribbi User'}</h3>
                  <span className="text-[10px] text-gray-400">
                    {c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: th }) : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{c.last_message_content || 'ส่งรูปภาพ'}</p>
              </div>
              {c.unread_count > 0 && (
                <div className="bg-frog-500 text-white text-[10px] rounded-full px-1.5 h-4 flex items-center justify-center font-black">
                  {c.unread_count}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

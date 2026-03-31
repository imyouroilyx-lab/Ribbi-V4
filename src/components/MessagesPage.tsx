'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatList from './chat/ChatList';
import ChatWindow from './chat/ChatWindow';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export interface Chat {
  id: string;
  is_group: boolean;
  name: string | null;
  group_img_url: string | null;
  last_message_at: string | null;
  last_message_content: string | null;
  unread_count: number;
  other_user?: {
    id: string;
    username: string;
    display_name: string;
    profile_img_url: string | null;
    is_online: boolean;
  };
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ ระบบดูคนออนไลน์ยังทำงานอยู่ (เรียลไทม์)
  const { onlineUsers } = useOnlineStatus(currentUser?.id || null);
  const currentSelectedChat = chats.find(c => c.id === selectedChatId);

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chat');
    if (chatIdFromUrl) setSelectedChatId(chatIdFromUrl);
    
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (userData) {
        setCurrentUser(userData);
        await loadChats(userData.id);
      }
      setIsLoading(false);
    };
    init();
  }, [searchParams]);

  // ❌ ลบ useEffect ที่ฟัง realtime messages ออกหมดแล้วเพื่อปิดระบบแชทเรียลไทม์

  const loadChats = async (userId: string) => {
    try {
      const { data: partData } = await supabase.from('chat_participants').select(`
        chat_id, unread_count, 
        chats:chat_id (*, members:chat_participants (user:user_id (id, username, display_name, profile_img_url)))
      `).eq('user_id', userId);

      if (!partData) return;

      const formatted = partData.map((p: any) => {
        const c = p.chats;
        if (!c) return null;
        const otherMember = c.is_group ? null : c.members.find((m: any) => m.user?.id !== userId)?.user;
        return { 
          ...c, 
          unread_count: p.unread_count || 0, 
          other_user: otherMember ? { 
            ...otherMember, 
            is_online: !!onlineUsers[otherMember.id] // ✅ สถานะออนไลน์ยังเรียลไทม์
          } : undefined 
        };
      }).filter(Boolean) as Chat[];

      setChats(formatted.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()));
    } catch (e) { console.error(e); }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-frog-500" /></div>;

  return (
    <div className="h-[calc(100dvh-64px)] w-full flex bg-white overflow-hidden">
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r flex-col`}>
        <ChatList chats={chats} currentUserId={currentUser?.id} selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} onRefresh={() => loadChats(currentUser?.id)} />
      </div>
      <div className="flex-1 min-w-0">
        {selectedChatId && currentSelectedChat ? (
          <ChatWindow 
            key={selectedChatId} 
            chatId={selectedChatId} 
            chatData={currentSelectedChat}
            currentUser={currentUser} 
            onBack={() => setSelectedChatId(null)} 
            onRefreshChats={() => loadChats(currentUser.id)} 
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-300">
            <MessageSquare size={48} className="opacity-10 mb-4" />
            <p className="font-bold text-xs uppercase tracking-widest">เลือกแชทเพื่อเริ่มคุย</p>
          </div>
        )}
      </div>
    </div>
  );
}

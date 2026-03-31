'use client';

import { useState, useEffect, useRef } from 'react';
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
  last_message_sender_id: string | null;
  other_user?: {
    id: string;
    display_name: string;
    profile_img_url: string | null;
    is_online: boolean;
    nickname?: string;
  };
  unread_count: number;
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { onlineUsers } = useOnlineStatus(currentUser?.id || null);

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chat');
    if (chatIdFromUrl) setSelectedChatId(chatIdFromUrl);
    
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }
      
      const { data: userData } = await supabase.from('users').select('id, username, display_name, profile_img_url').eq('id', authUser.id).single();
      if (userData) {
        setCurrentUser(userData);
        await loadChats(userData.id);
      }
      setIsLoading(false);
    };
    init();
  }, [searchParams]);

  const loadChats = async (userId: string) => {
    if (!userId) return;
    try {
      // 1. ดึงห้องแชทที่ฉันอยู่
      const { data: partData } = await supabase.from('chat_participants')
        .select(`chat_id, unread_count, chats:chat_id(*)`)
        .eq('user_id', userId);

      if (!partData) return;

      // 2. ดึงข้อมูลสมาชิกคนอื่น (เพื่อแก้ปัญหา Unknown)
      const chatIds = partData.map(p => p.chat_id);
      const { data: allMembers } = await supabase.from('chat_participants')
        .select(`chat_id, user:user_id(id, display_name, profile_img_url)`)
        .in('chat_id', chatIds)
        .neq('user_id', userId);

      const memberMap = new Map();
      allMembers?.forEach((m: any) => memberMap.set(m.chat_id, m.user));

      const formatted: Chat[] = partData.map(p => {
        const c = p.chats as any;
        const other = memberMap.get(p.chat_id);
        return {
          ...c,
          unread_count: p.unread_count || 0,
          other_user: c.is_group ? undefined : (other ? { ...other, is_online: !!onlineUsers[other.id] } : undefined)
        };
      }).filter(c => c !== null);

      setChats(formatted.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()));
    } catch (e) { console.error(e); }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-frog-500" /></div>;
  if (!currentUser) return null;

  return (
    <div className="h-[calc(100dvh-64px)] w-full flex bg-white overflow-hidden">
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r flex-col`}>
        <ChatList chats={chats} currentUserId={currentUser.id} selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} onRefresh={() => loadChats(currentUser.id)} />
      </div>
      <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-1`}>
        {selectedChatId ? <ChatWindow chatId={selectedChatId} currentUser={currentUser} onBack={() => setSelectedChatId(null)} onRefreshChats={() => loadChats(currentUser.id)} /> : <div className="flex-1 flex items-center justify-center text-gray-300 uppercase font-black text-xs tracking-widest">Select Chat</div>}
      </div>
    </div>
  );
}

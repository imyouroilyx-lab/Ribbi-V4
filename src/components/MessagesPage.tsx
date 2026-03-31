'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatList from './chat/ChatList';
import ChatWindow from './chat/ChatWindow';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// ✅ บังคับให้หน้าแชทโหลดใหม่ตลอดเวลา (แก้ This page couldn't load)
export const dynamic = 'force-dynamic';

export interface Chat {
  id: string;
  is_group: boolean;
  name: string | null;
  group_img_url: string | null;
  last_message_at: string | null;
  last_message_content: string | null;
  other_user?: {
    id: string;
    display_name: string;
    profile_img_url: string | null;
    is_online: boolean;
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
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { router.push('/login'); return; }
        
        const { data: userData } = await supabase.from('users').select('id, username, display_name, profile_img_url').eq('id', authUser.id).single();
        if (userData) {
          setCurrentUser(userData);
          await loadChats(userData.id);
        }
      } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };
    init();
  }, [searchParams]);

  const loadChats = async (userId: string) => {
    try {
      const { data: partData, error } = await supabase.from('chat_participants')
        .select(`chat_id, unread_count, chats:chat_id(*)`)
        .eq('user_id', userId);

      if (error || !partData) return;

      const chatIds = partData.map(p => p.chat_id);
      const { data: allMembers } = await supabase.from('chat_participants')
        .select(`chat_id, user:user_id(id, display_name, profile_img_url)`)
        .in('chat_id', chatIds)
        .neq('user_id', userId);

      const memberMap = new Map();
      allMembers?.forEach((m: any) => memberMap.set(m.chat_id, m.user));

      const formatted = partData.map(p => {
        const c = p.chats as any;
        if (!c) return null;
        const other = memberMap.get(p.chat_id);
        return {
          ...c,
          unread_count: p.unread_count || 0,
          other_user: c.is_group ? undefined : (other ? { ...other, is_online: !!onlineUsers[other.id] } : undefined)
        };
      }).filter(Boolean) as Chat[];

      setChats(formatted.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()));
    } catch (e) { console.error(e); }
  };

  if (isLoading) return (
    <div className="h-[calc(100dvh-64px)] flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-frog-500 w-10 h-10 mb-4" />
      <p className="text-gray-400 font-black text-[10px] tracking-widest uppercase">System Stabilizing...</p>
    </div>
  );

  return (
    <div className="h-[calc(100dvh-64px)] w-full flex bg-white overflow-hidden">
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r flex-col`}>
        <ChatList chats={chats} currentUserId={currentUser?.id} selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} onRefresh={() => loadChats(currentUser?.id)} />
      </div>
      <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-1 bg-gray-50/30`}>
        {selectedChatId && currentUser ? (
          <ChatWindow chatId={selectedChatId} currentUser={currentUser} onBack={() => setSelectedChatId(null)} onRefreshChats={() => loadChats(currentUser.id)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
            <MessageSquare className="w-20 h-20 opacity-10 mb-4" />
            <p className="font-black text-[10px] tracking-widest uppercase italic">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}

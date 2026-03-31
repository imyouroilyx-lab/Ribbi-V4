'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatList from './chat/ChatList';
import ChatWindow from './chat/ChatWindow';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// ✅ export เพื่อให้ไฟล์อื่นนำไปใช้ได้ (แก้ Build Error)
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
    username: string;
    display_name: string;
    profile_img_url: string | null;
    is_online: boolean;
    nickname?: string;
  };
  members?: { id: string; display_name: string; profile_img_url: string | null; is_online: boolean }[];
  unread_count: number;
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ ใช้ Hook ที่แก้ไขแล้ว
  const { onlineUsers } = useOnlineStatus(currentUser?.id || null);
  const currentUserRef = useRef<any>(null);

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chat');
    if (chatIdFromUrl) setSelectedChatId(chatIdFromUrl);
    
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }
      const { data: userData } = await supabase.from('users').select('id, username, display_name, profile_img_url').eq('id', authUser.id).single();
      if (userData) {
        setCurrentUser(userData);
        currentUserRef.current = userData;
        await loadChats(userData.id);
      }
      setIsLoading(false);
    };
    init();
  }, [searchParams]);

  const loadChats = async (uid: string) => {
    try {
      const { data: participantsData, error } = await supabase.from('chat_participants')
        .select(`chat_id, unread_count, chats:chat_id (id, is_group, name, group_img_url, last_message_at, last_message_content, last_message_sender_id, last_message_id)`)
        .eq('user_id', uid);

      if (error || !participantsData) { setChats([]); return; }

      const result = participantsData.map(p => {
        const c = p.chats as any;
        if (!c) return null;
        return { ...c, unread_count: p.unread_count || 0 };
      }).filter(Boolean) as Chat[];

      setChats(result.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()));
    } catch (err) { console.error(err); }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-screen bg-white"><Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" /><p className="text-gray-400 font-black text-xs tracking-widest uppercase">กำลังเตรียมแชท...</p></div>;
  if (!currentUser) return null;

  return (
    <div className="h-[calc(100dvh-64px)] w-full flex overflow-hidden bg-white">
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r flex-col`}>
        <ChatList chats={chats} currentUserId={currentUser.id} selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} onRefresh={() => loadChats(currentUser.id)} />
      </div>
      <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-1 bg-gray-50/30`}>
        {selectedChatId ? <ChatWindow chatId={selectedChatId} currentUser={currentUser} onBack={() => setSelectedChatId(null)} onRefreshChats={() => loadChats(currentUser.id)} /> : <div className="flex-1 flex flex-col items-center justify-center text-gray-300"><MessageSquare className="w-20 h-20 opacity-20" /><p className="font-black text-xs">เลือกแชทเพื่อเริ่มคุย</p></div>}
      </div>
    </div>
  );
}

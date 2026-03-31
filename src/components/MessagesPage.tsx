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
  my_nickname?: string | null;
  theme_color?: string | null;
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

  const loadChats = async (userId: string) => {
    try {
      const { data: partData, error: partError } = await supabase.from('chat_participants').select(`
        chat_id, unread_count, 
        chats:chat_id (*)
      `).eq('user_id', userId);

      if (partError || !partData) return;

      const chatIds = partData.map((p: any) => p.chat_id);
      
      // ดึงสมาชิกและชื่อเล่น
      const [membersRes, nicknamesRes] = await Promise.all([
        supabase.from('chat_participants').select('chat_id, user:user_id(id, username, display_name, profile_img_url)').in('chat_id', chatIds),
        supabase.from('chat_nicknames').select('*').in('chat_id', chatIds)
      ]);

      const formatted = partData.map((p: any) => {
        const c = p.chats as any;
        if (!c) return null;
        
        const allMembers = membersRes.data?.filter(m => m.chat_id === c.id) || [];
        const otherMember = c.is_group ? null : allMembers.find((m: any) => m.user?.id !== userId)?.user;
        
        const myNickEntry = nicknamesRes.data?.find(n => n.chat_id === c.id && n.target_user_id === userId);
        const otherNickEntry = otherMember ? nicknamesRes.data?.find(n => n.chat_id === c.id && n.target_user_id === otherMember.id) : null;

        return { 
          ...c, 
          unread_count: p.unread_count || 0, 
          my_nickname: myNickEntry?.nickname || null,
          other_user: otherMember ? { 
            ...otherMember, 
            display_name: otherNickEntry?.nickname || otherMember.display_name,
            is_online: !!onlineUsers[otherMember.id]
          } : undefined 
        };
      }).filter(Boolean) as Chat[];

      setChats(formatted.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()));
    } catch (e) { console.error("Load error:", e); }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-frog-500" /></div>;

  return (
    <div className="h-[calc(100dvh-64px)] w-full flex bg-white overflow-hidden">
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r flex-col`}>
        <ChatList chats={chats} currentUserId={currentUser?.id} selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} onRefresh={() => loadChats(currentUser?.id)} />
      </div>
      <div className="flex-1 min-w-0 bg-gray-50/20">
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
            <p className="font-bold text-xs uppercase tracking-[0.3em]">RIBBI CHAT</p>
          </div>
        )}
      </div>
    </div>
  );
}

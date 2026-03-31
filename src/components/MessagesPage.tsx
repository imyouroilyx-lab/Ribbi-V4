'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatList from './chat/ChatList';
import ChatWindow from './chat/ChatWindow';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
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
      // ✅ เพิ่มการดึง username เพื่อให้ลิงก์โปรไฟล์ทำงานได้
      const { data } = await supabase.from('chat_participants').select(`
        unread_count, 
        chats:chat_id (
          *, 
          members:chat_participants (
            user:user_id (id, username, display_name, profile_img_url)
          )
        )
      `).eq('user_id', userId);

      if (!data) return;
      const formatted = data.map((p: any) => {
        const c = p.chats;
        if (!c) return null;
        const otherMember = c.is_group ? null : c.members.find((m: any) => m.user?.id !== userId)?.user;
        return { 
          ...c, 
          unread_count: p.unread_count || 0, 
          other_user: otherMember ? { ...otherMember, is_online: !!onlineUsers[otherMember.id] } : undefined 
        };
      }).filter(Boolean);
      setChats(formatted.sort((a: any, b: any) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()));
    } catch (e) { console.error(e); }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-frog-500" /></div>;
  if (!currentUser) return null;

  return (
    <div className="h-[calc(100dvh-64px)] w-full flex bg-white overflow-hidden">
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r flex-col`}>
        <ChatList chats={chats} currentUserId={currentUser.id} selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} onRefresh={() => loadChats(currentUser.id)} />
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
            <p className="font-bold text-xs uppercase tracking-widest">เลือกแชทเพื่อเริ่มสนทนา</p>
          </div>
        )}
      </div>
    </div>
  );
}

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

  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase.channel('msg-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadChats(currentUser.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_nicknames' }, () => loadChats(currentUser.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => loadChats(currentUser.id))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const loadChats = async (userId: string) => {
    try {
      // ✅ แก้ไข: เพิ่ม chat_id เข้าไปตรงๆ และดึง username มาด้วยเพื่อทำ Link โปรไฟล์
      const { data: partData, error: partError } = await supabase.from('chat_participants').select(`
        chat_id,
        unread_count, 
        chats:chat_id (
          *, 
          members:chat_participants (
            user:user_id (id, username, display_name, profile_img_url)
          )
        )
      `).eq('user_id', userId);

      if (partError || !partData) return;

      const chatIds = partData.map((p: any) => p.chat_id);
      const { data: nicknames } = await supabase.from('chat_nicknames').select('*').in('chat_id', chatIds);

      const formatted = partData.map((p: any) => {
        const c = p.chats as any;
        if (!c) return null;
        
        const otherMember = c.is_group ? null : c.members.find((m: any) => m.user?.id !== userId)?.user;
        const myNick = nicknames?.find(n => n.chat_id === c.id && n.target_user_id === userId)?.nickname;
        const otherNick = otherMember ? nicknames?.find(n => n.chat_id === c.id && n.target_user_id === otherMember.id)?.nickname : null;

        return { 
          ...c, 
          unread_count: p.unread_count || 0, 
          my_nickname: myNick,
          other_user: otherMember ? { 
            ...otherMember, 
            display_name: otherNick || otherMember.display_name,
            is_online: !!onlineUsers[otherMember.id]
          } : undefined 
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
      <div className="flex-1 min-w-0 bg-gray-50/30">
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

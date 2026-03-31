'use client';

import { useState, useEffect, useRef } from 'react';
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
  const currentUserRef = useRef<any>(null);

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chat');
    if (chatIdFromUrl) setSelectedChatId(chatIdFromUrl);
    
    const init = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) { router.push('/login'); return; }

        const { data: userData } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url')
          .eq('id', authData.user.id)
          .single();

        if (userData) {
          setCurrentUser(userData);
          currentUserRef.current = userData;
        }
      } catch (e) { console.error(e); }
    };
    init();
  }, [searchParams]);

  useEffect(() => {
    if (currentUser?.id) {
      loadChats();
      const channel = supabase.channel(`messages-live-${currentUser.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
          loadChats();
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [currentUser?.id]);

  const loadChats = async () => {
    const currentUid = currentUserRef.current?.id;
    if (!currentUid) return;

    try {
      const { data: participantsData, error } = await supabase.from('chat_participants')
        .select(`chat_id, unread_count, chats:chat_id (id, is_group, name, group_img_url, last_message_at, last_message_content, last_message_sender_id, last_message_id)`)
        .eq('user_id', currentUid);

      if (error || !participantsData) { setChats([]); setIsLoading(false); return; }
      
      // ... (โค้ดดึงข้อมูลแบบ Chunk และประมวลผลเหมือนเดิม แต่ใส่ Null Check ทุกจุด)
      setChats(participantsData.map(p => {
         const c = p.chats as any;
         if (!c) return null;
         return { ...c, unread_count: p.unread_count || 0 };
      }).filter(Boolean));
      
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-white">
      <Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" />
      <p className="text-gray-400 font-black text-xs tracking-widest">LOADING MESSAGES...</p>
    </div>
  );
  
  if (!currentUser) return null;

  return (
    <div className="h-[calc(100dvh-64px)] w-full flex overflow-hidden bg-white">
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-gray-100 flex-col`}>
        <ChatList chats={chats} currentUserId={currentUser.id} selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} onRefresh={loadChats} />
      </div>
      <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-1 bg-gray-50/30`}>
        {selectedChatId ? <ChatWindow chatId={selectedChatId} currentUser={currentUser} onBack={() => setSelectedChatId(null)} onRefreshChats={loadChats} /> : <div className="flex-1 flex flex-col items-center justify-center text-gray-300"><MessageSquare className="w-20 h-20 mb-4 opacity-20" /><p className="font-black text-xs uppercase tracking-widest">Select a chat to start</p></div>}
      </div>
    </div>
  );
}

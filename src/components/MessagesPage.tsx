'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatList from './chat/ChatList';
import ChatWindow from './chat/ChatWindow';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// ✅ export interface ให้ไฟล์อื่นเรียกใช้ได้ build ผ่านแน่นอน
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
  const [isMounted, setIsMounted] = useState(false);

  // ✅ เรียกใช้ Hook Presence (ที่แก้ลำดับ .on เรียบร้อยแล้ว)
  const { onlineUsers } = useOnlineStatus(currentUser?.id || null);

  useEffect(() => {
    setIsMounted(true);
    const chatIdFromUrl = searchParams.get('chat');
    if (chatIdFromUrl) setSelectedChatId(chatIdFromUrl);
    
    const init = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { 
          router.push('/login'); 
          return; 
        }

        const { data: userData, error } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url')
          .eq('id', authUser.id)
          .single();

        if (!error && userData) {
          setCurrentUser(userData);
          // ✅ ส่ง ID เข้าไปโหลดแชททันที
          loadChats(userData.id);
        }
      } catch (e) { 
        console.error("Init Error:", e); 
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [searchParams]);

  const loadChats = async (userId: string) => {
    if (!userId) return;
    try {
      const { data: participantsData, error } = await supabase
        .from('chat_participants')
        .select(`
          chat_id, 
          unread_count, 
          chats:chat_id (
            id, is_group, name, group_img_url, 
            last_message_at, last_message_content, 
            last_message_sender_id, last_message_id
          )
        `)
        .eq('user_id', userId);

      if (error || !participantsData) {
        setChats([]);
        return;
      }

      // ปรับโครงสร้างข้อมูลให้ตรงกับ interface
      const formattedChats = participantsData.map((p: any) => {
        const c = p.chats;
        if (!c) return null;
        return {
          ...c,
          unread_count: p.unread_count || 0
        };
      }).filter(Boolean) as Chat[];

      setChats(formattedChats.sort((a, b) => 
        new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
      ));
    } catch (err) {
      console.error("Load Chats Error:", err);
    }
  };

  // ✅ กันพังตอนเริ่มโหลด
  if (!isMounted) return null;

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-[calc(100dvh-64px)] bg-white">
      <Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" />
      <p className="text-gray-400 font-black text-[10px] tracking-widest uppercase italic">
        Ribbi System Loading...
      </p>
    </div>
  );

  return (
    <div className="h-[calc(100dvh-64px)] w-full flex overflow-hidden bg-white">
      {/* ฝั่งรายการแชท */}
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-gray-100 flex-col`}>
        <ChatList 
          chats={chats} 
          currentUserId={currentUser?.id} 
          selectedChatId={selectedChatId} 
          onSelectChat={setSelectedChatId} 
          onRefresh={() => loadChats(currentUser?.id)} 
        />
      </div>

      {/* ฝั่งหน้าต่างคุย */}
      <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-1 bg-gray-50/30`}>
        {selectedChatId && currentUser ? (
          <ChatWindow 
            chatId={selectedChatId} 
            currentUser={currentUser} 
            onBack={() => setSelectedChatId(null)} 
            onRefreshChats={() => loadChats(currentUser.id)} 
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
            <MessageSquare className="w-20 h-20 mb-4 opacity-10" />
            <p className="font-black text-xs tracking-widest uppercase opacity-40 italic">
              Select a message to start conversation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

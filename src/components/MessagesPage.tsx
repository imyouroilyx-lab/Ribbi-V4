'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatList from './chat/ChatList';
import ChatWindow from './chat/ChatWindow';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// ✅ สำคัญ: ต้อง export interface เพื่อให้ไฟล์อื่น build ผ่าน
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

const fetchInChunks = async (table: string, select: string, column: string, ids: string[]) => {
  if (!ids || ids.length === 0) return [];
  const chunkSize = 80;
  const results = [];
  try {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data } = await supabase.from(table).select(select).in(column, chunk);
      if (data) results.push(...data);
    }
  } catch (e) { console.error(`Error fetching ${table}:`, e); }
  return results;
};

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { onlineUsers } = useOnlineStatus(currentUser?.id || null);
  const currentUserRef = useRef<any>(null);

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
          currentUserRef.current = userData;
          await loadChats(userData.id);
        }
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    init();
  }, [searchParams]);

  const loadChats = async (uid: string) => {
    if (!uid) return;
    try {
      const { data: participantsData, error } = await supabase.from('chat_participants')
        .select(`chat_id, unread_count, chats:chat_id (id, is_group, name, group_img_url, last_message_at, last_message_content, last_message_sender_id, last_message_id)`)
        .eq('user_id', uid);

      if (error || !participantsData?.length) { setChats([]); return; }

      const chatIds = participantsData.map(p => p.chat_id);
      const lastMsgIds = participantsData.map(p => (p.chats as any)?.last_message_id).filter(Boolean);

      const [messagesData, allPartsData, nicknamesData] = await Promise.all([
        fetchInChunks('messages', 'id, deleted_by, event', 'id', lastMsgIds),
        fetchInChunks('chat_participants', 'chat_id, user_id', 'chat_id', chatIds),
        fetchInChunks('chat_nicknames', 'chat_id, target_user_id, nickname', 'chat_id', chatIds)
      ]);

      const otherUserIds = [...new Set((allPartsData || []).filter((p: any) => p.user_id !== uid).map((p: any) => p.user_id))];
      const usersData = await fetchInChunks('users', 'id, username, display_name, profile_img_url', 'id', otherUserIds as string[]);
      
      const deletedMap = new Map((messagesData || []).map((m: any) => [m.id, m.deleted_by || []]));
      const nickMap = new Map((nicknamesData || []).map((n: any) => [`${n.chat_id}:${n.target_user_id}`, n.nickname]));
      const userMap = new Map((usersData || []).map((u: any) => [u.id, u]));

      const result = participantsData.map(p => {
        const c = p.chats as any;
        if (!c) return null;
        const memberIds = (allPartsData || []).filter((ap: any) => ap.chat_id === p.chat_id && ap.user_id !== uid).map((ap: any) => ap.user_id);

        if (c.is_group) {
          return { ...c, members: memberIds.map(id => userMap.get(id)).filter(Boolean), unread_count: p.unread_count || 0 };
        } else {
          const otherId = memberIds[0];
          const otherUser = userMap.get(otherId);
          return { ...c, other_user: otherUser ? { ...otherUser, is_online: !!onlineUsers[otherId], nickname: nickMap.get(`${c.id}:${otherId}`) } : null, unread_count: p.unread_count || 0 };
        }
      }).filter(Boolean) as Chat[];

      setChats(result.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()));
    } catch (err) { console.error(err); }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-white">
      <Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" />
      <p className="text-gray-400 font-black text-[10px] tracking-widest uppercase">กำลังเตรียมแชท...</p>
    </div>
  );
  
  if (!currentUser) return null;

  return (
    <div className="h-[calc(100dvh-64px)] w-full flex overflow-hidden bg-white">
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-gray-100 flex-col`}>
        <ChatList chats={chats} currentUserId={currentUser.id} selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} onRefresh={() => loadChats(currentUser.id)} />
      </div>
      <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-1 bg-gray-50/30`}>
        {selectedChatId ? (
          <ChatWindow chatId={selectedChatId} currentUser={currentUser} onBack={() => setSelectedChatId(null)} onRefreshChats={() => loadChats(currentUser.id)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
            <MessageSquare className="w-20 h-20 mb-4 opacity-20" />
            <p className="font-black text-xs tracking-widest uppercase">เลือกข้อความเพื่อเริ่มคุย</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatList from '@/components/chat/ChatList';
import ChatWindow from '@/components/chat/ChatWindow';
import { MessageSquare } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/ribbi.wav');
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Sound play failed:', err));
  } catch (err) {
    console.log('Sound not available:', err);
  }
};

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

  const selectedChatIdRef = useRef<string | null>(null);
  const isWindowFocusedRef = useRef(true);
  const currentUserRef = useRef<any>(null);
  const chatsRef = useRef<Chat[]>([]);

  useOnlineStatus(currentUser?.id || null);

  useEffect(() => { selectedChatIdRef.current = selectedChatId; }, [selectedChatId]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chat');
    if (chatIdFromUrl) {
      setSelectedChatId(chatIdFromUrl);
      selectedChatIdRef.current = chatIdFromUrl;
      localStorage.setItem('lastSelectedChatId', chatIdFromUrl);
    } else {
      const lastChatId = localStorage.getItem('lastSelectedChatId');
      if (lastChatId) {
        setSelectedChatId(lastChatId);
        selectedChatIdRef.current = lastChatId;
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const handleFocus = () => { isWindowFocusedRef.current = true; };
    const handleBlur = () => { isWindowFocusedRef.current = false; };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => { loadCurrentUser(); }, []);

  useEffect(() => {
    if (currentUser) {
      loadChats();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [currentUser]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
    setCurrentUser(userData);
    currentUserRef.current = userData;
  };

  const setupRealtimeSubscription = () => {
    const msgChannel = supabase
      .channel('messages-page-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new as any;
        const user = currentUserRef.current;
        
        if (newMessage?.event) return;
        
        if (payload.eventType === 'INSERT' && newMessage && user) {
          const isMyChat = chatsRef.current.some(c => c.id === newMessage.chat_id);
          
          if (!isMyChat || newMessage.sender_id === user.id) {
            loadChats();
            return;
          }

          const chatId = selectedChatIdRef.current;
          const focused = isWindowFocusedRef.current;
          
          if (newMessage.chat_id !== chatId || !focused) {
            playNotificationSound();
          }
        }
        loadChats();
      })
      .subscribe();

    const nicknameChannel = supabase
      .channel('nicknames-page-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_nicknames' }, () => loadChats())
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(nicknameChannel);
    };
  };

  const loadChats = async () => {
    const user = currentUserRef.current;
    if (!user) return;

    try {
      const { data: participantsData, error } = await supabase
        .from('chat_participants')
        .select(`
          chat_id, unread_count,
          chats (
            id, is_group, name, group_img_url,
            last_message_at, last_message_content,
            last_message_sender_id, last_message_id
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      if (!participantsData || participantsData.length === 0) {
        setChats([]); setIsLoading(false); return;
      }

      const chatIds = participantsData.map(p => p.chat_id);
      const lastMessageIds = participantsData.map(p => (p.chats as any)?.last_message_id).filter(Boolean) as string[];

      const [lastMessagesRes, allParticipantsRes, nicknamesRes] = await Promise.all([
        lastMessageIds.length > 0 ? supabase.from('messages').select('id, deleted_by, event').in('id', lastMessageIds) : Promise.resolve({ data: [] }),
        chatIds.length > 0 ? supabase.from('chat_participants').select('chat_id, user_id').in('chat_id', chatIds) : Promise.resolve({ data: [] }),
        chatIds.length > 0 ? supabase.from('chat_nicknames').select('chat_id, target_user_id, nickname').in('chat_id', chatIds) : Promise.resolve({ data: [] })
      ]);

      const lastMessagesData = lastMessagesRes.data || [];
      const allParticipants = allParticipantsRes.data || [];
      const nicknamesData = nicknamesRes.data || [];

      // Map ข้อมูลข้อความเพื่อความรวดเร็วในการตรวจสอบ
      const deletedByMap: Record<string, string[]> = {};
      const eventMap: Record<string, string | null> = {};
      lastMessagesData.forEach(msg => {
        deletedByMap[msg.id] = msg.deleted_by || [];
        eventMap[msg.id] = msg.event || null;
      });

      const allUserIds = [...new Set(
        allParticipants.map(p => p.user_id).filter(id => id !== user.id)
      )];

      const { data: usersData } = allUserIds.length > 0
        ? await supabase.from('users').select('id, username, display_name, profile_img_url, is_online').in('id', allUserIds)
        : { data: [] };

      // ✅ 1. สร้าง Lookup Map เพื่อแก้ปัญหา N+1 ใน Loop ฝั่ง Client (O(1) Access)
      const userMap = new Map((usersData || []).map(u => [u.id, u]));
      
      const nicknameMap = new Map();
      nicknamesData.forEach(n => {
        // ใช้ key เป็น 'chat_id:target_user_id' เพื่อให้เข้าถึงได้ทันที
        nicknameMap.set(`${n.chat_id}:${n.target_user_id}`, n.nickname);
      });

      const chatParticipantsMap = new Map<string, string[]>();
      allParticipants.forEach(p => {
        if (p.user_id !== user.id) {
          const current = chatParticipantsMap.get(p.chat_id) || [];
          chatParticipantsMap.set(p.chat_id, [...current, p.user_id]);
        }
      });

      const result: Chat[] = [];

      for (const p of participantsData) {
        const chatData = p.chats as any;
        if (!chatData) continue;

        const lastMsgId = chatData.last_message_id;
        const isHidden = lastMsgId ? deletedByMap[lastMsgId]?.includes(user.id) : false;
        const isEvent = lastMsgId ? !!eventMap[lastMsgId] : false;
        const shouldHide = isHidden || isEvent;

        // ✅ 2. ดึงข้อมูลจาก Map โดยตรง ไม่ต้องใช้ .filter() หรือ .find() ซ้ำๆ
        const participantIds = chatParticipantsMap.get(p.chat_id) || [];

        if (chatData.is_group) {
          const members = participantIds
            .map(id => userMap.get(id))
            .filter(Boolean) as any[];

          result.push({
            id: chatData.id || p.chat_id,
            is_group: true,
            name: chatData.name,
            group_img_url: chatData.group_img_url,
            last_message_at: shouldHide ? null : (chatData.last_message_at || null),
            last_message_content: shouldHide ? null : (chatData.last_message_content || null),
            last_message_sender_id: shouldHide ? null : (chatData.last_message_sender_id || null),
            members,
            unread_count: p.unread_count || 0,
          });
        } else {
          const otherParticipantId = participantIds[0];
          const otherUser = userMap.get(otherParticipantId);
          if (!otherUser) continue;

          // ✅ 3. ดึงชื่อเล่นจาก Map ได้ทันที
          const nickname = nicknameMap.get(`${p.chat_id}:${otherUser.id}`);

          result.push({
            id: chatData.id || p.chat_id,
            is_group: false,
            name: null,
            group_img_url: null,
            last_message_at: shouldHide ? null : (chatData.last_message_at || null),
            last_message_content: shouldHide ? null : (chatData.last_message_content || null),
            last_message_sender_id: shouldHide ? null : (chatData.last_message_sender_id || null),
            other_user: { ...otherUser, nickname },
            unread_count: p.unread_count || 0,
          });
        }
      }

      result.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });

      setChats(result);
    } catch (error: any) {
      console.error('Error loading chats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 animate-bounce" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="h-[calc(100dvh-64px)] md:h-[calc(100vh-64px)] w-full flex overflow-hidden bg-white">
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-gray-200 h-full flex-col`}>
        <ChatList
          chats={chats}
          currentUserId={currentUser.id}
          selectedChatId={selectedChatId}
          onSelectChat={(chatId) => {
            setSelectedChatId(chatId);
            selectedChatIdRef.current = chatId;
            localStorage.setItem('lastSelectedChatId', chatId);
          }}
          onRefresh={loadChats}
        />
      </div>

      <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-1 h-full flex-col`}>
        {selectedChatId ? (
          <ChatWindow
            chatId={selectedChatId}
            currentUser={currentUser}
            onBack={() => {
              setSelectedChatId(null);
              selectedChatIdRef.current = null;
              localStorage.removeItem('lastSelectedChatId');
            }}
            onRefreshChats={loadChats}
          />
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="w-20 h-20 mb-4" />
            <p className="text-lg">เลือกแชทเพื่อเริ่มสนทนา</p>
          </div>
        )}
      </div>
    </div>
  );
}

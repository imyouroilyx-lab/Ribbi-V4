'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatList from '@/components/chat/ChatList';
import ChatWindow from '@/components/chat/ChatWindow';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

// ✅ Singleton Audio - โหลดไว้รอเล่นเพื่อความไว
let notificationAudio: HTMLAudioElement | null = null;
if (typeof window !== 'undefined') {
  notificationAudio = new Audio('/sounds/ribbi.wav');
  notificationAudio.volume = 0.5;
  notificationAudio.preload = 'auto';
}

const playNotificationSound = () => {
  if (notificationAudio) {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {});
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

  // Sync refs กับ state เพื่อให้ Realtime Callback ได้ค่าที่สดใหม่เสมอ
  useEffect(() => { selectedChatIdRef.current = selectedChatId; }, [selectedChatId]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);

  // Handle URL Params & LocalStorage
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chat');
    if (chatIdFromUrl) {
      setSelectedChatId(chatIdFromUrl);
      localStorage.setItem('lastSelectedChatId', chatIdFromUrl);
    } else {
      const lastChatId = localStorage.getItem('lastSelectedChatId');
      if (lastChatId) setSelectedChatId(lastChatId);
    }
  }, [searchParams]);

  // Window Focus Detection
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

  useEffect(() => { 
    loadCurrentUser(); 
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadChats();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [currentUser?.id]);

  const loadCurrentUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push('/login'); return; }
    
    // ✅ Optimize: เลือกเฉพาะฟิลด์ที่จำเป็น
    const { data: userData } = await supabase
      .from('users')
      .select('id, username, display_name, profile_img_url')
      .eq('id', authUser.id)
      .single();
    
    setCurrentUser(userData);
    currentUserRef.current = userData;
  };

  // ✅ ระบบ Realtime แบบ Optimistic Update (เด้งทันที ไม่ต้องโหลดใหม่ทั้ง List)
  const setupRealtimeSubscription = () => {
    const msgChannel = supabase
      .channel('messages-page-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new as any;
        if (newMessage?.event) return; // ข้ามพวก system event

        const user = currentUserRef.current;
        const currentChats = [...chatsRef.current];
        if (!user || !newMessage) return;

        const chatIndex = currentChats.findIndex(c => c.id === newMessage.chat_id);

        if (chatIndex !== -1) {
          // --- ✅ CASE: มีห้องแชทนี้อยู่ในรายการอยู่แล้ว (อัปเดตเฉพาะจุด) ---
          const updatedChat = { ...currentChats[chatIndex] };
          updatedChat.last_message_at = newMessage.created_at;
          updatedChat.last_message_content = newMessage.content;
          updatedChat.last_message_sender_id = newMessage.sender_id;
          
          // เล่นเสียงและเพิ่มเลขแจ้งเตือน ถ้าเราไม่ได้เปิดห้องนั้นอยู่
          if (newMessage.sender_id !== user.id) {
            const isNotLooking = newMessage.chat_id !== selectedChatIdRef.current || !isWindowFocusedRef.current;
            if (isNotLooking) {
              updatedChat.unread_count += 1;
              playNotificationSound();
            }
          }

          // ย้ายห้องนี้ขึ้นมาบนสุด
          currentChats.splice(chatIndex, 1);
          currentChats.unshift(updatedChat);
          setChats(currentChats);
        } else {
          // --- ✅ CASE: ห้องแชทใหม่ (ที่ยังไม่อยู่ใน List) ---
          loadChats();
        }
      })
      .subscribe();

    const nicknameChannel = supabase
      .channel('nickname-sync')
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
      // ✅ 1. ดึงข้อมูลพื้นฐาน (Selective)
      const { data: participantsData, error } = await supabase
        .from('chat_participants')
        .select(`
          chat_id, unread_count,
          chats:chat_id (
            id, is_group, name, group_img_url,
            last_message_at, last_message_content,
            last_message_sender_id, last_message_id
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      if (!participantsData?.length) { setChats([]); setIsLoading(false); return; }

      const chatIds = participantsData.map(p => p.chat_id);
      const lastMsgIds = participantsData.map(p => (p.chats as any)?.last_message_id).filter(Boolean);

      // ✅ 2. Parallel Fetch ข้อมูลประกอบ (แก้ N+1)
      const [messagesRes, allPartsRes, nicknamesRes] = await Promise.all([
        lastMsgIds.length > 0 ? supabase.from('messages').select('id, deleted_by, event').in('id', lastMsgIds) : Promise.resolve({ data: [] }),
        supabase.from('chat_participants').select('chat_id, user_id').in('chat_id', chatIds),
        supabase.from('chat_nicknames').select('chat_id, target_user_id, nickname').in('chat_id', chatIds)
      ]);

      // ✅ 3. สร้าง Lookup Maps เพื่อ O(1) Access (หัวใจของความลื่น)
      const deletedMap = new Map(messagesRes.data?.map(m => [m.id, m.deleted_by || []]));
      const eventMap = new Map(messagesRes.data?.map(m => [m.id, !!m.event]));
      const nickMap = new Map(nicknamesRes.data?.map(n => [`${n.chat_id}:${n.target_user_id}`, n.nickname]));
      
      const otherUserIds = [...new Set(allPartsRes.data?.filter(p => p.user_id !== user.id).map(p => p.user_id))];
      const { data: usersData } = await supabase.from('users')
        .select('id, username, display_name, profile_img_url, is_online')
        .in('id', otherUserIds);
      
      const userMap = new Map(usersData?.map(u => [u.id, u]));

      // ✅ 4. ประกอบร่างข้อมูล
      const result: Chat[] = participantsData.map(p => {
        const c = p.chats as any;
        const lastId = c.last_message_id;
        const isHidden = lastId && (deletedMap.get(lastId)?.includes(user.id) || eventMap.get(lastId));
        
        const memberIds = allPartsRes.data?.filter(ap => ap.chat_id === p.chat_id && ap.user_id !== user.id).map(ap => ap.user_id) || [];

        if (c.is_group) {
          return {
            id: c.id,
            is_group: true,
            name: c.name,
            group_img_url: c.group_img_url,
            last_message_at: isHidden ? null : c.last_message_at,
            last_message_content: isHidden ? null : c.last_message_content,
            last_message_sender_id: isHidden ? null : c.last_message_sender_id,
            members: memberIds.map(id => userMap.get(id)).filter(Boolean) as any[],
            unread_count: p.unread_count || 0
          };
        } else {
          const otherId = memberIds[0];
          const otherUser = userMap.get(otherId);
          return {
            id: c.id,
            is_group: false,
            name: null,
            group_img_url: null,
            last_message_at: isHidden ? null : c.last_message_at,
            last_message_content: isHidden ? null : c.last_message_content,
            last_message_sender_id: isHidden ? null : c.last_message_sender_id,
            other_user: otherUser ? { ...otherUser, nickname: nickMap.get(`${c.id}:${otherId}`) } : undefined,
            unread_count: p.unread_count || 0
          };
        }
      }).filter(chat => !(!chat.is_group && !chat.other_user)); // กรองแชทที่หาคู่สนทนาไม่เจอออก

      // Sort ล่าสุดขึ้นก่อน
      result.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
      
      setChats(result);
    } catch (err) {
      console.error('loadChats failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" />
        <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">กำลังเตรียมแชท...</p>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="h-[calc(100dvh-64px)] md:h-[calc(100vh-64px)] w-full flex overflow-hidden bg-white animate-in fade-in duration-500">
      {/* รายชื่อแชท */}
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-gray-100 h-full flex-col`}>
        <ChatList
          chats={chats}
          currentUserId={currentUser.id}
          selectedChatId={selectedChatId}
          onSelectChat={(id) => {
            setSelectedChatId(id);
            localStorage.setItem('lastSelectedChatId', id);
          }}
          onRefresh={loadChats}
        />
      </div>

      {/* หน้าต่างแชท */}
      <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-1 h-full flex-col bg-gray-50/30`}>
        {selectedChatId ? (
          <ChatWindow
            chatId={selectedChatId}
            currentUser={currentUser}
            onBack={() => {
              setSelectedChatId(null);
              localStorage.removeItem('lastSelectedChatId');
            }}
            onRefreshChats={loadChats}
          />
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-300">
            <div className="p-8 bg-white rounded-[3rem] shadow-soft mb-6">
              <MessageSquare className="w-20 h-20 text-frog-100" />
            </div>
            <p className="font-black uppercase tracking-widest text-xs text-gray-400">เลือกข้อความเพื่อเริ่มคุย</p>
          </div>
        )}
      </div>
    </div>
  );
}

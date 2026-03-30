'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical, Trash2, Palette, Pencil, X, Check, MessageCircle, Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import GroupChatWindow from './GroupChatWindow';

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  images: string[] | null;
  created_at: string;
  updated_at?: string | null;
  deleted_by?: string[];
  event?: string | null;
  sender: {
    id: string;
    username: string;
    display_name: string;
    profile_img_url: string | null;
  } | null;
}

interface ChatWindowProps {
  chatId: string;
  currentUser: any;
  onBack: () => void;
  onRefreshChats: () => void;
}

// ✅ เพิ่มฟังก์ชันเล่นเสียงที่ขาดหายไป
const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/ribbi.wav');
    audio.volume = 0.5;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => console.log('Sound play blocked by browser:', err));
    }
  } catch (err) {
    console.log('Sound not available:', err);
  }
};

const PRESET_COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#ef4444', '#14b8a6', '#f59e0b',
  '#6366f1', '#64748b',
];

const MESSAGE_LIMIT = 30;

export default function ChatWindow({ chatId, currentUser, onBack, onRefreshChats }: ChatWindowProps) {
  const router = useRouter();
  const [isGroup, setIsGroup] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setTargetUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [themeColor, setThemeColor] = useState('#22c55e');
  const [isSavingColor, setIsSavingColor] = useState(false);

  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [editingMyNickname, setEditingMyNickname] = useState('');
  const [editingOtherNickname, setEditingOtherNickname] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  // Ref สำหรับเก็บข้อมูลที่ Real-time ต้องใช้โดยไม่ต้องยิง Database ซ้ำ
  const currentUserRef = useRef(currentUser);
  const otherUserRef = useRef<any>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    setIsLoading(true);
    setTargetUser(null);
    setMessages([]);
    setHasMore(true);
    isInitialLoad.current = true;

    loadChatData();
    markAsRead();
    
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [chatId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom('auto');
      isInitialLoad.current = false;
    }
  }, [messages]);

  const loadChatData = async () => {
    try {
      // Parallel Fetching เพื่อความรวดเร็ว
      const [chatRes, participantRes, nicknamesRes] = await Promise.all([
        supabase.from('chats').select('theme_color, is_group').eq('id', chatId).single(),
        supabase.from('chat_participants').select('user_id').eq('chat_id', chatId).neq('user_id', currentUser.id).maybeSingle(),
        supabase.from('chat_nicknames').select('target_user_id, nickname').eq('chat_id', chatId)
      ]);

      if (chatRes.data?.is_group) {
        setIsGroup(true);
        setIsLoading(false);
        return; 
      }
      setIsGroup(false);

      if (chatRes.data?.theme_color) setThemeColor(chatRes.data.theme_color);

      if (nicknamesRes.data) {
        const map: Record<string, string> = {};
        nicknamesRes.data.forEach(n => { map[n.target_user_id] = n.nickname; });
        setNicknames(map);
      }

      if (participantRes.data) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url, is_online')
          .eq('id', participantRes.data.user_id)
          .single();
        if (userData) {
          setTargetUser(userData);
          otherUserRef.current = userData;
        }
      }

      const { data: messagesData } = await supabase
        .from('messages')
        .select('id, sender_id, content, images, created_at, updated_at, deleted_by, event')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT);

      if (messagesData) {
        const visibleMessages = messagesData.filter(m => !(m.deleted_by || []).includes(currentUser.id));
        setHasMore(messagesData.length === MESSAGE_LIMIT);
        const reversed = [...visibleMessages].reverse();
        
        const formatted = reversed.map(msg => ({
          ...msg,
          sender: msg.sender_id === currentUser.id ? currentUser : otherUserRef.current
        }));

        setMessages(formatted as any);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;
    setIsLoadingMore(true);
    const oldestMessageDate = messages[0].created_at;
    const scrollContainer = scrollContainerRef.current;
    const previousHeight = scrollContainer?.scrollHeight || 0;

    try {
      const { data: olderMessages } = await supabase
        .from('messages')
        .select('id, sender_id, content, images, created_at, updated_at, deleted_by, event')
        .eq('chat_id', chatId)
        .lt('created_at', oldestMessageDate)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT);

      if (olderMessages && olderMessages.length > 0) {
        setHasMore(olderMessages.length === MESSAGE_LIMIT);
        const visibleOlder = olderMessages.filter(m => !(m.deleted_by || []).includes(currentUser.id));
        const formattedOlder = [...visibleOlder].reverse().map(msg => ({
          ...msg,
          sender: msg.sender_id === currentUser.id ? currentUser : otherUserRef.current
        }));

        setMessages(prev => [...formattedOlder as any, ...prev]);

        setTimeout(() => {
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight - previousHeight;
          }
        }, 0);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !isLoadingMore) {
      loadMoreMessages();
    }
  };

  const markAsRead = async () => {
    await supabase
      .from('chat_participants')
      .update({ unread_count: 0, last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', currentUser.id);
    onRefreshChats();
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload) => {
        const newMessage = payload.new as any;
        if (newMessage.event) {
          if (newMessage.event === 'nickname_change') {
             const { data: nicks } = await supabase.from('chat_nicknames').select('target_user_id, nickname').eq('chat_id', chatId);
             if (nicks) {
               const map: Record<string, string> = {};
               nicks.forEach(n => { map[n.target_user_id] = n.nickname; });
               setNicknames(map);
             }
          }
          setMessages(prev => [...prev, { ...newMessage, sender: null } as any]);
          scrollToBottom();
          return;
        }
        
        const sender = newMessage.sender_id === currentUserRef.current.id 
          ? currentUserRef.current 
          : otherUserRef.current;
          
        setMessages(prev => [...prev, { ...newMessage, sender } as any]);
        
        if (newMessage.sender_id !== currentUserRef.current.id) {
          markAsRead();
          playNotificationSound(); // ✅ เรียกใช้ฟังก์ชันที่เพิ่มเข้ามา
        }
        scrollToBottom();
        onRefreshChats();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        const updatedMessage = payload.new as any;
        if (updatedMessage.deleted_by?.includes(currentUserRef.current.id)) {
          setMessages(prev => prev.filter(msg => msg.id !== updatedMessage.id));
          return;
        }
        const sender = updatedMessage.sender_id === currentUserRef.current.id ? currentUserRef.current : otherUserRef.current;
        setMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? { ...updatedMessage, sender } as any : msg));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        if (payload.old?.id) setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats',
        filter: `id=eq.${chatId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.theme_color) setThemeColor(updated.theme_color);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  };

  const saveThemeColor = async (color: string) => {
    setThemeColor(color);
    setIsSavingColor(true);
    try {
      await supabase.from('chats').update({ theme_color: color }).eq('id', chatId);
      await supabase.from('messages').insert({
        chat_id: chatId, sender_id: currentUser.id,
        content: `${nicknames[currentUser.id] || currentUser.display_name} เปลี่ยนธีมสีแชท`,
        event: 'theme_change',
      });
    } catch (error) { console.error(error); } finally { setIsSavingColor(false); }
  };

  const saveNicknames = async () => {
    if (!otherUser) return;
    setIsSavingNickname(true);
    try {
      const myNewNick = editingMyNickname.trim();
      const otherNewNick = editingOtherNickname.trim();
      const promises = [];
      if (myNewNick) promises.push(supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: currentUser.id, nickname: myNewNick }, { onConflict: 'chat_id,target_user_id' }));
      else promises.push(supabase.from('chat_nicknames').delete().eq('chat_id', chatId).eq('target_user_id', currentUser.id));
      if (otherNewNick) promises.push(supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: otherUser.id, nickname: otherNewNick }, { onConflict: 'chat_id,target_user_id' }));
      else promises.push(supabase.from('chat_nicknames').delete().eq('chat_id', chatId).eq('target_user_id', otherUser.id));
      await Promise.all(promises);
      const changedParts: string[] = [];
      if (myNewNick && myNewNick !== nicknames[currentUser.id]) changedParts.push(`${currentUser.display_name} → "${myNewNick}"`);
      if (otherNewNick && otherNewNick !== nicknames[otherUser.id]) changedParts.push(`${otherUser.display_name} → "${otherNewNick}"`);
      if (changedParts.length > 0) {
        await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${nicknames[currentUser.id] || currentUser.display_name} ตั้งชื่อเล่น: ${changedParts.join(', ')}`, event: 'nickname_change' });
      }
      const { data: nicks } = await supabase.from('chat_nicknames').select('target_user_id, nickname').eq('chat_id', chatId);
      if (nicks) { const map: Record<string, string> = {}; nicks.forEach(n => { map[n.target_user_id] = n.nickname; }); setNicknames(map); }
      setShowNicknameModal(false);
      onRefreshChats();
    } catch (error) { alert('ล้มเหลว'); } finally { setIsSavingNickname(false); }
  };

  const handleDeleteHistory = async () => {
    if (!confirm('ลบประวัติ?')) return;
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) return;
    try {
      const { data: currentMessages } = await supabase.from('messages').select('id, deleted_by').in('id', messageIds);
      const updates = currentMessages?.map(msg => {
        const existing: string[] = msg.deleted_by || [];
        if (!existing.includes(currentUser.id)) existing.push(currentUser.id);
        return supabase.from('messages').update({ deleted_by: existing }).eq('id', msg.id);
      }) || [];
      await Promise.all(updates);
      setMessages([]); setShowMenu(false); onRefreshChats();
    } catch (err) { console.error(err); }
  };

  if (isLoading || isGroup === null) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white md:rounded-2xl h-full w-full">
        <img src="https://iili.io/qbtgKBt.png" className="w-16 h-16 animate-bounce" />
      </div>
    );
  }

  if (isGroup) {
    return <GroupChatWindow chatId={chatId} currentUser={currentUser} onBack={onBack} onRefreshChats={onRefreshChats} />;
  }

  if (!otherUser) {
    return <div className="flex flex-1 items-center justify-center text-gray-400 bg-white md:rounded-2xl h-full w-full"><p>ไม่พบแชทนี้</p></div>;
  }

  const displayOtherName = nicknames[otherUser.id] || otherUser.display_name;

  return (
    <div className="flex flex-col flex-1 bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-200 overflow-hidden h-full min-h-0 w-full">
      <div className="flex-shrink-0 p-4 border-b flex items-center gap-3 bg-white z-10" style={{ borderColor: `${themeColor}40` }}>
        <button onClick={onBack} className="md:hidden p-2 hover:bg-gray-100 rounded-full -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <button onClick={() => router.push(`/profile/${otherUser.username}`)} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition text-left">
          <div className="relative flex-shrink-0">
            <img src={otherUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: themeColor }} />
            {otherUser.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
          </div>
          <div className="min-w-0"><h3 className="font-semibold truncate text-gray-900">{displayOtherName}{nicknames[otherUser.id] && <span className="text-xs text-gray-400 font-normal ml-1">({otherUser.display_name})</span>}</h3><p className="text-xs text-gray-500">{otherUser.is_online ? 'ออนไลน์' : 'ออฟไลน์'}</p></div>
        </button>
        <div className="relative flex items-center gap-1">
          <button onClick={() => { setShowColorPicker(!showColorPicker); setShowMenu(false); }} className="p-2 hover:bg-gray-100 rounded-full transition"><Palette className="w-5 h-5" style={{ color: themeColor }} /></button>
          <button onClick={() => { setShowMenu(!showMenu); setShowColorPicker(false); }} className="p-2 hover:bg-gray-100 rounded-full"><MoreVertical className="w-5 h-5" /></button>
          {showColorPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 z-20 p-4 w-64 animate-in zoom-in-95 duration-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">เลือกสีธีม</p>
                <div className="grid grid-cols-5 gap-2 mb-4">{PRESET_COLORS.map(color => (<button key={color} onClick={() => { saveThemeColor(color); setShowColorPicker(false); }} className="w-10 h-10 rounded-full transition hover:scale-110 flex items-center justify-center" style={{ backgroundColor: color }}>{themeColor === color && <span className="text-white text-lg font-bold">✓</span>}</button>))}</div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-200 cursor-pointer hover:scale-110 transition flex-shrink-0" style={{ backgroundColor: themeColor }} onClick={() => colorInputRef.current?.click()} />
                  <div className="flex-1"><p className="text-xs text-gray-500 mb-1">เลือกสีเอง</p><div className="flex items-center gap-2"><input ref={colorInputRef} type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-full h-8 rounded cursor-pointer border border-gray-200 p-0" /><button onClick={() => { saveThemeColor(themeColor); setShowColorPicker(false); }} className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition">OK</button></div></div>
                </div>
              </div>
            </>
          )}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden animate-in zoom-in-95 duration-200">
                <button onClick={() => { setEditingMyNickname(nicknames[currentUser.id] || ''); setEditingOtherNickname(nicknames[otherUser.id] || ''); setShowNicknameModal(true); setShowMenu(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"><Pencil className="w-4 h-4" />ตั้งชื่อเล่น</button>
                <button onClick={handleDeleteHistory} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 border-t border-gray-50"><Trash2 className="w-4 h-4" />ลบประวัติข้อความ</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-slate-50/30">
        {isLoadingMore && (<div className="flex justify-center py-2 sticky top-0 z-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: themeColor }} /></div>)}
        {messages.length === 0 && !isLoadingMore ? (<div className="flex flex-col items-center justify-center h-full text-gray-400"><MessageCircle className="w-16 h-16 mb-4 opacity-20" /><p className="font-bold">ยังไม่มีข้อความ</p></div>) : (
          <>{messages.map((message) => (<MessageBubble key={message.id} message={message as any} isOwn={message.sender_id === currentUser.id} currentUserId={currentUser.id} themeColor={themeColor} />))}<div ref={messagesEndRef} /></>
        )}
      </div>
      <MessageInput chatId={chatId} currentUserId={currentUser.id} themeColor={themeColor} onMessageSent={() => { scrollToBottom(); markAsRead(); }} />
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50"><h3 className="font-black text-gray-800 tracking-tight">ตั้งชื่อเล่น</h3><button onClick={() => setShowNicknameModal(false)} className="p-2 hover:bg-white rounded-full transition shadow-sm"><X size={5} className="w-5 h-5 text-gray-400" /></button></div>
            <div className="p-6 space-y-5">
              <div><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-1">ชื่อเล่นของคุณ</label><input type="text" value={editingMyNickname} onChange={(e) => setEditingMyNickname(e.target.value)} placeholder={currentUser.display_name} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 text-sm font-bold" style={{ '--tw-ring-color': themeColor } as any} maxLength={30} /></div>
              <div><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-1">ชื่อเล่นของคู่สนทนา</label><input type="text" value={editingOtherNickname} onChange={(e) => setEditingOtherNickname(e.target.value)} placeholder={otherUser.display_name} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 text-sm font-bold" style={{ '--tw-ring-color': themeColor } as any} maxLength={30} /></div>
            </div>
            <div className="p-5 bg-gray-50/50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowNicknameModal(false)} className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-100 rounded-2xl text-sm font-bold transition">ยกเลิก</button>
              <button onClick={saveNicknames} disabled={isSavingNickname} className="flex-1 py-3 text-white rounded-2xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg" style={{ backgroundColor: themeColor }}>{isSavingNickname ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

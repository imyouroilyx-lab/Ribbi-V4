'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical, Trash2, Palette, Pencil, X, Check, MessageCircle, Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
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
  sender: { id: string; username: string; display_name: string; profile_img_url: string | null; } | null;
}

interface ChatWindowProps {
  chatId: string;
  currentUser: any;
  onBack: () => void;
  onRefreshChats: () => void;
}

const PRESET_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#ef4444', '#14b8a6', '#f59e0b', '#6366f1', '#64748b'];
const MESSAGE_LIMIT = 30;

export default function ChatWindow({ chatId, currentUser, onBack, onRefreshChats }: ChatWindowProps) {
  const router = useRouter();
  const [isGroup, setIsGroup] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setTargetUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [themeColor, setThemeColor] = useState('#22c55e');
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [editingMyNickname, setEditingMyNickname] = useState('');
  const [editingOtherNickname, setEditingOtherNickname] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const currentUserRef = useRef(currentUser);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    setIsLoading(true); setTargetUser(null); setMessages([]); setHasMore(true); isInitialLoad.current = true;
    loadChatData();
    markAsRead();
    const channel = setupRealtimeSubscription();
    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom('auto');
      isInitialLoad.current = false;
    }
  }, [messages]);

  const loadChatData = async () => {
    try {
      const [chatRes, participantRes, nicknamesRes, messagesRes] = await Promise.all([
        supabase.from('chats').select('theme_color, is_group').eq('id', chatId).single(),
        supabase.from('chat_participants').select('user_id, users(id, username, display_name, profile_img_url, is_online)').eq('chat_id', chatId).neq('user_id', currentUser.id).maybeSingle(),
        supabase.from('chat_nicknames').select('target_user_id, nickname').eq('chat_id', chatId),
        supabase.from('messages').select('id, sender_id, content, images, created_at, updated_at, deleted_by, event').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(MESSAGE_LIMIT)
      ]);

      if (chatRes.data?.is_group) { setIsGroup(true); setIsLoading(false); return; }
      setIsGroup(false);

      if (chatRes.data?.theme_color) setThemeColor(chatRes.data.theme_color);
      if (nicknamesRes.data) {
        const map: Record<string, string> = {};
        nicknamesRes.data.forEach(n => { map[n.target_user_id] = n.nickname; });
        setNicknames(map);
      }
      if (participantRes.data?.users) setTargetUser(participantRes.data.users);

      const msgData = messagesRes.data || [];
      setHasMore(msgData.length === MESSAGE_LIMIT);
      const formatted = msgData.reverse()
        .filter(m => !(m.deleted_by || []).includes(currentUser.id))
        .map(m => ({ ...m, sender: m.sender_id === currentUser.id ? currentUser : participantRes.data?.users }));
      setMessages(formatted as any);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const setupRealtimeSubscription = () => {
    return supabase.channel(`chat-room-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        const newMessage = payload.new as any;
        setMessages(prev => [...prev, { ...newMessage, sender: newMessage.sender_id === currentUserRef.current.id ? currentUserRef.current : otherUser } as any]);
        if (newMessage.sender_id !== currentUserRef.current.id) markAsRead();
        scrollToBottom();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${chatId}` }, (payload) => {
        if (payload.new.theme_color) setThemeColor(payload.new.theme_color);
      })
      .subscribe();
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior }); }, 100);
  };

  const markAsRead = async () => {
    await supabase.from('chat_participants').update({ unread_count: 0, last_read_at: new Date().toISOString() }).eq('chat_id', chatId).eq('user_id', currentUser.id);
    onRefreshChats();
  };

  const saveThemeColor = async (color: string) => {
    setThemeColor(color);
    await supabase.from('chats').update({ theme_color: color }).eq('id', chatId);
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
      loadChatData();
      setShowNicknameModal(false);
    } catch (e) { alert('พัง'); } finally { setIsSavingNickname(false); }
  };

  if (isLoading || isGroup === null) return (
    <div className="flex flex-1 items-center justify-center bg-white md:rounded-2xl h-full w-full">
      <img src="https://iili.io/qbtgKBt.png" className="w-16 h-16 animate-bounce" />
    </div>
  );

  if (isGroup) return <GroupChatWindow chatId={chatId} currentUser={currentUser} onBack={onBack} onRefreshChats={onRefreshChats} />;
  if (!otherUser) return <div className="flex flex-1 items-center justify-center text-gray-400 bg-white h-full w-full"><p>ไม่พบแชทนี้</p></div>;

  const displayOtherName = nicknames[otherUser.id] || otherUser.display_name;

  return (
    <div className="flex flex-col flex-1 bg-white md:rounded-2xl md:shadow-sm md:border border-gray-200 overflow-hidden h-full w-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b flex items-center justify-between bg-white z-10" style={{ borderColor: `${themeColor}40` }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="md:hidden p-2 hover:bg-gray-100 rounded-full -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <div className="relative flex-shrink-0">
            <img src={otherUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover" style={{ border: `2px solid ${themeColor}` }} />
            {otherUser.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold truncate text-gray-900">{displayOtherName}</h3>
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{otherUser.is_online ? 'Online' : 'Offline'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-2 hover:bg-gray-50 rounded-full transition"><Palette className="w-5 h-5" style={{ color: themeColor }} /></button>
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-50 rounded-full transition"><MoreVertical className="w-5 h-5" /></button>
          
          {showColorPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-20 p-4 w-64 animate-in zoom-in-95">
                <p className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3">Theme Color</p>
                <div className="grid grid-cols-5 gap-2">{PRESET_COLORS.map(c => (<button key={c} onClick={() => saveThemeColor(c)} className="w-10 h-10 rounded-full transition hover:scale-110" style={{ backgroundColor: c }}>{themeColor === c && <Check className="w-4 h-4 text-white mx-auto" />}</button>))}</div>
              </div>
            </>
          )}
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden animate-in zoom-in-95">
                <button onClick={() => { setShowNicknameModal(true); setShowMenu(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-bold"><Pencil className="w-4 h-4" /> ตั้งชื่อเล่น</button>
                <button className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-500 font-bold border-t border-gray-50"><Trash2 className="w-4 h-4" /> ลบประวัติ</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <MessageCircle className="w-16 h-16 mb-2 opacity-20" />
            <p className="font-black text-xs uppercase tracking-widest">No messages yet</p>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m as any} isOwn={m.sender_id === currentUser.id} currentUserId={currentUser.id} themeColor={themeColor} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <MessageInput chatId={chatId} currentUserId={currentUser.id} themeColor={themeColor} onMessageSent={scrollToBottom} />

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-black text-gray-800 tracking-tight italic">NICKNAMES</h3>
              <button onClick={() => setShowNicknameModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Your Nickname</label><input type="text" value={editingMyNickname} onChange={(e) => setEditingMyNickname(e.target.value)} placeholder={currentUser.display_name} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 font-bold text-sm" style={{ '--tw-ring-color': themeColor } as any} /></div>
              <div><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Friend's Nickname</label><input type="text" value={editingOtherNickname} onChange={(e) => setEditingOtherNickname(e.target.value)} placeholder={otherUser.display_name} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 font-bold text-sm" style={{ '--tw-ring-color': themeColor } as any} /></div>
            </div>
            <div className="p-5 bg-gray-50/50 border-t flex gap-3">
              <button onClick={() => setShowNicknameModal(false)} className="flex-1 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-black transition">CANCEL</button>
              <button onClick={saveNicknames} disabled={isSavingNickname} className="flex-1 py-3 text-white rounded-2xl text-xs font-black transition shadow-lg flex items-center justify-center gap-2" style={{ backgroundColor: themeColor }}>{isSavingNickname ? <Loader2 className="w-4 h-4 animate-spin" /> : 'SAVE'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

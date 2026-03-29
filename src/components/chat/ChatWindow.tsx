'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical, Trash2, Palette, Pencil, X, Check } from 'lucide-react';
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

const PRESET_COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#ef4444', '#14b8a6', '#f59e0b',
  '#6366f1', '#64748b',
];

export default function ChatWindow({ chatId, currentUser, onBack, onRefreshChats }: ChatWindowProps) {
  const router = useRouter();
  const [isGroup, setIsGroup] = useState<boolean | null>(null); // null = loading
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
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
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadChatData();
    markAsRead();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatData = async () => {
    try {
      // ✅ ดึง is_group ก่อน
      const { data: chatData } = await supabase
        .from('chats')
        .select('theme_color, is_group')
        .eq('id', chatId)
        .single();

      if (chatData?.is_group) {
        setIsGroup(true);
        setIsLoading(false);
        return; // ส่งให้ GroupChatWindow จัดการแทน
      }
      setIsGroup(false);

      if (chatData?.theme_color) setThemeColor(chatData.theme_color);

      const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chatId)
        .neq('user_id', currentUser.id)
        .single();

      if (participants) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url, is_online')
          .eq('id', participants.user_id)
          .single();
        if (userData) setOtherUser(userData);
      }

      await loadNicknames();

      const { data: messagesData } = await supabase
        .from('messages')
        .select('id, sender_id, content, images, created_at, updated_at, deleted_by, event')
        .eq('chat_id', chatId)
        .not('deleted_by', 'cs', `{${currentUser.id}}`)
        .order('created_at', { ascending: true });

      if (messagesData) {
        const senderIds = [...new Set(
          messagesData.filter(m => !m.event && m.sender_id).map(m => m.sender_id)
        )];
        const { data: sendersData } = senderIds.length > 0
          ? await supabase.from('users').select('id, username, display_name, profile_img_url').in('id', senderIds)
          : { data: [] };

        setMessages(messagesData.map(msg => ({
          ...msg,
          sender: sendersData?.find(s => s.id === msg.sender_id) || null
        })) as any);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadNicknames = async () => {
    const { data } = await supabase
      .from('chat_nicknames')
      .select('target_user_id, nickname')
      .eq('chat_id', chatId);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(n => { map[n.target_user_id] = n.nickname; });
      setNicknames(map);
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
          if (newMessage.event === 'nickname_change') await loadNicknames();
          setMessages(prev => [...prev, { ...newMessage, sender: null } as any]);
          scrollToBottom();
          return;
        }
        const { data: sender } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url')
          .eq('id', newMessage.sender_id)
          .single();
        if (!sender) return;
        setMessages(prev => [...prev, { ...newMessage, sender } as any]);
        markAsRead();
        scrollToBottom();
        onRefreshChats();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload) => {
        const updatedMessage = payload.new as any;
        if (updatedMessage.deleted_by?.includes(currentUser.id)) {
          setMessages(prev => prev.filter(msg => msg.id !== updatedMessage.id));
          return;
        }
        const { data: sender } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url')
          .eq('id', updatedMessage.sender_id)
          .single();
        if (!sender) return;
        setMessages(prev => prev.map(msg =>
          msg.id === updatedMessage.id ? { ...updatedMessage, sender } as any : msg
        ));
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

    return () => supabase.removeChannel(channel);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const saveThemeColor = async (color: string) => {
    setThemeColor(color);
    setIsSavingColor(true);
    try {
      await supabase.from('chats').update({ theme_color: color }).eq('id', chatId);
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        content: `${nicknames[currentUser.id] || currentUser.display_name} เปลี่ยนธีมสีแชท`,
        event: 'theme_change',
      });
    } catch (error) {
      console.error('Error saving theme color:', error);
    } finally {
      setIsSavingColor(false);
    }
  };

  const saveNicknames = async () => {
    if (!otherUser) return;
    setIsSavingNickname(true);
    try {
      const myNewNick = editingMyNickname.trim();
      const otherNewNick = editingOtherNickname.trim();

      if (myNewNick) {
        await supabase.from('chat_nicknames').upsert({
          chat_id: chatId, target_user_id: currentUser.id, nickname: myNewNick,
        }, { onConflict: 'chat_id,target_user_id' });
      } else {
        await supabase.from('chat_nicknames').delete().eq('chat_id', chatId).eq('target_user_id', currentUser.id);
      }

      if (otherNewNick) {
        await supabase.from('chat_nicknames').upsert({
          chat_id: chatId, target_user_id: otherUser.id, nickname: otherNewNick,
        }, { onConflict: 'chat_id,target_user_id' });
      } else {
        await supabase.from('chat_nicknames').delete().eq('chat_id', chatId).eq('target_user_id', otherUser.id);
      }

      const changedParts: string[] = [];
      if (myNewNick && myNewNick !== nicknames[currentUser.id])
        changedParts.push(`${currentUser.display_name} → "${myNewNick}"`);
      else if (!myNewNick && nicknames[currentUser.id])
        changedParts.push(`ลบชื่อเล่นของ ${currentUser.display_name}`);
      if (otherNewNick && otherNewNick !== nicknames[otherUser.id])
        changedParts.push(`${otherUser.display_name} → "${otherNewNick}"`);
      else if (!otherNewNick && nicknames[otherUser.id])
        changedParts.push(`ลบชื่อเล่นของ ${otherUser.display_name}`);

      if (changedParts.length > 0) {
        await supabase.from('messages').insert({
          chat_id: chatId,
          sender_id: currentUser.id,
          content: `${nicknames[currentUser.id] || currentUser.display_name} ตั้งชื่อเล่น: ${changedParts.join(', ')}`,
          event: 'nickname_change',
        });
      }

      await loadNicknames();
      setShowNicknameModal(false);
      onRefreshChats();
    } catch (error) {
      alert('ไม่สามารถบันทึกชื่อเล่นได้');
    } finally {
      setIsSavingNickname(false);
    }
  };

  const handleDeleteHistory = async () => {
    if (!confirm('ต้องการลบประวัติข้อความทั้งหมดในแชทนี้?\n(เฉพาะฝั่งของคุณ อีกฝ่ายยังเห็นอยู่)')) return;
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) { setShowMenu(false); return; }

    const { data: currentMessages, error: fetchError } = await supabase
      .from('messages').select('id, deleted_by').in('id', messageIds);
    if (fetchError) { alert('ไม่สามารถลบประวัติได้'); return; }

    const updates = currentMessages?.map(msg => {
      const existing: string[] = msg.deleted_by || [];
      if (!existing.includes(currentUser.id)) existing.push(currentUser.id);
      return supabase.from('messages').update({ deleted_by: existing }).eq('id', msg.id);
    }) || [];

    const results = await Promise.all(updates);
    if (results.some(r => r.error)) alert('ไม่สามารถลบประวัติได้');
    else { setMessages([]); setShowMenu(false); onRefreshChats(); }
  };

  // ✅ Loading (เปลี่ยนเป็นความสูงแบบ fixed ให้เข้ากับ layout)
  if (isLoading || isGroup === null) {
    return (
      <div className="flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-200 h-[calc(100dvh-11rem)] lg:h-[calc(100vh-3rem)]">
        <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 animate-bounce" />
      </div>
    );
  }

  // ✅ กลุ่ม → ส่งให้ GroupChatWindow
  if (isGroup) {
    return (
      <GroupChatWindow
        chatId={chatId}
        currentUser={currentUser}
        onBack={onBack}
        onRefreshChats={onRefreshChats}
      />
    );
  }

  // ✅ Not found
  if (!otherUser) {
    return (
      <div className="flex items-center justify-center text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-200 h-[calc(100dvh-11rem)] lg:h-[calc(100vh-3rem)]">
        <p>ไม่พบแชทนี้</p>
      </div>
    );
  }

  const displayOtherName = nicknames[otherUser.id] || otherUser.display_name;

  return (
    // กำหนดความสูงของคอนเทนเนอร์ให้เป๊ะตามหน้าจอ ทำให้ส่วนบนและล่างไม่ต้องเลื่อนตามเนื้อหาตรงกลาง
    <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-[calc(100dvh-11rem)] lg:h-[calc(100vh-3rem)]">
      
      {/* Header (flex-shrink-0 เพื่อไม่ให้หดตัว) */}
      <div className="flex-shrink-0 p-4 border-b flex items-center gap-3 transition-colors duration-300 bg-white z-10"
        style={{ borderColor: `${themeColor}40` }}>
        <button onClick={onBack} className="md:hidden p-2 hover:bg-gray-100 rounded-full -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => router.push(`/profile/${otherUser.username}`)}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition text-left"
        >
          <div className="relative flex-shrink-0">
            <img
              src={otherUser.profile_img_url || 'https://iili.io/qbtgKBt.png'}
              alt={otherUser.display_name}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
              style={{ borderWidth: 2, borderStyle: 'solid', borderColor: themeColor }}
            />
            {otherUser.is_online && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate hover:underline">
              {displayOtherName}
              {nicknames[otherUser.id] && (
                <span className="text-xs text-gray-400 font-normal ml-1">({otherUser.display_name})</span>
              )}
            </h3>
            <p className="text-xs text-gray-500">{otherUser.is_online ? 'ออนไลน์' : 'ออฟไลน์'}</p>
          </div>
        </button>

        {/* ปุ่มสีธีม */}
        <div className="relative">
          <button onClick={() => { setShowColorPicker(!showColorPicker); setShowMenu(false); }}
            className="p-2 hover:bg-gray-100 rounded-full transition" title="เปลี่ยนธีมสี">
            <Palette className="w-5 h-5" style={{ color: themeColor }} />
          </button>
          {showColorPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 z-20 p-4 w-64">
                <p className="text-sm font-semibold text-gray-700 mb-3">เลือกสีธีม</p>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {PRESET_COLORS.map(color => (
                    <button key={color} onClick={() => { saveThemeColor(color); setShowColorPicker(false); }}
                      className="w-10 h-10 rounded-full transition hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: color }}>
                      {themeColor === color && <span className="text-white text-lg font-bold">✓</span>}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-200 cursor-pointer hover:scale-110 transition flex-shrink-0"
                    style={{ backgroundColor: themeColor }} onClick={() => colorInputRef.current?.click()} />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">เลือกสีเอง</p>
                    <input ref={colorInputRef} type="color" value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      onBlur={(e) => { saveThemeColor(e.target.value); setShowColorPicker(false); }}
                      className="w-full h-8 rounded cursor-pointer border border-gray-200" />
                  </div>
                </div>
                {isSavingColor && <p className="text-xs text-gray-400 text-center mt-2">กำลังบันทึก...</p>}
              </div>
            </>
          )}
        </div>

        {/* เมนู ⋮ */}
        <div className="relative">
          <button onClick={() => { setShowMenu(!showMenu); setShowColorPicker(false); }}
            className="p-2 hover:bg-gray-100 rounded-full">
            <MoreVertical className="w-5 h-5" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 z-20">
                <button onClick={() => { setEditingMyNickname(nicknames[currentUser.id] || ''); setEditingOtherNickname(nicknames[otherUser.id] || ''); setShowNicknameModal(true); setShowMenu(false); }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 rounded-t-xl">
                  <Pencil className="w-4 h-4" />ตั้งชื่อเล่น
                </button>
                <button onClick={handleDeleteHistory}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 rounded-b-xl">
                  <Trash2 className="w-4 h-4" />ลบประวัติข้อความ
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages (สามารถเลื่อนได้เฉพาะพื้นที่ตรงนี้) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <img src="https://iili.io/qbtgKBt.png" alt="No messages" className="w-20 h-20 mb-4 opacity-50" />
            <p>ยังไม่มีข้อความ</p>
            <p className="text-sm mt-1">เริ่มสนทนากันเลย!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_id === currentUser.id}
                currentUserId={currentUser.id}
                themeColor={themeColor}
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input (ถูกดันให้อยู่ด้านล่างสุดโดย flex เสมอ) */}
      <MessageInput
        chatId={chatId}
        currentUserId={currentUser.id}
        themeColor={themeColor}
        onMessageSent={() => { scrollToBottom(); markAsRead(); }}
      />

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">ตั้งชื่อเล่น</h3>
              <button onClick={() => setShowNicknameModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ชื่อเล่นของคุณ ({currentUser.display_name})</label>
                <input type="text" value={editingMyNickname} onChange={(e) => setEditingMyNickname(e.target.value)}
                  placeholder={`ค่าเริ่มต้น: ${currentUser.display_name}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 text-sm"
                  style={{ '--tw-ring-color': themeColor } as any} maxLength={30} />
                <p className="text-xs text-gray-400 mt-1">ทั้งสองฝ่ายจะเห็นชื่อนี้</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ชื่อเล่นของ {otherUser.display_name}</label>
                <input type="text" value={editingOtherNickname} onChange={(e) => setEditingOtherNickname(e.target.value)}
                  placeholder={`ค่าเริ่มต้น: ${otherUser.display_name}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 text-sm"
                  style={{ '--tw-ring-color': themeColor } as any} maxLength={30} />
                <p className="text-xs text-gray-400 mt-1">ทั้งสองฝ่ายจะเห็นชื่อนี้</p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button onClick={() => setShowNicknameModal(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition">ยกเลิก</button>
              <button onClick={saveNicknames} disabled={isSavingNickname}
                className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: themeColor }}>
                <Check className="w-4 h-4" />{isSavingNickname ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
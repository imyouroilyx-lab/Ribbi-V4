'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, MoreVertical, Trash2, Palette, X, Heart, MessageCircle } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  images: string[] | null;
  created_at: string;
  updated_at?: string | null;
  deleted_by?: string[];
  sender?: {
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
  const [chatData, setChatData] = useState<any>(null);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [themeColor, setThemeColor] = useState('#22c55e');
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadChatData();
    markAsRead();
    
    // ✅ แก้ไขปัญหา Type Error โดยการไม่คืนค่า Promise ตรง ๆ จาก useEffect
    const cleanup = setupRealtimeSubscription();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatData = async () => {
    try {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (chatError) throw chatError;
      setChatData(chat);
      if (chat.theme_color) setThemeColor(chat.theme_color);

      const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chatId)
        .neq('user_id', currentUser.id);

      if (participants && participants.length > 0) {
        const { data: user } = await supabase
          .from('users')
          .select('id, username, display_name, profile_img_url, is_online')
          .eq('id', participants[0].user_id)
          .single();
        setTargetUser(user);
      }

      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .not('deleted_by', 'cs', `{${currentUser.id}}`)
        .order('created_at', { ascending: true });

      if (messagesData) {
        setMessages(messagesData as any);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setIsLoading(false);
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
      }, (payload) => {
        const newMessage = payload.new as Message;
        setMessages(prev => [...prev, newMessage]);
        markAsRead();
        scrollToBottom();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        const updatedMessage = payload.new as Message;
        if (updatedMessage.deleted_by?.includes(currentUser.id)) {
          setMessages(prev => prev.filter(m => m.id !== updatedMessage.id));
        } else {
          setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats',
        filter: `id=eq.${chatId}`,
      }, (payload) => {
        const updatedChat = payload.new as any;
        if (updatedChat.theme_color) setThemeColor(updatedChat.theme_color);
      })
      .subscribe();

    // ✅ คืนค่าเป็น function ที่ไม่ return Promise เพื่อแก้ปัญหา Build Error
    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const saveThemeColor = async (color: string) => {
    setThemeColor(color);
    try {
      await supabase.from('chats').update({ theme_color: color }).eq('id', chatId);
    } catch (error) {
      console.error('Error saving theme color:', error);
    }
  };

  const handleDeleteHistory = async () => {
    if (!confirm('ต้องการลบประวัติการสนทนาทั้งหมด?\n(เฉพาะฝั่งของคุณ คนอื่น ๆ ยังเห็นอยู่)')) return;
    
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) return;

    try {
      const { data: currentMessages } = await supabase
        .from('messages')
        .select('id, deleted_by')
        .in('id', messageIds);

      const updates = currentMessages?.map(msg => {
        const existing = msg.deleted_by || [];
        if (!existing.includes(currentUser.id)) existing.push(currentUser.id);
        return supabase.from('messages').update({ deleted_by: existing }).eq('id', msg.id);
      }) || [];

      await Promise.all(updates);
      setMessages([]);
      setShowMenu(false);
      onRefreshChats();
    } catch (error) {
      console.error('Error deleting history:', error);
    }
  };

  if (isLoading || !targetUser) {
    return (
      <div className="h-full flex items-center justify-center">
        <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 animate-bounce" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3 transition-colors" style={{ borderColor: `${themeColor}40` }}>
        <button onClick={onBack} className="md:hidden p-2 hover:bg-gray-100 rounded-full -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <img src={targetUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" alt="" />
            {targetUser.is_online && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate text-gray-900">{targetUser.display_name}</h3>
            <p className="text-xs text-gray-500">@{targetUser.username}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-2 hover:bg-gray-100 rounded-full transition">
            <Palette className="w-5 h-5" style={{ color: themeColor }} />
          </button>
          
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-100 rounded-full">
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden">
                  <button onClick={handleDeleteHistory} className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600">
                    <Trash2 className="w-4 h-4" />ลบประวัติการสนทนา
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {showColorPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
            <div className="absolute right-4 top-16 bg-white rounded-2xl shadow-2xl border border-gray-100 z-20 p-4 w-64">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-bold text-gray-700">สีธีมแชท</p>
                <button onClick={() => setShowColorPicker(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COLORS.map(color => (
                  <button key={color} onClick={() => { saveThemeColor(color); setShowColorPicker(false); }} className="w-10 h-10 rounded-full transition hover:scale-110" style={{ backgroundColor: color }}>
                    {themeColor === color && <div className="w-full h-full flex items-center justify-center text-white font-bold">✓</div>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message as any}
            isOwn={message.sender_id === currentUser.id}
            currentUserId={currentUser.id}
            themeColor={themeColor}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        chatId={chatId}
        currentUserId={currentUser.id}
        themeColor={themeColor}
        onMessageSent={() => { scrollToBottom(); markAsRead(); }}
      />
    </div>
  );
}

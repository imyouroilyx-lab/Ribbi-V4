'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, Settings, Trash2, Edit2, X, RefreshCcw } from 'lucide-react';
import Link from 'next/link';

export default function ChatWindow({ chatId, chatData, currentUser, onBack, onRefreshChats }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const themeColor = chatData.theme_color || '#22c55e';
  const otherUser = chatData.other_user;

  useEffect(() => {
    loadMessages();
    markAsRead();
    // ❌ ไม่มีการสมัครสมาชิก (Subscribe) เพื่อฟังข้อความใหม่แบบเรียลไทม์
  }, [chatId]);

  const loadMessages = async () => {
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setIsLoading(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
  };

  const markAsRead = async () => {
    await supabase.from('chat_participants').update({ unread_count: 0 }).eq('chat_id', chatId).eq('user_id', currentUser.id);
    onRefreshChats();
  };

  const handleSend = async (e: any) => {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input;
    setInput('');

    const { error } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content });
    if (!error) {
      await supabase.from('chats').update({ last_message_content: content, last_message_at: new Date().toISOString() }).eq('id', chatId);
      await loadMessages(); // ✅ โหลดใหม่ทันทีหลังส่ง เพื่อให้ข้อความเราขึ้นจอ
    }
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative">
      <div className="h-16 px-4 border-b flex items-center justify-between bg-white/80 z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden p-1 text-gray-400"><ChevronLeft /></button>
          <Link href={otherUser?.username ? `/profile/${otherUser.username}` : '#'} className="flex items-center gap-3">
            <div className="relative">
               <img src={(chatData.is_group ? chatData.group_img_url : otherUser?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" />
               {/* 🟢 จุดเขียว (Presence) ยังทำงานอยู่เพราะใช้จาก MessagesPage */}
               {otherUser?.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
            </div>
            <h3 className="font-bold text-sm">{chatData.is_group ? chatData.name : (otherUser?.display_name || 'ผู้ใช้ Ribbi')}</h3>
          </Link>
        </div>
        
        {/* ✅ เพิ่มปุ่มรีเฟรชให้ยูสเซอร์กดดูข้อความใหม่เอง */}
        <button onClick={() => { setIsLoading(true); loadMessages(); }} className="flex items-center gap-1 p-2 text-frog-500 hover:bg-frog-50 rounded-xl transition-colors">
          <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span className="text-[10px] font-black uppercase tracking-widest">Refresh</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fcfdfe]">
        {messages.map((m) => {
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[80%] shadow-sm ${isMe ? 'text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`} 
                   style={isMe ? { backgroundColor: themeColor } : {}}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t bg-white flex items-center gap-3">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 p-3.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-200" />
        <button type="submit" className="p-3.5 text-white rounded-2xl" style={{ backgroundColor: themeColor }}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, MoreVertical, Settings, Trash2, Edit2, X, Palette, User } from 'lucide-react';
import Link from 'next/link';

export default function ChatWindow({ chatId, chatData, currentUser, onBack, onRefreshChats }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  // States สำหรับแก้ไข
  const [myNick, setMyNick] = useState(chatData.my_nickname || '');
  const [theirNick, setTheirNick] = useState(chatData.other_user?.display_name || '');
  const [themeColor, setThemeColor] = useState(chatData.theme_color || '#22c55e');

  const scrollRef = useRef<HTMLDivElement>(null);
  const otherUser = chatData.other_user;

  useEffect(() => {
    loadMessages();
    const channel = supabase.channel(`chat-room-${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, () => loadMessages())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${chatId}` }, (p) => setThemeColor(p.new.theme_color))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [chatId]);

  const loadMessages = async () => {
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setIsLoading(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSend = async (e: any) => {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input;
    setInput('');
    const { data } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content }).select().single();
    if (data) {
      await supabase.from('chats').update({ last_message_content: content, last_message_at: new Date().toISOString() }).eq('id', chatId);
    }
  };

  // ✅ ฟังก์ชันบันทึกชื่อเล่น (ทั้งของเราและของเขา)
  const saveNicknames = async () => {
    if (myNick !== chatData.my_nickname) {
      await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: currentUser.id, nickname: myNick });
    }
    if (otherUser && theirNick !== otherUser.display_name) {
      await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: otherUser.id, nickname: theirNick });
    }
    alert('บันทึกชื่อเล่นแล้ว');
    onRefreshChats();
  };

  // ✅ ฟังก์ชันบันทึกสีแชท + แจ้งเตือนในแชท
  const saveTheme = async (color: string) => {
    setThemeColor(color);
    const { error } = await supabase.from('chats').update({ theme_color: color }).eq('id', chatId);
    if (!error) {
      // แจ้งในแชทว่าใครเปลี่ยนสี
      await supabase.from('messages').insert({ 
        chat_id: chatId, 
        sender_id: currentUser.id, 
        content: `${currentUser.display_name} ได้เปลี่ยนสีธีมแชท`,
        event: 'system' 
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative">
      {/* Header - ✅ กดไปโปรไฟล์ได้ */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-white z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="md:hidden p-1 text-gray-400"><ChevronLeft /></button>
          <Link href={otherUser?.username ? `/profile/${otherUser.username}` : '#'} className="flex items-center gap-3 hover:opacity-80 min-w-0">
            <div className="relative">
              <img src={(chatData.is_group ? chatData.group_img_url : otherUser?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" />
              {otherUser?.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{chatData.is_group ? chatData.name : (otherUser?.display_name || 'ผู้ใช้ Ribbi')}</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase">{otherUser?.is_online ? 'ออนไลน์ขณะนี้' : 'ออฟไลน์'}</p>
            </div>
          </Link>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><Settings size={20} /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          if (m.event === 'system') return <div key={m.id} className="text-center text-[10px] text-gray-400 font-bold uppercase py-2">{m.content}</div>;
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`px-4 py-2 rounded-2xl text-sm max-w-[75%] shadow-sm ${isMe ? 'text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`} 
                   style={isMe ? { backgroundColor: themeColor } : {}}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute right-0 top-16 bottom-0 w-80 bg-white border-l z-30 shadow-2xl p-4 space-y-6 animate-in slide-in-from-right">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-black text-xs uppercase text-gray-400">ตั้งค่าการสนทนา</span>
            <button onClick={() => setShowSettings(false)}><X size={20}/></button>
          </div>

          {/* ชื่อเล่น */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">ชื่อเล่นของคุณ</label>
              <input value={myNick} onChange={e => setMyNick(e.target.value)} className="w-full p-2 bg-gray-50 border rounded-xl text-sm" placeholder="ตั้งชื่อเล่นตัวเอง..." />
            </div>
            {!chatData.is_group && (
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">ชื่อเล่นของคู่สนทนา</label>
                <input value={theirNick} onChange={e => setTheirNick(e.target.value)} className="w-full p-2 bg-gray-50 border rounded-xl text-sm" placeholder="ตั้งชื่อเล่นเพื่อน..." />
              </div>
            )}
            <button onClick={saveNicknames} className="w-full py-2 bg-gray-900 text-white rounded-xl text-xs font-bold">บันทึกชื่อเล่น</button>
          </div>

          {/* สีแชท */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">ธีมสีแชท</label>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'].map(color => (
                <button key={color} onClick={() => saveTheme(color)} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold">กำหนดเอง:</span>
              <input type="color" value={themeColor} onChange={(e) => saveTheme(e.target.value)} className="w-10 h-8 rounded-lg cursor-pointer" />
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 p-3 bg-gray-100 rounded-2xl text-sm outline-none" />
        <button type="submit" className="p-3 text-white rounded-2xl shadow-lg" style={{ backgroundColor: themeColor }}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

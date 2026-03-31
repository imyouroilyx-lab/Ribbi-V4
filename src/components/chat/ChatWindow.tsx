'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, Settings, Trash2, Edit2, X, RefreshCcw, Palette, Check, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function ChatWindow({ chatId, chatData, currentUser, onBack, onRefreshChats }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // States สำหรับแก้ไข (ชื่อเล่นเรา, ชื่อเล่นเขา, สีธีม)
  const [myNick, setMyNick] = useState(chatData.my_nickname || '');
  const [theirNick, setTheirNick] = useState(chatData.other_user?.display_name || '');
  const [tempColor, setTempColor] = useState(chatData.theme_color || '#22c55e');

  const scrollRef = useRef<HTMLDivElement>(null);
  const otherUser = chatData.other_user;

  useEffect(() => {
    loadMessages();
    markAsRead();
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
      await loadMessages();
    }
  };

  // ✅ ฟังก์ชันบันทึกการตั้งค่า (ต้องกดปุ่มยืนยัน)
  const saveAllSettings = async () => {
    setIsSaving(true);
    try {
      if (myNick) await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: currentUser.id, nickname: myNick });
      if (otherUser && theirNick) await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: otherUser.id, nickname: theirNick });
      await supabase.from('chats').update({ theme_color: tempColor }).eq('id', chatId);
      
      alert('บันทึกการตั้งค่าสำเร็จ!');
      setShowSettings(false);
      onRefreshChats();
      loadMessages();
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative overflow-hidden">
      {/* Header */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-white/80 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="md:hidden p-1 text-gray-400"><ChevronLeft /></button>
          <Link href={otherUser?.username ? `/profile/${otherUser.username}` : '#'} className="flex items-center gap-3">
            <img src={(chatData.is_group ? chatData.group_img_url : otherUser?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" />
            <h3 className="font-bold text-sm truncate">{chatData.is_group ? chatData.name : (theirNick || otherUser?.display_name)}</h3>
          </Link>
        </div>
        <div className="flex items-center gap-1">
           <button onClick={() => loadMessages()} className="p-2 text-gray-400 hover:text-frog-500"><RefreshCcw size={18}/></button>
           <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><Settings size={20} /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fcfdfe]">
        {messages.map((m) => {
          if (m.event === 'system') return <div key={m.id} className="text-center text-[10px] text-gray-400 font-bold uppercase py-2">{m.content}</div>;
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[80%] shadow-sm break-words ${isMe ? 'text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`} 
                   style={isMe ? { backgroundColor: chatData.theme_color || '#22c55e' } : {}}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Settings Modal (Right Sidebar) */}
      {showSettings && (
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-white border-l z-30 shadow-2xl flex flex-col animate-in slide-in-from-right">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50">
            <span className="font-black text-xs uppercase text-gray-400">Settings</span>
            <button onClick={() => setShowSettings(false)}><X size={20}/></button>
          </div>
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">ชื่อเล่นในการสนทนา</label>
              <input value={myNick} onChange={e => setMyNick(e.target.value)} placeholder="ชื่อเล่นคุณ..." className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm mb-2" />
              {!chatData.is_group && <input value={theirNick} onChange={e => setTheirNick(e.target.value)} placeholder="ชื่อเล่นเพื่อน..." className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm" />}
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">ธีมสีแชท</label>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#000000'].map(c => (
                  <button key={c} onClick={() => setTempColor(c)} className={`w-full aspect-square rounded-full border-2 ${tempColor === c ? 'border-black' : 'border-white'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">เลือกสีเอง:</span>
                <input type="color" value={tempColor} onChange={e => setTempColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent" />
              </div>
            </div>
          </div>
          <div className="p-4 border-t bg-gray-50">
            <button onClick={saveAllSettings} disabled={isSaving} className="w-full py-3 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl disabled:opacity-50">
              {isSaving ? 'Saving...' : 'ยืนยันการเปลี่ยน'}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t bg-white flex items-center gap-3">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 p-3.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-200" />
        <button type="submit" className="p-3.5 text-white rounded-2xl shadow-lg" style={{ backgroundColor: chatData.theme_color || '#22c55e' }}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, Settings, Trash2, Edit2, X, Check, User, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

export default function ChatWindow({ chatId, chatData, currentUser, onBack, onRefreshChats }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // States สำหรับชื่อเล่นและสี
  const [myNick, setMyNick] = useState(chatData.my_nickname || '');
  const [theirNick, setTheirNick] = useState(chatData.other_user?.display_name || '');
  const [themeColor, setThemeColor] = useState(chatData.theme_color || '#22c55e');

  const scrollRef = useRef<HTMLDivElement>(null);
  const otherUser = chatData.other_user;

  useEffect(() => {
    loadMessages();
    const channel = supabase.channel(`room-${chatId}`)
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

    if (editingId) {
      await supabase.from('messages').update({ content, updated_at: new Date().toISOString() }).eq('id', editingId);
      setEditingId(null);
    } else {
      const { data } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content }).select().single();
      if (data) {
        await supabase.from('chats').update({ last_message_content: content, last_message_at: new Date().toISOString() }).eq('id', chatId);
      }
    }
  };

  const saveSettings = async () => {
    if (myNick) await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: currentUser.id, nickname: myNick });
    if (otherUser && theirNick) await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: otherUser.id, nickname: theirNick });
    await supabase.from('chats').update({ theme_color: themeColor }).eq('id', chatId);
    alert('บันทึกข้อมูลเรียบร้อย');
    onRefreshChats();
  };

  const deleteMsg = async (id: string) => {
    if (confirm('ลบข้อความนี้ใช่หรือไม่?')) await supabase.from('messages').delete().eq('id', id);
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative">
      {/* Header - กดไปโปรไฟล์ได้ */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-white/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="md:hidden p-1 text-gray-400"><ChevronLeft /></button>
          <Link href={otherUser?.username ? `/profile/${otherUser.username}` : '#'} className="flex items-center gap-3 hover:opacity-80 min-w-0">
            <div className="relative flex-shrink-0">
              <img src={(chatData.is_group ? chatData.group_img_url : otherUser?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" />
              {otherUser?.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate text-gray-900">{chatData.is_group ? chatData.name : (otherUser?.display_name || 'ผู้ใช้ Ribbi')}</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase">{otherUser?.is_online ? 'ออนไลน์' : 'ออฟไลน์'}</p>
            </div>
          </Link>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><Settings size={20} /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fcfdfe]">
        {messages.map((m) => {
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className="flex flex-col max-w-[80%]">
                <div className={`relative px-4 py-2.5 rounded-2xl text-[14px] shadow-sm break-words ${isMe ? 'text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`} 
                     style={isMe ? { backgroundColor: themeColor } : {}}>
                  {m.content}
                  {isMe && (
                    <div className="absolute -left-14 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1 bg-white border rounded-lg p-1 shadow-md">
                      <button onClick={() => { setEditingId(m.id); setInput(m.content); }} className="p-1 text-blue-500"><Edit2 size={12}/></button>
                      <button onClick={() => deleteMsg(m.id)} className="p-1 text-red-500"><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
                {m.updated_at && <span className="text-[9px] text-gray-400 self-end mt-1 italic">แก้ไขแล้ว</span>}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} className="h-2" />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute right-0 top-16 bottom-0 w-80 bg-white border-l z-30 shadow-2xl p-6 space-y-6 animate-in slide-in-from-right">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="font-black text-xs uppercase text-gray-400">ตั้งค่าแชท</span>
            <button onClick={() => setShowSettings(false)}><X size={20}/></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">ชื่อเล่นคุณ</label>
              <input value={myNick} onChange={e => setMyNick(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm" />
            </div>
            {!chatData.is_group && (
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">ชื่อเล่นเพื่อน</label>
                <input value={theirNick} onChange={e => setTheirNick(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm" />
              </div>
            )}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block">สีธีมแชท</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#000000'].map(c => (
                  <button key={c} onClick={() => setThemeColor(c)} className={`w-full aspect-square rounded-xl border-2 ${themeColor === c ? 'border-gray-900' : 'border-white'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-full h-10 rounded-xl cursor-pointer" />
            </div>
            <button onClick={saveSettings} className="w-full py-3 bg-gray-900 text-white rounded-2xl text-xs font-bold shadow-lg">บันทึกทั้งหมด</button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t bg-white flex items-center gap-3">
        {editingId && (
          <div className="absolute bottom-20 left-4 right-4 bg-blue-50 p-2 rounded-xl flex justify-between border border-blue-100">
            <span className="text-[10px] text-blue-600 font-bold uppercase italic">กำลังแก้ไขข้อความ...</span>
            <button type="button" onClick={() => { setEditingId(null); setInput(''); }}><X size={14} className="text-blue-400"/></button>
          </div>
        )}
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 p-3.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-200" />
        <button type="submit" className="p-3.5 text-white rounded-2xl shadow-lg transition-transform active:scale-95" style={{ backgroundColor: themeColor }}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

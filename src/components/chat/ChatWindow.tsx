'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, MoreVertical, Settings, UserPlus, Trash2, Edit2, X, Palette, User } from 'lucide-react';
import Link from 'next/link';

interface ChatWindowProps {
  chatId: string;
  chatData: any;
  currentUser: any;
  onBack: () => void;
  onRefreshChats: () => void;
}

export default function ChatWindow({ chatId, chatData, currentUser, onBack, onRefreshChats }: ChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [themeColor, setThemeColor] = useState(chatData.theme_color || '#22c55e');
  const scrollRef = useRef<HTMLDivElement>(null);

  // ข้อมูลคู่สนทนา
  const otherUser = chatData.other_user;
  const displayName = chatData.is_group ? chatData.name : (otherUser?.nickname || otherUser?.display_name);
  const profileLink = otherUser?.username ? `/profile/${otherUser.username}` : '#';

  useEffect(() => {
    loadMessages();
    markAsRead();
    const channel = supabase.channel(`room-${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, () => loadMessages())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${chatId}` }, () => onRefreshChats())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [chatId]);

  const loadMessages = async () => {
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setIsLoading(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const markAsRead = async () => {
    await supabase.from('chat_participants').update({ unread_count: 0 }).eq('chat_id', chatId).eq('user_id', currentUser.id);
    onRefreshChats();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input;
    setInput('');

    if (editingMsg) {
      // ✅ แก้ไขข้อความ
      await supabase.from('messages').update({ content, updated_at: new Date().toISOString() }).eq('id', editingMsg.id);
      setEditingMsg(null);
    } else {
      // ✅ ส่งข้อความใหม่
      const { data } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content }).select().single();
      if (data) {
        await supabase.from('chats').update({ last_message_content: content, last_message_at: new Date().toISOString(), last_message_id: data.id }).eq('id', chatId);
      }
    }
    loadMessages();
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('ลบข้อความนี้ใช่หรือไม่?')) return;
    await supabase.from('messages').delete().eq('id', id);
    loadMessages();
  };

  const clearHistory = async () => {
    if (!confirm('ล้างประวัติการแชททั้งหมด? (ข้อความจะหายไปเฉพาะในหน้านี้)')) return;
    await supabase.from('messages').delete().eq('chat_id', chatId);
    loadMessages();
  };

  const updateNickname = async () => {
    if (!otherUser?.id) return;
    await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: otherUser.id, nickname, created_by: currentUser.id });
    alert('เปลี่ยนชื่อเล่นสำเร็จ');
    onRefreshChats();
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative">
      {/* Header */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-white z-20 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="md:hidden p-1 text-gray-400"><ChevronLeft /></button>
          
          {/* ✅ แก้ไข: กดที่รูป/ชื่อเพื่อไปโปรไฟล์ */}
          <Link href={profileLink} className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0">
            <img src={(chatData.is_group ? chatData.group_img_url : otherUser?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" />
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate text-gray-900">{displayName || 'ผู้ใช้ Ribbi'}</h3>
              <span className="text-[10px] text-green-500 font-bold uppercase">{otherUser?.is_online ? '• ออนไลน์' : ''}</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fcfdfe]">
        {isLoading ? <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-frog-500" /></div> : (
          messages.map((m) => {
            const isMe = m.sender_id === currentUser.id;
            return (
              <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group`}>
                <div className="flex flex-col max-w-[75%] gap-1">
                  <div className={`relative px-4 py-2 rounded-2xl text-sm break-words shadow-sm ${isMe ? 'bg-frog-500 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`}>
                    {m.content}
                    
                    {/* ✅ เมนู แก้ไข/ลบ (ขึ้นตอนเอาเมาส์ชี้) */}
                    {isMe && (
                      <div className="absolute -left-12 top-0 hidden group-hover:flex items-center gap-1 bg-white border rounded-lg p-1 shadow-md">
                        <button onClick={() => { setEditingMsg(m); setInput(m.content); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={12}/></button>
                        <button onClick={() => deleteMessage(m.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                      </div>
                    )}
                  </div>
                  {m.updated_at && <span className="text-[9px] text-gray-400 self-end">(แก้ไขแล้ว)</span>}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Settings Modal (แถบข้างขวา) */}
      {showSettings && (
        <div className="absolute right-0 top-16 bottom-0 w-72 bg-white border-l z-30 shadow-2xl animate-in slide-in-from-right">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50">
            <span className="font-bold text-sm">ตั้งค่าการสนทนา</span>
            <button onClick={() => setShowSettings(false)}><X size={18}/></button>
          </div>
          <div className="p-4 space-y-6 overflow-y-auto h-full pb-20">
            {/* เปลี่ยนชื่อเล่น */}
            {!chatData.is_group && (
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">ชื่อเล่นคู่สนทนา</label>
                <div className="flex gap-2">
                  <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="ระบุชื่อเล่น..." className="flex-1 p-2 border rounded-xl text-xs" />
                  <button onClick={updateNickname} className="p-2 bg-frog-500 text-white rounded-xl text-xs font-bold">บันทึก</button>
                </div>
              </div>
            )}

            {/* เพิ่มคน (เฉพาะกลุ่ม) */}
            {chatData.is_group && (
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">สมาชิก</label>
                <button className="w-full py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-200">
                  <UserPlus size={14}/> เพิ่มคนเข้ากลุ่ม
                </button>
              </div>
            )}

            {/* สีแชท */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">สีธีมแชท</label>
              <div className="flex gap-2 flex-wrap">
                {['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6'].map(color => (
                  <button key={color} onClick={() => setThemeColor(color)} className={`w-6 h-6 rounded-full border-2 ${themeColor === color ? 'border-gray-900' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>

            {/* ลบแชท */}
            <div className="pt-4 border-t">
              <button onClick={clearHistory} className="w-full py-2 text-red-500 text-xs font-bold flex items-center gap-2 hover:bg-red-50 p-2 rounded-xl">
                <Trash2 size={14}/> ล้างประวัติข้อความ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 border-t bg-white flex items-center gap-3">
        {editingMsg && (
          <div className="absolute bottom-20 left-4 right-4 bg-blue-50 p-2 rounded-xl flex justify-between items-center border border-blue-100">
            <span className="text-xs text-blue-600 font-medium flex items-center gap-2"><Edit2 size={12}/> กำลังแก้ไขข้อความ...</span>
            <button type="button" onClick={() => { setEditingMsg(null); setInput(''); }}><X size={14} className="text-blue-400"/></button>
          </div>
        )}
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder={editingMsg ? "แก้ไขข้อความ..." : "พิมพ์ข้อความที่นี่..."} 
          className="flex-1 p-3 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-200" 
        />
        <button type="submit" className={`p-3 rounded-2xl text-white shadow-lg transition-all ${editingMsg ? 'bg-blue-500' : 'bg-frog-500'}`}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

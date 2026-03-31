'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, Settings, Trash2, Edit2, X, RefreshCcw, Palette, UserPen, Eraser } from 'lucide-react';
import Link from 'next/link';

export default function ChatWindow({ chatId, chatData: initialChatData, currentUser, onBack, onRefreshChats }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [chatData, setChatData] = useState(initialChatData);
  const [myNick, setMyNick] = useState(initialChatData.my_nickname || '');
  const [theirNick, setTheirNick] = useState(initialChatData.other_user?.display_name || '');
  const [tempColor, setTempColor] = useState(initialChatData.theme_color || '#22c55e');

  const scrollRef = useRef<HTMLDivElement>(null);
  const otherUser = chatData.other_user;

  useEffect(() => {
    loadMessages();
    markAsRead();
    setChatData(initialChatData);
    setMyNick(initialChatData.my_nickname || '');
    setTheirNick(initialChatData.other_user?.display_name || '');
    setTempColor(initialChatData.theme_color || '#22c55e');
  }, [chatId, initialChatData]);

  // ✅ โหลดข้อความโดยกรองตัวที่ "เราลบ" ออก (SQL Filter)
  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .not('deleted_by', 'cs', `{"${currentUser.id}"}`) // กรองออกถ้ามี ID เราใน Array
      .order('created_at', { ascending: true });
    
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

    if (editingId) {
      await supabase.from('messages').update({ content, updated_at: new Date().toISOString() }).eq('id', editingId);
      setEditingId(null);
    } else {
      const { error } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content });
      if (!error) {
        await supabase.from('chats').update({ last_message_content: content, last_message_at: new Date().toISOString() }).eq('id', chatId);
      }
    }
    loadMessages();
  };

  const saveAllSettings = async () => {
    setIsSaving(true);
    try {
      // 1. บันทึกชื่อเล่น
      if (myNick !== chatData.my_nickname) {
        await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: currentUser.id, nickname: myNick }, { onConflict: 'chat_id,target_user_id' });
        await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} เปลี่ยนชื่อเล่นตัวเองเป็น ${myNick}`, event: 'system' });
      }
      if (otherUser && theirNick !== (otherUser.display_name)) {
        await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: otherUser.id, nickname: theirNick }, { onConflict: 'chat_id,target_user_id' });
        await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} เปลี่ยนชื่อเล่นให้เพื่อนเป็น ${theirNick}`, event: 'system' });
      }
      // 2. บันทึกสี
      if (tempColor !== chatData.theme_color) {
        await supabase.from('chats').update({ theme_color: tempColor }).eq('id', chatId);
        await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} เปลี่ยนสีธีมแชท`, event: 'system' });
      }

      setShowSettings(false);
      onRefreshChats();
      loadMessages();
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  // ✅ ลบจากทั้งสองฝ่าย (Delete จริง)
  const deleteForEveryone = async (id: string) => {
    if (!confirm('ลบข้อความนี้ออกจากทั้งสองฝ่าย?')) return;
    await supabase.from('messages').delete().eq('id', id);
    loadMessages();
  };

  // ✅ ล้างประวัติ (หายเฉพาะเรา)
  const clearHistoryForMe = async () => {
    if (!confirm('ล้างประวัติการแชท (หายเฉพาะฝั่งคุณ)?')) return;
    
    // ดึง ID ข้อความทั้งหมดที่ "เรายังไม่ได้ลบ" ในห้องนี้
    const { data } = await supabase.from('messages').select('id, deleted_by').eq('chat_id', chatId);
    
    if (data) {
      const updates = data.map(m => {
        const currentDeleted = m.deleted_by || [];
        return supabase.from('messages').update({ deleted_by: [...currentDeleted, currentUser.id] }).eq('id', m.id);
      });
      await Promise.all(updates);
      loadMessages();
      setShowSettings(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative overflow-hidden">
      {/* Header */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-white/90 z-20 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden p-1 text-gray-400"><ChevronLeft /></button>
          <Link href={otherUser?.username ? `/profile/${otherUser.username}` : '#'} className="flex items-center gap-3">
            <img src={(chatData.is_group ? chatData.group_img_url : otherUser?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" />
            <h3 className="font-bold text-sm">{chatData.is_group ? chatData.name : (theirNick || otherUser?.display_name)}</h3>
          </Link>
        </div>
        <div className="flex items-center gap-1">
           <button onClick={() => { setIsLoading(true); loadMessages(); }} className="p-2 text-gray-400 hover:text-frog-500"><RefreshCcw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
           <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><Settings size={20} /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fcfdfe]">
        {messages.map((m) => {
          if (m.event === 'system') return <div key={m.id} className="text-center text-[10px] text-gray-400 font-bold uppercase py-4 tracking-widest">{m.content}</div>;
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className="flex flex-col max-w-[80%]">
                <div className={`relative px-4 py-2.5 rounded-2xl text-[14px] shadow-sm break-words ${isMe ? 'text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`} 
                     style={isMe ? { backgroundColor: chatData.theme_color || '#22c55e' } : {}}>
                  {m.content}
                  {isMe && (
                    <div className="absolute -left-16 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white border rounded-lg p-1 shadow-lg">
                       <button onClick={() => { setEditingId(m.id); setInput(m.content); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={12}/></button>
                       <button onClick={() => deleteForEveryone(m.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
                {m.updated_at && <span className="text-[9px] text-gray-400 self-end italic">แก้ไขแล้ว</span>}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-white border-l z-30 shadow-2xl flex flex-col animate-in slide-in-from-right">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50">
            <span className="font-black text-xs uppercase text-gray-400">การตั้งค่า</span>
            <button onClick={() => setShowSettings(false)}><X size={20}/></button>
          </div>
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-frog-600 flex items-center gap-2"><UserPen size={14}/> ชื่อเล่น</h4>
              <input value={myNick} onChange={e => setMyNick(e.target.value)} placeholder="ชื่อเล่นคุณ..." className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm" />
              {!chatData.is_group && <input value={theirNick} onChange={e => setTheirNick(e.target.value)} placeholder="ชื่อเล่นเพื่อน..." className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm" />}
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-frog-600 flex items-center gap-2"><Palette size={14}/> สีธีม</h4>
              <div className="grid grid-cols-5 gap-2 mb-2">
                {['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#000000', '#64748b', '#f97316'].map(c => (
                  <button key={c} onClick={() => setTempColor(c)} className={`aspect-square rounded-full border-2 ${tempColor === c ? 'border-black scale-110' : 'border-white'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <input type="color" value={tempColor} onChange={e => setTempColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer bg-transparent" />
            </div>

            <div className="pt-6 border-t">
              <button onClick={clearHistoryForMe} className="w-full p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
                <Eraser size={16}/> ล้างประวัติการแชท (ฝั่งคุณ)
              </button>
            </div>
          </div>
          <div className="p-4 bg-gray-50 border-t">
            <button onClick={saveAllSettings} disabled={isSaving} className="w-full py-3 bg-frog-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg">
              {isSaving ? 'Saving...' : 'ยืนยันการเปลี่ยน'}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t bg-white flex items-center gap-3 relative">
        {editingId && (
          <div className="absolute -top-12 left-4 right-4 bg-blue-500 text-white p-2 rounded-t-xl text-[10px] font-bold flex justify-between">
            <span>กำลังแก้ไข...</span>
            <button type="button" onClick={() => { setEditingId(null); setInput(''); }}><X size={14}/></button>
          </div>
        )}
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 p-3.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-200" />
        <button type="submit" className="p-3.5 text-white rounded-2xl shadow-lg" style={{ backgroundColor: chatData.theme_color || '#22c55e' }}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, Settings, Trash2, Edit2, X, RefreshCcw, Palette, UserPen, Eraser, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function ChatWindow({ chatId, chatData: initialChatData, currentUser, onBack, onRefreshChats }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [myNick, setMyNick] = useState('');
  const [theirNick, setTheirNick] = useState('');
  const [tempColor, setTempColor] = useState('');
  const lastId = useRef(chatId);

  useEffect(() => {
    loadMessages();
    markAsRead();
  }, [chatId]);

  useEffect(() => {
    if (lastId.current !== chatId || !showSettings) {
      setMyNick(initialChatData.my_nickname || '');
      setTheirNick(initialChatData.other_user?.display_name || '');
      setTempColor(initialChatData.theme_color || '#22c55e');
      lastId.current = chatId;
    }
  }, [initialChatData, chatId, showSettings]);

  const loadMessages = async () => {
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) {
      // ดึงมาเฉพาะข้อความที่ไม่มี ID เราใน deleted_by
      setMessages(data.filter(m => !(m.deleted_by || []).includes(currentUser.id)));
    }
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
      await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content });
      await supabase.from('chats').update({ last_message_content: content, last_message_at: new Date().toISOString() }).eq('id', chatId);
    }
    loadMessages();
    onRefreshChats();
  };

  const saveAllSettings = async () => {
    setIsSaving(true);
    try {
      if (myNick !== initialChatData.my_nickname) {
        await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: currentUser.id, nickname: myNick }, { onConflict: 'chat_id,target_user_id' });
      }
      if (initialChatData.other_user && theirNick !== initialChatData.other_user.display_name) {
        await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: initialChatData.other_user.id, nickname: theirNick }, { onConflict: 'chat_id,target_user_id' });
      }
      if (tempColor !== initialChatData.theme_color) {
        await supabase.from('chats').update({ theme_color: tempColor }).eq('id', chatId);
        await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} เปลี่ยนสีธีมแชท`, event: 'system' });
      }
      alert('บันทึกเรียบร้อย!');
      setShowSettings(false);
      onRefreshChats();
      loadMessages();
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  // ✅ ล้างประวัติ (หายเฉพาะเราเท่านั้น 100%)
  const clearHistoryForMe = async () => {
    if (!confirm('ล้างประวัติการแชท (หายเฉพาะฝั่งคุณ)?')) return;
    
    const { data } = await supabase.from('messages').select('id, deleted_by').eq('chat_id', chatId);
    if (data) {
      const updates = data.map(m => {
        const current = m.deleted_by || [];
        // เอา ID เราไปยัดใส่ array deleted_by ของข้อความนี้ (ไม่ได้ลบทิ้งจริงๆ เพื่อนเลยยังเห็นอยู่)
        return supabase.from('messages').update({ deleted_by: [...current, currentUser.id] }).eq('id', m.id);
      });
      await Promise.all(updates);
      
      // ❌ ลบคำสั่งที่ไปอัปเดตตาราง chats ทิ้งไปแล้ว เพื่อไม่ให้กระทบหน้าจอของอีกฝั่ง!

      loadMessages();
      setShowSettings(false);
    }
  };

  const otherUser = initialChatData.other_user;
  const scrollRef = useRef<HTMLDivElement>(null);

  const renderMessageContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all hover:opacity-80">{part}</a>;
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative overflow-hidden">
      {/* Header */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-white/90 z-20 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="md:hidden p-1 text-gray-400"><ChevronLeft /></button>
          <Link href={otherUser?.username ? `/profile/${otherUser.username}` : '#'} className="flex items-center gap-3">
            <img src={(initialChatData.is_group ? initialChatData.group_img_url : otherUser?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" />
            <h3 className="font-bold text-sm truncate">{initialChatData.is_group ? initialChatData.name : (theirNick || otherUser?.display_name || 'ผู้ใช้ Ribbi')}</h3>
          </Link>
        </div>
        <div className="flex items-center gap-1">
           <button onClick={() => { setIsLoading(true); loadMessages(); }} className="p-2 text-gray-400 hover:text-frog-500"><RefreshCcw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
           <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><Settings size={20} /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fcfdfe]">
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-gray-900">
            <MessageSquare size={64}/>
            <p className="text-xs font-black uppercase mt-2 text-gray-900">ยังไม่มีข้อความ</p>
          </div>
        )}
        {messages.map((m) => {
          if (m.event === 'system') return <div key={m.id} className="text-center text-[10px] text-gray-400 font-bold uppercase py-4 tracking-widest">{m.content}</div>;
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className="flex flex-col max-w-[80%] gap-1">
                <div className={`relative px-4 py-2.5 rounded-2xl text-[14px] shadow-sm break-words ${isMe ? 'text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`} 
                     style={{ backgroundColor: isMe ? (initialChatData.theme_color || '#22c55e') : undefined }}>
                  {renderMessageContent(m.content || '')}
                  {isMe && (
                    <div className="absolute -left-16 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white border rounded-lg p-1 shadow-lg">
                       <button onClick={() => { setEditingId(m.id); setInput(m.content); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="แก้ไข"><Edit2 size={12}/></button>
                       <button onClick={() => { if(confirm('ลบข้อความนี้?')) supabase.from('messages').delete().eq('id', m.id).then(() => loadMessages()); }} className="p-1 text-red-500 hover:bg-red-50 rounded" title="ลบทิ้ง"><Trash2 size={12}/></button>
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

      {/* Settings Drawer */}
      {showSettings && (
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-white border-l z-30 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-gray-900">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50">
            <span className="font-black text-xs uppercase text-gray-400 tracking-widest">การตั้งค่า</span>
            <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white rounded-full"><X size={20}/></button>
          </div>
          <div className="p-6 space-y-8 flex-1 overflow-y-auto pb-24">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-frog-600 flex items-center gap-2"><UserPen size={14}/> ตั้งชื่อเล่น</h4>
              <div className="space-y-3">
                <input value={myNick} onChange={e => setMyNick(e.target.value)} placeholder="ชื่อเล่นของคุณ..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none" />
                {!initialChatData.is_group && <input value={theirNick} onChange={e => setTheirNick(e.target.value)} placeholder="ชื่อเล่นเพื่อน..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none" />}
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-frog-600 flex items-center gap-2"><Palette size={14}/> สีธีมแชท</h4>
              <div className="grid grid-cols-5 gap-3">
                {['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#000000', '#64748b', '#f97316'].map(c => (
                  <button key={c} onClick={() => setTempColor(c)} className={`aspect-square rounded-full border-2 transition-transform ${tempColor === c ? 'border-gray-900 scale-110 shadow-md' : 'border-white shadow-sm'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">เลือกสีเอง:</span>
                <input type="color" value={tempColor} onChange={e => setTempColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer bg-transparent border-none" />
              </div>
            </div>
            <button onClick={clearHistoryForMe} className="w-full p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 tracking-widest hover:bg-red-100 transition-colors"><Eraser size={14}/> ล้างประวัติการแชท (ฝั่งคุณ)</button>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t z-50">
            <button onClick={saveAllSettings} disabled={isSaving} className="w-full py-4 rounded-[1.25rem] text-[12px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all disabled:opacity-50" style={{ backgroundColor: '#16a34a', color: '#ffffff', display: 'block' }}>
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSend} className="p-4 border-t bg-white flex items-center gap-3 relative">
        {editingId && (
          <div className="absolute -top-12 left-4 right-4 bg-blue-500 text-white p-2 rounded-t-xl text-[10px] font-bold flex justify-between animate-in slide-in-from-bottom-2">
            <span>กำลังแก้ไข...</span>
            <button type="button" onClick={() => { setEditingId(null); setInput(''); }}><X size={14}/></button>
          </div>
        )}
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 p-3.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-200 text-gray-900" />
        <button type="submit" className="p-3.5 text-white rounded-2xl shadow-lg" style={{ backgroundColor: initialChatData.theme_color || '#22c55e' }}><Send size={20} /></button>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, MoreVertical, Settings, Trash2, Edit2, X, Palette, User, Users, UserPlus, Check, Pencil, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

const PRESET_COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function ChatWindow({ chatId, chatData, currentUser, onBack, onRefreshChats }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // UI States
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  
  // Edit States
  const [myNick, setMyNick] = useState(chatData.my_nickname || '');
  const [theirNick, setTheirNick] = useState(chatData.other_user?.display_name || '');
  const [themeColor, setThemeColor] = useState(chatData.theme_color || '#22c55e');

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const otherUser = chatData.other_user;

  useEffect(() => {
    loadMessages();
    markAsRead();
    
    const channel = supabase.channel(`chat-room-${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (p) => {
        if (p.event === 'INSERT') {
          setMessages(prev => [...prev, p.new]);
          markAsRead();
          setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          loadMessages();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${chatId}` }, (p) => setThemeColor(p.new.theme_color))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [chatId]);

  const loadMessages = async (loadMore = false) => {
    if (loadMore) setIsLoadingMore(true);
    
    let query = supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(30);
    
    if (loadMore && messages.length > 0) {
      query = query.lt('created_at', messages[0].created_at);
    }

    const { data, error } = await query;
    if (data) {
      const sorted = data.reverse();
      if (loadMore) {
        setMessages(prev => [...sorted, ...prev]);
        setHasMore(data.length === 30);
      } else {
        setMessages(sorted);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
      }
    }
    setIsLoading(false);
    setIsLoadingMore(false);
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
    const { data } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content }).select().single();
    if (data) {
      await supabase.from('chats').update({ last_message_content: content, last_message_at: new Date().toISOString() }).eq('id', chatId);
    }
  };

  const saveNicknames = async () => {
    if (myNick) await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: currentUser.id, nickname: myNick });
    if (otherUser && theirNick) await supabase.from('chat_nicknames').upsert({ chat_id: chatId, target_user_id: otherUser.id, nickname: theirNick });
    alert('บันทึกชื่อเล่นสำเร็จ');
    onRefreshChats();
  };

  const saveTheme = async (color: string) => {
    setThemeColor(color);
    await supabase.from('chats').update({ theme_color: color }).eq('id', chatId);
    await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} เปลี่ยนสีธีมแชท`, event: 'system' });
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('ลบข้อความนี้ใช่หรือไม่?')) return;
    await supabase.from('messages').delete().eq('id', id);
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative">
      {/* Header */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-white/90 backdrop-blur-md z-20 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="md:hidden p-1 text-gray-400"><ChevronLeft /></button>
          <Link href={otherUser?.username ? `/profile/${otherUser.username}` : '#'} className="flex items-center gap-3 hover:opacity-80 min-w-0">
            <div className="relative flex-shrink-0">
              <img src={(chatData.is_group ? chatData.group_img_url : otherUser?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" />
              {otherUser?.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate text-gray-900">{chatData.is_group ? chatData.name : (otherUser?.display_name || 'ผู้ใช้ Ribbi')}</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                {chatData.is_group ? `${chatData.members?.length || ''} สมาชิก` : (otherUser?.is_online ? 'กำลังออนไลน์' : 'ออฟไลน์')}
              </p>
            </div>
          </Link>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><Settings size={20} /></button>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fcfdfe]">
        {hasMore && (
          <button onClick={() => loadMessages(true)} className="w-full py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600">
            {isLoadingMore ? 'กำลังโหลด...' : 'ดูข้อความเพิ่มเติม'}
          </button>
        )}
        
        {messages.map((m) => {
          if (m.event === 'system') return <div key={m.id} className="text-center text-[10px] text-gray-400 font-bold uppercase py-2">{m.content}</div>;
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className={`relative px-4 py-2.5 rounded-2xl text-sm max-w-[75%] shadow-sm break-words ${isMe ? 'text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`} 
                   style={isMe ? { backgroundColor: themeColor } : {}}>
                {m.content}
                {isMe && (
                  <button onClick={() => deleteMessage(m.id)} className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} className="h-2" />
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute right-0 top-16 bottom-0 w-80 bg-white border-l z-30 shadow-2xl p-4 space-y-6 animate-in slide-in-from-right">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-black text-xs uppercase text-gray-400">การตั้งค่า</span>
            <button onClick={() => setShowSettings(false)}><X size={20}/></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">ชื่อเล่นของคุณ</label>
              <input value={myNick} onChange={e => setMyNick(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm" placeholder="ตั้งชื่อเล่นคุณ..." />
            </div>
            {!chatData.is_group && (
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">ชื่อเล่นเพื่อน</label>
                <input value={theirNick} onChange={e => setTheirNick(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm" placeholder="ตั้งชื่อเล่นเพื่อน..." />
              </div>
            )}
            <button onClick={saveNicknames} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold">บันทึกชื่อเล่น</button>
          </div>

          {chatData.is_group && (
            <button className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
              <UserPlus size={16}/> เพิ่มสมาชิก
            </button>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">สีธีมแชท</label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map(color => (
                <button key={color} onClick={() => saveTheme(color)} className="w-full aspect-square rounded-xl border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t flex gap-3 items-center">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 p-3.5 bg-gray-100 rounded-2xl text-sm outline-none" />
        <button type="submit" className="p-3.5 text-white rounded-2xl shadow-lg transition-transform active:scale-95" style={{ backgroundColor: themeColor }}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

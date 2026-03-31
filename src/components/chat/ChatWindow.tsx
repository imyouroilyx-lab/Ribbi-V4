'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, MoreVertical } from 'lucide-react';

interface ChatWindowProps {
  chatId: string;
  chatData: any; // รับข้อมูลแชท
  currentUser: any;
  onBack: () => void;
  onRefreshChats: () => void;
}

export default function ChatWindow({ chatId, chatData, currentUser, onBack, onRefreshChats }: ChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ✅ ดึงชื่อและรูปที่จะโชว์ใน Header
  const display = {
    name: chatData.is_group ? chatData.name : chatData.other_user?.display_name,
    img: chatData.is_group ? chatData.group_img_url : chatData.other_user?.profile_img_url
  };

  useEffect(() => {
    loadMessages();
    markAsRead(); // ✅ ลบ Badge ทันทีที่เข้าแชท

    const channel = supabase.channel(`room-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        markAsRead(); // ลบ Badge อีกรอบถ้ามีข้อความใหม่เด้งมาตอนเราดูอยู่
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [chatId]);

  // ✅ ฟังก์ชันลบ Badge (Clear unread_count)
  const markAsRead = async () => {
    const { error } = await supabase
      .from('chat_participants')
      .update({ unread_count: 0 })
      .eq('chat_id', chatId)
      .eq('user_id', currentUser.id);
    
    if (!error) onRefreshChats(); // บอกหน้าหลักให้ลบเลขออกด้วย
  };

  const loadMessages = async () => {
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setIsLoading(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input;
    setInput('');
    const { error } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content });
    if (!error) {
       await supabase.from('chats').update({ last_message_content: content, last_message_at: new Date().toISOString() }).eq('id', chatId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      {/* ✅ Header: โชว์ชื่อและรูปคู่สนทนา */}
      <div className="p-3 bg-white border-b flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden p-2 -ml-2 text-gray-400"><ChevronLeft size={24} /></button>
          <div className="relative">
            <img src={display.img || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" alt="" />
            {!chatData.is_group && chatData.other_user?.is_online && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
          <div>
            <h3 className="font-black text-sm text-gray-900 leading-tight">{display.name || 'Ribbi User'}</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
              {chatData.is_group ? 'กลุ่มสนทนา' : chatData.other_user?.is_online ? 'ออนไลน์ขณะนี้' : 'ออฟไลน์'}
            </p>
          </div>
        </div>
        <button className="p-2 text-gray-300"><MoreVertical size={20}/></button>
      </div>
      
      {/* ✅ Messages: แก้การโดนบีบโดยใช้ w-full และ max-w-[85%] */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
        {isLoading ? <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-frog-500" /></div> : (
          messages.map((m) => {
            const isMe = m.sender_id === currentUser.id;
            return (
              <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                  isMe 
                    ? 'bg-frog-500 text-white rounded-tr-none max-w-[85%] font-medium' 
                    : 'bg-white text-gray-800 rounded-tl-none max-w-[85%] border border-gray-100 font-medium'
                }`}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} className="h-2" />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 bg-white border-t flex gap-3 items-center">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder="พิมพ์ข้อความ..." 
          className="flex-1 p-3 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-500/20 transition-all" 
        />
        <button type="submit" disabled={!input.trim()} className="p-3 bg-frog-500 text-white rounded-2xl disabled:opacity-50 hover:bg-frog-600 transition-colors shadow-lg shadow-frog-100">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, ChevronLeft, Loader2, MoreVertical, ShieldAlert } from 'lucide-react';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const display = {
    name: chatData.is_group ? chatData.name : chatData.other_user?.display_name,
    img: chatData.is_group ? chatData.group_img_url : chatData.other_user?.profile_img_url
  };

  useEffect(() => {
    loadMessages();
    markAsRead(); // ✅ ล้าง Badge ทันทีที่เข้าห้อง

    const channel = supabase.channel(`room-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        markAsRead(); // ✅ ล้าง Badge อีกรอบถ้ามีข้อความใหม่เด้งมาขณะดูอยู่
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [chatId]);

  const markAsRead = async () => {
    try {
      await supabase.from('chat_participants').update({ unread_count: 0 }).eq('chat_id', chatId).eq('user_id', currentUser.id);
      onRefreshChats(); // อัปเดต UI รายการด้านซ้าย
    } catch (e) { console.error(e); }
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
    <div className="flex flex-col h-full bg-white w-full">
      {/* Header - ✅ กางเต็มพื้นที่ ไม่บีบ */}
      <div className="h-16 px-4 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="md:hidden p-2 -ml-2 text-gray-400 hover:text-gray-600"><ChevronLeft size={24} /></button>
          <img src={display.img || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-50" />
          <div className="min-w-0">
            <h3 className="font-bold text-[15px] text-gray-900 truncate">{display.name || 'Ribbi User'}</h3>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${chatData.other_user?.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                {chatData.other_user?.is_online ? 'Active Now' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <button className="p-2 text-gray-300 hover:text-gray-500"><MoreVertical size={20}/></button>
      </div>
      
      {/* Messages - ✅ แก้การบีบ: ใช้ w-full และ break-words */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#fcfdfe]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-frog-500" /></div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === currentUser.id;
            return (
              <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1`}>
                <div className={`
                  relative px-4 py-2.5 text-[14px] leading-relaxed shadow-sm break-words
                  ${isMe 
                    ? 'bg-frog-500 text-white rounded-2xl rounded-tr-sm max-w-[75%] md:max-w-[70%]' 
                    : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm max-w-[75%] md:max-w-[70%]'
                  }
                `}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} className="h-4" />
      </div>

      {/* Input Field */}
      <div className="p-4 bg-white border-t border-gray-100">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-3 items-center">
          <div className="flex-1 relative">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="พิมพ์ข้อความที่นี่..." 
              className="w-full p-3.5 bg-gray-50 rounded-2xl text-[14px] outline-none border border-transparent focus:border-frog-200 focus:bg-white transition-all pr-12" 
            />
          </div>
          <button 
            type="submit" 
            disabled={!input.trim()} 
            className="p-3.5 bg-frog-500 text-white rounded-2xl disabled:opacity-30 shadow-lg shadow-frog-100 hover:bg-frog-600 active:scale-95 transition-all"
          >
            <Send size={20} fill="currentColor" />
          </button>
        </form>
      </div>
    </div>
  );
}

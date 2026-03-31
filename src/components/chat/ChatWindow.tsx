'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Image as ImageIcon, ChevronLeft, Loader2 } from 'lucide-react';

interface ChatWindowProps {
  chatId: string;
  currentUser: any;
  onBack: () => void;
  onRefreshChats: () => void;
}

export default function ChatWindow({ chatId, currentUser, onBack, onRefreshChats }: ChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    // ✅ ดักจับข้อความใหม่ Realtime เฉพาะห้องนี้
    const channel = supabase.channel(`room-${chatId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `chat_id=eq.${chatId}` 
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        // สั่งอัปเดตรายการแชทข้างนอกด้วย (ให้ข้อความล่าสุดเปลี่ยน)
        onRefreshChats(); 
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  const loadMessages = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setIsLoading(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const msg = input;
    setInput('');
    const { error } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: msg });
    if (!error) {
      await supabase.from('chats').update({ last_message_content: msg, last_message_at: new Date().toISOString() }).eq('id', chatId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex items-center gap-3">
        <button onClick={onBack} className="md:hidden p-2"><ChevronLeft /></button>
        <h2 className="font-bold">ห้องสนทนา</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-frog-500" /></div> : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${m.sender_id === currentUser.id ? 'bg-frog-500 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
                {m.content}
              </div>
            </div>
          ))
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 p-2.5 bg-gray-100 rounded-2xl text-sm outline-none" />
        <button type="submit" className="p-2.5 bg-frog-500 text-white rounded-2xl"><Send size={20} /></button>
      </form>
    </div>
  );
}

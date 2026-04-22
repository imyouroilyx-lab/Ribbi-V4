'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Send, ChevronLeft, Loader2, Settings, Trash2, Edit2, X, 
  RefreshCcw, Palette, UserPen, Eraser, MessageSquare, 
  Users, UserMinus, UserPlus, Check, Image as ImageIcon, Search, Camera, LogOut
} from 'lucide-react';
import Link from 'next/link';

export default function ChatWindow({ chatId, chatData: initialChatData, currentUser, onBack, onRefreshChats }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ✅ States สำหรับระบบส่งรูปภาพ
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  // ✅ States สำหรับการตั้งค่า
  const [myNick, setMyNick] = useState('');
  const [theirNick, setTheirNick] = useState('');
  const [tempColor, setTempColor] = useState('');
  const [groupName, setGroupName] = useState(''); 
  const [groupImg, setGroupImg] = useState(''); 
  const lastId = useRef(chatId);

  // ✅ States สำหรับจัดการกลุ่ม
  const [participants, setParticipants] = useState<any[]>([]);
  const [myRole, setMyRole] = useState('member');
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); 
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 📡 1. ระบบ Realtime & Load Messages
  useEffect(() => {
    loadMessages();
    markAsRead();

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages', 
        filter: `chat_id=eq.${chatId}` 
      }, () => {
        loadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  // 🔄 2. จัดการข้อมูลเบื้องต้นเมื่อเปลี่ยนห้อง
  useEffect(() => {
    if (lastId.current !== chatId || !showSettings) {
      setMyNick(initialChatData.my_nickname || '');
      setTheirNick(initialChatData.other_user?.display_name || '');
      setTempColor(initialChatData.theme_color || '#22c55e');
      setGroupName(initialChatData.name || ''); 
      setGroupImg(initialChatData.group_img_url || ''); 
      lastId.current = chatId;
      setShowAddMember(false);
      setSearchTerm('');
      setShowImageInput(false);
      setImageUrl('');
    }
  }, [initialChatData, chatId, showSettings]);

  // 👥 3. จัดการข้อมูลสมาชิกและเพื่อน
  useEffect(() => {
    if (showSettings && initialChatData.is_group) {
      loadParticipants();
    }
  }, [showSettings, chatId]);

  useEffect(() => {
    if (showAddMember) {
      loadAvailableFriends();
    }
  }, [showAddMember]);

  const loadParticipants = async () => {
    const { data } = await supabase
      .from('chat_participants')
      .select('role, user_id, user:user_id(id, username, display_name, profile_img_url)')
      .eq('chat_id', chatId);

    if (data) {
      setParticipants(data);
      const me = data.find(p => p.user_id === currentUser.id);
      setMyRole(me?.role || 'member');
    }
  };

  const loadAvailableFriends = async () => {
    const { data } = await supabase
      .from('friendships')
      .select(`
        sender:users!friendships_sender_id_fkey(id, display_name, profile_img_url, username),
        receiver:users!friendships_receiver_id_fkey(id, display_name, profile_img_url, username)
      `)
      .eq('status', 'accepted')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

    if (data) {
      const friendList = data.map((f: any) => f.sender.id === currentUser.id ? f.receiver : f.sender);
      const currentMemberIds = participants.map(p => p.user_id);
      setAvailableFriends(friendList.filter(f => !currentMemberIds.includes(f.id)));
    }
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(id, display_name, profile_img_url)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.filter(m => !(m.deleted_by || []).includes(currentUser.id)));
    }
    setIsLoading(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const markAsRead = async () => {
    await supabase.from('chat_participants').update({ unread_count: 0 }).eq('chat_id', chatId).eq('user_id', currentUser.id);
    onRefreshChats();
  };

  // ✉️ 4. ฟังก์ชันส่ง/แก้ไขข้อความ
  const handleSend = async (e: any) => {
    e.preventDefault();
    if (!input.trim() && !imageUrl.trim()) return;

    const content = input.trim();
    const images = imageUrl.trim() ? [imageUrl.trim()] : null;
    
    setInput('');
    setImageUrl('');
    setShowImageInput(false);

    if (editingId) {
      await supabase.from('messages').update({ content, updated_at: new Date().toISOString() }).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content, images });
      await supabase.from('chats').update({ last_message_content: content || '[ส่งรูปภาพ]', last_message_at: new Date().toISOString() }).eq('id', chatId);
    }
    onRefreshChats();
  };

  // ⚙️ 5. ระบบบันทึกการตั้งค่า
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
      
      if (initialChatData.is_group) {
        const updates: any = {};
        if (groupName !== initialChatData.name) updates.name = groupName;
        if (groupImg !== initialChatData.group_img_url) updates.group_img_url = groupImg.trim() || null;

        if (Object.keys(updates).length > 0) {
          await supabase.from('chats').update(updates).eq('id', chatId);
          await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} อัปเดตโปรไฟล์กลุ่ม`, event: 'system' });
        }
      }

      alert('บันทึกเรียบร้อย!');
      setShowSettings(false);
      onRefreshChats();
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const clearHistoryForMe = async () => {
    if (!confirm('ล้างประวัติการแชท (หายเฉพาะฝั่งคุณ)?')) return;
    const { data } = await supabase.from('messages').select('id, deleted_by').eq('chat_id', chatId);
    if (data) {
      const updates = data.map(m => {
        const current = m.deleted_by || [];
        return supabase.from('messages').update({ deleted_by: [...current, currentUser.id] }).eq('id', m.id);
      });
      await Promise.all(updates);
      loadMessages();
      setShowSettings(false);
    }
  };

  const handleKickMember = async (targetUserId: string, targetName: string) => {
    if (!confirm(`คุณต้องการเตะ ${targetName} ออกจากกลุ่มใช่หรือไม่?`)) return;
    try {
      const { error } = await supabase.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', targetUserId);
      if (error) throw error;
      await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} ได้เตะ ${targetName} ออกจากกลุ่ม`, event: 'system' });
      loadParticipants();
    } catch (err: any) { alert(`ล้มเหลว: ${err.message}`); }
  };

  // ✅ ใหม่: ฟังก์ชันออกจากกลุ่มเอง
  const handleLeaveGroup = async () => {
    if (!confirm('คุณต้องการออกจากกลุ่มนี้ใช่หรือไม่?')) return;
    try {
      const { error } = await supabase.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', currentUser.id);
      if (error) throw error;
      await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} ได้ออกจากกลุ่ม`, event: 'system' });
      onBack(); // กลับหน้าลิสต์แชททันที
      onRefreshChats();
    } catch (err: any) { alert(`ล้มเหลว: ${err.message}`); }
  };

  const submitAddMembers = async () => {
    if (selectedNewMembers.length === 0) return;
    setIsAdding(true);
    try {
      const newParticipants = selectedNewMembers.map(id => ({ chat_id: chatId, user_id: id, role: 'member' }));
      await supabase.from('chat_participants').insert(newParticipants);
      const addedNames = availableFriends.filter(f => selectedNewMembers.includes(f.id)).map(f => f.display_name).join(', ');
      await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUser.id, content: `${currentUser.display_name} ได้เพิ่ม ${addedNames} เข้ากลุ่ม`, event: 'system' });
      setShowAddMember(false);
      setSelectedNewMembers([]);
      setSearchTerm('');
      loadParticipants();
    } catch (e) { console.error(e); } finally { setIsAdding(false); }
  };

  const filteredFriends = availableFriends.filter(f => 
    f.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderMessageContent = (content: string) => {
    if (!content) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all hover:opacity-80">{part}</a>;
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative overflow-hidden">
      {/* Header */}
      <div className="h-16 px-4 border-b flex items-center justify-between bg-white/90 z-20 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="md:hidden p-1 text-gray-400"><ChevronLeft /></button>
          <div className="flex items-center gap-3">
            <img src={(initialChatData.is_group ? (groupImg || initialChatData.group_img_url) : initialChatData.other_user?.profile_img_url) || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border shadow-sm" alt="" />
            <h3 className="font-bold text-sm truncate">{initialChatData.is_group ? groupName : (theirNick || initialChatData.other_user?.display_name || 'ผู้ใช้ Ribbi')}</h3>
          </div>
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
            <p className="text-xs font-black uppercase mt-2">ยังไม่มีข้อความ</p>
          </div>
        )}
        {messages.map((m) => {
          if (m.event === 'system') return <div key={m.id} className="text-center text-[10px] text-gray-400 font-bold uppercase py-4 tracking-widest">{m.content}</div>;
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group items-end gap-2 animate-in fade-in slide-in-from-bottom-1`}>
              {!isMe && (
                <Link href={`/profile/${m.sender?.username}`} className="flex-shrink-0 mb-1">
                  <img src={m.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover border shadow-sm" alt="" />
                </Link>
              )}
              <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'} gap-1`}>
                
                {/* ✅ ส่วนที่เพิ่ม: แสดงชื่อผู้ส่งในกรณีที่เป็นแชทกลุ่มและไม่ใช่เราเอง */}
                {!isMe && initialChatData.is_group && (
                  <span className="text-[10px] font-black text-gray-400 ml-1 uppercase tracking-tighter">
                    {m.sender?.display_name}
                  </span>
                )}

                <div className={`relative px-4 py-2.5 rounded-2xl text-[14px] shadow-sm break-words ${isMe ? 'text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`} 
                     style={{ backgroundColor: isMe ? (initialChatData.theme_color || '#22c55e') : undefined }}>
                  {m.images && m.images.length > 0 && <img src={m.images[0]} alt="Pic" className="rounded-xl mb-2 max-w-full max-h-64 object-cover" loading="lazy" />}
                  {m.content && <div>{renderMessageContent(m.content)}</div>}
                  {isMe && (
                    <div className="absolute -left-16 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white border rounded-lg p-1 shadow-lg z-10">
                        <button onClick={() => { setEditingId(m.id); setInput(m.content); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={12}/></button>
                        <button onClick={() => { if(confirm('ลบข้อความนี้?')) supabase.from('messages').delete().eq('id', m.id); }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
                {m.updated_at && <span className="text-[9px] text-gray-400 italic">แก้ไขแล้ว</span>}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Settings Drawer */}
      {showSettings && (
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-white border-l z-30 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50">
            <span className="font-black text-xs uppercase text-gray-400">การตั้งค่า</span>
            <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white rounded-full"><X size={20}/></button>
          </div>
          <div className="p-6 space-y-8 flex-1 overflow-y-auto pb-24 custom-scrollbar">
            {initialChatData.is_group && (
              <>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-frog-600 flex items-center gap-2"><Camera size={14}/> รูปกลุ่ม (URL)</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                      {groupImg ? <img src={groupImg} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300" />}
                    </div>
                    <input value={groupImg} onChange={e => setGroupImg(e.target.value)} placeholder="วาง URL รูปกลุ่ม..." className="flex-1 p-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs outline-none focus:ring-1 focus:ring-frog-300" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-frog-600 flex items-center gap-2"><Users size={14}/> ชื่อกลุ่ม</h4>
                  <input value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none" />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase text-frog-600">สมาชิก ({participants.length})</h4>
                    <button onClick={() => setShowAddMember(!showAddMember)} className="text-[10px] font-bold text-frog-600 flex items-center gap-1"><UserPlus size={12} /> เพิ่มคน</button>
                  </div>
                  {showAddMember && (
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-3 animate-in fade-in">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ค้นหาเพื่อน..." className="w-full pl-9 pr-3 py-2 bg-white border border-gray-100 rounded-xl text-xs outline-none" />
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                        {filteredFriends.map(f => (
                          <button key={f.id} onClick={() => setSelectedNewMembers(prev => prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id])} className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all ${selectedNewMembers.includes(f.id) ? 'bg-white border-frog-400 shadow-sm' : 'bg-white border-transparent hover:bg-gray-100'}`}>
                            <div className="flex items-center gap-2">
                              <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-6 h-6 rounded-full object-cover" />
                              <span className="text-xs font-bold text-gray-700 truncate">{f.display_name}</span>
                            </div>
                            {selectedNewMembers.includes(f.id) && <Check size={14} className="text-frog-600" />}
                          </button>
                        ))}
                      </div>
                      {selectedNewMembers.length > 0 && <button onClick={submitAddMembers} disabled={isAdding} className="w-full py-2.5 bg-frog-500 text-white rounded-xl text-[10px] font-black uppercase">{isAdding ? 'กำลังดึง...' : `ดึงเข้า (${selectedNewMembers.length})`}</button>}
                    </div>
                  )}
                  <div className="space-y-2">
                    {participants.map(p => (
                      <div key={p.user?.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 truncate">
                          <img src={p.user?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-6 h-6 rounded-full object-cover shadow-sm" />
                          <span className="text-xs font-bold truncate">{p.user?.display_name}</span>
                        </div>
                        {myRole === 'admin' && p.user?.id !== currentUser.id && (
                          <button onClick={() => handleKickMember(p.user?.id, p.user?.display_name)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><UserMinus size={14} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-frog-600 flex items-center gap-2"><UserPen size={14}/> ชื่อเล่นของคุณในแชทนี้</h4>
              <input value={myNick} onChange={e => setMyNick(e.target.value)} placeholder="ชื่อเล่นของคุณ..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none" />
              {!initialChatData.is_group && <input value={theirNick} onChange={e => setTheirNick(e.target.value)} placeholder="ชื่อเล่นเพื่อน..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none" />}
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-frog-600 flex items-center gap-2"><Palette size={14}/> สีธีมแชท</h4>
              <div className="grid grid-cols-5 gap-2">
                {['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#000000', '#64748b', '#f97316'].map(c => (
                  <button key={c} onClick={() => setTempColor(c)} className={`aspect-square rounded-full border-2 ${tempColor === c ? 'border-gray-900 scale-110 shadow-md' : 'border-white'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            
            <div className="space-y-2 pt-4">
               <button onClick={clearHistoryForMe} className="w-full p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"><Eraser size={14}/> ล้างแชท (ฝั่งคุณ)</button>
               
               {/* ✅ ใหม่: ปุ่มออกจากกลุ่ม */}
               {initialChatData.is_group && (
                 <button onClick={handleLeaveGroup} className="w-full p-4 bg-orange-50 text-orange-600 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors">
                   <LogOut size={14}/> ออกจากกลุ่ม
                 </button>
               )}
            </div>
          </div>
          <div className="p-4 bg-white border-t">
            <button onClick={saveAllSettings} disabled={isSaving} className="w-full py-4 rounded-[1.25rem] text-[12px] font-black uppercase bg-frog-500 text-white shadow-xl active:scale-95 disabled:opacity-50">
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </button>
          </div>
        </div>
      )}

      {/* Form Area */}
      <div className="relative">
        {showImageInput && (
          <div className="absolute bottom-full left-0 right-0 p-3 bg-gray-50 border-t border-gray-200 z-10">
            <div className="flex items-center gap-2">
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="วาง URL รูปภาพ..." className="flex-1 p-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-frog-300" />
              <button type="button" onClick={() => { setImageUrl(''); setShowImageInput(false); }} className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-xl border border-gray-200"><X size={16}/></button>
            </div>
            {imageUrl && <img src={imageUrl} className="mt-2 h-20 object-cover rounded-lg shadow-sm border" alt="Preview" />}
          </div>
        )}
        <form onSubmit={handleSend} className="p-3 border-t bg-white flex items-center gap-2 relative">
          {editingId && (
            <div className="absolute -top-10 left-4 right-4 bg-blue-500 text-white p-2 rounded-t-xl text-[10px] font-bold flex justify-between animate-in slide-in-from-bottom-2">
              <span>กำลังแก้ไขข้อความ...</span>
              <button type="button" onClick={() => { setEditingId(null); setInput(''); }}><X size={14}/></button>
            </div>
          )}
          <button type="button" onClick={() => setShowImageInput(!showImageInput)} className={`p-2.5 rounded-2xl transition-colors ${showImageInput ? 'bg-frog-100 text-frog-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`} title="แนบรูปภาพ"><ImageIcon size={20} /></button>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 p-3.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-200 text-gray-900" />
          <button type="submit" disabled={!input.trim() && !imageUrl.trim()} className="p-3.5 text-white rounded-2xl shadow-lg disabled:opacity-50 transition-opacity" style={{ backgroundColor: initialChatData.theme_color || '#22c55e' }}><Send size={20} /></button>
        </form>
      </div>
    </div>
  );
}

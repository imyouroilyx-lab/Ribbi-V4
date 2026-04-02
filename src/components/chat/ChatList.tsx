'use client';

import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { Search, Plus, Users, X, Loader2, Check, Camera, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Chat } from '../MessagesPage';

interface ChatListProps {
  chats: Chat[];
  currentUserId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onRefresh: () => void;
}

export default function ChatList({ chats, currentUserId, selectedChatId, onSelectChat, onRefresh }: ChatListProps) {
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mode, setMode] = useState<'single' | 'group'>('single');
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupImg, setGroupImg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ ระบบกรอง Chat ID ซ้ำ (จบปัญหา Duplicate)
  const filtered = useMemo(() => {
    const uniqueMap = new Map();
    chats.forEach(c => {
      if (!uniqueMap.has(c.id)) {
        uniqueMap.set(c.id, c);
      }
    });
    
    const uniqueList = Array.from(uniqueMap.values());

    return uniqueList.filter(c => {
      const name = c.is_group ? c.name : c.other_user?.display_name;
      return (name || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [chats, search]);

  // ✅ ฟังก์ชันเลือกแชท และเคลียร์ Badge (Mark as Read)
  const handleSelectChat = (chatId: string) => {
    onSelectChat(chatId);
    const targetChat = chats.find(c => c.id === chatId);
    if (!targetChat || targetChat.unread_count === 0) return;

    supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', currentUserId)
      .then(({ error }) => {
        if (!error) {
          onRefresh();
        } else {
          console.error("Mark as read error:", error);
        }
      });
  };

  const openCreateModal = async (type: 'single' | 'group') => {
    setMode(type);
    setShowCreateModal(true);
    setLoadingFriends(true);
    setSelectedFriendIds([]);
    setGroupName('');
    setGroupImg('');

    const { data } = await supabase
      .from('friendships')
      .select(`
        sender:users!friendships_sender_id_fkey(id, display_name, profile_img_url, username),
        receiver:users!friendships_receiver_id_fkey(id, display_name, profile_img_url, username)
      `)
      .eq('status', 'accepted')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);
    
    if (data) {
      const list = data.map((f: any) => f.sender.id === currentUserId ? f.receiver : f.sender);
      setFriends(list);
    }
    setLoadingFriends(false);
  };

  // ✅ แก้ไข: เพิ่มระบบส่งข้อความแรกเพื่อให้กลุ่มแสดงผลทันที
  const handleCreateChat = async (friendId?: string) => {
    setIsSubmitting(true);
    try {
      if (mode === 'single' && friendId) {
        const { data: chatId, error } = await supabase.rpc('get_or_create_dm', { 
          uid_a: currentUserId, 
          uid_b: friendId 
        });

        if (error) throw error;
        if (chatId) {
          onRefresh(); 
          handleSelectChat(chatId);
        }
      } else if (mode === 'group') {
        if (!groupName.trim() || selectedFriendIds.length === 0) return;
        
        // 1. สร้างแชทกลุ่ม
        const { data: newGroup, error: chatError } = await supabase.from('chats').insert({ 
          is_group: true, 
          name: groupName, 
          group_img_url: groupImg.trim() || null, 
          created_by: currentUserId,
          last_message_content: `สร้างกลุ่ม "${groupName}" เรียบร้อยแล้ว`,
          last_message_at: new Date().toISOString()
        }).select().single();

        if (chatError) throw chatError;

        if (newGroup) {
          // 2. เพิ่มสมาชิกทุกคนเข้ากลุ่ม
          const participants = [
            { chat_id: newGroup.id, user_id: currentUserId, role: 'admin', last_read_at: new Date().toISOString() }, 
            ...selectedFriendIds.map(id => ({ chat_id: newGroup.id, user_id: id, role: 'member' }))
          ];
          await supabase.from('chat_participants').insert(participants);

          // 3. ✅ ส่งข้อความระบบ (System Message) เพื่อให้แชทโผล่ในรายการทันที
          await supabase.from('messages').insert({
            chat_id: newGroup.id,
            sender_id: currentUserId,
            content: `สร้างกลุ่ม "${groupName}" เรียบร้อยแล้ว`,
            event: 'system'
          });

          onRefresh(); 
          handleSelectChat(newGroup.id);
        }
      }
      setShowCreateModal(false);
    } catch (e) { 
      console.error(e);
      alert('ไม่สามารถสร้างแชทได้ กรุณาลองใหม่อีกครั้ง');
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="h-full flex flex-col bg-white relative border-r">
      <div className="p-4 border-b space-y-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xl font-black italic tracking-tighter text-gray-900 uppercase">Messages</h2>
          <div className="flex gap-1">
             <button onClick={() => openCreateModal('single')} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Plus size={20}/></button>
             <button onClick={() => openCreateModal('group')} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Users size={20}/></button>
          </div>
        </div>
        <div className="px-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาการสนทนา..." className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200 transition-all text-gray-900" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="py-20 text-center opacity-20">
            <MessageSquare size={48} className="mx-auto mb-2 text-gray-900" />
            <p className="text-[10px] font-black uppercase text-gray-900">No Chats Found</p>
          </div>
        ) : (
          filtered.map(c => {
            const name = c.is_group ? c.name : c.other_user?.display_name;
            const img = c.is_group ? c.group_img_url : c.other_user?.profile_img_url;
            return (
              <button 
                key={c.id} 
                onClick={() => handleSelectChat(c.id)} 
                className={`w-full p-4 flex gap-3 hover:bg-gray-50 transition-all border-b border-gray-50 ${selectedChatId === c.id ? 'bg-indigo-50/50' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  <img src={img || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
                  {!c.is_group && c.other_user?.is_online && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-bold truncate text-[14px] text-gray-900">{name || 'Ribbi User'}</h3>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">
                      {c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: th }) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{c.last_message_content || 'ยังไม่มีข้อความ'}</p>
                </div>
                {c.unread_count > 0 && (
                  <div className="bg-indigo-500 text-white text-[10px] rounded-full px-1.5 h-4 flex items-center justify-center font-black min-w-[16px]">
                    {c.unread_count}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {showCreateModal && (
        <div className="absolute inset-0 bg-white z-[60] flex flex-col animate-in fade-in slide-in-from-bottom-2 h-full overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
            <span className="font-black text-[10px] uppercase text-indigo-600 tracking-widest">{mode === 'single' ? 'New Message' : 'Create Group'}</span>
            <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-white rounded-full transition-colors"><X size={24}/></button>
          </div>
          
          {mode === 'group' && (
            <div className="p-4 bg-white border-b space-y-3 flex-shrink-0">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 overflow-hidden shrink-0">
                    {groupImg ? <img src={groupImg} className="w-full h-full object-cover" alt="" /> : <Camera size={24}/>}
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="ชื่อกลุ่ม..." className="w-full p-2 bg-gray-50 rounded-xl text-sm outline-none border border-transparent focus:border-indigo-200 transition-all text-gray-900" />
                    <input value={groupImg} onChange={e => setGroupImg(e.target.value)} placeholder="URL รูปภาพกลุ่ม..." className="w-full p-2 bg-gray-50 rounded-xl text-[11px] outline-none border border-transparent focus:border-indigo-200 transition-all text-gray-900" />
                  </div>
               </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingFriends ? (
              <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>
            ) : friends.length === 0 ? (
              <p className="p-10 text-center text-xs text-gray-400 font-bold italic">ไม่พบรายชื่อเพื่อน</p>
            ) : (
              friends.map(f => (
                <button 
                  key={f.id} 
                  onClick={() => mode === 'single' ? handleCreateChat(f.id) : setSelectedFriendIds(prev => prev.includes(f.id) ? prev.filter(i => i !== f.id) : [...prev, f.id])} 
                  className={`w-full p-3 flex items-center gap-3 border-b border-gray-50 transition-colors ${selectedFriendIds.includes(f.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="relative flex-shrink-0">
                    <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" alt="" />
                    {selectedFriendIds.includes(f.id) && <div className="absolute -top-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm"><Check size={10} strokeWidth={4}/></div>}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <p className="font-bold text-sm text-gray-900 truncate">{f.display_name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest truncate">@{f.username}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {mode === 'group' && (
            <div className="p-4 bg-gray-50 border-t flex-shrink-0 sticky bottom-0">
              <button 
                onClick={() => handleCreateChat()} 
                disabled={isSubmitting || !groupName.trim() || selectedFriendIds.length === 0} 
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSubmitting ? 'กำลังสร้าง...' : `สร้างกลุ่ม (${selectedFriendIds.length} คน)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

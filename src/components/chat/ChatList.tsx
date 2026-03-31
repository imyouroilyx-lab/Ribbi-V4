'use client';

import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { Search, Plus, Users, X, Loader2, Check, Camera, Image as ImageIcon } from 'lucide-react';
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
  
  // ✅ States สำหรับสร้างกลุ่ม
  const [groupName, setGroupName] = useState('');
  const [groupImg, setGroupImg] = useState(''); // เก็บ URL รูปกลุ่ม
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = useMemo(() => {
    return chats.filter(c => {
      const name = c.is_group ? c.name : c.other_user?.display_name;
      return (name || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [chats, search]);

  const openCreateModal = async (type: 'single' | 'group') => {
    setMode(type);
    setShowCreateModal(true);
    setLoadingFriends(true);
    setSelectedFriendIds([]);
    setGroupName('');
    setGroupImg(''); // รีเซ็ตค่ารูป

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

  const handleCreateChat = async (friendId?: string) => {
    setIsSubmitting(true);
    try {
      if (mode === 'single' && friendId) {
        const existing = chats.find(c => !c.is_group && c.other_user?.id === friendId);
        if (existing) {
          onSelectChat(existing.id);
          setShowCreateModal(false);
          return;
        }
        const { data: newChat } = await supabase.from('chats').insert({ is_group: false }).select().single();
        if (newChat) {
          await supabase.from('chat_participants').insert([
            { chat_id: newChat.id, user_id: currentUserId, role: 'admin' },
            { chat_id: newChat.id, user_id: friendId, role: 'member' }
          ]);
          onRefresh();
          onSelectChat(newChat.id);
        }
      } else if (mode === 'group') {
        if (!groupName.trim() || selectedFriendIds.length === 0) {
          alert('กรุณาระบุชื่อกลุ่มและเลือกสมาชิก');
          return;
        }
        
        // ✅ เพิ่ม group_img_url ลงในการ insert
        const { data: newGroup } = await supabase.from('chats').insert({ 
          is_group: true, 
          name: groupName, 
          group_img_url: groupImg.trim() || null, // ถ้าไม่ใส่ให้เป็น null
          created_by: currentUserId 
        }).select().single();

        if (newGroup) {
          const participants = [
            { chat_id: newGroup.id, user_id: currentUserId, role: 'admin' },
            ...selectedFriendIds.map(id => ({ chat_id: newGroup.id, user_id: id, role: 'member' }))
          ];
          await supabase.from('chat_participants').insert(participants);
          
          await supabase.from('messages').insert({ 
            chat_id: newGroup.id, 
            sender_id: currentUserId, 
            content: `กลุ่ม ${groupName} ถูกสร้างขึ้นแล้ว`, 
            event: 'system' 
          });

          onRefresh();
          onSelectChat(newGroup.id);
        }
      }
      setShowCreateModal(false);
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriendIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black italic tracking-tighter">MESSAGES</h2>
          <div className="flex gap-1">
             <button onClick={() => openCreateModal('single')} className="p-2 text-frog-600 hover:bg-frog-50 rounded-xl transition-all"><Plus size={20}/></button>
             <button onClick={() => openCreateModal('group')} className="p-2 text-frog-600 hover:bg-frog-50 rounded-xl transition-all"><Users size={20}/></button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาการสนทนา..." className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-frog-200" />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(c => {
          const name = c.is_group ? c.name : c.other_user?.display_name;
          // ✅ ใช้ group_img_url สำหรับกลุ่ม
          const img = c.is_group ? c.group_img_url : c.other_user?.profile_img_url;
          return (
            <button key={c.id} onClick={() => onSelectChat(c.id)} className={`w-full p-4 flex gap-3 hover:bg-gray-50 transition-all border-b border-gray-50 ${selectedChatId === c.id ? 'bg-frog-50/50' : ''}`}>
              <div className="relative flex-shrink-0">
                <img src={img || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                {!c.is_group && c.other_user?.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="font-bold truncate text-[14px] text-gray-900">{name || 'Ribbi User'}</h3>
                  <span className="text-[9px] font-bold text-gray-400 uppercase">{c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: th }) : ''}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{c.last_message_content || 'ส่งรูปภาพ'}</p>
              </div>
              {c.unread_count > 0 && <div className="bg-frog-500 text-white text-[10px] rounded-full px-1.5 h-4 flex items-center justify-center font-black">{c.unread_count}</div>}
            </button>
          );
        })}
      </div>

      {/* Modal: Create Group */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-white z-[60] flex flex-col animate-in fade-in slide-in-from-bottom-2">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50">
            <span className="font-black text-xs uppercase text-frog-600">{mode === 'single' ? 'New Message' : 'Create Group'}</span>
            <button onClick={() => setShowCreateModal(false)}><X size={24}/></button>
          </div>

          {mode === 'group' && (
            <div className="p-4 bg-white border-b space-y-4">
               <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <div className="w-full h-full bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 overflow-hidden">
                      {groupImg ? <img src={groupImg} className="w-full h-full object-cover" /> : <Camera size={24}/>}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <input 
                      value={groupName} 
                      onChange={e => setGroupName(e.target.value)} 
                      placeholder="ชื่อกลุ่ม..." 
                      className="w-full p-2 bg-gray-50 rounded-xl text-sm outline-none border border-transparent focus:border-frog-200"
                    />
                    <input 
                      value={groupImg} 
                      onChange={e => setGroupImg(e.target.value)} 
                      placeholder="URL รูปภาพกลุ่ม (ถ้ามี)..." 
                      className="w-full p-2 bg-gray-50 rounded-xl text-[11px] outline-none border border-transparent focus:border-frog-200"
                    />
                  </div>
               </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">เลือกสมาชิก ({selectedFriendIds.length})</div>
            {friends.map(f => (
              <button 
                key={f.id} 
                onClick={() => mode === 'single' ? handleCreateChat(f.id) : toggleFriend(f.id)} 
                className={`w-full p-3 flex items-center gap-3 border-b border-gray-50 ${selectedFriendIds.includes(f.id) ? 'bg-frog-50' : ''}`}
              >
                <div className="relative">
                  <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" />
                  {selectedFriendIds.includes(f.id) && (
                    <div className="absolute -top-1 -right-1 bg-frog-500 text-white rounded-full p-0.5 border-2 border-white"><Check size={10} strokeWidth={4}/></div>
                  )}
                </div>
                <div className="text-left"><p className="font-bold text-sm">{f.display_name}</p><p className="text-[10px] text-gray-400">@{f.username}</p></div>
              </button>
            ))}
          </div>

          {mode === 'group' && (
            <div className="p-4 bg-gray-50 border-t">
              <button 
                onClick={() => handleCreateChat()}
                disabled={isSubmitting || !groupName.trim() || selectedFriendIds.length === 0}
                className="w-full py-3 !bg-frog-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : `สร้างกลุ่ม (${selectedFriendIds.length} คน)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

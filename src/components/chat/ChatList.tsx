'use client';

import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { Search, Plus, X, Users, Check } from 'lucide-react';
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Chat } from '@/components/MessagesPage';

interface ChatListProps {
  chats: Chat[];
  currentUserId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onRefresh: () => void;
}

export default function ChatList({ chats, currentUserId, selectedChatId, onSelectChat, onRefresh }: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'dm' | 'group'>('dm');

  // DM
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  // Group
  const [allFriends, setAllFriends] = useState<any[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupImgUrl, setGroupImgUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // ✅ แก้ไข: เพิ่มการ Sort และ Memoize ข้อมูลเพื่อให้การจัดเรียงคงที่และถูกต้อง
  const sortedAndFilteredChats = useMemo(() => {
    // 1. Filter ตามคำค้นหา
    const filtered = chats.filter(chat => {
      const name = chat.is_group
        ? (chat.name || '').toLowerCase()
        : (chat.other_user?.nickname || chat.other_user?.display_name || '').toLowerCase();
      const username = chat.is_group ? '' : (chat.other_user?.username || '').toLowerCase();
      
      const search = searchQuery.toLowerCase();
      return name.includes(search) || username.includes(search);
    });

    // 2. Sort ตามเวลาข้อความล่าสุด (Newest to Oldest)
    return [...filtered].sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      
      // ถ้าเวลาเท่ากัน ให้ใช้ id เป็นตัวตัดสินลำดับให้นิ่ง
      if (timeB === timeA) {
        return b.id.localeCompare(a.id);
      }
      return timeB - timeA;
    });
  }, [chats, searchQuery]);

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    try { 
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: th }); 
    } catch { 
      return ''; 
    }
  };

  const loadFriends = async (forGroup = false) => {
    setIsLoadingFriends(true);
    try {
      const { data: sent } = await supabase.from('friendships').select('receiver_id').eq('sender_id', currentUserId).eq('status', 'accepted');
      const { data: received } = await supabase.from('friendships').select('sender_id').eq('receiver_id', currentUserId).eq('status', 'accepted');
      const allIds = [...new Set([...(sent?.map(f => f.receiver_id) || []), ...(received?.map(f => f.sender_id) || [])])];
      if (allIds.length === 0) { forGroup ? setAllFriends([]) : setFriends([]); return; }

      if (forGroup) {
        const { data } = await supabase.from('users').select('id, username, display_name, profile_img_url').in('id', allIds);
        setAllFriends(data || []);
      } else {
        const existingIds = chats.filter(c => !c.is_group).map(c => c.other_user?.id).filter(Boolean);
        const newIds = allIds.filter(id => !existingIds.includes(id));
        if (newIds.length === 0) { setFriends([]); return; }
        const { data } = await supabase.from('users').select('id, username, display_name, profile_img_url').in('id', newIds);
        setFriends(data || []);
      }
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const openModal = (mode: 'dm' | 'group') => {
    setModalMode(mode);
    setSelectedFriendId(null);
    setSelectedMemberIds([]);
    setGroupName('');
    setGroupImgUrl('');
    loadFriends(mode === 'group');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFriendId(null);
    setSelectedMemberIds([]);
  };

  const createDM = async () => {
    if (!selectedFriendId) return;
    setIsCreating(true);
    try {
      const { data: newChat, error } = await supabase.from('chats').insert({ is_group: false }).select().single();
      if (error || !newChat) { alert('ไม่สามารถสร้างแชทได้'); return; }
      await supabase.from('chat_participants').insert([
        { chat_id: newChat.id, user_id: currentUserId, role: 'member' },
        { chat_id: newChat.id, user_id: selectedFriendId, role: 'member' },
      ]);
      onRefresh();
      onSelectChat(newChat.id);
      closeModal();
    } finally {
      setIsCreating(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedMemberIds.length === 0) {
      alert('กรุณาใส่ชื่อกลุ่มและเลือกสมาชิกอย่างน้อย 1 คน');
      return;
    }
    setIsCreating(true);
    try {
      const { data: newChat, error } = await supabase.from('chats').insert({
        is_group: true,
        name: groupName.trim(),
        group_img_url: groupImgUrl.trim() || null,
        created_by: currentUserId,
      }).select().single();

      if (error || !newChat) { alert('ไม่สามารถสร้างกลุ่มได้'); return; }

      await supabase.from('chat_participants').insert([
        { chat_id: newChat.id, user_id: currentUserId, role: 'admin' },
        ...selectedMemberIds.map(id => ({ chat_id: newChat.id, user_id: id, role: 'member' })),
      ]);

      await supabase.from('messages').insert({
        chat_id: newChat.id,
        sender_id: currentUserId,
        content: `สร้างกลุ่ม "${groupName.trim()}"`,
        event: 'group_created',
      });

      onRefresh();
      onSelectChat(newChat.id);
      closeModal();
    } finally {
      setIsCreating(false);
    }
  };

  const getChatDisplay = (chat: Chat) => {
    if (chat.is_group) {
      return {
        name: chat.name || 'กลุ่มไม่มีชื่อ',
        img: chat.group_img_url,
        isOnline: false,
        isGroup: true,
        memberCount: (chat.members?.length || 0) + 1,
      };
    }
    return {
      name: chat.other_user?.nickname || chat.other_user?.display_name || '',
      img: chat.other_user?.profile_img_url,
      isOnline: chat.other_user?.is_online || false,
      isGroup: false,
      memberCount: 0,
    };
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-bold">ข้อความ</h2>
          <div className="flex gap-1">
            <button onClick={() => openModal('group')} className="p-2 hover:bg-gray-100 rounded-full transition" title="สร้างกลุ่ม">
              <Users className="w-5 h-5" />
            </button>
            <button onClick={() => openModal('dm')} className="p-2 hover:bg-gray-100 rounded-full transition" title="แชทใหม่">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาแชท..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-frog-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {sortedAndFilteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <p className="text-center">{searchQuery ? 'ไม่พบแชท' : 'ยังไม่มีแชท'}</p>
            {!searchQuery && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => openModal('dm')} className="px-4 py-2 bg-frog-500 text-white rounded-full hover:bg-frog-600 transition text-sm">แชทใหม่</button>
                <button onClick={() => openModal('group')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition text-sm">สร้างกลุ่ม</button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedAndFilteredChats.map((chat) => {
              const display = getChatDisplay(chat);
              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition text-left ${selectedChatId === chat.id ? 'bg-frog-50' : ''}`}
                >
                  <div className="relative flex-shrink-0">
                    {display.isGroup ? (
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-frog-100 flex items-center justify-center overflow-hidden">
                        {display.img
                          ? <img src={display.img} alt={display.name} className="w-full h-full object-cover rounded-full" />
                          : <Users className="w-6 h-6 text-frog-500" />}
                      </div>
                    ) : (
                      <>
                        <img src={display.img || 'https://iili.io/qbtgKBt.png'} alt={display.name} className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover" />
                        {display.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 md:w-4 md:h-4 bg-green-500 border-2 border-white rounded-full" />}
                      </>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <h3 className={`font-semibold truncate ${chat.unread_count > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                          {display.name}
                        </h3>
                        {display.isGroup && (
                          <span className="text-xs text-gray-400 flex-shrink-0">({display.memberCount})</span>
                        )}
                      </div>
                      {chat.last_message_at && (
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{formatTime(chat.last_message_at)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${chat.unread_count > 0 ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                        {chat.last_message_at && (
                          <>{chat.last_message_sender_id === currentUserId && 'คุณ: '}{chat.last_message_content || 'ส่งรูปภาพ'}</>
                        )}
                      </p>
                      {chat.unread_count > 0 && (
                        <div className="ml-2 flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-frog-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {chat.unread_count > 99 ? '99+' : chat.unread_count}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => { setModalMode('dm'); loadFriends(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${modalMode === 'dm' ? 'bg-frog-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  แชทส่วนตัว
                </button>
                <button onClick={() => { setModalMode('group'); loadFriends(true); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${modalMode === 'group' ? 'bg-frog-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  สร้างกลุ่ม
                </button>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full transition"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {modalMode === 'group' && (
              <div className="p-4 border-b border-gray-100 space-y-3">
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  placeholder="ชื่อกลุ่ม *" maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-frog-500 text-sm" />
                <input type="url" value={groupImgUrl} onChange={(e) => setGroupImgUrl(e.target.value)}
                  placeholder="URL รูปกลุ่ม (ไม่บังคับ)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-frog-500 text-sm" />
                {selectedMemberIds.length > 0 && (
                  <p className="text-xs text-frog-600 font-bold">เลือกแล้ว {selectedMemberIds.length} คน</p>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingFriends ? (
                <div className="flex justify-center py-8">
                  <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-10 h-10 animate-bounce" />
                </div>
              ) : (modalMode === 'dm' ? friends : allFriends).length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <p className="font-medium">{modalMode === 'dm' ? 'ไม่มีเพื่อนที่สามารถเริ่มแชทได้' : 'ยังไม่มีเพื่อน'}</p>
                  {modalMode === 'dm' && <p className="text-xs mt-1 text-gray-300">(คุณมีแชทกับเพื่อนทุกคนแล้ว)</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {(modalMode === 'dm' ? friends : allFriends).map((friend) => {
                    const isSelected = modalMode === 'dm' ? selectedFriendId === friend.id : selectedMemberIds.includes(friend.id);
                    return (
                      <button key={friend.id}
                        onClick={() => modalMode === 'dm'
                          ? setSelectedFriendId(friend.id)
                          : setSelectedMemberIds(prev => prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id])
                        }
                        className={`w-full p-3 flex items-center gap-3 rounded-xl transition-all border-2 ${isSelected ? 'bg-frog-50 border-frog-500' : 'hover:bg-gray-50 border-transparent'}`}>
                        <img src={friend.profile_img_url || 'https://iili.io/qbtgKBt.png'} alt={friend.display_name} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                        <div className="flex-1 text-left">
                          <p className="font-bold text-gray-800">{friend.display_name}</p>
                          <p className="text-xs text-gray-500 font-medium">@{friend.username}</p>
                        </div>
                        {modalMode === 'group' && isSelected && <Check className="w-5 h-5 text-frog-500 flex-shrink-0" />}
                        {modalMode === 'dm' && isSelected && <div className="w-2.5 h-2.5 bg-frog-500 rounded-full"></div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={modalMode === 'dm' ? createDM : createGroup}
                disabled={isCreating || (modalMode === 'dm' ? !selectedFriendId : (!groupName.trim() || selectedMemberIds.length === 0))}
                className="w-full py-3 bg-frog-500 text-white rounded-xl hover:bg-frog-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-bold shadow-md active:scale-95">
                {modalMode === 'dm'
                  ? (isCreating ? 'กำลังสร้าง...' : 'เริ่มแชท')
                  : (isCreating ? 'กำลังสร้าง...' : `สร้างกลุ่ม${selectedMemberIds.length > 0 ? ` (${selectedMemberIds.length} คน)` : ''}`)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

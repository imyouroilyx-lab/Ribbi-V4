'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { Heart, MessageCircle, Reply, Bell, UserPlus, UserCheck, Edit, Trash2, AtSign, Check } from 'lucide-react';
import Link from 'next/link';
import { getRelativeTime } from '@/lib/utils';

export default function NotificationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setCurrentUser(userData);

      // ✅ แก้ไข N+1: ใช้ Joined Query ดึงทั้ง Sender และ Post พร้อมกัน
      let query = supabase
        .from('notifications')
        .select(`
          *,
          sender:users!notifications_sender_id_fkey(id, username, display_name, profile_img_url),
          post:posts(id, content)
        `)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (filter === 'unread') query = query.eq('is_read', false);

      const { data: notificationsData } = await query;
      
      if (notificationsData) {
        // กรองแจ้งเตือนซ้ำฝั่ง Client (ป้องกันปัญหาที่เคยเจอ)
        const unique = [];
        const seen = new Set();
        for (const n of notificationsData) {
          const key = `${n.type}-${n.sender_id}-${n.post_id || 'x'}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(n);
          }
        }
        setNotifications(unique);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  if (isLoading) return <NavLayout><div className="flex justify-center py-20 animate-pulse">กำลังโหลด...</div></NavLayout>;

  return (
    <NavLayout>
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">การแจ้งเตือน</h1>
        
        <div className="flex gap-2 mb-6">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl transition ${filter === 'all' ? 'bg-frog-500 text-white' : 'bg-gray-100'}`}>ทั้งหมด</button>
          <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-xl transition ${filter === 'unread' ? 'bg-frog-500 text-white' : 'bg-gray-100'}`}>ยังไม่อ่าน</button>
        </div>

        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="relative group">
              <Link 
                href={n.post_id ? `/post/${n.post_id}` : `/profile/${n.sender?.username}`} 
                onClick={() => !n.is_read && markAsRead(n.id)} 
                className={`block card-minimal transition ${!n.is_read ? 'bg-indigo-50/50 border-l-4 border-frog-500' : ''}`}
              >
                <div className="flex gap-4">
                  <img src={n.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover" loading="lazy" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base text-gray-900">
                      <span className="font-bold">{n.sender?.display_name}</span> {getNotificationText(n.type)}
                    </p>
                    {n.post && <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{n.post.content}"</p>}
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-medium">{getRelativeTime(n.created_at)}</p>
                  </div>
                </div>
              </Link>
            </div>
          ))}
          {notifications.length === 0 && <div className="text-center py-20 text-gray-500">ยังไม่มีการแจ้งเตือน</div>}
        </div>
      </div>
    </NavLayout>
  );

  function getNotificationText(type: string) {
    switch (type) {
      case 'like': return 'ถูกใจโพสต์ของคุณ';
      case 'comment': return 'แสดงความคิดเห็นในโพสต์ของคุณ';
      case 'reply': return 'ตอบกลับความคิดเห็นของคุณ';
      case 'friend_request': return 'ส่งคำขอเป็นเพื่อน';
      case 'friend_accept': return 'ตอบรับคำขอเป็นเพื่อนแล้ว';
      default: return 'มีการแจ้งเตือนใหม่';
    }
  }
}

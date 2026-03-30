'use client';

import { useState, useEffect } from 'react';
import { supabase, User, Notification } from '@/lib/supabase';
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setCurrentUser(userData);

      let query = supabase.from('notifications').select('*').eq('receiver_id', user.id).order('created_at', { ascending: false });
      if (filter === 'unread') query = query.eq('is_read', false);

      const { data: notificationsData } = await query;
      if (notificationsData) {
        const fullData = await Promise.all(
          notificationsData.map(async (notif) => {
            const { data: sender } = await supabase.from('users').select('*').eq('id', notif.sender_id).single();
            let post = null;
            if (notif.post_id) {
              const { data: p } = await supabase.from('posts').select('id, content, author_id').eq('id', notif.post_id).single();
              post = p;
            }
            let comment = null;
            if (notif.comment_id) {
              const { data: c } = await supabase.from('comments').select('id, content, author_id').eq('id', notif.comment_id).single();
              comment = c;
            }
            return { ...notif, sender, post, comment };
          })
        );

        // ✅ ระบบกรองแจ้งเตือนซ้ำ (Deduplication)
        // ป้องกันปัญหาการแจ้งเตือนเบิ้ล (เช่น Trigger ซ้อนกัน หรือคนกด Like รัวๆ)
        const uniqueNotifications: any[] = [];
        const seenKeys = new Set();

        fullData.forEach((notif) => {
          // สร้างคีย์เพื่อใช้เช็คความซ้ำ (ประเภท + คนส่ง + โพสต์/คอมเมนต์เป้าหมาย)
          const key = `${notif.type}-${notif.sender_id}-${notif.post_id || 'no-post'}-${notif.comment_id || 'no-comment'}`;
          
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueNotifications.push(notif);
          } else if (!notif.is_read) {
            // ถ้าข้อมูลซ้ำ แต่อันนี้ยังไม่ได้อ่าน ให้เก็บสถานะยังไม่อ่านไว้ (ลบอันเก่าใน Array ออกแล้วใส่อันใหม่ที่ยังไม่อ่านเข้าไปแทน)
            const existingIndex = uniqueNotifications.findIndex(n => 
              `${n.type}-${n.sender_id}-${n.post_id || 'no-post'}-${n.comment_id || 'no-comment'}` === key
            );
            if (existingIndex !== -1 && uniqueNotifications[existingIndex].is_read) {
              uniqueNotifications[existingIndex] = notif;
            }
          }
        });

        setNotifications(uniqueNotifications);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {}
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;
    try {
      // อัปเดตการแจ้งเตือนที่ยังไม่ได้อ่านทั้งหมดให้เป็นอ่านแล้ว
      await supabase.from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false);
        
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    setDeletingId(id);
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {} finally { setDeletingId(null); }
  };

  const deleteAllNotifications = async () => {
    if (!currentUser) return;
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเตือนทั้งหมด?')) return;

    try {
      // 1. ส่งค่าให้อ่านทั้งหมดก่อนลบ เพื่อป้องกันบัคตัวเลข badge ค้างใน NavLayout
      await supabase.from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false);
      
      // Update UI state ชั่วคราว (เผื่อ UI กระพริบ)
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));

      // 2. ลบการแจ้งเตือนของตัวเองทั้งหมด
      await supabase.from('notifications')
        .delete()
        .eq('receiver_id', currentUser.id);
        
      setNotifications([]);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-5 h-5 text-red-500" />;
      case 'comment': return <MessageCircle className="w-5 h-5 text-blue-600" />;
      case 'reply': return <Reply className="w-5 h-5 text-blue-500" />;
      case 'tag_post': case 'tag_comment': return <AtSign className="w-5 h-5 text-[#34a35c]" />;
      case 'friend_request': return <UserPlus className="w-5 h-5 text-purple-500" />;
      case 'friend_accept': return <UserCheck className="w-5 h-5 text-green-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationText = (type: string) => {
    switch (type) {
      case 'like': return 'ถูกใจโพสต์ของคุณ';
      case 'comment': return 'แสดงความคิดเห็นในโพสต์ของคุณ';
      case 'reply': return 'ตอบกลับความคิดเห็นของคุณ';
      case 'tag_post': return 'ได้แท็กคุณในโพสต์';
      case 'tag_comment': return 'ได้แท็กคุณในความคิดเห็น';
      case 'friend_request': return 'ส่งคำขอเป็นเพื่อน';
      case 'friend_accept': return 'ตอบรับคำขอเป็นเพื่อนแล้ว';
      default: return 'มีการแจ้งเตือนใหม่';
    }
  };

  if (isLoading) return <NavLayout><div className="flex justify-center py-20">กำลังโหลด...</div></NavLayout>;

  return (
    <NavLayout>
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">การแจ้งเตือน</h1>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex gap-2">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl transition ${filter === 'all' ? 'bg-frog-500 text-white' : 'bg-gray-100'}`}>ทั้งหมด</button>
            <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-xl transition ${filter === 'unread' ? 'bg-frog-500 text-white' : 'bg-gray-100'}`}>ยังไม่อ่าน</button>
          </div>
          
          {/* ปุ่ม Action ลบทั้งหมด / อ่านทั้งหมด (แสดงเมื่อมีการแจ้งเตือนอยู่) */}
          {notifications.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={markAllAsRead} 
                className="flex items-center gap-1 px-4 py-2 text-sm text-[#34a35c] bg-green-50 hover:bg-green-100 rounded-xl transition font-medium"
              >
                <Check className="w-4 h-4" /> อ่านทั้งหมด
              </button>
              <button 
                onClick={deleteAllNotifications} 
                className="flex items-center gap-1 px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition font-medium"
              >
                <Trash2 className="w-4 h-4" /> ลบทั้งหมด
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="relative group">
              <Link href={n.post_id ? `/post/${n.post_id}` : `/profile/${n.sender?.username}`} onClick={() => !n.is_read && markAsRead(n.id)} className={`block card-minimal transition ${!n.is_read ? 'bg-green-50 border-l-4 border-[#34a35c]' : ''}`}>
                <div className="flex gap-4">
                  <img src={n.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      {getNotificationIcon(n.type)}
                      <div className="flex-1">
                        <p className="text-sm md:text-base"><span className="font-bold">{n.sender?.display_name}</span> {getNotificationText(n.type)}</p>
                        {n.post && <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{n.post.content}"</p>}
                        {n.comment && <p className="text-xs text-gray-500 mt-1 line-clamp-1 bg-gray-100 p-1.5 rounded-lg">"{n.comment.content}"</p>}
                        <p className="text-xs text-gray-400 mt-1">{getRelativeTime(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              <button onClick={(e) => deleteNotification(e, n.id)} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {notifications.length === 0 && <div className="text-center py-20 text-gray-500">ยังไม่มีการแจ้งเตือน</div>}
        </div>
      </div>
    </NavLayout>
  );
}

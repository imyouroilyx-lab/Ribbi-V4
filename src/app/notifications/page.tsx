'use client';

import { useState, useEffect } from 'react';
import { supabase, User, Notification } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { Heart, MessageCircle, Reply, Bell, UserPlus, UserCheck, Edit, Trash2, AtSign } from 'lucide-react';
import Link from 'next/link';
import { getRelativeTime } from '@/lib/utils';

export default function NotificationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      setCurrentUser(userData);

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('receiver_id', user.id)
        .not('deleted_by', 'cs', `{${user.id}}`)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data: notificationsData } = await query;

      if (notificationsData) {
        const notificationsWithDetails = await Promise.all(
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
        setNotifications(notificationsWithDetails);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
      setNotifications(notifications.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    } catch (error) {}
  };

  const deleteNotification = async (e: React.MouseEvent, notifId: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!currentUser) return;
    setDeletingId(notifId);
    try {
      const { data: current } = await supabase.from('notifications').select('deleted_by').eq('id', notifId).single();
      const existing: string[] = current?.deleted_by || [];
      if (!existing.includes(currentUser.id)) existing.push(currentUser.id);
      await supabase.from('notifications').update({ deleted_by: existing, is_read: true }).eq('id', notifId);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (error) {} finally { setDeletingId(null); }
  };

  const getNotificationText = (notif: Notification) => {
    switch (notif.type) {
      case 'like': return 'ถูกใจโพสต์ของคุณ';
      case 'comment': return 'แสดงความคิดเห็นในโพสต์ของคุณ';
      case 'reply': return 'ตอบกลับความคิดเห็นของคุณ';
      case 'comment_like': return 'ถูกใจความคิดเห็นของคุณ';
      case 'friend_request': return 'ส่งคำขอเป็นเพื่อน';
      case 'friend_accept': return 'ตอบรับคำขอเป็นเพื่อนของคุณ';
      case 'post_on_profile': return 'โพสต์ข้อความในหน้าโปรไฟล์ของคุณ';
      case 'tag_post': return 'ได้แท็กคุณในโพสต์';
      case 'tag_comment': return 'ได้แท็กคุณในความคิดเห็น';
      default: return 'มีการแจ้งเตือนใหม่';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-5 h-5 text-red-500" />;
      case 'comment': return <MessageCircle className="w-5 h-5 text-[#34a35c]" />;
      case 'tag_post': case 'tag_comment': return <AtSign className="w-5 h-5 text-[#34a35c]" />;
      case 'friend_request': return <UserPlus className="w-5 h-5 text-purple-500" />;
      case 'friend_accept': return <UserCheck className="w-5 h-5 text-green-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isLoading) return <NavLayout><div className="flex justify-center py-20">กำลังโหลด...</div></NavLayout>;

  return (
    <NavLayout>
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">การแจ้งเตือน</h1>
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div key={notif.id} className="relative group">
              <Link
                href={notif.post_id ? `/post/${notif.post_id}` : `/profile/${notif.sender?.username}`}
                onClick={() => !notif.is_read && markAsRead(notif.id)}
                className={`block card-minimal hover:bg-gray-50 transition pr-10 ${!notif.is_read ? 'bg-green-50 border-l-4 border-[#34a35c]' : ''}`}
              >
                <div className="flex gap-4">
                  <img src={notif.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      {getNotificationIcon(notif.type)}
                      <div className="flex-1">
                        <p className="text-sm md:text-base"><span className="font-bold">{notif.sender?.display_name}</span> {getNotificationText(notif)}</p>
                        {notif.post && <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{notif.post.content}"</p>}
                        {notif.comment && <p className="text-xs text-gray-500 mt-1 line-clamp-1 bg-gray-100 p-1.5 rounded-lg">"{notif.comment.content}"</p>}
                        <p className="text-xs text-gray-400 mt-1">{getRelativeTime(notif.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              <button onClick={(e) => deleteNotification(e, notif.id)} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {notifications.length === 0 && <div className="text-center py-20 text-gray-500">ไม่มีการแจ้งเตือน</div>}
        </div>
      </div>
    </NavLayout>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { Heart, MessageCircle, Reply, Bell, UserPlus, UserCheck, Edit, Trash2, AtSign } from 'lucide-react';
import Link from 'next/link';
import { getRelativeTime } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'reply' | 'comment_like' | 'friend_request' | 'friend_accept' | 'post_on_profile' | 'tag_post' | 'tag_comment' | 'message';
  sender_id: string;
  receiver_id: string;
  post_id?: string;
  comment_id?: string;
  parent_comment_id?: string;
  is_read: boolean;
  created_at: string;
  sender?: User;
  post?: {
    id: string;
    content: string;
    author_id: string;
  };
  comment?: {
    id: string;
    content: string;
    author_id: string;
  };
}

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

      // ดึงข้อมูลการแจ้งเตือน
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data: notificationsData, error: notifError } = await query;

      if (notifError) throw notifError;

      if (notificationsData) {
        // ดึงข้อมูลความสัมพันธ์ที่เกี่ยวข้อง (Sender, Post, Comment)
        const notificationsWithDetails = await Promise.all(
          notificationsData.map(async (notif) => {
            // 1. ดึงข้อมูลผู้ส่ง
            const { data: sender } = await supabase
              .from('users')
              .select('*')
              .eq('id', notif.sender_id)
              .single();

            // 2. ดึงข้อมูลโพสต์ถ้ามี
            let post = null;
            if (notif.post_id) {
              const { data: postData } = await supabase
                .from('posts')
                .select('id, content, author_id')
                .eq('id', notif.post_id)
                .single();
              post = postData;
            }

            // 3. ดึงข้อมูลคอมเมนต์ถ้ามี
            let comment = null;
            if (notif.comment_id) {
              const { data: commentData } = await supabase
                .from('comments')
                .select('id, content, author_id')
                .eq('id', notif.comment_id)
                .single();
              comment = commentData;
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
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false);

      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (e: React.MouseEvent, notifId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(notifId);

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notifId);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const deleteAllNotifications = async () => {
    if (!currentUser || notifications.length === 0) return;
    if (!confirm('ต้องการลบการแจ้งเตือนทั้งหมด ?')) return;

    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('receiver_id', currentUser.id);

      setNotifications([]);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
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
      case 'message': return 'ส่งข้อความถึงคุณ';
      default: return 'มีการแจ้งเตือนใหม่';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-5 h-5 text-red-500" />;
      case 'comment': return <MessageCircle className="w-5 h-5 text-frog-600" />;
      case 'reply': return <Reply className="w-5 h-5 text-blue-500" />;
      case 'comment_like': return <Heart className="w-5 h-5 text-pink-500" />;
      case 'friend_request': return <UserPlus className="w-5 h-5 text-purple-500" />;
      case 'friend_accept': return <UserCheck className="w-5 h-5 text-green-500" />;
      case 'post_on_profile': return <Edit className="w-5 h-5 text-orange-500" />;
      case 'tag_post': 
      case 'tag_comment': return <AtSign className="w-5 h-5 text-frog-600" />;
      case 'message': return <MessageCircle className="w-5 h-5 text-blue-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationLink = (notif: Notification) => {
    if (notif.type === 'friend_request' || notif.type === 'friend_accept') {
      return `/profile/${notif.sender?.username}`;
    }
    if (notif.type === 'message') return `/messages`;
    if (notif.post_id) return `/post/${notif.post_id}`;
    return '#';
  };

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <img
              src="https://iili.io/qbtgKBt.png"
              alt="Loading"
              className="w-16 h-16 mx-auto mb-4 animate-bounce"
            />
            <p className="text-gray-600">กำลังโหลด...</p>
          </div>
        </div>
      </NavLayout>
    );
  }

  if (!currentUser) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NavLayout>
      <div className="max-w-3xl mx-auto px-4">
        {/* ส่วนหัวหน้าแจ้งเตือน */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">การแจ้งเตือน</h1>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-frog-600 hover:text-frog-700 font-medium"
              >
                อ่านทั้งหมด
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={deleteAllNotifications}
                className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                ลบทั้งหมด
              </button>
            )}
          </div>
        </div>

        {/* ตัวกรอง */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl transition text-sm md:text-base ${
              filter === 'all' ? 'bg-frog-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ทั้งหมด ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-xl transition text-sm md:text-base ${
              filter === 'unread' ? 'bg-frog-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ยังไม่อ่าน ({unreadCount})
          </button>
        </div>

        {/* รายการแจ้งเตือน */}
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="card-minimal text-center py-12">
              <Bell className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">
                {filter === 'unread' ? 'ไม่มีการแจ้งเตือนที่ยังไม่อ่าน' : 'ยังไม่มีการแจ้งเตือน'}
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div key={notif.id} className="relative group">
                <Link
                  href={getNotificationLink(notif)}
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                  className={`block card-minimal hover:bg-gray-50 transition pr-10 ${
                    !notif.is_read ? 'bg-frog-50 border-l-4 border-frog-500 shadow-sm' : ''
                  }`}
                >
                  <div className="flex gap-3 md:gap-4">
                    <div className="flex-shrink-0">
                      {notif.sender && (
                        <img
                          src={notif.sender.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          alt={notif.sender.display_name}
                          className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm md:text-base">
                            <span className="font-bold">{notif.sender?.display_name}</span>{' '}
                            <span className="text-gray-700">{getNotificationText(notif)}</span>
                          </p>

                          {/* แสดงเนื้อหาโพสต์ที่ถูกแท็ก */}
                          {notif.post && (
                            <p className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-2 italic">
                              "{notif.post.content}"
                            </p>
                          )}

                          {/* แสดงเนื้อหาคอมเมนต์ที่ถูกแท็ก */}
                          {notif.comment && (
                            <p className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-2 bg-gray-100 rounded-lg p-2 border-l-2 border-frog-400">
                              {notif.comment.content}
                            </p>
                          )}

                          <p className="text-xs text-gray-400 mt-2">
                            {getRelativeTime(notif.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!notif.is_read && (
                      <div className="flex-shrink-0 self-center">
                        <div className="w-2 h-2 bg-frog-500 rounded-full" />
                      </div>
                    )}
                  </div>
                </Link>

                {/* ปุ่มลบแจ้งเตือน */}
                <button
                  onClick={(e) => deleteNotification(e, notif.id)}
                  disabled={deletingId === notif.id}
                  className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  title="ลบการแจ้งเตือน"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </NavLayout>
  );
}
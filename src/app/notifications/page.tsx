'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { Heart, MessageCircle, UserPlus, Bell, Clock } from 'lucide-react';
import Link from 'next/link';
import { getRelativeTime } from '@/lib/utils';

const NOTIFS_PER_PAGE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, hasMore]);

  // ✅ ปรับปรุง: ไม่ต้อง await ให้เสียเวลาโหลดหน้าเว็บ
  const markAllAsRead = (userId: string) => {
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .then(); // ทำงานในพื้นหลัง
  };

  useEffect(() => {
    setPage(0);
    setNotifications([]);
    setHasMore(true);
    loadInitialData();
  }, [filter]);

  useEffect(() => {
    if (page > 0) loadMoreData();
  }, [page]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: userData } = await supabase.from('users').select('id, username, display_name').eq('id', user.id).single();
      setCurrentUser(userData as any);

      // ✅ ดึงข้อมูลก่อน แล้วค่อยสั่งล้าง Badge ทีหลัง
      const { data } = await fetchNotifications(user.id, 0);
      if (data) {
        setNotifications(data);
        setHasMore(data.length === NOTIFS_PER_PAGE);
        // ล้าง Badge หลังจากข้อมูลขึ้นแล้ว
        markAllAsRead(user.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreData = async () => {
    if (!currentUser || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const { data } = await fetchNotifications(currentUser.id, page);
      if (data && data.length > 0) {
        setNotifications(prev => [...prev, ...data]);
        setHasMore(data.length === NOTIFS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const fetchNotifications = async (userId: string, pageNum: number) => {
    const from = pageNum * NOTIFS_PER_PAGE;
    const to = from + NOTIFS_PER_PAGE - 1;

    let query = supabase
      .from('notifications')
      .select(`
        *,
        sender:users!notifications_sender_id_fkey(id, username, display_name, profile_img_url),
        post:posts(id, content)
      `)
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filter === 'unread') query = query.eq('is_read', false);
    return await query;
  };

  if (isLoading && page === 0) return <NavLayout><div className="flex justify-center py-20"><Bell className="animate-bounce text-frog-500" /></div></NavLayout>;

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">การแจ้งเตือน</h1>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filter === 'all' ? 'bg-white shadow-sm text-frog-600' : 'text-gray-500'}`}>ทั้งหมด</button>
            <button onClick={() => setFilter('unread')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filter === 'unread' ? 'bg-white shadow-sm text-frog-600' : 'text-gray-500'}`}>ไม่อ่าน</button>
          </div>
        </div>

        <div className="space-y-2">
          {notifications.map((n, index) => {
            const isLast = notifications.length === index + 1;
            return (
              <div key={n.id} ref={isLast ? lastElementRef : null}>
                <Link 
                  href={n.post_id ? `/post/${n.post_id}` : `/profile/${n.sender?.username}`} 
                  className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${!n.is_read ? 'bg-indigo-50/30 border-indigo-100' : 'bg-white border-gray-50 hover:border-gray-200'}`}
                >
                  <img src={n.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-gray-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 leading-snug">
                      <span className="font-black">{n.sender?.display_name}</span> {getNotificationText(n.type)}
                    </p>
                    {n.post && <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic border-l-2 border-gray-200 pl-2">"{n.post.content}"</p>}
                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-tighter flex items-center gap-1">
                      <Clock size={10} /> {getRelativeTime(n.created_at)}
                    </p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 shadow-sm shadow-indigo-200"></div>}
                </Link>
              </div>
            );
          })}
          
          {isLoadingMore && <div className="flex justify-center py-4"><Bell className="w-5 h-5 animate-spin text-gray-300" /></div>}
          
          {notifications.length === 0 && (
            <div className="text-center py-20 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-200" />
              <p className="text-gray-400 text-sm font-bold">ไม่มีการแจ้งเตือน</p>
            </div>
          )}
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
      case 'tag_post': return 'แท็กคุณในโพสต์';
      case 'tag_comment': return 'แท็กคุณในความคิดเห็น';
      default: return 'มีการเคลื่อนไหวใหม่';
    }
  }
}

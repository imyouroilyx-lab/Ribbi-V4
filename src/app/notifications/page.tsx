'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import { Bell, Clock, Trash2, Loader2 } from 'lucide-react';
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
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Infinite Scroll Observer
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

  // ล้างสถานะใน Database (Background)
  const silentMarkAllAsRead = async (userId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', userId)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

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

      const { data } = await fetchNotifications(user.id, 0);
      if (data) {
        setNotifications(data);
        setHasMore(data.length === NOTIFS_PER_PAGE);
        
        // สั่งล้างแจ้งเตือนใน DB ทันที (แต่ไม่เปลี่ยน State หน้าจอเพื่อให้ผู้ใช้เห็นว่าอันไหนใหม่)
        silentMarkAllAsRead(user.id);
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

    return await supabase
      .from('notifications')
      .select(`
        *,
        sender:users!notifications_sender_id_fkey(id, username, display_name, profile_img_url),
        post:posts(id, content)
      `)
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
  };

  const deleteNotification = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const handleClearAll = async () => {
    if (!currentUser) return;
    try {
      await supabase.from('notifications').delete().eq('receiver_id', currentUser.id);
      setNotifications([]);
      setShowDeleteAllModal(false);
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading && page === 0) {
    return (
      <NavLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-frog-500 animate-spin mb-4" />
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs animate-pulse">Loading Notifications...</p>
        </div>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4">
        {/* Header - Simplified */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">การแจ้งเตือน</h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Recent Activity</p>
          </div>
          
          {notifications.length > 0 && (
            <button 
              onClick={() => setShowDeleteAllModal(true)}
              className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
              title="ลบทั้งหมด"
            >
              <Trash2 size={22} />
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          {notifications.map((n, index) => {
            const isLast = notifications.length === index + 1;
            return (
              <div key={n.id} ref={isLast ? lastElementRef : null} className="group relative">
                <Link 
                  href={n.post_id ? `/post/${n.post_id}` : `/profile/${n.sender?.username}`} 
                  className={`flex items-start gap-4 p-4 rounded-[1.5rem] border transition-all duration-300 ${
                    !n.is_read 
                    ? 'bg-indigo-50/40 border-indigo-100 ring-1 ring-indigo-100/50 shadow-sm' 
                    : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img 
                      src={n.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} 
                      className="w-11 h-11 rounded-full object-cover border border-gray-100" 
                      alt=""
                    />
                    {!n.is_read && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 leading-snug">
                      <span className="font-black">{n.sender?.display_name || 'ใครบางคน'}</span> {getNotificationText(n.type)}
                    </p>
                    {n.post && (
                      <p className="text-xs text-gray-400 mt-1.5 line-clamp-1 italic border-l-2 border-gray-200 pl-2">
                        "{n.post.content}"
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-tighter flex items-center gap-1 opacity-70">
                      <Clock size={10} /> {getRelativeTime(n.created_at)}
                    </p>
                  </div>
                </Link>

                {/* Individual Delete Button */}
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNotification(n.id); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white shadow-xl rounded-xl border border-gray-100 text-gray-300 hover:text-red-500 lg:opacity-0 group-hover:opacity-100 transition-all scale-90"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          
          {isLoadingMore && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
            </div>
          )}
          
          {notifications.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 shadow-inner">
              <Bell className="w-16 h-16 mx-auto mb-4 text-gray-100" />
              <p className="text-gray-400 text-sm font-black uppercase tracking-widest">No notifications yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modal for Delete All */}
      <ConfirmModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleClearAll}
        title="ล้างการแจ้งเตือนทั้งหมด?"
        message="การแจ้งเตือนทั้งหมดจะถูกลบถาวรและไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?"
        confirmText="ใช่, ลบทั้งหมด"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );

  function getNotificationText(type: string) {
    switch (type) {
      case 'like': return 'ถูกใจโพสต์ของคุณ';
      case 'comment': return 'แสดงความคิดเห็นในโพสต์ของคุณ';
      case 'reply': return 'ตอบกลับความคิดเห็นของคุณ';
      case 'friend_request': return 'ส่งคำขอเป็นเพื่อนถึงคุณ';
      case 'friend_accept': return 'ตอบรับคำขอเป็นเพื่อนแล้ว';
      case 'tag_post': return 'แท็กคุณในโพสต์ของพวกเขา';
      case 'tag_comment': return 'แท็กคุณในความคิดเห็น';
      default: return 'มีการเคลื่อนไหวใหม่ในบัญชีของคุณ';
    }
  }
}

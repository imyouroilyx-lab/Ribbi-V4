'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import { Bell, Clock, Trash2, Loader2, UserCheck, Heart, MessageCircle, AtSign } from 'lucide-react';
import Link from 'next/link';
import { getRelativeTime } from '@/lib/utils';

const NOTIFS_PER_PAGE = 20;

// ✅ ย้ายฟังก์ชันข้อความและไอคอนมาไว้ด้านนอก เพื่อไม่ให้ถูกสร้างใหม่ทุกครั้งที่ Render (ช่วยลดความหน่วง)
const getNotifIcon = (type: string) => {
  switch (type) {
    case 'like':
    case 'comment_like': // ดักการกดไลก์คอมเมนต์
      return <Heart size={12} className="fill-red-500 text-red-500" />;
    case 'comment': 
    case 'reply': 
      return <MessageCircle size={12} className="fill-blue-500 text-blue-500" />;
    case 'friend_accept': 
      return <UserCheck size={12} className="text-frog-600" />;
    case 'tag_post':
    case 'tag_comment': 
      return <AtSign size={12} className="text-purple-500" />;
    default: 
      return <Bell size={12} className="text-gray-400" />;
  }
};

const getNotificationText = (type: string) => {
  switch (type) {
    case 'like': return 'ถูกใจโพสต์ของคุณ';
    case 'comment_like': return 'ถูกใจความคิดเห็นของคุณ'; // ✅ แก้ให้ตรงจุดแล้วครับ
    case 'comment': return 'แสดงความคิดเห็นในโพสต์ของคุณ';
    case 'reply': return 'ตอบกลับความคิดเห็นของคุณ';
    case 'friend_request': return 'ส่งคำขอเป็นเพื่อนถึงคุณ';
    case 'friend_accept': return 'ตอบรับคำขอเป็นเพื่อนแล้ว';
    case 'tag_post': return 'กล่าวถึงคุณในโพสต์';
    case 'tag_comment': return 'กล่าวถึงคุณในความคิดเห็น';
    default: return 'มีการเคลื่อนไหวใหม่ในบัญชีของคุณ';
  }
};

export default function NotificationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // ระบบ Intersection Observer สำหรับโหลดข้อมูลเพิ่มเวลาเลื่อนลงสุด (ไม่หน่วงแน่นอน)
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

  // ✅ ระบบกรองแจ้งเตือนซ้ำซ้อน (Deduplication) ช่วยลดจำนวนของที่ต้องเรนเดอร์บนจอ
  const deduplicateNotifications = (notifs: any[]) => {
    const seen = new Set();
    return notifs.filter(n => {
      let key = n.id;
      
      // กรองคำขอเพื่อนซ้ำ
      if (n.type === 'friend_request' || n.type === 'friend_accept') {
        key = `${n.type}-${n.sender_id}`;
      } 
      // กรองการกดไลก์รัวๆ ในโพสต์/คอมเมนต์เดียวกัน ให้เหลือแค่อันเดียว
      else if (n.type === 'like' || n.type === 'comment_like') {
        key = `${n.type}-${n.sender_id}-${n.post_id || n.id}`;
      }

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
        const uniqueData = deduplicateNotifications(data);
        setNotifications(uniqueData);
        setHasMore(data.length === NOTIFS_PER_PAGE);
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
        setNotifications(prev => {
          const combined = [...prev, ...data];
          return deduplicateNotifications(combined);
        });
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
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('receiver_id', currentUser.id);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleClearAll = async () => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('receiver_id', currentUser.id);

      if (error) throw error;
      setNotifications([]);
      setShowDeleteAllModal(false);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  if (isLoading && page === 0) {
    return (
      <NavLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-frog-500 animate-spin mb-4" />
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs animate-pulse">กำลังโหลดการแจ้งเตือน...</p>
        </div>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4">
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

        <div className="space-y-3">
          {notifications.map((n, index) => {
            const isLast = notifications.length === index + 1;
            return (
              <div key={n.id} ref={isLast ? lastElementRef : null} className="group relative">
                <Link 
                  href={n.post_id ? `/post/${n.post_id}` : `/profile/${n.sender?.username}`} 
                  className={`flex items-start gap-4 p-4 rounded-[1.5rem] border transition-all duration-300 ${
                    !n.is_read 
                    ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' 
                    : 'bg-white/50 border-gray-100 hover:bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img 
                      src={n.sender?.profile_img_url || 'https://iili.io/qbtgKBt.png'} 
                      className="w-12 h-12 rounded-2xl object-cover border border-gray-50 shadow-sm" 
                      alt=""
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-lg shadow-sm border border-gray-50 flex items-center justify-center">
                      {getNotifIcon(n.type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 leading-snug">
                      <span className="font-black text-gray-900">{n.sender?.display_name || 'ผู้ใช้ Ribbi'}</span>{' '}
                      <span className="text-gray-600">{getNotificationText(n.type)}</span>
                    </p>
                    
                    {n.post && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-xl border border-gray-100/50">
                        <p className="text-xs text-gray-400 line-clamp-1 italic">
                          "{n.post.content}"
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter flex items-center gap-1 opacity-70">
                        <Clock size={10} /> {getRelativeTime(n.created_at)}
                      </p>
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                      )}
                    </div>
                  </div>
                </Link>

                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNotification(n.id); }}
                  className="absolute -right-2 top-2 p-2 bg-white shadow-xl rounded-xl border border-gray-100 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          
          {isLoadingMore && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          )}
          
          {notifications.length === 0 && !isLoading && (
            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 shadow-inner">
              <Bell className="w-16 h-16 mx-auto mb-4 text-gray-100" />
              <p className="text-gray-400 text-sm font-black uppercase tracking-widest">ยังไม่มีการแจ้งเตือน</p>
            </div>
          )}
        </div>
      </div>

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
}

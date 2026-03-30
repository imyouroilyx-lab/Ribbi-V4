'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, User, Settings, LogOut, Menu, X, MessageCircle, Bell } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/ribbi.wav');
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Sound play failed:', err));
  } catch (err) {
    console.log('Sound not available:', err);
  }
};

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const pathnameRef = useRef<string | null>(pathname);
  const currentUserRef = useRef<any>(null);
  const myChatIdsRef = useRef<string[]>([]);

  useEffect(() => {
    pathnameRef.current = pathname;
    // ✅ ถ้าอยู่หน้า Notifications ให้เคลียร์เลขแจ้งเตือนใน UI ทันที
    if (pathname === '/notifications') {
      setUnreadNotifCount(0);
    }
  }, [pathname]);

  useOnlineStatus(currentUser?.id || null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    currentUserRef.current = currentUser;
    loadUnreadMessages(currentUser.id);

    const interval = setInterval(() => {
      // ✅ ไม่ต้องดึงแจ้งเตือนถ้ากำลังอยู่หน้า Notifications (เดี๋ยวหน้าเพจจัดการเอง)
      if (pathnameRef.current !== '/notifications') {
        loadNotifications(currentUser.id);
      }
      loadFriendRequests(currentUser.id);
      loadUnreadMessages(currentUser.id);
    }, 45 * 1000); // ปรับเป็น 45 วิ เพื่อลด Load

    // Realtime Notifications
    const notifChannel = supabase
      .channel('nav-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const notif = payload.new as any;
        const user = currentUserRef.current;
        if (!user || notif.receiver_id !== user.id) return;
        
        // ถ้าไม่อยู่หน้าแจ้งเตือน ให้บวกเลขและดังเสียง
        if (pathnameRef.current !== '/notifications') {
          setUnreadNotifCount(prev => prev + 1);
          playNotificationSound();
        }
      })
      .subscribe();

    // Realtime Messages
    const msgChannel = supabase
      .channel('nav-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as any;
        const user = currentUserRef.current;
        if (!user || newMsg.event) return;

        const isMyChat = myChatIdsRef.current.includes(newMsg.chat_id);
        const isNotFromMe = newMsg.sender_id !== user.id;

        if (isMyChat && isNotFromMe) {
          if (!pathnameRef.current?.startsWith('/messages')) {
            playNotificationSound();
            loadUnreadMessages(user.id);
          }
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [currentUser]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setCurrentUser(userData);
      if (pathname !== '/notifications') loadNotifications(user.id);
      loadFriendRequests(user.id);
      loadUnreadMessages(user.id);
    }
  };

  const loadNotifications = async (userId: string) => {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('receiver_id', userId).eq('is_read', false);
    setUnreadNotifCount(count || 0);
  };

  const loadFriendRequests = async (userId: string) => {
    const { count } = await supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('receiver_id', userId).eq('status', 'pending');
    setFriendRequestCount(count || 0);
  };

  const loadUnreadMessages = async (userId: string) => {
    try {
      const { data } = await supabase.from('chat_participants').select('chat_id, unread_count').eq('user_id', userId);
      if (data) {
        myChatIdsRef.current = data.map(d => d.chat_id);
        const total = data.reduce((sum, p) => sum + (p.unread_count || 0), 0);
        setUnreadMessageCount(total);
      }
    } catch (error) { console.error(error); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="hidden lg:block w-64 fixed left-0 top-0 h-screen bg-white border-r border-gray-200 p-4">
        <div className="mb-8">
          <Link href="/" className="flex items-center gap-2">
            <img src="https://iili.io/qbtgKBt.png" alt="Ribbi" className="w-10 h-10" />
            <span className="text-2xl font-bold text-frog-600">Ribbi</span>
          </Link>
        </div>
        <nav className="space-y-2">
          <Link href="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <Home className="w-5 h-5" />
            <span>หน้าหลัก</span>
          </Link>
          <Link href="/friends" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/friends') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <Users className="w-5 h-5" />
            <span>เพื่อน</span>
            {friendRequestCount > 0 && <span className="absolute left-8 top-2 w-5 h-5 bg-frog-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{friendRequestCount}</span>}
          </Link>
          <Link href="/messages" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/messages') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <MessageCircle className="w-5 h-5" />
            <span>แชท</span>
            {unreadMessageCount > 0 && <span className="absolute left-8 top-2 w-5 h-5 bg-frog-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unreadMessageCount}</span>}
          </Link>
          <Link href="/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/notifications') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <Bell className="w-5 h-5" />
            <span>แจ้งเตือน</span>
            {unreadNotifCount > 0 && <span className="absolute left-8 top-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unreadNotifCount}</span>}
          </Link>
          {currentUser && (
            <Link href={`/profile/${currentUser.username}`} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${pathname?.startsWith('/profile/') && !pathname.includes('edit') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
              <User className="w-5 h-5" />
              <span>โปรไฟล์</span>
            </Link>
          )}
          <Link href="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/settings') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <Settings className="w-5 h-5" />
            <span>ตั้งค่า</span>
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 transition">
            <LogOut className="w-5 h-5" />
            <span>ออกจากระบบ</span>
          </button>
        </nav>
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-2">
          <img src="https://iili.io/qbtgKBt.png" alt="Ribbi" className="w-8 h-8" />
          <span className="text-xl font-bold text-frog-600">Ribbi</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell className="w-6 h-6" />
            {unreadNotifCount > 0 && <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{unreadNotifCount}</span>}
          </Link>
          <button onClick={() => setShowMobileMenu(true)} className="p-2 hover:bg-gray-100 rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {showMobileMenu && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowMobileMenu(false)} />
          <aside className="lg:hidden fixed right-0 top-0 h-screen w-64 bg-white z-50 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xl font-bold text-frog-600">เมนู</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="space-y-2">
              <Link href="/" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100">
                <Home className="w-5 h-5" />
                <span>หน้าหลัก</span>
              </Link>
              <Link href="/notifications" onClick={() => setShowMobileMenu(false)} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-100">
                <div className="flex items-center gap-3"><Bell className="w-5 h-5" /><span>แจ้งเตือน</span></div>
                {unreadNotifCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadNotifCount}</span>}
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600">
                <LogOut className="w-5 h-5" />
                <span>ออกจากระบบ</span>
              </button>
            </nav>
          </aside>
        </>
      )}

      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

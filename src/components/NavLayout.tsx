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
  
  // ✅ 1. เพิ่ม Ref สำหรับเก็บ ID ของแชทที่เราเป็นสมาชิกจริงๆ
  const myChatIdsRef = useRef<string[]>([]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useOnlineStatus(currentUser?.id || null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    currentUserRef.current = currentUser;

    // โหลดข้อมูลแชทเพื่อเอา ID มาเก็บไว้ใน Ref ทันทีที่ Login
    loadUnreadMessages(currentUser.id);

    const interval = setInterval(() => {
      loadNotifications(currentUser.id);
      loadFriendRequests(currentUser.id);
      loadUnreadMessages(currentUser.id);
    }, 30 * 1000);

    // ─── Realtime: notifications ───
    const notifChannel = supabase
      .channel('nav-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        const notif = payload.new as any;
        const user = currentUserRef.current;
        if (!user || notif.receiver_id !== user.id) return;
        loadNotifications(user.id);
        if (!pathnameRef.current?.startsWith('/notifications')) {
          playNotificationSound();
        }
      })
      .subscribe();

    // ─── Realtime: unread messages (จุดที่แก้เสียงรั่ว) ───
    const msgChannel = supabase
      .channel('nav-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const newMsg = payload.new as any;
        const user = currentUserRef.current;
        if (!user || newMsg.event) return;

        // ✅ 2. ตรวจสอบ: เราเป็นสมาชิกของแชทนี้หรือไม่? และคนส่งต้องไม่ใช่เรา
        const isMyChat = myChatIdsRef.current.includes(newMsg.chat_id);
        const isNotFromMe = newMsg.sender_id !== user.id;

        if (isMyChat && isNotFromMe) {
          // เล่นเสียงเฉพาะตอนไม่ได้อยู่หน้า /messages เท่านั้น (เพราะในหน้าแชทจะมีตัวจัดการเสียงเอง)
          if (!pathnameRef.current?.startsWith('/messages')) {
            playNotificationSound();
            console.log('🔔 Nav: ดังเพราะเป็นแชทของเรา:', newMsg.chat_id);
          }
          loadUnreadMessages(user.id);
        } else if (!isMyChat && isNotFromMe) {
          // ถ้าไม่ใช่แชทเรา "ห้ามดัง" และไม่ต้องทำอะไร
          // อาจจะลองโหลดแชทใหม่เผื่อกรณีถูกลากเข้ากลุ่มใหม่
          loadUnreadMessages(user.id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
      }, (payload) => {
        const cp = payload.new as any;
        const user = currentUserRef.current;
        if (!user || cp.user_id !== user.id) return;
        loadUnreadMessages(user.id);
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
      loadNotifications(user.id);
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
        // ✅ 3. อัปเดตรายการ chat_id ที่เรามีสิทธิ์เข้าถึงลงใน Ref
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

  const handleHomeClick = (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="hidden lg:block w-64 fixed left-0 top-0 h-screen bg-white border-r border-gray-200 p-4">
        <div className="mb-8">
          <Link href="/" onClick={handleHomeClick} className="flex items-center gap-2">
            <img src="https://iili.io/qbtgKBt.png" alt="Ribbi" className="w-10 h-10" />
            <span className="text-2xl font-bold text-frog-600">Ribbi</span>
          </Link>
        </div>
        <nav className="space-y-2">
          <Link href="/" onClick={handleHomeClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <Home className="w-5 h-5" />
            <span>หน้าหลัก</span>
          </Link>
          <Link href="/friends" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/friends') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <Users className="w-5 h-5" />
            <span>เพื่อน</span>
            {friendRequestCount > 0 && (
              <span className="absolute left-8 top-2 w-5 h-5 bg-frog-500 text-white text-xs rounded-full flex items-center justify-center">
                {friendRequestCount > 9 ? '9+' : friendRequestCount}
              </span>
            )}
          </Link>
          <Link href="/messages" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/messages') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <MessageCircle className="w-5 h-5" />
            <span>แชท</span>
            {unreadMessageCount > 0 && (
              <span className="absolute left-8 top-2 w-5 h-5 bg-frog-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
              </span>
            )}
          </Link>
          <Link href="/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/notifications') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <Bell className="w-5 h-5" />
            <span>การแจ้งเตือน</span>
            {unreadNotifCount > 0 && (
              <span className="absolute left-8 top-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </Link>
          {currentUser && (
            <Link href={`/profile/${currentUser.username}`} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${(pathname?.startsWith('/profile/') && pathname !== '/profile/edit') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
              <User className="w-5 h-5" />
              <span>โปรไฟล์</span>
            </Link>
          )}
          <Link href="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${(pathname === '/settings' || pathname?.startsWith('/settings/') || pathname === '/profile/edit') ? 'bg-frog-100 text-frog-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}>
            <Settings className="w-5 h-5" />
            <span>ตั้งค่า</span>
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 transition">
            <LogOut className="w-5 h-5" />
            <span>ออกจากระบบ</span>
          </button>
        </nav>
        
        {/* ✅ ปรับเปลี่ยนส่วนล่างเป็น Link ไปยังหน้าโปรไฟล์ (บน Desktop) */}
        {currentUser && (
          <div className="absolute bottom-4 left-4 right-4">
            <Link 
              href={`/profile/${currentUser.username}`} 
              className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl border border-transparent hover:border-gray-200"
            >
              <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} alt={currentUser.display_name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-gray-900">{currentUser.display_name}</p>
                <p className="text-xs text-gray-500 truncate">@{currentUser.username}</p>
              </div>
            </Link>
          </div>
        )}
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
        <Link href="/" onClick={handleHomeClick} className="flex items-center gap-2">
          <img src="https://iili.io/qbtgKBt.png" alt="Ribbi" className="w-8 h-8" />
          <span className="text-xl font-bold text-frog-600">Ribbi</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell className="w-6 h-6" />
            {unreadNotifCount > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
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
            
            {/* ✅ ปรับเปลี่ยนส่วนบนเป็น Link ไปยังหน้าโปรไฟล์ (บน Mobile Menu) */}
            {currentUser && (
              <Link 
                href={`/profile/${currentUser.username}`} 
                onClick={() => setShowMobileMenu(false)}
                className="block mb-6 p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl border border-transparent hover:border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} alt={currentUser.display_name} className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{currentUser.display_name}</p>
                    <p className="text-sm text-gray-500 truncate">@{currentUser.username}</p>
                  </div>
                </div>
              </Link>
            )}

            <nav className="space-y-2">
              <Link href="/" onClick={(e) => { setShowMobileMenu(false); handleHomeClick(e); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/') ? 'bg-frog-100 text-frog-600' : 'hover:bg-gray-100'}`}>
                <Home className="w-5 h-5" />
                <span>หน้าหลัก</span>
              </Link>
              <Link href="/friends" onClick={() => setShowMobileMenu(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/friends') ? 'bg-frog-100 text-frog-600' : 'hover:bg-gray-100'}`}>
                <Users className="w-5 h-5" />
                <span>เพื่อน</span>
                {friendRequestCount > 0 && (
                  <span className="ml-auto w-6 h-6 bg-frog-500 text-white text-xs rounded-full flex items-center justify-center">
                    {friendRequestCount > 9 ? '9+' : friendRequestCount}
                  </span>
                )}
              </Link>
              <Link href="/messages" onClick={() => setShowMobileMenu(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/messages') ? 'bg-frog-100 text-frog-600' : 'hover:bg-gray-100'}`}>
                <MessageCircle className="w-5 h-5" />
                <span>แชท</span>
                {unreadMessageCount > 0 && (
                  <span className="ml-auto w-6 h-6 bg-frog-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                )}
              </Link>
              <Link href="/notifications" onClick={() => setShowMobileMenu(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/notifications') ? 'bg-frog-100 text-frog-600' : 'hover:bg-gray-100'}`}>
                <Bell className="w-5 h-5" />
                <span>การแจ้งเตือน</span>
                {unreadNotifCount > 0 && (
                  <span className="ml-auto w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </Link>
              {currentUser && (
                <Link href={`/profile/${currentUser.username}`} onClick={() => setShowMobileMenu(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${(pathname?.startsWith('/profile/') && pathname !== '/profile/edit') ? 'bg-frog-100 text-frog-600' : 'hover:bg-gray-100'}`}>
                  <User className="w-5 h-5" />
                  <span>โปรไฟล์</span>
                </Link>
              )}
              <Link href="/settings" onClick={() => setShowMobileMenu(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${(pathname === '/settings' || pathname?.startsWith('/settings/') || pathname === '/profile/edit') ? 'bg-frog-100 text-frog-600' : 'hover:bg-gray-100'}`}>
                <Settings className="w-5 h-5" />
                <span>ตั้งค่า</span>
              </Link>
              <button onClick={() => { setShowMobileMenu(false); handleLogout(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600">
                <LogOut className="w-5 h-5" />
                <span>ออกจากระบบ</span>
              </button>
            </nav>
          </aside>
        </>
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex justify-around items-center h-16">
          <Link href="/" onClick={handleHomeClick} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full ${isActive('/') ? 'text-frog-600' : 'text-gray-600'}`}>
            <Home className="w-6 h-6" />
            <span className="text-xs">หน้าหลัก</span>
          </Link>
          <Link href="/friends" className={`flex flex-col items-center justify-center gap-1 flex-1 h-full relative ${isActive('/friends') ? 'text-frog-600' : 'text-gray-600'}`}>
            <Users className="w-6 h-6" />
            <span className="text-xs">เพื่อน</span>
            {friendRequestCount > 0 && (
              <span className="absolute top-1 right-4 w-4 h-4 bg-frog-500 text-white text-xs rounded-full flex items-center justify-center">
                {friendRequestCount > 9 ? '9' : friendRequestCount}
              </span>
            )}
          </Link>
          <Link href="/messages" className={`flex flex-col items-center justify-center gap-1 flex-1 h-full relative ${isActive('/messages') ? 'text-frog-600' : 'text-gray-600'}`}>
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs">แชท</span>
            {unreadMessageCount > 0 && (
              <span className="absolute top-1 right-4 w-4 h-4 bg-frog-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadMessageCount > 9 ? '9' : unreadMessageCount}
              </span>
            )}
          </Link>
          {currentUser && (
            <Link href={`/profile/${currentUser.username}`} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full ${(pathname?.startsWith('/profile/') && pathname !== '/profile/edit') ? 'text-frog-600' : 'text-gray-600'}`}>
              <User className="w-6 h-6" />
              <span className="text-xs">โปรไฟล์</span>
            </Link>
          )}
        </div>
      </nav>

      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

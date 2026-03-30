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
    if (pathname === '/notifications') {
      setUnreadNotifCount(0);
    }
  }, [pathname]);

  useOnlineStatus(currentUser?.id || null);

  useEffect(() => {
    loadUser();
  }, []);

  const handleHomeClick = (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault();
      window.location.reload();
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    currentUserRef.current = currentUser;
    loadUnreadMessages(currentUser.id);

    const interval = setInterval(() => {
      if (pathnameRef.current !== '/notifications') {
        loadNotifications(currentUser.id);
      }
      loadFriendRequests(currentUser.id);
      loadUnreadMessages(currentUser.id);
    }, 45 * 1000);

    const notifChannel = supabase
      .channel('nav-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const notif = payload.new as any;
        const user = currentUserRef.current;
        if (!user || notif.receiver_id !== user.id) return;
        
        // ✅ กรองออก: ถ้าเป็นการส่งคำขอเพื่อน ไม่ต้องเด้งแจ้งเตือน ไม่ต้องมีเสียง
        if (notif.type === 'friend_request') return;

        if (pathnameRef.current !== '/notifications') {
          setUnreadNotifCount(prev => prev + 1);
          playNotificationSound();
        }
      })
      .subscribe();

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
  }, [currentUser, pathname]);

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
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .neq('type', 'friend_request'); // ✅ ตัดประเภท friend_request ออกจากการนับ Badge รูปกระดิ่ง
      
    setUnreadNotifCount(count || 0);
  };

  const loadFriendRequests = async (userId: string) => {
    const { count } = await supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('receiver_id', userId).eq('status', 'pending');
    setFriendRequestCount(count || 0); // ✅ อันนี้จะไปโชว์ที่ไอคอน "เพื่อน (Friends)" แบบปกติ
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
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:block w-64 fixed left-0 top-0 h-screen bg-white border-r border-gray-200 p-4">
        <div className="mb-8">
          <Link href="/" onClick={handleHomeClick} className="flex items-center gap-2 group">
            <img src="https://iili.io/qbtgKBt.png" alt="Ribbi" className="w-10 h-10 group-hover:scale-110 transition-transform" />
            <span className="text-2xl font-black text-frog-600 tracking-tighter">Ribbi</span>
          </Link>
        </div>
        <nav className="space-y-1">
          <Link href="/" onClick={handleHomeClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <Home className="w-5 h-5" />
            <span>หน้าหลัก</span>
          </Link>
          
          {/* ✅ แถบ "เพื่อน" จะโชว์แจ้งเตือนคนแอดมา (นับจาก pending status ในตาราง friendships) */}
          <Link href="/friends" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/friends') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <Users className="w-5 h-5" />
            <span>เพื่อน</span>
            {friendRequestCount > 0 && <span className="absolute left-8 top-2 w-5 h-5 bg-frog-500 text-white text-[10px] rounded-full flex items-center justify-center font-black shadow-sm">{friendRequestCount}</span>}
          </Link>
          
          <Link href="/messages" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/messages') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <MessageCircle className="w-5 h-5" />
            <span>แชท</span>
            {unreadMessageCount > 0 && <span className="absolute left-8 top-2 w-5 h-5 bg-frog-500 text-white text-[10px] rounded-full flex items-center justify-center font-black shadow-sm">{unreadMessageCount}</span>}
          </Link>

          {/* ✅ แถบ "การแจ้งเตือน" ปกติ (ไม่รวมแอดเพื่อน) */}
          <Link href="/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/notifications') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <Bell className="w-5 h-5" />
            <span>แจ้งเตือน</span>
            {unreadNotifCount > 0 && <span className="absolute left-8 top-2 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-black shadow-sm">{unreadNotifCount}</span>}
          </Link>
          
          <Link href="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/settings') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <Settings className="w-5 h-5" />
            <span>ตั้งค่า</span>
          </Link>
        </nav>

        {currentUser && (
          <div className="absolute bottom-4 left-4 right-4 space-y-2">
            <Link 
              href={`/profile/${currentUser.username}`} 
              className={`flex items-center gap-3 p-3 transition-all rounded-2xl border group ${pathname?.startsWith(`/profile/${currentUser.username}`) ? 'bg-frog-50 border-frog-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}
            >
              <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate text-gray-900">{currentUser.display_name}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">โปรไฟล์ของฉัน</p>
              </div>
            </Link>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 transition-colors text-sm font-bold">
              <LogOut className="w-5 h-5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        )}
      </aside>

      {/* Header - Mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
        <Link href="/" onClick={handleHomeClick} className="flex items-center gap-2">
          <img src="https://iili.io/qbtgKBt.png" alt="Ribbi" className="w-8 h-8" />
          <span className="text-xl font-black text-frog-600 tracking-tighter">Ribbi</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell className="w-6 h-6" />
            {unreadNotifCount > 0 && <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-black shadow-sm">{unreadNotifCount}</span>}
          </Link>
          <button onClick={() => setShowMobileMenu(true)} className="p-2 hover:bg-gray-100 rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {showMobileMenu && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" onClick={() => setShowMobileMenu(false)} />
          <aside className="lg:hidden fixed right-0 top-0 h-screen w-72 bg-white z-50 p-6 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-8">
              <span className="text-2xl font-black text-frog-600 tracking-tight uppercase">Menu</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {currentUser && (
              <Link 
                href={`/profile/${currentUser.username}`} 
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-[1.5rem] border border-gray-100 mb-6 group"
              >
                <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 truncate">{currentUser.display_name}</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">ดูโปรไฟล์</p>
                </div>
              </Link>
            )}

            <nav className="space-y-1 flex-1">
              <Link href="/" onClick={(e) => { setShowMobileMenu(false); handleHomeClick(e); }} className={`flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-gray-50 font-bold ${isActive('/') ? 'text-frog-600 bg-frog-50/50' : 'text-gray-700'}`}>
                <Home className="w-6 h-6" />
                <span>หน้าหลัก</span>
              </Link>
              <Link href="/notifications" onClick={() => setShowMobileMenu(false)} className={`flex items-center justify-between px-4 py-4 rounded-2xl hover:bg-gray-50 font-bold ${isActive('/notifications') ? 'text-frog-600 bg-frog-50/50' : 'text-gray-700'}`}>
                <div className="flex items-center gap-4"><Bell className="w-6 h-6" /><span>แจ้งเตือน</span></div>
                {unreadNotifCount > 0 && <span className="bg-red-500 text-white text-xs px-2.5 py-1 rounded-full font-black shadow-sm">{unreadNotifCount}</span>}
              </Link>
              <Link href="/settings" onClick={() => setShowMobileMenu(false)} className={`flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-gray-50 font-bold ${isActive('/settings') ? 'text-frog-600 bg-frog-50/50' : 'text-gray-700'}`}>
                <Settings className="w-6 h-6" />
                <span>ตั้งค่า</span>
              </Link>
            </nav>

            <button onClick={() => { setShowMobileMenu(false); handleLogout(); }} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-red-50 text-red-500 font-black transition-colors">
              <LogOut className="w-6 h-6" />
              <span>ออกจากระบบ</span>
            </button>
          </aside>
        </>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe">
        <div className="flex justify-around items-center h-16">
          <Link href="/" onClick={handleHomeClick} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full ${isActive('/') ? 'text-frog-600' : 'text-gray-400'}`}>
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-bold">หน้าหลัก</span>
          </Link>
          <Link href="/friends" className={`flex flex-col items-center justify-center gap-1 flex-1 h-full relative ${isActive('/friends') ? 'text-frog-600' : 'text-gray-400'}`}>
            <Users className="w-6 h-6" />
            <span className="text-[10px] font-bold">เพื่อน</span>
            {friendRequestCount > 0 && <span className="absolute top-2 right-4 bg-frog-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black border-2 border-white">{friendRequestCount}</span>}
          </Link>
          <Link href="/messages" className={`flex flex-col items-center justify-center gap-1 flex-1 h-full relative ${isActive('/messages') ? 'text-frog-600' : 'text-gray-400'}`}>
            <MessageCircle className="w-6 h-6" />
            <span className="text-[10px] font-bold">แชท</span>
            {unreadMessageCount > 0 && <span className="absolute top-2 right-4 bg-frog-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black border-2 border-white">{unreadMessageCount}</span>}
          </Link>
          {currentUser && (
            <Link href={`/profile/${currentUser.username}`} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full ${pathname?.startsWith(`/profile/${currentUser.username}`) ? 'text-frog-600' : 'text-gray-400'}`}>
              <User className="w-6 h-6" />
              <span className="text-[10px] font-bold">โปรไฟล์</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

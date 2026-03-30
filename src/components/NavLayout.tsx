'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase'; 
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Home, 
  Users, 
  User, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  MessageCircle, 
  Bell, 
  Loader2,
  CircleUser
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const CACHE_KEY = 'ribbi_session_v3';

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [friendReq, setFriendReq] = useState(0);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const pathnameRef = useRef(pathname);

  // 1. Initial Load from Cache (เพื่อความเร็วระดับ 0 วินาที)
  useEffect(() => {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setCurrentUser(data.user);
        setUnreadNotif(data.notif || 0);
        setFriendReq(data.friend || 0);
        setUnreadMsg(data.message || 0);
        setIsLoaded(true);
      } catch (e) {
        console.error("Cache corrupted");
      }
    }
    fetchLatestData();
  }, []);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (pathname === '/notifications') setUnreadNotif(0);
  }, [pathname]);

  useOnlineStatus(currentUser?.id || null);

  // 2. Background Fetch (ดึงข้อมูลเงียบๆ ข้างหลัง ไม่บล็อก UI)
  const fetchLatestData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!sessionStorage.getItem(CACHE_KEY)) router.push('/login');
        return;
      }

      const { data, error } = await supabase.rpc('get_user_app_data', { user_uuid: session.user.id });

      if (!error && data) {
        const newState = {
          user: data.user_info,
          notif: data.unread_notifications || 0,
          friend: data.pending_friends || 0,
          message: data.unread_messages || 0
        };
        
        setCurrentUser(newState.user);
        setUnreadNotif(newState.notif);
        setFriendReq(newState.friend);
        setUnreadMsg(newState.message);
        setIsLoaded(true);
        
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(newState));
      }
    } catch (err) {
      console.error("Sync error:", err);
    }
  };

  // 3. Optimized Real-time (ดักเฉพาะจุดสำคัญ)
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`nav-global-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${currentUser.id}` }, (p: any) => {
        if (p.new.type !== 'friend_request' && pathnameRef.current !== '/notifications') setUnreadNotif(prev => prev + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${currentUser.id}` }, (p: any) => {
        // อัปเดตยอดแชทแบบ Real-time
        setUnreadMsg(prev => p.new.unread_count > 0 ? prev + 1 : Math.max(0, prev - 1));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${currentUser.id}` }, () => {
        setFriendReq(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const handleLogout = async () => {
    sessionStorage.removeItem(CACHE_KEY);
    await supabase.auth.signOut();
    router.push('/login');
  };

  // 4. Navigation Config (เพื่อให้เมนูขึ้นแน่นอน)
  const navItems = useMemo(() => [
    { label: 'หน้าหลัก', icon: Home, href: '/', count: 0 },
    { label: 'เพื่อน', icon: Users, href: '/friends', count: friendReq },
    { label: 'แชท', icon: MessageCircle, href: '/messages', count: unreadMsg },
    { label: 'แจ้งเตือน', icon: Bell, href: '/notifications', count: unreadNotif },
    { label: 'โปรไฟล์', icon: User, href: currentUser ? `/profile/${currentUser.username}` : '#', count: 0 },
    { label: 'ตั้งค่า', icon: Settings, href: '/settings', count: 0 },
  ], [currentUser, unreadNotif, friendReq, unreadMsg]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 bg-white border-r border-gray-100 z-50 p-4">
        <div className="mb-8 px-2">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="https://iili.io/qbtgKBt.png" className="w-10 h-10 group-hover:scale-110 transition-all duration-300" alt="Ribbi" />
            <span className="text-2xl font-black text-frog-600 tracking-tighter">Ribbi</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.label} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                  isActive ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : 'group-hover:scale-110 transition-transform'}`} />
                  {item.count > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white font-black animate-in zoom-in">
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  )}
                </div>
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section Bottom */}
        <div className="mt-auto pt-4 border-t border-gray-50">
          {currentUser ? (
            <div className="space-y-2">
              <Link href={`/profile/${currentUser.username}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl transition-all group">
                <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-gray-100" alt="" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs truncate text-gray-900">{currentUser.display_name}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase truncate">ดูโปรไฟล์</p>
                </div>
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 font-bold text-xs transition-all">
                <LogOut className="w-4 h-4" /> ออกจากระบบ
              </button>
            </div>
          ) : (
            <div className="h-12 w-full bg-gray-50 rounded-2xl animate-pulse" />
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-2">
          <img src="https://iili.io/qbtgKBt.png" className="w-8 h-8" alt="" />
          <span className="text-xl font-black text-frog-600 tracking-tighter">Ribbi</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="p-2 relative bg-gray-50 rounded-xl">
            <Bell className="w-6 h-6 text-gray-700" />
            {unreadNotif > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-black border border-white">{unreadNotif}</span>}
          </Link>
          <button onClick={() => setShowMobileMenu(true)} className="p-2 bg-gray-50 rounded-xl text-gray-700">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Bottom Nav - Mobile ✅ แท็บโปรไฟล์ต้องขึ้นที่นี่เสมอ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-16 flex items-center justify-around z-40 pb-safe">
        {navItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          // พิเศษสำหรับโปรไฟล์ Mobile ใช้รูปแทนไอคอนถ้าโหลดเสร็จแล้ว
          if (item.label === 'โปรไฟล์' && currentUser) {
            return (
              <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 flex-1 relative ${isActive ? 'text-frog-600 scale-105 font-bold' : 'text-gray-400'}`}>
                <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className={`w-6 h-6 rounded-full object-cover border ${isActive ? 'border-frog-500' : 'border-gray-300'}`} alt="" />
                <span className="text-[10px] font-bold">ฉัน</span>
              </Link>
            );
          }

          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 flex-1 relative ${isActive ? 'text-frog-600 scale-105 font-bold' : 'text-gray-400'}`}>
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {item.count > 0 && <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-black border border-white">{item.count}</span>}
              </div>
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Drawer ✅ กู้คืนความสมบูรณ์ */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowMobileMenu(false)} />
          <aside className="fixed right-0 top-0 h-full w-80 bg-white z-50 flex flex-col animate-in slide-in-from-right shadow-2xl">
            <div className="p-6 flex items-center justify-between border-b border-gray-50">
              <span className="text-xl font-black text-frog-600 uppercase tracking-widest">Ribbi Menu</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 bg-gray-50 rounded-full"><X size={20} className="text-gray-400" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {currentUser && (
                <Link href={`/profile/${currentUser.username}`} onClick={() => setShowMobileMenu(false)} className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl mb-6 active:scale-95 transition-all">
                  <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white" alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-900 truncate text-lg">{currentUser.display_name}</p>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">ดูโปรไฟล์ของฉัน</p>
                  </div>
                </Link>
              )}

              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.label} href={item.href} onClick={() => setShowMobileMenu(false)} className="flex items-center justify-between p-4 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 active:bg-frog-50 transition-colors">
                      <div className="flex items-center gap-4"><Icon size={22} className="text-gray-400" /><span>{item.label}</span></div>
                      {item.count > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-black">{item.count}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-gray-50">
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm active:scale-95 transition-all">
                <LogOut size={20}/> ออกจากระบบ
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

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

const CACHE_KEY = 'ribbi_session_v101'; 

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // โหลดจาก Cache ทันทีเพื่อให้ตัวแปร username พร้อมใช้งานสำหรับ Link
  const [currentUser, setCurrentUser] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached).user : null;
    }
    return null;
  });

  const [unreadNotif, setUnreadNotif] = useState(0);
  const [friendReq, setFriendReq] = useState(0);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (pathname === '/notifications') setUnreadNotif(0);
  }, [pathname]);

  useOnlineStatus(currentUser?.id || null);

  useEffect(() => {
    fetchLatestData();
  }, []);

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
        
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(newState));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem(CACHE_KEY);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  // ✅ รายการเมนู: Next.js จะแปลง href="/profile/xxx" ไปเรียกไฟล์ src/app/profile/[username]/page.tsx ให้อัตโนมัติ
  const navItems = [
    { label: 'หน้าหลัก', icon: Home, href: '/' },
    { label: 'เพื่อน', icon: Users, href: '/friends', count: friendReq },
    { label: 'แชท', icon: MessageCircle, href: '/messages', count: unreadMsg },
    { label: 'แจ้งเตือน', icon: Bell, href: '/notifications', count: unreadNotif },
    { label: 'โปรไฟล์', icon: User, href: currentUser?.username ? `/profile/${currentUser.username}` : '#' },
    { label: 'ตั้งค่า', icon: Settings, href: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 bg-white border-r border-gray-100 z-50 p-4 shadow-sm">
        <div className="mb-8 px-2 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="https://iili.io/qbtgKBt.png" className="w-10 h-10 group-hover:scale-110 transition-transform duration-300" alt="Ribbi" />
            <span className="text-2xl font-black text-frog-600 tracking-tighter">Ribbi</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item.href) && item.href !== '#';
            const Icon = item.icon;
            return (
              <Link 
                key={item.label} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                  active ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'scale-110' : 'group-hover:scale-110 transition-transform'}`} />
                  {item.count && item.count > 0 ? (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white font-black animate-in zoom-in">
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  ) : null}
                </div>
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ✅ ปุ่ม Profile & Logout - ล่างสุดของ Sidebar */}
        <div className="mt-auto pt-4 border-t border-gray-100 space-y-2">
          {currentUser && (
            <Link href={`/profile/${currentUser.username}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100 group">
              <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm" alt="" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs truncate text-gray-900">{currentUser.display_name}</p>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">My Profile</p>
              </div>
            </Link>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-red-500 hover:bg-red-50 font-black text-xs transition-all group">
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Header - Mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40 shadow-sm">
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

      {/* Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-6">{children}</div>
      </main>

      {/* Bottom Nav - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-16 flex items-center justify-around z-40 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        {navItems.slice(0, 5).map((item) => {
          const active = isActive(item.href) && item.href !== '#';
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 flex-1 relative transition-all ${active ? 'text-frog-600 font-bold scale-105' : 'text-gray-400'}`}>
              <div className="relative">
                {item.label === 'โปรไฟล์' && currentUser ? (
                  <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className={`w-6 h-6 rounded-full object-cover border-2 ${active ? 'border-frog-500' : 'border-transparent'}`} alt="" />
                ) : (
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                )}
                {item.count && item.count > 0 ? (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-black border border-white">{item.count > 99 ? '99+' : item.count}</span>
                ) : null}
              </div>
              <span className="text-[10px] uppercase font-black tracking-tighter">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Drawer */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowMobileMenu(false)} />
          <aside className="fixed right-0 top-0 h-full w-80 bg-white z-50 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
            <div className="p-6 flex items-center justify-between border-b border-gray-50">
              <span className="text-xl font-black text-frog-600 uppercase tracking-widest italic">Ribbi Menu</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 bg-gray-50 rounded-full"><X size={20} className="text-gray-500"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {currentUser && (
                <Link href={`/profile/${currentUser.username}`} onClick={() => setShowMobileMenu(false)} className="flex items-center gap-4 p-5 bg-gray-50 rounded-[2.5rem] mb-6 active:scale-95 transition-all border border-gray-100 shadow-inner">
                  <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white" alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-900 truncate text-lg">{currentUser.display_name}</p>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">ดูโปรไฟล์</p>
                  </div>
                </Link>
              )}

              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href) && item.href !== '#';
                return (
                  <Link key={item.label} href={item.href} onClick={() => setShowMobileMenu(false)} className={`flex items-center justify-between p-4 rounded-2xl font-black transition-all ${active ? 'bg-frog-50 text-frog-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-4"><Icon size={24} className={active ? 'text-frog-600' : 'text-gray-300'} /><span>{item.label}</span></div>
                    {item.count && item.count > 0 ? <span className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black shadow-sm">{item.count > 99 ? '99+' : item.count}</span> : null}
                  </Link>
                );
              })}
            </div>

            <div className="p-6 border-t border-gray-100">
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-red-100 text-red-500 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-sm hover:bg-red-50">
                <LogOut size={20}/> <span>ออกจากระบบ</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

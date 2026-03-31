'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase'; 
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, User, Settings, LogOut, Menu, X, MessageCircle, Bell, ChevronRight } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const CACHE_KEY = 'ribbi_v4_nav_cache';

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [friendReq, setFriendReq] = useState(0);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const { onlineUsers } = useOnlineStatus(currentUser?.id || null);

  useEffect(() => {
    setIsMounted(true);
    setShowMobileMenu(false);
    fetchLatestData();
  }, [pathname]);

  const fetchLatestData = async () => {
    const { data: authData } = await supabase.auth.getSession();
    if (!authData?.session) return;
    const { data } = await supabase.rpc('get_user_app_data', { user_uuid: authData.session.user.id });
    if (data && data.user_info) {
      setCurrentUser(data.user_info);
      setUnreadNotif(data.unread_notifications || 0);
      setFriendReq(data.pending_friends || 0);
      setUnreadMsg(data.unread_messages || 0);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!isMounted) return null;

  const profileLink = currentUser?.username ? `/profile/${currentUser.username}` : '#';
  const navItems = [
    { label: 'Home', icon: Home, href: '/' },
    { label: 'Friends', icon: Users, href: '/friends', count: friendReq },
    { label: 'Chat', icon: MessageCircle, href: '/messages', count: unreadMsg },
    { label: 'Noti', icon: Bell, href: '/notifications', count: unreadNotif },
  ];

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col lg:flex-row overflow-x-hidden">
      {/* Desktop Aside */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 bg-white border-r z-50 p-4">
        <Link href="/" className="mb-8 px-2 flex items-center gap-2"><img src="https://iili.io/qbtgKBt.png" className="w-10 h-10"/><span className="text-2xl font-black text-frog-600">Ribbi</span></Link>
        <nav className="flex-1 space-y-1">
          {navItems.map(item => (
            <Link key={item.label} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${pathname === item.href ? 'bg-frog-500 text-white font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
              <item.icon size={20}/> <span>{item.label}</span>
              {item.count > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 rounded-full">{item.count}</span>}
            </Link>
          ))}
          <Link href={profileLink} className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${pathname.startsWith('/profile') ? 'bg-frog-500 text-white' : 'text-gray-500'}`}><User size={20}/> <span>Profile</span></Link>
        </nav>
        <button onClick={handleLogout} className="mt-auto p-4 text-red-500 text-xs font-black flex items-center gap-2"><LogOut size={16}/> Logout</button>
      </aside>

      {/* Mobile Top Nav */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-40">
        <span className="text-xl font-black text-frog-600">Ribbi</span>
        <button onClick={() => setShowMobileMenu(true)} className="p-2"><Menu/></button>
      </header>

      {/* Mobile Drawer (Burger Menu) */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileMenu(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-white p-6 shadow-2xl animate-in slide-in-from-right">
             <div className="flex justify-between items-center mb-8"><span className="font-black italic">MENU</span><button onClick={() => setShowMobileMenu(false)}><X/></button></div>
             <div className="space-y-4">
                {navItems.map(item => (
                   <Link key={item.label} href={item.href} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3"><item.icon size={18}/> <span className="font-bold text-sm">{item.label}</span></div>
                      <ChevronRight size={14}/>
                   </Link>
                ))}
                <button onClick={handleLogout} className="w-full p-3 text-red-500 font-bold border-t mt-4 flex items-center gap-2"><LogOut size={16}/> Logout</button>
             </div>
          </div>
        </div>
      )}

      {/* Main Area */}
      <main className="flex-1 lg:ml-64 pt-16 pb-20 lg:pt-0 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-6">{children}</div>
      </main>

      {/* Mobile Bottom Nav (แทบล่างที่หายไป) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t flex items-center justify-around z-50 shadow-lg">
        {navItems.map(item => (
          <Link key={item.label} href={item.href} className={`flex flex-col items-center relative ${pathname === item.href ? 'text-frog-500' : 'text-gray-400'}`}>
            <item.icon size={20} />
            <span className="text-[10px] font-black uppercase">{item.label}</span>
            {item.count > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] min-w-[15px] h-[15px] rounded-full flex items-center justify-center font-bold">{item.count}</span>}
          </Link>
        ))}
        <Link href={profileLink} className={`flex flex-col items-center ${pathname.startsWith('/profile') ? 'text-frog-500' : 'text-gray-400'}`}>
          <User size={20} />
          <span className="text-[10px] font-black uppercase">Profile</span>
        </Link>
      </nav>
    </div>
  );
}

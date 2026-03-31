'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase'; 
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, User, Settings, LogOut, Menu, X, MessageCircle, Bell, ExternalLink } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const CACHE_KEY = 'ribbi_v4_stable_final';

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [friendReq, setFriendReq] = useState(0);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    setIsMounted(true);
    pathnameRef.current = pathname;
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.user) {
          setCurrentUser(data.user);
          setUnreadNotif(pathname === '/notifications' ? 0 : (data.notif || 0));
          setFriendReq(pathname === '/friends' ? 0 : (data.friend || 0));
          setUnreadMsg(pathname === '/messages' ? 0 : (data.message || 0));
        }
      } catch (e) { console.error("Cache error"); }
    }
    fetchLatestData();
  }, [pathname]);

  const { onlineUsers } = useOnlineStatus(currentUser?.id || null);

  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase.channel(`nav-realtime-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${currentUser.id}` }, () => {
        if (pathnameRef.current !== '/notifications') setUnreadNotif(v => v + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${currentUser.id}` }, (p) => {
        const newVal = p.new?.unread_count || 0;
        const oldVal = p.old?.unread_count || 0;
        const diff = newVal - oldVal;
        if (diff !== 0) setUnreadMsg(v => Math.max(0, v + diff));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const fetchLatestData = async () => {
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData?.session) return;
      const { data, error } = await supabase.rpc('get_user_app_data', { user_uuid: authData.session.user.id });
      if (!error && data && data.user_info) {
        setCurrentUser(data.user_info);
        setUnreadNotif(pathname === '/notifications' ? 0 : data.unread_notifications);
        setFriendReq(pathname === '/friends' ? 0 : data.pending_friends);
        setUnreadMsg(pathname === '/messages' ? 0 : data.unread_messages);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          user: data.user_info, notif: data.unread_notifications, friend: data.pending_friends, message: data.unread_messages
        }));
      }
    } catch (err) { console.error(err); }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem(CACHE_KEY);
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!isMounted) return null;

  const profileLink = currentUser?.username ? `/profile/${currentUser.username}` : '#';
  const navItems = [
    { label: 'หน้าหลัก', icon: Home, href: '/' },
    { label: 'เพื่อน', icon: Users, href: '/friends', count: friendReq },
    { label: 'แชท', icon: MessageCircle, href: '/messages', count: unreadMsg },
    { label: 'แจ้งเตือน', icon: Bell, href: '/notifications', count: unreadNotif },
    { label: 'โปรไฟล์', icon: User, href: profileLink },
    { label: 'ตั้งค่า', icon: Settings, href: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 bg-white border-r border-gray-100 z-50 p-4">
        <div className="mb-8 px-2">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="https://iili.io/qbtgKBt.png" className="w-10 h-10 group-hover:scale-110 transition-transform" alt="Ribbi" />
            <span className="text-2xl font-black text-frog-600 tracking-tighter">Ribbi</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.label === 'โปรไฟล์' && currentUser?.username && pathname.startsWith(`/profile/${currentUser.username}`));
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50'}`}>
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {(item.count ?? 0) > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white font-black">
                      {(item.count ?? 0) > 99 ? '99+' : item.count}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
          <a href="https://roleplayth.com/index.php" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-gray-500 hover:bg-gray-50 mt-2 border border-dashed border-gray-200">
            <ExternalLink className="w-5 h-5" /> <span className="text-sm font-medium">กลับสู่เว็บไซต์</span>
          </a>
        </nav>
        <div className="mt-auto pt-4 border-t">
          {currentUser && (
            <Link href={profileLink} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl mb-2">
              <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" alt="" />
              <div className="min-w-0 flex-1"><p className="font-bold text-xs truncate">{currentUser.display_name}</p><p className="text-[9px] text-gray-400 font-bold uppercase">My Profile</p></div>
            </Link>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-red-500 hover:bg-red-50 font-black text-xs"><LogOut className="w-4 h-4" /> <span>ออกจากระบบ</span></button>
        </div>
      </aside>

      {/* Header Mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-2"><img src="https://iili.io/qbtgKBt.png" className="w-8 h-8" alt="" /><span className="text-xl font-black text-frog-600">Ribbi</span></Link>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="p-2 relative bg-gray-50 rounded-xl"><Bell className="w-6 h-6 text-gray-700" />{unreadNotif > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-black border border-white">{unreadNotif}</span>}</Link>
          <button onClick={() => setShowMobileMenu(true)} className="p-2 bg-gray-50 rounded-xl"><Menu className="w-6 h-6" /></button>
        </div>
      </header>

      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-6">{children}</div>
      </main>

      {/* Bottom Nav Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t h-16 flex items-center justify-around z-40 pb-safe">
        {navItems.slice(0, 5).map((item) => {
          const active = item.label === 'โปรไฟล์' ? pathname.startsWith('/profile/') : pathname === item.href;
          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 flex-1 relative ${active ? 'text-frog-600' : 'text-gray-400'}`}>
              <div className="relative">
                {item.label === 'โปรไฟล์' && currentUser ? (
                  <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className={`w-6 h-6 rounded-full object-cover border-2 ${active ? 'border-frog-500' : 'border-transparent'}`} alt="" />
                ) : <item.icon size={22} />}
                {(item.count ?? 0) > 0 && <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-black border border-white">{item.count}</span>}
              </div>
              <span className="text-[10px] font-black uppercase">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Menu Drawer */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <aside className="fixed right-0 top-0 h-full w-80 bg-white z-[60] flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
            <div className="p-6 flex items-center justify-between border-b bg-gray-50/50">
              <span className="text-xl font-black text-frog-600 uppercase">Ribbi Menu</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 text-gray-400"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {navItems.map((item) => (
                <Link key={item.label} href={item.href} onClick={() => setShowMobileMenu(false)} className={`flex items-center justify-between p-4 rounded-2xl font-black ${pathname === item.href ? 'bg-frog-50 text-frog-600' : 'text-gray-600'}`}>
                  <div className="flex items-center gap-4"><item.icon size={24} /><span>{item.label}</span></div>
                  {(item.count ?? 0) > 0 && <span className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black">{item.count}</span>}
                </Link>
              ))}
            </div>
            <div className="p-6 border-t">
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-red-100 text-red-500 rounded-2xl font-black shadow-sm"><LogOut size={20}/> <span>ออกจากระบบ</span></button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

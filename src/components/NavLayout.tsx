'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase'; 
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, User, Settings, LogOut, Menu, X, MessageCircle, Bell, ExternalLink } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const CACHE_KEY = 'ribbi_v4_stable_final_v2';

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

  // ✅ เรียกใช้ Hook ที่เราแก้ไขลำดับโค้ดแล้ว
  const { onlineUsers } = useOnlineStatus(currentUser?.id || null);

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
      } catch (e) { sessionStorage.removeItem(CACHE_KEY); }
    }
    fetchLatestData();
  }, [pathname]);

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
        setUnreadNotif(pathname === '/notifications' ? 0 : (data.unread_notifications || 0));
        setFriendReq(pathname === '/friends' ? 0 : (data.pending_friends || 0));
        setUnreadMsg(pathname === '/messages' ? 0 : (data.unread_messages || 0));
        
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
            return (
              <Link key={item.label} href={item.href} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50'}`}>
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {(item.count ?? 0) > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white font-black">{(item.count ?? 0) > 99 ? '99+' : item.count}</span>}
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t pt-4">
          {currentUser && (
            <Link href={profileLink} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl mb-2">
              <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border" alt="" />
              <div className="min-w-0 flex-1"><p className="font-bold text-xs truncate">{currentUser.display_name}</p><p className="text-[9px] text-gray-400 font-bold uppercase">My Profile</p></div>
            </Link>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-red-500 hover:bg-red-50 font-black text-xs transition-all"><LogOut className="w-4 h-4" /> <span>ออกจากระบบ</span></button>
        </div>
      </aside>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-2"><img src="https://iili.io/qbtgKBt.png" className="w-8 h-8" alt="" /><span className="text-xl font-black text-frog-600">Ribbi</span></Link>
        <button onClick={() => setShowMobileMenu(true)} className="p-2 bg-gray-50 rounded-xl"><Menu className="w-6 h-6" /></button>
      </header>
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-h-screen"><div className="max-w-7xl mx-auto p-4 md:p-6">{children}</div></main>
    </div>
  );
}

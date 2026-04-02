'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase'; 
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, User, Settings, LogOut, Menu, X, MessageCircle, Bell, ArrowLeft, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const CACHE_KEY = 'ribbi_user_cache';

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [currentUser, setCurrentUser] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    }
    return null;
  });

  const [unreadNotif, setUnreadNotif] = useState(0);
  const [friendReq, setFriendReq] = useState(0);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedRef = useRef<number>(0);

  const { onlineUsers } = useOnlineStatus(currentUser?.id || null);

  // ✅ 1. ฟังก์ชันเล่นเสียง (แก้ Path เป็น /sounds/ribbi.wav)
  const playNotificationSound = useCallback(() => {
    const now = Date.now();
    if (now - lastPlayedRef.current < 1500) return; 
    
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/ribbi.wav'); // ✅ แก้ Path ตรงนี้ครับ
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0; 
      audioRef.current.volume = 0.4;
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Audio play blocked. Need user interaction first.");
        });
      }
      lastPlayedRef.current = now;
    }
  }, []);

  // ✅ 2. ระบบ Unlock Audio (ช่วยให้เล่นเสียงได้แม้เบราว์เซอร์จะบล็อกตอนแรก)
  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current) {
        // แอบเล่นแบบเงียบๆ เพื่อขออนุญาตเบราว์เซอร์
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          if (audioRef.current) audioRef.current.currentTime = 0;
        }).catch(() => {});
        
        // ปลดล็อกเสร็จแล้วให้ลบ Event ทิ้งเพื่อประหยัดทรัพยากร
        document.removeEventListener('click', unlockAudio);
      }
    };
    document.addEventListener('click', unlockAudio);
    return () => document.removeEventListener('click', unlockAudio);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    // ✅ แก้ Path สำหรับการโหลดครั้งแรกด้วย
    const audio = new Audio('/sounds/ribbi.wav');
    audio.load();
    audioRef.current = audio;
    
    fetchLatestData();
  }, []); 

  useEffect(() => {
    setShowMobileMenu(false); 
    if (currentUser?.id) {
      supabase.rpc('get_user_app_data', { user_uuid: currentUser.id }).then(({ data }) => {
        if (data) {
          setUnreadNotif(data.unread_notifications || 0);
          setFriendReq(data.pending_friends || 0);
          setUnreadMsg(data.unread_messages || 0);
        }
      });
    }
  }, [pathname, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase.channel('realtime_nav_alerts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `receiver_id=eq.${currentUser.id}` 
      }, () => { 
        setUnreadNotif(p => p + 1); 
        playNotificationSound(); 
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'friendships', 
        filter: `receiver_id=eq.${currentUser.id}` 
      }, (payload: any) => { 
        if (payload.new.status === 'pending') { 
          setFriendReq(p => p + 1); 
          playNotificationSound(); 
        } 
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, playNotificationSound]);

  const fetchLatestData = async () => {
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData?.session) {
        if (pathname !== '/login' && pathname !== '/register') {
          localStorage.removeItem(CACHE_KEY);
          router.push('/login');
        }
        return;
      }

      const { data, error } = await supabase.rpc('get_user_app_data', { user_uuid: authData.session.user.id });
      if (!error && data?.user_info) {
        setCurrentUser(data.user_info);
        setUnreadNotif(data.unread_notifications || 0);
        setFriendReq(data.pending_friends || 0);
        setUnreadMsg(data.unread_messages || 0);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.user_info));
      }
    } catch (err) { console.error(err); }
  };

  const handleLogout = async () => {
    localStorage.removeItem(CACHE_KEY);
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
  ];

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col lg:flex-row overflow-x-hidden">
      {/* ... (ส่วนที่เหลือของ UI เหมือนเดิมเป๊ะครับ) ... */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 bg-white border-r z-50 p-4">
        <Link href="/" className="mb-8 px-2 flex items-center gap-2 group">
          <img src="https://iili.io/qbtgKBt.png" className="w-10 h-10 group-hover:rotate-12 transition-transform" alt=""/>
          <span className="text-2xl font-black text-frog-600 tracking-tighter">Ribbi</span>
        </Link>

        <div className="mb-6 h-[72px]">
          {currentUser ? (
            <Link href={profileLink} className="p-3 rounded-2xl bg-gray-50 flex items-center gap-3 hover:bg-frog-50 transition-all border border-transparent hover:border-frog-100 group animate-in fade-in">
              <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm" alt=""/>
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-900 truncate">{currentUser.display_name}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate group-hover:text-frog-500">โปรไฟล์ของฉัน</p>
              </div>
            </Link>
          ) : (
            <div className="p-3 rounded-2xl bg-gray-50/50 flex items-center gap-3 animate-pulse border border-dashed border-gray-200">
              <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
              <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-2/3"></div><div className="h-2 bg-gray-100 rounded w-1/2"></div></div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(item => (
            <Link key={item.label} href={item.href} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${pathname === item.href ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50'}`}>
              <item.icon size={20}/> <span className="text-sm font-medium">{item.label}</span>
              {(item.count ?? 0) > 0 && <span className={`ml-auto text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full font-black ${pathname === item.href ? 'bg-white text-frog-600' : 'bg-red-500 text-white'}`}>{item.count}</span>}
            </Link>
          ))}
          <Link href="/settings" className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${pathname === '/settings' ? 'bg-frog-500 text-white font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Settings size={20}/> <span>ตั้งค่า</span>
          </Link>
        </nav>

        <div className="mt-auto pt-4 border-t space-y-2">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-red-500 hover:bg-red-50 font-black text-xs transition-all"><LogOut size={16}/> <span>ออกจากระบบ</span></button>
          <a href="https://roleplayth.com" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-gray-500 hover:bg-gray-100 font-black text-xs transition-all"><ArrowLeft size={16}/> <span>กลับ RoleplayTH</span></a>
        </div>
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-2"><img src="https://iili.io/qbtgKBt.png" className="w-8 h-8" alt=""/><span className="text-xl font-black text-frog-600">Ribbi</span></Link>
        <button onClick={() => setShowMobileMenu(true)} className="p-1 pr-1 pl-3 bg-gray-50 rounded-2xl active:scale-90 transition-all flex items-center gap-2 border">
          {currentUser ? <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-lg object-cover" alt=""/> : <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />}
          <Menu size={20} className="text-gray-600 mr-2"/>
        </button>
      </header>

      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-6 animate-in slide-in-from-right duration-300 text-gray-900">
            <div className="flex justify-between items-center mb-8"><span className="font-black text-frog-600 italic">RIBBI MENU</span><button onClick={() => setShowMobileMenu(false)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button></div>
            {currentUser && (
              <div className="mb-8 p-4 bg-gray-50 rounded-[2rem] flex flex-col items-center text-center gap-2 border border-gray-100 animate-in zoom-in">
                <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-20 h-20 rounded-[1.5rem] object-cover shadow-md border-2 border-white" alt=""/>
                <div><p className="text-base font-black text-gray-900 leading-tight">{currentUser.display_name}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">@{currentUser.username}</p></div>
              </div>
            )}
            <div className="space-y-2">
              {navItems.map(item => (
                <Link key={item.label} href={item.href} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl active:bg-frog-50 transition-colors">
                  <div className="flex items-center gap-3"><item.icon size={20} className="text-gray-400"/><span className="font-bold text-sm text-gray-700">{item.label}</span></div>
                  {(item.count ?? 0) > 0 && <span className="bg-red-500 text-white text-[10px] min-w-[20px] h-[20px] flex items-center justify-center rounded-full font-black">{item.count}</span>}
                </Link>
              ))}
              <Link href="/settings" className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl"><Settings size={20} className="text-gray-400"/> <span className="font-bold text-sm text-gray-700">ตั้งค่า</span></Link>
              <div className="pt-4 mt-4 border-t space-y-2">
                <button onClick={handleLogout} className="w-full p-4 border-2 border-red-50 text-red-500 rounded-2xl font-black text-xs flex items-center justify-center gap-2"><LogOut size={16}/> ออกจากระบบ</button>
                <a href="https://roleplayth.com" target="_blank" rel="noopener noreferrer" className="w-full p-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs flex items-center justify-center gap-2">กลับ RoleplayTH</a>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-64 pt-16 pb-20 lg:pt-0 lg:pb-0 min-h-[100dvh]"><div className="max-w-7xl mx-auto p-4 md:p-6">{children}</div></main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-0.5 relative ${pathname === item.href ? 'text-frog-500' : 'text-gray-400'}`}>
            <div className="relative p-1">
              <item.icon size={22} className={pathname === item.href ? 'stroke-[2.5px]' : 'stroke-[1.5px]'} />
              {(item.count ?? 0) > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] min-w-[16px] h-[16px] flex items-center justify-center rounded-full border-2 border-white font-black">{item.count}</span>}
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
          </Link>
        ))}
        <Link href={profileLink} className={`flex flex-col items-center gap-0.5 ${pathname.startsWith('/profile') ? 'text-frog-500' : 'text-gray-400'}`}>
          <div className="p-1"><img src={currentUser?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className={`w-6 h-6 rounded-full object-cover border-2 ${pathname.startsWith('/profile') ? 'border-frog-500' : 'border-transparent'}`} alt=""/></div>
          <span className="text-[9px] font-black uppercase tracking-tighter">โปรไฟล์</span>
        </Link>
      </nav>
    </div>
  );
}

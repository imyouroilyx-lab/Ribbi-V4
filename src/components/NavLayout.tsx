'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase'; 
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, User, Settings, LogOut, Menu, X, MessageCircle, Bell, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// คีย์สำหรับเก็บแคชในเบราว์เซอร์
const CACHE_KEY = 'ribbi_app_cache';

const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/ribbi.wav');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (err) {}
};

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // ✅ 1. เริ่มต้น State ด้วยข้อมูลจาก Cache (ถ้ามี) เพื่อความเร็วระดับ 0 วินาที
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const pathnameRef = useRef<string | null>(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (pathname === '/notifications') setUnreadNotifCount(0);
  }, [pathname]);

  useOnlineStatus(currentUser?.id || null);

  // ✅ 2. โหลดแคชจาก Browser ทันทีที่ Component เริ่มทำงาน
  useEffect(() => {
    const savedCache = sessionStorage.getItem(CACHE_KEY);
    if (savedCache) {
      try {
        const cache = JSON.parse(savedCache);
        setCurrentUser(cache.user);
        setUnreadNotifCount(cache.notif);
        setFriendRequestCount(cache.friend);
        setUnreadMessageCount(cache.message);
        setIsInitialLoading(false); // ปิด loading ทันทีเพราะมีข้อมูลเก่าโชว์แล้ว
      } catch (e) {
        console.error("Cache parsing error", e);
      }
    }
    loadAppData();
  }, []);

  // ✅ 3. ดึงข้อมูลจริงจาก Server มาทับ (Background Sync)
  const loadAppData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setIsInitialLoading(false);
        if (!sessionStorage.getItem(CACHE_KEY)) router.push('/login');
        return;
      }

      const { data, error } = await supabase.rpc('get_user_app_data', { user_uuid: authUser.id });

      if (!error && data) {
        const newUserData = data.user_info;
        const newCounts = {
          notif: data.unread_notifications || 0,
          friend: data.pending_friends || 0,
          message: data.unread_messages || 0
        };

        // อัปเดต State
        setCurrentUser(newUserData);
        setUnreadNotifCount(newCounts.notif);
        setFriendRequestCount(newCounts.friend);
        setUnreadMessageCount(newCounts.message);

        // บันทึกลง Browser Cache (Session Storage)
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          user: newUserData,
          ...newCounts
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Real-time listener
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`nav-priv-updates-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${currentUser.id}` }, (payload: any) => {
        if (payload.new.type !== 'friend_request' && pathnameRef.current !== '/notifications') {
          setUnreadNotifCount(prev => prev + 1);
          playNotificationSound();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${currentUser.id}` }, () => {
        const fetchNewCount = async () => {
          const { data } = await supabase.from('chat_participants').select('unread_count').eq('user_id', currentUser.id);
          if (data) {
            const total = data.reduce((sum, p) => sum + (p.unread_count || 0), 0);
            setUnreadMessageCount(current => {
              if (total > current && !pathnameRef.current?.startsWith('/messages')) playNotificationSound();
              return total;
            });
          }
        };
        fetchNewCount();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${currentUser.id}` }, (payload: any) => {
        if (payload.new.status === 'pending') {
          setFriendRequestCount(prev => prev + 1);
          playNotificationSound();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const handleLogout = async () => {
    sessionStorage.removeItem(CACHE_KEY); // ล้างแคช
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 fixed left-0 top-0 h-screen bg-white border-r border-gray-100 p-4 z-50">
        <div className="mb-8 px-2">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="https://iili.io/qbtgKBt.png" alt="Ribbi" className="w-10 h-10 group-hover:scale-110 transition-transform" />
            <span className="text-2xl font-black text-frog-600 tracking-tighter">Ribbi</span>
          </Link>
        </div>

        <nav className="space-y-1">
          <Link href="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}><Home className="w-5 h-5" /> <span>หน้าหลัก</span></Link>
          <Link href="/friends" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/friends') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}><Users className="w-5 h-5" /> <span>เพื่อน</span>{friendRequestCount > 0 && <span className="absolute left-8 top-2 min-w-[20px] h-5 px-1.5 bg-frog-500 text-white text-[10px] rounded-full flex items-center justify-center font-black">{friendRequestCount}</span>}</Link>
          <Link href="/messages" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/messages') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}><MessageCircle className="w-5 h-5" /> <span>แชท</span>{unreadMessageCount > 0 && <span className="absolute left-8 top-2 min-w-[20px] h-5 px-1.5 bg-frog-500 text-white text-[10px] rounded-full flex items-center justify-center font-black">{unreadMessageCount}</span>}</Link>
          <Link href="/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/notifications') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}><Bell className="w-5 h-5" /> <span>แจ้งเตือน</span>{unreadNotifCount > 0 && <span className="absolute left-8 top-2 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-black">{unreadNotifCount}</span>}</Link>
          <Link href="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/settings') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}><Settings className="w-5 h-5" /> <span>ตั้งค่า</span></Link>
        </nav>

        {/* ✅ กู้คืนแถบโปรไฟล์ (แสดงผลแน่นอน) */}
        <div className="absolute bottom-4 left-4 right-4">
          {currentUser ? (
            <div className="space-y-2">
              <Link href={`/profile/${currentUser.username}`} className={`flex items-center gap-3 p-3 transition-all rounded-2xl border ${pathname?.startsWith(`/profile/${currentUser.username}`) ? 'bg-frog-50 border-frog-200' : 'bg-white border-gray-100 hover:border-frog-100 hover:bg-gray-50'} shadow-sm group`}>
                <div className="relative flex-shrink-0">
                  <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform" alt="" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate text-gray-900 leading-tight">{currentUser.display_name}</p>
                  <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-0.5">My Profile</p>
                </div>
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 font-bold text-sm transition-colors group">
                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> ออกจากระบบ
              </button>
            </div>
          ) : isInitialLoading ? (
            <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-gray-200" /></div>
          ) : null}
        </div>
      </aside>

      {/* Header - Mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-2">
          <img src="https://iili.io/qbtgKBt.png" className="w-8 h-8" alt="" />
          <span className="text-xl font-black text-frog-600 tracking-tighter">Ribbi</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/notifications" className="p-2 relative">
            <Bell className="w-6 h-6 text-gray-700" />
            {unreadNotifCount > 0 && <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-black shadow-sm">{unreadNotifCount}</span>}
          </Link>
          <button onClick={() => setShowMobileMenu(true)} className="p-2 text-gray-700"><Menu className="w-6 h-6" /></button>
        </div>
      </header>

      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-3 md:p-6">
          {children}
        </div>
      </main>

      {/* Bottom Nav - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-16 flex items-center justify-around z-40 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
        <Link href="/" className={`flex flex-col items-center gap-1 flex-1 ${isActive('/') ? 'text-frog-600' : 'text-gray-400'}`}><Home size={22} /><span className="text-[10px] font-bold">หน้าหลัก</span></Link>
        <Link href="/friends" className={`flex flex-col items-center gap-1 flex-1 relative ${isActive('/friends') ? 'text-frog-600' : 'text-gray-400'}`}><Users size={22} />{friendRequestCount > 0 && <span className="absolute top-1 right-1/4 w-4 h-4 bg-frog-500 text-white text-[9px] rounded-full flex items-center justify-center font-black border border-white">{friendRequestCount}</span>}<span className="text-[10px] font-bold">เพื่อน</span></Link>
        <Link href="/messages" className={`flex flex-col items-center gap-1 flex-1 relative ${isActive('/messages') ? 'text-frog-600' : 'text-gray-400'}`}><MessageCircle size={22} />{unreadMessageCount > 0 && <span className="absolute top-1 right-1/4 w-4 h-4 bg-frog-500 text-white text-[9px] rounded-full flex items-center justify-center font-black border border-white">{unreadMessageCount}</span>}<span className="text-[10px] font-bold">แชท</span></Link>
        {currentUser && <Link href={`/profile/${currentUser.username}`} className={`flex flex-col items-center gap-1 flex-1 ${pathname?.startsWith('/profile/') ? 'text-frog-600' : 'text-gray-400'}`}><User size={22} /><span className="text-[10px] font-bold">โปรไฟล์</span></Link>}
      </nav>

      {/* Side Menu Drawer - Mobile */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowMobileMenu(false)} />
          <aside className="fixed right-0 top-0 h-screen w-72 bg-white z-50 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
             <div className="p-6 flex items-center justify-between border-b border-gray-50">
               <span className="text-2xl font-black text-frog-600 tracking-tighter uppercase">Menu</span>
               <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-gray-50 rounded-full transition-colors"><X size={24} className="text-gray-400" /></button>
             </div>
             
             {currentUser && (
               <Link href={`/profile/${currentUser.username}`} onClick={() => setShowMobileMenu(false)} className="mx-4 mt-6 flex items-center gap-4 p-4 bg-gray-50 rounded-[2rem] border border-gray-100 group active:scale-95 transition-all">
                 <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white" alt="" />
                 <div className="min-w-0 flex-1">
                   <p className="font-black text-gray-900 truncate text-lg leading-tight">{currentUser.display_name}</p>
                   <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">ดูโปรไฟล์ของฉัน</p>
                 </div>
               </Link>
             )}

             <nav className="p-4 space-y-2 flex-1 mt-4">
               <Link href="/" onClick={() => setShowMobileMenu(false)} className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${isActive('/') ? 'bg-frog-50 text-frog-600' : 'text-gray-700 hover:bg-gray-50'}`}><Home size={22}/> หน้าหลัก</Link>
               <Link href="/notifications" onClick={() => setShowMobileMenu(false)} className={`flex items-center justify-between px-5 py-4 rounded-2xl font-bold transition-all ${isActive('/notifications') ? 'bg-frog-50 text-frog-600' : 'text-gray-700 hover:bg-gray-50'}`}><div className="flex items-center gap-4"><Bell size={22}/> แจ้งเตือน</div>{unreadNotifCount > 0 && <span className="bg-red-500 text-white text-xs px-2.5 py-1 rounded-full font-black shadow-sm">{unreadNotifCount}</span>}</Link>
               <Link href="/settings" onClick={() => setShowMobileMenu(false)} className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${isActive('/settings') ? 'bg-frog-50 text-frog-600' : 'text-gray-700 hover:bg-gray-50'}`}><Settings size={22}/> ตั้งค่า</Link>
             </nav>
             
             <div className="p-6 border-t border-gray-50">
               <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-sm">
                 <LogOut size={20}/> ออกจากระบบ
               </button>
             </div>
          </aside>
        </>
      )}
    </div>
  );
}

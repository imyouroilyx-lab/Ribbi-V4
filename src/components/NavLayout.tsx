'use client';

import { useState, useEffect, useRef } from 'react';
// ✅ ใช้ Relative path เพื่อเลี่ยงปัญหา Build Error
import { supabase } from '../lib/supabase'; 
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, User, Settings, LogOut, Menu, X, MessageCircle, Bell, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/ribbi.wav');
    audio.volume = 0.5;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  } catch (err) {}
};

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const pathnameRef = useRef<string | null>(pathname);
  const myChatIdsRef = useRef<string[]>([]);
  const prevFriendReqCountRef = useRef(-1); 

  useEffect(() => {
    pathnameRef.current = pathname;
    if (pathname === '/notifications') setUnreadNotifCount(0);
  }, [pathname]);

  useOnlineStatus(currentUser?.id || null);

  useEffect(() => {
    loadAppData();
  }, []);

  // ✅ 1. ยุบการดึงข้อมูลทั้งหมดเหลือ 1 ครั้ง (RPC) แก้ปัญหา API Gateway คอขวด
  const loadAppData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setIsInitialLoading(false);
        return;
      }

      // เรียกฟังก์ชันเดียวจากฐานข้อมูล (ประหยัดพลังงานมาก)
      // *หมายเหตุ: ต้องรัน SQL get_user_app_data ก่อนนะครับ*
      const { data, error } = await supabase.rpc('get_user_app_data', { user_uuid: authUser.id });

      if (!error && data) {
        setCurrentUser(data.user_info);
        setUnreadNotifCount(data.unread_notifications || 0);
        setFriendRequestCount(data.pending_friends || 0);
        setUnreadMessageCount(data.unread_messages || 0);
      } else {
        // Fallback กรณี RPC มีปัญหา
        const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
        setCurrentUser(userData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  // ✅ 2. รวม Real-time Channel เป็นอันเดียวเพื่อลดภาระเครื่อง
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`nav-updates-${currentUser.id}`)
      // ดักแจ้งเตือน
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `receiver_id=eq.${currentUser.id}`
      }, (payload: any) => {
        if (payload.new.type !== 'friend_request' && pathnameRef.current !== '/notifications') {
          setUnreadNotifCount(prev => prev + 1);
          playNotificationSound();
        }
      })
      // ดักข้อความใหม่ (แชท)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, (payload: any) => {
        if (payload.new.sender_id !== currentUser.id) {
          setUnreadMessageCount(prev => prev + 1);
          if (!pathnameRef.current?.startsWith('/messages')) {
            playNotificationSound();
          }
        }
      })
      // ดักคำขอเพื่อน
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'friendships',
        filter: `receiver_id=eq.${currentUser.id}`
      }, (payload: any) => {
        if (payload.new.status === 'pending') {
          setFriendRequestCount(prev => prev + 1);
          playNotificationSound();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 fixed left-0 top-0 h-screen bg-white border-r border-gray-200 p-4">
        <div className="mb-8">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="https://iili.io/qbtgKBt.png" alt="Ribbi" className="w-10 h-10 group-hover:scale-110 transition-transform" />
            <span className="text-2xl font-black text-frog-600 tracking-tighter">Ribbi</span>
          </Link>
        </div>

        <nav className="space-y-1">
          <Link href="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <Home className="w-5 h-5" /> <span>หน้าหลัก</span>
          </Link>
          <Link href="/friends" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/friends') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <Users className="w-5 h-5" /> <span>เพื่อน</span>
            {friendRequestCount > 0 && <span className="absolute left-8 top-2 min-w-[20px] h-5 px-1.5 bg-frog-500 text-white text-[10px] rounded-full flex items-center justify-center font-black animate-in zoom-in">{friendRequestCount}</span>}
          </Link>
          <Link href="/messages" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/messages') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <MessageCircle className="w-5 h-5" /> <span>แชท</span>
            {unreadMessageCount > 0 && <span className="absolute left-8 top-2 min-w-[20px] h-5 px-1.5 bg-frog-500 text-white text-[10px] rounded-full flex items-center justify-center font-black animate-in zoom-in">{unreadMessageCount}</span>}
          </Link>
          <Link href="/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition relative ${isActive('/notifications') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <Bell className="w-5 h-5" /> <span>แจ้งเตือน</span>
            {unreadNotifCount > 0 && <span className="absolute left-8 top-2 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-black animate-in zoom-in">{unreadNotifCount}</span>}
          </Link>
          <Link href="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive('/settings') ? 'bg-frog-100 text-frog-600 font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'}`}>
            <Settings className="w-5 h-5" /> <span>ตั้งค่า</span>
          </Link>
        </nav>

        {/* ✅ แสดง Profile ส่วนล่าง */}
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          {isInitialLoading ? (
             <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-gray-200" /></div>
          ) : currentUser && (
            <>
              <Link href={`/profile/${currentUser.username}`} className={`flex items-center gap-3 p-3 transition-all rounded-2xl border ${isActive(`/profile/${currentUser.username}`) ? 'bg-frog-50 border-frog-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border-2 border-white" alt="" />
                <div className="min-w-0 flex-1"><p className="font-bold text-sm truncate">{currentUser.display_name}</p><p className="text-[10px] text-gray-400 font-bold uppercase">โปรไฟล์</p></div>
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 font-bold text-sm transition-colors"><LogOut className="w-5 h-5" /> ออกจากระบบ</button>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-2"><img src="https://iili.io/qbtgKBt.png" className="w-8 h-8" alt="" /><span className="text-xl font-black text-frog-600">Ribbi</span></Link>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="p-2 relative"><Bell className="w-6 h-6" />{unreadNotifCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-black shadow-sm">{unreadNotifCount}</span>}</Link>
          <button onClick={() => setShowMobileMenu(true)} className="p-2"><Menu className="w-6 h-6" /></button>
        </div>
      </header>

      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          {/* ✅ แสดงเนื้อหาหน้าทันที ไม่ต้องรอ Auth (เพราะแต่ละหน้ามีระบบเช็คเองอยู่แล้ว) */}
          {children}
        </div>
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-16 flex items-center justify-around z-40">
        <Link href="/" className={`flex flex-col items-center gap-1 ${isActive('/') ? 'text-frog-600' : 'text-gray-400'}`}><Home size={24} /><span className="text-[10px] font-bold">หน้าหลัก</span></Link>
        <Link href="/friends" className={`flex flex-col items-center gap-1 relative ${isActive('/friends') ? 'text-frog-600' : 'text-gray-400'}`}><Users size={24} />{friendRequestCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-frog-500 text-white text-[9px] rounded-full flex items-center justify-center font-black">{friendRequestCount}</span>}<span className="text-[10px] font-bold">เพื่อน</span></Link>
        <Link href="/messages" className={`flex flex-col items-center gap-1 relative ${isActive('/messages') ? 'text-frog-600' : 'text-gray-400'}`}><MessageCircle size={24} />{unreadMessageCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-frog-500 text-white text-[9px] rounded-full flex items-center justify-center font-black">{unreadMessageCount}</span>}<span className="text-[10px] font-bold">แชท</span></Link>
        <Link href="/settings" className={`flex flex-col items-center gap-1 ${isActive('/settings') ? 'text-frog-600' : 'text-gray-400'}`}><Settings size={24} /><span className="text-[10px] font-bold">ตั้งค่า</span></Link>
      </nav>

      {/* Mobile Side Menu */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50 animate-in fade-in" onClick={() => setShowMobileMenu(false)} />
          <aside className="fixed right-0 top-0 h-screen w-72 bg-white z-50 p-6 flex flex-col animate-in slide-in-from-right shadow-2xl">
             <div className="flex items-center justify-between mb-8"><span className="text-2xl font-black text-frog-600 tracking-tight">MENU</span><button onClick={() => setShowMobileMenu(false)}><X size={28} /></button></div>
             {currentUser && (
               <Link href={`/profile/${currentUser.username}`} onClick={() => setShowMobileMenu(false)} className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl mb-6">
                 <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-full object-cover shadow-md" alt="" />
                 <div className="min-w-0 flex-1"><p className="font-black text-gray-900 truncate">{currentUser.display_name}</p><p className="text-xs text-gray-400 font-bold uppercase tracking-widest">ดูโปรไฟล์</p></div>
               </Link>
             )}
             <nav className="space-y-2 flex-1">
               <Link href="/" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-4 px-4 py-4 rounded-2xl font-bold hover:bg-gray-50"><Home size={24}/> หน้าหลัก</Link>
               <Link href="/notifications" onClick={() => setShowMobileMenu(false)} className="flex items-center justify-between px-4 py-4 rounded-2xl font-bold hover:bg-gray-50"><div className="flex items-center gap-4"><Bell size={24}/> แจ้งเตือน</div>{unreadNotifCount > 0 && <span className="bg-red-500 text-white text-xs px-2.5 py-1 rounded-full">{unreadNotifCount}</span>}</Link>
               <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-50"><LogOut size={24}/> ออกจากระบบ</button>
             </nav>
          </aside>
        </>
      )}
    </div>
  );
}

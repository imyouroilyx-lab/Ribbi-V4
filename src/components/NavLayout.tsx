'use client';

import { useState, useEffect, useRef } from 'react';
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
  CircleUser
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const CACHE_KEY = 'ribbi_session_v_final'; // เปลี่ยนคีย์เพื่อล้างข้อมูลเก่าที่พังทิ้ง

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
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
  
  // ✅ ตรวจสอบว่าหน้าปัจจุบันคือหน้าโปรไฟล์ของตัวเองหรือไม่
  const isProfileActive = currentUser?.username ? pathname.startsWith(`/profile/${currentUser.username}`) : false;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 bg-white border-r border-gray-100 z-50 p-4">
        <div className="mb-8 px-2">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="https://iili.io/qbtgKBt.png" className="w-10 h-10 group-hover:scale-110 transition-all" alt="" />
            <span className="text-2xl font-black text-frog-600 tracking-tighter">Ribbi</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1">
          {/* เมนูหลักทั่วไป */}
          <Link href="/" className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isActive('/') ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Home size={20} strokeWidth={isActive('/') ? 3 : 2} /> <span className="text-sm">หน้าหลัก</span>
          </Link>
          <Link href="/friends" className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isActive('/friends') ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50'}`}>
            <div className="relative">
              <Users size={20} strokeWidth={isActive('/friends') ? 3 : 2} />
              {friendReq > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white font-black">{friendReq}</span>}
            </div>
            <span className="text-sm">เพื่อน</span>
          </Link>
          <Link href="/messages" className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isActive('/messages') ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50'}`}>
            <div className="relative">
              <MessageCircle size={20} strokeWidth={isActive('/messages') ? 3 : 2} />
              {unreadMsg > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white font-black">{unreadMsg}</span>}
            </div>
            <span className="text-sm">แชท</span>
          </Link>
          <Link href="/notifications" className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isActive('/notifications') ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50'}`}>
            <div className="relative">
              <Bell size={20} strokeWidth={isActive('/notifications') ? 3 : 2} />
              {unreadNotif > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white font-black">{unreadNotif}</span>}
            </div>
            <span className="text-sm">แจ้งเตือน</span>
          </Link>

          {/* ✅ ลิงก์โปรไฟล์: แยกการเขียนออกมาเพื่อการันตีว่ามันชี้ไปที่ /profile/username แน่นอน */}
          {currentUser?.username ? (
            <Link href={`/profile/${currentUser.username}`} className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isProfileActive ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50'}`}>
              <User size={20} strokeWidth={isProfileActive ? 3 : 2} /> <span className="text-sm">โปรไฟล์</span>
            </Link>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-300 opacity-50 cursor-not-allowed">
              <User size={20} /> <span className="text-sm">โปรไฟล์</span>
            </div>
          )}

          <Link href="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isActive('/settings') ? 'bg-frog-500 text-white font-bold shadow-lg shadow-frog-100' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Settings size={20} strokeWidth={isActive('/settings') ? 3 : 2} /> <span className="text-sm">ตั้งค่า</span>
          </Link>
        </nav>

        {/* ปุ่มออกจากระบบ */}
        <div className="mt-auto pt-4 border-t border-gray-100 space-y-2">
          {currentUser?.username && (
            <Link href={`/profile/${currentUser.username}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100">
              <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-9 h-9 rounded-full object-cover border border-gray-100" alt="" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs truncate text-gray-900">{currentUser.display_name}</p>
                <p className="text-[9px] text-gray-400 font-black uppercase">My Profile</p>
              </div>
            </Link>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 font-black text-xs transition-all group">
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" /> 
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Header - Mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-2">
          <img src="https://iili.io/qbtgKBt.png" className="w-8 h-8" alt="" />
          <span className="text-xl font-black text-frog-600 tracking-tighter">Ribbi</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="p-2 relative bg-gray-50 rounded-xl">
            <Bell size={24} className="text-gray-700" />
            {unreadNotif > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-black border border-white">{unreadNotif}</span>}
          </Link>
          <button onClick={() => setShowMobileMenu(true)} className="p-2 bg-gray-50 rounded-xl text-gray-700">
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-6">{children}</div>
      </main>

      {/* Bottom Nav - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-16 flex items-center justify-around z-40 pb-safe">
        <Link href="/" className={`flex flex-col items-center gap-1 flex-1 ${isActive('/') ? 'text-frog-600 font-bold' : 'text-gray-400'}`}>
          <Home size={22} strokeWidth={isActive('/') ? 3 : 2} />
          <span className="text-[10px] uppercase font-black tracking-tighter">หน้าหลัก</span>
        </Link>
        
        <Link href="/friends" className={`flex flex-col items-center gap-1 flex-1 ${isActive('/friends') ? 'text-frog-600 font-bold' : 'text-gray-400'}`}>
          <div className="relative">
            <Users size={22} strokeWidth={isActive('/friends') ? 3 : 2} />
            {friendReq > 0 && <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-black border border-white">{friendReq}</span>}
          </div>
          <span className="text-[10px] uppercase font-black tracking-tighter">เพื่อน</span>
        </Link>
        
        <Link href="/messages" className={`flex flex-col items-center gap-1 flex-1 ${isActive('/messages') ? 'text-frog-600 font-bold' : 'text-gray-400'}`}>
          <div className="relative">
            <MessageCircle size={22} strokeWidth={isActive('/messages') ? 3 : 2} />
            {unreadMsg > 0 && <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-black border border-white">{unreadMsg}</span>}
          </div>
          <span className="text-[10px] uppercase font-black tracking-tighter">แชท</span>
        </Link>
        
        {/* ✅ ปุ่มโปรไฟล์ Bottom Nav มือถือ (กดได้ชัวร์ 100%) */}
        {currentUser?.username ? (
          <Link href={`/profile/${currentUser.username}`} className={`flex flex-col items-center gap-1 flex-1 relative transition-all ${isProfileActive ? 'text-frog-600 font-bold scale-105' : 'text-gray-400'}`}>
            <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className={`w-6 h-6 rounded-full object-cover border-2 ${isProfileActive ? 'border-frog-500' : 'border-transparent'}`} alt="" />
            <span className="text-[10px] uppercase font-black tracking-tighter">โปรไฟล์</span>
          </Link>
        ) : (
          <div className="flex flex-col items-center gap-1 flex-1 relative text-gray-300 opacity-50 cursor-not-allowed">
            <CircleUser size={22} strokeWidth={2} />
            <span className="text-[10px] uppercase font-black tracking-tighter">โปรไฟล์</span>
          </div>
        )}
      </nav>

      {/* Mobile Drawer */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowMobileMenu(false)} />
          <aside className="fixed right-0 top-0 h-full w-80 bg-white z-50 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
            <div className="p-6 flex items-center justify-between border-b border-gray-50">
              <span className="text-xl font-black text-frog-600 uppercase">MENU</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 bg-gray-50 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {currentUser?.username && (
                <Link href={`/profile/${currentUser.username}`} onClick={() => setShowMobileMenu(false)} className="flex items-center gap-4 p-5 bg-gray-50 rounded-3xl mb-4">
                  <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white" alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-900 truncate text-lg">{currentUser.display_name}</p>
                    <p className="text-xs text-gray-400 font-bold uppercase">ดูโปรไฟล์</p>
                  </div>
                </Link>
              )}

              <Link href="/" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-4 p-4 rounded-2xl font-black text-gray-700 hover:bg-gray-50">
                <Home size={24} className="text-gray-300" /><span>หน้าหลัก</span>
              </Link>
              <Link href="/friends" onClick={() => setShowMobileMenu(false)} className="flex items-center justify-between p-4 rounded-2xl font-black text-gray-700 hover:bg-gray-50">
                <div className="flex items-center gap-4"><Users size={24} className="text-gray-300" /><span>เพื่อน</span></div>
                {friendReq > 0 && <span className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black shadow-sm">{friendReq}</span>}
              </Link>
              <Link href="/messages" onClick={() => setShowMobileMenu(false)} className="flex items-center justify-between p-4 rounded-2xl font-black text-gray-700 hover:bg-gray-50">
                <div className="flex items-center gap-4"><MessageCircle size={24} className="text-gray-300" /><span>แชท</span></div>
                {unreadMsg > 0 && <span className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black shadow-sm">{unreadMsg}</span>}
              </Link>
              <Link href="/notifications" onClick={() => setShowMobileMenu(false)} className="flex items-center justify-between p-4 rounded-2xl font-black text-gray-700 hover:bg-gray-50">
                <div className="flex items-center gap-4"><Bell size={24} className="text-gray-300" /><span>แจ้งเตือน</span></div>
                {unreadNotif > 0 && <span className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black shadow-sm">{unreadNotif}</span>}
              </Link>

              {/* ✅ โปรไฟล์ในเมนูมือถือ */}
              {currentUser?.username && (
                <Link href={`/profile/${currentUser.username}`} onClick={() => setShowMobileMenu(false)} className="flex items-center gap-4 p-4 rounded-2xl font-black text-gray-700 hover:bg-gray-50">
                  <User size={24} className="text-gray-300" /><span>โปรไฟล์</span>
                </Link>
              )}

              <Link href="/settings" onClick={() => setShowMobileMenu(false)} className="flex items-center gap-4 p-4 rounded-2xl font-black text-gray-700 hover:bg-gray-50">
                <Settings size={24} className="text-gray-300" /><span>ตั้งค่า</span>
              </Link>
            </div>

            <div className="p-6 border-t border-gray-100">
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm active:scale-95 transition-all">
                <LogOut size={20}/> <span>ออกจากระบบ</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

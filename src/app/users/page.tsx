'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { 
  Search, 
  Users, 
  ChevronRight, 
  AtSign, 
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Filter
} from 'lucide-react';

const USERS_PER_PAGE = 20;

// แถบตัวอักษรสำหรับกรอง
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const THAI_ALPHABETS = "กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ".split("");

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    checkAuthAndFetchUsers();
  }, []);

  const checkAuthAndFetchUsers = async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        router.push('/login');
        return;
      }
      
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // ดึงข้อมูลแบบจำกัดคอลัมน์เพื่อความเร็ว เรียงตามชื่อ A-Z
      const { data, error: supabaseError } = await supabase
        .from('users')
        .select('id, username, display_name, profile_img_url, created_at')
        .order('display_name', { ascending: true });

      if (supabaseError) throw supabaseError;
      setUsers((data as any) || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ระบบกรองข้อมูล (Search + Alphabet Filter)
  const filteredUsers = useMemo(() => {
    let result = users;

    // 1. กรองตามตัวอักษรที่เลือก
    if (selectedLetter) {
      result = result.filter(user => 
        user.display_name?.toUpperCase().startsWith(selectedLetter)
      );
    }

    // 2. กรองตามคำค้นหา
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(user => 
        user.display_name?.toLowerCase().includes(search) || 
        user.username?.toLowerCase().includes(search)
      );
    }

    return result;
  }, [users, searchTerm, selectedLetter]);

  // คำนวณ Pagination
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const currentUsers = useMemo(() => {
    const start = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // รีเซ็ตหน้าไปที่ 1 เมื่อมีการค้นหาหรือเปลี่ยนตัวกรอง
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLetter]);

  const handleViewProfile = (username: string) => {
    if (!username) return;
    router.push(`/profile/${username}`);
  };

  if (loading) {
    return (
      <NavLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <Users className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
          </div>
          <p className="mt-4 text-slate-500 font-medium animate-pulse">กำลังโหลดข้อมูลสมาชิก...</p>
        </div>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20">
        {/* Header Section */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider">
                  <Sparkles size={16} />
                  <span>Member Directory</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">ทำความรู้จักสมาชิก</h1>
                <p className="text-slate-500 text-sm">เรียงตามลำดับตัวอักษร A-Z</p>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="ค้นหาด้วยชื่อ หรือ username..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-100 border-transparent border focus:border-indigo-500 focus:bg-white rounded-2xl focus:outline-none transition-all text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Alphabet Filter Bar */}
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <Filter size={12} /> กรองตามตัวอักษร
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button 
                  onClick={() => setSelectedLetter(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!selectedLetter ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  ทั้งหมด
                </button>
                {ALPHABETS.map(letter => (
                  <button 
                    key={letter}
                    onClick={() => setSelectedLetter(letter)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${selectedLetter === letter ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1 overflow-x-auto pb-2 no-scrollbar">
                {THAI_ALPHABETS.map(letter => (
                  <button 
                    key={letter}
                    onClick={() => setSelectedLetter(letter)}
                    className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${selectedLetter === letter ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-4 mt-8">
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} />
              <span>พบสมาชิก {filteredUsers.length} คน {selectedLetter && `(ขึ้นต้นด้วย ${selectedLetter})`}</span>
            </div>
          </div>

          {currentUsers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentUsers.map((user) => (
                <div 
                  key={user.id}
                  onClick={() => handleViewProfile(user.username || '')}
                  className="group bg-white border border-slate-200 rounded-3xl p-4 flex items-center gap-4 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-50 group-hover:border-indigo-100 transition-colors">
                      <img 
                        src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} 
                        alt={user.display_name} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${user.display_name}&background=random`;
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                      {user.display_name}
                    </h3>
                    <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                      <AtSign size={12} className="text-indigo-400" />
                      <span className="truncate">{user.username}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-2 font-medium">
                      <Calendar size={10} />
                      {new Date(user.created_at).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 text-slate-300 transition-all">
                    <ChevronRight size={18} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
              <Search size={32} className="text-slate-300 mx-auto mb-4" />
              <h3 className="font-bold text-slate-800">ไม่พบสมาชิกที่คุณค้นหา</h3>
              <button onClick={() => {setSearchTerm(''); setSelectedLetter(null);}} className="mt-4 text-indigo-600 text-sm font-bold hover:underline">ล้างการกรองทั้งหมด</button>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  // แสดงแค่หน้าแรก หน้าสุดท้าย และหน้าใกล้ๆ ปัจจุบัน
                  if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all shadow-sm ${currentPage === pageNum ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                    return <span key={pageNum} className="px-1 text-slate-400">...</span>;
                  }
                  return null;
                })}
              </div>

              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <ChevronRightIcon size={20} />
              </button>
            </div>
          )}
        </main>
      </div>
    </NavLayout>
  );
}

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
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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
      const { data, error: supabaseError } = await supabase
        .from('users')
        .select('id, username, display_name, profile_img_url, created_at')
        .order('display_name', { ascending: true }); // เรียง A-Z จากฐานข้อมูล

      if (supabaseError) throw supabaseError;
      setUsers((data as any) || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ระบบกรองข้อมูล (Search + Alphabet Filter)
  const filteredUsers = useMemo(() => {
    let result = users;

    if (selectedLetter) {
      result = result.filter(user => 
        user.display_name?.toUpperCase().startsWith(selectedLetter)
      );
    }

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
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="mt-4 text-slate-500 font-medium">กำลังโหลดรายชื่อสมาชิก...</p>
        </div>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="min-h-screen bg-[#F8FAFC] pb-20">
        {/* Header Section - ปรับให้กระชับขึ้น */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Users className="text-indigo-600" size={24} />
                  สมาชิก Ribbi
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">ค้นพบเพื่อนใหม่และทำความรู้จักกัน</p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="ค้นหาชื่อ..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent border focus:border-indigo-500 focus:bg-white rounded-xl focus:outline-none transition-all text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Alphabet Filter Bar - ปรับให้เล็กลงและเลื่อนได้ */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                <Filter size={12} /> A-Z
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar items-center">
                <button 
                  onClick={() => setSelectedLetter(null)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${!selectedLetter ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  ทั้งหมด
                </button>
                {ALPHABETS.map(letter => (
                  <button 
                    key={letter}
                    onClick={() => setSelectedLetter(letter)}
                    className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${selectedLetter === letter ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-4 mt-6">
          <div className="mb-4 px-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              พบ {filteredUsers.length} รายการ {selectedLetter && `ที่ขึ้นต้นด้วย "${selectedLetter}"`}
            </span>
          </div>

          {currentUsers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
              {currentUsers.map((user) => (
                <div 
                  key={user.id}
                  onClick={() => handleViewProfile(user.username || '')}
                  className="group bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                    <img 
                      src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} 
                      alt={user.display_name} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 truncate">
                      {user.display_name}
                    </h3>
                    <p className="text-[10px] text-slate-500 truncate">@{user.username}</p>
                  </div>

                  <div className="text-slate-300 group-hover:text-indigo-600 transition-colors">
                    <ChevronRight size={18} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-slate-400 text-sm">ไม่พบสมาชิกที่ตรงตามเงื่อนไข</p>
              <button onClick={() => {setSearchTerm(''); setSelectedLetter(null);}} className="mt-2 text-indigo-600 text-xs font-bold hover:underline">ล้างการกรอง</button>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-1.5">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                    return <span key={pageNum} className="text-slate-400 px-1">...</span>;
                  }
                  return null;
                })}
              </div>

              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm"
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>
          )}
        </main>
      </div>
    </NavLayout>
  );
}

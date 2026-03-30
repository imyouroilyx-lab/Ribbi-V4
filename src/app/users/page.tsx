import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Users, 
  ChevronRight, 
  AtSign, 
  Calendar,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react';

/**
 * หน้าแสดงรายการสมาชิก (Member Directory)
 * เน้นการค้นหาและกดเข้าไปดูโปรไฟล์รายบุคคล
 */

// จำลอง Supabase Client (ในระบบจริงจะ import จาก @/lib/supabase)
const mockUsers = [
  { id: '1', username: 'alex_knight', display_name: 'Alex Knight', profile_img_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', created_at: '2024-01-15T08:00:00Z' },
  { id: '2', username: 'sarah_j', display_name: 'Sarah Jenkins', profile_img_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', created_at: '2024-02-10T10:30:00Z' },
  { id: '3', username: 'm_somsak', display_name: 'Somsak Meedee', profile_img_url: '', created_at: '2024-03-05T14:20:00Z' },
  { id: '4', username: 'jane_doe', display_name: 'Jane Doe', profile_img_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane', created_at: '2024-03-20T09:15:00Z' },
];

export default function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // จำลองการโหลดข้อมูล
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // ในระบบจริง: const { data } = await supabase.from('users').select('*');
        setTimeout(() => {
          setUsers(mockUsers);
          setLoading(false);
        }, 800);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const search = searchTerm.toLowerCase();
      return (
        (user.display_name?.toLowerCase().includes(search)) ||
        (user.username?.toLowerCase().includes(search))
      );
    });
  }, [users, searchTerm]);

  const handleViewProfile = (username) => {
    // ใน Next.js จะใช้: router.push(`/profile/${username}`)
    console.log(`Navigating to /profile/${username}`);
    // แสดง Feedback ว่ามีการคลิก
    window.parent.postMessage({ type: 'navigation', path: `/profile/${username}` }, '*');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <Users className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
        </div>
        <p className="mt-4 text-slate-500 font-medium animate-pulse">กำลังเตรียมรายชื่อเพื่อนๆ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider">
                <Sparkles size={16} />
                <span>Our Community</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">ทำความรู้จักสมาชิก</h1>
              <p className="text-slate-500">พบปะและเชื่อมต่อกับผู้คนในคอมมูนิตี้ของเรา</p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="ค้นหาชื่อเพื่อน หรือ username..."
                className="w-full pl-11 pr-4 py-3 bg-slate-100 border-transparent border focus:border-indigo-500 focus:bg-white rounded-2xl focus:outline-none transition-all shadow-inner text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 mt-8">
        {error ? (
          <div className="bg-white p-12 rounded-3xl border border-red-100 shadow-sm text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h3 className="text-lg font-bold text-slate-800">ขออภัย เกิดข้อผิดพลาด</h3>
            <p className="text-slate-500 mt-2">{error}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Users size={14} />
                <span>ผลการค้นหา {filteredUsers.length} คน</span>
              </div>
            </div>

            {filteredUsers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {filteredUsers.map((user) => (
                  <div 
                    key={user.id}
                    onClick={() => handleViewProfile(user.username)}
                    className="group bg-white border border-slate-200 rounded-3xl p-5 flex items-center gap-4 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-50 group-hover:border-indigo-100 transition-colors shadow-sm">
                        {user.profile_img_url ? (
                          <img src={user.profile_img_url} alt={user.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 font-bold text-xl uppercase">
                            {user.display_name?.charAt(0) || user.username?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full"></div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                        {user.display_name || 'Anonymous User'}
                      </h3>
                      <div className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                        <AtSign size={12} className="text-indigo-400" />
                        <span className="font-medium truncate">{user.username}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-2 font-medium uppercase tracking-tighter">
                        <Calendar size={10} />
                        Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                    </div>

                    {/* Action Icon */}
                    <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 text-slate-300 transition-all">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={32} className="text-slate-300" />
                </div>
                <h3 className="font-bold text-slate-800">ไม่พบสมาชิกที่ต้องการ</h3>
                <p className="text-slate-500 text-sm mt-1">ลองใช้คำค้นหาอื่นดูสิ</p>
                <button 
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-indigo-600 text-sm font-bold hover:underline"
                >
                  ล้างการค้นหา
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Welcome (Optional Decor) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-sm font-semibold whitespace-nowrap md:hidden">
        <Users size={16} className="text-indigo-400" />
        <span>เลือกชมโปรไฟล์ที่น่าสนใจ</span>
      </div>
    </div>
  );
}

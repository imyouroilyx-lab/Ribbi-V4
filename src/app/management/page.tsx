'use client';

import React, { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { 
  ShieldAlert, 
  Lock, 
  Users, 
  Edit, 
  Save, 
  X,
  Search,
  Loader2,
  Trash2,
  Image as ImageIcon,
  Monitor,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// นำเข้า Server Actions
import { forceResetUserPassword, updateUserProfile, deleteUserAccount } from '@/lib/adminActions';

const ADMIN_SECRET_PASSWORD = 'themostfunwebsiteinthailand';
const USERS_PER_PAGE = 20;

export default function ManagementPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ 
    display_name: '', 
    username: '', 
    profile_img_url: '', 
    cover_img_url: '' 
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const checkLogin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
    };
    checkLogin();
  }, [router]);

  // โหลดข้อมูลเมื่อได้รับสิทธิ์ หรือเมื่อเปลี่ยนหน้า/ค้นหา
  useEffect(() => {
    if (isAuthorized) {
      fetchUsers();
    }
  }, [isAuthorized, currentPage, searchTerm]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_SECRET_PASSWORD) {
      setIsAuthorized(true);
      setAuthError('');
    } else {
      setAuthError('รหัสผ่านแอดมินไม่ถูกต้อง');
      setPasswordInput('');
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    const from = (currentPage - 1) * USERS_PER_PAGE;
    const to = from + USERS_PER_PAGE - 1;

    try {
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      // ระบบค้นหา
      if (searchTerm) {
        query = query.or(`display_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // ✅ เรียงลำดับ A-Z และทำ Pagination
      const { data, error, count } = await query
        .order('display_name', { ascending: true })
        .range(from, to);

      if (error) throw error;
      setUsers(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error(err);
      alert('ไม่สามารถดึงข้อมูลสมาชิกได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // จัดการการค้นหา (Reset กลับหน้า 1 เสมอเมื่อเริ่มค้นหาใหม่)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const startEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({
      display_name: user.display_name || '',
      username: user.username || '',
      profile_img_url: user.profile_img_url || '',
      cover_img_url: user.cover_img_url || ''
    });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditForm({ display_name: '', username: '', profile_img_url: '', cover_img_url: '' });
  };

  const saveEdit = async (userId: string) => {
    setIsSaving(true);
    const result = await updateUserProfile(
      userId, 
      editForm.display_name, 
      editForm.username,
      editForm.profile_img_url,
      editForm.cover_img_url
    );

    if (result.success) {
      setUsers(users.map(u => 
        u.id === userId 
          ? { 
              ...u, 
              display_name: editForm.display_name, 
              username: editForm.username,
              profile_img_url: editForm.profile_img_url,
              cover_img_url: editForm.cover_img_url
            } 
          : u
      ));
      setEditingUserId(null);
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + result.message);
    }
    setIsSaving(false);
  };

  const handleResetPassword = async (userId: string, displayName: string) => {
    const newPassword = prompt(`ตั้งรหัสผ่านใหม่ให้กับ ${displayName}:\n(ต้องมีความยาวอย่างน้อย 6 ตัวอักษร)`);
    if (!newPassword) return; 
    if (newPassword.length < 6) {
      alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรครับ');
      return;
    }
    const confirmReset = confirm(`คุณแน่ใจไหมว่าจะเปลี่ยนรหัสผ่านให้ ${displayName} เป็น "${newPassword}" ?`);
    if (!confirmReset) return;
    const result = await forceResetUserPassword(userId, newPassword);
    if (result.success) {
      alert('เปลี่ยนรหัสผ่านสำเร็จ!');
    } else {
      alert('เกิดข้อผิดพลาด: ' + result.message);
    }
  };

  const handleDeleteUser = async (userId: string, displayName: string) => {
    const confirmDelete = confirm(`⚠️ คำเตือนอันตราย!\nคุณกำลังจะลบบัญชีของ "${displayName}" ออกจากระบบถาวร\nพิมพ์ "ยืนยัน" เพื่อลบผู้ใช้นี้`);
    if (confirmDelete) {
      const result = await deleteUserAccount(userId);
      if (result.success) {
        setUsers(users.filter(u => u.id !== userId));
        alert('ลบผู้ใช้ออกเรียบร้อยแล้ว');
      } else {
        alert('เกิดข้อผิดพลาด: ' + result.message);
      }
    }
  };

  const totalPages = Math.ceil(totalCount / USERS_PER_PAGE);

  if (!isAuthorized) {
    return (
      <NavLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
          <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <ShieldAlert size={40} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Admin Access</h1>
            <p className="text-gray-500 mb-8 text-sm">กรุณากรอกรหัสผ่านเพื่อจัดการข้อมูลสมาชิก</p>
            
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="รหัสผ่านแอดมิน..."
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                />
              </div>
              {authError && <p className="text-red-500 text-xs font-bold uppercase tracking-widest">{authError}</p>}
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95"
              >
                ยืนยันตัวตน
              </button>
            </form>
          </div>
        </div>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3 text-slate-900 tracking-tight">
              <Users className="text-indigo-600" size={32} />
              User Management
            </h1>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">
              Total {totalCount} accounts · Sorted A-Z
            </p>
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="ค้นหาชื่อ, username, email..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400 uppercase tracking-widest text-[10px] font-black">
                <tr>
                  <th className="px-6 py-5">อวตาร์/ปก</th>
                  <th className="px-6 py-5">ชื่อแสดงผล</th>
                  <th className="px-6 py-5">Username / Email</th>
                  <th className="px-6 py-5 text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
                      <p className="text-gray-400 font-bold uppercase tracking-tighter">Fetching data...</p>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-gray-400 font-bold italic">
                      {searchTerm ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีผู้ใช้ในระบบ'}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-indigo-50/10 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img 
                              src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} 
                              className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm"
                              alt=""
                            />
                            {user.cover_img_url && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-lg shadow-md flex items-center justify-center overflow-hidden">
                                <img src={user.cover_img_url} className="w-full h-full object-cover opacity-50" />
                              </div>
                            )}
                          </div>
                          <div className="hidden xl:block">
                            <div className="flex items-center gap-1 text-[9px] font-black text-slate-300 uppercase">
                              <ImageIcon size={10} /> Profile {user.profile_img_url ? '✅' : '❌'}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] font-black text-slate-300 uppercase">
                              <Monitor size={10} /> Cover {user.cover_img_url ? '✅' : '❌'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {editingUserId === user.id ? (
                        <>
                          <td className="px-6 py-4">
                            <div className="space-y-2 min-w-[200px]">
                              <input 
                                type="text" 
                                value={editForm.display_name}
                                onChange={(e) => setEditForm({...editForm, display_name: e.target.value})}
                                placeholder="Display Name"
                                className="w-full px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                              />
                              <input 
                                type="text" 
                                value={editForm.profile_img_url}
                                onChange={(e) => setEditForm({...editForm, profile_img_url: e.target.value})}
                                placeholder="Profile Image URL"
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px]"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2 min-w-[200px]">
                              <input 
                                type="text" 
                                value={editForm.username}
                                onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                                placeholder="Username"
                                className="w-full px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                              />
                              <input 
                                type="text" 
                                value={editForm.cover_img_url}
                                onChange={(e) => setEditForm({...editForm, cover_img_url: e.target.value})}
                                placeholder="Cover Image URL"
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px]"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <button onClick={() => saveEdit(user.id)} disabled={isSaving} className="w-full py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2 font-bold transition-all active:scale-95">
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                บันทึก
                              </button>
                              <button onClick={cancelEdit} disabled={isSaving} className="w-full py-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors font-bold text-xs">
                                ยกเลิก
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4">
                            <p className="font-black text-slate-900 text-base leading-tight">{user.display_name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-1">JOINED: {new Date(user.created_at || '').toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-indigo-600">@{user.username}</p>
                            <p className="text-xs text-gray-400 font-medium truncate max-w-[200px]">{user.email}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEdit(user)} className="p-2.5 bg-white border border-gray-100 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-90" title="แก้ไข">
                                <Edit size={16} />
                              </button>
                              <button onClick={() => handleResetPassword(user.id, user.display_name || 'สมาชิก')} className="p-2.5 bg-white border border-gray-100 text-slate-600 rounded-xl hover:bg-amber-50 hover:text-amber-600 hover:border-amber-100 transition-all shadow-sm active:scale-90" title="รีเซ็ตรหัสผ่าน">
                                <Lock size={16} />
                              </button>
                              <button onClick={() => handleDeleteUser(user.id, user.display_name || 'สมาชิก')} className="p-2.5 bg-white border border-gray-100 text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all shadow-sm active:scale-90" title="ลบผู้ใช้">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4">
            <button 
              disabled={currentPage === 1} 
              onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="p-3 bg-white border border-gray-100 rounded-2xl disabled:opacity-20 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="bg-white border border-gray-100 px-6 py-2.5 rounded-2xl shadow-sm">
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">
                PAGE <span className="text-indigo-600">{currentPage}</span> OF {totalPages}
              </p>
            </div>

            <button 
              disabled={currentPage === totalPages} 
              onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="p-3 bg-white border border-gray-100 rounded-2xl disabled:opacity-20 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </NavLayout>
  );
}

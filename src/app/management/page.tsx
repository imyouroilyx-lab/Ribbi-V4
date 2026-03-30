'use client';

import React, { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout'; // ปรับ Path ให้ตรงกับโฟลเดอร์ของคุณ
import { 
  ShieldAlert, 
  Lock, 
  Users, 
  Edit, 
  Save, 
  X,
  Search,
  Loader2,
  Trash2
} from 'lucide-react';

// นำเข้า Server Actions ที่เราสร้างไว้
import { forceResetUserPassword, updateUserProfile, deleteUserAccount } from '@/lib/adminActions';

// กำหนดรหัสผ่านแอดมินที่นี่
const ADMIN_SECRET_PASSWORD = 'themostfunwebsiteinthailand';

export default function ManagementPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ display_name: '', username: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const checkLogin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
    };
    checkLogin();
  }, [router]);

  useEffect(() => {
    if (isAuthorized) {
      fetchUsers();
    }
  }, [isAuthorized]);

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
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error(err);
      alert('ไม่สามารถดึงข้อมูลสมาชิกได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- การจัดการโปรไฟล์ ---
  const startEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({
      display_name: user.display_name || '',
      username: user.username || ''
    });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditForm({ display_name: '', username: '' });
  };

  const saveEdit = async (userId: string) => {
    setIsSaving(true);
    // เรียกใช้ Server Action
    const result = await updateUserProfile(userId, editForm.display_name, editForm.username);

    if (result.success) {
      setUsers(users.map(u => 
        u.id === userId 
          ? { ...u, display_name: editForm.display_name, username: editForm.username } 
          : u
      ));
      setEditingUserId(null);
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + result.message);
    }
    setIsSaving(false);
  };

  // --- การเปลี่ยนรหัสผ่าน ---
  const handleResetPassword = async (userId: string, displayName: string) => {
    const newPassword = prompt(`ตั้งรหัสผ่านใหม่ให้กับ ${displayName}:\n(ต้องมีความยาวอย่างน้อย 6 ตัวอักษร)`);
    
    if (!newPassword) return; 
    if (newPassword.length < 6) {
      alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรครับ');
      return;
    }

    const confirmReset = confirm(`คุณแน่ใจไหมว่าจะเปลี่ยนรหัสผ่านให้ ${displayName} เป็น "${newPassword}" ?`);
    if (!confirmReset) return;

    // เรียกใช้ Server Action
    const result = await forceResetUserPassword(userId, newPassword);
    
    if (result.success) {
      alert('เปลี่ยนรหัสผ่านสำเร็จ! แจ้งผู้ใช้ให้ล็อกอินด้วยรหัสผ่านใหม่ได้เลย');
    } else {
      alert('เกิดข้อผิดพลาด: ' + result.message);
    }
  };

  // --- การลบผู้ใช้ ---
  const handleDeleteUser = async (userId: string, displayName: string) => {
    const confirmDelete = confirm(`เตือนภัยอันตราย! ⚠️\n\nคุณกำลังจะลบบัญชีของ "${displayName}" ออกจากระบบถาวร\nข้อมูลโพสต์และคอมเมนต์ของเขาอาจจะถูกลบไปด้วย\n\nพิมพ์ "ยืนยัน" เพื่อลบผู้ใช้นี้ (ไม่สามารถกู้คืนได้)`);
    
    // ป้องกันการกดพลาด
    if (confirmDelete) {
      const result = await deleteUserAccount(userId);
      if (result.success) {
        setUsers(users.filter(u => u.id !== userId));
        alert('ลบผู้ใช้ออกจากระบบเรียบร้อยแล้ว');
      } else {
        alert('เกิดข้อผิดพลาด: ' + result.message);
      }
    }
  };

  const filteredUsers = users.filter(user => 
    (user.display_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // ---------------------------------------------------------
  // หน้ากรอกรหัสผ่าน (แสดงเมื่อยังไม่ได้ยืนยันตัวตน)
  // ---------------------------------------------------------
  if (!isAuthorized) {
    return (
      <NavLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-soft border border-gray-100 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={32} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">พื้นที่สำหรับผู้ดูแลระบบ</h1>
            <p className="text-gray-500 mb-8">กรุณากรอกรหัสผ่านแอดมินเพื่อเข้าถึงข้อมูลสมาชิกทั้งหมด</p>
            
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="รหัสผ่านแอดมิน..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>
              {authError && <p className="text-red-500 text-sm font-medium">{authError}</p>}
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
              >
                ยืนยันตัวตน
              </button>
            </form>
          </div>
        </div>
      </NavLayout>
    );
  }

  // ---------------------------------------------------------
  // หน้าจัดการข้อมูล (แสดงเมื่อยืนยันตัวตนผ่านแล้ว)
  // ---------------------------------------------------------
  return (
    <NavLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <Users className="text-indigo-600" />
              จัดการข้อมูลสมาชิก
            </h1>
            <p className="text-gray-500 mt-1">ทั้งหมด {users.length} บัญชีในระบบ</p>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="ค้นหาชื่อ, username, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">โปรไฟล์</th>
                  <th className="px-6 py-4 font-semibold">Display Name</th>
                  <th className="px-6 py-4 font-semibold">Username</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                      <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">ไม่พบข้อมูลสมาชิก</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <img 
                          src={user.profile_img_url || `https://ui-avatars.com/api/?name=${user.display_name}&background=random`} 
                          alt="Avatar" 
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                      </td>

                      {/* กรณีที่กำลังถูก Edit อยู่ จะแสดงเป็น Input */}
                      {editingUserId === user.id ? (
                        <>
                          <td className="px-6 py-4">
                            <input 
                              type="text" 
                              value={editForm.display_name}
                              onChange={(e) => setEditForm({...editForm, display_name: e.target.value})}
                              className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input 
                              type="text" 
                              value={editForm.username}
                              onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                              className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-6 py-4 text-gray-500">{user.email || '-'}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => saveEdit(user.id)} disabled={isSaving} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                              </button>
                              <button onClick={cancelEdit} disabled={isSaving} className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        /* กรณีดูข้อมูลปกติ */
                        <>
                          <td className="px-6 py-4 font-medium text-gray-900">{user.display_name}</td>
                          <td className="px-6 py-4 text-gray-500">@{user.username}</td>
                          <td className="px-6 py-4 text-gray-500">{user.email || '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* ปุ่มแก้ไข */}
                              <button 
                                onClick={() => startEdit(user)}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                                title="แก้ไขชื่อ/Username"
                              >
                                <Edit size={16} />
                              </button>
                              
                              {/* ปุ่มรีเซ็ตรหัสผ่าน */}
                              <button 
                                onClick={() => handleResetPassword(user.id, user.display_name || 'สมาชิก')}
                                className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                                title="เปลี่ยนรหัสผ่าน"
                              >
                                <Lock size={16} />
                              </button>

                              {/* ปุ่มลบผู้ใช้ */}
                              <button 
                                onClick={() => handleDeleteUser(user.id, user.display_name || 'สมาชิก')}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                title="ลบบัญชีผู้ใช้"
                              >
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
      </div>
    </NavLayout>
  );
}
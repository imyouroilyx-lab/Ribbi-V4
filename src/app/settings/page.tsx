'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { Settings, User as UserIcon, Bell, Shield, Trash2, Lock, Edit2, AtSign, CheckCircle, AlertCircle, Copyright } from 'lucide-react';

/**
 * SettingsPage Component
 * หน้าตั้งค่าสำหรับผู้ใช้งาน โดยมีการเพิ่มส่วนประกาศลิขสิทธิ์และข้อความลับท้ายหน้า
 */
export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit modals state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);

  // Form states
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [usernameForm, setUsernameForm] = useState({
    currentPassword: '',
    newUsername: '',
  });
  const [displayNameForm, setDisplayNameForm] = useState({
    currentPassword: '',
    newDisplayName: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    setCurrentUser(userData);
    setIsLoading(false);
  };

  // ฟังก์ชันตรวจสอบรหัสผ่านปัจจุบัน
  const verifyCurrentPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return !error;
  };

  // จัดการการเปลี่ยนรหัสผ่าน
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (passwordForm.newPassword.length < 6) {
        setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setError('รหัสผ่านใหม่ไม่ตรงกัน');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError('ไม่พบข้อมูลผู้ใช้');
        return;
      }

      const isValid = await verifyCurrentPassword(user.email, passwordForm.currentPassword);
      if (!isValid) {
        setError('รหัสผ่านปัจจุบันไม่ถูกต้อง');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) throw updateError;

      setSuccess('เปลี่ยนรหัสผ่านสำเร็จ!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      setTimeout(() => {
        setShowPasswordModal(false);
        setSuccess('');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  // จัดการการเปลี่ยน Username
  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (!/^[a-zA-Z0-9_]+$/.test(usernameForm.newUsername)) {
        setError('Username ต้องเป็น a-z, 0-9, _ เท่านั้น');
        return;
      }
      if (usernameForm.newUsername.length < 3) {
        setError('Username ต้องมีอย่างน้อย 3 ตัวอักษร');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError('ไม่พบข้อมูลผู้ใช้');
        return;
      }

      const isValid = await verifyCurrentPassword(user.email, usernameForm.currentPassword);
      if (!isValid) {
        setError('รหัสผ่านไม่ถูกต้อง');
        return;
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', usernameForm.newUsername.toLowerCase())
        .neq('id', user.id)
        .maybeSingle();

      if (existingUser) {
        setError('Username นี้ถูกใช้แล้ว');
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ username: usernameForm.newUsername.toLowerCase() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess('เปลี่ยน Username สำเร็จ!');
      setUsernameForm({ currentPassword: '', newUsername: '' });
      await loadUser();
      
      setTimeout(() => {
        setShowUsernameModal(false);
        setSuccess('');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  // จัดการการเปลี่ยน Display Name
  const handleChangeDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (!displayNameForm.newDisplayName.trim()) {
        setError('กรุณากรอกชื่อที่แสดง');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError('ไม่พบข้อมูลผู้ใช้');
        return;
      }

      const isValid = await verifyCurrentPassword(user.email, displayNameForm.currentPassword);
      if (!isValid) {
        setError('รหัสผ่านไม่ถูกต้อง');
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ display_name: displayNameForm.newDisplayName.trim() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess('เปลี่ยนชื่อที่แสดงสำเร็จ!');
      setDisplayNameForm({ currentPassword: '', newDisplayName: '' });
      await loadUser();
      
      setTimeout(() => {
        setShowDisplayNameModal(false);
        setSuccess('');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('ต้องการลบบัญชีถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;
    if (!confirm('แน่ใจหรือไม่? ข้อมูลทั้งหมดจะถูกลบ!')) return;
    alert('ฟีเจอร์นี้ยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  };

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <img 
            src="https://iili.io/qbtgKBt.png"
            alt="Loading"
            className="w-16 h-16 animate-bounce"
          />
        </div>
      </NavLayout>
    );
  }

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4 pb-12">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3 text-slate-800">
          <Settings className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
          ตั้งค่า
        </h1>

        <div className="space-y-4">
          {/* Account Section */}
          <div className="card-minimal bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg md:text-xl font-black mb-6 flex items-center gap-2 text-slate-800">
              <UserIcon className="w-5 h-5 text-indigo-500" />
              บัญชี
            </h2>
            
            <div className="space-y-3">
              {/* Change Password */}
              <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group">
                <div className="flex-1">
                  <p className="font-bold flex items-center gap-2 text-slate-700">
                    <Lock className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    เปลี่ยนรหัสผ่าน
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">อัปเดตรหัสผ่านเพื่อความปลอดภัย</p>
                </div>
                <button onClick={() => setShowPasswordModal(true)} className="px-5 py-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95">
                  แก้ไข
                </button>
              </div>

              {/* Change Username */}
              <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group">
                <div className="flex-1">
                  <p className="font-bold flex items-center gap-2 text-slate-700">
                    <AtSign className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    Username
                  </p>
                  <p className="text-sm text-indigo-500 font-black mt-0.5">@{currentUser.username}</p>
                </div>
                <button onClick={() => { setUsernameForm({ ...usernameForm, newUsername: currentUser.username }); setShowUsernameModal(true); }} className="px-5 py-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95">
                  แก้ไข
                </button>
              </div>

              {/* Change Display Name */}
              <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group">
                <div className="flex-1">
                  <p className="font-bold flex items-center gap-2 text-slate-700">
                    <Edit2 className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    ชื่อที่แสดง
                  </p>
                  <p className="text-sm text-slate-600 font-medium mt-0.5">{currentUser.display_name}</p>
                </div>
                <button onClick={() => { setDisplayNameForm({ ...displayNameForm, newDisplayName: currentUser.display_name }); setShowDisplayNameModal(true); }} className="px-5 py-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95">
                  แก้ไข
                </button>
              </div>

              {/* Edit Profile */}
              <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group">
                <div className="flex-1">
                  <p className="font-bold text-slate-700">ข้อมูลโปรไฟล์</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">รูปภาพประจำตัว และประวัติส่วนตัว</p>
                </div>
                <button onClick={() => router.push('/profile/edit')} className="px-5 py-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95">
                  แก้ไข
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card-minimal bg-white rounded-3xl p-6 shadow-sm border-2 border-red-100">
            <h2 className="text-lg md:text-xl font-black mb-6 flex items-center gap-2 text-red-600 uppercase tracking-tighter">
              <Trash2 className="w-5 h-5 animate-pulse" />
              Danger Zone
            </h2>
            <button onClick={handleDeleteAccount} className="w-full p-4 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-2xl font-black transition-all shadow-sm active:scale-[0.98]">
              ลบบัญชีถาวร
            </button>
          </div>

          {/* Copyright & Branding Section */}
          <div className="mt-12 mb-4 pt-10 border-t border-slate-100 text-center">
            <div className="inline-flex items-center gap-2.5 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm mb-6">
              <Copyright size={16} className="text-indigo-600" />
              <span className="text-sm md:text-base font-black text-slate-800 tracking-tight">
                RoleplayTH Since 2022
              </span>
            </div>
            
            <div className="max-w-md mx-auto px-6">
              <p className="text-[11px] md:text-xs text-slate-400 font-bold leading-relaxed">
                © สงวนลิขสิทธิ์เนื้อหาและซอฟต์แวร์ตามกฎหมายคุ้มครองลิขสิทธิ์ <br/>
                <span className="text-slate-500/60">ห้ามมิให้ผู้ใดคัดลอก ดัดแปลง หรือละเมิดสิทธิ์โดยไม่ได้รับอนุญาต</span>
              </p>
            </div>
          </div>

          {/* Hidden Stealth Text for Copyright protection */}
          <div className="mt-12 text-[#f9fafb] text-[9px] text-center opacity-60 font-mono">
            ก๊อปพ่อมึงตายทั้งหมด จบนะ
          </div>
        </div>
      </div>

      {/* Modals Implementation */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl border border-white/20">
            <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">เปลี่ยนรหัสผ่าน</h3>
            {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3"><AlertCircle size={18}/>{error}</div>}
            {success && <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl text-green-600 text-xs font-bold flex items-center gap-3"><CheckCircle size={18}/>{success}</div>}
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5 ml-1">รหัสผ่านปัจจุบัน</label>
                <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium" required disabled={isSubmitting} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5 ml-1">รหัสผ่านใหม่</label>
                <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium" required minLength={6} disabled={isSubmitting} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5 ml-1">ยืนยันรหัสผ่านใหม่</label>
                <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium" required minLength={6} disabled={isSubmitting} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setShowPasswordModal(false); setError(''); setSuccess(''); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-all active:scale-95" disabled={isSubmitting}>ยกเลิก</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-200 active:scale-95" disabled={isSubmitting}>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUsernameModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">เปลี่ยน Username</h3>
            {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex gap-3 items-center"><AlertCircle size={18}/>{error}</div>}
            {success && <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-2xl text-xs font-bold flex gap-3 items-center"><CheckCircle size={18}/>{success}</div>}
            <form onSubmit={handleChangeUsername} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5 ml-1">Username ใหม่</label>
                <input type="text" value={usernameForm.newUsername} onChange={(e) => setUsernameForm({ ...usernameForm, newUsername: e.target.value.toLowerCase() })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-indigo-600" required pattern="[a-zA-Z0-9_]+" minLength={3} maxLength={20} disabled={isSubmitting} placeholder="username123" />
                <p className="text-[10px] text-slate-400 font-black uppercase mt-2 ml-1">ตัวอักษร a-z, 0-9 และ _ เท่านั้น</p>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5 ml-1">รหัสผ่านปัจจุบัน</label>
                <input type="password" value={usernameForm.currentPassword} onChange={(e) => setUsernameForm({ ...usernameForm, currentPassword: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium" required disabled={isSubmitting} placeholder="••••••••" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setShowUsernameModal(false); setError(''); setSuccess(''); setUsernameForm({ currentPassword: '', newUsername: '' }); }} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-all active:scale-95" disabled={isSubmitting}>ยกเลิก</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-200 active:scale-95" disabled={isSubmitting}>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDisplayNameModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">เปลี่ยนชื่อที่แสดง</h3>
            {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex gap-3 items-center"><AlertCircle size={18}/>{error}</div>}
            {success && <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-2xl text-xs font-bold flex gap-3 items-center"><CheckCircle size={18}/>{success}</div>}
            <form onSubmit={handleChangeDisplayName} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5 ml-1">ชื่อที่แสดงใหม่</label>
                <input type="text" value={displayNameForm.newDisplayName} onChange={(e) => setDisplayNameForm({ ...displayNameForm, newDisplayName: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold" required disabled={isSubmitting} placeholder="ชื่อของคุณ" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5 ml-1">รหัสผ่านปัจจุบัน</label>
                <input type="password" value={displayNameForm.currentPassword} onChange={(e) => setDisplayNameForm({ ...displayNameForm, currentPassword: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium" required disabled={isSubmitting} placeholder="••••••••" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setShowDisplayNameModal(false); setError(''); setSuccess(''); setDisplayNameForm({ currentPassword: '', newDisplayName: '' }); }} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-all active:scale-95" disabled={isSubmitting}>ยกเลิก</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-200 active:scale-95" disabled={isSubmitting}>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </NavLayout>
  );
}

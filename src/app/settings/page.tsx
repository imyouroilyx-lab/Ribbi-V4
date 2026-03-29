'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { 
  Settings, User as UserIcon, Bell, Shield, Trash2, Lock, 
  Edit2, AtSign, CheckCircle, AlertCircle, X, Moon, Sun, Monitor, Palette 
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState('light');

  // --- Modal States ---
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);

  // --- Form States ---
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

  // --- Initial Load ---
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    // 1. โหลดข้อมูลผู้ใช้
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

    // 2. โหลดค่าธีมจาก LocalStorage
    const savedTheme = localStorage.getItem('theme') || 'system';
    setTheme(savedTheme);
    setIsLoading(false);
  };

  // --- Theme Controller ---
  const applyTheme = (newTheme) => {
    setTheme(newTheme);
    const root = window.document.documentElement;
    
    if (newTheme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      localStorage.removeItem('theme');
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  };

  // --- Auth & Verification Helpers ---
  const verifyCurrentPassword = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return !error;
  };

  // --- Form Handlers ---

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (passwordForm.newPassword.length < 6) throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      if (passwordForm.newPassword !== passwordForm.confirmPassword) throw new Error('รหัสผ่านใหม่ไม่ตรงกัน');

      const isValid = await verifyCurrentPassword(currentUser.email, passwordForm.currentPassword);
      if (!isValid) throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');

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
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUsernameChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const newU = usernameForm.newUsername.toLowerCase().trim();
      if (!/^[a-z0-9_]+$/.test(newU)) throw new Error('Username ต้องเป็น a-z, 0-9, _ เท่านั้น');
      if (newU.length < 3) throw new Error('Username ต้องมีอย่างน้อย 3 ตัวอักษร');

      const isValid = await verifyCurrentPassword(currentUser.email, usernameForm.currentPassword);
      if (!isValid) throw new Error('รหัสผ่านไม่ถูกต้อง');

      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', newU)
        .neq('id', currentUser.id)
        .maybeSingle();

      if (existingUser) throw new Error('Username นี้ถูกใช้แล้ว');

      const { error: updateError } = await supabase
        .from('users')
        .update({ username: newU })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      setSuccess('เปลี่ยน Username สำเร็จ!');
      await loadInitialData();
      setTimeout(() => {
        setShowUsernameModal(false);
        setSuccess('');
        setUsernameForm({ currentPassword: '', newUsername: '' });
      }, 2000);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisplayNameChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const newName = displayNameForm.newDisplayName.trim();
      if (!newName) throw new Error('กรุณากรอกชื่อที่แสดง');

      const isValid = await verifyCurrentPassword(currentUser.email, displayNameForm.currentPassword);
      if (!isValid) throw new Error('รหัสผ่านไม่ถูกต้อง');

      const { error: updateError } = await supabase
        .from('users')
        .update({ display_name: newName })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      setSuccess('เปลี่ยนชื่อที่แสดงสำเร็จ!');
      await loadInitialData();
      setTimeout(() => {
        setShowDisplayNameModal(false);
        setSuccess('');
        setDisplayNameForm({ currentPassword: '', newDisplayName: '' });
      }, 2000);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('ต้องการลบบัญชีถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;
    if (!confirm('แน่ใจหรือไม่? ข้อมูลทั้งหมดจะถูกลบ!')) return;
    alert('ฟีเจอร์นี้ยังไม่เปิดใช้งานในเวอร์ชัน Demo กรุณาติดต่อผู้ดูแลระบบ');
  };

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 animate-bounce" />
        </div>
      </NavLayout>
    );
  }

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3 dark:text-white">
          <Settings className="w-6 h-6 md:w-8 md:h-8" />
          ตั้งค่า
        </h1>

        <div className="space-y-6">
          
          {/* --- Section 1: Appearance (NEW DARK MODE) --- */}
          <section className="card-minimal dark:bg-gray-900/50 dark:border-gray-800 border border-gray-100">
            <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 dark:text-white">
              <Palette className="w-5 h-5 text-frog-500" />
              การแสดงผล
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'light', label: 'สว่าง', icon: Sun },
                { id: 'dark', label: 'มืด', icon: Moon },
                { id: 'system', label: 'ระบบ', icon: Monitor }
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => applyTheme(item.id)}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    theme === item.id 
                    ? 'border-frog-500 bg-frog-50 dark:bg-frog-900/20 text-frog-600 dark:text-frog-400' 
                    : 'border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* --- Section 2: Account --- */}
          <section className="card-minimal dark:bg-gray-900/50 dark:border-gray-800 border border-gray-100">
            <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 dark:text-white">
              <UserIcon className="w-5 h-5" />
              บัญชี
            </h2>
            <div className="space-y-1">
              
              {/* Password Row */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl transition-colors">
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2 dark:text-white text-gray-800">
                    <Lock className="w-4 h-4 text-gray-400" /> เปลี่ยนรหัสผ่าน
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">อัปเดตรหัสผ่านเพื่อความปลอดภัย</p>
                </div>
                <button onClick={() => setShowPasswordModal(true)} className="btn-secondary text-sm">แก้ไข</button>
              </div>

              {/* Username Row */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl transition-colors">
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2 dark:text-white text-gray-800">
                    <AtSign className="w-4 h-4 text-gray-400" /> Username
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">@{currentUser.username}</p>
                </div>
                <button onClick={() => { 
                  setUsernameForm({...usernameForm, newUsername: currentUser.username});
                  setShowUsernameModal(true); 
                }} className="btn-secondary text-sm">แก้ไข</button>
              </div>

              {/* Display Name Row */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl transition-colors">
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2 dark:text-white text-gray-800">
                    <Edit2 className="w-4 h-4 text-gray-400" /> ชื่อที่แสดง
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{currentUser.display_name}</p>
                </div>
                <button onClick={() => {
                  setDisplayNameForm({...displayNameForm, newDisplayName: currentUser.display_name});
                  setShowDisplayNameModal(true);
                }} className="btn-secondary text-sm">แก้ไข</button>
              </div>

              {/* Edit Profile Link */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl transition-colors">
                <div className="flex-1">
                  <p className="font-medium dark:text-white text-gray-800">แก้ไขข้อมูลโปรไฟล์</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">เปลี่ยนรูปโปรไฟล์, หน้าปก และ Bio</p>
                </div>
                <button onClick={() => router.push('/profile/edit')} className="btn-secondary text-sm">ไปที่หน้าแก้ไข</button>
              </div>

            </div>
          </section>

          {/* --- Section 3: Danger Zone --- */}
          <section className="card-minimal border-2 border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-900/5">
            <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" /> Danger Zone
            </h2>
            <button onClick={handleDeleteAccount} className="w-full p-4 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-2xl font-semibold transition-all">
              ลบบัญชีถาวร
            </button>
          </section>
        </div>
      </div>

      {/* --- MODAL: Password --- */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">เปลี่ยนรหัสผ่าน</h3>
              <button onClick={() => { setShowPasswordModal(false); setError(''); setSuccess(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X /></button>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex gap-2"><AlertCircle className="w-5 h-5 flex-shrink-0" />{error}</div>}
              {success && <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl flex gap-2"><CheckCircle className="w-5 h-5 flex-shrink-0" />{success}</div>}
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">รหัสผ่านปัจจุบัน</label>
                <input type="password" required className="input-minimal dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">รหัสผ่านใหม่</label>
                <input type="password" required className="input-minimal dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">ยืนยันรหัสผ่านใหม่</label>
                <input type="password" required className="input-minimal dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Username --- */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">เปลี่ยน Username</h3>
              <button onClick={() => { setShowUsernameModal(false); setError(''); setSuccess(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X /></button>
            </div>
            <form onSubmit={handleUsernameChange} className="space-y-4">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex gap-2"><AlertCircle className="w-5 h-5 flex-shrink-0" />{error}</div>}
              {success && <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl flex gap-2"><CheckCircle className="w-5 h-5 flex-shrink-0" />{success}</div>}
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">Username ใหม่</label>
                <input type="text" required className="input-minimal dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={usernameForm.newUsername} onChange={e => setUsernameForm({...usernameForm, newUsername: e.target.value})} placeholder="a-z, 0-9 เท่านั้น" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">รหัสผ่านปัจจุบันเพื่อยืนยัน</label>
                <input type="password" required className="input-minimal dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={usernameForm.currentPassword} onChange={e => setUsernameForm({...usernameForm, currentPassword: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowUsernameModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Display Name --- */}
      {showDisplayNameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">เปลี่ยนชื่อที่แสดง</h3>
              <button onClick={() => { setShowDisplayNameModal(false); setError(''); setSuccess(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X /></button>
            </div>
            <form onSubmit={handleDisplayNameChange} className="space-y-4">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex gap-2"><AlertCircle className="w-5 h-5 flex-shrink-0" />{error}</div>}
              {success && <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl flex gap-2"><CheckCircle className="w-5 h-5 flex-shrink-0" />{success}</div>}
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">ชื่อที่แสดงใหม่</label>
                <input type="text" required className="input-minimal dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={displayNameForm.newDisplayName} onChange={e => setDisplayNameForm({...displayNameForm, newDisplayName: e.target.value})} placeholder="ชื่อที่จะให้คนอื่นเห็น" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">รหัสผ่านปัจจุบันเพื่อยืนยัน</label>
                <input type="password" required className="input-minimal dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={displayNameForm.currentPassword} onChange={e => setDisplayNameForm({...displayNameForm, currentPassword: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDisplayNameModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </NavLayout>
  );
}

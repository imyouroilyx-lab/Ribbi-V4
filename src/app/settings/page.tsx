'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { 
  Settings, User as UserIcon, Lock, AtSign, Edit2, 
  Trash2, Moon, Sun, Monitor, Palette, CheckCircle, AlertCircle, X
} from 'lucide-react';

interface UserData {
  id: string;
  email?: string;
  username: string;
  display_name: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<string>('light');

  // --- Modal & Form States (ครบถ้วนตามเดิม) ---
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [usernameForm, setUsernameForm] = useState({ currentPassword: '', newUsername: '' });
  const [displayNameForm, setDisplayNameForm] = useState({ currentPassword: '', newDisplayName: '' });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
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

      // สำคัญ: ต้องอ่านค่าธีมจาก localStorage และใช้คลาส dark ให้ถูกต้อง
      const savedTheme = localStorage.getItem('theme') || 'light';
      setTheme(savedTheme);
      updateThemeClass(savedTheme);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateThemeClass = (newTheme: string) => {
    const root = window.document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
    } else {
      // System
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  };

  const applyTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeClass(newTheme);
  };

  // --- Handlers (ฟังก์ชันจัดการบัญชี - คงไว้ครบถ้วน) ---
  const verifyCurrentPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(''); setSuccess(''); setIsSubmitting(true);
    try {
      if (passwordForm.newPassword.length < 6) throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      if (passwordForm.newPassword !== passwordForm.confirmPassword) throw new Error('รหัสผ่านใหม่ไม่ตรงกัน');
      const isValid = await verifyCurrentPassword(currentUser.email || '', passwordForm.currentPassword);
      if (!isValid) throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (updateError) throw updateError;
      setSuccess('เปลี่ยนรหัสผ่านสำเร็จ!');
      setTimeout(() => { setShowPasswordModal(false); setSuccess(''); setPasswordForm({currentPassword: '', newPassword: '', confirmPassword: ''}); }, 2000);
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  const handleUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(''); setSuccess(''); setIsSubmitting(true);
    try {
      const newU = usernameForm.newUsername.toLowerCase().trim();
      if (!/^[a-z0-9_]+$/.test(newU)) throw new Error('Username ต้องเป็น a-z, 0-9, _ เท่านั้น');
      const isValid = await verifyCurrentPassword(currentUser.email || '', usernameForm.currentPassword);
      if (!isValid) throw new Error('รหัสผ่านไม่ถูกต้อง');
      const { data: existing } = await supabase.from('users').select('id').eq('username', newU).neq('id', currentUser.id).maybeSingle();
      if (existing) throw new Error('Username นี้ถูกใช้แล้ว');
      const { error: uErr } = await supabase.from('users').update({ username: newU }).eq('id', currentUser.id);
      if (uErr) throw uErr;
      setSuccess('เปลี่ยน Username สำเร็จ!');
      await loadInitialData();
      setTimeout(() => { setShowUsernameModal(false); setSuccess(''); setUsernameForm({currentPassword: '', newUsername: ''}); }, 2000);
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  const handleDisplayNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(''); setSuccess(''); setIsSubmitting(true);
    try {
      if (!displayNameForm.newDisplayName.trim()) throw new Error('กรุณากรอกชื่อที่แสดง');
      const isValid = await verifyCurrentPassword(currentUser.email || '', displayNameForm.currentPassword);
      if (!isValid) throw new Error('รหัสผ่านไม่ถูกต้อง');
      const { error: uErr } = await supabase.from('users').update({ display_name: displayNameForm.newDisplayName.trim() }).eq('id', currentUser.id);
      if (uErr) throw uErr;
      setSuccess('เปลี่ยนชื่อที่แสดงสำเร็จ!');
      await loadInitialData();
      setTimeout(() => { setShowDisplayNameModal(false); setSuccess(''); setDisplayNameForm({currentPassword: '', newDisplayName: ''}); }, 2000);
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <NavLayout><div className="flex items-center justify-center h-64"><img src="https://iili.io/qbtgKBt.png" className="w-16 h-16 animate-bounce" /></div></NavLayout>;
  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3 dark:text-white">
          <Settings className="w-6 h-6 md:w-8 md:h-8" />
          ตั้งค่า
        </h1>

        <div className="space-y-6">
          {/* Appearance Section */}
          <section className="card-minimal">
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
                    : 'border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 hover:border-gray-200'
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Account Section */}
          <section className="card-minimal">
            <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 dark:text-white">
              <UserIcon className="w-5 h-5" />
              บัญชี
            </h2>
            <div className="space-y-1">
              {/* Row: Password */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl transition-colors">
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2 dark:text-white text-gray-800">
                    <Lock className="w-4 h-4 text-gray-400" /> เปลี่ยนรหัสผ่าน
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">อัปเดตรหัสผ่านเพื่อความปลอดภัย</p>
                </div>
                <button onClick={() => setShowPasswordModal(true)} className="btn-secondary text-sm">แก้ไข</button>
              </div>
              {/* Row: Username */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl transition-colors">
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2 dark:text-white text-gray-800">
                    <AtSign className="w-4 h-4 text-gray-400" /> Username
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">@{currentUser.username}</p>
                </div>
                <button onClick={() => { setUsernameForm({...usernameForm, newUsername: currentUser.username}); setShowUsernameModal(true); }} className="btn-secondary text-sm">แก้ไข</button>
              </div>
              {/* Row: Display Name */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl transition-colors">
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2 dark:text-white text-gray-800">
                    <Edit2 className="w-4 h-4 text-gray-400" /> ชื่อที่แสดง
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{currentUser.display_name}</p>
                </div>
                <button onClick={() => { setDisplayNameForm({...displayNameForm, newDisplayName: currentUser.display_name}); setShowDisplayNameModal(true); }} className="btn-secondary text-sm">แก้ไข</button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="card-minimal border-2 border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-900/5">
            <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" /> Danger Zone
            </h2>
            <button className="w-full p-4 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-2xl font-semibold transition-all">
              ลบบัญชีถาวร
            </button>
          </section>
        </div>
      </div>

      {/* --- Modals (Password, Username, DisplayName) --- */}
      {/* (โค้ด Modal ทั้งหมดถูกนำกลับมาใส่ให้ครบถ้วนในเวอร์ชันแก้ไขนี้) */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">เปลี่ยนรหัสผ่าน</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X /></button>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}
              {success && <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl flex gap-2"><CheckCircle className="w-5 h-5" />{success}</div>}
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">รหัสผ่านปัจจุบัน</label>
                <input type="password" required className="input-minimal" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">รหัสผ่านใหม่</label>
                <input type="password" required className="input-minimal" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">ยืนยันรหัสผ่านใหม่</label>
                <input type="password" required className="input-minimal" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'บันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">เปลี่ยน Username</h3>
              <button onClick={() => setShowUsernameModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X /></button>
            </div>
            <form onSubmit={handleUsernameChange} className="space-y-4">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}
              {success && <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl flex gap-2"><CheckCircle className="w-5 h-5" />{success}</div>}
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">Username ใหม่</label>
                <input type="text" required className="input-minimal" value={usernameForm.newUsername} onChange={e => setUsernameForm({...usernameForm, newUsername: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">รหัสผ่านยืนยัน</label>
                <input type="password" required className="input-minimal" value={usernameForm.currentPassword} onChange={e => setUsernameForm({...usernameForm, currentPassword: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowUsernameModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'บันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDisplayNameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">เปลี่ยนชื่อที่แสดง</h3>
              <button onClick={() => setShowDisplayNameModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X /></button>
            </div>
            <form onSubmit={handleDisplayNameChange} className="space-y-4">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}
              {success && <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl flex gap-2"><CheckCircle className="w-5 h-5" />{success}</div>}
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">ชื่อที่แสดงใหม่</label>
                <input type="text" required className="input-minimal" value={displayNameForm.newDisplayName} onChange={e => setDisplayNameForm({...displayNameForm, newDisplayName: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">รหัสผ่านยืนยัน</label>
                <input type="password" required className="input-minimal" value={displayNameForm.currentPassword} onChange={e => setDisplayNameForm({...displayNameForm, currentPassword: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDisplayNameModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'บันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </NavLayout>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import { Settings, User as UserIcon, Bell, Shield, Trash2, Lock, Edit2, AtSign, CheckCircle, AlertCircle, Copyright } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit modals
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

  // Verify current password
  const verifyCurrentPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return !error;
  };

  // Change Password
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

  // Change Username
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

  // Change Display Name
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
        <h1 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
          <Settings className="w-6 h-6 md:w-8 md:h-8" />
          ตั้งค่า
        </h1>

        <div className="space-y-4">
          {/* Account Section */}
          <div className="card-minimal">
            <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              บัญชี
            </h2>
            
            <div className="space-y-3">
              {/* Change Password */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    เปลี่ยนรหัสผ่าน
                  </p>
                  <p className="text-sm text-gray-500">อัปเดตรหัสผ่านของคุณ</p>
                </div>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="btn-secondary text-sm"
                >
                  แก้ไข
                </button>
              </div>

              {/* Change Username */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2">
                    <AtSign className="w-4 h-4" />
                    Username
                  </p>
                  <p className="text-sm text-gray-500">@{currentUser.username}</p>
                </div>
                <button
                  onClick={() => {
                    setUsernameForm({ ...usernameForm, newUsername: currentUser.username });
                    setShowUsernameModal(true);
                  }}
                  className="btn-secondary text-sm"
                >
                  แก้ไข
                </button>
              </div>

              {/* Change Display Name */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2">
                    <Edit2 className="w-4 h-4" />
                    ชื่อที่แสดง
                  </p>
                  <p className="text-sm text-gray-500">{currentUser.display_name}</p>
                </div>
                <button
                  onClick={() => {
                    setDisplayNameForm({ ...displayNameForm, newDisplayName: currentUser.display_name });
                    setShowDisplayNameModal(true);
                  }}
                  className="btn-secondary text-sm"
                >
                  แก้ไข
                </button>
              </div>

              {/* Edit Profile */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <p className="font-medium">แก้ไขโปรไฟล์</p>
                  <p className="text-sm text-gray-500">รูป, Bio, ข้อมูลส่วนตัว</p>
                </div>
                <button
                  onClick={() => router.push('/profile/edit')}
                  className="btn-secondary text-sm"
                >
                  แก้ไข
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card-minimal border-2 border-red-200">
            <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </h2>
            
            <button
              onClick={handleDeleteAccount}
              className="w-full p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium transition"
            >
              ลบบัญชีถาวร
            </button>
          </div>

          {/* Copyright Section */}
          <div className="pt-6 pb-2 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl">
              <Copyright size={14} className="text-slate-400" />
              <p className="text-[11px] md:text-xs font-bold text-slate-500 tracking-tight">
                RoleplayTH - since 2021
              </p>
            </div>
            <div className="mt-3 px-6">
              <p className="text-[10px] md:text-[11px] text-slate-400 leading-relaxed font-medium">
                สงวนลิขสิทธิ์เนื้อหาและซอฟต์แวร์ตามกฎหมาย <br className="hidden md:block" />
                <span className="text-indigo-400/80">ไม่อนุญาตให้คัดลอก ดัดแปลง หรือละเมิดสิทธิ์ในทุกกรณีโดยไม่ได้รับอนุญาต</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">เปลี่ยนรหัสผ่าน</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm flex items-start gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">รหัสผ่านปัจจุบัน</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="input-minimal"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="input-minimal"
                  required
                  minLength={6}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="input-minimal"
                  required
                  minLength={6}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setError('');
                    setSuccess('');
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="btn-secondary flex-1"
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Username Change Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">เปลี่ยน Username</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm flex items-start gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleChangeUsername} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Username ใหม่</label>
                <input
                  type="text"
                  value={usernameForm.newUsername}
                  onChange={(e) => setUsernameForm({ ...usernameForm, newUsername: e.target.value.toLowerCase() })}
                  className="input-minimal"
                  required
                  pattern="[a-zA-Z0-9_]+"
                  minLength={3}
                  maxLength={20}
                  disabled={isSubmitting}
                  placeholder="username123"
                />
                <p className="text-xs text-gray-500 mt-1">ใช้ได้เฉพาะ a-z, 0-9, _</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">รหัสผ่านปัจจุบัน</label>
                <input
                  type="password"
                  value={usernameForm.currentPassword}
                  onChange={(e) => setUsernameForm({ ...usernameForm, currentPassword: e.target.value })}
                  className="input-minimal"
                  required
                  disabled={isSubmitting}
                  placeholder="••••••••"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUsernameModal(false);
                    setError('');
                    setSuccess('');
                    setUsernameForm({ currentPassword: '', newUsername: '' });
                  }}
                  className="btn-secondary flex-1"
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Display Name Change Modal */}
      {showDisplayNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">เปลี่ยนชื่อที่แสดง</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm flex items-start gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleChangeDisplayName} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">ชื่อที่แสดงใหม่</label>
                <input
                  type="text"
                  value={displayNameForm.newDisplayName}
                  onChange={(e) => setDisplayNameForm({ ...displayNameForm, newDisplayName: e.target.value })}
                  className="input-minimal"
                  required
                  disabled={isSubmitting}
                  placeholder="ชื่อของคุณ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">รหัสผ่านปัจจุบัน</label>
                <input
                  type="password"
                  value={displayNameForm.currentPassword}
                  onChange={(e) => setDisplayNameForm({ ...displayNameForm, currentPassword: e.target.value })}
                  className="input-minimal"
                  required
                  disabled={isSubmitting}
                  placeholder="••••••••"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDisplayNameModal(false);
                    setError('');
                    setSuccess('');
                    setDisplayNameForm({ currentPassword: '', newDisplayName: '' });
                  }}
                  className="btn-secondary flex-1"
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </NavLayout>
  );
}

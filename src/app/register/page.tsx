'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Mail, Lock, User, AtSign, AlertCircle, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      setError('Username ใช้ได้เฉพาะ a-z, 0-9 และ _');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      setIsLoading(false);
      return;
    }

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.toLowerCase(),
        password: formData.password,
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('อีเมลนี้ถูกใช้งานแล้ว');
          return;
        }
        throw signUpError;
      }

      if (!authData.user) throw new Error('ไม่สามารถสร้างบัญชีได้');

      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: formData.email.toLowerCase(),
          username: formData.username.toLowerCase(),
          display_name: formData.displayName,
        });

      if (profileError) {
        if (profileError.message.includes('duplicate key')) {
          setError('Username นี้มีคนใช้แล้ว');
          return;
        }
        throw profileError;
      }

      setSuccess('สมัครสมาชิกสำเร็จ 🎉');

      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1200);

    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <img
              src="https://iili.io/qbtgKBt.png"
              className="w-24 h-24 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Ribbi</h1>
          <p className="text-gray-600">สร้างบัญชีใหม่</p>
        </div>

        <div className="card-minimal">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            สมัครสมาชิก
          </h2>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 flex gap-2 text-sm">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-600 flex gap-2 text-sm">
              <CheckCircle className="w-5 h-5" />
              {success}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">

            <div>
              <label className="text-sm font-medium mb-1 block">
                <AtSign className="w-4 h-4 inline mr-1" />
                Username
              </label>
              <input
                className="input-minimal"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value.toLowerCase() })
                }
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                <User className="w-4 h-4 inline mr-1" />
                ชื่อที่แสดง
              </label>
              <input
                className="input-minimal"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                <Mail className="w-4 h-4 inline mr-1" />
                อีเมล
              </label>
              <input
                type="email"
                className="input-minimal"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value.toLowerCase() })
                }
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                <Lock className="w-4 h-4 inline mr-1" />
                รหัสผ่าน
              </label>
              <input
                type="password"
                className="input-minimal"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>

            <button
              disabled={isLoading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {isLoading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-frog-600 font-medium">
              มีบัญชีแล้ว? เข้าสู่ระบบ
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

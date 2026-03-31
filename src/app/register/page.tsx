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
  setError('Username ต้องเป็น a-z, 0-9, _ เท่านั้น');
  setIsLoading(false);
  return;
}

if (formData.password.length < 6) {
  setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  setIsLoading(false);
  return;
}

try {
  // ✅ สมัคร auth
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: formData.email.toLowerCase(),
    password: formData.password,
  });

  if (signUpError) {
    if (signUpError.message.includes('already registered')) {
      setError('อีเมลนี้ถูกใช้แล้ว');
      return;
    }
    throw signUpError;
  }

  if (!authData.user) {
    throw new Error('ไม่สามารถสร้าง user ได้');
  }

  // ✅ สร้าง profile ทันที (ไม่ต้องรอ trigger)
  const { error: profileError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email: formData.email.toLowerCase(),
      username: formData.username.toLowerCase(),
      display_name: formData.displayName,
    });

  if (profileError) {
    // ✅ handle username ซ้ำจาก DB
    if (profileError.message.includes('duplicate key')) {
      setError('Username นี้ถูกใช้แล้ว');
      return;
    }
    throw profileError;
  }

  setSuccess('สมัครสมาชิกสำเร็จ! 🎉');

  setTimeout(() => {
    router.push('/');
    router.refresh();
  }, 1000);

} catch (error: any) {
  console.error(error);
  setError(error.message || 'เกิดข้อผิดพลาด');
} finally {
  setIsLoading(false);
}

};

return ( <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4"> <div className="w-full max-w-md"> <div className="text-center mb-8"> <div className="mb-4 flex justify-center"> <img src="https://iili.io/qbtgKBt.png" className="w-24 h-24 object-contain" /> </div> <h1 className="text-3xl font-bold">Ribbi</h1> </div>

    <div className="card-minimal">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <UserPlus className="w-6 h-6" />
        สมัครสมาชิก
      </h2>

      {error && <div className="text-red-500 mb-3">{error}</div>}
      {success && <div className="text-green-500 mb-3">{success}</div>}

      <form onSubmit={handleRegister} className="space-y-4">
        <input
          placeholder="Username"
          className="input-minimal"
          value={formData.username}
          onChange={(e) =>
            setFormData({ ...formData, username: e.target.value.toLowerCase() })
          }
          required
        />

        <input
          placeholder="Display name"
          className="input-minimal"
          value={formData.displayName}
          onChange={(e) =>
            setFormData({ ...formData, displayName: e.target.value })
          }
          required
        />

        <input
          type="email"
          placeholder="Email"
          className="input-minimal"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value.toLowerCase() })
          }
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="input-minimal"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          required
        />

        <button className="btn-primary w-full">
          {isLoading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/login">เข้าสู่ระบบ</Link>
      </div>
    </div>
  </div>
</div>

);
}

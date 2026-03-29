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
  const [countdown, setCountdown] = useState(0);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    setCountdown(0);

    // Validate
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
      console.log('🔍 Checking username availability...');
      
      // Check username
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', formData.username.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        setError('Username นี้ถูกใช้แล้ว');
        setIsLoading(false);
        return;
      }

      console.log('✅ Username available');
      console.log('📝 Creating auth user...');

      // Sign up
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.toLowerCase(),
        password: formData.password,
        options: {
          data: {
            username: formData.username.toLowerCase(),
            display_name: formData.displayName,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('For security purposes')) {
          setError('กรุณารอ 30 วินาที');
          let seconds = 30;
          setCountdown(seconds);
          const timer = setInterval(() => {
            seconds -= 1;
            setCountdown(seconds);
            if (seconds <= 0) {
              clearInterval(timer);
              setError('');
            }
          }, 1000);
          setIsLoading(false);
          return;
        }
        
        if (signUpError.message.includes('already registered')) {
          setError('อีเมลนี้ถูกใช้แล้ว');
          setIsLoading(false);
          return;
        }
        
        throw signUpError;
      }

      if (!authData.user) {
        throw new Error('ไม่สามารถสร้าง user ได้');
      }

      console.log('✅ Auth user created:', authData.user.id);
      console.log('⏳ Waiting for trigger...');

      // รอ trigger ทำงาน
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('🔍 Checking profile...');

      // ตรวจสอบ profile
      let profileExists = false;
      let retries = 0;
      const maxRetries = 5;

      while (!profileExists && retries < maxRetries) {
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profile) {
          profileExists = true;
          console.log('✅ Profile found via trigger');
        } else {
          retries++;
          console.log(`⏳ Retry ${retries}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // ถ้า trigger ไม่ทำงาน ให้สร้างเอง
      if (!profileExists) {
        console.log('⚠️ Trigger failed, creating manually...');
        
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: formData.email.toLowerCase(), // ← เพิ่ม email ตรงนี้
            username: formData.username.toLowerCase(),
            display_name: formData.displayName,
          });

        if (profileError) {
          console.error('❌ Profile creation failed:', profileError);
          throw new Error(`ไม่สามารถสร้างโปรไฟล์: ${profileError.message || 'Unknown error'}`);
        }

        console.log('✅ Profile created manually');
      }

      setSuccess('สมัครสมาชิกสำเร็จ! 🎉');
      
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);

    } catch (error: any) {
      console.error('❌ Registration failed:', error);
      setError(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <img 
              src="https://iili.io/qbtgKBt.png" 
              alt="Ribbi Logo" 
              className="w-24 h-24 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ribbi</h1>
          <p className="text-gray-600">สร้างบัญชีใหม่</p>
        </div>

        <div className="card-minimal">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            สมัครสมาชิก
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{error}</p>
                {countdown > 0 && (
                  <p className="text-xs mt-2">รอ {countdown} วินาที</p>
                )}
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-600 text-sm flex items-start gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="font-medium">{success}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <AtSign className="w-4 h-4 inline mr-1" />
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                placeholder="username123"
                className="input-minimal"
                required
                disabled={isLoading || countdown > 0}
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <User className="w-4 h-4 inline mr-1" />
                ชื่อที่แสดง <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="ชื่อของคุณ"
                className="input-minimal"
                required
                disabled={isLoading || countdown > 0}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                อีเมล <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                placeholder="your@email.com"
                className="input-minimal"
                required
                disabled={isLoading || countdown > 0}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <Lock className="w-4 h-4 inline mr-1" />
                รหัสผ่าน <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="input-minimal"
                required
                disabled={isLoading || countdown > 0}
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || countdown > 0}
              className="btn-primary w-full disabled:opacity-50"
            >
              {countdown > 0 ? `รอ ${countdown}s` : isLoading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-frog-600 hover:text-frog-700 font-medium">
              มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
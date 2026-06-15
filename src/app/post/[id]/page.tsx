'use client';

import { useState, useEffect } from 'react';
import { supabase, Post, User } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import PostCardV3 from '@/components/PostCardV3';
import { ArrowLeft, Loader2, Code2, Copy, Check } from 'lucide-react';
import Link from 'next/link';

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  
  const [post, setPost] = useState<Post | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (postId) loadData();
  }, [postId]);

  const loadData = async () => {
    try {
      // 1. เช็ก Auth ก่อน
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }

      // ✅ 2. เพิ่ม is_verified เข้าไปในทุกจุดที่ดึงข้อมูล User
      const [userRes, postRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, username, display_name, profile_img_url, is_verified') // ✅ เพิ่มตรงนี้
          .eq('id', authUser.id)
          .single(),
        supabase
          .from('posts')
          .select(`
            *,
            author:author_id(id, username, display_name, profile_img_url, is_verified), 
            target:target_id(id, username, display_name, profile_img_url, is_verified)
          `) // ✅ เพิ่ม is_verified ให้ทั้ง author และ target
          .eq('id', postId)
          .single()
      ]);

      if (userRes.data) setCurrentUser(userRes.data as any);
      
      if (!postRes.data) {
        router.push('/');
        return;
      }

      setPost(postRes.data as any);
    } catch (error) {
      console.error('Error loading post:', error);
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyEmbed = () => {
    if (typeof window !== 'undefined') {
      const embedCode = `<iframe src="${window.location.origin}/post/${postId}/embed" width="100%" height="380" style="border:none; max-width:600px; width:100%;" frameborder="0" scrolling="no"></iframe>`;
      navigator.clipboard.writeText(embedCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // เปลี่ยนสถานะปุ่มกลับหลังจาก 2 วินาที
    }
  };

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-frog-500" />
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">กำลังโหลดโพสต์...</p>
          </div>
        </div>
      </NavLayout>
    );
  }

  if (!post || !currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4">
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-900 mb-6 transition-colors group"
        >
          <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 group-hover:border-gray-200">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest">กลับหน้าหลัก</span>
        </Link>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PostCardV3 
            post={post}
            currentUserId={currentUser.id}
          />

          {/* ส่วนกล่อง Embed Code ที่เพิ่มเข้ามาใหม่ด้านล่างการ์ดโพสต์ */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200/60 rounded-2xl flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-gray-500">
                <Code2 className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold uppercase tracking-wider">โค้ดสำหรับฝังโพสต์ (Embed Code)</span>
              </div>
              <button
                onClick={handleCopyEmbed}
                className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all shadow-sm ${
                  isCopied 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกโค้ด</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="relative group">
              <code className="text-xs text-gray-600 bg-gray-100 p-3 rounded-xl block overflow-x-auto select-all break-all whitespace-normal border border-gray-200/50 font-mono leading-relaxed">
                {`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/post/${postId}/embed" width="100%" height="380" style="border:none; max-width:600px;" frameborder="0" scrolling="no"></iframe>`}
              </code>
            </div>
            <p className="text-[11px] text-gray-400">
              * คัดลอกโค้ดด้านบนนี้ไปวางในส่วน HTML ของเว็บบอร์ดที่รองรับ เพื่อแสดงผลโพสต์นี้แบบ Embed Card
            </p>
          </div>

        </div>
      </div>
    </NavLayout>
  );
}

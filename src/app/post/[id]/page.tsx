'use client';

import { useState, useEffect } from 'react';
import { supabase, Post, User } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import PostCardV3 from '@/components/PostCardV3';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  
  const [post, setPost] = useState<Post | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (postId) loadData();
  }, [postId]);

  const loadData = async () => {
    try {
      // 1. เช็ก Auth ก่อน (ต้องใช้ ID ไปดึงข้อมูลอื่น)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }

      // ✅ 2. Optimize: ดึงข้อมูล User และ Post พร้อมกัน (Parallel Fetching)
      // และเลือกเฉพาะ Column ที่จำเป็น (Selective Fetching)
      const [userRes, postRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, username, display_name, profile_img_url') // ดึงแค่นี้พอ
          .eq('id', authUser.id)
          .single(),
        supabase
          .from('posts')
          .select(`
            *,
            author:author_id(id, username, display_name, profile_img_url),
            target:target_id(id, username, display_name, profile_img_url)
          `) // ดึงเฉพาะ Column ที่ PostCardV3 ต้องใช้
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
        </div>
      </div>
    </NavLayout>
  );
}

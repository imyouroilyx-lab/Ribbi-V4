// app/post/[id]/embed/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { Loader2, Heart, MessageCircle, ArrowUpRight } from 'lucide-react';

export default function PostEmbedPage() {
  const params = useParams();
  const postId = params.id as string;
  
  const [post, setPost] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (postId) loadPostData();
  }, [postId]);

  const loadPostData = async () => {
    try {
      // ดึงข้อมูลโพสต์ รูปภาพ ผู้โพสต์ และจํานวนนับต่างๆ (ปรับชื่อ Table/Column ให้ตรงกับฐานข้อมูลจริงของคุณ)
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          image_url,
          created_at,
          likes_count, 
          comments_count,
          author:author_id(id, username, display_name, profile_img_url, is_verified)
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;
      if (data) setPost(data);
    } catch (error) {
      console.error('Error loading embed post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed">
        ไม่พบโพสต์นี้ หรือโพสต์อาจถูกลบไปแล้ว
      </div>
    );
  }

  // สร้างลิงก์กลับไปยังหน้าโพสต์หลักบนเว็บของคุณ
  const postUrl = `${window.location.origin}/post/${post.id}`;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm max-w-[550px] mx-auto font-sans antialiased">
      {/* ส่วนหัว: ข้อมูลผู้โพสต์ */}
      <div className="flex items-center justify-between mb-3">
        <a href={postUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group">
          <img 
            src={post.author?.profile_img_url || '/default-avatar.png'} 
            alt={post.author?.display_name}
            className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-100"
          />
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-800 group-hover:text-gray-900 group-hover:underline">
                {post.author?.display_name}
              </span>
              {post.author?.is_verified && (
                <span className="text-blue-500 text-xs">✨</span> // หรือไอคอน Verified ของคุณ
              )}
            </div>
            <span className="text-xs text-gray-400">@{post.author?.username}</span>
          </div>
        </a>
        
        {/* ปุ่มเปิดดูบนเว็บหลัก */}
        <a 
          href={postUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-md transition-colors"
        >
          ดูบนเว็บหลัก <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {/* ส่วนเนื้อหาข้อความ */}
      <a href={postUrl} target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap hover:text-gray-900">
        {post.content}
      </a>

      {/* ส่วนรูปภาพ (ถ้ามี) */}
      {post.image_url && (
        <a href={postUrl} target="_blank" rel="noopener noreferrer" className="block mb-4 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 max-h-[300px]">
          <img 
            src={post.image_url} 
            alt="Post media" 
            className="w-full h-full object-cover hover:scale-[1.01] transition-transform duration-250"
          />
        </a>
      )}

      {/* แถบแสดงจำนวน หัวใจ และ คอมเมนต์ (Read-only กดไม่ได้) */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-100 text-gray-500 text-xs font-semibold">
        <div className="flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-gray-400" />
          <span>{post.likes_count || 0}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-gray-400" />
          <span>{post.comments_count || 0}</span>
        </div>
      </div>
    </div>
  );
}

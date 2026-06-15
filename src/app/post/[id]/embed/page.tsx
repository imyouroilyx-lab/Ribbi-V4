'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { Loader2, Heart, MessageCircle, ArrowUpRight } from 'lucide-react';

export default function PostEmbedPage() {
  const params = useParams();
  const rawId = params.id;
  const postId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [post, setPost] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (postId) {
      loadPostData();
    }
  }, [postId]);

  const loadPostData = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:author_id(id, username, display_name, profile_img_url, is_verified),
          target:target_id(id, username, display_name, profile_img_url, is_verified)
        `)
        .eq('id', postId)
        .maybeSingle();

      console.log('Embed postId:', postId);
      console.log('Embed post data:', data);
      console.log('Embed post error:', error);

      if (error) {
        console.error('Error loading embed post:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        setPost(null);
        return;
      }

      if (!data) {
        setPost(null);
        return;
      }

      setPost(data);
    } catch (error) {
      console.error('Unexpected error loading embed post:', error);
      setPost(null);
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

  const postUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/post/${post.id}`
      : `/post/${post.id}`;

  const authorName =
    post.author?.display_name ||
    post.author?.username ||
    'Unknown user';

  const authorUsername =
    post.author?.username || 'unknown';

  const authorAvatar =
    post.author?.profile_img_url || '/default-avatar.png';

  // รองรับหลายชื่อ field เผื่อใน posts ไม่ได้ใช้ชื่อ image_url
  const postImage =
    post.image_url ||
    post.media_url ||
    post.image ||
    post.photo_url ||
    post.cover_url ||
    post.images?.[0] ||
    post.image_urls?.[0] ||
    null;

  // กันกรณี likes_count / comments_count ไม่มีจริงในตาราง
  const likesCount =
    post.likes_count ??
    post.like_count ??
    post.likes?.length ??
    0;

  const commentsCount =
    post.comments_count ??
    post.comment_count ??
    post.comments?.length ??
    0;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm max-w-[550px] mx-auto font-sans antialiased">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <a
          href={postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 group min-w-0"
        >
          <img
            src={authorAvatar}
            alt={authorName}
            className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-100 shrink-0"
          />

          <div className="min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-sm font-bold text-gray-800 group-hover:text-gray-900 group-hover:underline truncate">
                {authorName}
              </span>

              {post.author?.is_verified && (
                <span className="text-blue-500 text-xs shrink-0">✨</span>
              )}
            </div>

            <span className="text-xs text-gray-400 truncate block">
              @{authorUsername}
            </span>
          </div>
        </a>

        <a
          href={postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-md transition-colors shrink-0"
        >
          ดูบนเว็บหลัก <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {/* Content */}
      {post.content && (
        <a
          href={postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap hover:text-gray-900"
        >
          {post.content}
        </a>
      )}

      {/* Image */}
      {postImage && (
        <a
          href={postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-4 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 max-h-[300px]"
        >
          <img
            src={postImage}
            alt="Post media"
            className="w-full h-full object-cover hover:scale-[1.01] transition-transform duration-200"
          />
        </a>
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-100 text-gray-500 text-xs font-semibold">
        <div className="flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-gray-400" />
          <span>{likesCount}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-gray-400" />
          <span>{commentsCount}</span>
        </div>
      </div>
    </div>
  );
}

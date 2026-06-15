'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Heart,
  MessageCircle,
  ArrowUpRight,
  BadgeCheck,
} from 'lucide-react';
import { getRelativeTime } from '@/lib/utils';

export default function PostEmbedPage() {
  const params = useParams();
  const rawId = params.id;
  const postId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [post, setPost] = useState<any>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
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

      const [likesRes, commentsRes] = await Promise.all([
        supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', data.id),

        supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', data.id),
      ]);

      if (likesRes.error) {
        console.warn('Embed likes count error:', likesRes.error);
      }

      if (commentsRes.error) {
        console.warn('Embed comments count error:', commentsRes.error);
      }

      setLikeCount(likesRes.count || 0);
      setCommentCount(commentsRes.count || 0);
    } catch (error) {
      console.error('Unexpected error loading embed post:', error);
      setPost(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen w-full bg-transparent px-3 py-5 overflow-y-auto">
        <div className="flex items-center justify-center min-h-[180px] bg-white border border-gray-100 rounded-2xl shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen w-full bg-transparent px-3 py-5 overflow-y-auto">
        <div className="p-5 text-center text-xs text-gray-400 bg-gray-50 rounded-2xl border border-dashed">
          ไม่พบโพสต์นี้ หรือโพสต์อาจถูกลบไปแล้ว
        </div>
      </main>
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
    post.author?.profile_img_url || 'https://iili.io/qbtgKBt.png';

  const images =
    Array.isArray(post.images)
      ? post.images.filter(Boolean)
      : [];

  const content = post.content || '';
  const isLongContent = content.length > 700;

  return (
    <main className="min-h-screen w-full bg-transparent px-3 py-5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
      <article className="w-full max-w-[620px] mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm font-sans antialiased overflow-hidden">
        <div className="p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3 gap-3">
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 group min-w-0"
            >
              <img
                src={authorAvatar}
                alt={authorName}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-100 shrink-0"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-sm font-black text-gray-900 group-hover:text-frog-600 group-hover:underline truncate">
                    {authorName}
                  </span>

                  {post.author?.is_verified && (
                    <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase min-w-0">
                  <span className="truncate">@{authorUsername}</span>

                  {post.created_at && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                      <span className="shrink-0">
                        {getRelativeTime(post.created_at)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </a>

            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-md transition-colors shrink-0"
            >
              ดูโพสต์ <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>

          {/* Content */}
          {content && (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`block text-sm text-gray-800 leading-relaxed mb-4 whitespace-pre-wrap break-words hover:text-gray-900 ${
                isLongContent
                  ? 'max-h-[240px] overflow-y-auto pr-2 rounded-xl'
                  : ''
              }`}
            >
              {content}
            </a>
          )}

          {/* Images */}
          {images.length > 0 && (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`grid gap-2 mb-4 ${
                images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              }`}
            >
              {images.slice(0, 4).map((img: string, index: number) => (
                <div
                  key={`${img}-${index}`}
                  className={`relative overflow-hidden rounded-xl bg-gray-50 border border-gray-100 ${
                    images.length === 1
                      ? 'max-h-[420px]'
                      : images.length === 3 && index === 2
                        ? 'col-span-2 aspect-[16/8]'
                        : 'aspect-[4/3]'
                  }`}
                >
                  <img
                    src={img}
                    alt="Post media"
                    className={`w-full object-cover hover:scale-[1.01] transition-transform duration-200 ${
                      images.length === 1 ? 'h-auto max-h-[420px]' : 'h-full'
                    }`}
                    loading="lazy"
                  />

                  {index === 3 && images.length > 4 && (
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                      <span className="text-white text-lg font-black">
                        +{images.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </a>
          )}

          {/* Footer */}
          <div className="flex items-center gap-5 pt-3 border-t border-gray-100 text-gray-500 text-xs font-black">
            <div className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-gray-400" />
              <span>{likeCount}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-gray-400" />
              <span>{commentCount}</span>
            </div>

            <div className="ml-auto">
              <span className="text-[10px] text-gray-300 uppercase tracking-wider">
                Embedded Post
              </span>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}

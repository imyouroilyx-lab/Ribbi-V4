'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Heart,
  MessageCircle,
  ArrowUpRight,
  BadgeCheck,
  X,
} from 'lucide-react';
import { getRelativeTime } from '@/lib/utils';

interface EmbedComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  author?: {
    id: string;
    username: string;
    display_name: string;
    profile_img_url?: string | null;
    is_verified?: boolean;
  } | null;
}

export default function PostEmbedPage() {
  const params = useParams();
  const rawId = params.id;
  const postId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [post, setPost] = useState<any>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  const [comments, setComments] = useState<EmbedComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [hasLoadedComments, setHasLoadedComments] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const COMMENT_LIMIT = 10;

  useEffect(() => {
    if (postId) {
      loadPostData();
    }
  }, [postId]);

  useEffect(() => {
    if (showComments && !hasLoadedComments && post?.id) {
      loadComments();
    }
  }, [showComments, hasLoadedComments, post?.id]);

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

      if (error) {
        console.error('Embed post error:', {
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

      // เบา: ใช้ head count อย่างเดียว ไม่ดึง rows จริง
      const [likesRes, commentsRes] = await Promise.all([
        supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', data.id),

        supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', data.id),
      ]);

      if (!likesRes.error) {
        setLikeCount(likesRes.count || 0);
      }

      if (!commentsRes.error) {
        setCommentCount(commentsRes.count || 0);
      }
    } catch (error) {
      console.error('Unexpected embed post error:', error);
      setPost(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async () => {
    if (!post?.id) return;

    setIsCommentsLoading(true);

    try {
      // เบา: โหลดเฉพาะ top-level comments 10 อันล่าสุด ไม่โหลด replies
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          post_id,
          author_id,
          content,
          image_url,
          created_at,
          author:author_id(id, username, display_name, profile_img_url, is_verified)
        `)
        .eq('post_id', post.id)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: false })
        .limit(COMMENT_LIMIT);

      if (error) {
        console.error('Embed comments error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        setComments([]);
        setHasLoadedComments(true);
        return;
      }

      setComments((data || []) as EmbedComment[]);
      setHasLoadedComments(true);
    } catch (error) {
      console.error('Unexpected embed comments error:', error);
      setComments([]);
      setHasLoadedComments(true);
    } finally {
      setIsCommentsLoading(false);
    }
  };

  const getAbsoluteUrl = (path: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${path}`;
    }

    return path;
  };

  const renderTextWithTags = useMemo(() => {
    return (text: string) => {
      if (!text) return null;

      const regex =
        /(@\[.*?\]\([a-zA-Z0-9_]+\)|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_ก-๙]+|https?:\/\/[^\s]+)/g;

      return text.split(regex).map((part, index) => {
        if (!part) return null;

        const mdMention = part.match(/^@\[(.*?)\]\(([a-zA-Z0-9_]+)\)$/);

        if (mdMention) {
          const displayName = mdMention[1];
          const username = mdMention[2];

          return (
            <a
              key={index}
              href={getAbsoluteUrl(`/profile/${username}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-frog-600 font-bold hover:underline"
            >
              {displayName}
            </a>
          );
        }

        if (part.startsWith('@')) {
          const username = part.slice(1);

          return (
            <a
              key={index}
              href={getAbsoluteUrl(`/profile/${username}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-frog-600 font-bold hover:underline"
            >
              {part}
            </a>
          );
        }

        if (part.startsWith('#')) {
          return (
            <span key={index} className="text-blue-500 font-bold">
              {part}
            </span>
          );
        }

        if (part.startsWith('http')) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline break-all"
            >
              {part}
            </a>
          );
        }

        return <span key={index}>{part}</span>;
      });
    };
  }, []);

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

  const postUrl = getAbsoluteUrl(`/post/${post.id}`);

  const authorName =
    post.author?.display_name ||
    post.author?.username ||
    'Unknown user';

  const authorUsername = post.author?.username || 'unknown';

  const authorAvatar =
    post.author?.profile_img_url || 'https://iili.io/qbtgKBt.png';

  const images = Array.isArray(post.images)
    ? post.images.filter(Boolean)
    : [];

  const content = post.content || '';
  const isLongContent = content.length > 700;

  const renderCommentItem = (comment: EmbedComment) => {
    const commentAuthorName =
      comment.author?.display_name ||
      comment.author?.username ||
      'Unknown user';

    const commentAuthorUsername =
      comment.author?.username || 'unknown';

    const commentAuthorAvatar =
      comment.author?.profile_img_url || 'https://iili.io/qbtgKBt.png';

    return (
      <div key={comment.id} className="flex gap-2">
        <a
          href={getAbsoluteUrl(`/profile/${commentAuthorUsername}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          <img
            src={commentAuthorAvatar}
            alt={commentAuthorName}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-100"
            loading="lazy"
          />
        </a>

        <div className="flex-1 min-w-0">
          <div className="inline-block max-w-full bg-gray-100 rounded-2xl px-3 py-2">
            <a
              href={getAbsoluteUrl(`/profile/${commentAuthorUsername}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[11px] text-gray-900 flex items-center gap-1 hover:underline"
            >
              {commentAuthorName}

              {comment.author?.is_verified && (
                <BadgeCheck className="w-3 h-3 text-blue-500 shrink-0" />
              )}
            </a>

            {comment.content && (
              <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">
                {renderTextWithTags(comment.content)}
              </p>
            )}

            {comment.image_url && (
              <img
                src={comment.image_url}
                alt="Comment media"
                className="mt-2 rounded-xl max-h-40 object-cover"
                loading="lazy"
              />
            )}
          </div>

          <div className="mt-1 ml-2 text-[10px] font-bold text-gray-400 uppercase">
            {getRelativeTime(comment.created_at)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen w-full bg-transparent px-3 py-5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
      <article className="w-full max-w-[620px] mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm font-sans antialiased overflow-hidden">
        <div className="p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3 gap-3">
            <a
              href={getAbsoluteUrl(`/profile/${authorUsername}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 group min-w-0"
            >
              <img
                src={authorAvatar}
                alt={authorName}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-100 shrink-0"
                loading="lazy"
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
            <div
              className={`block text-sm text-gray-800 leading-relaxed mb-4 whitespace-pre-wrap break-words ${
                isLongContent
                  ? 'max-h-[220px] overflow-y-auto pr-2 rounded-xl'
                  : ''
              }`}
            >
              {renderTextWithTags(content)}
            </div>
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

            <button
              type="button"
              onClick={() => setShowComments(prev => !prev)}
              className={`flex items-center gap-1.5 rounded-lg transition-colors ${
                showComments
                  ? 'text-frog-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageCircle className="w-4 h-4 text-gray-400" />
              <span>{commentCount}</span>
            </button>

            {showComments ? (
              <button
                type="button"
                onClick={() => setShowComments(false)}
                className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                ปิด <X className="w-3 h-3" />
              </button>
            ) : (
              <div className="ml-auto">
                <span className="text-[10px] text-gray-300 uppercase tracking-wider">
                  Embedded Post
                </span>
              </div>
            )}
          </div>

          {/* Lightweight Comments */}
          {showComments && (
            <div className="mt-4 pt-4 border-t border-gray-100 max-h-[320px] overflow-y-auto pr-1">
              {isCommentsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-gray-300 text-[10px] font-black uppercase py-4">
                  ยังไม่มีความคิดเห็น
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    {comments.map(comment => renderCommentItem(comment))}
                  </div>

                  {commentCount > COMMENT_LIMIT && (
                    <a
                      href={postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 block text-center text-xs font-black text-frog-600 hover:underline"
                    >
                      ดูความคิดเห็นทั้งหมดบนเว็บหลัก
                    </a>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </article>
    </main>
  );
}

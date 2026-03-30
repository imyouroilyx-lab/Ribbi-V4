'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, Post, User } from '@/lib/supabase';
import { 
  Heart, 
  MessageCircle, 
  Trash2, 
  Image as ImageIcon, 
  X, 
  Edit2, 
  Send, 
  Loader2, 
  ChevronRight, 
  Smile, 
  Activity as ActivityIcon,
  MapPin,
  Check
} from 'lucide-react';
import { getRelativeTime } from '@/lib/utils';
import Link from 'next/link';

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  image_url?: string;
  parent_comment_id?: string;
  created_at: string;
  author?: User;
  replies?: Comment[];
}

interface PostCardProps {
  post: Post;
  currentUserId: string;
  onDelete?: (postId: string) => void;
  profileOwnerId?: string;
}

const LIKES_PER_PAGE = 20;

const LinkPreview = ({ url }: { url: string }) => {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      try {
        const res = await fetch(`https://api.dub.co/metatags?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && (json.title || json.image)) {
            setPreview({ title: json.title, description: json.description, image: json.image, publisher: new URL(url).hostname });
            return;
          }
        }
      } catch (e) {} finally { if (isMounted) setLoading(false); }
    };
    fetchPreview();
    return () => { isMounted = false; };
  }, [url]);

  if (loading || !preview || (!preview.title && !preview.image)) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mb-4 block border border-gray-100 rounded-2xl overflow-hidden bg-white hover:border-indigo-200 transition-all group">
      {preview.image && <div className="w-full h-40 overflow-hidden"><img src={preview.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" /></div>}
      <div className="p-3">
         <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">{preview.publisher}</p>
         <p className="text-sm font-bold text-gray-900 line-clamp-1">{preview.title}</p>
      </div>
    </a>
  );
};

export default function PostCardV3({ post: initialPost, currentUserId, onDelete, profileOwnerId }: PostCardProps) {
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editMood, setEditMood] = useState(post.mood || '');
  const [editActivity, setEditActivity] = useState(post.activity || '');
  const [editLocation, setEditLocation] = useState(post.location || '');
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  const [showLikeModal, setShowLikeModal] = useState(false);
  const [likedUsers, setLikedUsers] = useState<User[]>([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [likePage, setLikePage] = useState(0);
  const [hasMoreLikes, setHasMoreLikes] = useState(true);

  const [showCommentLikeModal, setShowCommentLikeModal] = useState(false);
  const [commentLikedUsers, setCommentLikedUsers] = useState<User[]>([]);
  const [isLoadingCommentLikes, setIsLoadingCommentLikes] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [commentImageUrl, setCommentImageUrl] = useState('');
  const [showCommentImageInput, setShowCommentImageInput] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [showReplyImageInput, setShowReplyImageInput] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [editCommentImageUrl, setEditCommentImageUrl] = useState('');

  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const [mentionConfig, setMentionConfig] = useState<{ show: boolean; query: string; type: 'comment' | 'reply' | null; replyId?: string; cursor: number; }>({ show: false, query: '', type: null, cursor: 0 });
  const [mentionResults, setMentionResults] = useState<any[]>([]);

  const canDeletePost = post.author_id === currentUserId || profileOwnerId === currentUserId;
  const canEditPost = post.author_id === currentUserId;

  const likeObserver = useRef<IntersectionObserver | null>(null);
  const lastLikeRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoadingLikes) return;
    if (likeObserver.current) likeObserver.current.disconnect();
    likeObserver.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreLikes) setLikePage(prev => prev + 1);
    });
    if (node) likeObserver.current.observe(node);
  }, [isLoadingLikes, hasMoreLikes]);

  // ✅ Optimization: ใช้ Parallel Fetching และเอา Realtime ต่อโพสต์ออกเพื่อเซฟ Disk IO
  useEffect(() => {
    const loadStats = async () => {
      const [lCount, cCount, isL] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
        supabase.from('likes').select('id').eq('post_id', post.id).eq('user_id', currentUserId).maybeSingle()
      ]);
      setLikeCount(lCount.count || 0);
      setCommentCount(cCount.count || 0);
      setIsLiked(!!isL.data);
    };
    loadStats();
    if (showComments) { loadComments(); loadCommentLikes(); }
  }, [post.id, showComments]);

  useEffect(() => { if (showLikeModal && likePage > 0) fetchLikedUsers(likePage); }, [likePage, showLikeModal]);

  const fetchLikedUsers = async (page: number, reset = false) => {
    if (isLoadingLikes) return;
    setIsLoadingLikes(true);
    const from = page * LIKES_PER_PAGE;
    const to = from + LIKES_PER_PAGE - 1;
    try {
      const { data } = await supabase.from('likes').select(`users (id, username, display_name, profile_img_url)` as any).eq('post_id', post.id).range(from, to);
      if (data) {
        const users = (data as any[]).map(item => item.users).filter(Boolean);
        setLikedUsers(prev => reset ? users : [...prev, ...users]);
        setHasMoreLikes(users.length === LIKES_PER_PAGE);
      }
    } catch (e) {} finally { setIsLoadingLikes(false); }
  };

  const handleLike = async () => {
    if (isLiked) {
      setIsLiked(false); setLikeCount(prev => prev - 1);
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
    } else {
      setIsLiked(true); setLikeCount(prev => prev + 1);
      await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
    }
  };

  const loadComments = async () => {
    const { data } = await supabase.from('comments').select('*, author:users(id, username, display_name, profile_img_url)').eq('post_id', post.id).order('created_at', { ascending: true });
    if (data) {
      const topLevel = data.filter(c => !c.parent_comment_id);
      const formatted = topLevel.map(c => ({ ...c, replies: data.filter(r => r.parent_comment_id === c.id) }));
      setComments(formatted as any);
    }
  };

  const loadCommentLikes = async () => {
    const commentIds = comments.flatMap(c => [c.id, ...(c.replies?.map(r => r.id) || [])]);
    if (commentIds.length === 0) return;
    const { data } = await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds);
    if (data) {
      const counts: Record<string, number> = {};
      const userLiked = new Set<string>();
      data.forEach(like => {
        counts[like.comment_id] = (counts[like.comment_id] || 0) + 1;
        if (like.user_id === currentUserId) userLiked.add(like.comment_id);
      });
      setCommentLikes(counts); setLikedComments(userLiked);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    const isAlreadyLiked = likedComments.has(commentId);
    setLikedComments(prev => {
      const next = new Set(prev);
      if (isAlreadyLiked) next.delete(commentId); else next.add(commentId);
      return next;
    });
    setCommentLikes(prev => ({ ...prev, [commentId]: (prev[commentId] || 0) + (isAlreadyLiked ? -1 : 1) }));
    if (isAlreadyLiked) await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId);
    else await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId });
  };

  const checkMention = async (val: string, cursor: number, type: 'comment' | 'reply', replyId?: string) => {
    const textBeforeCursor = val.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/(?:\s|^)@([a-zA-Z0-9_ก-๙]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionConfig({ show: true, query, type, replyId, cursor });
      const { data } = await supabase.from('users').select('id, username, display_name, profile_img_url').neq('id', currentUserId).ilike('display_name', `%${query}%`).limit(5);
      setMentionResults(data || []);
    } else setMentionConfig(prev => ({ ...prev, show: false }));
  };

  const insertMention = (user: any) => {
    const { type, cursor } = mentionConfig;
    const contentText = type === 'comment' ? newComment : replyContent;
    const textBeforeCursor = contentText.slice(0, cursor);
    const textAfterCursor = contentText.slice(cursor);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const newText = contentText.slice(0, lastAtPos) + `@[${user.display_name.replace(/[\[\]\(\)]/g, '')}](${user.username}) ` + textAfterCursor;
      if (type === 'comment') setNewComment(newText); else setReplyContent(newText);
    }
    setMentionConfig({ show: false, query: '', type: null, cursor: 0 });
  };

  const renderTextWithTags = useMemo(() => (text: string) => {
    if (!text) return null;
    const regex = /(@\[.*?\]\([a-zA-Z0-9_]+\)|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_ก-๙]+|https?:\/\/[^\s]+)/g;
    return text.split(regex).map((part, i) => {
      if (!part) return null;
      const mdMatch = part.match(/^@\[(.*?)\]\(([a-zA-Z0-9_]+)\)$/);
      if (mdMatch) return <Link key={i} href={`/profile/${mdMatch[2]}`} className="text-frog-600 font-bold hover:underline">{mdMatch[1]}</Link>;
      if (part.startsWith('#')) return <span key={i} className="text-blue-500 font-bold">{part}</span>;
      if (part.startsWith('http')) return <a key={i} href={part} target="_blank" className="text-blue-500 hover:underline">{part}</a>;
      return <span key={i}>{part}</span>;
    });
  }, []);

  const handleComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault(); if (!newComment.trim() && !commentImageUrl.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await supabase.from('comments').insert({ post_id: post.id, author_id: currentUserId, content: newComment.trim(), image_url: commentImageUrl.trim() || null });
      setNewComment(''); setCommentImageUrl(''); setShowCommentImageInput(false); loadComments(); setCommentCount(prev => prev + 1);
    } finally { setIsSubmitting(false); }
  };

  const handleReply = async (parentCommentId: string) => {
    if (!replyContent.trim() && !replyImageUrl.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await supabase.from('comments').insert({ post_id: post.id, author_id: currentUserId, content: replyContent.trim(), parent_comment_id: parentCommentId, image_url: replyImageUrl.trim() || null });
      setReplyContent(''); setReplyImageUrl(''); setReplyTo(null); loadComments(); setCommentCount(prev => prev + 1);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="card-minimal border border-gray-100 shadow-sm relative">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {post.author && <Link href={`/profile/${post.author.username}`} className="flex-shrink-0"><img src={post.author.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-gray-50" alt="" /></Link>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            {post.author && <Link href={`/profile/${post.author.username}`} className="font-black text-sm hover:text-frog-600">{post.author.display_name}</Link>}
            {post.mood && <span className="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full font-bold border border-yellow-100">รู้สึก {post.mood}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[9px] text-gray-400 font-bold uppercase">{getRelativeTime(post.created_at)}</p>
            {post.location && <span className="text-[9px] text-red-500 font-bold flex items-center gap-0.5 uppercase"><MapPin size={10} /> {post.location}</span>}
          </div>
        </div>
        {(canEditPost || canDeletePost) && (
          <div className="flex gap-1">
            {canEditPost && <button onClick={() => setIsEditingPost(!isEditingPost)} className="p-2 text-gray-300 hover:text-frog-600 transition-colors"><Edit2 size={16} /></button>}
            {canDeletePost && <button onClick={() => onDelete?.(post.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="text-sm text-gray-800 mb-4 whitespace-pre-wrap leading-relaxed">{renderTextWithTags(post.content || '')}</div>

      {/* ✅ Layout รูปภาพ: 1, 2, 3 (2 บน 1 ล่าง), 4 */}
      {post.images && post.images.length > 0 && (
        <div className={`grid gap-2 mb-4 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.images.map((img, i) => (
            <div key={i} className={`relative overflow-hidden rounded-2xl bg-gray-50 border border-gray-100 cursor-pointer hover:opacity-95 transition-all ${
              post.images!.length === 3 && i === 2 ? 'col-span-2 aspect-[16/8]' : 'aspect-[4/3]'
            }`} onClick={() => setSelectedImage(img)}>
              <img src={img} className="w-full h-full object-cover" loading="lazy" alt="" />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5"><button onClick={handleLike} className={`transition-all active:scale-75 ${isLiked ? 'text-red-500' : 'text-gray-400'}`}><Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} /></button><button onClick={() => { setLikedUsers([]); setShowLikeModal(true); fetchLikedUsers(0, true); }} className="text-xs font-black text-gray-500 hover:underline">{likeCount}</button></div>
        <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-2 text-xs font-black transition-colors ${showComments ? 'text-frog-600' : 'text-gray-400'}`}><MessageCircle className="w-5 h-5" /> {commentCount}</button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-50 space-y-4 animate-in fade-in duration-300">
          <form onSubmit={handleComment} className="space-y-2">
            <div className="flex gap-2 relative">
              <div className="relative flex-1">
                <input type="text" value={newComment} onChange={(e) => { setNewComment(e.target.value); checkMention(e.target.value, e.target.selectionStart || 0, 'comment'); }} onKeyDown={(e) => e.key === 'Enter' && mentionConfig.show && e.preventDefault()} placeholder="เขียนความคิดเห็น..." className="input-minimal w-full text-sm py-2 px-4 bg-gray-50 border-gray-100 rounded-xl outline-none" disabled={isSubmitting} />
                {mentionConfig.show && mentionConfig.type === 'comment' && mentionResults.length > 0 && (
                  <div className="absolute z-20 left-0 bottom-full mb-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                    {mentionResults.map(user => (<button key={user.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => insertMention(user)} className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left transition"><img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-6 h-6 rounded-full" /><p className="text-xs font-bold truncate">{user.display_name}</p></button>))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={(!newComment.trim() && !commentImageUrl.trim()) || isSubmitting} className="p-2 bg-frog-500 text-white rounded-xl hover:bg-frog-600 transition-all"><Send size={18} /></button>
            </div>
          </form>
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <img src={c.author?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover" alt="" />
                <div className="flex-1">
                  <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block relative group">
                    <p className="font-bold text-[11px] text-gray-900">{c.author?.display_name}</p>
                    <p className="text-sm text-gray-800">{renderTextWithTags(c.content)}</p>
                    {c.image_url && <img src={c.image_url} className="mt-2 rounded-lg max-h-40 object-cover" alt="" />}
                  </div>
                  <div className="flex items-center gap-4 mt-1 ml-2 text-[10px] font-bold text-gray-400">
                    <span>{getRelativeTime(c.created_at)}</span>
                    <button onClick={() => handleCommentLike(c.id)} className={likedComments.has(c.id) ? 'text-red-500' : ''}>ถูกใจ</button>
                    {!c.parent_comment_id && <button onClick={() => { setReplyTo(c.id); setReplyContent(`@[${c.author?.display_name}](${c.author?.username}) `); }}>ตอบกลับ</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showLikeModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowLikeModal(false)}>
          <div className="bg-white w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[60vh]" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between"><h3 className="font-black text-xs uppercase tracking-widest">คนที่ถูกใจ</h3><button onClick={() => setShowLikeModal(false)}><X size={18} /></button></div>
            <div className="flex-1 overflow-y-auto p-2">
              {likedUsers.map((u, i) => (<Link key={i} href={`/profile/${u.username}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors"><img src={u.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full" /><div><p className="text-xs font-bold">{u.display_name}</p><p className="text-[9px] text-gray-400">@{u.username}</p></div></Link>))}
              <div ref={lastLikeRef} className="h-4 w-full" />
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} className="max-w-full max-h-full rounded-lg shadow-2xl" alt="" />
        </div>
      )}
    </div>
  );
}

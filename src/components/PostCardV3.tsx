'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Post, User } from '@/lib/supabase';
import { Heart, MessageCircle, Trash2, Image as ImageIcon, X, Edit2, Send, Loader2, ChevronRight } from 'lucide-react';
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
        const res1 = await fetch(`https://api.dub.co/metatags?url=${encodeURIComponent(url)}`);
        if (res1.ok) {
          const json1 = await res1.json();
          if (isMounted && (json1.title || json1.image)) {
            setPreview({ title: json1.title, description: json1.description, image: json1.image, publisher: new URL(url).hostname });
            setLoading(false);
            return;
          }
        }
      } catch (error) { }

      try {
        const res2 = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        if (res2.ok) {
          const json2 = await res2.json();
          if (isMounted && json2.status === 'success') {
            setPreview({ title: json2.data.title, description: json2.data.description, image: json2.data.image?.url || json2.data.logo?.url, publisher: json2.data.publisher });
          }
        }
      } catch (error) { } finally { if (isMounted) setLoading(false); }
    };
    fetchPreview();
    return () => { isMounted = false; };
  }, [url]);

  if (loading) return <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden animate-pulse"><div className="w-full h-40 bg-gray-200"></div></div>;
  if (!preview || (!preview.title && !preview.image)) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mb-4 block border border-gray-200 rounded-xl hover:shadow-md transition overflow-hidden bg-gray-50 group">
      {preview.image && <div className="w-full h-48 md:h-64 overflow-hidden border-b border-gray-200"><img src={preview.image} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="" /></div>}
      <div className="p-3 md:p-4 bg-white">
         <p className="text-[10px] text-gray-500 font-semibold mb-1 uppercase">{preview.publisher}</p>
         <p className="text-sm md:text-base font-bold text-gray-900 line-clamp-2">{preview.title}</p>
         {preview.description && <p className="text-xs md:text-sm text-gray-600 mt-1 line-clamp-2">{preview.description}</p>}
      </div>
    </a>
  );
};

export default function PostCardV3({ post, currentUserId, onDelete, profileOwnerId }: PostCardProps) {
  // Post States
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Like List States
  const [showLikeModal, setShowLikeModal] = useState(false);
  const [likedUsers, setLikedUsers] = useState<User[]>([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [likePage, setLikePage] = useState(0);
  const [hasMoreLikes, setHasMoreLikes] = useState(true);

  // Comment States
  const [newComment, setNewComment] = useState('');
  const [commentImageUrl, setCommentImageUrl] = useState('');
  const [showCommentImageInput, setShowCommentImageInput] = useState(false);

  // Reply States
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [showReplyImageInput, setShowReplyImageInput] = useState(false);

  // Edit Comment States
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [editCommentImageUrl, setEditCommentImageUrl] = useState('');

  // Comment Interaction States
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const canDeletePost = post.author_id === currentUserId || profileOwnerId === currentUserId;
  const canEditPost = post.author_id === currentUserId;

  // Like List Infinite Scroll Observer
  const likeObserver = useRef<IntersectionObserver | null>(null);
  const lastLikeRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoadingLikes) return;
    if (likeObserver.current) likeObserver.current.disconnect();
    likeObserver.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreLikes) {
        setLikePage(prev => prev + 1);
      }
    });
    if (node) likeObserver.current.observe(node);
  }, [isLoadingLikes, hasMoreLikes]);

  useEffect(() => {
    loadLikeCount();
    checkIfLiked();
    loadCommentCount();
    
    if (showComments) {
      loadComments();
      loadCommentLikes();
    }

    const channel = supabase
      .channel(`post-updates-${post.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${post.id}` }, () => {
        loadLikeCount();
        if (showLikeModal) fetchLikedUsers(0, true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` }, () => {
        loadComments();
        loadCommentCount();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, () => {
        if (showComments) loadCommentLikes();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [post.id, showComments]);

  useEffect(() => {
    if (showLikeModal && likePage > 0) {
      fetchLikedUsers(likePage);
    }
  }, [likePage, showLikeModal]);

  const loadLikeCount = async () => {
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    setLikeCount(count || 0);
  };

  const loadCommentCount = async () => {
    const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    setCommentCount(count || 0);
  };

  const checkIfLiked = async () => {
    const { data } = await supabase.from('likes').select('id').eq('post_id', post.id).eq('user_id', currentUserId).maybeSingle();
    setIsLiked(!!data);
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

  const openLikeModal = () => {
    setLikedUsers([]);
    setLikePage(0);
    setHasMoreLikes(true);
    setShowLikeModal(true);
    fetchLikedUsers(0, true);
  };

  const fetchLikedUsers = async (page: number, reset = false) => {
    if (isLoadingLikes) return;
    setIsLoadingLikes(true);
    const from = page * LIKES_PER_PAGE;
    const to = from + LIKES_PER_PAGE - 1;

    try {
      // ✅ แก้ไข Type Error: ใช้ unknown casting เพื่อหลีกเลี่ยง Type Overlap
      const { data, error: fetchError } = await supabase
        .from('likes')
        .select(`
          users (
            id, 
            username, 
            display_name, 
            profile_img_url, 
            created_at, 
            updated_at
          )
        `)
        .eq('post_id', post.id)
        .range(from, to);

      if (fetchError) throw fetchError;

      if (data) {
        // กรองและ Map ข้อมูลออกมาเป็น User[]
        const users = (data as any[]).map(item => item.users).filter(Boolean) as unknown as User[];
        setLikedUsers(prev => reset ? users : [...prev, ...users]);
        setHasMoreLikes(users.length === LIKES_PER_PAGE);
      }
    } catch (error) {
      console.error('Error fetching liked users:', error);
    } finally {
      setIsLoadingLikes(false);
    }
  };

  const loadComments = async () => {
    try {
      const { data } = await supabase
        .from('comments')
        .select('*, author:users(id, username, display_name, profile_img_url)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (data) {
        const topLevel = data.filter(c => !c.parent_comment_id);
        const formatted = topLevel.map(c => ({
          ...c,
          replies: data.filter(r => r.parent_comment_id === c.id)
        }));
        setComments(formatted as any);
      }
    } catch (error) { console.error(error); }
  };

  const loadCommentLikes = async () => {
    try {
      const commentIds = comments.flatMap(c => [c.id, ...(c.replies?.map(r => r.id) || [])]);
      if (commentIds.length === 0) return;

      const { data: allLikes } = await supabase
        .from('comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds);

      if (allLikes) {
        const counts: Record<string, number> = {};
        const userLiked = new Set<string>();
        allLikes.forEach(like => {
          counts[like.comment_id] = (counts[like.comment_id] || 0) + 1;
          if (like.user_id === currentUserId) userLiked.add(like.comment_id);
        });
        setCommentLikes(counts);
        setLikedComments(userLiked);
      }
    } catch (error) { console.error(error); }
  };

  const handleCommentLike = async (commentId: string) => {
    const isAlreadyLiked = likedComments.has(commentId);
    const newLiked = new Set(likedComments);
    if (isAlreadyLiked) {
      newLiked.delete(commentId);
      setCommentLikes(prev => ({ ...prev, [commentId]: (prev[commentId] || 1) - 1 }));
    } else {
      newLiked.add(commentId);
      setCommentLikes(prev => ({ ...prev, [commentId]: (prev[commentId] || 0) + 1 }));
    }
    setLikedComments(newLiked);
    try {
      if (isAlreadyLiked) await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId);
      else await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId });
    } catch (error) { console.error(error); loadCommentLikes(); }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && !commentImageUrl.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: post.id,
        author_id: currentUserId,
        content: newComment.trim(),
        image_url: commentImageUrl.trim() || null
      });
      if (error) throw error;
      setNewComment(''); setCommentImageUrl(''); setShowCommentImageInput(false);
      loadComments();
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleReply = async (parentCommentId: string) => {
    if (!replyContent.trim() && !replyImageUrl.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: post.id,
        author_id: currentUserId,
        content: replyContent.trim(),
        parent_comment_id: parentCommentId,
        image_url: replyImageUrl.trim() || null
      });
      if (error) throw error;
      setReplyContent(''); setReplyImageUrl(''); setReplyTo(null); setShowReplyImageInput(false);
      loadComments();
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleDeleteComment = async (id: string) => {
    if (!confirm('ยืนยันการลบความคิดเห็นนี้?')) return;
    try {
      await supabase.from('comments').delete().eq('id', id);
      setComments(prev => prev.filter(c => c.id !== id));
      loadCommentCount();
    } catch (error) { console.error(error); }
  };

  const handleUpdateComment = async (id: string) => {
    if (!editCommentContent.trim() && !editCommentImageUrl.trim()) return;
    setIsSubmitting(true);
    try {
      await supabase.from('comments').update({
        content: editCommentContent.trim(),
        image_url: editCommentImageUrl.trim() || null
      }).eq('id', id);
      setEditingCommentId(null);
      loadComments();
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const renderTextWithTags = (text: string) => {
    if (!text) return null;
    const regex = /(@\[.*?\]\([a-zA-Z0-9_]+\)|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_ก-๙]+|https?:\/\/[^\s]+)/g;
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (!part) return null;
      const mdMatch = part.match(/^@\[(.*?)\]\(([a-zA-Z0-9_]+)\)$/);
      if (mdMatch) return <Link key={i} href={`/profile/${mdMatch[2]}`} className="text-frog-600 font-semibold hover:underline">{mdMatch[1]}</Link>;
      
      if (part.startsWith('#')) return (
        <span 
          key={i} 
          onClick={(e) => e.preventDefault()} 
          className="text-blue-500 font-bold hover:underline cursor-pointer transition-all"
        >
          {part}
        </span>
      );
      
      if (part.startsWith('http')) return <a key={i} href={part} target="_blank" className="text-blue-500 hover:underline">{part}</a>;
      return <span key={i}>{part}</span>;
    });
  };

  const renderComment = (c: Comment, isReply: boolean = false) => {
    const isEditing = editingCommentId === c.id;
    const canManageComment = c.author_id === currentUserId || post.author_id === currentUserId || profileOwnerId === currentUserId;

    return (
      <div key={c.id} className={`${isReply ? 'ml-10 mt-3' : 'mb-4 animate-in fade-in slide-in-from-top-1'}`}>
        <div className="flex gap-3">
          <Link href={`/profile/${c.author?.username}`} className="flex-shrink-0">
            <img src={c.author?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className={`${isReply ? 'w-7 h-7' : 'w-8 h-8'} rounded-full object-cover border border-gray-100 shadow-sm`} alt="" loading="lazy" />
          </Link>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <textarea 
                  value={editCommentContent}
                  onChange={(e) => setEditCommentContent(e.target.value)}
                  className="input-minimal w-full text-sm"
                  rows={2}
                />
                <input 
                  type="text"
                  value={editCommentImageUrl}
                  onChange={(e) => setEditCommentImageUrl(e.target.value)}
                  placeholder="URL รูปภาพใหม่..."
                  className="input-minimal w-full text-[10px]"
                />
                <div className="flex gap-2">
                  <button onClick={() => handleUpdateComment(c.id)} className="btn-primary py-1 px-3 text-xs">บันทึก</button>
                  <button onClick={() => setEditingCommentId(null)} className="btn-secondary py-1 px-3 text-xs">ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-2xl px-3 py-2 relative group border border-transparent hover:border-gray-200 transition-colors">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-bold text-xs text-gray-900">{c.author?.display_name}</p>
                  {canManageComment && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {c.author_id === currentUserId && (
                        <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); setEditCommentImageUrl(c.image_url || ''); }} className="text-gray-400 hover:text-frog-600"><Edit2 size={12} /></button>
                      )}
                      <button onClick={() => handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{renderTextWithTags(c.content)}</p>
                {c.image_url && (
                  <img src={c.image_url} className="mt-2 rounded-xl max-h-60 object-cover cursor-pointer hover:brightness-95 transition shadow-sm" onClick={() => setSelectedImage(c.image_url!)} alt="" />
                )}
                {(commentLikes[c.id] || 0) > 0 && (
                  <div className="absolute -bottom-2 -right-1 bg-white shadow-sm border border-gray-100 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                    <Heart size={10} className="fill-red-500 text-red-500" />
                    <span className="text-[10px] font-bold text-gray-500">{commentLikes[c.id]}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-4 mt-1 ml-2">
              <span className="text-[10px] text-gray-400">{getRelativeTime(c.created_at)}</span>
              <button onClick={() => handleCommentLike(c.id)} className={`text-[10px] font-bold transition-colors ${likedComments.has(c.id) ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}>ถูกใจ</button>
              {!isReply && (
                <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyContent(''); setReplyImageUrl(''); setShowReplyImageInput(false); }} className="text-[10px] font-bold text-gray-500 hover:text-frog-600">ตอบกลับ</button>
              )}
            </div>

            {replyTo === c.id && (
              <div className="mt-3 animate-in slide-in-from-left-2 duration-200">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={`ตอบกลับคุณ ${c.author?.display_name.split(' ')[0]}...`}
                      className="input-minimal w-full text-xs py-1.5 pr-8"
                      autoFocus
                    />
                    <button onClick={() => handleReply(c.id)} disabled={(!replyContent.trim() && !replyImageUrl.trim()) || isSubmitting} className="absolute right-2 top-1/2 -translate-y-1/2 text-frog-600 disabled:opacity-30">
                      <Send size={14} />
                    </button>
                  </div>
                  <button onClick={() => setShowReplyImageInput(!showReplyImageInput)} className={`p-1.5 rounded-lg transition ${showReplyImageInput ? 'bg-frog-100 text-frog-600' : 'text-gray-400 hover:text-frog-600'}`}>
                    <ImageIcon size={16} />
                  </button>
                </div>
                {showReplyImageInput && (
                  <input type="text" value={replyImageUrl} onChange={(e) => setReplyImageUrl(e.target.value)} placeholder="ใส่ URL รูปภาพตอบกลับ..." className="mt-2 input-minimal w-full text-[10px] py-1 animate-in fade-in" />
                )}
              </div>
            )}

            {c.replies && c.replies.length > 0 && (
              <div className="space-y-1">
                {c.replies.map(reply => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="card-minimal border border-gray-100 shadow-sm relative">
      <div className="flex items-start gap-3 mb-4">
        {post.author && (
          <Link href={`/profile/${post.author.username}`} className="flex-shrink-0">
            <img src={post.author.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border border-gray-50 shadow-sm" alt="" loading="lazy" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {post.author && <Link href={`/profile/${post.author.username}`} className="font-black text-sm md:text-base hover:text-frog-600 transition-colors">{post.author.display_name}</Link>}
            {post.author_id !== post.target_id && post.target && <><span className="text-gray-300">→</span><Link href={`/profile/${post.target.username}`} className="font-bold text-sm text-frog-600">{post.target.display_name}</Link></>}
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{getRelativeTime(post.created_at)} {post.location && `· ${post.location}`}</p>
        </div>
        {(canEditPost || canDeletePost) && (
          <div className="flex gap-1">
            {canEditPost && <button onClick={() => setIsEditingPost(!isEditingPost)} className="p-2 text-gray-300 hover:text-frog-600 transition-colors"><Edit2 size={16} /></button>}
            {canDeletePost && <button onClick={() => onDelete?.(post.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>}
          </div>
        )}
      </div>

      <div className="text-sm md:text-base text-gray-800 mb-4 whitespace-pre-wrap break-words leading-relaxed">
        {renderTextWithTags(post.content || '')}
      </div>
      {renderEmbeds(post.content || '')}

      {post.images && post.images.length > 0 && (
        <div className={`grid gap-2 mb-4 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.images.map((img, i) => (
            <div key={i} className="relative overflow-hidden rounded-2xl bg-gray-50 aspect-[4/3] border border-gray-100">
              <img src={img} className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-500" onClick={() => setSelectedImage(img)} loading="lazy" alt="" />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-6 pt-4 border-t border-gray-50">
        <div className="flex items-center gap-1.5 group/like">
          <button onClick={handleLike} className={`transition-all active:scale-90 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}>
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          <button onClick={openLikeModal} className="text-xs font-black text-gray-500 hover:underline">
            {likeCount}
          </button>
        </div>

        <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-2 transition-colors ${showComments ? 'text-frog-600' : 'text-gray-400 hover:text-frog-600'}`}>
          <MessageCircle className="w-5 h-5" />
          <span className="text-xs font-black">{commentCount}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-50 space-y-4 animate-in fade-in duration-300">
          <form onSubmit={handleComment} className="space-y-2">
            <div className="flex gap-2">
              <input 
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="เขียนความคิดเห็นของคุณ..."
                className="input-minimal flex-1 text-sm py-2 px-4 shadow-inner"
                disabled={isSubmitting}
              />
              <button 
                type="button" 
                onClick={() => setShowCommentImageInput(!showCommentImageInput)}
                className={`p-2 rounded-xl transition ${showCommentImageInput ? 'bg-frog-100 text-frog-600' : 'text-gray-400 hover:text-frog-600'}`}
              >
                <ImageIcon size={20} />
              </button>
              <button 
                type="submit" 
                disabled={(!newComment.trim() && !commentImageUrl.trim()) || isSubmitting}
                className="p-2.5 bg-frog-500 text-white rounded-xl disabled:opacity-50 shadow-sm hover:bg-frog-600 transition-all"
              >
                <Send size={18} />
              </button>
            </div>
            {showCommentImageInput && (
              <input 
                type="text" 
                value={commentImageUrl} 
                onChange={(e) => setCommentImageUrl(e.target.value)} 
                placeholder="ใส่ URL รูปภาพ..." 
                className="input-minimal w-full text-xs py-1.5 animate-in slide-in-from-top-1"
              />
            )}
          </form>

          <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
            {comments.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-300 text-xs font-bold uppercase tracking-widest italic">No comments yet</p>
              </div>
            ) : (
              comments.map(c => renderComment(c))
            )}
          </div>
        </div>
      )}

      {/* --- Modals --- */}
      {showLikeModal && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowLikeModal(false)}>
          <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-black text-gray-900 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                <Heart size={14} className="text-red-500 fill-current" /> People who liked
              </h3>
              <button onClick={() => setShowLikeModal(false)} className="p-1.5 hover:bg-white rounded-full transition shadow-sm"><X size={18} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              {likedUsers.length === 0 && !isLoadingLikes ? (
                <div className="py-10 text-center text-gray-400 italic text-sm">No likes yet.</div>
              ) : (
                <div className="space-y-1">
                  {likedUsers.map((user, idx) => (
                    <Link key={`${user.id}-${idx}`} href={`/profile/${user.username}`} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl transition-colors group">
                      <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate">{user.display_name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">@{user.username}</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </Link>
                  ))}
                  
                  <div ref={lastLikeRef} className="h-4 w-full flex justify-center py-6">
                    {isLoadingLikes && <Loader2 size={20} className="animate-spin text-frog-500" />}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 bg-black/95 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 text-white hover:scale-110 transition"><X size={32} /></button>
          <img src={selectedImage} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" alt="" />
        </div>
      )}
    </div>
  );

  function renderEmbeds(text: string) {
    const urls = text.match(/(https?:\/\/[^\s]+)/g);
    if (!urls) return null;
    const ytMatch = urls[0].match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    if (ytMatch && ytMatch[2].length === 11) {
      return (
        <div className="mb-4 rounded-2xl overflow-hidden relative pt-[56.25%] w-full shadow-lg border border-gray-100">
          <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${ytMatch[2]}`} allowFullScreen></iframe>
        </div>
      );
    }
    return <LinkPreview url={urls[0]} />;
  }
}

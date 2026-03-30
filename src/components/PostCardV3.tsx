'use client';

import { useState, useEffect } from 'react';
import { supabase, Post, User } from '@/lib/supabase';
import { Heart, MessageCircle, Trash2, MapPin, Image as ImageIcon, X, Edit2, Check, Link2, Send } from 'lucide-react';
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // States สำหรับคอมเมนต์และตอบกลับ
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [commentImageUrl, setCommentImageUrl] = useState('');
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [showCommentImageInput, setShowCommentImageInput] = useState(false);

  // ✅ States สำหรับการไลก์คอมเมนต์
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const canDelete = post.author_id === currentUserId || profileOwnerId === currentUserId;
  const canEdit = post.author_id === currentUserId;

  useEffect(() => {
    loadLikes();
    checkIfLiked();
    loadCommentCount();
    
    if (showComments) {
      loadComments();
      loadCommentLikes();
    }

    const channel = supabase
      .channel(`post-updates-${post.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${post.id}` }, () => loadLikes())
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

  const loadCommentCount = async () => {
    const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    setCommentCount(count || 0);
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

  // ✅ โหลดไลก์ของคอมเมนต์ทั้งหมดในโพสต์นี้
  const loadCommentLikes = async () => {
    try {
      const { data: allLikes } = await supabase
        .from('comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', comments.flatMap(c => [c.id, ...(c.replies?.map(r => r.id) || [])]));

      if (allLikes) {
        const counts: Record<string, number> = {};
        const userLiked = new Set<string>();
        
        allLikes.forEach(like => {
          counts[like.comment_id] = (counts[like.comment_id] || 0) + 1;
          if (like.user_id === currentUserId) {
            userLiked.add(like.comment_id);
          }
        });
        
        setCommentLikes(counts);
        setLikedComments(userLiked);
      }
    } catch (error) { console.error(error); }
  };

  const loadLikes = async () => {
    const { data } = await supabase.from('likes').select('user_id').eq('post_id', post.id);
    if (data) setLikeCount(data.length);
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

  // ✅ ฟังก์ชันไลก์คอมเมนต์
  const handleCommentLike = async (commentId: string) => {
    const isAlreadyLiked = likedComments.has(commentId);
    
    // Optimistic Update
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
      if (isAlreadyLiked) {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId);
      } else {
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId });
      }
    } catch (error) {
      console.error(error);
      loadCommentLikes(); // Rollback if error
    }
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
      setNewComment('');
      setCommentImageUrl('');
      setShowCommentImageInput(false);
      loadComments();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
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
      setReplyContent('');
      setReplyImageUrl('');
      setReplyTo(null);
      loadComments();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTextWithTags = (text: string) => {
    if (!text) return null;
    const regex = /(@\[.*?\]\([a-zA-Z0-9_]+\)|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_ก-๙]+|https?:\/\/[^\s]+)/g;
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (!part) return null;
      const mdMatch = part.match(/^@\[(.*?)\]\(([a-zA-Z0-9_]+)\)$/);
      if (mdMatch) return <Link key={i} href={`/profile/${mdMatch[2]}`} className="text-frog-600 font-semibold">{mdMatch[1]}</Link>;
      if (part.startsWith('#')) return <span key={i} className="text-blue-500 font-medium">{part}</span>;
      if (part.startsWith('http')) return <a key={i} href={part} target="_blank" className="text-blue-500 hover:underline">{part}</a>;
      return <span key={i}>{part}</span>;
    });
  };

  const renderComment = (c: Comment, isReply: boolean = false) => (
    <div key={c.id} className={`${isReply ? 'ml-10 mt-3' : 'mb-4'}`}>
      <div className="flex gap-3">
        <Link href={`/profile/${c.author?.username}`} className="flex-shrink-0">
          <img src={c.author?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className={`${isReply ? 'w-7 h-7' : 'w-8 h-8'} rounded-full object-cover`} alt="" loading="lazy" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="bg-gray-100 rounded-2xl px-3 py-2 relative group">
            <p className="font-bold text-xs">{c.author?.display_name}</p>
            <p className="text-sm">{renderTextWithTags(c.content)}</p>
            {c.image_url && (
              <img src={c.image_url} className="mt-2 rounded-xl max-h-40 object-cover cursor-pointer" onClick={() => setSelectedImage(c.image_url!)} alt="" />
            )}
            
            {/* จำนวนไลก์คอมเมนต์มุมขวาล่าง */}
            {(commentLikes[c.id] || 0) > 0 && (
              <div className="absolute -bottom-2 -right-1 bg-white shadow-sm border border-gray-100 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                <Heart size={10} className="fill-red-500 text-red-500" />
                <span className="text-[10px] font-bold text-gray-500">{commentLikes[c.id]}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4 mt-1 ml-2">
            <span className="text-[10px] text-gray-400">{getRelativeTime(c.created_at)}</span>
            
            {/* ✅ ไลก์คอมเมนต์ */}
            <button 
              onClick={() => handleCommentLike(c.id)}
              className={`text-[10px] font-bold transition-colors ${likedComments.has(c.id) ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
            >
              ถูกใจ
            </button>

            {!isReply && (
              <button 
                onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyImageUrl(''); }} 
                className="text-[10px] font-bold text-gray-500 hover:text-frog-600"
              >
                ตอบกลับ
              </button>
            )}
          </div>

          {/* ช่องตอบกลับ */}
          {replyTo === c.id && (
            <div className="mt-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`ตอบกลับ ${c.author?.display_name}...`}
                    className="input-minimal w-full text-xs py-1.5"
                    autoFocus
                  />
                  <button 
                    onClick={() => handleReply(c.id)}
                    disabled={(!replyContent.trim() && !replyImageUrl.trim()) || isSubmitting}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-frog-600 disabled:opacity-30"
                  >
                    <Send size={14} />
                  </button>
                </div>
                <button 
                  onClick={() => setShowCommentImageInput(true)} 
                  className="p-1.5 text-gray-400 hover:text-frog-600"
                >
                  <ImageIcon size={16} />
                </button>
              </div>
              <input 
                type="text" 
                value={replyImageUrl} 
                onChange={(e) => setReplyImageUrl(e.target.value)} 
                placeholder="URL รูปภาพตอบกลับ..." 
                className="mt-2 input-minimal w-full text-[10px] py-1"
              />
            </div>
          )}

          {/* รายการตอบกลับ */}
          {c.replies && c.replies.length > 0 && (
            <div className="space-y-1">
              {c.replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="card-minimal">
      <div className="flex items-start gap-3 mb-4">
        {post.author && (
          <Link href={`/profile/${post.author.username}`} className="flex-shrink-0">
            <img src={post.author.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover" alt="" loading="lazy" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {post.author && <Link href={`/profile/${post.author.username}`} className="font-bold text-sm md:text-base hover:underline">{post.author.display_name}</Link>}
            {post.author_id !== post.target_id && post.target && <><span className="text-gray-400">→</span><Link href={`/profile/${post.target.username}`} className="font-bold text-sm text-frog-600">{post.target.display_name}</Link></>}
          </div>
          <p className="text-xs text-gray-500">{getRelativeTime(post.created_at)} {post.location && `· ${post.location}`}</p>
        </div>
        {(canEdit || canDelete) && (
          <div className="flex gap-1">
            {canEdit && <button onClick={() => setIsEditingPost(!isEditingPost)} className="p-2 text-gray-400 hover:text-frog-600"><Edit2 className="w-4 h-4" /></button>}
            {canDelete && <button onClick={() => onDelete?.(post.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
          </div>
        )}
      </div>

      <div className="text-sm md:text-base text-gray-800 mb-4 whitespace-pre-wrap break-words">
        {renderTextWithTags(post.content || '')}
      </div>
      {renderEmbeds(post.content || '')}

      {post.images && post.images.length > 0 && (
        <div className={`grid gap-2 mb-4 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.images.map((img, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl bg-gray-100 aspect-[4/3]">
              <img src={img} className="w-full h-full object-cover cursor-pointer" onClick={() => setSelectedImage(img)} loading="lazy" alt="" />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
        <button onClick={handleLike} className={`flex items-center gap-1.5 transition ${isLiked ? 'text-red-500' : 'text-gray-500'}`}>
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          <span className="text-sm font-bold">{likeCount}</span>
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-gray-500 hover:text-frog-600 transition">
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-bold">{commentCount}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-50 space-y-4">
          {/* ช่องส่งคอมเมนต์ */}
          <form onSubmit={handleComment} className="space-y-2">
            <div className="flex gap-2">
              <input 
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="เขียนความคิดเห็น..."
                className="input-minimal flex-1 text-sm py-2"
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
                className="p-2 bg-frog-500 text-white rounded-xl disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
            {showCommentImageInput && (
              <input 
                type="text" 
                value={commentImageUrl} 
                onChange={(e) => setCommentImageUrl(e.target.value)} 
                placeholder="ใส่ URL รูปภาพสำหรับคอมเมนต์..." 
                className="input-minimal w-full text-xs py-1.5"
              />
            )}
          </form>

          {/* รายการคอมเมนต์ */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar">
            {comments.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-2 italic">ยังไม่มีความคิดเห็น</p>
            ) : (
              comments.map(c => renderComment(c))
            )}
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-4 right-4 text-white"><X size={32} /></button>
          <img src={selectedImage} className="max-w-full max-h-full object-contain" alt="" />
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
        <div className="mb-4 rounded-xl overflow-hidden relative pt-[56.25%] w-full">
          <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${ytMatch[2]}`} allowFullScreen></iframe>
        </div>
      );
    }
    return <LinkPreview url={urls[0]} />;
  }
}

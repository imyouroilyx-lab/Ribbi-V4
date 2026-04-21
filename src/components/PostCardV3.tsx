'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, Post, User } from '../lib/supabase';
import { 
  Heart, MessageCircle, Trash2, Image as ImageIcon, 
  X, Edit2, Send, Loader2, ChevronRight, MapPin, 
  Link as LinkIcon, AtSign, BadgeCheck, Sparkles
} from 'lucide-react';
import { getRelativeTime } from '../lib/utils';
import Link from 'next/link';
import { LIFE_EVENTS, decodeLifeEvent } from './CreatePostV3';

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

function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const LinkPreview = ({ url }: { url: string }) => {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      try {
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.status === 'success' && (json.data.title || json.data.image)) {
            setPreview({ 
              title: json.data.title, 
              description: json.data.description, 
              image: json.data.image?.url || json.data.logo?.url, 
              publisher: json.data.publisher || new URL(url).hostname 
            });
          }
        }
      } catch (e) {} finally { if (isMounted) setLoading(false); }
    };
    fetchPreview();
    return () => { isMounted = false; };
  }, [url]);

  if (loading) return <div className="mb-4 h-24 border border-gray-100 rounded-2xl bg-gray-50 animate-pulse flex items-center justify-center"><LinkIcon size={24} className="text-gray-300" /></div>;
  if (!preview || (!preview.title && !preview.image)) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mb-4 block border border-gray-100 rounded-2xl overflow-hidden bg-white hover:border-frog-300 transition-all group shadow-sm">
      {preview.image && <div className="w-full h-48 overflow-hidden bg-gray-50 border-b border-gray-50"><img src={preview.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" /></div>}
      <div className="p-3 bg-gray-50/30">
         <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">{preview.publisher}</p>
         <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight mb-1">{preview.title}</p>
         {preview.description && <p className="text-xs text-gray-500 line-clamp-2">{preview.description}</p>}
      </div>
    </a>
  );
};

// ✅ Life Event Banner — แสดงใน PostCard
const LifeEventBanner = ({ raw }: { raw: string }) => {
  const { event, value } = decodeLifeEvent(raw);
  if (!event || !value) return null;

  return (
    <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl border ${event.bg} ${event.border}`}>
      <span className="text-3xl leading-none">{event.emoji}</span>
      <div className="min-w-0">
        <p className={`text-[10px] font-black uppercase tracking-widest ${event.color} opacity-70`}>
          เหตุการณ์สำคัญในชีวิต
        </p>
        <p className={`text-sm font-black ${event.color}`}>
          {event.label}{' '}
          <span className="opacity-90">{value}</span>
        </p>
      </div>
      <Sparkles size={16} className={`ml-auto flex-shrink-0 ${event.color} opacity-50`} />
    </div>
  );
};

export default function PostCardV3({ post: initialPost, currentUserId, onDelete, profileOwnerId }: PostCardProps) {
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');

  const [showLikersModal, setShowLikersModal] = useState(false);
  const [likers, setLikers] = useState<any[]>([]); 
  const [isLoadingLikers, setIsLoadingLikers] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const CONTENT_LIMIT = 300;

  const [newComment, setNewComment] = useState('');
  const [commentImageUrl, setCommentImageUrl] = useState('');
  const [showCommentImageInput, setShowCommentImageInput] = useState(false);
  
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [showReplyImageInput, setShowReplyImageInput] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const [friends, setFriends] = useState<User[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [activeInput, setActiveInput] = useState<'comment' | 'reply' | 'edit_comment' | null>(null);
  const [hasLoadedFriends, setHasLoadedFriends] = useState(false);

  useEffect(() => {
    setPost(initialPost);
    setEditContent(initialPost.content || '');
  }, [initialPost]);

  useEffect(() => {
    if (showComments && !hasLoadedFriends) {
      const loadFriends = async () => {
        const { data } = await supabase.from('friendships').select(`sender:sender_id(*), receiver:receiver_id(*)`).eq('status', 'accepted').or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);
        if (data) {
          const list = data.map((f: any) => f.sender.id === currentUserId ? f.receiver : f.sender);
          setFriends(list);
          setHasLoadedFriends(true);
        }
      };
      loadFriends();
    }
  }, [showComments, currentUserId, hasLoadedFriends]);

  const filteredFriends = useMemo(() => {
    if (!mentionSearch && showMentionMenu) return friends.slice(0, 5);
    return friends.filter(f => f.display_name.toLowerCase().includes(mentionSearch.toLowerCase()) || f.username.toLowerCase().includes(mentionSearch.toLowerCase())).slice(0, 5);
  }, [friends, mentionSearch, showMentionMenu]);

  const handleInputChange = (val: string, type: 'comment' | 'reply' | 'edit_comment') => {
    if (type === 'comment') setNewComment(val); else if (type === 'reply') setReplyContent(val); else setEditCommentContent(val);
    const mentionMatch = val.match(/@([a-zA-Z0-9_ก-๙]*)$/);
    if (mentionMatch) { setMentionSearch(mentionMatch[1]); setShowMentionMenu(true); setActiveInput(type); } else { setShowMentionMenu(false); setActiveInput(null); }
  };

  const insertMention = (friend: User) => {
    const mentionString = `@[${friend.display_name}](${friend.username}) `;
    if (activeInput === 'comment') setNewComment(newComment.replace(/@([a-zA-Z0-9_ก-๙]*)$/, mentionString));
    else if (activeInput === 'reply') setReplyContent(replyContent.replace(/@([a-zA-Z0-9_ก-๙]*)$/, mentionString));
    else setEditCommentContent(editCommentContent.replace(/@([a-zA-Z0-9_ก-๙]*)$/, mentionString));
    setShowMentionMenu(false); setActiveInput(null);
  };

  const sendTagNotifications = async (content: string, newCommentId: string) => {
    const mentionRegex = /@\[.*?\]\(([a-zA-Z0-9_]+)\)/g;
    const matches = [...content.matchAll(mentionRegex)];
    const usernames = matches.map(m => m[1]);
    if (usernames.length > 0) {
      const { data: taggedUsers } = await supabase.from('users').select('id').in('username', usernames);
      if (taggedUsers) {
        const notifs = taggedUsers.filter(u => u.id !== currentUserId).map(u => ({ receiver_id: u.id, sender_id: currentUserId, type: 'tag_comment', post_id: post.id, comment_id: newCommentId, is_read: false }));
        if (notifs.length > 0) await supabase.from('notifications').insert(notifs);
      }
    }
  };

  const authorId = post.author?.id || post.author_id;
  const targetId = post.target?.id || post.target_id;
  const canDeletePost = authorId === currentUserId || profileOwnerId === currentUserId || targetId === currentUserId;
  const canEditPost = authorId === currentUserId;

  useEffect(() => {
    const loadStats = async () => {
      const [lCount, cCount, isL] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
        supabase.from('likes').select('id').eq('post_id', post.id).eq('user_id', currentUserId).maybeSingle()
      ]);
      setLikeCount(lCount.count || 0); setCommentCount(cCount.count || 0); setIsLiked(!!isL.data);
    };
    loadStats();
  }, [post.id, currentUserId]);

  useEffect(() => { if (showComments) loadComments(); }, [showComments]);

  const handleLike = async () => {
    const nextIsLiked = !isLiked; setIsLiked(nextIsLiked); setLikeCount(prev => nextIsLiked ? prev + 1 : prev - 1);
    if (nextIsLiked) await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
    else await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
  };

  const handleViewLikers = async () => {
    if (likeCount === 0) return;
    setShowLikersModal(true); setIsLoadingLikers(true);
    try {
      const { data: likesData } = await supabase.from('likes').select('user_id').eq('post_id', post.id);
      if (likesData && likesData.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, username, display_name, profile_img_url, is_verified').in('id', likesData.map((d: any) => d.user_id));
        setLikers(usersData || []);
      }
    } catch (error: any) { console.error(error); } finally { setIsLoadingLikers(false); }
  };

  const handleUpdatePost = async () => {
    if (!editContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await supabase.from('posts').update({ content: editContent.trim() }).eq('id', post.id);
      setPost(prev => ({ ...prev, content: editContent.trim() })); setIsEditingPost(false);
    } catch (error: any) { alert('ไม่สามารถแก้ไขโพสต์ได้'); } finally { setIsSubmitting(false); }
  };

  const loadComments = async () => {
    setIsCommentsLoading(true);
    const { data } = await supabase.from('comments').select('*, author:users(id, username, display_name, profile_img_url, is_verified)').eq('post_id', post.id).order('created_at', { ascending: true });
    if (data) {
      const topLevel = data.filter(c => !c.parent_comment_id);
      const formatted = topLevel.map(c => ({ ...c, replies: data.filter(r => r.parent_comment_id === c.id) }));
      setComments(formatted as any);
      const { data: cLikes } = await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', data.map(c => c.id));
      if (cLikes) {
        const counts: Record<string, number> = {}; const userLiked = new Set<string>();
        cLikes.forEach(like => { counts[like.comment_id] = (counts[like.comment_id] || 0) + 1; if (like.user_id === currentUserId) userLiked.add(like.comment_id); });
        setCommentLikes(counts); setLikedComments(userLiked);
      }
    }
    setIsCommentsLoading(false);
  };

  const handleCommentLike = async (commentId: string) => {
    const isAlreadyLiked = likedComments.has(commentId);
    setLikedComments(prev => { const next = new Set(prev); if (isAlreadyLiked) next.delete(commentId); else next.add(commentId); return next; });
    setCommentLikes(prev => ({ ...prev, [commentId]: (prev[commentId] || 0) + (isAlreadyLiked ? -1 : 1) }));
    if (isAlreadyLiked) await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId);
    else await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId });
  };

  const handleComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault(); if ((!newComment.trim() && !commentImageUrl.trim()) || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data: newAddedComment, error } = await supabase.from('comments').insert({ post_id: post.id, author_id: currentUserId, content: newComment.trim(), image_url: commentImageUrl.trim() || null }).select('*, author:users(id, username, display_name, profile_img_url, is_verified)').single();
      if (error) throw error;
      if (newAddedComment) setComments(prev => [...prev, { ...newAddedComment, replies: [] } as any]);
      await sendTagNotifications(newComment, newAddedComment.id);
      setNewComment(''); setCommentImageUrl(''); setShowCommentImageInput(false); setCommentCount(prev => prev + 1);
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const handleReply = async (parentCommentId: string) => {
    if ((!replyContent.trim() && !replyImageUrl.trim()) || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data: newReply, error } = await supabase.from('comments').insert({ post_id: post.id, author_id: currentUserId, content: replyContent.trim(), parent_comment_id: parentCommentId, image_url: replyImageUrl.trim() || null }).select('*, author:users(id, username, display_name, profile_img_url, is_verified)').single();
      if (error) throw error;
      if (newReply) {
        setComments(prev => prev.map(c => c.id === parentCommentId ? { ...c, replies: [...(c.replies || []), newReply] as any } : c));
      }
      await sendTagNotifications(replyContent, newReply.id);
      setReplyContent(''); setReplyImageUrl(''); setReplyTo(null); setShowReplyImageInput(false); setCommentCount(prev => prev + 1);
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const handleDeleteComment = async (c: Comment) => {
    if (!confirm('คุณต้องการลบความคิดเห็นนี้ใช่หรือไม่?')) return;
    try {
      await supabase.from('comments').delete().eq('id', c.id);
      setComments(prev => prev.filter(item => item.id !== c.id).map(item => ({ ...item, replies: item.replies?.filter(r => r.id !== c.id) })));
      setCommentCount(prev => Math.max(0, prev - 1));
    } catch (err: any) { alert('ลบไม่สำเร็จ'); }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editCommentContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await supabase.from('comments').update({ content: editCommentContent.trim() }).eq('id', commentId);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editCommentContent.trim() } : (c.replies ? { ...c, replies: c.replies.map(r => r.id === commentId ? { ...r, content: editCommentContent.trim() } : r) } : c)));
      setEditingCommentId(null);
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const renderTextWithTags = useMemo(() => (text: string) => {
    if (!text) return null;
    const regex = /(@\[.*?\]\([a-zA-Z0-9_]+\)|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_ก-๙]+|https?:\/\/[^\s]+)/g;
    return text.split(regex).map((part, i) => {
      if (!part) return null;
      const mdMatch = part.match(/^@\[(.*?)\]\(([a-zA-Z0-9_]+)\)$/);
      if (mdMatch) return <Link key={i} href={`/profile/${mdMatch[2]}`} className="text-frog-600 font-bold hover:underline">{mdMatch[1]}</Link>;
      if (part.startsWith('#')) return <span key={i} className="text-blue-500 font-bold">{part}</span>;
      if (part.startsWith('http')) return <a key={i} href={part} target="_blank" className="text-blue-500 hover:underline break-all">{part}</a>;
      return <span key={i}>{part}</span>;
    });
  }, []);

  const MentionMenu = () => {
    if (!showMentionMenu || filteredFriends.length === 0) return null;
    return (
      <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-[100] overflow-hidden">
        <div className="p-2 border-b bg-gray-50 flex items-center gap-2"><AtSign size={12} className="text-frog-500" /><span className="text-[10px] font-black uppercase text-gray-500">แท็กเพื่อน</span></div>
        {filteredFriends.map(f => (
          <button key={f.id} onClick={() => insertMention(f)} className="w-full flex items-center gap-3 p-3 hover:bg-frog-50 transition-colors text-left border-b border-gray-50 last:border-0">
            <div className="relative flex-shrink-0">
              <img src={f.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-gray-900 truncate flex items-center gap-1">
                {f.display_name}
                {f.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
              </p>
              <p className="text-[10px] text-gray-400">@{f.username}</p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderCommentItem = (c: Comment, isReply = false) => {
    const isMyComment = c.author_id === currentUserId;
    const isEditing = editingCommentId === c.id;

    return (
      <div key={c.id} className={`${isReply ? 'ml-10 mt-2' : 'mb-4'} animate-in fade-in group/comment`}>
        <div className="flex gap-2">
          <Link href={`/profile/${c.author?.username}`} className="flex-shrink-0 relative">
            <img src={c.author?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover" />
          </Link>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2 relative">
                <textarea value={editCommentContent} onChange={(e) => handleInputChange(e.target.value, 'edit_comment')} className="input-minimal w-full text-sm p-3 bg-white border border-frog-200 rounded-2xl min-h-[80px]" autoFocus />
                {activeInput === 'edit_comment' && <MentionMenu />}
                <div className="flex gap-2">
                  <button onClick={() => handleUpdateComment(c.id)} className="text-[10px] font-black text-frog-600 bg-frog-50 px-3 py-1.5 rounded-lg">บันทึก</button>
                  <button onClick={() => setEditingCommentId(null)} className="text-[10px] font-black text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block max-w-full relative">
                <p className="font-bold text-[11px] text-gray-900 flex items-center gap-1">
                  {c.author?.display_name} 
                  {c.author?.is_verified && <BadgeCheck className="w-3 h-3 text-blue-500" />}
                </p>
                <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">{renderTextWithTags(c.content)}</p>
                {c.image_url && <img src={c.image_url} onClick={() => setSelectedImage(c.image_url!)} className="mt-2 rounded-xl max-h-48 object-cover cursor-zoom-in" />}
                {(commentLikes[c.id] || 0) > 0 && <div className="absolute -bottom-2 -right-1 bg-white shadow-sm border rounded-full px-1.5 py-0.5 flex items-center gap-1"><Heart size={10} className="fill-red-500 text-red-500" /><span className="text-[10px] font-bold text-gray-500">{commentLikes[c.id]}</span></div>}
              </div>
            )}
            <div className="flex items-center gap-4 mt-1 ml-2 text-[10px] font-black text-gray-400 uppercase tracking-tight">
              <span>{getRelativeTime(c.created_at)}</span>
              <button onClick={() => handleCommentLike(c.id)} className={likedComments.has(c.id) ? 'text-red-500' : 'hover:text-gray-600'}>ถูกใจ</button>
              {!c.parent_comment_id && <button onClick={() => { setReplyTo(c.id); setReplyContent(`@[${c.author?.display_name}](${c.author?.username}) `); }} className="hover:text-gray-600">ตอบกลับ</button>}
              {(isMyComment || canDeletePost) && !isEditing && (
                <div className="flex gap-3 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                  {isMyComment && <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }} className="text-indigo-500">แก้ไข</button>}
                  <button onClick={() => handleDeleteComment(c)} className="text-red-400">ลบ</button>
                </div>
              )}
            </div>
            
            {replyTo === c.id && (
              <div className="mt-3 space-y-2 relative">
                <div className="flex gap-2">
                  <input type="text" value={replyContent} onChange={(e) => handleInputChange(e.target.value, 'reply')} onKeyDown={(e) => e.key === 'Enter' && handleReply(c.id)} placeholder={`ตอบกลับ ${c.author?.display_name.split(' ')[0]}...`} className="input-minimal w-full text-xs py-2 px-3 rounded-xl" autoFocus />
                  <button onClick={() => setShowReplyImageInput(!showReplyImageInput)} className={`p-1.5 rounded-lg transition-colors ${showReplyImageInput ? 'bg-frog-100 text-frog-600' : 'text-gray-400 hover:bg-gray-100'}`}><ImageIcon size={18} /></button>
                  <button onClick={() => handleReply(c.id)} className="p-1.5 text-frog-600 hover:text-frog-700 transition-colors"><Send size={18} /></button>
                  <button onClick={() => setReplyTo(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
                </div>
                {showReplyImageInput && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <input type="url" value={replyImageUrl} onChange={e => setReplyImageUrl(e.target.value)} placeholder="วาง URL รูปภาพที่นี่..." className="input-minimal flex-1 text-xs py-1.5 px-3 bg-white border border-gray-200 rounded-lg outline-none focus:border-frog-300" disabled={isSubmitting} />
                    {replyImageUrl && <img src={replyImageUrl} className="w-6 h-6 rounded-md object-cover border border-gray-200 shadow-sm" alt="Preview" />}
                  </div>
                )}
                {activeInput === 'reply' && <MentionMenu />}
              </div>
            )}
            {c.replies?.map(reply => renderCommentItem(reply, true))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="card-minimal border border-gray-100 shadow-sm relative">
      <div className="flex items-start gap-3 mb-4">
        {post.author && (
          <Link href={`/profile/${post.author.username}`} className="flex-shrink-0 relative">
            <img src={post.author.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover border border-gray-50 shadow-sm" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap text-sm">
            {post.author && (
              <Link href={`/profile/${post.author.username}`} className="font-black text-[15px] text-gray-900 hover:text-frog-600 flex items-center gap-1 transition-colors">
                {post.author.display_name}
                {post.author.is_verified && <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />}
              </Link>
            )}
            {post.target && post.target.id !== post.author?.id && (
              <><ChevronRight size={14} className="text-gray-400" />
                <Link href={`/profile/${post.target.username}`} className="font-black text-[15px] text-gray-900 hover:text-frog-600 flex items-center gap-1 transition-colors">
                  {post.target.display_name}
                  {post.target.is_verified && <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-[10px] text-gray-400 font-bold uppercase">{getRelativeTime(post.created_at)}</p>
            {post.location && <><span className="w-1 h-1 rounded-full bg-gray-300"></span><span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5 uppercase tracking-tight"><MapPin size={10} /> {post.location}</span></>}
            {post.mood && <><span className="w-1 h-1 rounded-full bg-gray-300"></span><span className="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full font-bold border border-yellow-100">{post.mood.includes('รู้สึก') ? post.mood : `รู้สึก ${post.mood}`}</span></>}
            {post.activity && <><span className="w-1 h-1 rounded-full bg-gray-300"></span><span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-100">{post.activity.includes('กำลัง') ? post.activity : `กำลัง ${post.activity}`}</span></>}
            {/* ✅ Life event badge ใน header */}
            {(post as any).life_event && (() => {
              const { event } = decodeLifeEvent((post as any).life_event);
              if (!event) return null;
              return (
                <><span className="w-1 h-1 rounded-full bg-gray-300"></span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${event.badgeBg}`}>
                  <span>{event.emoji}</span>
                  <span>{event.label}...</span>
                </span></>
              );
            })()}
          </div>
        </div>
        {(canEditPost || canDeletePost) && (
          <div className="flex gap-1">
            {canEditPost && <button onClick={() => { setIsEditingPost(!isEditingPost); setEditContent(post.content || ''); }} className={`p-2 transition-colors rounded-full ${isEditingPost ? 'bg-frog-50 text-frog-600' : 'text-gray-300 hover:text-frog-600 hover:bg-gray-50'}`}><Edit2 size={16} /></button>}
            {canDeletePost && <button onClick={() => onDelete?.(post.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={16} /></button>}
          </div>
        )}
      </div>

      {isEditingPost ? (
        <div className="mb-4 space-y-3">
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full text-base p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-frog-500 min-h-[120px]" autoFocus />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setIsEditingPost(false)} className="px-5 py-2 text-xs font-black text-gray-500 bg-gray-100 rounded-xl">ยกเลิก</button>
            <button onClick={handleUpdatePost} disabled={isSubmitting || !editContent.trim()} className="px-5 py-2 text-xs font-black text-white bg-frog-500 rounded-xl disabled:opacity-50 shadow-sm">บันทึก</button>
          </div>
        </div>
      ) : (
        <div className="text-base text-gray-900 mb-4 whitespace-pre-wrap break-words leading-relaxed">
          {isExpanded || (post.content?.length || 0) <= CONTENT_LIMIT ? (
            renderTextWithTags(post.content || '')
          ) : (
            <>
              {renderTextWithTags(post.content?.slice(0, CONTENT_LIMIT) + '...')}
              <button 
                onClick={() => setIsExpanded(true)} 
                className="text-frog-600 font-black hover:underline ml-1 text-sm uppercase tracking-tighter"
              >
                ดูเพิ่มเติม
              </button>
            </>
          )}
        </div>
      )}

      {/* ✅ Life Event Banner — แสดงก่อนรูปภาพ */}
      {!isEditingPost && (post as any).life_event && (
        <LifeEventBanner raw={(post as any).life_event} />
      )}

      {!isEditingPost && post.content && (
        <div className="mb-4">
          {post.content.match(/(https?:\/\/\S+)/g)?.map(url => {
            const ytId = getYouTubeVideoId(url);
            if (ytId) return (
              <div key={url} className="mb-4 rounded-3xl overflow-hidden relative pt-[56.25%] w-full shadow-md bg-black">
                <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} allowFullScreen></iframe>
              </div>
            );
            return <LinkPreview key={url} url={url} />;
          })}
        </div>
      )}

      {post.images && post.images.length > 0 && (
        <div className={`grid gap-2 mb-4 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.images.map((img, i) => (
            <div key={i} className={`relative overflow-hidden rounded-3xl bg-gray-50 border border-gray-100 cursor-pointer hover:opacity-95 transition-transform active:scale-95 ${post.images!.length === 3 && i === 2 ? 'col-span-2 aspect-[16/8]' : 'aspect-[4/3]'}`} onClick={() => setSelectedImage(img)}>
              <img src={img} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-6 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <button onClick={handleLike} className={`transition-all active:scale-75 p-1 -ml-1 rounded-full ${isLiked ? 'text-red-500' : 'text-gray-400 hover:bg-red-50'}`}><Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} /></button>
          <button onClick={handleViewLikers} className={`text-xs font-black transition-colors py-1 pr-2 ${likeCount > 0 ? 'text-gray-500 hover:text-gray-900 hover:underline' : 'text-gray-400 cursor-default'}`}>{likeCount}</button>
        </div>
        <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-2 text-xs font-black transition-colors p-1 -ml-1 rounded-lg ${showComments ? 'text-frog-600 bg-frog-50' : 'text-gray-400 hover:bg-gray-50'}`}><MessageCircle className="w-5 h-5" /> {commentCount}</button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-50 space-y-4">
          {isCommentsLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 text-frog-500 animate-spin" /></div>
          ) : (
            <>
              <form onSubmit={handleComment} className="space-y-2 relative">
                <div className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <input type="text" value={newComment} onChange={(e) => handleInputChange(e.target.value, 'comment')} placeholder="เขียนความคิดเห็น..." className="input-minimal w-full text-sm py-2 px-4 bg-gray-50 rounded-xl outline-none border border-gray-100 focus:ring-2 focus:ring-frog-200" disabled={isSubmitting} />
                    {activeInput === 'comment' && <MentionMenu />}
                  </div>
                  <button type="button" onClick={() => setShowCommentImageInput(!showCommentImageInput)} className={`p-2 rounded-xl transition-all ${showCommentImageInput ? 'bg-frog-100 text-frog-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}><ImageIcon size={18} /></button>
                  <button type="submit" disabled={(!newComment.trim() && !commentImageUrl.trim()) || isSubmitting} className="p-2 bg-frog-500 text-white rounded-xl hover:bg-frog-600 shadow-sm active:scale-95 disabled:opacity-50 transition-colors"><Send size={18} /></button>
                </div>
                {showCommentImageInput && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <input type="url" value={commentImageUrl} onChange={e => setCommentImageUrl(e.target.value)} placeholder="วาง URL รูปภาพที่นี่ (https://...)" className="input-minimal flex-1 text-xs py-2 px-3 bg-gray-50 rounded-xl outline-none border border-gray-100 focus:ring-1 focus:ring-frog-300" disabled={isSubmitting} />
                    {commentImageUrl && <img src={commentImageUrl} className="w-8 h-8 rounded-lg object-cover shadow-sm border border-gray-100" alt="Preview" />}
                  </div>
                )}
              </form>

              <div className="space-y-3">{comments.length === 0 ? <p className="text-center text-gray-300 text-[10px] font-black uppercase py-4">ยังไม่มีความคิดเห็น</p> : comments.map(c => renderCommentItem(c))}</div>
            </>
          )}
        </div>
      )}

      {showLikersModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowLikersModal(false)}>
          <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl p-6 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 flex items-center gap-2"><Heart className="w-5 h-5 text-red-500 fill-red-500" /> คนที่ถูกใจสิ่งนี้</h3>
              <button onClick={() => setShowLikersModal(false)} className="p-2 bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 no-scrollbar">
              {isLoadingLikers ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-frog-500" /></div> : likers.length === 0 ? <p className="text-center text-xs font-bold text-gray-400 py-6">ยังไม่มีผู้กดถูกใจ</p> : likers.map((user, idx) => (
                  <Link key={idx} href={`/profile/${user.username}`} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl transition-colors group">
                    <div className="relative flex-shrink-0">
                      <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover shadow-sm border border-gray-100" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate group-hover:text-frog-600 flex items-center gap-1">
                        {user.display_name} 
                        {user.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase truncate">@{user.username}</p>
                    </div>
                  </Link>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} className="max-w-[95vw] max-h-[90vh] rounded-2xl shadow-2xl object-contain" />
          <button className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"><X size={24} /></button>
        </div>
      )}
    </div>
  );
}

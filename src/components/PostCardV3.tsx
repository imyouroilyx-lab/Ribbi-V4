'use client';

import { useState, useEffect } from 'react';
import { supabase, Post, User } from '@/lib/supabase';
import { Heart, MessageCircle, Trash2, MapPin, Image as ImageIcon, X, Edit2, Check, Link2 } from 'lucide-react';
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
      } catch (error) { /* fail silent */ }

      try {
        const res2 = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        if (res2.ok) {
          const json2 = await res2.json();
          if (isMounted && json2.status === 'success') {
            setPreview({ title: json2.data.title, description: json2.data.description, image: json2.data.image?.url || json2.data.logo?.url, publisher: json2.data.publisher });
          }
        }
      } catch (error) { /* fail silent */ } finally { if (isMounted) setLoading(false); }
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
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showLikeList, setShowLikeList] = useState(false);
  const [likedUsers, setLikedUsers] = useState<User[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editedPostContent, setEditedPostContent] = useState(post.content || '');
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const canDelete = post.author_id === currentUserId || profileOwnerId === currentUserId;
  const canEdit = post.author_id === currentUserId;

  useEffect(() => {
    loadLikes();
    checkIfLiked();
    if (showComments) loadComments();

    const channel = supabase
      .channel(`post-updates-${post.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${post.id}` }, () => loadLikes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` }, () => loadComments())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [post.id, showComments]);

  const loadComments = async () => {
    try {
      // ✅ แก้ปัญหา N+1: ดึงคอมเมนต์พร้อมคนเขียนในคราวเดียว
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
        setComments(formatted);
      }
    } catch (error) { console.error(error); }
  };

  const loadLikes = async () => {
    const { data } = await supabase.from('likes').select('user_id, users(id, display_name, username, profile_img_url)').eq('post_id', post.id);
    if (data) {
      setLikeCount(data.length);
      setLikedUsers(data.map(d => d.users as any));
    }
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
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-gray-500">
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-bold">{comments.length}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-4 space-y-4">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <img src={c.author?.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover" alt="" loading="lazy" />
              <div className="flex-1">
                <div className="bg-gray-100 rounded-2xl px-3 py-2">
                  <p className="font-bold text-xs">{c.author?.display_name}</p>
                  <p className="text-sm">{renderTextWithTags(c.content)}</p>
                </div>
              </div>
            </div>
          ))}
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

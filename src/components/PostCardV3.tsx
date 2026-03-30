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

// ✅ ปรับปรุง LinkPreview ให้ทำงาน 2 ชั้น (ป้องกันการโดน API Limit)
const LinkPreview = ({ url }: { url: string }) => {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      try {
        // 1. ลองใช้ Dub API (ไม่มี Rate Limit กวนใจ, โหลดเร็ว)
        const res1 = await fetch(`https://api.dub.co/metatags?url=${encodeURIComponent(url)}`);
        if (res1.ok) {
          const json1 = await res1.json();
          if (isMounted && (json1.title || json1.image)) {
            setPreview({
              title: json1.title,
              description: json1.description,
              image: json1.image,
              publisher: new URL(url).hostname
            });
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.warn('Dub API failed, falling back to Microlink...', error);
      }

      try {
        // 2. ถ้า API แรกพัง ลองใช้ Microlink API แทน
        const res2 = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        if (res2.ok) {
          const json2 = await res2.json();
          if (isMounted && json2.status === 'success') {
            setPreview({
              title: json2.data.title,
              description: json2.data.description,
              image: json2.data.image?.url || json2.data.logo?.url,
              publisher: json2.data.publisher
            });
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('Microlink API failed:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchPreview();
    return () => { isMounted = false; };
  }, [url]);

  if (loading) {
    return (
      <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden animate-pulse">
        <div className="w-full h-40 md:h-56 bg-gray-200"></div>
        <div className="p-3 md:p-4 space-y-3 bg-gray-50">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-3 bg-gray-300 rounded w-full"></div>
          <div className="h-3 bg-gray-300 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  const domain = new URL(url).hostname;

  // ถ้าระบบดึงข้อมูลไม่ได้เลย ให้แสดงแบบเก่า (Fallback)
  if (!preview || (!preview.title && !preview.image)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mb-4 flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition block">
        <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Link2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{domain}</p>
          <p className="text-xs text-gray-500 truncate">{url}</p>
        </div>
      </a>
    );
  }

  // แสดงผลแบบ Facebook Share (Rich Card)
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mb-4 block border border-gray-200 rounded-xl hover:shadow-md transition overflow-hidden bg-gray-50 group">
      {preview.image && (
        <div className="w-full h-48 md:h-64 bg-gray-200 overflow-hidden border-b border-gray-200 relative">
          <img src={preview.image} alt={preview.title || 'Link preview'} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
        </div>
      )}
      <div className="p-3 md:p-4 flex flex-col justify-center min-w-0 bg-white">
         <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 truncate">{preview.publisher || domain}</p>
         <p className="text-sm md:text-base font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition">{preview.title || domain}</p>
         {preview.description && (
           <p className="text-xs md:text-sm text-gray-600 mt-1.5 line-clamp-2">{preview.description}</p>
         )}
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
  const [showCommentImageInput, setShowCommentImageInput] = useState(false);
  const [commentImageUrl, setCommentImageUrl] = useState('');
  const [replyImageUrl, setReplyImageUrl] = useState('');

  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editedPostContent, setEditedPostContent] = useState(post.content || '');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState('');
  
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const [mentionState, setMentionState] = useState<{
    isActive: boolean;
    query: string;
    results: any[];
    cursorIndex: number;
    inputType: 'newComment' | 'reply' | 'editPost' | 'editComment' | null;
    targetId: string | null;
  }>({
    isActive: false, query: '', results: [], cursorIndex: 0, inputType: null, targetId: null
  });

  const canDelete = post.author_id === currentUserId || profileOwnerId === currentUserId;
  const canEdit = post.author_id === currentUserId;

  useEffect(() => {
    loadComments();
    loadLikes();
    checkIfLiked();
    loadCommentLikes();

    const likesSubscription = supabase
      .channel(`post-likes-${post.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${post.id}` }, () => {
        loadLikes();
        checkIfLiked();
      })
      .subscribe();

    const commentsSubscription = supabase
      .channel(`post-comments-${post.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` }, () => {
        loadComments();
        loadCommentLikes();
      })
      .subscribe();

    const commentLikesSubscription = supabase
      .channel(`post-comment-likes-${post.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, () => {
        loadCommentLikes();
      })
      .subscribe();

    return () => {
      likesSubscription.unsubscribe();
      commentsSubscription.unsubscribe();
      commentLikesSubscription.unsubscribe();
    };
  }, [post.id]);

  const loadComments = async () => {
    try {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (data) {
        const commentsWithAuthors = await Promise.all(
          data.map(async (comment: any) => {
            const { data: author } = await supabase
              .from('users')
              .select('*')
              .eq('id', comment.author_id)
              .single();
            return { ...comment, author };
          })
        );

        const topLevelComments = commentsWithAuthors.filter(c => !c.parent_comment_id);
        const commentsWithReplies = topLevelComments.map(comment => ({
          ...comment,
          replies: commentsWithAuthors.filter(c => c.parent_comment_id === comment.id)
        }));

        setComments(commentsWithReplies);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadLikes = async () => {
    try {
      const { data: likesData } = await supabase
        .from('likes')
        .select('user_id')
        .eq('post_id', post.id);

      setLikeCount(likesData?.length || 0);

      if (likesData && likesData.length > 0) {
        const userIds = likesData.map((like: any) => like.user_id);
        const { data: usersData } = await supabase
          .from('users')
          .select('*')
          .in('id', userIds);
        setLikedUsers(usersData || []);
      }
    } catch (error) {
      console.error('Error loading likes:', error);
    }
  };

  const checkIfLiked = async () => {
    try {
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUserId)
        .maybeSingle();
      setIsLiked(!!data);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const handleLike = async () => {
    try {
      if (isLiked) {
        await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
      } else {
        await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
      }
      setIsLiked(!isLiked);
      await loadLikes();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const notifyTaggedUsers = async (text: string) => {
    const markdownMatches = Array.from(text.matchAll(/@\[.*?\]\((.*?)\)/g)).map(m => m[1]);
    const plainMatches = Array.from(text.matchAll(/(?:\s|^)@([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    const usernames = [...new Set([...markdownMatches, ...plainMatches])];
    
    if (usernames.length === 0) return;

    try {
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('id, username')
        .in('username', usernames);

      if (fetchError) {
        console.error("❌ [ERROR] ดึงข้อมูล User จากฐานข้อมูลไม่ได้:", fetchError.message);
        return;
      }

      if (!users || users.length === 0) return;

      const usersToNotify = users.filter((u: any) => u.id !== currentUserId);

      const notifications = usersToNotify.map((u: any) => ({
        receiver_id: u.id, 
        sender_id: currentUserId,
        type: 'tag_comment',
        post_id: post.id,
        is_read: false
      }));

      if (notifications.length > 0) {
        const { error: insertError } = await supabase.from('notifications').insert(notifications);
        if (insertError) {
          console.error("❌ [ERROR] บันทึกการแจ้งเตือนลงตารางล้มเหลว:", insertError.message, insertError.details);
        } else {
          console.log("✅ [SUCCESS] บันทึกการแจ้งเตือนสำเร็จ");
        }
      }
    } catch (error) {
      console.error('❌ [ERROR] ระบบแจ้งเตือนพัง:', error);
    }
  };

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const renderEmbeds = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    if (!urls || urls.length === 0) return null;

    const firstUrl = urls[0]; 
    if (!firstUrl) return null;

    const ytId = getYouTubeId(firstUrl);

    if (ytId) {
      return (
        <div className="mb-4 rounded-xl overflow-hidden shadow-sm border border-gray-100 relative pt-[56.25%] w-full">
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={`https://www.youtube.com/embed/${ytId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      );
    } else {
      // โชว์ LinkPreview ที่ดึงหน้าปกข่าว
      return <LinkPreview url={firstUrl} />;
    }
  };

  const renderTextWithTags = (text: string) => {
    if (!text) return null;
    
    // Regex รองรับ @Mention, @[Mention](username), URL และ #Hashtag (ไทย/อังกฤษ)
    const regex = /(@\[.*?\]\([a-zA-Z0-9_]+\)|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_ก-๙]+|https?:\/\/[^\s]+)/g;
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (!part) return null;
      
      // 1. ตรวจจับ Mention แบบ Markdown
      const mdMatch = part.match(/^@\[(.*?)\]\(([a-zA-Z0-9_]+)\)$/);
      if (mdMatch) {
        return (
          <Link key={index} href={`/profile/${mdMatch[2]}`} className="text-[#34a35c] hover:underline font-semibold" onClick={(e: any) => e.stopPropagation()}>
            {mdMatch[1]}
          </Link>
        );
      }
      
      // 2. ตรวจจับ Mention แบบธรรมดา
      const plainMatch = part.match(/^@([a-zA-Z0-9_]+)$/);
      if (plainMatch) {
         return (
          <Link key={index} href={`/profile/${plainMatch[1]}`} className="text-[#34a35c] hover:underline font-semibold" onClick={(e: any) => e.stopPropagation()}>
            @{plainMatch[1]}
          </Link>
        );
      }

      // 3. ตรวจจับ Hashtag และเปลี่ยนเป็นสีฟ้า
      const hashtagMatch = part.match(/^#([a-zA-Z0-9_ก-๙]+)$/);
      if (hashtagMatch) {
        return (
          <span key={index} className="text-blue-500 hover:underline cursor-pointer font-medium">
            {part}
          </span>
        );
      }

      // 4. ตรวจจับ URL
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all" onClick={(e) => e.stopPropagation()}>
            {part}
          </a>
        );
      }
      
      return <span key={index}>{part}</span>;
    });
  };

  const handleInputWithMention = async (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, 
    setter: React.Dispatch<React.SetStateAction<string>>,
    inputType: 'newComment' | 'reply' | 'editPost' | 'editComment',
    targetId: string | null = null
  ) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setter(val);
    
    const textBeforeCursor = val.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/(?:\s|^)@([a-zA-Z0-9_ก-๙]*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      try {
        let data;
        if (query.length > 0) {
          const res = await supabase.from('users')
            .select('id, username, display_name, profile_img_url')
            .neq('id', currentUserId)
            .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
            .limit(5);
          data = res.data;
        } else {
          const res = await supabase.from('users')
            .select('id, username, display_name, profile_img_url')
            .neq('id', currentUserId)
            .limit(5);
          data = res.data;
        }
        setMentionState({
          isActive: true, query, results: data || [], cursorIndex: cursor, inputType, targetId
        });
      } catch (error) {
        console.error(error);
      }
    } else {
      setMentionState(prev => ({ ...prev, isActive: false }));
    }
  };

  const insertMention = (user: any) => {
    let content = '';
    let setter: any = null;
    
    if (mentionState.inputType === 'newComment') { content = newComment; setter = setNewComment; }
    else if (mentionState.inputType === 'reply') { content = replyContent; setter = setReplyContent; }
    else if (mentionState.inputType === 'editPost') { content = editedPostContent; setter = setEditedPostContent; }
    else if (mentionState.inputType === 'editComment') { content = editedCommentContent; setter = setEditedCommentContent; }
    
    if (!setter) return;
    
    const textBeforeCursor = content.slice(0, mentionState.cursorIndex);
    const textAfterCursor = content.slice(mentionState.cursorIndex);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtPos !== -1) {
      const safeDisplayName = user.display_name.replace(/[\[\]\(\)]/g, '');
      const newText = textBeforeCursor.slice(0, lastAtPos) + `@[${safeDisplayName}](${user.username})  ` + textAfterCursor;
      setter(newText);
    }
    setMentionState({ isActive: false, query: '', results: [], cursorIndex: 0, inputType: null, targetId: null });
  };

  const renderMentionDropdown = (inputType: string, targetId: string | null = null) => {
    if (mentionState.isActive && mentionState.inputType === inputType && mentionState.targetId === targetId && mentionState.results.length > 0) {
      return (
        <div className="absolute z-20 left-0 bottom-full mb-1 w-full md:w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {mentionState.results.map(user => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()} 
              onClick={() => insertMention(user)}
              className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 text-left transition border-b border-gray-50 last:border-0"
            >
              <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.display_name}</p>
                <p className="text-xs text-gray-500 truncate">@{user.username}</p>
              </div>
            </button>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: post.id,
        author_id: currentUserId,
        content: newComment.trim(),
        image_url: commentImageUrl || null
      });

      if (error) throw error;

      await notifyTaggedUsers(newComment.trim());

      setNewComment('');
      setCommentImageUrl('');
      setShowCommentImageInput(false);
      await loadComments();
      await loadCommentLikes();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('ไม่สามารถโพสต์ความคิดเห็นได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentCommentId: string) => {
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: post.id,
        author_id: currentUserId,
        content: replyContent.trim(),
        parent_comment_id: parentCommentId,
        image_url: replyImageUrl || null
      });

      if (error) throw error;

      await notifyTaggedUsers(replyContent.trim());

      setReplyContent('');
      setReplyImageUrl('');
      setReplyTo(null);
      await loadComments();
      await loadCommentLikes();
    } catch (error) {
      console.error('Error posting reply:', error);
      alert('ไม่สามารถตอบกลับได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      await loadComments();
      await loadCommentLikes();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const loadCommentLikes = async () => {
    try {
      const { data: commentsData } = await supabase
        .from('comments')
        .select('id')
        .eq('post_id', post.id);

      if (!commentsData || commentsData.length === 0) return;

      const commentIds = commentsData.map((c: any) => c.id);

      const { data: likesData } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds);

      const likeCounts: Record<string, number> = {};
      likesData?.forEach((like: any) => {
        likeCounts[like.comment_id] = (likeCounts[like.comment_id] || 0) + 1;
      });
      setCommentLikes(likeCounts);

      const { data: userLikes } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds)
        .eq('user_id', currentUserId);

      const likedSet = new Set(userLikes?.map((l: any) => l.comment_id) || []);
      setLikedComments(likedSet);
    } catch (error) {
      console.error('Error loading comment likes:', error);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    try {
      const isLiked = likedComments.has(commentId);
      if (isLiked) {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId);
      } else {
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId });
      }
      await loadCommentLikes();
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const handleEditPost = async () => {
    if (!editedPostContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await supabase.from('posts').update({ content: editedPostContent.trim() }).eq('id', post.id);
      post.content = editedPostContent.trim();
      await notifyTaggedUsers(editedPostContent.trim());
      setIsEditingPost(false);
    } catch (error) {
      console.error('Error editing post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editedCommentContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editedCommentContent.trim() })
        .eq('id', commentId);

      if (error) throw error;

      await notifyTaggedUsers(editedCommentContent.trim());
      await loadComments();
      await loadCommentLikes();
      setEditingCommentId(null);
      setEditedCommentContent('');
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('ไม่สามารถแก้ไขความคิดเห็นได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderComment = (comment: Comment, isReply: boolean = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-12' : ''} mb-4`}>
      <div className="flex gap-2 md:gap-3">
        <Link href={`/profile/${comment.author?.username}`} className="flex-shrink-0">
          <img
            src={comment.author?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
            alt={comment.author?.display_name}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover hover:opacity-80 transition"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="bg-gray-100 rounded-2xl px-3 md:px-4 py-2 md:py-3">
            <Link href={`/profile/${comment.author?.username}`} className="font-bold text-sm md:text-base hover:underline">
              {comment.author?.display_name}
            </Link>

            {editingCommentId === comment.id ? (
              <div className="mt-2 relative">
                <textarea
                  value={editedCommentContent}
                  onChange={(e) => handleInputWithMention(e as any, setEditedCommentContent, 'editComment', comment.id)}
                  onClick={(e) => handleInputWithMention(e as any, setEditedCommentContent, 'editComment', comment.id)}
                  onKeyUp={(e) => handleInputWithMention(e as any, setEditedCommentContent, 'editComment', comment.id)}
                  className="w-full resize-none border border-gray-300 rounded-xl p-2 text-sm md:text-base"
                  rows={2}
                  disabled={isSubmitting}
                />
                {renderMentionDropdown('editComment', comment.id)}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleEditComment(comment.id)} disabled={!editedCommentContent.trim() || isSubmitting} className="text-frog-600 hover:text-frog-700 p-1">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditingCommentId(null); setEditedCommentContent(''); }} className="text-gray-500 hover:text-gray-700 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm md:text-base text-gray-800 mt-1 whitespace-pre-wrap break-words">
                {renderTextWithTags(comment.content)}
              </p>
            )}

            {comment.image_url && (
              <div className="mt-2 rounded-xl overflow-hidden" style={{ aspectRatio: '4 / 3', maxWidth: '300px' }}>
                <img
                  src={comment.image_url}
                  alt="Comment attachment"
                  className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition"
                  onClick={() => setSelectedImage(comment.image_url!)}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 md:gap-4 mt-1 ml-3 md:ml-4 text-xs md:text-sm text-gray-500">
            <span>{getRelativeTime(comment.created_at)}</span>

            <button
              onClick={() => handleCommentLike(comment.id)}
              className={`flex items-center gap-1 hover:text-red-500 font-medium ${likedComments.has(comment.id) ? 'text-red-500' : ''}`}
            >
              <Heart className={`w-3 h-3 ${likedComments.has(comment.id) ? 'fill-current' : ''}`} />
              {commentLikes[comment.id] || 0}
            </button>

            {!isReply && (
              <button onClick={() => setReplyTo(comment.id)} className="hover:text-frog-600 font-medium">
                ตอบกลับ
              </button>
            )}

            {comment.author_id === currentUserId && editingCommentId !== comment.id && (
              <>
                <button
                  onClick={() => { setEditingCommentId(comment.id); setEditedCommentContent(comment.content); }}
                  className="hover:text-frog-600 font-medium"
                >
                  แก้ไข
                </button>
                <button onClick={() => handleDeleteComment(comment.id)} className="hover:text-red-600 font-medium">
                  ลบ
                </button>
              </>
            )}
          </div>

          {replyTo === comment.id && (
            <div className="mt-3 ml-3 md:ml-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={replyContent}
                    onChange={(e) => handleInputWithMention(e, setReplyContent, 'reply', comment.id)}
                    onClick={(e) => handleInputWithMention(e as any, setReplyContent, 'reply', comment.id)}
                    onKeyUp={(e) => handleInputWithMention(e as any, setReplyContent, 'reply', comment.id)}
                    placeholder={`ตอบกลับ ${comment.author?.display_name}...`}
                    className="input-minimal w-full text-sm md:text-base"
                    disabled={isSubmitting}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(comment.id); }
                    }}
                  />
                  {renderMentionDropdown('reply', comment.id)}
                </div>
                <button
                  onClick={() => handleReply(comment.id)}
                  disabled={!replyContent.trim() || isSubmitting}
                  className="btn-primary px-3 md:px-4 text-sm md:text-base disabled:opacity-50"
                >
                  ส่ง
                </button>
              </div>
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3">
              {comment.replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="card-minimal">
      {/* Header */}
      <div className="flex items-start gap-2 md:gap-3 mb-4">
        {post.author && (
          <Link href={`/profile/${post.author.username}`} className="flex-shrink-0">
            <img
              src={post.author.profile_img_url || 'https://iili.io/qbtgKBt.png'}
              alt={post.author.display_name}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover hover:opacity-80 transition"
            />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {post.author && (
              <Link href={`/profile/${post.author.username}`} className="font-bold text-sm md:text-base hover:underline">
                {post.author.display_name}
              </Link>
            )}

            {post.author_id !== post.target_id && post.target && (
              <>
                <span className="text-gray-400 text-sm">→</span>
                <Link href={`/profile/${post.target.username}`} className="font-bold text-sm md:text-base hover:underline text-[#34a35c]">
                  {post.target.display_name}
                </Link>
              </>
            )}

            {(post.mood || post.activity) && (
              <span className="text-xs md:text-sm text-gray-600 flex items-center gap-1 flex-wrap">
                {post.mood && (
                  <>
                    <span className="hidden sm:inline">รู้สึก</span>
                    <span className="font-medium">{post.mood}</span>
                  </>
                )}
                {post.activity && (
                  <>
                    {post.mood && <span className="mx-1 hidden sm:inline">—</span>}
                    <span className="hidden sm:inline">กำลัง</span>
                    <span className="font-medium">{post.activity}</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-gray-500 mt-1 flex-wrap">
            {post.author && <span className="truncate">@{post.author.username}</span>}
            <span>·</span>
            <Link href={`/post/${post.id}`} className="hover:underline text-gray-500">
              {getRelativeTime(post.created_at)}
            </Link>
            {post.location && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{post.location}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {(canEdit || canDelete) && (
          <div className="flex gap-1 flex-shrink-0">
            {canEdit && !isEditingPost && (
              <button
                onClick={() => setIsEditingPost(true)}
                className="text-gray-500 hover:text-[#34a35c] p-2 transition"
                title="แก้ไขโพสต์"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete?.(post.id)}
                className="text-gray-500 hover:text-red-600 p-2 transition"
                title="ลบโพสต์"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditingPost ? (
        <div className="mb-4 relative">
          <textarea
            value={editedPostContent}
            onChange={(e) => handleInputWithMention(e as any, setEditedPostContent, 'editPost')}
            onClick={(e) => handleInputWithMention(e as any, setEditedPostContent, 'editPost')}
            onKeyUp={(e) => handleInputWithMention(e as any, setEditedPostContent, 'editPost')}
            className="w-full resize-none border border-gray-300 rounded-xl p-3 text-sm md:text-base"
            rows={4}
            disabled={isSubmitting}
          />
          {renderMentionDropdown('editPost')}
          <div className="flex gap-2 mt-2">
            <button onClick={handleEditPost} disabled={!editedPostContent.trim() || isSubmitting} className="btn-primary px-4 text-sm disabled:opacity-50">
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={() => { setIsEditingPost(false); setEditedPostContent(post.content || ''); }} className="btn-secondary px-4 text-sm">
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm md:text-base text-gray-800 mb-4 whitespace-pre-wrap break-words">
            {renderTextWithTags(post.content || '')}
          </p>
          {renderEmbeds(post.content || '')}
        </>
      )}

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <div className={`grid gap-2 mb-4 ${
          post.images.length === 1 ? 'grid-cols-1' :
          post.images.length === 2 ? 'grid-cols-2' :
          'grid-cols-2'
        }`}>
          {post.images.map((image, index) => (
            <div
              key={index}
              className={`relative overflow-hidden rounded-xl ${post.images!.length === 3 && index === 0 ? 'col-span-2' : ''}`}
              style={{ aspectRatio: '4 / 3' }}
            >
              <img
                src={image}
                alt={`Post image ${index + 1}`}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition"
                onClick={() => setSelectedImage(image)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 md:gap-6 pt-4 border-t border-gray-100">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 md:gap-2 transition ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
        >
          <Heart className={`w-4 h-4 md:w-5 md:h-5 ${isLiked ? 'fill-current' : ''}`} />
          <span
            className="text-xs md:text-sm font-medium cursor-pointer hover:underline"
            onClick={(e) => { e.stopPropagation(); setShowLikeList(!showLikeList); }}
          >
            {likeCount}
          </span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1 md:gap-2 text-gray-500 hover:text-[#34a35c] transition"
        >
          <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
          <span className="text-xs md:text-sm font-medium">{comments.length}</span>
        </button>
      </div>

      {/* Like List */}
      {showLikeList && likedUsers.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <h4 className="font-bold text-sm mb-3">ถูกใจโดย</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {likedUsers.map((user) => (
              <Link key={user.id} href={`/profile/${user.username}`} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition">
                <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} alt={user.display_name} className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <p className="font-medium text-sm">{user.display_name}</p>
                  <p className="text-xs text-gray-500">@{user.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <form onSubmit={handleComment} className="mb-4">
            <div className="space-y-3">
              <div className="flex gap-2 md:gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => handleInputWithMention(e, setNewComment, 'newComment')}
                    onClick={(e) => handleInputWithMention(e as any, setNewComment, 'newComment')}
                    onKeyUp={(e) => handleInputWithMention(e as any, setNewComment, 'newComment')}
                    placeholder="เขียนความคิดเห็น... (พิมพ์ @ เพื่อแท็ก)"
                    className="input-minimal w-full text-sm md:text-base"
                    disabled={isSubmitting}
                  />
                  {renderMentionDropdown('newComment')}
                </div>
                <button type="button" onClick={() => setShowCommentImageInput(!showCommentImageInput)} className="text-[#34a35c] hover:text-[#2c8a4d] p-1 md:p-2">
                  <ImageIcon className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button type="submit" disabled={!newComment.trim() || isSubmitting} className="btn-primary px-4 md:px-6 text-sm md:text-base disabled:opacity-50">
                  ส่ง
                </button>
              </div>

              {showCommentImageInput && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentImageUrl}
                    onChange={(e) => setCommentImageUrl(e.target.value)}
                    placeholder="URL รูปภาพ..."
                    className="input-minimal flex-1 text-sm"
                  />
                  <button type="button" onClick={() => { setShowCommentImageInput(false); setCommentImageUrl(''); }} className="text-gray-500 hover:text-gray-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </form>

          <div className="space-y-4">
            {comments.map(comment => renderComment(comment))}
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 text-white hover:text-gray-300">
            <X className="w-8 h-8" />
          </button>
          <img src={selectedImage} alt="Full size" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

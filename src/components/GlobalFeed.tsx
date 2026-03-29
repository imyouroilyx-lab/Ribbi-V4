'use client';

import { useState, useEffect } from 'react';
import { supabase, Post, User } from '@/lib/supabase';
import PostCardV3 from './PostCardV3';

interface GlobalFeedProps {
  currentUser: User;
  refreshTrigger?: number;  // เพิ่มบรรทัดนี้
}

export default function GlobalFeed({ currentUser, refreshTrigger }: GlobalFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, [refreshTrigger]);  // เพิ่ม refreshTrigger ใน dependency

  const loadPosts = async () => {
    try {
      const { data } = await supabase
        .from('posts')
        .select('*, author:author_id(*), target:target_id(*)')
        .order('created_at', { ascending: false });

      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('ต้องการลบโพสต์นี้?')) return;

    try {
      await supabase.from('posts').delete().eq('id', postId);
      setPosts(posts.filter(p => p.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <img 
          src="https://iili.io/qbtgKBt.png"
          alt="Loading"
          className="w-16 h-16 mx-auto mb-4 animate-bounce"
        />
        <p className="text-gray-600">กำลังโหลดโพสต์...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="card-minimal text-center py-12">
        <img 
          src="https://iili.io/qbtgKBt.png"
          alt="No posts"
          className="w-24 h-24 mx-auto mb-4 opacity-50"
        />
        <p className="text-gray-500">ยังไม่มีโพสต์</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <PostCardV3
          key={post.id}
          post={post}
          currentUserId={currentUser.id}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
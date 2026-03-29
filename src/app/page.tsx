'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, User, Post } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import PostCardV3 from '@/components/PostCardV3';
import CreatePostV3 from '@/components/CreatePostV3';
import ConfirmModal from '@/components/ConfirmModal';
import Link from 'next/link';

const POSTS_PER_PAGE = 20;

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInitialData();
  }, [refreshTrigger]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, page]);

  // Auto-update last_active every 5 minutes
  useEffect(() => {
    if (!currentUser) return;

    const updateActivity = async () => {
      await supabase
        .from('users')
        .update({ last_active: new Date().toISOString() })
        .eq('id', currentUser.id);
    };

    updateActivity();
    const interval = setInterval(updateActivity, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Refresh online users every 30 seconds
  useEffect(() => {
    if (!currentUser) return;
    
    const interval = setInterval(() => {
      loadOnlineUsers();
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const loadInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      setCurrentUser(userData);

      // Update last_active
      await supabase
        .from('users')
        .update({ last_active: new Date().toISOString() })
        .eq('id', user.id);

      // Load first 20 posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('*, author:author_id(*), target:target_id(*)')
        .order('created_at', { ascending: false })
        .range(0, POSTS_PER_PAGE - 1);

      setPosts(postsData || []);
      setPage(0);
      setHasMore((postsData?.length || 0) === POSTS_PER_PAGE);

      await loadOnlineUsers();
      await loadAllUsers();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;
    const start = nextPage * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE - 1;

    try {
      const { data: newPosts } = await supabase
        .from('posts')
        .select('*, author:author_id(*), target:target_id(*)')
        .order('created_at', { ascending: false })
        .range(start, end);

      if (newPosts && newPosts.length > 0) {
        setPosts(prev => [...prev, ...newPosts]);
        setPage(nextPage);
        setHasMore(newPosts.length === POSTS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadOnlineUsers = async () => {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      const { data } = await supabase
        .from('users')
        .select('*')
        .gte('last_active', tenMinutesAgo)
        .order('last_active', { ascending: false })
        .limit(20);

      setOnlineUsers(data || []);
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      setAllUsers(data || []);
    } catch (error) {
      console.error('Error loading all users:', error);
    }
  };

  const handlePostCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;

    try {
      await supabase.from('posts').delete().eq('id', postToDelete);
      setPosts(posts.filter(p => p.id !== postToDelete));
      setPostToDelete(null);
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  if (isLoading) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <img 
              src="https://iili.io/qbtgKBt.png"
              alt="Loading"
              className="w-16 h-16 mx-auto mb-4 animate-bounce"
            />
            <p className="text-gray-600">กำลังโหลด...</p>
          </div>
        </div>
      </NavLayout>
    );
  }

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
            <CreatePostV3 
              currentUser={currentUser}
              onPostCreated={handlePostCreated}
            />

            <div className="space-y-6">
              {posts.length === 0 ? (
                <div className="card-minimal text-center py-12">
                  <img 
                    src="https://iili.io/qbtgKBt.png"
                    alt="No posts"
                    className="w-24 h-24 mx-auto mb-4 opacity-50"
                  />
                  <p className="text-gray-500">ยังไม่มีโพสต์</p>
                </div>
              ) : (
                <>
                  {posts.map((post) => (
                    <PostCardV3
                      key={post.id}
                      post={post}
                      currentUserId={currentUser.id}
                      onDelete={(postId) => {
                        setPostToDelete(postId);
                        setShowDeleteConfirm(true);
                      }}
                    />
                  ))}

                  {/* Infinite Scroll Trigger */}
                  <div ref={observerTarget} className="py-4">
                    {isLoadingMore && (
                      <div className="text-center">
                        <img 
                          src="https://iili.io/qbtgKBt.png"
                          alt="Loading"
                          className="w-12 h-12 mx-auto mb-2 animate-bounce"
                        />
                        <p className="text-sm text-gray-500">กำลังโหลดเพิ่มเติม...</p>
                      </div>
                    )}
                    {!hasMore && posts.length > 0 && (
                      <p className="text-center text-sm text-gray-500">
                        ไม่มีโพสต์เพิ่มเติมแล้ว
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-80 lg:flex-shrink-0 space-y-6">
            {/* Online Users */}
            <div className="hidden lg:block">
              <div className="sticky top-4 space-y-6">
                <div className="card-minimal">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">ออนไลน์</h3>
                    <span className="text-sm text-gray-500">{onlineUsers.length} คน</span>
                  </div>
                  
                  {onlineUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">ไม่มีผู้ใช้ออนไลน์</p>
                  ) : (
                    <div className="space-y-3">
                      {onlineUsers.map((user) => (
                        <Link
                          key={user.id}
                          href={`/profile/${user.username}`}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition"
                        >
                          <div className="relative">
                            <img
                              src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                              alt={user.display_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{user.display_name}</p>
                            <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* All Users */}
                <div className="card-minimal">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">ผู้ใช้ทั้งหมด</h3>
                    <span className="text-sm text-gray-500">{allUsers.length} คน</span>
                  </div>
                  
                  {allUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">ไม่มีผู้ใช้</p>
                  ) : (
                    <div className="space-y-3">
                      {allUsers.map((user) => {
                        const isOnline = onlineUsers.some(u => u.id === user.id);
                        
                        return (
                          <Link
                            key={user.id}
                            href={`/profile/${user.username}`}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition"
                          >
                            <div className="relative">
                              <img
                                src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                                alt={user.display_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                              {isOnline && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{user.display_name}</p>
                              <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPostToDelete(null);
        }}
        onConfirm={handleDeletePost}
        title="ต้องการลบโพสต์นี้?"
        message="คุณจะไม่สามารถกู้คืนโพสต์นี้ได้อีก"
        confirmText="ลบโพสต์"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}
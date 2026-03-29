'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

  // Ref สำหรับเก็บตัว Observer
  const observer = useRef<IntersectionObserver | null>(null);
  
  // ฟังก์ชัน Callback สำหรับตรวจจับ Element ท้ายหน้า
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, hasMore]);

  // โหลดข้อมูลเริ่มต้น
  useEffect(() => {
    loadInitialData();
  }, [refreshTrigger]);

  // เมื่อ Page เปลี่ยน ให้ไปโหลดข้อมูลเพิ่ม
  useEffect(() => {
    if (page > 0) {
      loadMorePosts();
    }
  }, [page]);

  // Auto-update last_active
  useEffect(() => {
    if (!currentUser) return;
    const updateActivity = async () => {
      await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', currentUser.id);
    };
    updateActivity();
    const interval = setInterval(updateActivity, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => loadOnlineUsers(), 30 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
      setCurrentUser(userData);

      // โหลด 20 โพสต์แรก
      const { data: postsData } = await supabase
        .from('posts')
        .select('*, author:author_id(*), target:target_id(*)')
        .order('created_at', { ascending: false })
        .range(0, POSTS_PER_PAGE - 1);

      setPosts(postsData || []);
      setPage(0);
      setHasMore((postsData?.length || 0) === POSTS_PER_PAGE);

      await Promise.all([loadOnlineUsers(), loadAllUsers()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const start = page * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE - 1;

    try {
      const { data: newPosts } = await supabase
        .from('posts')
        .select('*, author:author_id(*), target:target_id(*)')
        .order('created_at', { ascending: false })
        .range(start, end);

      if (newPosts && newPosts.length > 0) {
        setPosts(prev => [...prev, ...newPosts]);
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
      const { data } = await supabase.from('users').select('*').gte('last_active', tenMinutesAgo).order('last_active', { ascending: false }).limit(20);
      setOnlineUsers(data || []);
    } catch (error) { console.error(error); }
  };

  const loadAllUsers = async () => {
    try {
      const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(20);
      setAllUsers(data || []);
    } catch (error) { console.error(error); }
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
    } catch (error) { console.error(error); }
  };

  if (isLoading && page === 0) {
    return (
      <NavLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 mx-auto mb-4 animate-bounce" />
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
            <CreatePostV3 currentUser={currentUser} onPostCreated={handlePostCreated} />

            <div className="space-y-6">
              {posts.length === 0 && !isLoading ? (
                <div className="card-minimal text-center py-12">
                  <img src="https://iili.io/qbtgKBt.png" alt="No posts" className="w-24 h-24 mx-auto mb-4 opacity-50" />
                  <p className="text-gray-500">ยังไม่มีโพสต์</p>
                </div>
              ) : (
                <>
                  {posts.map((post, index) => {
                    // ถ้าเป็นโพสต์สุดท้ายของอาเรย์ ให้ติด Ref ไว้เพื่อตรวจจับการเลื่อน
                    if (posts.length === index + 1) {
                      return (
                        <div ref={lastPostElementRef} key={post.id}>
                          <PostCardV3
                            post={post}
                            currentUserId={currentUser.id}
                            onDelete={(id) => { setPostToDelete(id); setShowDeleteConfirm(true); }}
                          />
                        </div>
                      );
                    } else {
                      return (
                        <PostCardV3
                          key={post.id}
                          post={post}
                          currentUserId={currentUser.id}
                          onDelete={(id) => { setPostToDelete(id); setShowDeleteConfirm(true); }}
                        />
                      );
                    }
                  })}

                  {/* Loading Indicator */}
                  {isLoadingMore && (
                    <div className="text-center py-4">
                      <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-10 h-10 mx-auto mb-2 animate-bounce" />
                      <p className="text-xs text-gray-500">กำลังโหลดเพิ่มเติม...</p>
                    </div>
                  )}

                  {!hasMore && posts.length > 0 && (
                    <p className="text-center text-sm text-gray-400 py-8">
                      — คุณมาถึงจุดสิ้นสุดแล้ว —
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-80 lg:flex-shrink-0 space-y-6">
            <div className="hidden lg:block">
              <div className="sticky top-4 space-y-6">
                <div className="card-minimal">
                  <h3 className="font-bold text-lg mb-4">ออนไลน์ ({onlineUsers.length})</h3>
                  <div className="space-y-3">
                    {onlineUsers.map((user) => (
                      <Link key={user.id} href={`/profile/${user.username}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition">
                        <div className="relative">
                          <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" />
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.display_name}</p>
                          <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="card-minimal">
                  <h3 className="font-bold text-lg mb-4">ผู้ใช้ใหม่</h3>
                  <div className="space-y-3">
                    {allUsers.slice(0, 5).map((user) => (
                      <Link key={user.id} href={`/profile/${user.username}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition">
                        <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.display_name}</p>
                          <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setPostToDelete(null); }}
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

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, User, Post } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import PostCardV3 from '@/components/PostCardV3';
import CreatePostV3 from '@/components/CreatePostV3';
import ConfirmModal from '@/components/ConfirmModal';
import Link from 'next/link';
import { Users, Circle } from 'lucide-react';

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

  const observer = useRef<IntersectionObserver | null>(null);
  
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

  useEffect(() => {
    loadInitialData();
  }, [refreshTrigger]);

  useEffect(() => {
    if (page > 0) {
      loadMorePosts();
    }
  }, [page]);

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
    const interval = setInterval(() => loadOnlineUsers(), 60 * 1000); 
    return () => clearInterval(interval);
  }, [currentUser]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const [userDataRes, postsDataRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase
          .from('posts')
          .select('*, author:author_id(id, username, display_name, profile_img_url), target:target_id(id, username, display_name, profile_img_url)')
          .order('created_at', { ascending: false })
          .range(0, POSTS_PER_PAGE - 1)
      ]);

      if (userDataRes.data) setCurrentUser(userDataRes.data);
      if (postsDataRes.data) {
        setPosts(postsDataRes.data as any);
        setHasMore(postsDataRes.data.length === POSTS_PER_PAGE);
      }

      loadOnlineUsers();
      loadAllUsers();
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
        .select('*, author:author_id(id, username, display_name, profile_img_url), target:target_id(id, username, display_name, profile_img_url)')
        .order('created_at', { ascending: false })
        .range(start, end);

      if (newPosts && newPosts.length > 0) {
        setPosts(prev => [...prev, ...newPosts] as any);
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
        .select('id, username, display_name, profile_img_url, last_active') 
        .gte('last_active', tenMinutesAgo)
        .order('last_active', { ascending: false })
        .limit(20); 
      
      // ✅ เพิ่ม "as any" เพื่อให้ Build ผ่านโดยยังคงประสิทธิภาพเดิมไว้
      setOnlineUsers((data as any) || []);
    } catch (error) { console.error(error); }
  };

  const loadAllUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, username, display_name, profile_img_url') 
        .order('display_name', { ascending: true })
        .limit(50);
      
      // ✅ เพิ่ม "as any" เพื่อให้ Build ผ่าน
      setAllUsers((data as any) || []);
    } catch (error) { console.error(error); }
  };

  const handlePostCreated = () => {
    setPage(0);
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
            <p className="text-gray-600 font-medium">กำลังโหลด Ribbi...</p>
          </div>
        </div>
      </NavLayout>
    );
  }

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
            
            {/* MOBILE ONLY: Online Users Horizontal Scroll */}
            <div className="lg:hidden">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
                  ออนไลน์ขณะนี้ ({onlineUsers.length})
                </h3>
                <Link href="/users" className="text-xs text-frog-600 font-semibold">ดูทั้งหมด</Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {onlineUsers.map((user) => (
                  <Link key={user.id} href={`/profile/${user.username}`} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
                    <div className="relative">
                      <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm" loading="lazy" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <p className="text-[10px] font-medium truncate w-full text-center">{user.display_name.split(' ')[0]}</p>
                  </Link>
                ))}
              </div>
            </div>

            <CreatePostV3 currentUser={currentUser} onPostCreated={handlePostCreated} />

            <div className="space-y-6">
              {posts.length === 0 && !isLoading ? (
                <div className="card-minimal text-center py-12">
                  <img src="https://iili.io/qbtgKBt.png" alt="No posts" className="w-24 h-24 mx-auto mb-4 opacity-50" />
                  <p className="text-gray-500">ยังไม่มีโพสต์ในขณะนี้</p>
                </div>
              ) : (
                <>
                  {posts.map((post, index) => {
                    const isLastElement = posts.length === index + 1;
                    return (
                      <div ref={isLastElement ? lastPostElementRef : null} key={post.id}>
                        <PostCardV3
                          post={post}
                          currentUserId={currentUser.id}
                          onDelete={(id) => { setPostToDelete(id); setShowDeleteConfirm(true); }}
                        />
                      </div>
                    );
                  })}
                  {isLoadingMore && (
                    <div className="text-center py-6">
                      <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-10 h-10 mx-auto mb-2 animate-bounce" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR: Desktop Only */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-4 space-y-6">
              
              {/* Online Users Widget */}
              <div className="card-minimal bg-white/80 backdrop-blur-sm border border-gray-50">
                <h3 className="font-bold text-lg mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500" />
                    ออนไลน์
                  </span>
                  <span className="text-xs font-bold bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full border border-green-100">
                    {onlineUsers.length}
                  </span>
                </h3>
                <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {onlineUsers.map((user) => (
                    <Link key={user.id} href={`/profile/${user.username}`} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-frog-50 transition-all group">
                      <div className="relative flex-shrink-0">
                        <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform" loading="lazy" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate text-gray-900">{user.display_name}</p>
                        <p className="text-[10px] text-gray-400 truncate tracking-tighter">@{user.username}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* All Members Widget */}
              <div className="card-minimal flex flex-col h-[400px] border border-gray-50 shadow-soft-lg">
                <h3 className="font-bold text-lg mb-4 flex items-center justify-between flex-shrink-0">
                  <Link href="/users" className="flex items-center gap-2 hover:text-frog-600 transition-colors cursor-pointer">
                    <Users className="w-5 h-5 text-frog-600" />
                    สมาชิกทั้งหมด
                  </Link>
                  <span className="text-xs font-bold bg-gray-50 text-gray-500 px-2.5 py-0.5 rounded-full border border-gray-100">
                    {allUsers.length}
                  </span>
                </h3>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                  {allUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30">
                       <Users className="w-8 h-8 mb-2" />
                       <p className="text-xs">กำลังโหลดรายชื่อ...</p>
                    </div>
                  ) : (
                    allUsers.map((user) => {
                      const isOnline = onlineUsers.some(u => u.id === user.id);
                      return (
                        <Link key={user.id} href={`/profile/${user.username}`} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group">
                          <div className="relative flex-shrink-0">
                            <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-2xl object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" loading="lazy" />
                            {isOnline && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate text-gray-800">{user.display_name}</p>
                            <p className="text-[10px] text-gray-400 truncate">@{user.username}</p>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
                
                <div className="pt-4 mt-2 border-t border-gray-50 text-center flex-shrink-0">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Ribbi Application</p>
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
        message="การกระทำนี้ไม่สามารถย้อนกลับได้ โพสต์ของคุณจะหายไปจากระบบทันที"
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        variant="danger"
      />
    </NavLayout>
  );
}

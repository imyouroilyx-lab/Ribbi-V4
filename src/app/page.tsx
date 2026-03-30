'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, User, Post } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import PostCardV3 from '@/components/PostCardV3';
import CreatePostV3 from '@/components/CreatePostV3';
import ConfirmModal from '@/components/ConfirmModal';
import Link from 'next/link';
import { Users, Circle, ChevronRight } from 'lucide-react';

const POSTS_PER_PAGE = 15; // ลดจำนวนต่อหน้าลงเล็กน้อยเพื่อความเร็วในการโหลดครั้งแรก

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
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

  // โหลดข้อมูลเริ่มต้น
  useEffect(() => {
    loadInitialData();
  }, [refreshTrigger]);

  // โหลดโพสต์เพิ่มเมื่อ Scroll
  useEffect(() => {
    if (page > 0) {
      loadMorePosts();
    }
  }, [page]);

  // ระบบออนไลน์
  useEffect(() => {
    if (!currentUser) return;
    const updateActivity = async () => {
      await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', currentUser.id);
    };
    updateActivity();
    const interval = setInterval(updateActivity, 5 * 60 * 1000); 
    return () => clearInterval(interval);
  }, [currentUser]);

  // รีโหลดคนออนไลน์ (หน่วงเวลาโหลดครั้งแรกเพื่อความลื่น)
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => loadOnlineUsers(), 1500);
    const interval = setInterval(() => loadOnlineUsers(), 60 * 1000); 
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [currentUser]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      // 1. ดึงข้อมูล User และ Feed หลักเท่านั้น (Priority สูงสุด)
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
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    // ✅ เพิ่มการหน่วงเวลา (Delay) 3 วินาที (3000 ms) ตรงนี้
    await new Promise((resolve) => setTimeout(resolve, 3000));

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
        .limit(15); 
      
      setOnlineUsers((data as any) || []);
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
            <p className="text-gray-600 font-medium">กำลังเตรียมหน้าหลัก...</p>
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
          
          {/* Main Content (Left) */}
          <div className="flex-1 min-w-0 space-y-6">
            
            {/* MOBILE ONLY: Online Users Horizontal Scroll */}
            <div className="lg:hidden">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
                  ออนไลน์ขณะนี้ ({onlineUsers.length})
                </h3>
                <Link href="/users" className="text-xs text-frog-600 font-semibold">ดูสมาชิกทั้งหมด</Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {onlineUsers.map((user) => (
                  <Link key={user.id} href={`/profile/${user.username}`} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
                    <div className="relative">
                      <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm" loading="lazy" alt="" />
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

          {/* SIDEBAR (Right) - Desktop Only */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-4 space-y-6">
              
              {/* Online Users Widget */}
              <div className="card-minimal bg-white/90 backdrop-blur-sm border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500 animate-pulse" />
                    ออนไลน์
                  </h3>
                  <span className="text-xs font-bold bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full border border-green-100">
                    {onlineUsers.length}
                  </span>
                </div>

                <div className="space-y-1 max-h-[450px] overflow-y-auto custom-scrollbar mb-4">
                  {onlineUsers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6 italic">ไม่มีผู้ใช้ออนไลน์</p>
                  ) : (
                    onlineUsers.map((user) => (
                      <Link key={user.id} href={`/profile/${user.username}`} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-frog-50 transition-all group">
                        <div className="relative flex-shrink-0">
                          <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform" loading="lazy" alt="" />
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate text-gray-900">{user.display_name}</p>
                          <p className="text-[10px] text-gray-400 truncate tracking-tighter">@{user.username}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>

                {/* ✅ ปุ่มใหม่สำหรับไปหน้าสมาชิกทั้งหมด */}
                <Link 
                  href="/users" 
                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md group"
                >
                  <Users className="w-4 h-4" />
                  ดูสมาชิกทั้งหมด
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Branding */}
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Ribbi Community Platform</p>
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

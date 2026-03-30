'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, type User, type Post } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import PostCardV3 from '@/components/PostCardV3';
import CreatePostV3 from '@/components/CreatePostV3';
import ConfirmModal from '@/components/ConfirmModal';
import Link from 'next/link';
import { Users, Circle, ChevronRight, RefreshCw, Loader2, ArrowRight } from 'lucide-react'; // ✅ เพิ่ม ArrowRight

const POSTS_PER_PAGE = 15;

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);
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
      const lastUpdated = sessionStorage.getItem('last_active_update');
      const now = Date.now();
      if (!lastUpdated || now - parseInt(lastUpdated) > 120000) {
        await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', currentUser.id);
        sessionStorage.setItem('last_active_update', now.toString());
      }
    };
    
    updateActivity();
    const interval = setInterval(updateActivity, 5 * 60 * 1000); 
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadOnlineUsers();
    }
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
    if (isOnlineLoading) return;
    setIsOnlineLoading(true);
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('users')
        .select('id, username, display_name, profile_img_url, last_active') 
        .gte('last_active', tenMinutesAgo)
        .order('last_active', { ascending: false })
        .limit(12);
      setOnlineUsers((data as any) || []);
    } catch (error) { 
      console.error(error); 
    } finally {
      setIsOnlineLoading(false);
    }
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
          <img src="https://iili.io/qbtgKBt.png" alt="Loading" className="w-16 h-16 animate-bounce" />
        </div>
      </NavLayout>
    );
  }

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          
          <div className="flex-1 min-w-0 space-y-6">
            
            {/* MOBILE ONLY: Online Users Horizontal Scroll */}
            <div className="lg:hidden">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                  ออนไลน์ขณะนี้ ({onlineUsers.length})
                </h3>
                
                {/* ✅ เพิ่มปุ่มสมาชิกทั้งหมดสำหรับ Mobile */}
                <div className="flex items-center gap-1">
                  <Link 
                    href="/users" 
                    className="text-[10px] font-black uppercase text-frog-600 px-2 py-1 bg-frog-50 rounded-lg flex items-center gap-1"
                  >
                    สมาชิก <ChevronRight size={12} />
                  </Link>
                  <button 
                    onClick={loadOnlineUsers}
                    disabled={isOnlineLoading}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <RefreshCw size={14} className={`${isOnlineLoading ? 'animate-spin' : ''} text-gray-400`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {onlineUsers.map((user) => (
                  <Link key={user.id} href={`/profile/${user.username}`} className="flex flex-col items-center gap-1 flex-shrink-0 w-16 group">
                    <div className="relative">
                      <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform" loading="lazy" alt="" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <p className="text-[10px] font-bold truncate w-full text-center text-gray-700">{user.display_name.split(' ')[0]}</p>
                  </Link>
                ))}
                
                {/* ✅ เพิ่มการ์ด "ดูทั้งหมด" ท้ายสุดของรายชื่อคนออนไลน์ใน Mobile */}
                {onlineUsers.length > 0 && (
                  <Link href="/users" className="flex flex-col items-center gap-1 flex-shrink-0 w-16 group">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300 group-hover:bg-frog-500 group-hover:border-frog-500 transition-all">
                      <ArrowRight size={20} className="text-slate-400 group-hover:text-white" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 group-hover:text-frog-600 text-center uppercase tracking-tighter">ทั้งหมด</p>
                  </Link>
                )}
              </div>
            </div>

            <CreatePostV3 currentUser={currentUser} onPostCreated={handlePostCreated} />

            <div className="space-y-6">
              {posts.length === 0 && !isLoading ? (
                <div className="card-minimal text-center py-12">
                  <img src="https://iili.io/qbtgKBt.png" alt="No posts" className="w-20 h-20 mx-auto mb-4 opacity-30 grayscale" />
                  <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">ยังไม่มีโพสต์ในขณะนี้</p>
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
                      <Loader2 className="w-8 h-8 text-frog-500 animate-spin mx-auto" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* SIDEBAR (Right) - Desktop Only */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-4 space-y-6">
              
              <div className="card-minimal bg-white/90 border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                  <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
                    ออนไลน์ขณะนี้
                  </h3>
                  <button 
                    onClick={loadOnlineUsers}
                    disabled={isOnlineLoading}
                    className="p-1.5 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-gray-200"
                    title="รีเฟรชรายชื่อ"
                  >
                    <RefreshCw size={14} className={`${isOnlineLoading ? 'animate-spin' : ''} text-frog-600`} />
                  </button>
                </div>

                <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {isOnlineLoading && onlineUsers.length === 0 ? (
                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-gray-200" /></div>
                  ) : onlineUsers.length === 0 ? (
                    <p className="text-[10px] font-bold text-gray-300 text-center py-8 uppercase tracking-tighter italic">ไม่มีผู้ใช้ออนไลน์</p>
                  ) : (
                    onlineUsers.map((user) => (
                      <Link key={user.id} href={`/profile/${user.username}`} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-frog-50 transition-all group">
                        <div className="relative flex-shrink-0">
                          <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform" loading="lazy" alt="" />
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate text-gray-900 leading-none mb-1">{user.display_name}</p>
                          <p className="text-[10px] text-gray-400 truncate font-medium">@{user.username}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>

                <div className="p-3 bg-gray-50/50 border-t border-gray-100">
                  <Link 
                    href="/users" 
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                  >
                    <Users size={14} />
                    ดูสมาชิกทั้งหมด
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>

              <div className="text-center">
                <p className="text-[9px] text-gray-300 uppercase font-black tracking-[0.2em]">Ribbi Community Platform</p>
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
        variant="danger"
      />
    </NavLayout>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoryElapsedText, validateStoryImageUrl } from '@/lib/story-utils';
import type { Story, StoryAuthor } from '@/types/story';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImageOff,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

type CurrentUser = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  profile_img_url?: string | null;
  is_verified?: boolean | null;
};

type StoriesBarProps = {
  currentUser: CurrentUser;
};

type StoryGroup = {
  authorId: string;
  latestStory: Story;
  stories: Story[];
};

const STORY_DURATION_MS = 5000;

function normalizeAuthor(author: Story['author']): StoryAuthor | null {
  if (!author) return null;
  if (Array.isArray(author)) return author[0] ?? null;
  return author;
}

function getDisplayName(author: StoryAuthor | null) {
  return author?.display_name || author?.username || 'Story';
}

function getFirstName(name: string) {
  return name.split(' ')[0] || name;
}

export default function StoriesBar({ currentUser }: StoriesBarProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<StoryGroup | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [previewImageError, setPreviewImageError] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createErrorText, setCreateErrorText] = useState('');
  const [storyViewers, setStoryViewers] = useState<StoryAuthor[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function fetchViewedStories() {
    const { data, error } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('viewer_id', currentUser.id);

    if (error) {
      console.error('Error loading viewed stories:', error);
      setViewedStoryIds(new Set());
      return;
    }

    const ids = new Set((data ?? []).map((item: any) => item.story_id as string));
    setViewedStoryIds(ids);
  }

  async function fetchStories() {
    setLoading(true);

    const { data, error } = await supabase
      .from('stories')
      .select(`
        id,
        author_id,
        image_url,
        caption,
        created_at,
        expires_at,
        author:author_id (
          id,
          username,
          display_name,
          profile_img_url,
          is_verified
        )
      `)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error loading stories:', error);
      setLoading(false);
      return;
    }

    setStories((data ?? []) as Story[]);
    await fetchViewedStories();
    setLoading(false);
  }

  useEffect(() => {
    fetchStories();
  }, []);

  const groupedStories = useMemo(() => {
    const map = new Map<string, Story[]>();

    for (const story of stories) {
      const existing = map.get(story.author_id) ?? [];
      existing.push(story);
      map.set(story.author_id, existing);
    }

    return Array.from(map.entries())
      .map(([authorId, authorStories]) => {
        const sortedStories = [...authorStories].sort((a, b) => {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        return {
          authorId,
          latestStory: sortedStories[sortedStories.length - 1],
          stories: sortedStories,
        };
      })
      .sort((a, b) => {
        return (
          new Date(b.latestStory.created_at).getTime() -
          new Date(a.latestStory.created_at).getTime()
        );
      });
  }, [stories]);

  const ownGroup = useMemo(() => {
    return groupedStories.find((group) => group.authorId === currentUser.id) ?? null;
  }, [groupedStories, currentUser.id]);

  const otherGroups = useMemo(() => {
    return groupedStories.filter((group) => group.authorId !== currentUser.id);
  }, [groupedStories, currentUser.id]);

  const viewerGroups = useMemo(() => {
    return groupedStories;
  }, [groupedStories]);

  const selectedStory = selectedGroup?.stories[selectedStoryIndex] ?? null;

  const selectedAuthor = selectedStory
    ? normalizeAuthor(selectedStory.author)
    : selectedGroup
      ? normalizeAuthor(selectedGroup.latestStory.author)
      : null;

  const selectedGroupIndex = selectedGroup
    ? viewerGroups.findIndex((group) => group.authorId === selectedGroup.authorId)
    : -1;

  const canGoPreviousStory =
    selectedStoryIndex > 0 || selectedGroupIndex > 0;

  const canGoNextStory =
    selectedGroup
      ? selectedStoryIndex < selectedGroup.stories.length - 1 ||
        selectedGroupIndex < viewerGroups.length - 1
      : false;

  const trimmedImageUrl = imageUrl.trim();
  const canShowPreview = validateStoryImageUrl(trimmedImageUrl);

  function hasUnviewedStories(group: StoryGroup) {
    if (group.authorId === currentUser.id) {
      return true;
    }

    return group.stories.some((story) => !viewedStoryIds.has(story.id));
  }

  function getStoryRingClass(group: StoryGroup) {
    if (hasUnviewedStories(group)) {
      return 'bg-gradient-to-br from-pink-400 via-purple-500 to-sky-400';
    }

    return 'bg-slate-200';
  }

  function getStoryInnerClass(group: StoryGroup) {
    if (hasUnviewedStories(group)) {
      return 'bg-white';
    }

    return 'bg-white/95';
  }

  async function markStoryAsViewed(story: Story) {
    if (story.author_id === currentUser.id) return;

    setViewedStoryIds((prev) => {
      const next = new Set(prev);
      next.add(story.id);
      return next;
    });

    const { error } = await supabase
      .from('story_views')
      .upsert(
        {
          story_id: story.id,
          viewer_id: currentUser.id,
        },
        {
          onConflict: 'story_id,viewer_id',
          ignoreDuplicates: true,
        }
      );

    if (error) {
      console.error('Error marking story as viewed:', error);
    }
  }

  async function fetchStoryViewers(storyId: string, storyAuthorId: string) {
    if (storyAuthorId !== currentUser.id) {
      setStoryViewers([]);
      setViewerCount(0);
      return;
    }

    const { data, error, count } = await supabase
      .from('story_views')
      .select(`
        viewer:viewer_id (
          id,
          username,
          display_name,
          profile_img_url,
          is_verified
        )
      `, { count: 'exact' })
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false });

    if (error) {
      console.error('Error loading story viewers:', error);
      setStoryViewers([]);
      setViewerCount(0);
      return;
    }

    const viewers =
      data
        ?.map((item: any) => {
          if (Array.isArray(item.viewer)) return item.viewer[0];
          return item.viewer;
        })
        .filter(Boolean) ?? [];

    setStoryViewers(viewers);
    setViewerCount(count || viewers.length);
  }

  async function openStoryGroup(group: StoryGroup) {
    const firstStory = group.stories[0];

    setSelectedGroup(group);
    setSelectedStoryIndex(0);
    setStoryProgress(0);

    await markStoryAsViewed(firstStory);
    await fetchStoryViewers(firstStory.id, firstStory.author_id);
  }

  async function openStoryAt(group: StoryGroup, storyIndex: number) {
    const safeIndex = Math.max(0, Math.min(storyIndex, group.stories.length - 1));
    const story = group.stories[safeIndex];

    setSelectedGroup(group);
    setSelectedStoryIndex(safeIndex);
    setStoryProgress(0);

    await markStoryAsViewed(story);
    await fetchStoryViewers(story.id, story.author_id);
  }

  function closeStoryViewer() {
    setSelectedGroup(null);
    setSelectedStoryIndex(0);
    setStoryProgress(0);
    setStoryViewers([]);
    setViewerCount(0);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreateErrorText('');
    setPreviewImageError(false);
  }

  async function goToPreviousStory() {
    if (!selectedGroup) return;

    if (selectedStoryIndex > 0) {
      const nextIndex = selectedStoryIndex - 1;
      await openStoryAt(selectedGroup, nextIndex);
      return;
    }

    const currentGroupIndex = viewerGroups.findIndex(
      (group) => group.authorId === selectedGroup.authorId
    );

    if (currentGroupIndex > 0) {
      const previousGroup = viewerGroups[currentGroupIndex - 1];
      await openStoryAt(previousGroup, previousGroup.stories.length - 1);
    }
  }

  async function goToNextStory() {
    if (!selectedGroup) return;

    if (selectedStoryIndex < selectedGroup.stories.length - 1) {
      const nextIndex = selectedStoryIndex + 1;
      await openStoryAt(selectedGroup, nextIndex);
      return;
    }

    const currentGroupIndex = viewerGroups.findIndex(
      (group) => group.authorId === selectedGroup.authorId
    );

    if (currentGroupIndex >= 0 && currentGroupIndex < viewerGroups.length - 1) {
      const nextGroup = viewerGroups[currentGroupIndex + 1];
      await openStoryAt(nextGroup, 0);
      return;
    }

    closeStoryViewer();
  }

  useEffect(() => {
    if (!selectedGroup || !selectedStory) return;

    setStoryProgress(0);

    const startedAt = Date.now();

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min((elapsed / STORY_DURATION_MS) * 100, 100);

      setStoryProgress(nextProgress);

      if (nextProgress >= 100) {
        window.clearInterval(interval);
        goToNextStory();
      }
    }, 50);

    return () => {
      window.clearInterval(interval);
    };
  }, [selectedStory?.id]);

  async function handleCreateStory() {
    setCreateErrorText('');

    const trimmedCaption = caption.trim();

    if (!validateStoryImageUrl(trimmedImageUrl)) {
      setCreateErrorText('กรุณาใส่ลิงก์รูปภาพที่ถูกต้อง');
      return;
    }

    setCreateLoading(true);

    const { error } = await supabase
      .from('stories')
      .insert({
        author_id: currentUser.id,
        image_url: trimmedImageUrl,
        caption: trimmedCaption || null,
      });

    setCreateLoading(false);

    if (error) {
      setCreateErrorText(error.message);
      return;
    }

    setImageUrl('');
    setCaption('');
    setPreviewImageError(false);
    setShowCreateModal(false);

    await fetchStories();
  }

  async function handleDeleteStory(storyId: string) {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (error) {
      alert(error.message);
      return;
    }

    closeStoryViewer();
    await fetchStories();
  }

  return (
    <>
      <section className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h2 className="text-sm font-black text-gray-900 tracking-tight">
              Stories
            </h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              หายภายใน 24 ชม.
            </p>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => {
              if (ownGroup) {
                openStoryGroup(ownGroup);
              } else {
                setShowCreateModal(true);
              }
            }}
            className="relative group"
          >
            <div
              className={`w-16 h-16 rounded-[1.35rem] p-[2px] ${
                ownGroup ? getStoryRingClass(ownGroup) : 'bg-slate-200'
              }`}
            >
              <div
                className={`w-full h-full rounded-[1.2rem] p-[2px] ${
                  ownGroup ? getStoryInnerClass(ownGroup) : 'bg-white'
                }`}
              >
                <img
                  src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                  className="w-full h-full rounded-[1rem] object-cover"
                  alt=""
                  onError={(event) => {
                    event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowCreateModal(true);
              }}
              className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-frog-500 border-2 border-white text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"
            >
              <Plus size={14} strokeWidth={3} />
            </button>

            <p className="mt-1 text-[10px] font-black text-gray-500 w-16 truncate">
              ของคุณ
            </p>
          </button>

          {loading ? (
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 px-2">
              <Loader2 className="animate-spin" size={16} />
              กำลังโหลด...
            </div>
          ) : (
            otherGroups.map((group) => {
              const story = group.latestStory;
              const author = normalizeAuthor(story.author);
              const displayName = getDisplayName(author);
              const groupHasUnviewed = hasUnviewedStories(group);

              return (
                <button
                  key={group.authorId}
                  type="button"
                  onClick={() => openStoryGroup(group)}
                  className={`flex flex-col items-center gap-1 flex-shrink-0 w-16 group transition-opacity ${
                    groupHasUnviewed ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-[1.35rem] p-[2px] ${getStoryRingClass(group)}`}>
                    <div className={`w-full h-full rounded-[1.2rem] p-[2px] ${getStoryInnerClass(group)}`}>
                      <div className="relative w-full h-full">
                        <img
                          src={author?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                          className="w-full h-full rounded-[1rem] object-cover"
                          alt=""
                          onError={(event) => {
                            event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                          }}
                        />

                        {group.stories.length > 1 && (
                          <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-950 text-white text-[9px] font-black flex items-center justify-center border-2 border-white">
                            {group.stories.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] font-black text-gray-500 w-16 truncate flex items-center justify-center gap-0.5">
                    {getFirstName(displayName)}
                    {author?.is_verified && (
                      <BadgeCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    )}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </section>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeCreateModal}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  เพิ่มสตอรี่
                </h3>
                <p className="text-xs font-bold text-gray-400">
                  วางลิงก์รูปภาพจากเว็บไซต์ใดก็ได้ แล้วดูตัวอย่างก่อนลง
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid md:grid-cols-[1fr_320px] gap-5 p-5">
              <div className="space-y-4">
                <input
                  value={imageUrl}
                  onChange={(event) => {
                    setImageUrl(event.target.value);
                    setPreviewImageError(false);
                    setCreateErrorText('');
                  }}
                  placeholder="URL รูปภาพ"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-frog-400 transition-colors"
                />

                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="แคปชัน ไม่ใส่ก็ได้"
                  maxLength={280}
                  className="w-full min-h-[130px] px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-frog-400 transition-colors resize-none"
                />

                <p className="text-xs text-gray-400 leading-relaxed">
                  สตอรี่จะหายจากหน้าเว็บภายใน 24 ชั่วโมง หากรูปเสีย ลิงก์หมดอายุ หรือเว็บไซต์ต้นทางไม่อนุญาตให้แสดงผล จะเป็นความรับผิดชอบของผู้ลงสตอรี่
                </p>

                {createErrorText && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                    {createErrorText}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleCreateStory}
                  disabled={createLoading}
                  className="w-full h-12 rounded-2xl bg-frog-500 text-white text-xs font-black uppercase tracking-widest hover:bg-frog-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {createLoading && <Loader2 className="animate-spin" size={16} />}
                  {createLoading ? 'กำลังลงสตอรี่...' : 'ลงสตอรี่'}
                </button>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  ตัวอย่างสตอรี่
                </p>

                <div className="relative w-full aspect-[9/16] rounded-[1.5rem] bg-slate-950 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-32 z-10 bg-gradient-to-b from-black/80 to-transparent" />
                  <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-2">
                    <img
                      src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                      className="w-8 h-8 rounded-xl object-cover border border-white/20"
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-white text-xs font-black truncate flex items-center gap-1">
                        {currentUser.display_name || currentUser.username || 'คุณ'}
                        {currentUser.is_verified && (
                          <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        )}
                      </p>
                      <p className="text-white/60 text-[10px] font-bold">
                        เมื่อสักครู่
                      </p>
                    </div>
                  </div>

                  {canShowPreview && !previewImageError ? (
                    <img
                      src={trimmedImageUrl}
                      className="w-full h-full object-contain bg-black"
                      alt=""
                      onError={() => setPreviewImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center text-white/40 px-6">
                      <ImageOff size={32} className="mb-3" />
                      <p className="text-sm font-black">ยังไม่มีตัวอย่างรูป</p>
                      <p className="text-xs mt-1">
                        วาง URL รูปภาพที่ถูกต้องเพื่อดูตัวอย่างก่อนลงสตอรี่
                      </p>
                    </div>
                  )}

                  {previewImageError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white/50 px-6 bg-black">
                      <ImageOff size={32} className="mb-3" />
                      <p className="text-sm font-black">โหลดตัวอย่างไม่ได้</p>
                      <p className="text-xs mt-1">
                        ลิงก์อาจไม่ใช่รูปโดยตรง หรือเว็บต้นทางไม่อนุญาตให้แสดงผล
                      </p>
                    </div>
                  )}

                  {caption.trim() && (
                    <div className="absolute left-0 right-0 bottom-0 z-20 p-4 bg-gradient-to-t from-black/90 to-transparent">
                      <p className="text-white text-sm leading-relaxed break-words">
                        {caption.trim()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedGroup && selectedStory && (
        <div
          className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={closeStoryViewer}
        >
          <div
            className="relative bg-slate-950 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
            style={{
              width: 'min(420px, calc((100vh - 4rem) * 9 / 16), calc(100vw - 2rem))',
              aspectRatio: '9 / 16',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-40 z-10 bg-gradient-to-b from-black/90 via-black/45 to-transparent pointer-events-none" />
            <div className="absolute left-0 right-0 bottom-0 h-64 z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none" />

            <button
              type="button"
              onClick={closeStoryViewer}
              className="absolute top-6 right-3 z-30 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X size={18} />
            </button>

            {selectedGroup.stories.length > 1 && (
              <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-3 pt-3">
                {selectedGroup.stories.map((story, index) => (
                  <div
                    key={story.id}
                    className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-75 ease-linear"
                      style={{
                        width:
                          index < selectedStoryIndex
                            ? '100%'
                            : index === selectedStoryIndex
                              ? `${storyProgress}%`
                              : '0%',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="absolute top-10 left-3 right-14 z-30 flex items-center gap-2">
              <img
                src={selectedAuthor?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                className="w-9 h-9 rounded-xl object-cover border border-white/20"
                alt=""
                onError={(event) => {
                  event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                }}
              />

              <div className="min-w-0">
                <p className="text-white text-xs font-black truncate flex items-center gap-1 drop-shadow">
                  {getDisplayName(selectedAuthor)}
                  {selectedAuthor?.is_verified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  )}
                </p>

                <p className="text-white/75 text-[10px] font-bold drop-shadow">
                  {getStoryElapsedText(selectedStory.created_at)}
                  {selectedGroup.stories.length > 1 && (
                    <>
                      {' '}
                      · {selectedStoryIndex + 1}/{selectedGroup.stories.length}
                    </>
                  )}
                </p>
              </div>
            </div>

            {canGoPreviousStory && (
              <button
                type="button"
                onClick={goToPreviousStory}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <ChevronLeft size={22} />
              </button>
            )}

            {canGoNextStory && (
              <button
                type="button"
                onClick={goToNextStory}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <ChevronRight size={22} />
              </button>
            )}

            <img
              src={selectedStory.image_url}
              alt=""
              className="w-full h-full object-contain bg-black"
              onError={(event) => {
                event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
              }}
            />

            <div className="absolute left-0 right-0 bottom-0 z-30 p-4">
              {selectedStory.caption && (
                <p className="text-white text-sm leading-relaxed mb-3 break-words drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                  {selectedStory.caption}
                </p>
              )}

              {currentUser.id === selectedStory.author_id && (
                <div className="mb-3 rounded-2xl bg-black/35 backdrop-blur-sm border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-white/70 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Eye size={13} />
                      คนดูสตอรี่
                    </p>

                    <p className="text-white text-[10px] font-black">
                      {viewerCount} คน
                    </p>
                  </div>

                  {storyViewers.length === 0 ? (
                    <p className="text-white/40 text-xs font-bold">
                      ยังไม่มีคนดู
                    </p>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex -space-x-2 overflow-hidden">
                        {storyViewers.slice(0, 8).map((viewer) => (
                          <img
                            key={viewer.id}
                            src={viewer.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                            className="w-7 h-7 rounded-full object-cover border-2 border-slate-950"
                            alt=""
                            onError={(event) => {
                              event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                            }}
                          />
                        ))}

                        {viewerCount > 8 && (
                          <span className="w-7 h-7 rounded-full bg-white text-slate-900 text-[10px] font-black flex items-center justify-center border-2 border-slate-950">
                            +{viewerCount - 8}
                          </span>
                        )}
                      </div>

                      <p className="text-white/55 text-[10px] font-bold truncate">
                        {storyViewers
                          .slice(0, 2)
                          .map((viewer) => viewer.display_name || viewer.username)
                          .filter(Boolean)
                          .join(', ')}
                        {viewerCount > 2 ? ' และคนอื่น ๆ' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentUser.id === selectedStory.author_id && (
                <button
                  type="button"
                  onClick={() => handleDeleteStory(selectedStory.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-400/40 bg-black/25 backdrop-blur-sm text-red-200 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 size={13} />
                  ลบสตอรี่
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

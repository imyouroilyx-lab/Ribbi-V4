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

  const selectedStory = selectedGroup?.stories[selectedStoryIndex] ?? null;

  const selectedAuthor = selectedStory
    ? normalizeAuthor(selectedStory.author)
    : selectedGroup
      ? normalizeAuthor(selectedGroup.latestStory.author)
      : null;

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

    await markStoryAsViewed(firstStory);
    await fetchStoryViewers(firstStory.id, firstStory.author_id);
  }

  function closeStoryViewer() {
    setSelectedGroup(null);
    setSelectedStoryIndex(0);
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
      const nextStory = selectedGroup.stories[nextIndex];

      setSelectedStoryIndex(nextIndex);

      await markStoryAsViewed(nextStory);
      await fetchStoryViewers(nextStory.id, nextStory.author_id);
    }
  }

  async function goToNextStory() {
    if (!selectedGroup) return;

    if (selectedStoryIndex < selectedGroup.stories.length - 1) {
      const nextIndex = selectedStoryIndex + 1;
      const nextStory = selectedGroup.stories[nextIndex];

      setSelectedStoryIndex(nextIndex);

      await markStoryAsViewed(nextStory);
      await fetchStoryViewers(nextStory.id, nextStory.author_id);
    } else {
      closeStoryViewer();
    }
  }

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
      <div className="card-minimal bg-white/90 border border-gray-100 shadow-soft p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            Stories
          </h3>
          <p className="text-[10px] font-bold text-gray-300">
            หายภายใน 24 ชม.
          </p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          <div className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
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
                className={`w-14 h-14 rounded-2xl p-[2px] shadow-sm group-hover:scale-105 transition-transform ${
                  ownGroup
                    ? 'bg-gradient-to-br from-pink-400 via-purple-500 to-sky-400'
                    : 'bg-slate-200'
                }`}
              >
                <div className="w-full h-full rounded-2xl bg-white p-[2px]">
                  <img
                    src={
                      ownGroup?.latestStory.image_url ||
                      currentUser.profile_img_url ||
                      'https://iili.io/qbtgKBt.png'
                    }
                    className="w-full h-full rounded-[0.85rem] object-cover"
                    loading="lazy"
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                    }}
                  />
                </div>
              </div>

              <span
                onClick={(event) => {
                  event.stopPropagation();
                  setShowCreateModal(true);
                }}
                className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-frog-500 border-2 border-white text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"
              >
                <Plus size={14} strokeWidth={3} />
              </span>
            </button>

            <p className="text-[10px] font-bold truncate w-full text-center text-gray-700">
              ของคุณ
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 px-2">
              <Loader2 className="w-4 h-4 animate-spin text-frog-500" />
              <p className="text-[10px] font-black uppercase tracking-widest">
                กำลังโหลด...
              </p>
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
                  <div className="relative">
                    <div
                      className={`w-14 h-14 rounded-2xl p-[2px] shadow-sm group-hover:scale-105 transition-transform ${getStoryRingClass(group)}`}
                    >
                      <div className={`w-full h-full rounded-2xl p-[2px] ${getStoryInnerClass(group)}`}>
                        <img
                          src={author?.profile_img_url || story.image_url}
                          className={`w-full h-full rounded-[0.85rem] object-cover ${
                            groupHasUnviewed ? '' : 'grayscale-[20%]'
                          }`}
                          loading="lazy"
                          alt=""
                          onError={(event) => {
                            event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                          }}
                        />
                      </div>
                    </div>

                    {group.stories.length > 1 && (
                      <span
                        className={`absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full border-2 border-white text-[9px] font-black flex items-center justify-center ${
                          groupHasUnviewed
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {group.stories.length}
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-[10px] font-bold truncate w-full text-center flex items-center justify-center gap-0.5 ${
                      groupHasUnviewed ? 'text-gray-800' : 'text-gray-400'
                    }`}
                  >
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
      </div>

      {showCreateModal && (
        <div
          onClick={closeCreateModal}
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-gray-900">
                  เพิ่มสตอรี่
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  วางลิงก์รูปภาพจากเว็บไซต์ใดก็ได้ แล้วดูตัวอย่างก่อนลง
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-5 p-5">
              <div className="space-y-3">
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

                <input
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="แคปชัน ไม่ใส่ก็ได้"
                  maxLength={280}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-frog-400 transition-colors"
                />

                <p className="text-[10px] text-gray-400 leading-relaxed">
                  สตอรี่จะหายจากหน้าเว็บภายใน 24 ชั่วโมง หากรูปเสีย ลิงก์หมดอายุ
                  หรือเว็บไซต์ต้นทางไม่อนุญาตให้แสดงผล จะเป็นความรับผิดชอบของผู้ลงสตอรี่
                </p>

                {createErrorText && (
                  <p className="text-xs font-bold text-red-500">
                    {createErrorText}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleCreateStory}
                  disabled={createLoading}
                  className="w-full py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-frog-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading ? 'กำลังลงสตอรี่...' : 'ลงสตอรี่'}
                </button>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">
                  ตัวอย่างสตอรี่
                </p>

                <div className="relative w-full aspect-[9/16] bg-slate-950 rounded-[1.75rem] overflow-hidden shadow-xl border border-gray-100">
                  <div className="absolute top-0 left-0 right-0 h-32 z-10 bg-gradient-to-b from-black/75 via-black/35 to-transparent pointer-events-none" />
                  <div className="absolute left-0 right-0 bottom-0 h-56 z-10 bg-gradient-to-t from-black/95 via-black/65 to-transparent pointer-events-none" />

                  <div className="absolute top-10 left-3 right-3 z-20 flex items-center gap-2">
                    <img
                      src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                      className="w-9 h-9 rounded-xl object-cover border border-white/20"
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                      }}
                    />

                    <div className="min-w-0">
                      <p className="text-white text-xs font-black truncate flex items-center gap-1 drop-shadow">
                        {currentUser.display_name || currentUser.username || 'คุณ'}
                        {currentUser.is_verified && (
                          <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        )}
                      </p>
                      <p className="text-white/70 text-[10px] font-bold drop-shadow">
                        เมื่อสักครู่
                      </p>
                    </div>
                  </div>

                  {canShowPreview && !previewImageError ? (
                    <img
                      src={trimmedImageUrl}
                      alt=""
                      className="w-full h-full object-contain bg-black"
                      onError={() => setPreviewImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center px-8">
                      <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-3">
                        <ImageOff className="w-7 h-7 text-white/50" />
                      </div>
                      <p className="text-white/80 text-xs font-black">
                        ยังไม่มีตัวอย่างรูป
                      </p>
                      <p className="text-white/40 text-[10px] mt-1 leading-relaxed">
                        วาง URL รูปภาพที่ถูกต้องเพื่อดูตัวอย่างก่อนลงสตอรี่
                      </p>
                    </div>
                  )}

                  {previewImageError && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center px-8">
                      <div className="w-14 h-14 rounded-2xl bg-red-500/15 flex items-center justify-center mb-3">
                        <ImageOff className="w-7 h-7 text-red-300" />
                      </div>
                      <p className="text-white text-xs font-black">
                        โหลดตัวอย่างไม่ได้
                      </p>
                      <p className="text-white/50 text-[10px] mt-1 leading-relaxed">
                        ลิงก์อาจไม่ใช่รูปโดยตรง หรือเว็บต้นทางไม่อนุญาตให้แสดงผล
                      </p>
                    </div>
                  )}

                  {caption.trim() && (
                    <div className="absolute left-0 right-0 bottom-0 z-20 p-4">
                      <p className="text-white text-sm leading-relaxed break-words drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
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
          onClick={closeStoryViewer}
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative bg-slate-950 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
            style={{
              width: 'min(420px, calc((100vh - 4rem) * 9 / 16), calc(100vw - 2rem))',
              aspectRatio: '9 / 16',
            }}
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
                      className={`h-full rounded-full ${
                        index <= selectedStoryIndex ? 'bg-white' : 'bg-transparent'
                      }`}
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

            {selectedStoryIndex > 0 && (
              <button
                type="button"
                onClick={goToPreviousStory}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <ChevronLeft size={22} />
              </button>
            )}

            {selectedStoryIndex < selectedGroup.stories.length - 1 && (
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
                            className="w-8 h-8 rounded-full object-cover border-2 border-slate-950"
                            title={viewer.display_name || viewer.username || ''}
                            alt=""
                            onError={(event) => {
                              event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                            }}
                          />
                        ))}

                        {viewerCount > 8 && (
                          <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-slate-950 flex items-center justify-center text-white text-[10px] font-black">
                            +{viewerCount - 8}
                          </div>
                        )}
                      </div>

                      <p className="text-white/45 text-[10px] font-bold truncate">
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
                  <Trash2 size={14} />
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

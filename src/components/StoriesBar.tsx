'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoryExpiresText, validateStoryImageUrl } from '@/lib/story-utils';
import type { Story, StoryAuthor } from '@/types/story';
import { BadgeCheck, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, X } from 'lucide-react';

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
  const [selectedGroup, setSelectedGroup] = useState<StoryGroup | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createErrorText, setCreateErrorText] = useState('');

  const [loading, setLoading] = useState(true);

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

    setLoading(false);

    if (error) {
      console.error('Error loading stories:', error);
      return;
    }

    setStories((data ?? []) as Story[]);
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
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        return {
          authorId,
          latestStory: sortedStories[0],
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
  const selectedAuthor = selectedGroup ? normalizeAuthor(selectedGroup.latestStory.author) : null;

  function openStoryGroup(group: StoryGroup) {
    setSelectedGroup(group);
    setSelectedStoryIndex(0);
  }

  function closeStoryViewer() {
    setSelectedGroup(null);
    setSelectedStoryIndex(0);
  }

  function goToPreviousStory() {
    if (!selectedGroup) return;

    if (selectedStoryIndex > 0) {
      setSelectedStoryIndex((prev) => prev - 1);
    }
  }

  function goToNextStory() {
    if (!selectedGroup) return;

    if (selectedStoryIndex < selectedGroup.stories.length - 1) {
      setSelectedStoryIndex((prev) => prev + 1);
    } else {
      closeStoryViewer();
    }
  }

  async function handleCreateStory() {
    setCreateErrorText('');

    const trimmedImageUrl = imageUrl.trim();
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

              return (
                <button
                  key={group.authorId}
                  type="button"
                  onClick={() => openStoryGroup(group)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 w-16 group"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl p-[2px] bg-gradient-to-br from-pink-400 via-purple-500 to-sky-400 shadow-sm group-hover:scale-105 transition-transform">
                      <div className="w-full h-full rounded-2xl bg-white p-[2px]">
                        <img
                          src={author?.profile_img_url || story.image_url}
                          className="w-full h-full rounded-[0.85rem] object-cover"
                          loading="lazy"
                          alt=""
                          onError={(event) => {
                            event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                          }}
                        />
                      </div>
                    </div>

                    {group.stories.length > 1 && (
                      <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-slate-900 text-white border-2 border-white text-[9px] font-black flex items-center justify-center">
                        {group.stories.length}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] font-bold truncate w-full text-center text-gray-700 flex items-center justify-center gap-0.5">
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
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-gray-900">
                  เพิ่มสตอรี่
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  วางลิงก์รูปภาพจากเว็บไซต์ใดก็ได้
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
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
          </div>
        </div>
      )}

      {selectedGroup && selectedStory && (
        <div
          onClick={closeStoryViewer}
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-md max-h-[92vh] bg-slate-950 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
          >
            <button
              type="button"
              onClick={closeStoryViewer}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="absolute top-3 left-3 right-14 z-20 flex items-center gap-2">
              <img
                src={selectedAuthor?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                className="w-9 h-9 rounded-xl object-cover border border-white/20"
                alt=""
                onError={(event) => {
                  event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                }}
              />

              <div className="min-w-0">
                <p className="text-white text-xs font-black truncate flex items-center gap-1">
                  {getDisplayName(selectedAuthor)}
                  {selectedAuthor?.is_verified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  )}
                </p>
                <p className="text-white/60 text-[10px] font-bold">
                  {getStoryExpiresText(selectedStory.expires_at)}
                  {selectedGroup.stories.length > 1 && (
                    <>
                      {' '}
                      · {selectedStoryIndex + 1}/{selectedGroup.stories.length}
                    </>
                  )}
                </p>
              </div>
            </div>

            {selectedGroup.stories.length > 1 && (
              <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-3">
                {selectedGroup.stories.map((story) => (
                  <div
                    key={story.id}
                    className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden"
                  >
                    <div
                      className={`h-full rounded-full ${
                        selectedGroup.stories.findIndex((item) => item.id === story.id) <= selectedStoryIndex
                          ? 'bg-white'
                          : 'bg-transparent'
                      }`}
                    />
                  </div>
                ))}
              </div>
            )}

            {selectedStoryIndex > 0 && (
              <button
                type="button"
                onClick={goToPreviousStory}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <ChevronLeft size={22} />
              </button>
            )}

            {selectedGroup.stories.length > 1 && (
              <button
                type="button"
                onClick={goToNextStory}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <ChevronRight size={22} />
              </button>
            )}

            <img
              src={selectedStory.image_url}
              alt=""
              className="w-full max-h-[78vh] object-contain bg-black"
              onError={(event) => {
                event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
              }}
            />

            <div className="p-4 bg-slate-950">
              {selectedStory.caption && (
                <p className="text-white text-sm leading-relaxed mb-3">
                  {selectedStory.caption}
                </p>
              )}

              {currentUser.id === selectedStory.author_id && (
                <button
                  type="button"
                  onClick={() => handleDeleteStory(selectedStory.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-400/30 text-red-300 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors"
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

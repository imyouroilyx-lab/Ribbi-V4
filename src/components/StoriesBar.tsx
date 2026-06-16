'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoryExpiresText } from '@/lib/story-utils';
import type { Story, StoryAuthor } from '@/types/story';
import { BadgeCheck, Loader2, Trash2, X } from 'lucide-react';

type StoriesBarProps = {
  currentUserId?: string | null;
};

function normalizeAuthor(author: Story['author']): StoryAuthor | null {
  if (!author) return null;
  if (Array.isArray(author)) return author[0] ?? null;
  return author;
}

export default function StoriesBar({ currentUserId }: StoriesBarProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
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
      .limit(100);

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

    return Array.from(map.entries()).map(([authorId, authorStories]) => ({
      authorId,
      latestStory: authorStories[0],
      stories: authorStories,
    }));
  }, [stories]);

  async function handleDeleteStory(storyId: string) {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedStory(null);
    fetchStories();
  }

  if (loading) {
    return (
      <div className="card-minimal bg-white/70 border border-gray-100 p-4 flex items-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin text-frog-500" />
        <p className="text-[10px] font-black uppercase tracking-widest">
          กำลังโหลดสตอรี่...
        </p>
      </div>
    );
  }

  if (groupedStories.length === 0) {
    return null;
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
          {groupedStories.map((group) => {
            const story = group.latestStory;
            const author = normalizeAuthor(story.author);

            return (
              <button
                key={group.authorId}
                type="button"
                onClick={() => setSelectedStory(story)}
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
                </div>

                <p className="text-[10px] font-bold truncate w-full text-center text-gray-700 flex items-center justify-center gap-0.5">
                  {(author?.display_name || author?.username || 'Story').split(' ')[0]}
                  {author?.is_verified && (
                    <BadgeCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  )}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedStory && (
        <div
          onClick={() => setSelectedStory(null)}
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-md max-h-[92vh] bg-slate-950 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
          >
            <button
              type="button"
              onClick={() => setSelectedStory(null)}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="absolute top-3 left-3 right-14 z-10 flex items-center gap-2">
              {(() => {
                const author = normalizeAuthor(selectedStory.author);

                return (
                  <>
                    <img
                      src={author?.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                      className="w-9 h-9 rounded-xl object-cover border border-white/20"
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = 'https://iili.io/qbtgKBt.png';
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-white text-xs font-black truncate flex items-center gap-1">
                        {author?.display_name || author?.username || 'Story'}
                        {author?.is_verified && (
                          <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        )}
                      </p>
                      <p className="text-white/60 text-[10px] font-bold">
                        {getStoryExpiresText(selectedStory.expires_at)}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

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

              {currentUserId === selectedStory.author_id && (
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

'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getStoryExpiresText } from '@/lib/story-utils'
import type { Story, StoryAuthor } from '@/types/story'

type StoriesBarProps = {
  currentUserId?: string | null
}

function normalizeAuthor(author: Story['author']): StoryAuthor | null {
  if (!author) return null
  if (Array.isArray(author)) return author[0] ?? null
  return author
}

export default function StoriesBar({ currentUserId }: StoriesBarProps) {
  const supabase = createClient()

  const [stories, setStories] = useState<Story[]>([])
  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchStories() {
    setLoading(true)

    const { data, error } = await supabase
      .from('stories')
      .select(`
        id,
        author_id,
        image_url,
        caption,
        created_at,
        expires_at,
        author:users (
          id,
          username,
          display_name,
          profile_img_url,
          is_verified
        )
      `)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(100)

    setLoading(false)

    if (error) {
      console.error(error)
      return
    }

    setStories((data ?? []) as Story[])
  }

  useEffect(() => {
    fetchStories()
  }, [])

  const groupedStories = useMemo(() => {
    const map = new Map<string, Story[]>()

    for (const story of stories) {
      const existing = map.get(story.author_id) ?? []
      existing.push(story)
      map.set(story.author_id, existing)
    }

    return Array.from(map.entries()).map(([authorId, authorStories]) => {
      return {
        authorId,
        latestStory: authorStories[0],
        stories: authorStories,
      }
    })
  }, [stories])

  async function handleDeleteStory(storyId: string) {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId)

    if (error) {
      alert(error.message)
      return
    }

    setSelectedStory(null)
    fetchStories()
  }

  if (loading) {
    return (
      <div style={{ padding: '12px 0', color: '#777' }}>
        กำลังโหลดสตอรี่...
      </div>
    )
  }

  if (groupedStories.length === 0) {
    return null
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          padding: '8px 0 16px',
          marginBottom: '12px',
        }}
      >
        {groupedStories.map((group) => {
          const story = group.latestStory
          const author = normalizeAuthor(story.author)

          return (
            <button
              key={group.authorId}
              onClick={() => setSelectedStory(story)}
              style={{
                width: '74px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 6px',
                  borderRadius: '999px',
                  padding: '3px',
                  background:
                    'linear-gradient(135deg, #ff4fd8, #8b5cf6, #38bdf8)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '999px',
                    background: '#fff',
                    padding: '3px',
                  }}
                >
                  <img
                    src={author?.profile_img_url || story.image_url}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '999px',
                    }}
                    onError={(event) => {
                      event.currentTarget.src = '/default-avatar.png'
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#333',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {author?.display_name || author?.username || 'Story'}
              </div>
            </button>
          )
        })}
      </div>

      {selectedStory && (
        <div
          onClick={() => setSelectedStory(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.86)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              maxHeight: '90vh',
              borderRadius: '20px',
              overflow: 'hidden',
              background: '#111',
              color: '#fff',
              position: 'relative',
            }}
          >
            <img
              src={selectedStory.image_url}
              alt=""
              style={{
                width: '100%',
                maxHeight: '72vh',
                objectFit: 'contain',
                display: 'block',
                background: '#000',
              }}
            />

            <div style={{ padding: '14px 16px' }}>
              {selectedStory.caption && (
                <div style={{ marginBottom: '8px', lineHeight: 1.45 }}>
                  {selectedStory.caption}
                </div>
              )}

              <div style={{ fontSize: '0.82rem', color: '#aaa' }}>
                {getStoryExpiresText(selectedStory.expires_at)}
              </div>

              {currentUserId === selectedStory.author_id && (
                <button
                  onClick={() => handleDeleteStory(selectedStory.id)}
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  ลบสตอรี่
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedStory(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                width: '34px',
                height: '34px',
                borderRadius: '999px',
                border: 'none',
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '18px',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}

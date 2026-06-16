'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateStoryImageUrl } from '@/lib/story-utils'

type CreateStoryBoxProps = {
  userId: string
  onCreated?: () => void
}

export default function CreateStoryBox({
  userId,
  onCreated,
}: CreateStoryBoxProps) {
  const supabase = createClient()

  const [imageUrl, setImageUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')

  async function handleCreateStory() {
    setErrorText('')

    const trimmedImageUrl = imageUrl.trim()
    const trimmedCaption = caption.trim()

    if (!validateStoryImageUrl(trimmedImageUrl)) {
      setErrorText('กรุณาใส่ลิงก์รูปภาพที่ถูกต้อง')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('stories')
      .insert({
        author_id: userId,
        image_url: trimmedImageUrl,
        caption: trimmedCaption || null,
      })

    setLoading(false)

    if (error) {
      setErrorText(error.message)
      return
    }

    setImageUrl('')
    setCaption('')

    if (onCreated) {
      onCreated()
    }
  }

  return (
    <div
      style={{
        padding: '16px',
        border: '1px solid #e5e5e5',
        borderRadius: '16px',
        background: '#fff',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: '10px' }}>
        เพิ่มสตอรี่
      </div>

      <input
        value={imageUrl}
        onChange={(event) => setImageUrl(event.target.value)}
        placeholder="วาง URL รูปภาพ"
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #ddd',
          borderRadius: '10px',
          marginBottom: '8px',
        }}
      />

      <input
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        placeholder="แคปชัน ไม่ใส่ก็ได้"
        maxLength={280}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #ddd',
          borderRadius: '10px',
          marginBottom: '8px',
        }}
      />

      <div
        style={{
          fontSize: '0.82rem',
          color: '#777',
          marginBottom: '10px',
          lineHeight: 1.45,
        }}
      >
        รองรับลิงก์รูปภาพจากทุกเว็บไซต์ หากรูปเสียหรือลิงก์หมดอายุ
        จะเป็นความรับผิดชอบของผู้ลงสตอรี่
      </div>

      {errorText && (
        <div
          style={{
            color: '#d33',
            fontSize: '0.9rem',
            marginBottom: '10px',
          }}
        >
          {errorText}
        </div>
      )}

      <button
        onClick={handleCreateStory}
        disabled={loading}
        style={{
          padding: '10px 16px',
          borderRadius: '999px',
          border: 'none',
          background: '#111',
          color: '#fff',
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'กำลังลง...' : 'ลงสตอรี่'}
      </button>
    </div>
  )
}

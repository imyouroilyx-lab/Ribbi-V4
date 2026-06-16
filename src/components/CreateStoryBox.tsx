'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { validateStoryImageUrl } from '@/lib/story-utils';

type CreateStoryBoxProps = {
  userId: string;
  onCreated?: () => void;
};

export default function CreateStoryBox({
  userId,
  onCreated,
}: CreateStoryBoxProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  async function handleCreateStory() {
    setErrorText('');

    const trimmedImageUrl = imageUrl.trim();
    const trimmedCaption = caption.trim();

    if (!validateStoryImageUrl(trimmedImageUrl)) {
      setErrorText('กรุณาใส่ลิงก์รูปภาพที่ถูกต้อง');
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('stories')
      .insert({
        author_id: userId,
        image_url: trimmedImageUrl,
        caption: trimmedCaption || null,
      });

    setLoading(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    setImageUrl('');
    setCaption('');

    if (onCreated) {
      onCreated();
    }
  }

  return (
    <div className="card-minimal bg-white/90 border border-gray-100 shadow-soft p-4">
      <div className="mb-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
          เพิ่มสตอรี่
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          วางลิงก์รูปภาพจากเว็บไซต์ใดก็ได้ สตอรี่จะหายภายใน 24 ชั่วโมง
        </p>
      </div>

      <div className="space-y-2">
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
          หากรูปเสีย ลิงก์หมดอายุ หรือเว็บไซต์ต้นทางไม่อนุญาตให้แสดงผล
          จะเป็นความรับผิดชอบของผู้ลงสตอรี่
        </p>

        {errorText && (
          <p className="text-xs font-bold text-red-500">
            {errorText}
          </p>
        )}

        <button
          type="button"
          onClick={handleCreateStory}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-frog-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'กำลังลงสตอรี่...' : 'ลงสตอรี่'}
        </button>
      </div>
    </div>
  );
}

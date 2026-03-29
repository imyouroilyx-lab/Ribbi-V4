'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Image as ImageIcon, X } from 'lucide-react';

interface MessageInputProps {
  chatId: string;
  currentUserId: string;
  onMessageSent: () => void;
  onTyping?: (isTyping: boolean) => void;
  themeColor?: string;
}

export default function MessageInput({ chatId, currentUserId, onMessageSent, onTyping, themeColor = '#22c55e' }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [showImageInput, setShowImageInput] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [isSending, setIsSending] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTyping = () => {
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (onTyping) onTyping(false);
      }, 2000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && imageUrls.length === 0) return;
    if (isSending) return;

    setIsSending(true);
    if (onTyping) onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const payload = {
        chat_id: chatId,
        sender_id: currentUserId,
        content: content.trim() || null,
        images: imageUrls.length > 0 ? imageUrls : null,
      };

      console.log('📤 Sending message payload:', payload);

      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select();

      if (error) {
        // ✅ log error ละเอียด
        console.error('❌ Supabase error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }

      console.log('✅ Message sent:', data);

      setContent('');
      setImageUrls([]);
      setShowImageInput(false);
      setTempImageUrl('');
      onMessageSent();

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (error: any) {
      console.error('❌ Error sending message:', error?.message || error);
      alert(`ไม่สามารถส่งข้อความได้: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleAddImage = () => {
    if (tempImageUrl.trim()) {
      setImageUrls([...imageUrls, tempImageUrl.trim()]);
      setTempImageUrl('');
      setShowImageInput(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 border-t border-gray-200">
      {/* Image Previews */}
      {imageUrls.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {imageUrls.map((url, index) => (
            <div key={index} className="relative group">
              <img src={url} alt={`Preview ${index + 1}`} className="w-20 h-20 object-cover rounded-lg" />
              <button
                onClick={() => handleRemoveImage(index)}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Image URL Input */}
      {showImageInput && (
        <div className="mb-3 flex gap-2">
          <input
            type="url"
            value={tempImageUrl}
            onChange={(e) => setTempImageUrl(e.target.value)}
            placeholder="วาง URL รูปภาพ..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent text-sm"
            style={{ '--tw-ring-color': themeColor } as any}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddImage(); } }}
          />
          <button onClick={handleAddImage} className="px-4 py-2 text-white rounded-xl transition text-sm" style={{ backgroundColor: themeColor }}>
            เพิ่ม
          </button>
          <button onClick={() => { setShowImageInput(false); setTempImageUrl(''); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition text-sm">
            ยกเลิก
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
        <button type="button" onClick={() => setShowImageInput(!showImageInput)} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0 transition" title="แนบรูปภาพ">
          <ImageIcon className="w-5 h-5" style={{ color: showImageInput ? themeColor : '#4b5563' }} />
        </button>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => { setContent(e.target.value); handleTyping(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
          }}
          placeholder="พิมพ์ข้อความ..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent resize-none"
          style={{ minHeight: '40px', maxHeight: '128px', height: 'auto', '--tw-ring-color': themeColor } as any}
          rows={1}
          disabled={isSending}
        />

        <button
          type="submit"
          disabled={isSending || (!content.trim() && imageUrls.length === 0)}
          className="p-2 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 transition hover:opacity-90"
          style={{ backgroundColor: themeColor }}
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      <p className="text-xs text-gray-400 mt-2">กด Enter เพื่อส่ง • Shift + Enter เพื่อขึ้นบรรทัดใหม่</p>
    </div>
  );
}
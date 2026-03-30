'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Image as ImageIcon, X, Loader2 } from 'lucide-react';

interface MessageInputProps {
  chatId: string;
  currentUserId: string;
  onMessageSent: () => void;
  onTyping?: (isTyping: boolean) => void;
  themeColor?: string;
}

// ✅ ใช้ React.memo เพื่อป้องกันช่องพิมพ์ Re-render ตอนมีข้อความใหม่เด้งเข้ามาในหน้าแชท
const MessageInput = React.memo(({ 
  chatId, 
  currentUserId, 
  onMessageSent, 
  onTyping, 
  themeColor = '#22c55e' 
}: MessageInputProps) => {
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [showImageInput, setShowImageInput] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ปรับความสูงช่องพิมพ์อัตโนมัติ
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '40px';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = Math.min(scrollHeight, 128) + 'px';
    }
  }, [content]);

  // ✅ เคลียร์ Timeout เมื่อปิด Component
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // ระบบแจ้งเตือนการพิมพ์ (Throttle)
  const handleTyping = useCallback(() => {
    if (!onTyping) return;

    const now = Date.now();
    if (now - lastTypingTimeRef.current > 3000) {
      onTyping(true);
      lastTypingTimeRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
      lastTypingTimeRef.current = 0;
    }, 2500);
  }, [onTyping]);

  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!content.trim() && imageUrls.length === 0) || isSending) return;

    setIsSending(true);
    
    // หยุด typing ทันที
    if (onTyping) onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    lastTypingTimeRef.current = 0;

    try {
      const payload = {
        chat_id: chatId,
        sender_id: currentUserId,
        content: content.trim() || null,
        images: imageUrls.length > 0 ? imageUrls : null,
      };

      const { error } = await supabase
        .from('messages')
        .insert(payload);

      if (error) throw error;

      setContent('');
      setImageUrls([]);
      setShowImageInput(false);
      setTempImageUrl('');
      onMessageSent();

      // คืนค่า Focus และ Reset ความสูง
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = '40px';
        }
      }, 0);
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(`ส่งไม่สำเร็จ: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  }, [chatId, currentUserId, content, imageUrls, onMessageSent, onTyping, isSending]);

  const handleAddImage = useCallback(() => {
    if (tempImageUrl.trim()) {
      setImageUrls(prev => [...prev, tempImageUrl.trim()]);
      setTempImageUrl('');
      setShowImageInput(false);
    }
  }, [tempImageUrl]);

  const handleRemoveImage = useCallback((index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="p-4 border-t border-gray-100 bg-white">
      {/* Image Previews */}
      {imageUrls.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 animate-in slide-in-from-bottom-2">
          {imageUrls.map((url, index) => (
            <div key={index} className="relative group shadow-sm">
              <img src={url} alt="" className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-xl border border-gray-100" />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute -top-1.5 -right-1.5 p-1 bg-white border border-gray-100 text-red-500 rounded-full shadow-md hover:bg-red-50 transition"
              >
                <X className="w-3 h-3" strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Image URL Input Box */}
      {showImageInput && (
        <div className="mb-3 flex gap-2 animate-in fade-in zoom-in-95">
          <input
            type="url"
            value={tempImageUrl}
            onChange={(e) => setTempImageUrl(e.target.value)}
            placeholder="วาง URL รูปภาพที่นี่..."
            className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 text-sm outline-none transition-all"
            style={{ '--tw-ring-color': themeColor } as any}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddImage(); } }}
            autoFocus
          />
          <button onClick={handleAddImage} className="px-4 py-2 text-white rounded-xl font-bold transition text-sm shadow-sm active:scale-95" style={{ backgroundColor: themeColor }}>
            เพิ่มรูป
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
        <button 
          type="button" 
          onClick={() => setShowImageInput(!showImageInput)} 
          className={`p-2.5 rounded-xl transition-all ${showImageInput ? 'bg-gray-100' : 'hover:bg-gray-50 text-gray-400'}`}
          title="แนบรูปภาพ"
        >
          <ImageIcon className="w-5 h-5" style={{ color: showImageInput ? themeColor : '' }} />
        </button>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => { setContent(e.target.value); handleTyping(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
              e.preventDefault(); 
              handleSendMessage(); 
            }
          }}
          placeholder="พิมพ์ข้อความที่นี่..."
          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-opacity-20 focus:border-transparent transition-all outline-none resize-none font-medium text-gray-800"
          style={{ 
            minHeight: '40px', 
            maxHeight: '128px', 
            '--tw-ring-color': themeColor 
          } as any}
          rows={1}
          disabled={isSending}
        />

        <button
          type="submit"
          disabled={isSending || (!content.trim() && imageUrls.length === 0)}
          className="p-3 text-white rounded-2xl disabled:opacity-30 disabled:scale-100 transition-all hover:scale-105 active:scale-95 shadow-md flex-shrink-0"
          style={{ backgroundColor: themeColor }}
        >
          {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 fill-current" />}
        </button>
      </form>

      <div className="flex justify-between items-center mt-2 px-1">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Enter to send • Shift + Enter for new line</p>
        {content.length > 0 && (
          <p className="text-[10px] text-gray-300 font-medium">{content.length} characters</p>
        )}
      </div>
    </div>
  );
});

export default MessageInput;

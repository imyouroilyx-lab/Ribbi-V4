'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Edit2, Trash2, Check, X, Palette, Pencil, Globe, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  images: string[] | null;
  created_at: string;
  updated_at?: string | null;
  event?: string | null;
  sender: {
    id: string;
    username: string;
    display_name: string;
    profile_img_url: string | null;
  } | null;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  currentUserId: string;
  themeColor?: string;
  showSenderName?: boolean;
}

// --- คอมโพเนนต์ดึงข้อมูล Preview ---
function LinkPreview({ url, isOwn }: { url: string; isOwn: boolean }) {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchMeta = async () => {
      try {
        setLoading(true);
        // ใช้ Microlink API ตัวเดิมแต่เพิ่มการจัดการ Error
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        
        if (isMounted) {
          if (json.status === 'success' && json.data.title) {
            setMetadata(json.data);
          } else {
            setHasError(true);
          }
        }
      } catch (err) {
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMeta();
    return () => { isMounted = false; };
  }, [url]);

  if (hasError) return null;

  return (
    <div className={`mt-3 overflow-hidden rounded-xl border transition-all max-w-sm ${
      isOwn ? 'bg-black/20 border-white/10' : 'bg-white border-gray-200 shadow-sm'
    }`}>
      {loading ? (
        <div className="p-4 flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 bg-gray-300/30 rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-2 bg-gray-300/30 rounded w-3/4"></div>
            <div className="h-2 bg-gray-300/30 rounded w-1/2"></div>
          </div>
        </div>
      ) : metadata && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="group block">
          {metadata.image?.url && (
            <div className="relative h-32 w-full overflow-hidden bg-gray-100">
              <img 
                src={metadata.image.url} 
                alt="preview" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              />
            </div>
          )}
          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-1 opacity-60">
              {metadata.logo?.url ? (
                <img src={metadata.logo.url} className="w-3 h-3 rounded-sm" alt="logo" />
              ) : <Globe size={12} />}
              <span className="text-[10px] font-bold uppercase truncate">
                {metadata.publisher || new URL(url).hostname}
              </span>
            </div>
            <h4 className={`text-xs font-bold line-clamp-1 ${isOwn ? 'text-white' : 'text-gray-900'}`}>
              {metadata.title}
            </h4>
            {metadata.description && (
              <p className={`text-[11px] mt-1 line-clamp-2 leading-relaxed ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
                {metadata.description}
              </p>
            )}
          </div>
        </a>
      )}
    </div>
  );
}

export default function MessageBubble({ message, isOwn, currentUserId, themeColor = '#22c55e', showSenderName }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message?.content || '');

  // ดึงลิงก์จากข้อความ (รองรับหลายลิงก์)
  const links = useMemo(() => {
    if (!message.content) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return Array.from(new Set(message.content.match(urlRegex) || [])); // ใช้ Set กันลิงก์ซ้ำ
  }, [message.content]);

  if (!message) return null;

  // ✅ System events
  if (message.event === 'theme_change' || message.event === 'nickname_change') {
    return (
      <div className="flex items-center justify-center my-2 w-full">
        <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full text-[11px] font-bold text-gray-500 border border-gray-200 shadow-sm">
          {message.event === 'theme_change' ? <Palette size={12} style={{ color: themeColor }} /> : <Pencil size={12} />}
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  if (!message.sender) return null;

  const formatTime = (ts: string) => {
    try { return format(new Date(ts), 'HH:mm', { locale: th }); } catch { return ''; }
  };

  const handleDelete = async () => {
    if (!confirm('ต้องการลบข้อความนี้?')) return;
    await supabase.from('messages').delete().eq('id', message.id);
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    setIsEditing(false);
    const now = new Date().toISOString();
    const { error } = await supabase.from('messages').update({ content: editContent.trim(), updated_at: now }).eq('id', message.id);
    if (!error) {
      message.content = editContent.trim();
      message.updated_at = now;
    }
  };

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-3 group/bubble`}>
      {!isOwn && showSenderName && (
        <span className="text-[10px] font-black text-gray-400 mb-1 ml-11 uppercase tracking-tighter">
          {message.sender.display_name}
        </span>
      )}

      <div className={`flex gap-2 max-w-[85%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwn && (
          <a href={`/profile/${message.sender.username}`} className="flex-shrink-0 self-end mb-1">
            <img src={message.sender.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-100" />
          </a>
        )}

        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
          {isEditing ? (
            <div className="bg-white rounded-2xl p-3 shadow-xl border-2 min-w-[260px]" style={{ borderColor: themeColor }}>
              <textarea 
                value={editContent} 
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-0 border-0 focus:ring-0 text-sm bg-transparent resize-none"
                rows={3} autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs font-bold text-gray-400">ยกเลิก</button>
                <button onClick={handleEdit} className="px-3 py-1 text-xs font-bold text-white rounded-lg" style={{ backgroundColor: themeColor }}>บันทึก</button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div
                className={`px-4 py-2.5 shadow-sm transition-all ${isOwn ? 'text-white' : 'text-gray-900'}`}
                style={{
                  backgroundColor: isOwn ? themeColor : '#f1f5f9',
                  borderRadius: isOwn ? '1.25rem 1.25rem 0.25rem 1.25rem' : '1.25rem 1.25rem 1.25rem 0.25rem',
                }}
              >
                {/* Images */}
                {message.images && message.images.length > 0 && (
                  <div className="grid gap-2 mb-2">
                    {message.images.map((img, i) => (
                      <img key={i} src={img} className="rounded-xl max-w-full h-auto max-h-[300px] object-contain cursor-pointer" onClick={() => window.open(img, '_blank')} />
                    ))}
                  </div>
                )}
                
                {/* Text Content */}
                {message.content && (
                  <p className="text-sm md:text-base whitespace-pre-wrap break-words leading-relaxed">
                    {message.content}
                  </p>
                )}

                {/* Link Embeds */}
                {links.map((link, i) => (
                  <LinkPreview key={i} url={link} isOwn={isOwn} />
                ))}
              </div>

              {/* Time & Edit Status */}
              <div className={`flex items-center gap-2 mt-1 px-1 ${isOwn ? 'justify-end' : ''}`}>
                <span className="text-[9px] font-bold text-gray-400">{formatTime(message.created_at)}</span>
                {message.updated_at && <span className="text-[9px] text-gray-300 italic font-medium">แก้ไขแล้ว</span>}
              </div>

              {/* Hover Actions (Desktop Only) */}
              {isOwn && (
                <div className="absolute top-0 -left-12 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex flex-col gap-1">
                  <button onClick={() => setIsEditing(true)} className="p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-gray-400 hover:text-indigo-600">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={handleDelete} className="p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-gray-400 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

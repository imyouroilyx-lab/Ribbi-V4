'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Edit2, Trash2, Palette, Pencil, Globe, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// --- TYPES ---
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

// --- UTILITIES ---

// ฟังก์ชันสำหรับดึง Youtube Video ID จาก URL
function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// ฟังก์ชันสำหรับแปลงข้อความที่มี URL ให้เป็น Link ที่กดได้
const renderContentWithLinks = (text: string | null, isOwn: boolean) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`hover:underline break-all ${isOwn ? 'text-blue-100' : 'text-blue-600'}`}
          onClick={(e) => e.stopPropagation()} // ป้องกันการ bubble event ถ้าจำเป็น
        >
          {part}
        </a>
      );
    }
    return part;
  });
};


// --- SUB-COMPONENTS ---

// คอมโพเนนต์สำหรับแสดง YouTube Embed
function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="mt-3 w-full max-w-sm overflow-hidden rounded-xl border bg-black shadow-sm aspect-video relative group">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute top-0 left-0 w-full h-full"
      ></iframe>
    </div>
  );
}

// คอมโพเนนต์ดึงข้อมูล Preview (สำหรับลิงก์ทั่วไปที่ไม่ใช่ YouTube)
function LinkPreview({ url, isOwn }: { url: string; isOwn: boolean }) {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchMeta = async () => {
      try {
        setLoading(true);
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
        // Loading Shimmer
        <div className="p-3 flex items-center gap-3 animate-pulse">
          <div className={`w-12 h-12 rounded-lg ${isOwn ? 'bg-white/20' : 'bg-gray-200'}`}></div>
          <div className="flex-1 space-y-2">
            <div className={`h-2 rounded w-3/4 ${isOwn ? 'bg-white/20' : 'bg-gray-200'}`}></div>
            <div className={`h-2 rounded w-1/2 ${isOwn ? 'bg-white/20' : 'bg-gray-200'}`}></div>
          </div>
        </div>
      ) : metadata && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="group block">
          {metadata.image?.url && (
            <div className="relative h-36 w-full overflow-hidden bg-gray-100">
              <img 
                src={metadata.image.url} 
                alt="preview" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              />
              {/* ถ้ามีวิดีโอ (ที่ไม่ใช่ YT) ให้โชว์ไอคอน play */}
              {metadata.video && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                   <div className="p-2 bg-white/20 backdrop-blur-md rounded-full">
                    <Play size={20} className="text-white fill-white" />
                   </div>
                 </div>
              )}
            </div>
          )}
          <div className="p-3">
            <div className={`flex items-center gap-1.5 mb-1 ${isOwn ? 'opacity-80' : 'opacity-60'}`}>
              {metadata.logo?.url ? (
                <img src={metadata.logo.url} className="w-3 h-3 rounded-sm" alt="logo" />
              ) : <Globe size={12} />}
              <span className="text-[10px] font-bold uppercase truncate">
                {metadata.publisher || new URL(url).hostname}
              </span>
            </div>
            <h4 className={`text-sm font-bold line-clamp-2 leading-tight ${isOwn ? 'text-white' : 'text-gray-900'}`}>
              {metadata.title}
            </h4>
            {metadata.description && (
              <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
                {metadata.description}
              </p>
            )}
          </div>
        </a>
      )}
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function MessageBubble({ message, isOwn, currentUserId, themeColor = '#22c55e', showSenderName }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message?.content || '');

  // ดึงลิงก์จากข้อความ (รองรับหลายลิงก์ และไม่เอาลิงก์ซ้ำ)
  const links = useMemo(() => {
    if (!message.content) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const foundLinks = message.content.match(urlRegex) || [];
    return Array.from(new Set(foundLinks));
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
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-3 group/bubble relative`}>
      {/* ชื่อผู้ส่ง (กลุ่ม) */}
      {!isOwn && showSenderName && (
        <span className="text-[10px] font-black text-gray-400 mb-1 ml-11 uppercase tracking-tighter">
          {message.sender.display_name}
        </span>
      )}

      <div className={`flex gap-2 max-w-[90%] md:max-w-[85%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar (คนอื่น) */}
        {!isOwn && (
          <a href={`/profile/${message.sender.username}`} className="flex-shrink-0 self-end mb-1">
            <img src={message.sender.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-100" alt={message.sender.display_name} />
          </a>
        )}

        {/* Message Content Area */}
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
          
          {/* Action Buttons (Desktop Hover) */}
          {isOwn && !isEditing && (
            <div className={`absolute top-0 ${isOwn ? '-left-12' : '-right-12'} opacity-0 group-hover/bubble:opacity-100 transition-opacity flex flex-col gap-1`}>
              <button onClick={() => setIsEditing(true)} className="p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-gray-400 hover:text-indigo-600 transition-colors" title="แก้ไข">
                <Edit2 size={12} />
              </button>
              <button onClick={handleDelete} className="p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors" title="ลบ">
                <Trash2 size={12} />
              </button>
            </div>
          )}

          {isEditing ? (
            // Edit Mode
            <div className="bg-white rounded-2xl p-3 shadow-xl border-2 min-w-[260px]" style={{ borderColor: themeColor }}>
              <textarea 
                value={editContent} 
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-0 border-0 focus:ring-0 text-sm bg-transparent resize-none font-medium"
                rows={3} autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs font-bold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">ยกเลิก</button>
                <button onClick={handleEdit} className="px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-opacity hover:opacity-90" style={{ backgroundColor: themeColor }}>บันทึก</button>
              </div>
            </div>
          ) : (
            // Display Mode
            <div className="relative">
              <div
                className={`px-4 py-2.5 shadow-sm transition-all ${isOwn ? 'text-white font-medium' : 'text-gray-900 font-medium'}`}
                style={{
                  backgroundColor: isOwn ? themeColor : '#f1f5f9',
                  borderRadius: isOwn ? '1.25rem 1.25rem 0.25rem 1.25rem' : '1.25rem 1.25rem 1.25rem 0.25rem',
                }}
              >
                {/* Images Attachment */}
                {message.images && message.images.length > 0 && (
                  <div className="grid gap-2 mb-2">
                    {message.images.map((img, i) => (
                      <img key={i} src={img} alt="attachment" className="rounded-xl max-w-full h-auto max-h-[300px] object-contain cursor-pointer hover:opacity-95 transition-opacity" onClick={() => window.open(img, '_blank')} />
                    ))}
                  </div>
                )}
                
                {/* Text Content (with clickable links) */}
                {message.content && (
                  <p className="text-sm md:text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                    {renderContentWithLinks(message.content, isOwn)}
                  </p>
                )}

                {/* Link Embeds */}
                {links.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    {links.map((link, i) => {
                      const youtubeId = getYouTubeVideoId(link);
                      if (youtubeId) {
                        // ถ้าเป็น YouTube ให้แสดง iframe
                        return <YouTubeEmbed key={i} videoId={youtubeId} />;
                      }
                      // ถ้าไม่ใช่ ให้แสดง LinkPreview ธรรมดา
                      return <LinkPreview key={i} url={link} isOwn={isOwn} />;
                    })}
                  </div>
                )}
              </div>

              {/* Time & Edit Status */}
              <div className={`flex items-center gap-2 mt-1 px-1 ${isOwn ? 'justify-end' : ''}`}>
                <span className="text-[9px] font-bold text-gray-400">{formatTime(message.created_at)}</span>
                {message.updated_at && <span className="text-[9px] text-gray-300 italic font-medium">แก้ไขแล้ว</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

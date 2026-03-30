'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Edit2, Trash2, Palette, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const metadataCache: Record<string, any> = {};

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
function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const renderContentWithLinks = (text: string | null, isOwn: boolean) => {
  if (!text) return null;
  const parts = text.split(URL_REGEX);

  return parts.map((part, index) => {
    if (part.match(URL_REGEX)) {
      return (
        <a
          key={`link-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-all font-bold ${isOwn ? 'text-white hover:text-indigo-100' : 'text-indigo-600 hover:text-indigo-800'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    // ✅ แก้ปัญหา Missing Key Warning ใน React
    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });
};

// --- SUB-COMPONENTS ---
function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="mt-3 w-full max-w-md overflow-hidden rounded-2xl border-2 border-black/10 bg-black shadow-lg aspect-video relative">
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

function LinkPreview({ url, isOwn }: { url: string; isOwn: boolean }) {
  const [metadata, setMetadata] = useState<any>(metadataCache[url] || null);
  const [loading, setLoading] = useState(!metadataCache[url]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (metadataCache[url]) return;

    let isMounted = true;
    const fetchMeta = async () => {
      try {
        setLoading(true);
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        if (isMounted) {
          if (json.status === 'success' && json.data.title) {
            metadataCache[url] = json.data;
            setMetadata(json.data);
          } else { setHasError(true); }
        }
      } catch (err) { if (isMounted) setHasError(true); } 
      finally { if (isMounted) setLoading(false); }
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
        <div className="p-3 flex items-center gap-3 animate-pulse">
          <div className={`w-12 h-12 rounded-lg ${isOwn ? 'bg-white/20' : 'bg-gray-200'}`}></div>
          <div className="flex-1 space-y-2">
            <div className={`h-2 rounded w-3/4 ${isOwn ? 'bg-white/20' : 'bg-gray-200'}`}></div>
          </div>
        </div>
      ) : metadata && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="group block">
          {metadata.image?.url && (
            <img src={metadata.image.url} alt="preview" className="w-full h-36 object-cover border-b border-inherit" />
          )}
          <div className="p-3">
            <h4 className={`text-sm font-bold line-clamp-2 ${isOwn ? 'text-white' : 'text-gray-900'}`}>{metadata.title}</h4>
            <p className={`text-[11px] mt-1 line-clamp-2 ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>{metadata.description}</p>
          </div>
        </a>
      )}
    </div>
  );
}

// --- MAIN COMPONENT ---
const MessageBubble = React.memo(({ message, isOwn, currentUserId, themeColor = '#22c55e', showSenderName }: MessageBubbleProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message?.content || '');

  const links = useMemo(() => {
    if (!message.content) return [];
    return Array.from(new Set(message.content.match(URL_REGEX) || []));
  }, [message.content]);

  if (!message) return null;

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
    const { error } = await supabase.from('messages').delete().eq('id', message.id);
    if (error) alert('ไม่สามารถลบข้อความได้');
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    setIsEditing(false);
    const now = new Date().toISOString();
    const { error } = await supabase.from('messages').update({ content: editContent.trim(), updated_at: now }).eq('id', message.id);
    if (error) {
      alert('ไม่สามารถแก้ไขได้');
      setEditContent(message.content || '');
    }
  };

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-3 w-full animate-in fade-in duration-300`}>
      {!isOwn && showSenderName && (
        <span className="text-[10px] font-black text-gray-400 mb-1 ml-11 uppercase tracking-tighter">
          {message.sender.display_name}
        </span>
      )}

      <div className={`flex gap-2 w-full ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwn && (
          <a href={`/profile/${message.sender.username}`} className="flex-shrink-0 self-end mb-1">
            <img src={message.sender.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-100" alt="" />
          </a>
        )}

        {isOwn && !isEditing && (
          <div className="flex gap-1 items-start pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition shadow-sm group">
              <Edit2 size={12} className="text-gray-500 group-hover:text-indigo-600" />
            </button>
            <button onClick={handleDelete} className="p-1.5 bg-red-50 hover:bg-red-100 rounded-full transition shadow-sm group">
              <Trash2 size={12} className="text-red-400 group-hover:text-red-600" />
            </button>
          </div>
        )}

        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%] group`}>
          {isEditing ? (
            <div className="bg-white rounded-2xl p-3 shadow-xl border-2 min-w-[260px]" style={{ borderColor: themeColor }}>
              <textarea 
                value={editContent} 
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-0 border-0 focus:ring-0 text-sm bg-transparent resize-none font-medium outline-none"
                rows={3} autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => { setIsEditing(false); setEditContent(message.content || ''); }} className="px-3 py-1.5 text-xs font-bold text-gray-400">ยกเลิก</button>
                <button onClick={handleEdit} className="px-3 py-1.5 text-xs font-bold text-white rounded-lg" style={{ backgroundColor: themeColor }}>บันทึก</button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`px-4 py-2.5 shadow-sm transition-all ${isOwn ? 'text-white' : 'text-gray-900'}`}
                style={{
                  backgroundColor: isOwn ? themeColor : '#f1f5f9',
                  borderRadius: isOwn ? '1.25rem 1.25rem 0.25rem 1.25rem' : '1.25rem 1.25rem 1.25rem 0.25rem',
                }}
              >
                {message.images && message.images.length > 0 && (
                  <div className="grid gap-2 mb-2">
                    {message.images.map((img, i) => (
                      <img key={i} src={img} className="rounded-xl max-w-full h-auto max-h-[300px] object-contain cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(img, '_blank')} alt="" />
                    ))}
                  </div>
                )}
                
                {message.content && (
                  <p className="text-sm md:text-base whitespace-pre-wrap break-words leading-relaxed font-medium">
                    {renderContentWithLinks(message.content, isOwn)}
                  </p>
                )}

                {links.map((link, i) => {
                  const ytId = getYouTubeVideoId(link);
                  return ytId ? <YouTubeEmbed key={`yt-${i}`} videoId={ytId} /> : <LinkPreview key={`preview-${i}`} url={link} isOwn={isOwn} />;
                })}
              </div>

              <div className={`flex items-center gap-2 mt-1 px-1 ${isOwn ? 'justify-end' : ''}`}>
                <span className="text-[9px] font-bold text-gray-400">{formatTime(message.created_at)}</span>
                {message.updated_at && <span className="text-[9px] text-gray-300 italic font-medium">แก้ไขแล้ว</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default MessageBubble;

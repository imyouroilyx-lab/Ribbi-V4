'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Edit2, Trash2, Check, X, Palette, Pencil, ExternalLink, Globe } from 'lucide-react';
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

// --- Component สำหรับดึงข้อมูลและแสดงผล Link Preview ---
function LinkPreview({ url, isOwn }: { url: string; isOwn: boolean }) {
  const [metadata, setMetadata] = useState<{
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        // ใช้ microlink API (ฟรี) ในการดึง metadata เพื่อเลี่ยงปัญหา CORS
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const json = await response.json();
        
        if (json.status === 'success') {
          setMetadata({
            title: json.data.title,
            description: json.data.description,
            image: json.data.image?.url,
            siteName: json.data.publisher
          });
        }
      } catch (err) {
        console.error('Link preview error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  if (loading) return null; // หรือจะใส่ Shimmer เล็กๆ ก็ได้
  if (!metadata?.title) return null;

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`block mt-2 overflow-hidden rounded-xl border transition-all hover:opacity-95 ${
        isOwn 
          ? 'bg-white/10 border-white/20 text-white' 
          : 'bg-white border-gray-200 text-gray-800 shadow-sm'
      }`}
    >
      {metadata.image && (
        <img src={metadata.image} alt="Preview" className="w-full h-32 object-cover border-b border-inherit" />
      )}
      <div className="p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1 mb-1">
          <Globe size={10} /> {metadata.siteName || new URL(url).hostname}
        </p>
        <h4 className="text-xs font-bold line-clamp-1">{metadata.title}</h4>
        {metadata.description && (
          <p className="text-[11px] mt-1 line-clamp-2 opacity-80 leading-relaxed">
            {metadata.description}
          </p>
        )}
      </div>
    </a>
  );
}

export default function MessageBubble({ message, isOwn, currentUserId, themeColor = '#22c55e', showSenderName }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message?.content || '');

  // ตรวจหาลิงก์ในข้อความ
  const detectedLinks = useMemo(() => {
    if (!message.content) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return message.content.match(urlRegex) || [];
  }, [message.content]);

  if (!message) return null;

  // ✅ System event messages
  if (message.event === 'theme_change' || message.event === 'nickname_change') {
    return (
      <div className="flex items-center justify-center my-2">
        <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full text-xs text-gray-500">
          {message.event === 'theme_change'
            ? <Palette className="w-3 h-3 flex-shrink-0" style={{ color: themeColor }} />
            : <Pencil className="w-3 h-3 flex-shrink-0 text-gray-400" />
          }
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  if (!message.sender) return null;

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm', { locale: th });
    } catch { return ''; }
  };

  const handleDelete = async () => {
    if (!confirm('ต้องการลบข้อความนี้? (ทั้งสองฝ่ายจะไม่เห็น)')) return;
    const { error } = await supabase.from('messages').delete().eq('id', message.id);
    if (error) alert('ไม่สามารถลบข้อความได้');
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    setIsEditing(false);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('messages')
      .update({ content: editContent.trim(), updated_at: now })
      .eq('id', message.id);

    if (error) {
      alert('ไม่สามารถแก้ไขข้อความได้');
      setEditContent(message.content || '');
      return;
    }
    message.content = editContent.trim();
    message.updated_at = now;
  };

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-2`}>
      {/* ชื่อผู้ส่ง */}
      {!isOwn && showSenderName && message.sender && (
        <span className="text-[10px] text-gray-500 mb-1 ml-11">
          {message.sender.display_name}
        </span>
      )}

      <div className={`flex gap-2 w-full ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

        {/* Avatar */}
        {!isOwn && (
          <a
            href={`/profile/${message.sender!.username}`}
            className="flex-shrink-0 hover:opacity-80 transition self-end block"
            title={`ดูโปรไฟล์ ${message.sender.display_name}`}
          >
            <img
              src={message.sender.profile_img_url || 'https://iili.io/qbtgKBt.png'}
              alt={message.sender.display_name}
              className="w-8 h-8 rounded-full object-cover"
            />
          </a>
        )}

        {/* Action Buttons */}
        {isOwn && !isEditing && (
          <div className="flex gap-1 items-start pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition">
              <Edit2 className="w-3 h-3 text-gray-600" />
            </button>
            <button onClick={handleDelete} className="p-1.5 bg-red-50 hover:bg-red-100 rounded-full transition">
              <Trash2 className="w-3 h-3 text-red-500" />
            </button>
          </div>
        )}

        {/* Message Container */}
        <div className={`flex flex-col group ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
          
          {isEditing ? (
            <div className="w-full min-w-[250px] bg-white rounded-xl p-3 shadow-lg border-2" style={{ borderColor: themeColor }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-0 py-0 border-0 focus:ring-0 resize-none text-sm"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 mt-2 justify-end">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs bg-gray-100 rounded-lg">ยกเลิก</button>
                <button onClick={handleEdit} className="px-3 py-1 text-xs text-white rounded-lg" style={{ backgroundColor: themeColor }}>บันทึก</button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="rounded-2xl px-4 py-2.5 break-words relative shadow-sm"
                style={{
                  backgroundColor: isOwn ? themeColor : '#f3f4f6',
                  color: isOwn ? '#ffffff' : '#111827',
                  borderRadius: isOwn ? '1.25rem 1.25rem 0.25rem 1.25rem' : '1.25rem 1.25rem 1.25rem 0.25rem',
                }}
              >
                {/* รูปภาพ */}
                {message.images && message.images.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mb-2">
                    {message.images.map((img, index) => (
                      <img
                        key={index}
                        src={img}
                        alt="Shared"
                        className="rounded-xl max-w-full h-auto cursor-pointer"
                        style={{ maxHeight: '250px' }}
                        onClick={() => window.open(img, '_blank')}
                      />
                    ))}
                  </div>
                )}

                {/* เนื้อหาข้อความ */}
                {message.content && (
                  <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                )}

                {/* แสดง Link Preview (ถ้าเจอลิงก์) */}
                {!isEditing && detectedLinks.map((url, idx) => (
                  <LinkPreview key={idx} url={url} isOwn={isOwn} />
                ))}
              </div>

              {/* เวลา และ สถานะแก้ไข */}
              <div className={`flex items-center gap-2 mt-1 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="text-[10px] text-gray-400 font-medium">{formatTime(message.created_at)}</span>
                {message.updated_at && <span className="text-[10px] text-gray-300 italic">แก้ไขแล้ว</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

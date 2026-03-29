'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Edit2, Trash2, Check, X, Palette, Pencil } from 'lucide-react';
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

export default function MessageBubble({ message, isOwn, currentUserId, themeColor = '#22c55e', showSenderName }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message?.content || '');

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
      {/* ชื่อผู้ส่งในแชทกลุ่ม */}
      {!isOwn && showSenderName && message.sender && (
        <span className="text-[10px] text-gray-500 mb-1 ml-11">
          {message.sender.display_name}
        </span>
      )}

      <div className={`flex gap-2 w-full ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

        {/* Avatar (คนอื่น) — คลิกไปโปรไฟล์ */}
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

        {/* ปุ่ม Action (ข้อความตัวเอง) */}
        {isOwn && !isEditing && (
          <div className="flex gap-1 items-start pt-1">
            <button onClick={() => setIsEditing(true)} className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-full transition" title="แก้ไขข้อความ">
              <Edit2 className="w-3.5 h-3.5 text-gray-700" />
            </button>
            <button onClick={handleDelete} className="p-1.5 bg-red-100 hover:bg-red-200 rounded-full transition" title="ลบข้อความ">
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </button>
          </div>
        )}

        {/* Message Content */}
        <div className={`flex flex-col relative group ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>

          {/* Edit Mode */}
          {isEditing ? (
            <div className="w-full min-w-[250px] bg-white rounded-xl p-3 shadow-lg" style={{ border: `2px solid ${themeColor}` }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-0 py-0 border-0 focus:ring-0 resize-none text-sm"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                  if (e.key === 'Escape') { setIsEditing(false); setEditContent(message.content || ''); }
                }}
              />
              <div className="flex gap-2 mt-2 justify-end">
                <button
                  onClick={() => { setIsEditing(false); setEditContent(message.content || ''); }}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-1"
                >
                  <X className="w-4 h-4" />ยกเลิก
                </button>
                <button
                  onClick={handleEdit}
                  className="px-3 py-1.5 text-sm text-white rounded-lg transition flex items-center gap-1"
                  style={{ backgroundColor: themeColor }}
                >
                  <Check className="w-4 h-4" />บันทึก
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="rounded-2xl px-4 py-2 break-words relative"
                style={{
                  minWidth: '60px',
                  backgroundColor: isOwn ? themeColor : '#f3f4f6',
                  color: isOwn ? '#ffffff' : '#111827',
                  borderRadius: isOwn ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                }}
              >
                {message.images && message.images.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {message.images.map((img, index) => (
                      <img
                        key={index}
                        src={img}
                        alt="Image"
                        className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition"
                        style={{ maxHeight: '300px' }}
                        onClick={() => window.open(img, '_blank')}
                      />
                    ))}
                  </div>
                )}
                {message.content && (
                  <p className="text-sm md:text-base whitespace-pre-wrap">{message.content}</p>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 px-1">
                <span className="text-xs text-gray-500">{formatTime(message.created_at)}</span>
                {message.updated_at && <span className="text-xs text-gray-400 italic">(แก้ไข)</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

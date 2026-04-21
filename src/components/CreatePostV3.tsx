'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { supabase, User } from '@/lib/supabase';
import { Image, Smile, MapPin, X, Activity, AtSign, Send, Loader2, Sparkles, Heart, Briefcase, GraduationCap, Baby, Home, Star, Plane, Users, ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

// ============================================================
// ✅ Life Event Types
// ============================================================
export interface LifeEvent {
  key: string;
  label: string;
  placeholder: string;
  color: string;       // Tailwind text color class
  bg: string;          // Tailwind bg class (light)
  border: string;      // Tailwind border class
  badgeBg: string;     // Tailwind bg for badge in PostCard
  icon: React.ReactNode;
  emoji: string;
}

export const LIFE_EVENTS: LifeEvent[] = [
  {
    key: 'relationship',
    label: 'กำลังคบหากับ',
    placeholder: 'ชื่อของพวกเขา...',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    badgeBg: 'bg-pink-100 text-pink-700 border-pink-200',
    icon: <Heart size={18} className="text-pink-500" />,
    emoji: '💕',
  },
  {
    key: 'new_job',
    label: 'เริ่มงานใหม่ที่',
    placeholder: 'ชื่อที่ทำงาน / ตำแหน่ง...',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <Briefcase size={18} className="text-blue-500" />,
    emoji: '💼',
  },
  {
    key: 'graduation',
    label: 'จบการศึกษาจาก',
    placeholder: 'ชื่อสถาบัน / คณะ...',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badgeBg: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: <GraduationCap size={18} className="text-yellow-600" />,
    emoji: '🎓',
  },
  {
    key: 'new_baby',
    label: 'ต้อนรับสมาชิกใหม่',
    placeholder: 'ชื่อเด็กน้อย...',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    badgeBg: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: <Baby size={18} className="text-purple-500" />,
    emoji: '👶',
  },
  {
    key: 'moved',
    label: 'ย้ายไปอยู่ที่',
    placeholder: 'ที่อยู่ใหม่...',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badgeBg: 'bg-green-100 text-green-700 border-green-200',
    icon: <Home size={18} className="text-green-500" />,
    emoji: '🏠',
  },
  {
    key: 'anniversary',
    label: 'ครบรอบ',
    placeholder: 'ครบรอบอะไร...',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    badgeBg: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: <Star size={18} className="text-rose-500" />,
    emoji: '🎉',
  },
  {
    key: 'travel',
    label: 'เดินทางไปที่',
    placeholder: 'ชื่อสถานที่...',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    badgeBg: 'bg-sky-100 text-sky-700 border-sky-200',
    icon: <Plane size={18} className="text-sky-500" />,
    emoji: '✈️',
  },
  {
    key: 'friendship',
    label: 'เป็นเพื่อนกับ',
    placeholder: 'ชื่อเพื่อน...',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badgeBg: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: <Users size={18} className="text-orange-500" />,
    emoji: '🤝',
  },
];

// helper: encode life event to string for storing in DB
// format: "key|value"  e.g. "relationship|ออม"
export function encodeLifeEvent(key: string, value: string) {
  return `${key}|${value}`;
}

export function decodeLifeEvent(raw: string): { event: LifeEvent | undefined; value: string } {
  const idx = raw.indexOf('|');
  if (idx === -1) return { event: undefined, value: raw };
  const key = raw.slice(0, idx);
  const value = raw.slice(idx + 1);
  const event = LIFE_EVENTS.find(e => e.key === key);
  return { event, value };
}

// ============================================================

interface CreatePostProps {
  currentUser: User;
  targetUser?: User;
  onPostCreated?: () => void;
}

export default function CreatePostV3({ currentUser, targetUser, onPostCreated }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [showImageInput, setShowImageInput] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [mood, setMood] = useState('');
  const [moodEmoji, setMoodEmoji] = useState('');
  const [activity, setActivity] = useState('');
  const [activityEmoji, setActivityEmoji] = useState('');
  const [location, setLocation] = useState('');
  const [showMoodActivityPicker, setShowMoodActivityPicker] = useState(false);
  const [moodActivityType, setMoodActivityType] = useState<'mood' | 'activity'>('mood');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ Life Event state
  const [showLifeEventPicker, setShowLifeEventPicker] = useState(false);
  const [selectedLifeEvent, setSelectedLifeEvent] = useState<LifeEvent | null>(null);
  const [lifeEventValue, setLifeEventValue] = useState('');

  const [friends, setFriends] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadFriends = async () => {
      const { data } = await supabase
        .from('friendships')
        .select(`sender:sender_id(*), receiver:receiver_id(*)`)
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
      
      if (data) {
        const list = data.map((f: any) => f.sender.id === currentUser.id ? f.receiver : f.sender);
        setFriends(list);
      }
    };
    loadFriends();
  }, [currentUser.id]);

  const filteredFriends = useMemo(() => {
    if (!showMentions) return [];
    return friends
      .filter(f => 
        f.display_name.toLowerCase().includes(mentionSearchQuery.toLowerCase()) || 
        f.username.toLowerCase().includes(mentionSearchQuery.toLowerCase())
      )
      .slice(0, 5);
  }, [friends, mentionSearchQuery, showMentions]);

  const detectMention = (val: string, cursor: number) => {
    const textBeforeCursor = val.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_ก-๙]*)$/);

    if (mentionMatch) {
      setMentionSearchQuery(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setCursorIndex(e.target.selectionStart);
    detectMention(val, e.target.selectionStart);
  };

  const insertMention = (user: User) => {
    const textBeforeCursor = content.slice(0, cursorIndex);
    const textAfterCursor = content.slice(cursorIndex);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const textBeforeMention = content.slice(0, lastAtPos);
      const safeDisplayName = user.display_name.replace(/[\[\]\(\)]/g, ''); 
      const newContent = textBeforeMention + `@[${safeDisplayName}](${user.username}) ` + textAfterCursor;
      setContent(newContent);
    }
    
    setShowMentions(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleAddImage = () => {
    if (newImageUrl.trim() && imageUrls.length < 4) {
      setImageUrls([...imageUrls, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const notifyTaggedUsers = async (text: string, postId: string) => {
    const mentionRegex = /@\[.*?\]\(([a-zA-Z0-9_]+)\)/g;
    const usernames = Array.from(text.matchAll(mentionRegex)).map(m => m[1]);
    
    if (usernames.length === 0) return;

    const { data: users } = await supabase.from('users').select('id').in('username', usernames);
    if (users) {
      const notifs = users
        .filter(u => u.id !== currentUser.id)
        .map(u => ({
          receiver_id: u.id,
          sender_id: currentUser.id,
          type: 'tag_post',
          post_id: postId,
          is_read: false
        }));
      if (notifs.length > 0) await supabase.from('notifications').insert(notifs);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const moodText = mood && moodEmoji ? `${moodEmoji} ${mood}` : null;
      const activityText = activity && activityEmoji ? `${activityEmoji} ${activity}` : null;
      // ✅ encode life event
      const lifeEventText = selectedLifeEvent && lifeEventValue.trim()
        ? encodeLifeEvent(selectedLifeEvent.key, lifeEventValue.trim())
        : null;

      const { data: newPost, error } = await supabase.from('posts').insert({
        author_id: currentUser.id,
        target_id: targetUser?.id || currentUser.id,
        content: content.trim(),
        images: imageUrls.length > 0 ? imageUrls : null,
        mood: moodText,
        activity: activityText,
        location: location.trim() || null,
        life_event: lifeEventText,   // ✅ ใหม่
      }).select().single();

      if (error) throw error;
      if (newPost) await notifyTaggedUsers(content.trim(), newPost.id);

      // reset
      setContent(''); setImageUrls([]); setNewImageUrl(''); setMood(''); setMoodEmoji('');
      setActivity(''); setActivityEmoji(''); setLocation('');
      setShowImageInput(false); setShowMoodActivityPicker(false); setShowLocationInput(false);
      setShowMentions(false);
      // ✅ reset life event
      setSelectedLifeEvent(null); setLifeEventValue(''); setShowLifeEventPicker(false);

      if (onPostCreated) onPostCreated();
    } catch (error) {
      alert('ไม่สามารถโพสต์ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card-minimal animate-in fade-in duration-500">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3 mb-3">
          <Link href={`/profile/${currentUser.username}`} className="shrink-0">
            <img src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/profile/${currentUser.username}`} className="font-black text-sm md:text-base text-gray-900 block truncate">{currentUser.display_name}</Link>
            {(mood || activity || location || (selectedLifeEvent && lifeEventValue)) && (
              <div className="flex flex-wrap items-center gap-1 text-[10px] md:text-xs text-gray-500 mt-0.5 font-bold uppercase tracking-tight">
                {/* ✅ Life Event badge */}
                {selectedLifeEvent && lifeEventValue && (
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${selectedLifeEvent.badgeBg}`}>
                    <span>{selectedLifeEvent.emoji}</span>
                    <span>{selectedLifeEvent.label} {lifeEventValue}</span>
                  </span>
                )}
                {mood && <><span className="text-gray-300">รู้สึก</span><span className="text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-md border border-yellow-100">{moodEmoji} {mood}</span></>}
                {activity && <><span className="mx-0.5 text-gray-200">|</span><span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">กำลัง {activityEmoji} {activity}</span></>}
                {location && <><span className="mx-0.5 text-gray-200">|</span><span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100 flex items-center gap-1"><MapPin size={10} /> {location}</span></>}
              </div>
            )}
          </div>
        </div>

        <div className="mb-3 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyUp={(e) => setCursorIndex(e.currentTarget.selectionStart)}
            onClick={(e) => setCursorIndex(e.currentTarget.selectionStart)}
            placeholder={targetUser && targetUser.id !== currentUser.id ? `เขียนอะไรถึง ${targetUser.display_name.split(' ')[0]} หน่อยสิ...` : "คุณกำลังคิดอะไรอยู่? (พิมพ์ @ เพื่อแท็กเพื่อน)"}
            className="w-full resize-none border-none outline-none text-base md:text-lg p-0 bg-transparent min-h-[100px] placeholder:text-gray-300"
            disabled={isSubmitting}
          />

          {showMentions && filteredFriends.length > 0 && (
            <div className="absolute z-20 left-0 top-full mt-1 w-full md:w-64 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2">
              <div className="p-2 border-b bg-gray-50 flex items-center gap-2"><AtSign size={12} className="text-green-500" /><span className="text-[10px] font-black uppercase text-gray-400">แท็กเพื่อน</span></div>
              {filteredFriends.map(user => (
                <button key={user.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertMention(user)} className="w-full flex items-center gap-3 p-3 hover:bg-green-50 text-left transition-colors border-b border-gray-50 last:border-0">
                  <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover" />
                  <div className="min-w-0"><p className="text-sm font-bold text-gray-900 truncate">{user.display_name}</p><p className="text-[10px] text-gray-400">@{user.username}</p></div>
                </button>
              ))}
            </div>
          )}
        </div>

        {showImageInput && (
          <div className="mb-4 p-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            {imageUrls.length < 4 && (
              <div className="flex gap-2 mb-3">
                <input type="url" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImage())} placeholder="วางลิงก์รูปภาพที่นี่ (https://...)" className="input-minimal flex-1 text-xs" />
                <button type="button" onClick={handleAddImage} className="px-4 bg-gray-900 text-white rounded-xl text-xs font-bold transition-all active:scale-95">เพิ่มรูป</button>
              </div>
            )}
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-video rounded-xl overflow-hidden group">
                    <img src={url} className="w-full h-full object-cover" alt="" />
                    <button type="button" onClick={() => setImageUrls(imageUrls.filter((_, i) => i !== idx))} className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showLocationInput && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 rounded-2xl border border-red-100 animate-in slide-in-from-top-2">
            <MapPin className="text-red-500" size={18} />
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="อยู่ที่ไหนเอ่ย?" className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-red-700 placeholder:text-red-300" />
            <button type="button" onClick={() => { setLocation(''); setShowLocationInput(false); }} className="text-red-400"><X size={16} /></button>
          </div>
        )}

        {showMoodActivityPicker && (
          <div className="mb-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-4 animate-in slide-in-from-top-2">
            <div className="flex gap-2">
              <button type="button" onClick={() => setMoodActivityType('mood')} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${moodActivityType === 'mood' ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-500'}`}>ความรู้สึก</button>
              <button type="button" onClick={() => setMoodActivityType('activity')} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${moodActivityType === 'activity' ? 'bg-blue-400 text-white' : 'bg-gray-100 text-gray-500'}`}>กิจกรรม</button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-3 bg-gray-50 border rounded-xl text-2xl active:scale-90 transition-transform">{moodActivityType === 'mood' ? (moodEmoji || '😊') : (activityEmoji || '🎯')}</button>
              <input type="text" value={moodActivityType === 'mood' ? mood : activity} onChange={(e) => moodActivityType === 'mood' ? setMood(e.target.value) : setActivity(e.target.value)} placeholder={moodActivityType === 'mood' ? "กำลังรู้สึกอะไรอยู่?" : "กำลังทำอะไรอยู่?"} className="flex-1 bg-gray-50 border border-transparent focus:border-frog-200 rounded-xl px-4 text-sm outline-none font-bold" />
            </div>
            {showEmojiPicker && <div className="mt-2"><EmojiPicker onEmojiClick={(e) => { moodActivityType === 'mood' ? setMoodEmoji(e.emoji) : setActivityEmoji(e.emoji); setShowEmojiPicker(false); }} width="100%" height={300} /></div>}
          </div>
        )}

        {/* ✅ Life Event Picker */}
        {showLifeEventPicker && (
          <div className="mb-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm animate-in slide-in-from-top-2 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Sparkles size={12} className="text-amber-400" />
              เหตุการณ์สำคัญในชีวิต
            </p>

            {/* Event grid */}
            {!selectedLifeEvent ? (
              <div className="grid grid-cols-2 gap-2">
                {LIFE_EVENTS.map(ev => (
                  <button
                    key={ev.key}
                    type="button"
                    onClick={() => setSelectedLifeEvent(ev)}
                    className={`flex items-center gap-2 p-3 rounded-xl border ${ev.bg} ${ev.border} hover:opacity-80 transition-all text-left`}
                  >
                    {ev.icon}
                    <span className={`text-xs font-black ${ev.color}`}>{ev.label}...</span>
                  </button>
                ))}
              </div>
            ) : (
              /* Value input after picking event type */
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${selectedLifeEvent.bg} ${selectedLifeEvent.border}`}>
                <span className="text-2xl">{selectedLifeEvent.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-black uppercase tracking-tight mb-1 ${selectedLifeEvent.color}`}>{selectedLifeEvent.label}</p>
                  <input
                    autoFocus
                    type="text"
                    value={lifeEventValue}
                    onChange={e => setLifeEventValue(e.target.value)}
                    placeholder={selectedLifeEvent.placeholder}
                    className={`w-full bg-transparent outline-none text-sm font-bold ${selectedLifeEvent.color} placeholder:opacity-40`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedLifeEvent(null); setLifeEventValue(''); }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowLifeEventPicker(false);
                if (!lifeEventValue.trim()) { setSelectedLifeEvent(null); }
              }}
              className="w-full text-center text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors pt-1"
            >
              {selectedLifeEvent && lifeEventValue ? 'ยืนยัน ✓' : 'ปิด'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <div className="flex gap-1 md:gap-2">
            <button type="button" onClick={() => setShowImageInput(!showImageInput)} className={`p-2 md:px-4 md:py-2 rounded-xl flex items-center gap-2 transition-all ${showImageInput ? 'bg-green-50 text-green-600' : 'hover:bg-gray-50 text-gray-500'}`}><Image size={20} className="text-green-500" /><span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">รูปภาพ</span></button>
            <button type="button" onClick={() => setShowMoodActivityPicker(!showMoodActivityPicker)} className={`p-2 md:px-4 md:py-2 rounded-xl flex items-center gap-2 transition-all ${showMoodActivityPicker ? 'bg-yellow-50 text-yellow-600' : 'hover:bg-gray-50 text-gray-500'}`}><Smile size={20} className="text-yellow-500" /><span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">ความรู้สึก</span></button>
            <button type="button" onClick={() => setShowLocationInput(!showLocationInput)} className={`p-2 md:px-4 md:py-2 rounded-xl flex items-center gap-2 transition-all ${showLocationInput ? 'bg-red-50 text-red-600' : 'hover:bg-gray-50 text-gray-500'}`}><MapPin size={20} className="text-red-500" /><span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">เช็คอิน</span></button>
            {/* ✅ ปุ่ม Life Event */}
            <button
              type="button"
              onClick={() => setShowLifeEventPicker(!showLifeEventPicker)}
              className={`p-2 md:px-4 md:py-2 rounded-xl flex items-center gap-2 transition-all ${showLifeEventPicker || (selectedLifeEvent && lifeEventValue) ? 'bg-amber-50 text-amber-600' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <Sparkles size={20} className="text-amber-500" />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">เหตุการณ์</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="px-6 py-2.5 bg-green-600 text-white rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-green-200 disabled:opacity-30 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            <span>{isSubmitting ? 'กำลังโพสต์...' : 'โพสต์'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';
import { supabase, User } from '@/lib/supabase';
import { Image, Smile, MapPin, X, Activity } from 'lucide-react';
import dynamic from 'next/dynamic';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

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

  // States สำหรับระบบ Mention (@)
  const [showMentions, setShowMentions] = useState(false);
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAddImage = () => {
    if (newImageUrl.trim() && imageUrls.length < 4) {
      setImageUrls([...imageUrls, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const checkMention = async (val: string, cursor: number) => {
    const textBeforeCursor = val.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/(?:\s|^)@([a-zA-Z0-9_ก-๙]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setShowMentions(true);

      try {
        if (query.length > 0) {
          const { data } = await supabase
            .from('users')
            .select('id, username, display_name, profile_img_url')
            .neq('id', currentUser.id)
            .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
            .limit(5);
          setMentionResults(data || []);
        } else {
          const { data } = await supabase
            .from('users')
            .select('id, username, display_name, profile_img_url')
            .neq('id', currentUser.id)
            .limit(5);
          setMentionResults(data || []);
        }
      } catch (error) {
        console.error('Error fetching mentions:', error);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setCursorIndex(e.target.selectionStart);
    checkMention(val, e.target.selectionStart);
  };

  const handleSelectionChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorIndex(target.selectionStart);
    checkMention(target.value, target.selectionStart);
  };

  const insertMention = (user: any) => {
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
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const notifyTaggedUsers = async (text: string, postId: string) => {
    const markdownMatches = Array.from(text.matchAll(/@\[.*?\]\((.*?)\)/g)).map(m => m[1]);
    const plainMatches = Array.from(text.matchAll(/(?:\s|^)@([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    const usernames = [...new Set([...markdownMatches, ...plainMatches])];
    
    if (usernames.length === 0) return;

    try {
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('id, username')
        .in('username', usernames);

      if (fetchError) {
        console.error("❌ [ERROR] ดึงข้อมูล User จากฐานข้อมูลไม่ได้:", fetchError.message);
        return;
      }

      if (!users || users.length === 0) return;

      const usersToNotify = users.filter(u => u.id !== currentUser.id);

      const notifications = usersToNotify.map(u => ({
        receiver_id: u.id,
        sender_id: currentUser.id,
        type: 'tag_post',
        post_id: postId,
        is_read: false
      }));

      if (notifications.length > 0) {
        const { error: insertError } = await supabase.from('notifications').insert(notifications);
        if (insertError) {
          console.error("❌ [ERROR] บันทึกการแจ้งเตือนลงตารางล้มเหลว:", insertError.message, insertError.details);
        } else {
          console.log("✅ [SUCCESS] บันทึกการแจ้งเตือนสำเร็จ");
        }
      }
    } catch (error) {
      console.error('❌ [ERROR] ระบบแจ้งเตือนพัง:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const moodText = mood && moodEmoji ? `${moodEmoji} ${mood}` : null;
      const activityText = activity && activityEmoji ? `${activityEmoji} ${activity}` : null;

      const { data: newPost, error } = await supabase.from('posts').insert({
        author_id: currentUser.id,
        target_id: targetUser?.id || currentUser.id,
        content: content.trim(),
        images: imageUrls.length > 0 ? imageUrls : null,
        mood: moodText,
        activity: activityText,
        location: location.trim() || null,
      }).select().single();

      if (error) throw error;

      if (newPost) {
        await notifyTaggedUsers(content.trim(), newPost.id);
      }

      setContent('');
      setImageUrls([]);
      setNewImageUrl('');
      setMood('');
      setMoodEmoji('');
      setActivity('');
      setActivityEmoji('');
      setLocation('');
      setShowImageInput(false);
      setShowMoodActivityPicker(false);
      setShowLocationInput(false);
      setShowMentions(false);

      if (onPostCreated) {
        onPostCreated();
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('ไม่สามารถโพสต์ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card-minimal">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-2 md:gap-3 mb-3">
          <img
            src={currentUser.profile_img_url || 'https://iili.io/qbtgKBt.png'}
            alt={currentUser.display_name}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm md:text-base">{currentUser.display_name}</p>
            
            {(mood || activity || location) && (
              <div className="flex flex-wrap items-center gap-1 text-sm text-gray-600 mt-1">
                {mood && moodEmoji && (
                  <>
                    <span>รู้สึก</span>
                    <span className="font-medium">{moodEmoji}  {mood}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMood('');
                        setMoodEmoji('');
                      }}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
                
                {activity && activityEmoji && (
                  <>
                    {mood && <span className="mx-1">—</span>}
                    <span>กำลัง</span>
                    <span className="font-medium">{activityEmoji}  {activity}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActivity('');
                        setActivityEmoji('');
                      }}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
                
                {location && (
                  <>
                    {(mood || activity) && <span className="mx-1">—</span>}
                    <span>ที่</span>
                    <span className="font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {location}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLocation('')}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-3 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onClick={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            placeholder={targetUser && targetUser.id !== currentUser.id 
              ? `เขียนข้อความถึง ${targetUser.display_name} (ใช้ @ เพื่อแท็ก)...` 
              : "คุณกำลังคิดอะไรอยู่? (ใช้ @ เพื่อแท็ก)"}
            className="w-full resize-none border-none outline-none text-base md:text-lg p-0 bg-transparent"
            rows={3}
            disabled={isSubmitting}
          />

          {/* Dropdown แนะนำเพื่อนตอนพิมพ์ @ */}
          {showMentions && mentionResults.length > 0 && (
            <div className="absolute z-20 left-0 top-full mt-1 w-full md:w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              {mentionResults.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} 
                  onClick={() => insertMention(user)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 text-left transition border-b border-gray-50 last:border-0"
                >
                  <img src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.display_name}</p>
                    <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {showImageInput && (
          <div className="mb-3 space-y-3">
            {imageUrls.length < 4 && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImage())}
                  placeholder="ใส่ URL รูปภาพ..."
                  className="input-minimal flex-1"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="btn-secondary px-4"
                  disabled={!newImageUrl.trim() || isSubmitting}
                >
                  เพิ่ม
                </button>
              </div>
            )}

          {imageUrls.length > 0 && (
            <div className={`grid gap-2 ${
              imageUrls.length === 1 ? 'grid-cols-1' :
              imageUrls.length === 2 ? 'grid-cols-2' :
              imageUrls.length === 3 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {imageUrls.map((url, index) => (
                <div 
                  key={index} 
                  className={`relative ${
                    imageUrls.length === 3 && index === 0 ? 'col-span-2' : ''
                  }`}
                >
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 md:h-48 rounded-xl object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500">
              เพิ่มได้สูงสุด 4 รูป ({imageUrls.length}/4)
            </p>
          </div>
        )}

        {showLocationInput && (
          <div className="mb-3">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <MapPin className="w-5 h-5 text-green-600" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="คุณอยู่ที่ไหน?"
                className="flex-1 bg-transparent border-none outline-none"
              />
              {location && (
                <button
                  type="button"
                  onClick={() => {
                    setLocation('');
                    setShowLocationInput(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {showMoodActivityPicker && (
          <div className="mb-3 p-4 bg-gray-50 rounded-xl space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMoodActivityType('mood')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  moodActivityType === 'mood'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Smile className="w-4 h-4 inline mr-2" />
                อารมณ์
              </button>
              <button
                type="button"
                onClick={() => setMoodActivityType('activity')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  moodActivityType === 'activity'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                กิจกรรม
              </button>
            </div>

            {moodActivityType === 'mood' && (
              <div>
                <label className="block text-sm font-medium mb-2">คุณรู้สึกอย่างไร?</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-2xl"
                  >
                    {moodEmoji || '😊'}
                  </button>
                  <input
                    type="text"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    placeholder="เช่น มีความสุข, เศร้า, ตื่นเต้น..."
                    className="input-minimal flex-1"
                  />
                </div>
                {showEmojiPicker && (
                  <div className="relative z-10 mt-2">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        setMoodEmoji(emojiData.emoji);
                        setShowEmojiPicker(false);
                      }}
                      width="100%"
                      height={350}
                    />
                  </div>
                )}
              </div>
            )}

            {moodActivityType === 'activity' && (
              <div>
                <label className="block text-sm font-medium mb-2">คุณกำลังทำอะไร?</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-2xl"
                  >
                    {activityEmoji || '🎯'}
                  </button>
                  <input
                    type="text"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    placeholder="เช่น กินข้าว, ดูหนัง, เล่นเกม..."
                    className="input-minimal flex-1"
                  />
                </div>
                {showEmojiPicker && (
                  <div className="relative z-10 mt-2">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        setActivityEmoji(emojiData.emoji);
                        setShowEmojiPicker(false);
                      }}
                      width="100%"
                      height={350}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex gap-1 md:gap-2">
            <button
              type="button"
              onClick={() => setShowImageInput(!showImageInput)}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 hover:bg-gray-100 rounded-lg transition text-xs md:text-sm text-gray-700"
              disabled={isSubmitting}
            >
              <Image className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
              <span className="hidden sm:inline">รูปภาพ</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMoodActivityPicker(!showMoodActivityPicker)}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 hover:bg-gray-100 rounded-lg transition text-xs md:text-sm text-gray-700"
              disabled={isSubmitting}
            >
              <Smile className="w-4 h-4 md:w-5 md:h-5 text-yellow-600" />
              <span className="hidden sm:inline">อารมณ์/กิจกรรม</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLocationInput(!showLocationInput)}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 hover:bg-gray-100 rounded-lg transition text-xs md:text-sm text-gray-700"
              disabled={isSubmitting}
            >
              <MapPin className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
              <span className="hidden sm:inline">สถานที่</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="btn-primary px-4 md:px-6 py-2 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'กำลังโพสต์...' : 'โพสต์'}
          </button>
        </div>
      </form>
    </div>
  );
}

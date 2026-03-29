'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import { Save, User as UserIcon, MapPin, Briefcase, Palette, Music, Heart, Users, Trash2, Plus, X } from 'lucide-react';

const POPULAR_HOBBIES = [
  { name: 'เล่นเกม', emoji: '🎮' },
  { name: 'อ่านหนังสือ', emoji: '📚' },
  { name: 'ดูหนัง', emoji: '🎬' },
  { name: 'ฟังเพลง', emoji: '🎵' },
  { name: 'ถ่ายรูป', emoji: '📸' },
  { name: 'วาดรูป', emoji: '🎨' },
  { name: 'ทำอาหาร', emoji: '🍳' },
  { name: 'ออกกำลังกาย', emoji: '💪' },
  { name: 'เดินทาง', emoji: '✈️' },
  { name: 'เขียนเรื่อง', emoji: '✍️' }
];

const RELATIONSHIP_OPTIONS = [
  { id: 'single', label: 'โสด', emoji: '💔' },
  { id: 'in_relationship', label: 'มีแฟน', emoji: '❤️' },
  { id: 'engaged', label: 'หมั้น', emoji: '💍' },
  { id: 'married', label: 'แต่งงาน', emoji: '💒' },
  { id: 'complicated', label: 'ซับซ้อน', emoji: '😵' },
];

interface FamilyMember {
  id: string;
  member_user_id: string;
  relationship_label: string;
  member: User;
}

export default function EditProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    profile_img_url: '',
    cover_img_url: '',
    birthday: '',
    occupation: '',
    address: '',
    workplace: '',
    music_url: '',
    music_name: '',
    theme_color: '#9de5a8',
    relationship_status: '',
    relationship_custom_name: '',
    hobbies: [] as { name: string; emoji: string }[]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [newHobby, setNewHobby] = useState('');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Modal states
  const [showFamilyDeleteConfirm, setShowFamilyDeleteConfirm] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (searchUsername.trim().length >= 2) {
      const timer = setTimeout(() => {
        searchUser();
      }, 500);

      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchUsername, familyMembers]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userData) {
      setCurrentUser(userData);
      setFormData({
        display_name: userData.display_name || '',
        bio: userData.bio || '',
        profile_img_url: userData.profile_img_url || '',
        cover_img_url: userData.cover_img_url || '',
        birthday: userData.birthday || '',
        occupation: userData.occupation || '',
        address: userData.address || '',
        workplace: userData.workplace || '',
        music_url: userData.music_url || '',
        music_name: userData.music_name || '',
        theme_color: userData.theme_color || '#9de5a8',
        relationship_status: userData.relationship_status || '',
        relationship_custom_name: userData.relationship_custom_name || '',
        hobbies: userData.hobbies || []
      });

      await loadFamilyMembers(user.id);
    }
  };

  const loadFamilyMembers = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('family_members')
        .select('*, member:member_user_id(*)')
        .eq('user_id', userId);

      setFamilyMembers(data || []);
    } catch (error) {
      console.error('Error loading family members:', error);
    }
  };

  const searchUser = async () => {
    if (!searchUsername.trim() || searchUsername.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .or(`username.ilike.%${searchUsername.trim()}%,display_name.ilike.%${searchUsername.trim()}%`)
        .limit(5);

      const filtered = (data || []).filter(u => 
        u.id !== currentUser?.id && 
        !familyMembers.find(fm => fm.member_user_id === u.id)
      );

      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const addFamilyMemberById = async (memberId: string, relationship: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase.from('family_members').insert({
        user_id: currentUser.id,
        member_user_id: memberId,
        relationship_label: relationship
      });

      if (error) throw error;

      await loadFamilyMembers(currentUser.id);
      setSearchResults([]);
      setSearchUsername('');
    } catch (error) {
      console.error('Error adding family member:', error);
    }
  };

  const handleRemoveFamilyMember = async () => {
    if (!familyToDelete) return;

    try {
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', familyToDelete);

      if (error) throw error;

      if (currentUser) await loadFamilyMembers(currentUser.id);
      setFamilyToDelete(null);
    } catch (error) {
      console.error('Error removing family member:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          display_name: formData.display_name,
          bio: formData.bio,
          profile_img_url: formData.profile_img_url || null,
          cover_img_url: formData.cover_img_url || null,
          birthday: formData.birthday || null,
          occupation: formData.occupation || null,
          address: formData.address || null,
          workplace: formData.workplace || null,
          music_url: formData.music_url || null,
          music_name: formData.music_name || null,
          theme_color: formData.theme_color,
          relationship_status: formData.relationship_status || null,
          relationship_custom_name: formData.relationship_custom_name || null,
          hobbies: formData.hobbies,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      setShowSaveSuccess(true);
      setTimeout(() => {
        router.push(`/profile/${currentUser.username}`);
      }, 1500);
    } catch (error) {
      console.error('Error saving profile:', error);
      setShowSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const addHobby = (hobby: { name: string; emoji: string }) => {
    if (!formData.hobbies.find(h => h.name === hobby.name)) {
      setFormData({
        ...formData,
        hobbies: [...formData.hobbies, hobby]
      });
    }
  };

  const addCustomHobby = () => {
    if (!newHobby.trim()) return;
    
    addHobby({ name: newHobby.trim(), emoji: '' });
    setNewHobby('');
  };

  const removeHobby = (index: number) => {
    setFormData({
      ...formData,
      hobbies: formData.hobbies.filter((_, i) => i !== index)
    });
  };

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">แก้ไขโปรไฟล์</h1>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Info */}
          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              ข้อมูลพื้นฐาน
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">ชื่อที่แสดง</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="input-minimal"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="input-minimal resize-none"
                  rows={3}
                  placeholder="เกี่ยวกับคุณ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">รูปโปรไฟล์ (URL)</label>
                <input
                  type="url"
                  value={formData.profile_img_url}
                  onChange={(e) => setFormData({ ...formData, profile_img_url: e.target.value })}
                  className="input-minimal"
                  placeholder="https://..."
                />
                {formData.profile_img_url && (
                  <img 
                    src={formData.profile_img_url} 
                    alt="Preview" 
                    className="mt-2 w-20 h-20 rounded-full object-cover"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">รูปปก (URL)</label>
                <input
                  type="url"
                  value={formData.cover_img_url}
                  onChange={(e) => setFormData({ ...formData, cover_img_url: e.target.value })}
                  className="input-minimal"
                  placeholder="https://..."
                />
                {formData.cover_img_url && (
                  <img 
                    src={formData.cover_img_url} 
                    alt="Preview" 
                    className="mt-2 w-full h-32 rounded-xl object-cover"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">วันเกิด</label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  className="input-minimal"
                />
              </div>
            </div>
          </div>

          {/* Work & Location */}
          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              งาน & ที่อยู่
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">อาชีพ</label>
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  className="input-minimal"
                  placeholder="นักเรียน, พนักงาน, ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ที่อยู่</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input-minimal"
                  placeholder="กรุงเทพ, เชียงใหม่, ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">สถานที่ทำงาน/เรียน</label>
                <input
                  type="text"
                  value={formData.workplace}
                  onChange={(e) => setFormData({ ...formData, workplace: e.target.value })}
                  className="input-minimal"
                  placeholder="บริษัท ABC, มหาวิทยาลัย XYZ, ..."
                />
              </div>
            </div>
          </div>

          {/* Relationship Status */}
          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              สถานะความสัมพันธ์
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">สถานะ</label>
                <select
                  value={formData.relationship_status}
                  onChange={(e) => setFormData({ ...formData, relationship_status: e.target.value })}
                  className="input-minimal"
                >
                  <option value="">ไม่ระบุ</option>
                  {RELATIONSHIP_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.emoji} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.relationship_status === 'in_relationship' || 
                formData.relationship_status === 'married') && (
                <div>
                  <label className="block text-sm font-medium mb-2">ชื่อคู่</label>
                  <input
                    type="text"
                    value={formData.relationship_custom_name}
                    onChange={(e) => setFormData({ ...formData, relationship_custom_name: e.target.value })}
                    className="input-minimal"
                    placeholder="ชื่อคนพิเศษ"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Family Members & Close Friends */}
          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              ครอบครัวและเพื่อนสนิท
            </h2>

            {/* รายชื่อที่มีอยู่แล้ว */}
            {familyMembers.length > 0 && (
              <div className="space-y-2 mb-4">
                {familyMembers.map((fm) => (
                  <div key={fm.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <img 
                      src={fm.member.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                      alt={fm.member.display_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{fm.member.display_name}</p>
                      <p className="text-xs text-gray-500">{fm.relationship_label}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFamilyToDelete(fm.id);
                        setShowFamilyDeleteConfirm(true);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ค้นหาและเพิ่มสมาชิก */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-medium mb-3">🔍 ค้นหาและเพิ่มสมาชิกครอบครัว</p>
              
              <div className="relative">
                <input
                  type="text"
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  placeholder="พิมพ์ username หรือชื่อ (อย่างน้อย 2 ตัวอักษร)..."
                  className="input-minimal w-full pr-20"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {isSearching && (
                    <div className="w-4 h-4 border-2 border-frog-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {searchUsername && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchUsername('');
                        setSearchResults([]);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {searchUsername.trim().length > 0 && searchUsername.trim().length < 2 && (
                <p className="text-xs text-gray-500 mt-2">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</p>
              )}

              {/* ผลการค้นหา */}
              {searchResults.length > 0 && (
                <div className="space-y-2 mt-3">
                  <p className="text-xs text-gray-500 mb-2">พบ {searchResults.length} คน</p>
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200 hover:border-frog-300 transition">
                      <img 
                        src={user.profile_img_url || 'https://iili.io/qbtgKBt.png'}
                        alt={user.display_name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user.display_name}</p>
                        <p className="text-xs text-gray-500">@{user.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const relationship = prompt('ความสัมพันธ์ (เช่น พี่ชาย, แม่, เพื่อนสนิท):');
                          if (relationship && relationship.trim()) {
                            addFamilyMemberById(user.id, relationship.trim());
                          }
                        }}
                        className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        เพิ่ม
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {searchUsername.trim().length >= 2 && searchResults.length === 0 && !isSearching && (
                <p className="text-sm text-gray-500 text-center py-4">ไม่พบผู้ใช้</p>
              )}
            </div>
          </div>

          {/* Hobbies */}
          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5" />
              งานอดิเรก
            </h2>

            <div className="space-y-4">
              {formData.hobbies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.hobbies.map((hobby, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 bg-frog-100 text-frog-700 rounded-xl"
                    >
                      <span>{hobby.emoji} {hobby.name}</span>
                      <button
                        type="button"
                        onClick={() => removeHobby(index)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 mb-2">เลือกจากรายการ:</p>
                <div className="grid grid-cols-2 gap-2">
                  {POPULAR_HOBBIES.map((hobby, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => addHobby(hobby)}
                      className="p-2 text-left text-sm bg-gray-50 hover:bg-frog-50 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={formData.hobbies.some(h => h.name === hobby.name)}
                    >
                      {hobby.emoji} {hobby.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">หรือพิมพ์เอง:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newHobby}
                    onChange={(e) => setNewHobby(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomHobby())}
                    className="input-minimal flex-1"
                    placeholder="งานอดิเรกของคุณ"
                  />
                  <button
                    type="button"
                    onClick={addCustomHobby}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    เพิ่ม
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Theme & Music */}
          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              ธีม & เพลง
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">สีธีม</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={formData.theme_color}
                    onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                    className="w-20 h-12 rounded-xl cursor-pointer"
                  />
                  <div className="flex-1">
                    <div 
                      className="h-12 rounded-xl border-2"
                      style={{ 
                        backgroundColor: formData.theme_color,
                        borderColor: `${formData.theme_color}80`
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  ชื่อเพลงประจำโปรไฟล์
                </label>
                <input
                  type="text"
                  value={formData.music_name}
                  onChange={(e) => setFormData({ ...formData, music_name: e.target.value })}
                  className="input-minimal"
                  placeholder="เช่น Never Gonna Give You Up - Rick Astley"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ลิงก์เพลง (YouTube URL)</label>
                <input
                  type="url"
                  value={formData.music_url}
                  onChange={(e) => setFormData({ ...formData, music_url: e.target.value })}
                  className="input-minimal"
                  placeholder="https://youtube.com/watch?v=..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  แสดงเป็นลิงก์บนโปรไฟล์ของคุณ คลิกเพื่อฟังบน YouTube
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-3 sticky bottom-4 bg-white/80 backdrop-blur-sm p-4 -mx-4 rounded-xl">
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary flex-1 disabled:opacity-50 shadow-lg"
            >
              <Save className="w-4 h-4 inline mr-2" />
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/profile/${currentUser.username}`)}
              className="btn-secondary shadow-lg"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={showFamilyDeleteConfirm}
        onClose={() => {
          setShowFamilyDeleteConfirm(false);
          setFamilyToDelete(null);
        }}
        onConfirm={handleRemoveFamilyMember}
        title="ต้องการลบสมาชิกครอบครัว?"
        message="การลบจะถูกบันทึกทันที"
        confirmText="ลบ"
        cancelText="ยกเลิก"
        variant="danger"
      />

      <AlertModal
        isOpen={showSaveSuccess}
        onClose={() => setShowSaveSuccess(false)}
        title="บันทึกสำเร็จ!"
        message="ข้อมูลโปรไฟล์ของคุณถูกอัพเดทแล้ว"
        buttonText="ตกลง"
        variant="success"
      />

      <AlertModal
        isOpen={showSaveError}
        onClose={() => setShowSaveError(false)}
        title="เกิดข้อผิดพลาด"
        message="ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง"
        buttonText="ตกลง"
        variant="error"
      />
    </NavLayout>
  );
}
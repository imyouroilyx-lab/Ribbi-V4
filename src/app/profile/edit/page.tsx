'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import { Save, User as UserIcon, Briefcase, Heart, Users, Trash2, Plus, X, Palette, Music } from 'lucide-react';

const RELATIONSHIP_OPTIONS = [
  { id: 'single', label: 'โสด', emoji: '👤' },
  { id: 'in_relationship', label: 'มีแฟน', emoji: '❤️' },
  { id: 'engaged', label: 'หมั้น', emoji: '💍' },
  { id: 'married', label: 'แต่งงาน', emoji: '💒' },
  { id: 'complicated', label: 'ไม่ชัดเจน', emoji: '❓' },
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
    display_name: '', bio: '', profile_img_url: '', cover_img_url: '',
    birthday: '', occupation: '', address: '', workplace: '',
    music_url: '', music_name: '', theme_color: '#9de5a8',
    relationship_status: '', relationship_custom_name: '',
    hobbies: [] as { name: string; emoji: string }[]
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [newHobbyInput, setNewHobbyInput] = useState('');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [showFamilyDeleteConfirm, setShowFamilyDeleteConfirm] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);

  useEffect(() => { loadUser(); }, []);

  useEffect(() => {
    if (searchUsername.trim().length >= 2) {
      const timer = setTimeout(() => searchUser(), 500);
      return () => clearTimeout(timer);
    } else setSearchResults([]);
  }, [searchUsername]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (userData) {
      setCurrentUser(userData);
      setFormData({
        display_name: userData.display_name || '', bio: userData.bio || '',
        profile_img_url: userData.profile_img_url || '', cover_img_url: userData.cover_img_url || '',
        birthday: userData.birthday || '', occupation: userData.occupation || '',
        address: userData.address || '', workplace: userData.workplace || '',
        music_url: userData.music_url || '', music_name: userData.music_name || '',
        theme_color: userData.theme_color || '#9de5a8',
        relationship_status: userData.relationship_status || '',
        relationship_custom_name: userData.relationship_custom_name || '',
        hobbies: userData.hobbies || []
      });
      await loadFamilyMembers(user.id);
    }
  };

  const loadFamilyMembers = async (userId: string) => {
    const { data } = await supabase.from('family_members').select('*, member:member_user_id(*)').eq('user_id', userId);
    setFamilyMembers(data || []);
  };

  const searchUser = async () => {
    if (!searchUsername.trim()) return;
    setIsSearching(true);
    const { data } = await supabase.from('users').select('*').or(`username.ilike.%${searchUsername.trim()}%,display_name.ilike.%${searchUsername.trim()}%`).limit(5);
    const filtered = (data || []).filter(u => u.id !== currentUser?.id && !familyMembers.find(fm => fm.member_user_id === u.id));
    setSearchResults(filtered);
    setIsSearching(false);
  };

  const addFamilyMemberById = async (memberId: string, relationship: string) => {
    if (!currentUser) return;
    await supabase.from('family_members').insert({ user_id: currentUser.id, member_user_id: memberId, relationship_label: relationship });
    await loadFamilyMembers(currentUser.id);
    setSearchUsername(''); setSearchResults([]);
  };

  // ✅ ฟังก์ชันที่หายไป เอากลับมาแล้วครับ
  const handleRemoveFamilyMember = async () => {
    if (!familyToDelete) return;
    try {
      await supabase.from('family_members').delete().eq('id', familyToDelete);
      if (currentUser) await loadFamilyMembers(currentUser.id);
      setFamilyToDelete(null);
      setShowFamilyDeleteConfirm(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddHobby = () => {
    const val = newHobbyInput.trim();
    if (!val) return;
    if (formData.hobbies.some(h => h.name === val)) { setNewHobbyInput(''); return; }
    setFormData({ ...formData, hobbies: [...formData.hobbies, { name: val, emoji: '' }] });
    setNewHobbyInput('');
  };

  const removeHobby = (index: number) => {
    setFormData({ ...formData, hobbies: formData.hobbies.filter((_, i) => i !== index) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); if (!currentUser) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('users').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', currentUser.id);
      if (error) throw error;
      setShowSaveSuccess(true);
      setTimeout(() => router.push(`/profile/${currentUser.username}`), 1500);
    } catch (error) { setShowSaveError(true); } finally { setIsSaving(false); }
  };

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <h1 className="text-3xl font-black text-gray-900 mb-8">แก้ไขโปรไฟล์</h1>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><UserIcon className="w-5 h-5" /> ข้อมูลพื้นฐาน</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">ชื่อที่แสดง</label><input type="text" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} className="input-minimal" required /></div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Bio (แนะนำตัว)</label>
                  <span className={`text-[10px] font-black ${formData.bio.length >= 150 ? 'text-red-500' : 'text-gray-400'}`}>{formData.bio.length} / 150</span>
                </div>
                <textarea 
                  value={formData.bio} 
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, 150) })} 
                  className="input-minimal min-h-[120px] resize-none leading-relaxed" 
                  rows={4}
                  placeholder="เขียนอะไรบางอย่างเกี่ยวกับคุณ..."
                  maxLength={150}
                />
              </div>
              <div><label className="block text-sm font-medium mb-2">รูปโปรไฟล์ (URL)</label><input type="url" value={formData.profile_img_url} onChange={(e) => setFormData({ ...formData, profile_img_url: e.target.value })} className="input-minimal" /></div>
              <div><label className="block text-sm font-medium mb-2">รูปปก (URL)</label><input type="url" value={formData.cover_img_url} onChange={(e) => setFormData({ ...formData, cover_img_url: e.target.value })} className="input-minimal" /></div>
              <div><label className="block text-sm font-medium mb-2">วันเกิด</label><input type="date" value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} className="input-minimal" /></div>
            </div>
          </div>

          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Briefcase className="w-5 h-5" /> งาน & ที่อยู่</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">อาชีพ</label><input type="text" value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} className="input-minimal" /></div>
              <div><label className="block text-sm font-medium mb-2">ที่อยู่</label><input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input-minimal" /></div>
              <div><label className="block text-sm font-medium mb-2">สถานที่ทำงาน/เรียน</label><input type="text" value={formData.workplace} onChange={(e) => setFormData({ ...formData, workplace: e.target.value })} className="input-minimal" /></div>
            </div>
          </div>

          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Users className="w-5 h-5" /> ความสัมพันธ์</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">สถานะ</label><select value={formData.relationship_status} onChange={(e) => setFormData({ ...formData, relationship_status: e.target.value })} className="input-minimal"><option value="">ไม่ระบุ</option>{RELATIONSHIP_OPTIONS.map(o => (<option key={o.id} value={o.id}>{o.emoji} {o.label}</option>))}</select></div>
              {(formData.relationship_status === 'in_relationship' || formData.relationship_status === 'married') && (<div><label className="block text-sm font-medium mb-2">ชื่อคู่</label><input type="text" value={formData.relationship_custom_name} onChange={(e) => setFormData({ ...formData, relationship_custom_name: e.target.value })} className="input-minimal" placeholder="ชื่อคนพิเศษ" /></div>)}
              <div className="space-y-2 mt-4">
                {familyMembers.map(fm => (
                  <div key={fm.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <img src={fm.member.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-10 h-10 rounded-full object-cover" alt="" />
                    <div className="flex-1 text-sm font-bold">{fm.member.display_name} <span className="font-normal text-gray-400 ml-2">({fm.relationship_label})</span></div>
                    <button type="button" onClick={() => { setFamilyToDelete(fm.id); setShowFamilyDeleteConfirm(true); }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl mt-4">
                <p className="text-[10px] font-black mb-3 text-indigo-600 uppercase">🔍 ค้นหาและเพิ่มความสัมพันธ์</p>
                <div className="relative"><input type="text" value={searchUsername} onChange={(e) => setSearchUsername(e.target.value)} placeholder="Username..." className="input-minimal w-full pr-12" />{isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}</div>
                {searchResults.length > 0 && (<div className="mt-3 space-y-2">{searchResults.map(u => (<div key={u.id} className="flex items-center gap-3 p-2 bg-white rounded-xl shadow-sm border border-indigo-100"><img src={u.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-8 h-8 rounded-full object-cover" alt="" /><div className="flex-1 min-w-0 font-bold text-xs">{u.display_name}</div><button type="button" onClick={() => { const rel = prompt(`ความสัมพันธ์คือ? (เช่น พี่ชาย, เพื่อนสนิท):`); if (rel) addFamilyMemberById(u.id, rel); }} className="btn-primary py-1 px-3 text-[10px]">เพิ่ม</button></div>))}</div>)}
              </div>
            </div>
          </div>

          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Palette className="w-5 h-5" /> ธีม & เพลง</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">สีธีมโปรไฟล์</label>
                <div className="flex gap-4 items-center">
                  <input type="color" value={formData.theme_color} onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })} className="w-16 h-16 rounded-2xl cursor-pointer border-4 border-white shadow-sm" />
                  <div className="flex-1 h-12 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center" style={{ backgroundColor: formData.theme_color + '20' }}><span className="text-xs font-black uppercase" style={{ color: formData.theme_color }}>Preview Color</span></div>
                </div>
              </div>
              <div><label className="block text-sm font-medium mb-2 flex items-center gap-2"><Music size={16} /> ชื่อเพลง</label><input type="text" value={formData.music_name} onChange={(e) => setFormData({ ...formData, music_name: e.target.value })} className="input-minimal" placeholder="ชื่อเพลง - ศิลปิน" /></div>
              <div><label className="block text-sm font-medium mb-2 flex items-center gap-2"><Music size={16} /> YouTube URL</label><input type="url" value={formData.music_url} onChange={(e) => setFormData({ ...formData, music_url: e.target.value })} className="input-minimal" placeholder="https://youtube.com/watch?v=..." /></div>
            </div>
          </div>

          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Heart className="w-5 h-5 text-red-500" /> งานอดิเรก</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={newHobbyInput} onChange={(e) => setNewHobbyInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddHobby())} placeholder="พิมพ์อีโมจิแล้วเว้นวรรค เช่น 🎮 เล่นเกม" className="input-minimal flex-1" />
                <button type="button" onClick={handleAddHobby} className="btn-primary px-4"><Plus size={20} /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.hobbies.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl font-bold text-xs">
                    <span>{h.name}</span>
                    <button type="button" onClick={() => removeHobby(i)} className="text-red-500 ml-1 font-black">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 sticky bottom-4 bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-gray-100">
            <button type="submit" disabled={isSaving} className="btn-primary flex-1 py-4 font-black shadow-lg">{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
            <button type="button" onClick={() => router.back()} className="px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black">ยกเลิก</button>
          </div>
        </form>
      </div>
      <ConfirmModal isOpen={showFamilyDeleteConfirm} onClose={() => setShowFamilyDeleteConfirm(false)} onConfirm={handleRemoveFamilyMember} title="ลบความสัมพันธ์?" message="ข้อมูลนี้จะหายไปจากหน้าโปรไฟล์ของคุณ" confirmText="ลบออก" variant="danger" />
      <AlertModal isOpen={showSaveSuccess} onClose={() => setShowSaveSuccess(false)} title="สำเร็จ!" message="อัปเดตเรียบร้อย" variant="success" />
      <AlertModal isOpen={showSaveError} onClose={() => setShowSaveError(false)} title="ล้มเหลว" message="เกิดข้อผิดพลาด" variant="error" />
    </NavLayout>
  );
}

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
  { id: 'divorced', label: 'หย่าร้าง', emoji: '💔' },
];

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
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);

  useEffect(() => { loadUser(); }, []);

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
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!currentUser) return;
    setIsSaving(true);
    try {
      // ✅ กลับมาใช้ music_url และ music_name ตาม Schema เดิมของพี่
      const payload = {
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
        hobbies: formData.hobbies
      };

      const { error } = await supabase.from('users').update(payload).eq('id', currentUser.id);
      if (error) throw error;
      
      setShowSaveSuccess(true);
      setTimeout(() => router.push(`/profile/${currentUser.username}`), 1500);
    } catch (error) { 
      console.error(error);
      setShowSaveError(true); 
    } finally { setIsSaving(false); }
  };

  const handleAddHobby = () => {
    if (!newHobbyInput.trim()) return;
    setFormData({ ...formData, hobbies: [...formData.hobbies, { name: newHobbyInput.trim(), emoji: '' }] });
    setNewHobbyInput('');
  };

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <h1 className="text-3xl font-black text-gray-900 mb-8">Settings</h1>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="card-minimal bg-white p-6 rounded-3xl border border-gray-100">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><UserIcon className="w-5 h-5" /> ข้อมูลพื้นฐาน</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Display Name</label><input type="text" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} className="input-minimal w-full" required /></div>
              <div><label className="block text-sm font-medium mb-2">Bio</label><textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="input-minimal w-full min-h-[100px]" maxLength={150} /></div>
              <div><label className="block text-sm font-medium mb-2">Profile Image (URL)</label><input type="url" value={formData.profile_img_url} onChange={(e) => setFormData({ ...formData, profile_img_url: e.target.value })} className="input-minimal w-full" /></div>
              <div><label className="block text-sm font-medium mb-2">Cover Image (URL)</label><input type="url" value={formData.cover_img_url} onChange={(e) => setFormData({ ...formData, cover_img_url: e.target.value })} className="input-minimal w-full" /></div>
            </div>
          </div>

          <div className="card-minimal bg-white p-6 rounded-3xl border border-gray-100">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Palette className="w-5 h-5" /> Theme & Music</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Profile Color</label><input type="color" value={formData.theme_color} onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer" /></div>
              <div><label className="block text-sm font-medium mb-2">Song Name</label><input type="text" value={formData.music_name} onChange={(e) => setFormData({ ...formData, music_name: e.target.value })} className="input-minimal w-full" /></div>
              <div><label className="block text-sm font-medium mb-2">Song URL (YouTube)</label><input type="url" value={formData.music_url} onChange={(e) => setFormData({ ...formData, music_url: e.target.value })} className="input-minimal w-full" /></div>
            </div>
          </div>

          <div className="flex gap-4 sticky bottom-4 bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-xl border">
            <button type="submit" disabled={isSaving} className="btn-primary flex-1 py-4 font-black shadow-lg shadow-frog-200">{isSaving ? 'Saving...' : 'Save Profile'}</button>
            <button type="button" onClick={() => router.back()} className="px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black">Cancel</button>
          </div>
        </form>
      </div>
      <AlertModal isOpen={showSaveSuccess} onClose={() => setShowSaveSuccess(false)} title="Success" message="Profile updated!" variant="success" />
      <AlertModal isOpen={showSaveError} onClose={() => setShowSaveError(false)} title="Error" message="Failed to save" variant="error" />
    </NavLayout>
  );
}

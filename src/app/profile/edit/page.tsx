'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import AlertModal from '@/components/AlertModal';
import { Save, User as UserIcon, Briefcase, Heart, Palette, Music, ChevronLeft } from 'lucide-react';

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
    hobbies: [] as any[]
  });
  
  const [isSaving, setIsSaving] = useState(false);
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
      // ✅ กลับมาใช้ชื่อ Column เดิม (music_url, music_name)
      const { error } = await supabase.from('users').update({
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
      }).eq('id', currentUser.id);

      if (error) throw error;
      setShowSaveSuccess(true);
      setTimeout(() => router.push(`/profile/${currentUser.username}`), 1500);
    } catch (error) { 
      console.error(error);
      setShowSaveError(true); 
    } finally { setIsSaving(false); }
  };

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 shadow-sm"><ChevronLeft size={20} /></button>
          <h1 className="text-3xl font-black text-gray-900">แก้ไขข้อมูลส่วนตัว</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="card-minimal bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-soft">
            <h2 className="text-xl font-black mb-8 flex items-center gap-3"><Heart className="w-6 h-6 text-red-500" /> สถานะความสัมพันธ์</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">สถานะหัวใจ</label>
                <select value={formData.relationship_status} onChange={(e) => setFormData({ ...formData, relationship_status: e.target.value })} className="input-minimal w-full">
                  <option value="">ไม่ระบุ</option>
                  {RELATIONSHIP_OPTIONS.map(o => (<option key={o.id} value={o.id}>{o.emoji} {o.label}</option>))}
                </select>
              </div>
              {(formData.relationship_status && formData.relationship_status !== 'single') && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">ชื่อคู่ของคุณ</label>
                  <input type="text" value={formData.relationship_custom_name} onChange={(e) => setFormData({ ...formData, relationship_custom_name: e.target.value })} className="input-minimal w-full" placeholder="ชื่อคนพิเศษของคุณ" />
                </div>
              )}
            </div>
          </div>

          <div className="card-minimal bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-soft">
            <h2 className="text-xl font-black mb-8 flex items-center gap-3"><Music className="w-6 h-6 text-indigo-500" /> เพลงประจำโปรไฟล์</h2>
            <div className="space-y-6">
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">ชื่อเพลง</label><input type="text" value={formData.music_name} onChange={(e) => setFormData({ ...formData, music_name: e.target.value })} className="input-minimal w-full" placeholder="เช่น Fly Me To The Moon" /></div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">ลิงก์เพลง (YouTube/Spotify)</label><input type="url" value={formData.music_url} onChange={(e) => setFormData({ ...formData, music_url: e.target.value })} className="input-minimal w-full" placeholder="https://..." /></div>
            </div>
          </div>

          <div className="card-minimal bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-soft">
            <h2 className="text-xl font-black mb-8 flex items-center gap-3"><UserIcon className="w-6 h-6 text-frog-500" /> ข้อมูลทั่วไป</h2>
            <div className="space-y-6">
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Display Name</label><input type="text" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} className="input-minimal w-full" required /></div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Bio</label><textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="input-minimal w-full min-h-[120px]" maxLength={150} /></div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">สีธีมโปรไฟล์</label><input type="color" value={formData.theme_color} onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })} className="w-full h-14 rounded-2xl cursor-pointer border-4 border-white shadow-sm" /></div>
            </div>
          </div>

          <div className="sticky bottom-4 bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-gray-100 flex gap-4">
            <button type="submit" disabled={isSaving} className="btn-primary flex-1 py-4 font-black shadow-lg shadow-frog-200">{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลทั้งหมด'}</button>
            <button type="button" onClick={() => router.back()} className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black">ยกเลิก</button>
          </div>
        </form>
      </div>
      <AlertModal isOpen={showSaveSuccess} onClose={() => setShowSaveSuccess(false)} title="สำเร็จ!" message="อัปเดตข้อมูลโปรไฟล์ของคุณเรียบร้อยแล้ว" variant="success" />
      <AlertModal isOpen={showSaveError} onClose={() => setShowSaveError(false)} title="ล้มเหลว" message="ไม่สามารถบันทึกได้ โปรดเช็กการเชื่อมต่อ" variant="error" />
    </NavLayout>
  );
}

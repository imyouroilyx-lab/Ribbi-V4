'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout'; // ✅ แก้ไข Path ให้ถูกต้อง
import AlertModal from '@/components/AlertModal'; // ✅ แก้ไข Path ให้ถูกต้อง
import { Save, User as UserIcon, Briefcase, Heart, Palette, Music, ChevronLeft, MapPin, Calendar, Home as HomeIcon } from 'lucide-react';

const RELATIONSHIP_OPTIONS = [
  { id: 'single', label: 'โสด', emoji: '👤' },
  { id: 'in_relationship', label: 'มีแฟนแล้ว', emoji: '❤️' },
  { id: 'engaged', label: 'หมั้นแล้ว', emoji: '💍' },
  { id: 'married', label: 'แต่งงานแล้ว', emoji: '💒' },
  { id: 'complicated', label: 'ไม่ชัดเจน', emoji: '❓' },
  { id: 'divorced', label: 'หย่าร้าง', emoji: '💔' },
];

export default function EditProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    display_name: '', bio: '', profile_img_url: '', cover_img_url: '',
    birthday: '', occupation: '', address: '', workplace: '',
    music_url: '', music_name: '', theme_color: '#9de5a8',
    relationship_status: '', relationship_custom_name: '',
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
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!currentUser) return;
    setIsSaving(true);
    try {
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
        <div className="flex items-center gap-4 mb-8 pt-6">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 shadow-sm transition-all"><ChevronLeft size={20} /></button>
          <h1 className="text-3xl font-black text-gray-900">แก้ไขโปรไฟล์</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* ข้อมูลพื้นฐาน */}
          <div className="card-minimal bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-soft">
            <h2 className="text-xl font-black mb-8 flex items-center gap-3 text-frog-500"><UserIcon size={24} /> ข้อมูลพื้นฐาน</h2>
            <div className="space-y-6">
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">ชื่อที่แสดง</label><input type="text" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} className="input-minimal w-full" required /></div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Bio (แนะนำตัว)</label><textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="input-minimal w-full min-h-[100px]" maxLength={150} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">รูปโปรไฟล์ (URL)</label><input type="url" value={formData.profile_img_url} onChange={(e) => setFormData({ ...formData, profile_img_url: e.target.value })} className="input-minimal w-full" /></div>
                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">รูปปก (URL)</label><input type="url" value={formData.cover_img_url} onChange={(e) => setFormData({ ...formData, cover_img_url: e.target.value })} className="input-minimal w-full" /></div>
              </div>
            </div>
          </div>

          {/* ประวัติและสถานที่ - กู้คืนครบทุกฟิลด์ */}
          <div className="card-minimal bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-soft">
            <h2 className="text-xl font-black mb-8 flex items-center gap-3 text-blue-500"><Briefcase size={24} /> ประวัติและสถานที่</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Calendar size={12} /> วันเกิด</label><input type="date" value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} className="input-minimal w-full" /></div>
                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Briefcase size={12} /> อาชีพ</label><input type="text" value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} className="input-minimal w-full" placeholder="ระบุอาชีพ" /></div>
              </div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><HomeIcon size={12} /> สถานที่ทำงาน/เรียน</label><input type="text" value={formData.workplace} onChange={(e) => setFormData({ ...formData, workplace: e.target.value })} className="input-minimal w-full" placeholder="ชื่อที่ทำงานหรือโรงเรียน" /></div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><MapPin size={12} /> ที่อยู่/จังหวัด</label><input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input-minimal w-full" placeholder="เช่น กรุงเทพมหานคร" /></div>
            </div>
          </div>

          {/* สถานะความสัมพันธ์ */}
          <div className="card-minimal bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-soft">
            <h2 className="text-xl font-black mb-8 flex items-center gap-3 text-red-500"><Heart size={24} /> สถานะความสัมพันธ์</h2>
            <div className="space-y-6">
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">สถานะหัวใจ</label><select value={formData.relationship_status} onChange={(e) => setFormData({ ...formData, relationship_status: e.target.value })} className="input-minimal w-full"><option value="">ไม่ระบุ</option>{RELATIONSHIP_OPTIONS.map(o => (<option key={o.id} value={o.id}>{o.emoji} {o.label}</option>))}</select></div>
              {(formData.relationship_status && formData.relationship_status !== 'single') && (
                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">ชื่อคู่ของคุณ</label><input type="text" value={formData.relationship_custom_name} onChange={(e) => setFormData({ ...formData, relationship_custom_name: e.target.value })} className="input-minimal w-full" placeholder="ชื่อคนพิเศษของคุณ" /></div>
              )}
            </div>
          </div>

          {/* ธีมและเพลง */}
          <div className="card-minimal bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-soft">
            <h2 className="text-xl font-black mb-8 flex items-center gap-3 text-indigo-500"><Palette size={24} /> ธีม & เพลง</h2>
            <div className="space-y-6">
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">สีธีมโปรไฟล์</label><input type="color" value={formData.theme_color} onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })} className="w-full h-14 rounded-2xl cursor-pointer border-4 border-white shadow-sm" /></div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">ชื่อเพลง</label><input type="text" value={formData.music_name} onChange={(e) => setFormData({ ...formData, music_name: e.target.value })} className="input-minimal w-full" placeholder="ชื่อเพลง - ศิลปิน" /></div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">ลิงก์เพลง</label><input type="url" value={formData.music_url} onChange={(e) => setFormData({ ...formData, music_url: e.target.value })} className="input-minimal w-full" placeholder="YouTube/Spotify URL" /></div>
            </div>
          </div>

          <div className="sticky bottom-4 bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-gray-100 flex gap-4">
            <button type="submit" disabled={isSaving} className="btn-primary flex-1 py-4 font-black shadow-lg shadow-frog-200">{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลทั้งหมด'}</button>
            <button type="button" onClick={() => router.back()} className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black transition-all hover:bg-gray-200">ยกเลิก</button>
          </div>
        </form>
      </div>
      <AlertModal isOpen={showSaveSuccess} onClose={() => setShowSaveSuccess(false)} title="สำเร็จ!" message="อัปเดตข้อมูลโปรไฟล์เรียบร้อย" variant="success" />
      <AlertModal isOpen={showSaveError} onClose={() => setShowSaveError(false)} title="ล้มเหลว" message="เกิดข้อผิดพลาดในการบันทึก" variant="error" />
    </NavLayout>
  );
}

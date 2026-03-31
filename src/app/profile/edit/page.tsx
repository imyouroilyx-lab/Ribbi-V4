'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import AlertModal from '@/components/AlertModal';
import { 
  Save, User as UserIcon, Briefcase, Heart, Palette, 
  Music, ChevronLeft, MapPin, Calendar, Home as HomeIcon,
  Plus, X, Hash
} from 'lucide-react';

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
    hobbies: [] as { name: string; emoji?: string }[]
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [newHobbyInput, setNewHobbyInput] = useState('');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.push('/login'); return; }
    
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
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
        hobbies: Array.isArray(userData.hobbies) ? userData.hobbies : []
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
        hobbies: formData.hobbies
      }).eq('id', currentUser.id);

      if (error) throw error;
      setShowSaveSuccess(true);
      setTimeout(() => router.push(`/profile/${currentUser.username}`), 1500);
    } catch (error) { 
      console.error("Save error:", error);
      setShowSaveError(true); 
    } finally { setIsSaving(false); }
  };

  const handleAddHobby = () => {
    if (!newHobbyInput.trim()) return;
    if (formData.hobbies.some(h => h.name.toLowerCase() === newHobbyInput.trim().toLowerCase())) {
      setNewHobbyInput('');
      return;
    }
    setFormData({ 
      ...formData, 
      hobbies: [...formData.hobbies, { name: newHobbyInput.trim() }] 
    });
    setNewHobbyInput('');
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
      <div className="max-w-[1000px] mx-auto px-4 pb-24">
        <div className="flex items-center gap-4 mb-10 pt-8">
          <button 
            onClick={() => router.back()} 
            className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">ตั้งค่าโปรไฟล์</h1>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Ribbi Member Settings</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* ส่วนที่ 1: ข้อมูลพื้นฐาน */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-frog-500">
              <span className="w-12 h-12 rounded-2xl bg-frog-50 flex items-center justify-center"><UserIcon size={24} /></span>
              ข้อมูลพื้นฐาน
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">ชื่อที่แสดง (Display Name)</label>
                <input type="text" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} className="input-minimal w-full text-lg" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Bio (แนะนำตัวสั้นๆ)</label>
                <textarea 
                  value={formData.bio} 
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })} 
                  className="input-minimal w-full min-h-[120px] text-lg resize-none" 
                  maxLength={150} 
                  placeholder="เขียนอะไรบางอย่างเกี่ยวกับคุณ..."
                />
                <p className="text-right text-[10px] font-black text-gray-300 mt-2">{formData.bio.length}/150</p>
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">รูปโปรไฟล์ (URL)</label>
                <input type="url" value={formData.profile_img_url} onChange={(e) => setFormData({ ...formData, profile_img_url: e.target.value })} className="input-minimal w-full" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">รูปหน้าปก (URL)</label>
                <input type="url" value={formData.cover_img_url} onChange={(e) => setFormData({ ...formData, cover_img_url: e.target.value })} className="input-minimal w-full" placeholder="https://..." />
              </div>
            </div>
          </div>

          {/* ส่วนที่ 2: ประวัติและสถานที่ (กู้คืนมาครบ) */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-blue-500">
              <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center"><Briefcase size={24} /></span>
              ประวัติและสถานที่
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <Calendar size={14} /> วันเกิด
                </label>
                <input type="date" value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} className="input-minimal w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <Briefcase size={14} /> อาชีพ
                </label>
                <input type="text" value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} className="input-minimal w-full" placeholder="เช่น บรรณารักษ์, นักเรียน" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <HomeIcon size={14} /> สถานที่ทำงาน/เรียน
                </label>
                <input type="text" value={formData.workplace} onChange={(e) => setFormData({ ...formData, workplace: e.target.value })} className="input-minimal w-full" placeholder="ระบุสถานที่" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <MapPin size={14} /> ที่อยู่/จังหวัด
                </label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input-minimal w-full" placeholder="เช่น กรุงเทพมหานคร" />
              </div>
            </div>
          </div>

          {/* ส่วนที่ 3: สถานะความสัมพันธ์ */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-red-500">
              <span className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center"><Heart size={24} /></span>
              ความสัมพันธ์
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">สถานะปัจจุบัน</label>
                <select 
                  value={formData.relationship_status} 
                  onChange={(e) => setFormData({ ...formData, relationship_status: e.target.value })} 
                  className="input-minimal w-full"
                >
                  <option value="">ไม่ระบุ</option>
                  {RELATIONSHIP_OPTIONS.map(o => (<option key={o.id} value={o.id}>{o.emoji} {o.label}</option>))}
                </select>
              </div>
              {formData.relationship_status && formData.relationship_status !== 'single' && (
                <div>
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">ชื่อคนพิเศษ</label>
                  <input 
                    type="text" 
                    value={formData.relationship_custom_name} 
                    onChange={(e) => setFormData({ ...formData, relationship_custom_name: e.target.value })} 
                    className="input-minimal w-full" 
                    placeholder="ใส่ชื่อหรือ Tag @username" 
                  />
                </div>
              )}
            </div>
          </div>

          {/* ส่วนที่ 4: งานอดิเรก (กู้คืนมาให้แล้วพี่) */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-orange-500">
              <span className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center"><Hash size={24} /></span>
              งานอดิเรกและความสนใจ
            </h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={newHobbyInput} 
                  onChange={(e) => setNewHobbyInput(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddHobby())}
                  placeholder="เพิ่มงานอดิเรก (เช่น ถ่ายรูป, เล่นเกม)" 
                  className="input-minimal flex-1"
                />
                <button type="button" onClick={handleAddHobby} className="btn-primary px-8 rounded-2xl"><Plus size={20} /></button>
              </div>
              <div className="flex flex-wrap gap-3">
                {formData.hobbies.map((h, i) => (
                  <div key={i} className="px-5 py-2.5 bg-gray-50 border border-gray-100 rounded-full flex items-center gap-3 transition-all hover:border-red-100 hover:bg-red-50 group">
                    <span className="text-sm font-black text-gray-600 uppercase tracking-wide group-hover:text-red-500">{h.name}</span>
                    <button type="button" onClick={() => removeHobby(i)} className="text-gray-300 group-hover:text-red-500"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ส่วนที่ 5: สไตล์และเพลง */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-indigo-500">
              <span className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center"><Music size={24} /></span>
              ธีมและเพลง
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">สีธีมโปรไฟล์</label>
                <div className="flex items-center gap-6">
                  <input type="color" value={formData.theme_color} onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })} className="w-20 h-20 rounded-3xl cursor-pointer border-4 border-white shadow-md transition-transform hover:scale-105" />
                  <div className="flex-1 p-4 rounded-2xl border-2 border-dashed border-gray-100 flex items-center justify-center" style={{ backgroundColor: formData.theme_color + '10' }}>
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: formData.theme_color }}>Preview Color</span>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">ชื่อเพลงโปรด</label>
                  <input type="text" value={formData.music_name} onChange={(e) => setFormData({ ...formData, music_name: e.target.value })} className="input-minimal w-full" placeholder="ชื่อเพลง - ศิลปิน" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">ลิงก์เพลง (YouTube/Spotify)</label>
                  <input type="url" value={formData.music_url} onChange={(e) => setFormData({ ...formData, music_url: e.target.value })} className="input-minimal w-full" placeholder="https://..." />
                </div>
              </div>
            </div>
          </div>

          {/* ปุ่มบันทึก (Sticky Footer) */}
          <div className="sticky bottom-6 z-50">
            <div className="bg-white/80 backdrop-blur-xl p-4 rounded-[2.5rem] shadow-2xl border border-white/50 flex gap-4 max-w-lg mx-auto">
              <button 
                type="submit" 
                disabled={isSaving} 
                className="btn-primary flex-1 py-5 rounded-3xl font-black text-white shadow-xl shadow-frog-200 transition-all active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: formData.theme_color }}
              >
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลทั้งหมด'}
              </button>
              <button 
                type="button" 
                onClick={() => router.back()} 
                className="px-10 py-5 bg-gray-100 text-gray-500 rounded-3xl font-black transition-all hover:bg-gray-200 active:scale-95"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </form>
      </div>

      <AlertModal 
        isOpen={showSaveSuccess} 
        onClose={() => setShowSaveSuccess(false)} 
        title="สำเร็จ!" 
        message="ข้อมูลโปรไฟล์ของคุณถูกอัปเดตเรียบร้อยแล้ว" 
        variant="success" 
      />
      <AlertModal 
        isOpen={showSaveError} 
        onClose={() => setShowSaveError(false)} 
        title="ล้มเหลว" 
        message="ไม่สามารถบันทึกข้อมูลได้ โปรดตรวจสอบการเชื่อมต่อ" 
        variant="error" 
      />
    </NavLayout>
  );
}

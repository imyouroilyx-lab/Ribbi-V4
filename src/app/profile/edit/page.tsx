'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavLayout from '@/components/NavLayout';
import AlertModal from '@/components/AlertModal';
import { 
  User as UserIcon, Briefcase, Heart, Music, ChevronLeft, Calendar, Home as HomeIcon,
  Plus, X, Hash, MapPin, Trash2, Save, Link as LinkIcon, Star
} from 'lucide-react';

const RELATIONSHIP_OPTIONS = [
  { id: 'single', label: 'โสด', emoji: '👤' },
  { id: 'in_relationship', label: 'มีแฟนแล้ว', emoji: '❤️' },
  { id: 'engaged', label: 'หมั้นแล้ว', emoji: '💍' },
  { id: 'married', label: 'แต่งงานแล้ว', emoji: '💒' },
  { id: 'complicated', label: 'ไม่ชัดเจน', emoji: '❓' },
  { id: 'divorced', label: 'หย่าร้าง', emoji: '💔' },
];

const MBTI_OPTIONS = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const ZODIAC_OPTIONS = ['Capricorn', 'Aquarius', 'Pisces', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius'];
const ENNEAGRAM_OPTIONS = ['Type 1', 'Type 2', 'Type 3', 'Type 4', 'Type 5', 'Type 6', 'Type 7', 'Type 8', 'Type 9'];

export default function EditProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    display_name: '', bio: '', profile_img_url: '', cover_img_url: '',
    birthday: '', occupation: '', address: '', workplace: '',
    music_url: '', music_name: '', theme_color: '#9de5a8',
    relationship_status: '', relationship_custom_name: '',
    website_url: '', zodiac: '', mbti: '', enneagram: '',
    hobbies: [] as { name: string }[]
  });
  
  const [lifeEvents, setLifeEvents] = useState<{id: string, type: string, title: string, subtitle: string, start_year: string, end_year: string}[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [newHobbyInput, setNewHobbyInput] = useState('');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push('/login'); return; }
    
    const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
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
        website_url: userData.website_url || '',
        zodiac: userData.zodiac || '',
        mbti: userData.mbti || '',
        enneagram: userData.enneagram || '',
        hobbies: Array.isArray(userData.hobbies) ? userData.hobbies : []
      });
      setLifeEvents(Array.isArray(userData.life_events) ? userData.life_events : []);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!currentUser) return;
    setIsSaving(true);
    try {
      // ✅ แปลงค่าว่าง ('') เป็น null เพื่อป้องกัน Database Error
      const payload = {
        ...formData,
        birthday: formData.birthday === '' ? null : formData.birthday,
        zodiac: formData.zodiac === '' ? null : formData.zodiac,
        mbti: formData.mbti === '' ? null : formData.mbti,
        enneagram: formData.enneagram === '' ? null : formData.enneagram,
        relationship_status: formData.relationship_status === '' ? null : formData.relationship_status,
        life_events: lifeEvents 
      };

      const { error } = await supabase.from('users').update(payload).eq('id', currentUser.id);

      if (error) {
        console.error("Supabase Save Error:", error);
        throw error;
      }
      
      setShowSaveSuccess(true);
      setTimeout(() => router.push(`/profile/${currentUser.username}`), 1500);
    } catch (error) { 
      console.error(error);
      setShowSaveError(true); 
    } finally { setIsSaving(false); }
  };

  const handleAddHobby = () => {
    if (!newHobbyInput.trim()) return;
    if (formData.hobbies.some(h => h.name.toLowerCase() === newHobbyInput.trim().toLowerCase())) {
      setNewHobbyInput(''); return;
    }
    setFormData({ ...formData, hobbies: [...formData.hobbies, { name: newHobbyInput.trim() }] });
    setNewHobbyInput('');
  };

  const addLifeEvent = () => {
    setLifeEvents([...lifeEvents, { id: Date.now().toString(), type: 'education', title: '', subtitle: '', start_year: '', end_year: '' }]);
  };

  const updateLifeEvent = (id: string, field: string, value: string) => {
    setLifeEvents(lifeEvents.map(event => event.id === id ? { ...event, [field]: value } : event));
  };

  const removeLifeEvent = (id: string) => {
    setLifeEvents(lifeEvents.filter(event => event.id !== id));
  };

  if (!currentUser) return null;

  return (
    <NavLayout>
      <div className="max-w-[1000px] mx-auto px-4 pb-24 animate-in fade-in duration-500">
        <div className="flex items-center gap-4 mb-10 pt-8">
          <button onClick={() => router.back()} className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 shadow-sm active:scale-95 transition-all">
            <ChevronLeft size={24} />
          </button>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">ตั้งค่าโปรไฟล์</h1>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Ribbi Member Settings</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8 relative">
          
          {/* ข้อมูลพื้นฐาน */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-frog-500">
              <span className="w-12 h-12 rounded-2xl bg-frog-50 flex items-center justify-center"><UserIcon size={24} /></span>
              ข้อมูลพื้นฐาน
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">ชื่อที่แสดง</label>
                <input type="text" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} className="input-minimal w-full text-lg" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Bio</label>
                <textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="input-minimal w-full min-h-[120px] text-lg resize-none" maxLength={150} placeholder="แนะนำตัวสั้นๆ..." />
                <p className="text-right text-[10px] font-black text-gray-300 mt-2">{formData.bio.length}/150</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><LinkIcon size={14} /> เว็บไซต์ / ลิงก์</label>
                <input type="url" value={formData.website_url} onChange={(e) => setFormData({ ...formData, website_url: e.target.value })} className="input-minimal w-full" placeholder="https://..." />
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

          {/* วันเกิดและสีประจำตัว */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-pink-500">
              <span className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center"><Calendar size={24} /></span>
              วันเกิดและสีประจำตัว
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">วัน/เดือน/ปีเกิด</label>
                <input type="date" value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} className="input-minimal w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">สีธีมโปรไฟล์ (Theme Color)</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={formData.theme_color} onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })} className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0" />
                  <input type="text" value={formData.theme_color} onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })} className="input-minimal flex-1" placeholder="#9de5a8" />
                </div>
              </div>
            </div>
          </div>

          {/* การทำงานและที่พักอาศัย */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-orange-500">
              <span className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center"><Briefcase size={24} /></span>
              การทำงานและที่พักอาศัย
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">อาชีพ / ตำแหน่ง</label>
                <input type="text" value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} className="input-minimal w-full" placeholder="เช่น นักเรียน, ฟรีแลนซ์..." />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">สถานที่ทำงาน / ศึกษา</label>
                <input type="text" value={formData.workplace} onChange={(e) => setFormData({ ...formData, workplace: e.target.value })} className="input-minimal w-full" placeholder="เช่น มหาวิทยาลัย..., บริษัท..." />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><MapPin size={14} /> ที่อยู่ / จังหวัด</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input-minimal w-full" placeholder="เช่น กรุงเทพมหานคร..." />
              </div>
            </div>
          </div>

          {/* ตัวตนและลักษณะนิสัย */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-purple-500">
              <span className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center"><Star size={24} /></span>
              ตัวตนและลักษณะนิสัย
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">ราศี</label>
                <select value={formData.zodiac} onChange={(e) => setFormData({...formData, zodiac: e.target.value})} className="input-minimal w-full">
                  <option value="">เลือกราศี</option>
                  {ZODIAC_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">MBTI</label>
                <select value={formData.mbti} onChange={(e) => setFormData({...formData, mbti: e.target.value})} className="input-minimal w-full">
                  <option value="">เลือก MBTI</option>
                  {MBTI_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Enneagram</label>
                <select value={formData.enneagram} onChange={(e) => setFormData({...formData, enneagram: e.target.value})} className="input-minimal w-full">
                  <option value="">เลือก Enneagram</option>
                  {ENNEAGRAM_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* เพลงและงานอดิเรก */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-emerald-500">
              <span className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center"><Music size={24} /></span>
              เพลงและงานอดิเรก
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">ชื่อเพลงที่ชอบ</label>
                <input type="text" value={formData.music_name} onChange={(e) => setFormData({ ...formData, music_name: e.target.value })} className="input-minimal w-full" placeholder="เช่น Shape of You..." />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><LinkIcon size={14} /> ลิงก์เพลง (Youtube/Spotify)</label>
                <input type="url" value={formData.music_url} onChange={(e) => setFormData({ ...formData, music_url: e.target.value })} className="input-minimal w-full" placeholder="https://..." />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Hash size={14} /> สิ่งที่สนใจ / งานอดิเรก</label>
              <div className="flex gap-2 mb-4">
                <input type="text" value={newHobbyInput} onChange={(e) => setNewHobbyInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddHobby())} className="input-minimal flex-1" placeholder="พิมพ์แล้วกด Enter หรือกดปุ่มบวก" />
                <button type="button" onClick={handleAddHobby} className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-100 transition-colors shadow-sm"><Plus size={20} /></button>
              </div>
              {formData.hobbies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.hobbies.map((hobby, index) => (
                    <span key={index} className="px-4 py-2 bg-gray-50 text-gray-700 text-sm font-bold rounded-xl flex items-center gap-2 border border-gray-200 shadow-sm">
                      {hobby.name}
                      <button type="button" onClick={() => setFormData({ ...formData, hobbies: formData.hobbies.filter((_, i) => i !== index) })} className="hover:text-red-500 transition-colors bg-white rounded-full p-0.5 shadow-sm"><X size={14} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* เหตุการณ์ในชีวิต */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
              <h2 className="text-2xl font-black flex items-center gap-4 text-blue-500">
                <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center"><Briefcase size={24} /></span>
                เหตุการณ์ในชีวิต
              </h2>
              <button type="button" onClick={addLifeEvent} className="px-5 py-2.5 bg-blue-50 text-blue-600 font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors shadow-sm active:scale-95">
                <Plus size={16} /> เพิ่มประวัติ
              </button>
            </div>
            <div className="space-y-6">
              {lifeEvents.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                  <p className="text-gray-400 font-bold text-sm">ยังไม่มีข้อมูลประวัติ</p>
                </div>
              ) : (
                lifeEvents.map((event) => (
                  <div key={event.id} className="p-6 bg-gray-50/80 rounded-[2rem] border border-gray-100 relative group animate-in slide-in-from-bottom-2">
                    <button type="button" onClick={() => removeLifeEvent(event.id)} className="absolute top-4 right-4 p-2.5 bg-white text-gray-400 hover:text-white hover:bg-red-500 rounded-full shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all z-10">
                      <Trash2 size={16} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">ประเภท</label>
                        <select value={event.type} onChange={e => updateLifeEvent(event.id, 'type', e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-gray-700">
                          <option value="education">🎓 การศึกษา</option>
                          <option value="work">💼 การทำงาน</option>
                          <option value="life">⭐ เหตุการณ์สำคัญ</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div className="col-span-2 md:col-span-1">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">สถานที่ / ชื่อเหตุการณ์</label>
                          <input type="text" value={event.title} onChange={e => updateLifeEvent(event.id, 'title', e.target.value)} placeholder="เช่น มหาวิทยาลัย..., บริษัท..." className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm" />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">รายละเอียด / ตำแหน่ง</label>
                          <input type="text" value={event.subtitle} onChange={e => updateLifeEvent(event.id, 'subtitle', e.target.value)} placeholder="เช่น ปริญญาตรี, Manager..." className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 md:col-span-2">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">ปีที่เริ่ม (เช่น 2020)</label>
                          <input type="text" value={event.start_year} onChange={e => updateLifeEvent(event.id, 'start_year', e.target.value)} placeholder="YYYY" className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm" maxLength={4} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">ปีที่จบ (หรือปัจจุบัน)</label>
                          <input type="text" value={event.end_year} onChange={e => updateLifeEvent(event.id, 'end_year', e.target.value)} placeholder="YYYY หรือ ปัจจุบัน" className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ความสัมพันธ์ */}
          <div className="card-minimal bg-white p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-soft">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 text-red-500">
              <span className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center"><Heart size={24} /></span>
              ความสัมพันธ์
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">สถานะปัจจุบัน</label>
                <select value={formData.relationship_status} onChange={(e) => setFormData({ ...formData, relationship_status: e.target.value })} className="input-minimal w-full">
                  <option value="">ไม่ระบุ</option>
                  {RELATIONSHIP_OPTIONS.map(o => (<option key={o.id} value={o.id}>{o.emoji} {o.label}</option>))}
                </select>
              </div>
              {formData.relationship_status && formData.relationship_status !== 'single' && (
                <div>
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">ชื่อคนพิเศษ</label>
                  <input type="text" value={formData.relationship_custom_name} onChange={(e) => setFormData({ ...formData, relationship_custom_name: e.target.value })} className="input-minimal w-full" placeholder="ชื่อหรือ Tag @username" />
                </div>
              )}
            </div>
          </div>

          {/* ปุ่มบันทึก */}
          <div className="sticky bottom-6 z-50">
            <div className="bg-white/80 backdrop-blur-xl p-4 rounded-[2.5rem] shadow-2xl border border-white/50 flex gap-4 max-w-lg mx-auto">
              <button type="submit" disabled={isSaving} className="btn-primary flex-1 py-5 rounded-3xl font-black text-white shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: formData.theme_color }}>
                <Save size={20} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลทั้งหมด'}
              </button>
              <button type="button" onClick={() => router.back()} className="px-10 py-5 bg-gray-100 text-gray-500 rounded-3xl font-black transition-all hover:bg-gray-200 active:scale-95">ยกเลิก</button>
            </div>
          </div>
        </form>
      </div>

      <AlertModal isOpen={showSaveSuccess} onClose={() => setShowSaveSuccess(false)} title="สำเร็จ!" message="ข้อมูลโปรไฟล์ถูกอัปเดตเรียบร้อยแล้ว" variant="success" />
      <AlertModal isOpen={showSaveError} onClose={() => setShowSaveError(false)} title="ล้มเหลว" message="ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง" variant="error" />
    </NavLayout>
  );
}

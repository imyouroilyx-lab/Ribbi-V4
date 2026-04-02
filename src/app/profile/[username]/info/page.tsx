'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import NavLayout from '../../../../components/NavLayout';
import { 
  ChevronLeft, GraduationCap, Briefcase, Heart, Info, 
  Loader2, Star, Calendar, BadgeCheck, Link as LinkIcon 
} from 'lucide-react';

export default function ProfileInfoPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  
  const [profileUser, setProfileUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInfo();
  }, [username]);

  const loadInfo = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, profile_img_url, bio, birthday, hobbies, theme_color, life_events, is_verified, website_url')
        .eq('username', username)
        .single();

      if (error) throw error;
      setProfileUser(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !profileUser) {
    return (
      <NavLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" />
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Ribbi Loading...</p>
        </div>
      </NavLayout>
    );
  }

  const themeColor = profileUser.theme_color || '#22c55e';
  
  // ✅ Logic ใหม่: เรียงตามปีที่เริ่ม (Start Year) จากใหม่ไปเก่า
  const lifeEvents = Array.isArray(profileUser.life_events) 
    ? [...profileUser.life_events].sort((a, b) => {
        const startA = parseInt(a.start_year) || 0;
        const startB = parseInt(b.start_year) || 0;
        
        // ถ้าปีเริ่มไม่เท่ากัน เอาคนเริ่มทีหลัง (ใหม่กว่า) ขึ้นก่อน
        if (startB !== startA) return startB - startA;
        
        // ถ้าปีเริ่มเท่ากันจริงๆ ค่อยเอาอันที่จบทีหลัง (หรือยังไม่จบ) ขึ้นก่อน
        const getEndYear = (y: any) => (!y || y.toString().includes('ปัจจุบัน')) ? 9999 : parseInt(y) || 0;
        return getEndYear(b.end_year) - getEndYear(a.end_year);
      })
    : [];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'education': return <GraduationCap size={16} className="text-white" />;
      case 'work': return <Briefcase size={16} className="text-white" />;
      case 'life': return <Heart size={16} className="text-white" />;
      default: return <Star size={16} className="text-white" />;
    }
  };

  return (
    <NavLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-6 pb-24 pt-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push(`/profile/${username}`)} className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100">
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-4">
            <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: themeColor }} alt="" />
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight flex items-center gap-2">
                {profileUser.display_name}
                {profileUser.is_verified && <BadgeCheck className="w-6 h-6 text-blue-500 flex-shrink-0" />}
              </h1>
              <p className="text-sm text-gray-500 font-bold tracking-tight">@{profileUser.username}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-soft border border-gray-100 space-y-12">
          
          {/* ข้อมูลทั่วไป */}
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-gray-400">
              <Info size={18} style={{ color: themeColor }} /> ข้อมูลเบื้องต้น
            </h2>
            <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
              <p className="text-gray-800 whitespace-pre-wrap font-medium leading-relaxed mb-4">
                {profileUser.bio || 'ไม่มีข้อมูลแนะนำตัว'}
              </p>
              
              {profileUser.website_url && (
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200/50">
                  <LinkIcon size={16} className="text-gray-400" />
                  <a 
                    href={profileUser.website_url.startsWith('http') ? profileUser.website_url : `https://${profileUser.website_url}`} 
                    target="_blank" rel="noopener noreferrer" 
                    className="text-sm font-black hover:underline"
                    style={{ color: themeColor }}
                  >
                    {profileUser.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Timeline เหตุการณ์ในชีวิต */}
          <section className="space-y-6">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-gray-400 mb-6">
              <Calendar size={18} style={{ color: themeColor }} /> ประวัติและเหตุการณ์
            </h2>
            
            {lifeEvents.length > 0 ? (
              <div className="relative pl-4 md:pl-8 border-l-2 border-gray-100 space-y-10">
                {lifeEvents.map((event: any, idx: number) => {
                  const isPresent = !event.end_year || event.end_year.includes('ปัจจุบัน');
                  return (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[25px] md:-left-[41px] top-1 w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white z-10" style={{ backgroundColor: themeColor }}>
                        {getEventIcon(event.type)}
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:bg-white transition-all ml-2">
                        <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg mb-2 inline-block shadow-sm" style={{ backgroundColor: isPresent ? themeColor : `${themeColor}20`, color: isPresent ? '#fff' : themeColor }}>
                          เริ่ม {event.start_year} {isPresent ? ' (กำลังดำเนินอยู่)' : ` ถึง ${event.end_year}`}
                        </span>
                        <h3 className="text-lg font-black text-gray-900 mt-1 leading-tight">{event.title}</h3>
                        {event.subtitle && <p className="text-sm font-bold text-gray-500 mt-1">{event.subtitle}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed text-gray-400 font-bold text-sm italic">ยังไม่ได้เพิ่มเหตุการณ์สำคัญ</p>
            )}
          </section>

          {/* ความสนใจ */}
          {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-gray-400">
                <Heart size={18} style={{ color: themeColor }} /> สิ่งที่สนใจ
              </h2>
              <div className="flex flex-wrap gap-2 pt-2">
                {profileUser.hobbies.map((h: any, i: number) => (
                  <span key={i} className="px-5 py-2.5 rounded-2xl text-sm font-bold border shadow-sm transition-all hover:-translate-y-1 bg-white" style={{ color: themeColor, borderColor: `${themeColor}30` }}>
                    {typeof h === 'string' ? h : h.name}
                  </span>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </NavLayout>
  );
}

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
        .select('id, username, display_name, profile_img_url, cover_img_url, bio, birthday, hobbies, theme_color, life_events, is_verified, website_url')
        .eq('username', username)
        .single();

      if (error) throw error;
      setProfileUser(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !profileUser) {
    return (
      <NavLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-frog-500 mb-4" />
          <p className="text-gray-500 font-bold text-xs uppercase tracking-wide">LOADING INFO...</p>
        </div>
      </NavLayout>
    );
  }

  const themeColor = profileUser.theme_color || '#22c55e';
  
  // ✅ Logic การเรียงลำดับใหม่: แม่นยำ 100%
  const lifeEvents = Array.isArray(profileUser.life_events) 
    ? [...profileUser.life_events].sort((a, b) => {
        // แปลงปีจบให้เป็นตัวเลข ถ้าเป็น "ปัจจุบัน" หรือว่าง ให้เป็น 9999 (สูงสุด)
        const getYearValue = (yearStr: string) => {
          if (!yearStr || yearStr.includes('ปัจจุบัน')) return 9999;
          const parsed = parseInt(yearStr);
          return isNaN(parsed) ? 0 : parsed;
        };

        const endA = getYearValue(a.end_year);
        const endB = getYearValue(b.end_year);

        // 1. เรียงตามปีที่จบก่อน (ใครจบช้ากว่า/ยังทำอยู่ ขึ้นก่อน)
        if (endB !== endA) {
          return endB - endA;
        }

        // 2. ถ้าปีจบเท่ากัน ให้ดูปีที่เริ่ม (ใครเริ่มทีหลัง ขึ้นก่อน)
        const startA = parseInt(a.start_year) || 0;
        const startB = parseInt(b.start_year) || 0;
        return startB - startA;
      })
    : [];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'education': return <GraduationCap size={16} className="text-white" />;
      case 'work': return <Briefcase size={16} className="text-white" />;
      default: return <Star size={16} className="text-white" />;
    }
  };

  return (
    <NavLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-6 pb-24 animate-in fade-in duration-500 pt-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push(`/profile/${username}`)} className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 border border-gray-100">
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={profileUser.profile_img_url || 'https://iili.io/qbtgKBt.png'} className="w-14 h-14 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: themeColor }} alt="" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight flex items-center gap-2">
                เกี่ยวกับฉัน
                {profileUser.is_verified && <BadgeCheck className="w-6 h-6 text-blue-500" />}
              </h1>
              <p className="text-sm text-gray-500 font-bold tracking-wide">@{profileUser.username}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-soft border border-gray-100 space-y-12">
          
          {/* แนะนำตัว + ลิงก์เว็บไซต์ */}
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-gray-400">
              <Info size={18} style={{ color: themeColor }} /> แนะนำตัว
            </h2>
            <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
              <p className="text-gray-800 whitespace-pre-wrap font-medium leading-relaxed mb-4">{profileUser.bio || 'ยังไม่ได้เพิ่มข้อมูลแนะนำตัว'}</p>
              
              {/* ✅ แสดงลิงก์เว็บไซต์แบบ IG */}
              {profileUser.website_url && (
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200/50">
                  <LinkIcon size={16} className="text-gray-400" />
                  <a 
                    href={profileUser.website_url.startsWith('http') ? profileUser.website_url : `https://${profileUser.website_url}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm font-black hover:underline transition-all"
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
              <Calendar size={18} style={{ color: themeColor }} /> เหตุการณ์ในชีวิต
            </h2>
            
            {lifeEvents.length > 0 ? (
              <div className="relative pl-4 md:pl-8 border-l-2 border-gray-100 space-y-10">
                {lifeEvents.map((event: any, idx: number) => (
                  <div key={idx} className="relative">
                    <div 
                      className="absolute -left-[25px] md:-left-[41px] top-1 w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white z-10" 
                      style={{ backgroundColor: themeColor }}
                    >
                      {getEventIcon(event.type)}
                    </div>
                    
                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow hover:bg-white ml-2">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg mb-2 inline-block" style={{ backgroundColor: `${themeColor}20`, color: themeColor }}>
                        {event.start_year} — {(!event.end_year || event.end_year.includes('ปัจจุบัน')) ? 'ปัจจุบัน' : event.end_year}
                      </span>
                      <h3 className="text-lg font-black text-gray-900 mt-1 leading-tight">{event.title}</h3>
                      {event.subtitle && <p className="text-sm font-bold text-gray-500 mt-1">{event.subtitle}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                <p className="text-sm font-bold text-gray-400">ยังไม่มีประวัติให้แสดง</p>
              </div>
            )}
          </section>

          {/* ความสนใจ */}
          {profileUser.hobbies && Array.isArray(profileUser.hobbies) && profileUser.hobbies.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-gray-400">
                <Heart size={18} style={{ color: themeColor }} /> ความสนใจ
              </h2>
              <div className="flex flex-wrap gap-2 pt-2">
                {profileUser.hobbies.map((h: any, i: number) => (
                  <span key={i} className="px-5 py-2.5 rounded-2xl text-sm font-bold border shadow-sm transition-transform hover:-translate-y-1" style={{ backgroundColor: `${themeColor}10`, color: themeColor, borderColor: `${themeColor}20` }}>
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

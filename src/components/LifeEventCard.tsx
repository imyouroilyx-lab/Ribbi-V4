'use client';

/**
 * LifeEventCard.tsx
 *
 * Visual card component สำหรับแสดงเหตุการณ์สำคัญในชีวิต
 * - Dual photo card (relationship, friendship)
 * - Solo visual card (new_job, graduation, moved, anniversary, travel, new_baby)
 */

import Link from 'next/link';
import { User } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LifeEventDef {
  key: string;
  label: string;           // "กำลังคบหากับ"
  placeholder: string;     // placeholder ใน input
  needsTaggedUser: boolean; // true = ต้องแท็กผู้ใช้ด้วย
  color: string;           // tw text color
  bg: string;              // tw bg (light)
  border: string;          // tw border
  badgeBg: string;         // badge style
  icon: string;            // lucide icon name (ใช้ใน picker)
  emoji: string;
  gradient: string;        // gradient for card bg
  accentColor: string;     // hex for glow / ring
  cardLabel: string;       // label แสดงบน card  "กำลังคบหากับ"
}

export const LIFE_EVENTS: LifeEventDef[] = [
  {
    key: 'relationship',
    label: 'กำลังคบหากับ',
    placeholder: 'ค้นหาชื่อเพื่อน...',
    needsTaggedUser: true,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    badgeBg: 'bg-pink-100 text-pink-700 border-pink-200',
    icon: 'Heart',
    emoji: '💕',
    gradient: 'from-rose-50 via-pink-50 to-fuchsia-50',
    accentColor: '#f43f5e',
    cardLabel: 'กำลังคบหากันอยู่',
  },
  {
    key: 'new_job',
    label: 'เริ่มงานใหม่ที่',
    placeholder: 'ชื่อที่ทำงาน / ตำแหน่ง...',
    needsTaggedUser: false,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: 'Briefcase',
    emoji: '💼',
    gradient: 'from-sky-50 via-blue-50 to-indigo-50',
    accentColor: '#3b82f6',
    cardLabel: 'เริ่มงานใหม่',
  },
  {
    key: 'graduation',
    label: 'จบการศึกษาจาก',
    placeholder: 'ชื่อสถาบัน / คณะ...',
    needsTaggedUser: false,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badgeBg: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: 'GraduationCap',
    emoji: '🎓',
    gradient: 'from-yellow-50 via-amber-50 to-orange-50',
    accentColor: '#f59e0b',
    cardLabel: 'จบการศึกษา',
  },
  {
    key: 'new_baby',
    label: 'ต้อนรับสมาชิกใหม่',
    placeholder: 'ชื่อเด็กน้อย...',
    needsTaggedUser: false,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    badgeBg: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: 'Baby',
    emoji: '👶',
    gradient: 'from-purple-50 via-violet-50 to-fuchsia-50',
    accentColor: '#a855f7',
    cardLabel: 'ขอต้อนรับสมาชิกใหม่',
  },
  {
    key: 'moved',
    label: 'ย้ายไปอยู่ที่',
    placeholder: 'สถานที่ใหม่...',
    needsTaggedUser: false,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badgeBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: 'Home',
    emoji: '🏠',
    gradient: 'from-green-50 via-emerald-50 to-teal-50',
    accentColor: '#10b981',
    cardLabel: 'ย้ายไปอยู่ที่',
  },
  {
    key: 'anniversary',
    label: 'ครบรอบ',
    placeholder: 'ครบรอบอะไร...',
    needsTaggedUser: false,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    badgeBg: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: 'Star',
    emoji: '🎉',
    gradient: 'from-rose-50 via-red-50 to-orange-50',
    accentColor: '#f43f5e',
    cardLabel: 'ฉลองวันครบรอบ',
  },
  {
    key: 'travel',
    label: 'เดินทางไปที่',
    placeholder: 'ชื่อสถานที่...',
    needsTaggedUser: false,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    badgeBg: 'bg-sky-100 text-sky-700 border-sky-200',
    icon: 'Plane',
    emoji: '✈️',
    gradient: 'from-sky-50 via-cyan-50 to-blue-50',
    accentColor: '#0ea5e9',
    cardLabel: 'เดินทางไปที่',
  },
  {
    key: 'friendship',
    label: 'เป็นเพื่อนกับ',
    placeholder: 'ค้นหาชื่อเพื่อน...',
    needsTaggedUser: true,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badgeBg: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: 'Users',
    emoji: '🤝',
    gradient: 'from-orange-50 via-amber-50 to-yellow-50',
    accentColor: '#f97316',
    cardLabel: 'เป็นเพื่อนกันแล้ว',
  },
];

// ─── encode / decode ──────────────────────────────────────────────────────────

/** เก็บใน DB เป็น  "key|value|taggedUserId"  (taggedUserId optional) */
export function encodeLifeEvent(key: string, value: string, taggedUserId?: string) {
  return taggedUserId ? `${key}|${value}|${taggedUserId}` : `${key}|${value}`;
}

export function decodeLifeEvent(raw: string): {
  event: LifeEventDef | undefined;
  value: string;
  taggedUserId?: string;
} {
  const parts = raw.split('|');
  const key = parts[0];
  const value = parts[1] ?? '';
  const taggedUserId = parts[2];
  const event = LIFE_EVENTS.find(e => e.key === key);
  return { event, value, taggedUserId };
}

// ─── Dual Card (relationship / friendship) ────────────────────────────────────

interface DualCardProps {
  event: LifeEventDef;
  authorUser: User;
  taggedUser: User;       // ผู้ใช้ที่ถูกแท็ก
  value?: string;         // optional subtitle text
}

function DualLifeEventCard({ event, authorUser, taggedUser, value }: DualCardProps) {
  return (
    <div
      className={`relative rounded-3xl overflow-hidden mb-4 bg-gradient-to-br ${event.gradient} border ${event.border} shadow-sm`}
      style={{ padding: '28px 20px 20px' }}
    >
      {/* Decorative blobs */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: `radial-gradient(circle at 30% 50%, ${event.accentColor}18 0%, transparent 60%),
                       radial-gradient(circle at 70% 50%, ${event.accentColor}10 0%, transparent 60%)`,
        }}
      />

      {/* Photos row */}
      <div className="relative flex items-center justify-center" style={{ height: 96 }}>
        {/* Left avatar */}
        <Link
          href={`/profile/${authorUser.username}`}
          className="relative z-10 block"
          style={{ marginRight: -16 }}
        >
          <div
            className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg"
            style={{ boxShadow: `0 0 0 3px ${event.accentColor}55, 0 4px 16px ${event.accentColor}30` }}
          >
            <img
              src={authorUser.profile_img_url || 'https://iili.io/qbtgKBt.png'}
              className="w-full h-full object-cover"
              alt={authorUser.display_name}
            />
          </div>
        </Link>

        {/* Center icon/emoji */}
        <div
          className="relative z-20 flex items-center justify-center rounded-full bg-white shadow-md border-2 border-white"
          style={{
            width: 32,
            height: 32,
            fontSize: 16,
            boxShadow: `0 2px 12px ${event.accentColor}55`,
          }}
        >
          {event.emoji}
        </div>

        {/* Right avatar */}
        <Link
          href={`/profile/${taggedUser.username}`}
          className="relative z-10 block"
          style={{ marginLeft: -16 }}
        >
          <div
            className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg"
            style={{ boxShadow: `0 0 0 3px ${event.accentColor}55, 0 4px 16px ${event.accentColor}30` }}
          >
            <img
              src={taggedUser.profile_img_url || 'https://iili.io/qbtgKBt.png'}
              className="w-full h-full object-cover"
              alt={taggedUser.display_name}
            />
          </div>
        </Link>
      </div>

      {/* Names */}
      <p className="text-center mt-3 font-black text-gray-900 text-base tracking-tight leading-tight">
        <Link href={`/profile/${authorUser.username}`} className="hover:underline">
          {authorUser.display_name}
        </Link>
        {' & '}
        <Link href={`/profile/${taggedUser.username}`} className="hover:underline">
          {taggedUser.display_name}
        </Link>
      </p>

      {/* Card label + value */}
      <p className={`text-center mt-1 text-xs font-bold ${event.color} opacity-80`}>
        {event.cardLabel}
        {value && value !== taggedUser.display_name ? ` · ${value}` : ''}
      </p>
    </div>
  );
}

// ─── Solo Card ────────────────────────────────────────────────────────────────

interface SoloCardProps {
  event: LifeEventDef;
  value: string;
  authorUser: User;
}

function SoloLifeEventCard({ event, value, authorUser }: SoloCardProps) {
  return (
    <div
      className={`relative rounded-3xl overflow-hidden mb-4 bg-gradient-to-br ${event.gradient} border ${event.border} shadow-sm`}
      style={{ padding: '24px 20px 20px' }}
    >
      {/* Decorative blob */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: `radial-gradient(circle at 50% 40%, ${event.accentColor}1a 0%, transparent 70%)`,
        }}
      />

      {/* Big emoji */}
      <div className="relative flex flex-col items-center gap-3">
        <div
          className="flex items-center justify-center rounded-full bg-white shadow-md"
          style={{
            width: 64,
            height: 64,
            fontSize: 32,
            boxShadow: `0 4px 20px ${event.accentColor}40`,
          }}
        >
          {event.emoji}
        </div>

        {/* Label */}
        <div className="text-center">
          <p className={`text-[10px] font-black uppercase tracking-widest ${event.color} opacity-60 mb-0.5`}>
            เหตุการณ์สำคัญ
          </p>
          <p className="font-black text-gray-900 text-base leading-tight">
            {event.cardLabel}
          </p>
          <p className={`text-sm font-bold mt-0.5 ${event.color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Public export: smart switch ──────────────────────────────────────────────

interface LifeEventCardProps {
  raw: string;                     // encoded string from DB
  authorUser: User;
  /** map ของ users ที่โหลดมาแล้ว — ใช้หา taggedUser */
  usersMap?: Record<string, User>;
}

export function LifeEventCard({ raw, authorUser, usersMap = {} }: LifeEventCardProps) {
  const { event, value, taggedUserId } = decodeLifeEvent(raw);
  if (!event) return null;

  if (event.needsTaggedUser && taggedUserId) {
    const taggedUser = usersMap[taggedUserId];
    if (taggedUser) {
      return (
        <DualLifeEventCard
          event={event}
          authorUser={authorUser}
          taggedUser={taggedUser}
          value={value}
        />
      );
    }
  }

  // fallback / solo events
  return <SoloLifeEventCard event={event} value={value} authorUser={authorUser} />;
}

export default LifeEventCard;

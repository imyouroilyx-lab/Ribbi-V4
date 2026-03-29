import { differenceInYears, format, formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

/**
 * คำนวณอายุจากวันเกิด
 */
export function calculateAge(birthday: string | Date): number {
  if (!birthday) return 0;
  const birthDate = typeof birthday === 'string' ? new Date(birthday) : birthday;
  return differenceInYears(new Date(), birthDate);
}

/**
 * แสดงวันที่ในรูปแบบที่อ่านง่าย
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'd MMM yyyy', { locale: th });
}

/**
 * แสดงระยะเวลาที่ผ่านมา (เช่น "2 ชั่วโมงที่แล้ว")
 */
export function formatTimeAgo(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: th });
}

/**
 * แสดงเวลาแบบ Relative - ถ้าเกิน 24 ชั่วโมงแสดงวันที่
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  // น้อยกว่า 1 นาที
  if (diffInSeconds < 60) {
    return 'เมื่อสักครู่';
  }
  
  // น้อยกว่า 1 ชั่วโมง
  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) {
    return `${minutes} นาทีที่แล้ว`;
  }
  
  // น้อยกว่า 24 ชั่วโมง
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ชั่วโมงที่แล้ว`;
  }
  
  // มากกว่า 24 ชั่วโมง - แสดงวันที่
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * ดึง YouTube Video ID จาก URL
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * ตรวจสอบว่า URL รูปภาพถูกต้องหรือไม่
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(urlObj.pathname) || 
           urlObj.hostname.includes('imgur.com') ||
           urlObj.hostname.includes('ibb.co') ||
           urlObj.hostname.includes('imgbb.com');
  } catch {
    return false;
  }
}

/**
 * สร้าง gradient background pattern
 */
export function getBgStyle(style: string, color: string): string {
  switch (style) {
    case 'gradient':
      return `linear-gradient(135deg, ${color}20, ${color}40)`;
    case 'dots':
      return `radial-gradient(circle, ${color}30 1px, transparent 1px)`;
    case 'stripes':
      return `repeating-linear-gradient(45deg, ${color}10, ${color}10 10px, transparent 10px, transparent 20px)`;
    default:
      return color + '10';
  }
}
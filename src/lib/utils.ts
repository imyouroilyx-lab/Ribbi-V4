import { differenceInYears, format, formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

export function calculateAge(birthday: string | Date): number {
  if (!birthday) return 0;
  const birthDate = new Date(birthday);
  if (isNaN(birthDate.getTime())) return 0;
  return differenceInYears(new Date(), birthDate);
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'd MMM yyyy', { locale: th });
}

export function formatTimeAgo(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: th });
}

export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'เมื่อสักครู่';
  
  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * ตรวจสอบความถูกต้องของ URL รูปภาพเบื้องต้น
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // ตรวจสอบนามสกุลไฟล์
    const isImageExt = /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(urlObj.pathname);
    // ตรวจสอบ Host ที่เชื่อถือได้ (เผื่อกรณี URL ไม่มีนามสกุลแต่เป็นรูป)
    const isTrustedHost = /imgbb|ibb\.co|imgur|iili\.io/.test(urlObj.hostname);
    
    return isImageExt || isTrustedHost;
  } catch {
    return false;
  }
}

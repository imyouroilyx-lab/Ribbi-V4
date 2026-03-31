export function isUserOnline(lastActive: string | null) {
  if (!lastActive) return false;

  const last = new Date(lastActive).getTime();
  const now = Date.now();

  return now - last < 30000; // 30 วินาที
}

export function formatLastSeen(lastActive: string | null) {
  if (!lastActive) return 'ไม่เคยออนไลน์';

  const diff = Date.now() - new Date(lastActive).getTime();

  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'ออนไลน์เมื่อสักครู่';

  const min = Math.floor(sec / 60);
  if (min < 60) return `ออนไลน์เมื่อ ${min} นาทีที่แล้ว`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `ออนไลน์เมื่อ ${hr} ชั่วโมงที่แล้ว`;

  const day = Math.floor(hr / 24);
  return `ออนไลน์เมื่อ ${day} วันที่แล้ว`;
}

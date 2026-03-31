export function isUserOnline(lastActive: string | null) {
  if (!lastActive) return false;

  const last = new Date(lastActive).getTime();
  const now = Date.now();

  return now - last < 30000; // 30 วิ
}

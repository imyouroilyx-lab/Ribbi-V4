import { useEffect, useRef } from 'react';

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // สร้าง Audio object เมื่อ component mount
    audioRef.current = new Audio('/sounds/ribbi.wav');
    audioRef.current.volume = 0.5; // ปรับเสียง 50%
  }, []);

  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // รีเซ็ตตำแหน่งเสียง
      audioRef.current.play().catch(err => {
        console.error('Failed to play notification sound:', err);
      });
    }
  };

  return { playSound };
}
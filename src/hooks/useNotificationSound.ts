import { useEffect } from 'react';

// ✅ สร้าง Audio ไว้นอก Hook เพื่อให้เป็นตัวเดียวทั้งแอป (Singleton)
// ช่วยป้องกันการโหลดไฟล์ .wav ซ้ำหลายรอบเมื่อเปลี่ยนหน้า
let globalAudio: HTMLAudioElement | null = null;

export function useNotificationSound() {
  useEffect(() => {
    // ตรวจสอบว่ารันบน Browser และยังไม่มีการสร้าง Audio
    if (typeof window !== 'undefined' && !globalAudio) {
      globalAudio = new Audio('/sounds/ribbi.wav');
      globalAudio.volume = 0.5;
      globalAudio.preload = 'auto'; // ให้โหลดรอไว้เลย
    }
  }, []);

  const playSound = () => {
    if (globalAudio) {
      globalAudio.currentTime = 0; // เริ่มใหม่ทุกครั้งที่เล่น
      globalAudio.play().catch(err => {
        // บราวเซอร์อาจบล็อกถ้าผู้ใช้ยังไม่มีปฏิสัมพันธ์กับหน้าเว็บ
        console.warn('Notification sound play was blocked or failed');
      });
    }
  };

  return { playSound };
}

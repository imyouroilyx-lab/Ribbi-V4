'use client';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase'; 

export default function PresenceHandler({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return;

    // สร้างท่อ Realtime
    const channel = supabase.channel('online-status', {
      config: { presence: { key: userId } },
    });

    // ✅ ฟังก์ชันอัปเดต Last Seen (ยิงแค่ครั้งเดียวตอนเข้าเว็บพอกันตาย)
    const updateLastSeen = async () => {
      await supabase
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId);
    };

    channel
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // ✅ 1. ประกาศตัวว่าออนไลน์ (อันนี้จะลอยอยู่ใน RAM ไม่หนักเครื่อง)
          await channel.track({ 
            user_id: userId, 
            online_at: new Date().toISOString() 
          });

          // ✅ 2. อัปเดต Database แค่ "ครั้งเดียว" ตอนเชื่อมต่อสำเร็จ
          // เพื่อให้รู้ว่าวันนี้เขาแวะมานะ ไม่ต้องยิงทุกครั้งที่ Join/Leave
          updateLastSeen();
        }
      });

    return () => {
      // ✅ 3. ตอนปิดหน้าเว็บให้แค่ยกเลิก Channel 
      // ระบบ Presence จะรู้เองว่าคนนี้หายไป (Offline) โดยไม่ต้องสั่ง Update DB
      channel.unsubscribe();
    };
  }, [userId]);

  return null;
}

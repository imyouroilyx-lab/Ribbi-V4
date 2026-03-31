'use client';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase'; 

export default function PresenceHandler({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-presence-v4', {
      config: { presence: { key: userId } },
    });

    // ✅ สำคัญ: ต้องใส่ .on ก่อน .subscribe เสมอ (ห้ามสลับ!)
    channel
      .on('presence', { event: 'sync' }, () => {
        // Sync สถานะใน RAM
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // แจ้งระบบ Realtime ว่าเราออนไลน์
          await channel.track({ 
            user_id: userId, 
            online_at: new Date().toISOString() 
          });
          
          // ✅ อัปเดต Database แค่ "ครั้งเดียว" ตอนเชื่อมต่อสำเร็จ
          await supabase.from('users').update({ 
            last_seen: new Date().toISOString() 
          }).eq('id', userId);
        }
      });

    return () => {
      void channel.unsubscribe();
    };
  }, [userId]);

  return null;
}

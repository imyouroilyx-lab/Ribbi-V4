'use client';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase'; 

export default function PresenceHandler({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-presence-v4', {
      config: { presence: { key: userId } },
    });

    // ✅ แก้ไขลำดับ: .on('presence') ก่อนเสมอ!
    channel
      .on('presence', { event: 'sync' }, () => {
        // Sync สถานะใน RAM
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // แจ้งระบบว่าเราออนไลน์
          await channel.track({ 
            user_id: userId, 
            online_at: new Date().toISOString() 
          });
          
          // ✅ อัปเดต Database แค่ "ครั้งเดียว"
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

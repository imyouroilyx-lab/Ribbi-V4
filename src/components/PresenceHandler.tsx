'use client';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase'; 

export default function PresenceHandler({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('user-main-presence', {
      config: { presence: { key: userId } },
    });

    // ✅ ลำดับที่ถูกต้อง: .on -> .subscribe
    channel
      .on('presence', { event: 'sync' }, () => {
        // Sync สถานะ
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            user_id: userId, 
            online_at: new Date().toISOString() 
          });
          
          // อัปเดต DB แค่ครั้งเดียวพอ
          await supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', userId);
        }
      });

    return () => { channel.unsubscribe(); };
  }, [userId]);

  return null;
}

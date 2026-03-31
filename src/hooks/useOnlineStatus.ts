'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-status', {
      config: { presence: { key: userId } },
    });

    // ✅ ลำดับต้องเป็นแบบนี้: .on ก่อน แล้วค่อย .subscribe
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const simplifiedState: Record<string, any> = {};
        for (const key in newState) {
          simplifiedState[key] = newState[key][0];
        }
        setOnlineUsers(simplifiedState);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // อัปเดตเมื่อมีคนใหม่เข้ามา
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // อัปเดตเมื่อมีคนออก
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // แจ้งระบบว่าเราออนไลน์ (เก็บใน RAM)
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void channel.unsubscribe();
    };
  }, [userId]);

  return { onlineUsers };
}

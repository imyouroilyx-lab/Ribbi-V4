'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!userId) return;

    // 1. สร้างท่อ
    const channel = supabase.channel('online-status', {
      config: { presence: { key: userId } },
    });

    // ✅ 2. ต้องสั่ง .on('presence') "ก่อน" สั่ง .subscribe เสมอ!
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
        // จัดการตอนคนเข้า
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // จัดการตอนคนออก
      })
      // ✅ 3. สั่ง .subscribe เป็นขั้นตอนสุดท้าย
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
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

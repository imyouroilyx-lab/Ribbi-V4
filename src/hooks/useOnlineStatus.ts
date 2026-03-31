'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-status-v4', {
      config: { presence: { key: userId } },
    });

    // ✅ ขั้นตอนที่ 1: ตั้งค่า Callback ให้เสร็จก่อนเชื่อมต่อ
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const simplified: Record<string, any> = {};
        for (const key in newState) {
          simplified[key] = newState[key][0];
        }
        setOnlineUsers(simplified);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Log ตอนคนเข้าถ้าต้องการ
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // Log ตอนคนออกถ้าต้องการ
      })
      // ✅ ขั้นตอนที่ 2: สั่ง Subscribe หลังจากตั้งค่าเสร็จแล้วเท่านั้น
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

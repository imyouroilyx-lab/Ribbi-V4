'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!userId) return;

    // 1. สร้าง Channel
    const channel = supabase.channel('online-status', {
      config: { presence: { key: userId } },
    });

    // ✅ 2. ต้องสั่ง .on ก่อน .subscribe เสมอ (ห้ามสลับ!)
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const simplifiedState: Record<string, any> = {};
        for (const key in newState) {
          simplifiedState[key] = newState[key][0];
        }
        setOnlineUsers(simplifiedState);
      })
      .on('presence', { event: 'join', key: userId }, ({ newPresences }) => {
        // ทำอะไรสักอย่างตอนคนเข้า
      })
      .on('presence', { event: 'leave', key: userId }, ({ leftPresences }) => {
        // ทำอะไรสักอย่างตอนคนออก
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // แจ้งว่าเราออนไลน์
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  return { onlineUsers };
}

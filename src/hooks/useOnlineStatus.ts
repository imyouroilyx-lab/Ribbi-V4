'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    // 1. เคลียร์ท่อเก่าที่อาจค้างอยู่ในระบบออกให้หมดก่อน
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
    }

    // 2. สร้างท่อโดยใช้ชื่อที่ไม่ซ้ำ (ป้องกันการจำสถานะ Joined ของเก่า)
    const channelName = `online_${userId}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    });

    // ✅ 3. กฎเหล็ก: ต้องใส่ .on ทั้งหมดให้เสร็จ "ก่อน" .subscribe
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const simplified: Record<string, any> = {};
        for (const key in newState) {
          if (newState[key] && newState[key][0]) {
            simplified[key] = newState[key][0];
          }
        }
        setOnlineUsers(simplified);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Join:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Leave:', key, leftPresences);
      });

    // ✅ 4. สั่งเชื่อมต่อเป็นขั้นตอนสุดท้ายของชีวิต
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        const tempChannel = channelRef.current;
        channelRef.current = null;
        void supabase.removeChannel(tempChannel);
      }
    };
  }, [userId]);

  return { onlineUsers };
}

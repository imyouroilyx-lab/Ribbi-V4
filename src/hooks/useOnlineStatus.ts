'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;

    // 1. ฟังก์ชันสร้างการเชื่อมต่อ
    const initPresence = async () => {
      // เคลียร์ของเก่าถ้ามีค้างอยู่
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

      // ✅ สุ่มชื่อท่อใหม่ทุกครั้ง + ใส่ timestamp กันจองชื่อซ้ำ
      const uniqueRoomName = `presence_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const channel = supabase.channel(uniqueRoomName, {
        config: { presence: { key: userId } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const newState = channel.presenceState();
          const simplified: Record<string, any> = {};
          for (const key in newState) {
            if (newState[key]?.[0]) simplified[key] = newState[key][0];
          }
          setOnlineUsers(simplified);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ 
              user_id: userId, 
              online_at: new Date().toISOString() 
            });
          }
        });

      channelRef.current = channel;
    };

    initPresence();

    // 2. Cleanup: ปิดท่อทันทีเมื่อปิดหน้าเว็บหรือ Component หายไป
    return () => {
      if (channelRef.current) {
        const currentChannel = channelRef.current;
        channelRef.current = null;
        supabase.removeChannel(currentChannel);
      }
    };
  }, [userId]);

  return { onlineUsers };
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!userId) return;

    // 1. สร้าง Channel สำหรับสถานะออนไลน์
    const channel = supabase.channel('global-online-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    // 2. ตั้งค่า Listeners
    channel
      .on('presence', { event: 'sync' }, () => {
        // อัปเดต State เมื่อมีใครเข้า/ออก
        setOnlineUsers(channel.presenceState());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 3. ประกาศตัวว่าออนไลน์ (ข้อมูลนี้จะอยู่ใน RAM ของ Supabase ไม่ลง Disk DB)
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      // เมื่อปิดหน้าเว็บหรือ Unmount จะหลุดจากสถานะออนไลน์ทันที
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ฟังก์ชันช่วยเช็คว่า id นี้ออนไลน์ไหม
  const isUserOnline = (targetId: string) => {
    return !!onlineUsers[targetId];
  };

  return { onlineUsers, isUserOnline };
}

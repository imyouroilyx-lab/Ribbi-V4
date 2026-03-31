'use client';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase'; 

export default function PresenceHandler({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-status', {
      config: { presence: { key: userId } },
    });

    const updateLastSeenOnce = async () => {
      await supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', userId);
    };

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // 1. ประกาศตัวใน RAM (ไม่หนักเครื่อง)
        await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        // 2. อัปเดต DB แค่ครั้งเดียวพอ
        updateLastSeenOnce();
      }
    });

    return () => { channel.unsubscribe(); };
  }, [userId]);

  return null;
}

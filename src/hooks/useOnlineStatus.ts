'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId || channelRef.current) return;

    const channel = supabase.channel('online-status-v5', {
      config: { presence: { key: userId } },
    });

    // ✅ บังคับลำดับ: .on ต้องมาก่อน .subscribe เสมอ
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const simplified: Record<string, any> = {};
        for (const key in newState) {
          simplified[key] = newState[key][0];
        }
        setOnlineUsers(simplified);
      })
      .subscribe(async (status) => {
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
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [userId]);

  return { onlineUsers };
}

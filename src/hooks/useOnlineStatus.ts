'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`online-status-${userId}`, {
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
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  return { onlineUsers };
}

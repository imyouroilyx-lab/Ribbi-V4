'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnlineStatus(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;

    const initPresence = async () => {
      if (channelRef.current) await supabase.removeChannel(channelRef.current);

      const uniqueName = `presence_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const channel = supabase.channel(uniqueName, { config: { presence: { key: userId } } });

      channel
        .on('presence', { event: 'sync' }, () => {
          const newState = channel.presenceState();
          const simplified: Record<string, any> = {};
          for (const key in newState) { if (newState[key]?.[0]) simplified[key] = newState[key][0]; }
          setOnlineUsers(simplified);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        });

      channelRef.current = channel;
    };

    initPresence();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [userId]);

  return { onlineUsers };
}

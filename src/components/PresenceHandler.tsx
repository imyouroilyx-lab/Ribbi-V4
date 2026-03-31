'use client';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase'; 

export default function PresenceHandler({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-status', {
      config: { presence: { key: userId } },
    });

    const updateDbStatus = async (online: boolean) => {
      await supabase
        .from('users')
        .update({ is_online: online, last_seen: new Date().toISOString() })
        .eq('id', userId);
    };

    channel
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key === userId) updateDbStatus(true);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === userId) updateDbStatus(false);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
      updateDbStatus(false);
    };
  }, [userId]);

  return null;
}

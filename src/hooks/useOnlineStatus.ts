import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useOnlineStatus(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    // Set online when component mounts
    const setOnline = async () => {
      await supabase
        .from('users')
        .update({ 
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .eq('id', userId);
    };

    // Set offline when component unmounts or page closes
    const setOffline = async () => {
      await supabase
        .from('users')
        .update({ 
          is_online: false,
          last_seen: new Date().toISOString()
        })
        .eq('id', userId);
    };

    setOnline();

    // Update every 30 seconds to show still online
    const interval = setInterval(setOnline, 30000);

    // Cleanup on unmount
    window.addEventListener('beforeunload', setOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', setOffline);
      setOffline();
    };
  }, [userId]);
}
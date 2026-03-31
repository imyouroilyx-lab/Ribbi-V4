'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import PresenceHandler from './PresenceHandler';

export default function PresenceClient() {
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!userId) return null;
  return <PresenceHandler userId={userId} />;
}

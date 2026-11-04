'use client';
import {createContext, useContext, useEffect, useState} from 'react';
import {NavigationSnapshots} from '@/lib/navigation-snapshots';
import {browserClient} from '@/lib/supabase/browser';

const SnapshotContext = createContext<NavigationSnapshots | null>(null);
export function NavigationSnapshotProvider({children}: {children:React.ReactNode}) {
  const [snapshots] = useState(() => new NavigationSnapshots());
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    let previousUser: string | undefined;
    const {data: {subscription}} = browserClient().auth.onAuthStateChange((_event, session) => {
      const user = session?.user.id;
      if (!user || (previousUser && previousUser !== user)) snapshots.clear();
      previousUser = user;
    });
    return () => { subscription.unsubscribe(); snapshots.clear(); };
  }, [snapshots]);
  return <SnapshotContext.Provider value={snapshots}>{children}</SnapshotContext.Provider>;
}
export function useNavigationSnapshots() {
  const snapshots = useContext(SnapshotContext);
  if (!snapshots) throw new Error('NavigationSnapshotProvider is required.');
  return snapshots;
}

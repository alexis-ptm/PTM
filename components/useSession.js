"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Returns undefined while loading, null when signed out, or the session.
export default function useSession() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
}

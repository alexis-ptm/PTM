import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase calls this the "anon" key on older projects and the "publishable" key on newer ones.
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(url && key);

export const supabase = isConfigured ? createClient(url, key) : null;

export function screenshotUrl(path) {
  if (!path || !supabase) return null;
  return supabase.storage.from("screenshots").getPublicUrl(path).data.publicUrl;
}

export async function uploadScreenshot(userId, file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("screenshots").upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export default function SetupNeeded() {
  return (
    <main className="center-page">
      <div className="card narrow">
        <h1>Markup isn&apos;t connected yet</h1>
        <p className="muted">
          The Supabase settings are missing. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code> (on your
          computer) or to the Vercel project&apos;s Environment Variables, then restart or
          redeploy.
        </p>
      </div>
    </main>
  );
}

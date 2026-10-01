"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { isConfigured, supabase, uploadScreenshot } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";
import SetupNeeded from "@/components/SetupNeeded";
import useSession from "@/components/useSession";

export default function Home() {
  if (!isConfigured) return <SetupNeeded />;
  return <HomeInner />;
}

function HomeInner() {
  const session = useSession();
  if (session === undefined) return <main className="center-page muted">Loading…</main>;
  if (!session) return <AuthForm />;
  return <Dashboard user={session.user} />;
}

function normalizeUrl(value) {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function Dashboard({ user }) {
  const [projects, setProjects] = useState([]);
  const [openCounts, setOpenCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const [{ data, error }, { data: open }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("comments").select("project_id").is("parent_id", null).eq("resolved", false),
    ]);
    if (error) setError(error.message);
    else setProjects(data);
    const counts = {};
    for (const c of open || []) counts[c.project_id] = (counts[c.project_id] || 0) + 1;
    setOpenCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(project) {
    if (!confirm(`Delete "${project.name}" and all its comments? This can't be undone.`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) return setError(error.message);
    if (project.screenshot_path)
      await supabase.storage.from("screenshots").remove([project.screenshot_path]);
    load();
  }

  return (
    <main className="page">
      <header className="topbar">
        <strong className="brand">Markup</strong>
        <span className="muted small">{user.email}</span>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <div className="dashboard">
        <NewProject userId={user.id} onCreated={load} />

        <section>
          <h2>Your projects</h2>
          {error && <p className="error">{error}</p>}
          {loading ? (
            <p className="muted">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="muted">No projects yet. Create one to start collecting feedback.</p>
          ) : (
            <ul className="project-list">
              {projects.map((p) => (
                <li key={p.id} className="card project">
                  <div>
                    <Link href={`/p/${p.id}`} className="project-name">
                      {p.name}
                    </Link>
                    <div className="muted small">
                      {p.site_url || "Screenshot"} · {openCounts[p.id] || 0} open
                    </div>
                  </div>
                  <div className="row">
                    <Link className="button" href={`/p/${p.id}`}>
                      Open
                    </Link>
                    <button className="ghost danger" onClick={() => remove(p)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function NewProject({ userId, onCreated }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const row = { name: name.trim() };
      if (kind === "url") {
        row.site_url = normalizeUrl(url);
        if (!row.site_url) throw new Error("Enter a website address.");
      } else {
        if (!file) throw new Error("Choose a screenshot image.");
        row.screenshot_path = await uploadScreenshot(userId, file);
      }
      const { error } = await supabase.from("projects").insert(row);
      if (error) throw error;
      setName("");
      setUrl("");
      setFile(null);
      e.target.reset();
      onCreated();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>New project</h2>
      <label>
        Name
        <input
          required
          maxLength={200}
          placeholder="Acme homepage redesign"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="segmented">
        <button type="button" className={kind === "url" ? "on" : ""} onClick={() => setKind("url")}>
          Website address
        </button>
        <button type="button" className={kind === "image" ? "on" : ""} onClick={() => setKind("image")}>
          Screenshot
        </button>
      </div>
      {kind === "url" ? (
        <label>
          Website address
          <input placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          <span className="muted small">
            Some sites refuse to be shown inside other apps. If the page shows up blank, use a
            screenshot instead.
          </span>
        </label>
      ) : (
        <label>
          Screenshot image (PNG, JPG, WebP or GIF, up to 10 MB)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}

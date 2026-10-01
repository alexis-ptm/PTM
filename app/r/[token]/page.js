"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { isConfigured, screenshotUrl, supabase } from "@/lib/supabase";
import Board from "@/components/Board";
import SetupNeeded from "@/components/SetupNeeded";

const POLL_MS = 15000;
const NAME_KEY = "markup:name";

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

export default function ReviewPage() {
  if (!isConfigured) return <SetupNeeded />;
  return <ClientReview />;
}

function ClientReview() {
  const { token } = useParams();
  const [project, setProject] = useState(undefined);
  const [comments, setComments] = useState([]);
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    setName(readName());
  }, []);

  const loadComments = useCallback(async () => {
    const { data, error } = await supabase.rpc("review_list_comments", { p_token: token });
    if (error) setError(error.message);
    else setComments(data);
  }, [token]);

  useEffect(() => {
    supabase.rpc("review_get_project", { p_token: token }).then(({ data, error }) => {
      if (error) setProject(null);
      else setProject(data?.[0] || null);
    });
    loadComments();
    const t = setInterval(loadComments, POLL_MS);
    return () => clearInterval(t);
  }, [token, loadComments]);

  async function add(args) {
    const { error } = await supabase.rpc("review_add_comment", { p_token: token, p_author_name: name, ...args });
    if (error) {
      setError(error.message);
      return false;
    }
    setError(null);
    await loadComments();
    return true;
  }

  function saveName(e) {
    e.preventDefault();
    const n = nameInput.trim();
    if (!n) return;
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {}
    setName(n);
  }

  if (project === undefined) return <main className="center-page muted">Loading…</main>;
  if (project === null)
    return (
      <main className="center-page">
        <div className="card narrow">
          <h1>Link not found</h1>
          <p className="muted">This review link doesn&apos;t exist or the project was deleted.</p>
        </div>
      </main>
    );

  const nameCard = name ? (
    <div className="card settings small name-card">
      <span>
        Commenting as <strong>{name}</strong>
      </span>
      <button className="link small" onClick={() => setName("")}>
        Change
      </button>
    </div>
  ) : (
    <form className="card settings" onSubmit={saveName}>
      <label className="small">
        Your name (shown next to your comments)
        <input autoFocus maxLength={100} value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
      </label>
      <button className="primary">Start commenting</button>
    </form>
  );

  return (
    <main className="review-page">
      <header className="topbar">
        <strong className="brand">Markup</strong>
        <strong className="title">{project.name}</strong>
      </header>
      {error && <p className="error banner">{error}</p>}
      <Board
        siteUrl={project.site_url}
        imageUrl={project.screenshot_path ? screenshotUrl(project.screenshot_path) : null}
        pageHeight={project.page_height}
        comments={comments}
        canWrite={Boolean(name)}
        isOwner={false}
        onAdd={({ x, y, body }) => add({ p_x: x, p_y: y, p_body: body })}
        onReply={(parentId, body) => add({ p_parent_id: parentId, p_body: body })}
        sidebarTop={nameCard}
      />
    </main>
  );
}

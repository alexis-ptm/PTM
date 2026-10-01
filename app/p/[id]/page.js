"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isConfigured, screenshotUrl, supabase, uploadScreenshot } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";
import Board from "@/components/Board";
import SetupNeeded from "@/components/SetupNeeded";
import useSession from "@/components/useSession";

const POLL_MS = 15000;

export default function ProjectPage() {
  if (!isConfigured) return <SetupNeeded />;
  return <ProjectInner />;
}

function ProjectInner() {
  const session = useSession();
  if (session === undefined) return <main className="center-page muted">Loading…</main>;
  if (!session) return <AuthForm />;
  return <OwnerReview user={session.user} />;
}

function OwnerReview({ user }) {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const loadComments = useCallback(async () => {
    const { data, error } = await supabase.from("comments").select("*").eq("project_id", id);
    if (error) setError(error.message);
    else setComments(data);
  }, [id]);

  const loadProject = useCallback(async () => {
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (error) setError(error.message);
    else if (!data) setNotFound(true);
    else setProject(data);
  }, [id]);

  useEffect(() => {
    loadProject();
    loadComments();
    const t = setInterval(loadComments, POLL_MS);
    return () => clearInterval(t);
  }, [loadProject, loadComments]);

  const authorName = user.email.split("@")[0];

  async function run(promise) {
    const { error } = await promise;
    if (error) {
      setError(error.message);
      return false;
    }
    setError(null);
    await loadComments();
    return true;
  }

  if (notFound)
    return (
      <main className="center-page">
        <div className="card narrow">
          <h1>Project not found</h1>
          <Link href="/">Back to your projects</Link>
        </div>
      </main>
    );
  if (!project) return <main className="center-page muted">Loading…</main>;

  return (
    <main className="review-page">
      <header className="topbar">
        <Link href="/" className="brand">
          ← Markup
        </Link>
        <strong className="title">{project.name}</strong>
        {project.site_url && (
          <a className="muted small" href={project.site_url} target="_blank" rel="noreferrer">
            {project.site_url}
          </a>
        )}
      </header>
      {error && <p className="error banner">{error}</p>}
      <Board
        siteUrl={project.site_url}
        imageUrl={project.screenshot_path ? screenshotUrl(project.screenshot_path) : null}
        pageHeight={project.page_height}
        comments={comments}
        canWrite
        isOwner
        onAdd={({ x, y, body }) =>
          run(
            supabase.from("comments").insert({
              project_id: project.id,
              x_pct: x,
              y_pct: y,
              body,
              author_name: authorName,
              is_owner: true,
            })
          )
        }
        onReply={(parentId, body) =>
          run(
            supabase.from("comments").insert({
              project_id: project.id,
              parent_id: parentId,
              body,
              author_name: authorName,
              is_owner: true,
            })
          )
        }
        onResolve={(c) => run(supabase.from("comments").update({ resolved: !c.resolved }).eq("id", c.id))}
        onDelete={(c) => {
          if (!confirm("Delete this comment" + (c.parent_id ? "?" : " and its replies?"))) return;
          return run(supabase.from("comments").delete().eq("id", c.id));
        }}
        sidebarTop={<ProjectSettings project={project} userId={user.id} onChange={loadProject} />}
      />
    </main>
  );
}

function ProjectSettings({ project, userId, onChange }) {
  const shareUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/r/${project.share_token}`;
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(project.page_height);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this link:", shareUrl);
    }
  }

  async function saveHeight(e) {
    e.preventDefault();
    const { error } = await supabase
      .from("projects")
      .update({ page_height: Number(height) })
      .eq("id", project.id);
    if (error) setError(error.message);
    else onChange();
  }

  async function replaceScreenshot(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const path = await uploadScreenshot(userId, file);
      const { error } = await supabase.from("projects").update({ screenshot_path: path }).eq("id", project.id);
      if (error) throw error;
      if (project.screenshot_path)
        await supabase.storage.from("screenshots").remove([project.screenshot_path]);
      onChange();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
    e.target.value = "";
  }

  return (
    <div className="card settings">
      <div className="small strong">Client review link</div>
      <p className="muted small">Anyone with this link can view this page and leave comments. No account needed.</p>
      <div className="row">
        <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
        <button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>

      <details>
        <summary className="small">Page settings</summary>
        {!project.screenshot_path && (
          <form className="row" onSubmit={saveHeight}>
            <label className="small grow">
              Page height (pixels)
              <input
                type="number"
                min={600}
                max={20000}
                step={100}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </label>
            <button>Save</button>
          </form>
        )}
        <label className="small">
          {project.screenshot_path ? "Replace screenshot" : "Site shows blank? Use a screenshot instead"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={busy}
            onChange={replaceScreenshot}
          />
        </label>
        {project.screenshot_path && project.site_url && (
          <p className="muted small">Existing pins stay where they were placed, so check they still line up.</p>
        )}
        {error && <p className="error small">{error}</p>}
      </details>
    </div>
  );
}

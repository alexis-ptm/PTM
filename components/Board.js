"use client";

import { useMemo, useRef, useState } from "react";

const SITE_WIDTH = 1280;

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The shared review surface used by both the owner page and the client share page.
 *
 * props:
 *  - siteUrl / imageUrl / pageHeight: what to show under the pins
 *  - comments: flat list of pins and replies
 *  - canWrite: whether the viewer may add pins and replies
 *  - isOwner: shows Resolve / Delete controls
 *  - onAdd({ x, y, body }), onReply(parentId, body), onResolve(comment), onDelete(comment)
 *  - sidebarTop: extra content rendered at the top of the sidebar
 */
export default function Board({
  siteUrl,
  imageUrl,
  pageHeight,
  comments,
  canWrite,
  isOwner,
  onAdd,
  onReply,
  onResolve,
  onDelete,
  sidebarTop,
}) {
  const canvasRef = useRef(null);
  const [commentMode, setCommentMode] = useState(true);
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showResolved, setShowResolved] = useState(false);

  const { pins, repliesByParent } = useMemo(() => {
    const top = comments.filter((c) => !c.parent_id);
    top.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const numbered = top.map((c, i) => ({ ...c, number: i + 1 }));
    const replies = {};
    for (const c of comments) {
      if (c.parent_id) (replies[c.parent_id] ||= []).push(c);
    }
    for (const list of Object.values(replies))
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return { pins: numbered, repliesByParent: replies };
  }, [comments]);

  const visiblePins = pins.filter((p) => showResolved || !p.resolved);
  const openCount = pins.filter((p) => !p.resolved).length;

  function handleCanvasClick(e) {
    if (!commentMode || !canWrite) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setSelected(null);
    setDraft({ x: clamp(x), y: clamp(y), body: "" });
  }

  async function saveDraft(e) {
    e.preventDefault();
    if (!draft.body.trim()) return;
    const ok = await onAdd({ x: round(draft.x), y: round(draft.y), body: draft.body.trim() });
    if (ok !== false) setDraft(null);
  }

  function selectPin(id) {
    setSelected(id);
    setDraft(null);
    document.getElementById(`pin-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    document.getElementById(`thread-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="board">
      <div className="stage">
        <div
          ref={canvasRef}
          className={imageUrl ? "canvas canvas-image" : "canvas"}
          style={imageUrl ? undefined : { width: SITE_WIDTH, height: pageHeight }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Page being reviewed" draggable={false} />
          ) : (
            <iframe
              src={siteUrl}
              title="Page being reviewed"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          )}

          <div
            className={commentMode && canWrite ? "overlay active" : "overlay"}
            onClick={handleCanvasClick}
          />

          {visiblePins.map((p) => (
            <button
              key={p.id}
              id={`pin-${p.id}`}
              className={`pin${p.resolved ? " resolved" : ""}${selected === p.id ? " selected" : ""}`}
              style={{ left: `${p.x_pct}%`, top: `${p.y_pct}%` }}
              onClick={(e) => {
                e.stopPropagation();
                selectPin(p.id);
              }}
              title={p.body}
            >
              {p.number}
            </button>
          ))}

          {draft && (
            <>
              <div className="pin draft" style={{ left: `${draft.x}%`, top: `${draft.y}%` }}>
                +
              </div>
              <form
                className={`popover${draft.x > 70 ? " flip" : ""}`}
                style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
                onSubmit={saveDraft}
                onClick={(e) => e.stopPropagation()}
              >
                <textarea
                  autoFocus
                  placeholder="What should change here?"
                  maxLength={5000}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveDraft(e);
                    if (e.key === "Escape") setDraft(null);
                  }}
                />
                <div className="row">
                  <button type="button" className="ghost" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                  <button className="primary">Add comment</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      <aside className="sidebar">
        {sidebarTop}

        <div className="toolbar">
          {canWrite && (
            <button
              className={commentMode ? "primary" : ""}
              onClick={() => {
                setCommentMode(!commentMode);
                setDraft(null);
              }}
              title="When on, clicking the page drops a pin. Turn off to scroll and click the site normally."
            >
              {commentMode ? "Commenting: on" : "Commenting: off"}
            </button>
          )}
          <label className="check">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            Show resolved
          </label>
        </div>

        <p className="muted small">
          {openCount} open · {pins.length - openCount} resolved
          {canWrite && commentMode && " · Click anywhere on the page to add a pin."}
        </p>

        <ul className="threads">
          {visiblePins.map((p) => (
            <Thread
              key={p.id}
              pin={p}
              replies={repliesByParent[p.id] || []}
              selected={selected === p.id}
              onSelect={() => selectPin(p.id)}
              canWrite={canWrite}
              isOwner={isOwner}
              onReply={onReply}
              onResolve={onResolve}
              onDelete={onDelete}
            />
          ))}
          {visiblePins.length === 0 && <li className="muted small">No comments to show.</li>}
        </ul>
      </aside>
    </div>
  );
}

function Thread({ pin, replies, selected, onSelect, canWrite, isOwner, onReply, onResolve, onDelete }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    const ok = await onReply(pin.id, reply.trim());
    if (ok !== false) setReply("");
    setBusy(false);
  }

  return (
    <li id={`thread-${pin.id}`} className={`thread card${selected ? " selected" : ""}${pin.resolved ? " resolved" : ""}`}>
      <div className="thread-head" onClick={onSelect}>
        <span className={`badge${pin.resolved ? " resolved" : ""}`}>{pin.number}</span>
        <Meta c={pin} />
      </div>
      <p className="body">{pin.body}</p>

      {replies.map((r) => (
        <div key={r.id} className="reply">
          <Meta c={r} />
          <p className="body">{r.body}</p>
          {isOwner && (
            <button className="link danger small" onClick={() => onDelete(r)}>
              Delete
            </button>
          )}
        </div>
      ))}

      {canWrite && (
        <form className="reply-form" onSubmit={sendReply}>
          <input
            placeholder="Reply…"
            maxLength={5000}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <button disabled={busy || !reply.trim()}>Send</button>
        </form>
      )}

      {isOwner && (
        <div className="row">
          <button className="ghost" onClick={() => onResolve(pin)}>
            {pin.resolved ? "Reopen" : "Resolve"}
          </button>
          <button className="ghost danger" onClick={() => onDelete(pin)}>
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

function Meta({ c }) {
  return (
    <span className="meta">
      <strong>{c.author_name}</strong>
      {c.is_owner && <span className="tag">Team</span>}
      <span className="muted small">{timeAgo(c.created_at)}</span>
    </span>
  );
}

function clamp(n) {
  return Math.min(100, Math.max(0, n));
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

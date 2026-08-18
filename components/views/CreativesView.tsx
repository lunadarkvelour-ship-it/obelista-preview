"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Upload,
  UploadCloud,
  Film,
  Image as ImageIcon,
  ChevronRight,
  X,
  Tag,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Ban,
  CircleDot,
  Folder,
  FolderOpen,
  MoreVertical,
  Filter,
  Plus,
} from "lucide-react";
import { CREATIVES, money, num, whenShort } from "@/lib/mock";
import type { Creative, CreativeStatus } from "@/lib/types";
import { StatusPill, StatusPillForCreative } from "@/components/StatusPill";

/* ─────────────────────────────────────────────────────────────────────
 * CreativesView — file manager: folders по geo, grid крео, drop zone
 *
 * Layout:
 *   Sidebar (240px) — папки с counter
 *   Main — breadcrumbs + grid 4×N
 *   Drop zone (hidden by default, slide-down on +Upload)
 * ───────────────────────────────────────────────────────────────────── */

const FOLDERS = [
  { key: "all",      label: "All",            filter: () => true },
  { key: "DZ",       label: "DZ",             filter: (c: Creative) => c.geo === "DZ" && c.status !== "rejected" && c.status !== "personal" },
  { key: "BD",       label: "BD",             filter: (c: Creative) => c.geo === "BD" && c.status !== "rejected" && c.status !== "personal" },
  { key: "BR",       label: "BR",             filter: (c: Creative) => c.geo === "BR" && c.status !== "rejected" && c.status !== "personal" },
  { key: "OTHER",    label: "Other",          filter: (c: Creative) => c.geo === "OTHER" && c.status !== "rejected" && c.status !== "personal" },
  { key: "rejected", label: "Rejected",       filter: (c: Creative) => c.status === "rejected" },
  { key: "pending",  label: "Uploading",      filter: (c: Creative) => c.status === "pending" },
  { key: "personal", label: "Personal",       filter: (c: Creative) => c.status === "personal" },
] as const;

const STATUS_GEO_TINT: Record<string, string> = {
  DZ: "var(--color-geo-dz)",
  BD: "var(--color-geo-bd)",
  BR: "var(--color-geo-br)",
  OTHER: "var(--color-geo-other)",
};

export function CreativesView() {
  const [folder, setFolder] = useState<typeof FOLDERS[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; progress: number }[]>([]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    FOLDERS.forEach((f) => (m[f.key] = CREATIVES.filter(f.filter).length));
    return m;
  }, []);

  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const folderFilter = FOLDERS.find((f) => f.key === folder)?.filter ?? (() => true);
    return CREATIVES.filter((c) => {
      if (!folderFilter(c)) return false;
      if (ql && !c.name.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [folder, q]);

  const totalSpend = visible.reduce((s, c) => s + c.spend_total, 0);

  const fakeUpload = (name: string) => {
    setUploads((u) => [...u, { name, progress: 0 }]);
    setDropOpen(true);
    let p = 0;
    const tick = setInterval(() => {
      p += Math.random() * 12 + 4;
      if (p >= 100) {
        p = 100;
        clearInterval(tick);
        setTimeout(() => setUploads((u) => u.filter((x) => x.name !== name)), 1500);
      }
      setUploads((u) => u.map((x) => (x.name === name ? { ...x, progress: Math.min(100, p) } : x)));
    }, 320);
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Left rail: folders */}
      <aside
        style={{
          width: 240,
          borderRight: "1px solid var(--color-line)",
          background: "var(--color-surface)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "20px 16px 12px",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-ink-faint)",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          Folders
        </div>
        <div style={{ padding: "0 8px", flex: 1, overflowY: "auto" }}>
          {FOLDERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFolder(f.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 10px",
                border: 0,
                background: folder === f.key ? "var(--color-surface-subtle)" : "transparent",
                color: folder === f.key ? "var(--color-ink)" : "var(--color-ink-muted)",
                fontSize: 13,
                fontWeight: folder === f.key ? 600 : 500,
                borderRadius: 6,
                cursor: "pointer",
                textAlign: "left",
                transition: "background-color 200ms ease, color 200ms ease",
              }}
              onMouseEnter={(e) => {
                if (folder !== f.key) e.currentTarget.style.background = "var(--color-surface-subtle)";
              }}
              onMouseLeave={(e) => {
                if (folder !== f.key) e.currentTarget.style.background = "transparent";
              }}
            >
              {folder === f.key ? <FolderOpen size={14} strokeWidth={2} /> : <Folder size={14} strokeWidth={2} />}
              <span style={{ flex: 1 }}>{f.label}</span>
              <span className="num" style={{ fontSize: 11, color: "var(--color-ink-faint)" }}>
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div
          style={{
            borderTop: "1px solid var(--color-line)",
            padding: 12,
            fontSize: 11,
            color: "var(--color-ink-faint)",
            lineHeight: 1.4,
          }}
        >
          Renamed on import: <span className="mono">GEO_TYPE_SEQ_DATE</span>{" "}
          (e.g. DZ_VID_014_0708).
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <header
          style={{
            padding: "20px 28px 14px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid var(--color-line)",
            background: "var(--color-surface)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-ink)", letterSpacing: -0.2 }}>
              Creatives
            </h1>
            <Breadcrumbs folder={folder} />
          </div>
          <div style={{ position: "relative", width: 280 }}>
            <Search
              size={14}
              strokeWidth={2}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-ink-faint)",
              }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name…"
              style={{
                width: "100%",
                height: 32,
                padding: "0 12px 0 32px",
                borderRadius: 8,
                border: "1px solid var(--color-line)",
                background: "var(--color-surface)",
                color: "var(--color-ink)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
          <button className="toolbar-btn primary" onClick={() => setDropOpen((v) => !v)}>
            <Plus size={14} strokeWidth={2.5} />
            Upload
          </button>
        </header>

        {/* Drop zone */}
        <div className={`dropzone ${dropOpen ? "open" : ""}`}>
          <Dropzone
            onFile={(name) => fakeUpload(name)}
            uploads={uploads}
            onClose={() => setDropOpen(false)}
          />
        </div>

        {/* Toolbar row */}
        <div
          style={{
            padding: "12px 28px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 12,
            color: "var(--color-ink-muted)",
            borderBottom: "1px solid var(--color-line-soft)",
            background: "var(--color-surface-subtle)",
          }}
        >
          <span>
            <span className="num">{visible.length}</span> {visible.length === 1 ? "creative" : "creatives"} ·{" "}
            <span className="num">{money(totalSpend)}</span> lifetime
          </span>
          <span style={{ flex: 1 }} />
          <span>Sort: most used</span>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 28, background: "var(--color-surface-subtle)" }}>
          {visible.length === 0 ? (
            <EmptyState folder={folder} onUpload={() => setDropOpen(true)} />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              {visible.map((c) => (
                <CreativeCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function Breadcrumbs({ folder }: { folder: string }) {
  const f = FOLDERS.find((x) => x.key === folder);
  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--color-ink-faint)",
        marginTop: 4,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span>Creatives</span>
      <ChevronRight size={12} strokeWidth={2} />
      <span style={{ color: "var(--color-ink)" }}>{f?.label ?? "All"}</span>
    </div>
  );
}

function CreativeCard({ c }: { c: Creative }) {
  const tint = STATUS_GEO_TINT[c.geo] ?? STATUS_GEO_TINT.OTHER;
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        overflow: "hidden",
        transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 6px 18px rgba(17,24,39,0.08)";
        e.currentTarget.style.borderColor = "var(--color-ink-faint)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--color-line)";
      }}
    >
      {/* Preview */}
      <div
        className={c.size === "9:16" ? "preview-9x16" : c.size === "4:5" ? "preview-4x5" : "preview-1x1"}
        style={{
          background: `linear-gradient(135deg, ${tint}55, ${tint}22)`,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {c.type === "video" ? (
          <Film size={28} strokeWidth={1.5} style={{ color: tint, opacity: 0.6 }} />
        ) : (
          <ImageIcon size={28} strokeWidth={1.5} style={{ color: tint, opacity: 0.6 }} />
        )}
        <span
          className="mono"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            fontSize: 10,
            fontWeight: 600,
            color: "#fff",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {c.geo}
        </span>
        {c.status === "pending" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UploadCloud size={24} color="#fff" />
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: "10px 12px 12px" }}>
        <div
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {c.name}
        </div>
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <StatusPillForCreative status={c.status} progress={c.upload_progress} />
        </div>
        {c.status === "pending" && c.upload_progress != null && (
          <div
            style={{
              marginTop: 8,
              height: 4,
              borderRadius: 2,
              background: "var(--color-surface-sunken)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${c.upload_progress}%`,
                height: "100%",
                background: "var(--color-warn)",
                transition: "width 320ms ease",
              }}
            />
          </div>
        )}
        {c.status === "rejected" && c.rejection_reason && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#7f1d1d",
              background: "var(--color-bad-soft)",
              padding: 8,
              borderRadius: 6,
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              Rejected on {c.rejected_on_cab}
            </div>
            <div>{c.rejection_reason}</div>
          </div>
        )}
        {c.cabs_count > 0 && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--color-ink-muted)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span className="num">{c.cabs_count}</span> cab{c.cabs_count === 1 ? "" : "s"}
            <span>·</span>
            <span className="num">{money(c.spend_total)}</span>
          </div>
        )}
        {c.status === "new" && c.cabs_count === 0 && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--color-ink-muted)",
            }}
          >
            Not uploaded yet — pick a cab from the prompt.
          </div>
        )}
      </div>
    </div>
  );
}

function Dropzone({
  onFile,
  uploads,
  onClose,
}: {
  onFile: (name: string) => void;
  uploads: { name: string; progress: number }[];
  onClose: () => void;
}) {
  return (
    <div
      style={{
        border: "1.5px dashed var(--color-line)",
        borderRadius: 12,
        background: "var(--color-surface)",
        padding: 20,
        margin: "12px 28px 0",
        position: "relative",
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close dropzone"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 28,
          height: 28,
          borderRadius: 6,
          border: "1px solid var(--color-line)",
          background: "var(--color-surface)",
          color: "var(--color-ink-muted)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={14} strokeWidth={2} />
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: "var(--color-brand-100)",
            color: "var(--color-brand-700)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <UploadCloud size={24} strokeWidth={1.5} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
            Drop videos or images here, or click to choose
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-muted)", marginTop: 2 }}>
            MP4, MOV, PNG, JPG, WebP. Up to 100 MB per file.{" "}
            <span className="mono">Auto-renamed: GEO_TYPE_SEQ_DATE</span> (e.g. DZ_VID_014_0708). Cached creatives re-upload instantly — only the bytes Meta has not seen yet go through the browser.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <button className="toolbar-btn primary" onClick={() => onFile(`DZ_VID_${Math.floor(Math.random() * 900) + 100}_${(new Date().getMonth() + 1).toString().padStart(2, "0")}${new Date().getDate().toString().padStart(2, "0")}`)}>
            <Upload size={14} strokeWidth={2} />
            Choose files
          </button>
        </div>
      </div>
      {uploads.length > 0 && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--color-line-soft)", paddingTop: 12 }}>
          {uploads.map((u) => (
            <div
              key={u.name}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "6px 0",
                fontSize: 12,
              }}
            >
              <div>
                <div className="mono" style={{ color: "var(--color-ink)" }}>{u.name}</div>
                <div
                  style={{
                    marginTop: 4,
                    height: 3,
                    borderRadius: 2,
                    background: "var(--color-surface-sunken)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${u.progress}%`,
                      height: "100%",
                      background: u.progress < 100 ? "var(--color-warn)" : "var(--color-ok)",
                      transition: "width 320ms ease",
                    }}
                  />
                </div>
              </div>
              <span className="num" style={{ color: "var(--color-ink-muted)" }}>
                {u.progress < 100 ? `${Math.round(u.progress)}%` : "done"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ folder, onUpload }: { folder: string; onUpload: () => void }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: "60px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 16px",
          borderRadius: 14,
          background: "var(--color-surface-sunken)",
          color: "var(--color-ink-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Folder size={28} strokeWidth={1.5} />
      </div>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)", marginBottom: 6 }}>
        No creatives in this folder yet
      </h2>
      <p style={{ fontSize: 13, color: "var(--color-ink-muted)", maxWidth: 360, margin: "0 auto 16px" }}>
        Creatives are renamed on import to <span className="mono">GEO_TYPE_SEQ_DATE</span> and stored locally. They go to cabs only when you build a prompt.
      </p>
      <button className="toolbar-btn primary" onClick={onUpload}>
        <Upload size={14} strokeWidth={2.5} />
        Upload
      </button>
    </div>
  );
}

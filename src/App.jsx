import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Users, MessageCircle, Globe2, Send, Sparkles, Plus, RefreshCcw,
  X, Trash2, ChevronLeft, Loader2, Heart, Lock, Zap, Pencil,
  Image as ImageIcon, Upload, Film, Network, Copy, UserCircle, Check, Bell
} from "lucide-react";

/* ============================================================
   másvilág — AI social media szerepjáték
   Egyfájlos prototípus: egyszemélyes játék, felhőben tárolt világokkal
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

.mv, .mv * { box-sizing: border-box; }
.mv {
  --ink:#0A0910; --surface:#141220; --raised:#1E1A2C; --line:#2C2740;
  --oxblood:#8A1D3B; --gold:#C8A45C; --rose:#D9758F; --steel:#5B7A99;
  --bone:#ECE4DA; --muted:#8C84A0;
  position:fixed; inset:0; display:flex; flex-direction:column;
  background:
    radial-gradient(120% 60% at 50% -10%, rgba(138,29,59,.22), transparent 60%),
    radial-gradient(90% 50% at 100% 100%, rgba(91,122,153,.12), transparent 70%),
    var(--ink);
  color:var(--bone); font-family:Inter, system-ui, sans-serif; font-size:15px; line-height:1.5;
}
.mv-wrap { width:100%; max-width:560px; margin:0 auto; flex:1; display:flex; flex-direction:column; min-height:0; }
.mv-main { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:0 14px 90px; }
.mv-main::-webkit-scrollbar { width:6px; }
.mv-main::-webkit-scrollbar-thumb { background:var(--line); border-radius:99px; }

.mv h1,.mv h2,.mv h3 { font-family:Fraunces, Georgia, serif; font-weight:700; margin:0; letter-spacing:-.01em; }
.mono { font-family:'JetBrains Mono', ui-monospace, monospace; }

/* fejléc */
.hdr { padding:14px 14px 8px; border-bottom:1px solid var(--line); background:rgba(10,9,16,.86); backdrop-filter:blur(8px); }
.hdr-row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.mark { font-family:Fraunces, Georgia, serif; font-size:24px; font-weight:700; letter-spacing:-.02em; }
.mark i { font-style:normal; color:var(--rose); }
.hdr-meta { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.14em; }

/* élő sáv */
.ticker { margin-top:10px; display:flex; align-items:center; gap:8px; overflow:hidden;
  border:1px solid var(--line); border-radius:99px; padding:5px 10px; background:var(--surface); }
.ticker-tag { font-size:9.5px; letter-spacing:.18em; color:var(--rose); flex:none; display:flex; align-items:center; gap:4px; }
.dot { width:5px; height:5px; border-radius:99px; background:var(--rose); animation:pulse 1.8s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.25} }
.ticker-track { flex:1; overflow:hidden; white-space:nowrap; mask-image:linear-gradient(90deg,transparent,#000 8%,#000 88%,transparent); }
.ticker-track > span { display:inline-block; padding-left:100%; font-size:11.5px; color:var(--muted); animation:slide 34s linear infinite; }
@keyframes slide { to { transform:translateX(-100%) } }
@media (prefers-reduced-motion:reduce){ .ticker-track > span { animation:none; padding-left:0 } .dot{animation:none} }

/* kártyák */
.card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:14px; margin-top:12px; }
.card.flat { background:transparent; }
.row { display:flex; gap:10px; }
.between { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.av { width:38px; height:38px; border-radius:12px; flex:none; display:grid; place-items:center;
  font-family:Fraunces,serif; font-size:16px; color:#0A0910; overflow:hidden; }
.av img { width:100%; height:100%; object-fit:cover; }
.av.sm { width:28px; height:28px; border-radius:9px; font-size:12px; }
.name { font-weight:600; font-size:14.5px; }
.handle { font-size:11.5px; color:var(--muted); }
.body { margin-top:9px; font-size:14.5px; white-space:pre-wrap; word-break:break-word; }

/* kommentek */
.cmts { margin-top:12px; border-top:1px solid var(--line); padding-top:10px; display:flex; flex-direction:column; gap:10px; }
.cmt { display:flex; gap:8px; }
.cmt-body { font-size:13.5px; color:#DCD5CB; }
.cmt-name { font-size:12px; font-weight:600; }

/* gombok */
.btn { border:1px solid var(--line); background:var(--raised); color:var(--bone); font-family:inherit; font-size:13px;
  padding:9px 14px; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:.15s; }
.btn:hover:not(:disabled) { border-color:var(--rose); }
.btn:disabled { opacity:.45; cursor:not-allowed; }
.btn.primary { background:var(--oxblood); border-color:var(--oxblood); font-weight:600; }
.btn.primary:hover:not(:disabled) { background:#A02347; }
.btn.ghost { background:transparent; }
.btn.tiny { padding:5px 10px; font-size:11.5px; border-radius:8px; }
.btn.full { width:100%; justify-content:center; }
.btn:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline:2px solid var(--rose); outline-offset:2px; }

/* űrlapok */
label.f { display:block; font-size:10.5px; letter-spacing:.13em; text-transform:uppercase; color:var(--muted); margin:12px 0 5px; }
input.i, textarea.i, select.i { width:100%; background:var(--ink); border:1px solid var(--line); color:var(--bone);
  border-radius:10px; padding:10px 12px; font-family:inherit; font-size:14px; }
textarea.i { resize:vertical; min-height:70px; line-height:1.45; }
input.i::placeholder, textarea.i::placeholder { color:#5D5772; }

/* kapcsolat-sáv */
.bar { position:relative; height:5px; border-radius:99px; background:var(--raised); overflow:hidden; }
.bar-mid { position:absolute; left:50%; top:0; bottom:0; width:1px; background:var(--line); }
.bar-fill { position:absolute; top:0; bottom:0; border-radius:99px; }
.relnum { font-size:11.5px; }

/* alsó menü */
.nav { position:absolute; left:0; right:0; bottom:0; border-top:1px solid var(--line);
  background:rgba(10,9,16,.94); backdrop-filter:blur(10px); display:flex; }
.nav-in { width:100%; max-width:560px; margin:0 auto; display:flex; }
.nav button { flex:1; background:none; border:none; color:var(--muted); padding:10px 0 14px; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; gap:4px; font-family:inherit; font-size:10px; letter-spacing:.06em; }
.nav button.on { color:var(--rose); }

/* chat */
.bub { max-width:82%; padding:9px 12px; border-radius:14px; font-size:14px; white-space:pre-wrap; }
.bub.me { margin-left:auto; background:var(--oxblood); border-bottom-right-radius:4px; }
.bub.them { background:var(--raised); border:1px solid var(--line); border-bottom-left-radius:4px; }
/* Messenger / Instagram-szerű typing indicator */
.typing-row {
  display:flex;
  align-items:center;
  gap:7px;
  min-height:34px;
}

.typing-bub {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:4px;
  min-width:48px;
  height:34px;
  padding:0 12px;
}

.typing-dot {
  width:6px;
  height:6px;
  border-radius:50%;
  background:var(--muted);
  animation:typingBounce 1.15s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay:.15s;
}

.typing-dot:nth-child(3) {
  animation-delay:.30s;
}

@keyframes typingBounce {
  0%, 60%, 100% {
    transform:translateY(0);
    opacity:.35;
  }

  30% {
    transform:translateY(-4px);
    opacity:1;
  }
}

@media (prefers-reduced-motion:reduce) {
  .typing-dot {
    animation:none;
    opacity:.7;
  }
}
/* jelenet */
.scene-hd { position:sticky; top:0; z-index:5; background:var(--ink); padding:10px 0; }
.narr { font-family:Fraunces, Georgia, serif; font-style:italic; color:var(--muted); text-align:center;
  font-size:13.5px; margin:16px 10px; line-height:1.6; }
.turn { display:flex; gap:9px; margin-top:14px; }
.turn-name { font-size:11.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--gold); margin-bottom:2px; }
.turn-act { font-style:italic; color:#C4BCD2; }

/* modal */
.scrim { position:absolute; inset:0; background:rgba(5,4,9,.72); backdrop-filter:blur(3px); z-index:40; display:flex; align-items:flex-end; }
.sheet { width:100%; max-width:560px; margin:0 auto; max-height:92%; overflow-y:auto; background:var(--surface);
  border:1px solid var(--line); border-bottom:none; border-radius:18px 18px 0 0; padding:16px 16px 28px; }
.sheet::-webkit-scrollbar { width:6px } .sheet::-webkit-scrollbar-thumb { background:var(--line); border-radius:99px }

.toast { position:fixed; left:50%; transform:translateX(-50%); top:14px; z-index:60; width:calc(100% - 28px); max-width:520px;
  border:1px solid var(--oxblood); background:#2B1020; border-radius:12px; padding:11px 14px; font-size:13.5px;
  box-shadow:0 12px 34px rgba(0,0,0,.55); display:flex; gap:10px; align-items:flex-start; }
.toast button { background:none; border:none; color:var(--muted); cursor:pointer; padding:0; margin-left:auto; }
/* jegyzetek */
.notes { display:flex; gap:14px; overflow-x:auto; padding:4px 2px 10px; }
.notes::-webkit-scrollbar { height:4px } .notes::-webkit-scrollbar-thumb { background:var(--line); border-radius:99px }
.note-item { flex:none; width:78px; display:flex; flex-direction:column; align-items:center; cursor:pointer; }
.bubble { position:relative; background:var(--raised); border:1px solid var(--line); border-radius:14px;
  padding:7px 9px; font-size:11px; line-height:1.35; color:var(--bone); width:78px; min-height:40px;
  display:flex; align-items:center; justify-content:center; text-align:center; word-break:break-word; }
.bubble:after, .bubble:before { content:""; position:absolute; left:14px; border-radius:99px; background:var(--raised);
  border:1px solid var(--line); }
.bubble:after { bottom:-7px; width:7px; height:7px; }
.bubble:before { bottom:-13px; width:4px; height:4px; }
.bubble.mine { background:#2A1420; border-color:var(--oxblood); }
.bubble.mine:after, .bubble.mine:before { background:#2A1420; border-color:var(--oxblood); }
.bubble.empty { color:var(--muted); font-style:italic; border-style:dashed; }
.note-who { font-size:10px; color:var(--muted); margin-top:5px; max-width:78px; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; text-align:center; }
.quote { border-left:2px solid var(--rose); padding:5px 9px; background:var(--raised); border-radius:0 8px 8px 0;
  font-size:12px; color:var(--muted); margin-bottom:6px; }

.note-strip { display:flex; gap:14px; overflow-x:auto; padding:16px 2px 4px; scrollbar-width:none; }
.note-strip::-webkit-scrollbar { display:none; }
.note-item { flex:none; width:76px; background:none; border:none; padding:0; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; gap:6px; font-family:inherit; color:var(--bone); }
.note-bub { position:relative; background:var(--raised); border:1px solid var(--line); border-radius:14px;
  padding:7px 9px; font-size:11px; line-height:1.35; width:100%; min-height:38px; text-align:center;
  display:flex; align-items:center; justify-content:center; }
.note-bub:after { content:""; position:absolute; bottom:-5px; left:50%; width:8px; height:8px;
  background:var(--raised); border-right:1px solid var(--line); border-bottom:1px solid var(--line);
  transform:translateX(-50%) rotate(45deg); }
.note-empty { color:var(--muted); font-style:italic; }
.note-react { position:absolute; top:-9px; right:-6px; background:var(--ink); border:1px solid var(--line);
  border-radius:99px; padding:1px 5px; font-size:10px; }
.note-nm { font-size:10px; color:var(--muted); max-width:76px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.flash { position:fixed; left:50%; transform:translateX(-50%); top:14px; z-index:60; width:calc(100% - 28px); max-width:520px;
  border:1px solid var(--gold); background:#22190E; border-radius:12px; padding:11px 14px; font-size:13.5px;
  box-shadow:0 12px 34px rgba(0,0,0,.55); display:flex; gap:10px; align-items:flex-start; cursor:pointer; }
.badge { position:absolute; top:-4px; right:-4px; min-width:15px; height:15px; padding:0 4px; border-radius:99px;
  background:var(--rose); color:#0A0910; font-size:9.5px; font-weight:700; display:grid; place-items:center; }
.note-row { display:flex; gap:10px; align-items:flex-start; padding:10px 0; border-bottom:1px solid var(--line); cursor:pointer; }
.note-row:last-child { border-bottom:none; }
.note-ico { font-size:16px; line-height:1.2; }
.note-new { color:var(--rose); }

.flash { position:fixed; left:50%; transform:translateX(-50%); top:14px; z-index:60; width:calc(100% - 28px); max-width:520px;
  border:1px solid var(--gold); background:#22190E; border-radius:12px; padding:11px 14px; font-size:13.5px;
  box-shadow:0 12px 34px rgba(0,0,0,.55); display:flex; gap:10px; align-items:flex-start; cursor:pointer; }
.badge { position:absolute; top:-4px; right:-4px; min-width:15px; height:15px; padding:0 4px; border-radius:99px;
  background:var(--rose); color:#0A0910; font-size:9.5px; font-weight:700; display:grid; place-items:center; }
.note-row { display:flex; gap:10px; align-items:flex-start; padding:10px 0; border-bottom:1px solid var(--line); cursor:pointer; }
.note-row:last-child { border-bottom:none; }
.note-ico { font-size:16px; line-height:1.2; }
.note-new { color:var(--rose); }

.rest { position:fixed; left:50%; transform:translateX(-50%); top:14px; z-index:61; width:calc(100% - 28px); max-width:520px;
  border:1px solid var(--gold); background:#22190E; border-radius:12px; padding:11px 14px; font-size:13.5px;
  box-shadow:0 12px 34px rgba(0,0,0,.55); display:flex; gap:10px; align-items:center; }

.thinking { display:flex; align-items:center; justify-content:center; gap:8px; color:var(--muted); font-size:12.5px;
  font-family:Fraunces, Georgia, serif; font-style:italic; margin:16px 0; }

.chip { font-size:10.5px; padding:3px 8px; border-radius:99px; border:1px solid var(--line); color:var(--muted); }
.err { border:1px solid var(--oxblood); background:rgba(138,29,59,.15); border-radius:10px; padding:9px 12px; font-size:13px; margin-top:12px; }
.hint { font-size:12px; color:var(--muted); }
.sep { height:1px; background:var(--line); margin:16px 0; }
.spin { animation:spin 1s linear infinite }
@keyframes spin {
  to { transform:rotate(360deg) }
}


/* ---------- MOBILOS ACTION GOMBOK ---------- */

@media (max-width: 768px) {

  .mobile-action-bar {
    position: sticky;
    bottom: 0;
    z-index: 1000;

    display: flex;
    gap: 10px;

    width: 100%;
    box-sizing: border-box;

    padding: 10px 12px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));

    background: rgba(10, 9, 16, 0.96);

    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);

    border-top: 1px solid var(--line);
  }

  .mobile-action-bar .btn {
    flex: 1;

    min-height: 48px;
    height: auto;

    padding: 12px 14px;

    display: flex;
    align-items: center;
    justify-content: center;

    font-size: 15px;
    font-weight: 700;

    white-space: nowrap;
    touch-action: manipulation;
  }
/* ---------- ROLE PLAY MOBIL ---------- */

.scene-create-scrim {
  position: fixed !important;

  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 72px !important;

  width: 100% !important;
  height: auto !important;

  z-index: 50 !important;

  display: block !important;

  padding: 0 !important;
  margin: 0 !important;

  overflow: hidden !important;

  background: var(--ink) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.scene-create-sheet {
  position: relative !important;

  display: block !important;

  width: 100% !important;
  max-width: none !important;

  height: 100% !important;
  max-height: none !important;

  margin: 0 !important;

  padding: 18px 16px 100px !important;
  padding-top: max(18px, env(safe-area-inset-top)) !important;

  box-sizing: border-box !important;

  overflow-y: auto !important;
  overflow-x: hidden !important;

  border: none !important;
  border-radius: 0 !important;

  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.scene-create-sheet .between {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;

  width: 100% !important;
}

.scene-create-sheet label.f {
  display: block !important;

  width: 100% !important;

  margin-top: 18px !important;
  margin-bottom: 6px !important;
}

.scene-create-sheet .i {
  display: block !important;

  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;

  box-sizing: border-box !important;
}

.scene-create-sheet textarea.i {
  min-height: 110px !important;
}

.scene-create-sheet .row {
  display: flex !important;

  flex-direction: row !important;
  flex-wrap: wrap !important;

  width: 100% !important;

  gap: 8px !important;
}

.scene-create-sheet .row .btn {
  flex: 0 0 auto !important;

  width: auto !important;
  min-width: 0 !important;
  max-width: 100% !important;

  min-height: 42px !important;

  white-space: normal !important;
  word-break: normal !important;
}

.scene-create-sheet > .btn.full {
  display: flex !important;

  width: 100% !important;
  min-height: 48px !important;
}

.scene-create-sheet .mobile-action-bar {
  position: sticky !important;

  left: 0 !important;
  right: 0 !important;
  bottom: -100px !important;

  z-index: 100 !important;

  width: calc(100% + 32px) !important;

  margin-left: -16px !important;
  margin-right: -16px !important;
  margin-top: 20px !important;

  padding: 10px 16px !important;
  padding-bottom: calc(12px + env(safe-area-inset-bottom)) !important;

  box-sizing: border-box !important;

  background: var(--ink) !important;

  border-top: 1px solid var(--line);
}
}
`;



/* Amíg bármilyen szerkesztő ablak nyitva van, a háttérben futó mentés nem
   cseréli le az állapotot — így nem ugrik el, amin épp dolgozol. */
const EditLock = { n: 0 };
function useEditLock() {
  useEffect(() => {
    EditLock.n++;
    return () => { EditLock.n = Math.max(0, EditLock.n - 1); };
  }, []);
}

/* ---------- segédek ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => Date.now();
const clamp = (n) => Math.max(-100, Math.min(100, Math.round(n)));

function hue(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}
const avStyle = (s) => ({ background: `linear-gradient(140deg, hsl(${hue(s)} 45% 62%), hsl(${(hue(s) + 40) % 360} 40% 42%))` });

/* ---------- képek ---------- */
const MediaCtx = React.createContext({ media: {}, addImage: () => null, mediaErr: "" });
const useMedia = () => React.useContext(MediaCtx);
const imageRef = (id) => (id ? `img:${id}` : "");
const imageIdOf = (value) => {
  const v = String(value || "").trim();
  return v.startsWith("img:") ? v.slice(4) : "";
};
const isInlineImageData = (value) => /^data:image\//i.test(String(value || "").trim());
const isBlobImageUrl = (value) => /^blob:/i.test(String(value || "").trim());
const normalizeMediaEntry = (id, entry) => {
  if (!entry) return null;
  if (typeof entry === "string") {
    return {
      id,
      storagePath: `media/${id}`,
      originalFileName: "legacy-image",
      mimeType: entry.slice(5, entry.indexOf(";") > 0 ? entry.indexOf(";") : undefined) || "image/jpeg",
      size: entry.length,
      category: "other",
      status: "active",
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
      dataUrl: entry,
    };
  }
  return {
    id,
    storagePath: entry.storagePath || `media/${id}`,
    originalFileName: entry.originalFileName || entry.fileName || "image",
    mimeType: entry.mimeType || "image/jpeg",
    size: Number(entry.size || ((entry.dataUrl && entry.dataUrl.length) || 0)),
    category: entry.category || "other",
    status: entry.status || "active",
    createdAt: Number(entry.createdAt || 0),
    updatedAt: Number(entry.updatedAt || entry.createdAt || 0),
    deletedAt: entry.deletedAt || null,
    ownerUserId: entry.ownerUserId || "",
    ownerCharacterId: entry.ownerCharacterId || "",
    dataUrl: entry.dataUrl || entry.url || "",
  };
};
const mediaDataUrl = (media, id) => {
  const raw = media && media[id];
  const entry = normalizeMediaEntry(id, raw);
  return entry && entry.status !== "deleted" ? entry.dataUrl || "" : "";
};
const resolveImg = (src, media) => {
  if (!src) return "";
  const id = imageIdOf(src);
  if (id) return mediaDataUrl(media, id);
  return src;
};

function ensureImageMaps(w) {
  if (!w.images || typeof w.images !== "object") w.images = {};
  return w.images;
}

function registerImageMeta(w, imageId, patch = {}) {
  if (!imageId || !w) return null;
  const images = ensureImageMaps(w);
  images[imageId] = {
    id: imageId,
    storagePath: patch.storagePath || images[imageId]?.storagePath || `media/${imageId}`,
    originalFileName: patch.originalFileName || images[imageId]?.originalFileName || "image",
    mimeType: patch.mimeType || images[imageId]?.mimeType || "image/jpeg",
    size: Number(patch.size || images[imageId]?.size || 0),
    category: patch.category || images[imageId]?.category || "other",
    status: patch.status || images[imageId]?.status || "active",
    createdAt: Number(patch.createdAt || images[imageId]?.createdAt || now()),
    updatedAt: Number(patch.updatedAt || now()),
    deletedAt: patch.deletedAt !== undefined ? patch.deletedAt : (images[imageId]?.deletedAt || null),
    ownerUserId: patch.ownerUserId || images[imageId]?.ownerUserId || "",
    ownerCharacterId: patch.ownerCharacterId || images[imageId]?.ownerCharacterId || "",
  };
  return images[imageId];
}

function imageRefForValue(value) {
  const id = imageIdOf(value);
  return id ? imageRef(id) : value || "";
}

function normalizeWorldImages(world, media) {
  if (!world) return { world, media, changed: false };
  const w = JSON.parse(JSON.stringify(world));
  const nextMedia = { ...(media || {}) };
  let changed = false;
  const attach = (raw, patch) => {
    if (!raw) return raw;
    const currentId = imageIdOf(raw);
    if (currentId) {
      registerImageMeta(w, currentId, patch);
      return imageRef(currentId);
    }
    if (!isInlineImageData(raw)) return raw;
    const id = uid();
    nextMedia[id] = normalizeMediaEntry(id, {
      storagePath: patch.storagePath || `media/${id}`,
      originalFileName: patch.originalFileName || `migrated-${id}`,
      mimeType: patch.mimeType || "image/jpeg",
      size: Number(patch.size || String(raw).length),
      category: patch.category || "other",
      status: "active",
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ownerUserId: patch.ownerUserId || "",
      ownerCharacterId: patch.ownerCharacterId || "",
      dataUrl: raw,
    });
    registerImageMeta(w, id, nextMedia[id]);
    changed = true;
    return imageRef(id);
  };
  Object.keys(w.players || {}).forEach((id) => {
    if (w.players[id] && w.players[id].avatar) w.players[id].avatar = attach(w.players[id].avatar, { category: "profile", ownerUserId: id });
  });
  (w.chars || []).forEach((c) => {
    if (c.avatar) c.avatar = attach(c.avatar, { category: "profile", ownerCharacterId: c.id });
    c.album = albumOf(c).map((item) => {
      const ref = attach(item.imageId ? imageRef(item.imageId) : item.src, { category: "album", ownerCharacterId: c.id });
      const iid = imageIdOf(ref);
      return iid ? { ...item, imageId: iid } : item;
    });
  });
  (w.posts || []).forEach((p) => {
    const ref = attach(p.imageId ? imageRef(p.imageId) : p.image, { category: "post", ownerCharacterId: p.authorId });
    const iid = imageIdOf(ref);
    if (iid && p.imageId !== iid) { p.imageId = iid; changed = true; }
    if (iid && p.image) { p.image = ""; changed = true; }
  });
  return { world: w, media: nextMedia, changed };
}

async function readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Nem sikerült beolvasni a fájlt."));
    r.readAsDataURL(file);
  });
}
async function shrink(file, maxSize) {
  const dataUrl = await readFile(file);
  // az animált GIF csak akkor marad eredetiben, ha nem túl nagy;
  // a nagy GIF-ből az első kocka lesz, különben pillanatok alatt megtelne a tár
  if (file.type === "image/gif" && file.size <= 2 * 1024 * 1024) return dataUrl;
  if (file.type === "image/png" && file.size < 400 * 1024) return dataUrl;
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Ez a fájl nem kép."));
    i.src = dataUrl;
  });
  const s = Math.min(1, maxSize / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(img.width * s));
  cv.height = Math.max(1, Math.round(img.height * s));
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", 0.72);
}

function Av({ src, name = "?", size = 38, radius = 12 }) {
  const { media } = useMedia();
  const [bad, setBad] = useState(false);
  const url = resolveImg(src, media);
  return (
    <div className="av" style={{ ...avStyle(name), width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.42) }}>
      {url && !bad ? <img src={url} alt="" onError={() => setBad(true)} /> : (name || "?")[0]}
    </div>
  );
}

function ImagePicker({ value, onChange, label, max = 512, preview = 80, category = "other" }) {
  const { media, addImage } = useMedia();
  const { tt } = useLang();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const url = resolveImg(value, media);

  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true); setErr("");
    try {
      if (f.size > 6 * 1024 * 1024) throw new Error(tt("Túl nagy fájl (max 6 MB).", "File too large (max 6 MB)."));
      const data = await shrink(f, max);
      const ref2 = addImage(data, { category, originalFileName: f.name, mimeType: f.type, size: f.size });
      if (!ref2) throw new Error(tt("Megtelt a világ képtára — törölj pár képet, hogy férjen újabb.", "The world's media storage is full — delete a few images to make room for more."));
      onChange(ref2);
    } catch (e2) { setErr(e2.message || tt("Nem sikerült.", "Failed.")); }
    setBusy(false);
  };

  return (
    <>
      <label className="f">{label || tt("Kép", "Image")}</label>
      <div className="row" style={{ alignItems: "center" }}>
        {url ? (
          <img src={url} alt="" style={{ width: preview, height: preview, objectFit: "cover", borderRadius: 12, border: "1px solid var(--line)" }} />
        ) : (
          <div style={{ width: preview, height: preview, borderRadius: 12, border: "1px dashed var(--line)", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 11 }}>{tt("nincs kép", "no image")}</div>
        )}
        <div style={{ flex: 1 }}>
          <button className="btn full" onClick={() => ref.current && ref.current.click()} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />} {tt("Feltöltés", "Upload")}
          </button>
          {value ? <button className="btn ghost full tiny" style={{ marginTop: 6 }} onClick={() => onChange("")}>{tt("Törlés", "Delete")}</button> : null}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={pick} />
      <input className="i" style={{ marginTop: 8, fontSize: 12 }} value={value && value.startsWith("img:") ? "" : value || ""}
        placeholder={tt("vagy illessz be egy kép-URL-t", "or paste an image URL")} onChange={(e) => onChange(e.target.value)} />
      {err && <div className="err">{err}</div>}
    </>
  );
}

function timeAgo(ts) {
  const d = Math.floor((now() - ts) / 1000);
  if (CURRENT_LANG === "en") {
    if (d < 60) return "now";
    if (d < 3600) return Math.floor(d / 60) + "m";
    if (d < 86400) return Math.floor(d / 3600) + "h";
    return Math.floor(d / 86400) + "d";
  }
  if (d < 60) return "most";
  if (d < 3600) return Math.floor(d / 60) + " p";
  if (d < 86400) return Math.floor(d / 3600) + " ó";
  return Math.floor(d / 86400) + " n";
}

/* ---------- dátum, kor, csillagjegy ---------- */
const HU_MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
const SIGNS = [["Bak", "Vízöntő", 20], ["Vízöntő", "Halak", 19], ["Halak", "Kos", 21], ["Kos", "Bika", 20],
  ["Bika", "Ikrek", 21], ["Ikrek", "Rák", 21], ["Rák", "Oroszlán", 23], ["Oroszlán", "Szűz", 23],
  ["Szűz", "Mérleg", 23], ["Mérleg", "Skorpió", 23], ["Skorpió", "Nyilas", 22], ["Nyilas", "Bak", 22]];

function parseDate(s) {
  if (!s) return null;
  let str = String(s).toLowerCase();
  const ym = str.match(/\b(1\d{3}|2\d{3})\b/);
  const year = ym ? Number(ym[1]) : null;
  if (ym) str = str.replace(ym[1], " ");
  let m = null, d = null;
  const mi = HU_MONTHS.findIndex((n) => str.indexOf(n.slice(0, 4)) >= 0);
  if (mi >= 0) { m = mi + 1; str = str.replace(HU_MONTHS[mi], " "); }
  const nums = (str.match(/\d{1,2}/g) || []).map(Number);
  if (m === null) { m = nums.length > 0 ? nums[0] : null; d = nums.length > 1 ? nums[1] : null; }
  else d = nums.length > 0 ? nums[0] : null;
  if (m !== null && (m < 1 || m > 12)) m = null;
  if (d !== null && (d < 1 || d > 31)) d = null;
  if (year === null && m === null) return null;
  return { year: year, m: m, d: d };
}
function zodiac(birth) {
  const b = parseDate(birth);
  if (!b || !b.m || !b.d) return "";
  const s = SIGNS[b.m - 1];
  return localizedZodiac(b.d >= s[2] ? s[1] : s[0], CURRENT_LANG);
}
const worldYear = (w) => {
  const y = Number(String((w && w.universe && w.universe.year) || "").replace(/\D/g, ""));
  return y > 0 ? y : null;
};
function ageOf(c, w) {
  const b = parseDate(c.birth);
  const wy = worldYear(w);
  if (!b || !b.year || !wy) return c.age || "";
  let a = wy - b.year;
  const t = parseDate(w.universe.date);
  if (t && t.m && b.m && (t.m < b.m || (t.m === b.m && t.d && b.d && t.d < b.d))) a -= 1;
  return a >= 0 && a < 200 ? String(a) : (c.age || "");
}
const worldToday = (w) => {
  const y = worldYear(w);
  const d = (w.universe.date || "").trim();
  if (y && d) return `${y}, ${d}`;
  if (y) return String(y);
  return d || termText("notSet", worldLanguage(w));
};

/* A kapcsolat IRÁNYÍTOTT: külön tároljuk, hogy A mit érez B iránt, és külön
   azt, hogy B mit érez A iránt. Így lehet egyoldalú a vonzalom, a gyűlölet
   és a titkos érzés is. A kulcs jelentése: "a hogyan viszonyul b-hez". */
const relKey = (a, b) => String(a) + ">" + String(b);

/* Rokoni és kölcsönös viszonyok párja — a másik irány ebből töltődik ki,
   ha még üres. Ami nem szerepel itt (pl. Crush), az szándékosan egyoldalú. */
const BOND_PAIR = {
  "Anya": "Gyerek", "Apa": "Gyerek", "Szülő": "Gyerek", "Mostohaszülő": "Nevelt gyerek",
  "Fia": "Szülő", "Lánya": "Szülő", "Gyerek": "Szülő", "Nevelt gyerek": "Mostohaszülő",
  "Nagymama": "Unoka", "Nagypapa": "Unoka", "Nagyszülő": "Unoka", "Unoka": "Nagyszülő",
  "Nagynéni": "Unokahúg / unokaöcs", "Nagybácsi": "Unokahúg / unokaöcs",
  "Testvér": "Testvér", "Ikertestvér": "Ikertestvér", "Féltestvér": "Féltestvér",
  "Mostohatestvér": "Mostohatestvér", "Unokatestvér": "Unokatestvér", "Rokon": "Rokon",
  "Após / anyós": "Meny / vő", "Sógor / sógornő": "Sógor / sógornő",
  "Járnak": "Járnak", "Jegyesek": "Jegyesek", "Házastárs": "Házastárs", "Exek": "Exek",
  "Titkos viszony": "Titkos viszony", "Osztálytárs": "Osztálytárs", "Szomszéd": "Szomszéd",
  "Munkatárs": "Munkatárs", "Kölcsönös crush": "Kölcsönös crush",
  "Főnök": "Beosztott", "Beosztott": "Főnök", "Mentor": "Tanítvány", "Tanítvány": "Mentor",
  "Tanár": "Tanítvány", "Edző": "Tanítvány",
};
function relType(score) {
  if (score <= -70) return localizedRelType("Ellenség", CURRENT_LANG);
  if (score <= -30) return localizedRelType("Rivális", CURRENT_LANG);
  if (score <= -5) return localizedRelType("Feszült", CURRENT_LANG);
  if (score < 25) return localizedRelType("Ismerős", CURRENT_LANG);
  if (score < 55) return localizedRelType("Barát", CURRENT_LANG);
  if (score < 80) return localizedRelType("Közeli barát", CURRENT_LANG);
  return localizedRelType("Legjobb barát", CURRENT_LANG);
}

/* Állandó kötelék: tény, sosem változik magától (rokonság, jogi viszony).
   Változó viszony: alakulhat a történések hatására. */
const FIXED_BONDS = ["Anya", "Apa", "Szülő", "Fia", "Lánya", "Gyerek", "Testvér", "Ikertestvér", "Féltestvér",
  "Mostohatestvér", "Mostohaszülő", "Nevelt gyerek", "Nagymama", "Nagypapa", "Nagyszülő", "Unoka",
  "Unokatestvér", "Nagynéni", "Nagybácsi", "Rokon", "Após / anyós", "Sógor / sógornő"];
const SOFT_BONDS = ["Ellenség", "Rivális", "Ismerős", "Barát", "Közeli barát", "Legjobb barát",
  "Crush", "Kölcsönös crush", "Járnak", "Jegyesek", "Házastárs", "Exek", "Titkos viszony",
  "Osztálytárs", "Szomszéd", "Munkatárs", "Főnök", "Beosztott", "Mentor", "Tanítvány", "Edző", "Tanár"];

// A kapcsolat hangulata a pontszám alapján, a kötelék címkéjétől függetlenül.
function relMood(score) {
  if (score <= -70) return localizedRelMood("gyűlölik egymást", CURRENT_LANG);
  if (score <= -30) return localizedRelMood("ellenséges", CURRENT_LANG);
  if (score <= -5) return localizedRelMood("feszült", CURRENT_LANG);
  if (score < 25) return localizedRelMood("hűvös", CURRENT_LANG);
  if (score < 55) return localizedRelMood("jóban vannak", CURRENT_LANG);
  if (score < 80) return localizedRelMood("közeli", CURRENT_LANG);
  return localizedRelMood("elválaszthatatlanok", CURRENT_LANG);
}

/* Példák az AI-nak: az érzelmi állapot ennél sokkal szabadabb lehet. */
const MOOD_EXAMPLES = [
  "AZ ENYÉM. AZ ENYÉM.", "Ride or die", "Bármit megtenne érted", "Megszállott", "Túlságosan védelmező",
  "Titkos vonzalom", "Kimondatlan feszültség", "Féltékeny", "Nem bízik benned", "Csak kihasznál",
  "Tisztel", "Retteg tőled", "Egy hajszál választja el attól, hogy megöljön", "Bűntudata van miattad",
  "Bosszút forral", "Hiányzol neki", "Kerül téged", "Próbál lenyűgözni", "Kiábrándult belőled",
  "Nem tudja hova tenni", "Testvérként véd", "Haragszik, de nem mondja",
];

// Amit a felületen mutatunk: elsősorban az, hogy MOST mit érez.
function relLabel(r) {
  const bond = (r && (r.bond || r.type)) || "";
  const mood = (r && r.mood) || "";
  if (mood && r.fixed && bond) return `${localizedBond(bond, CURRENT_LANG)} · ${mood}`;
  if (mood) return mood;
  if (r && r.fixed && bond) return `${localizedBond(bond, CURRENT_LANG)} · ${relMood(r.score)}`;
  if (bond) return localizedBond(bond, CURRENT_LANG);
  return relType(r ? r.score : 0);
}
const moodEmoji = (d) => (d >= 10 ? "🔥" : d > 0 ? "❤️" : d <= -10 ? "🖤" : d < 0 ? "💔" : "✨");
function relColor(score) {
  if (score < -20) return "var(--steel)";
  if (score < 20) return "var(--muted)";
  if (score < 65) return "var(--gold)";
  return "var(--rose)";
}

/* ---------- fiókok, jelszó ---------- */
const normUser = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
const newSalt = () => uid() + uid() + uid();

async function hashPw(pw, salt) {
  const txt = String(salt) + "::" + String(pw);
  try {
    if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
      return "s2:" + Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) { /* nincs webcrypto — jön a tartalék */ }
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  for (let i = 0; i < txt.length; i++) {
    h1 = ((h1 ^ txt.charCodeAt(i)) * 16777619) >>> 0;
    h2 = ((h2 + txt.charCodeAt(i) * (i + 7)) * 2654435761) >>> 0;
  }
  return "f1:" + h1.toString(16) + h2.toString(16);
}

function accByUser(w, username) {
  const u = normUser(username);
  if (!u) return null;
  const ids = Object.keys(w.accounts || {});
  for (let i = 0; i < ids.length; i++) {
    const a = w.accounts[ids[i]];
    if (a && normUser(a.username) === u) return a;
  }
  return null;
}

// Bármely szereplő azonosító alapján: játékos, bot vagy mellékszereplő.
function charById(w, id) {
  if (!id) return null;
  if (w.players && w.players[id]) return w.players[id];
  return (w.chars || []).find((c) => c.id === id) ||
         (w.extras || []).find((c) => c.id === id) || null;
}
const isExtra = (w, id) => !!(w.extras || []).find((c) => c.id === id);
const isHuman = (w, id) => !!(w.players && w.players[id]);
// Minden emberi játékos karaktere.
const humanChars = (w) => Object.keys(w.players || {}).map((id) => w.players[id]).filter(Boolean);
// Mindenki, akinek kapcsolata lehet: játékosok, botok, mellékszereplők.
const allSubjects = (w) => humanChars(w).concat(w.chars || []).concat(w.extras || []);
const kindOf = (w, id) => (isHuman(w, id) ? termText("player", worldLanguage(w)) : isExtra(w, id) ? termText("extra", worldLanguage(w)) : termText("ai", worldLanguage(w)));
// A privát beszélgetések fiókonként külön élnek.
const chatKey = (meId, charId) => String(meId) + "|" + String(charId);

const PUBLIC_PROFILE_KEYS = ["name", "nick", "username", "birth", "gender", "orientation", "height", "job", "city", "bio", "looks", "avatar"];
const PRIVATE_PROFILE_KEYS = ["personality", "traits", "speech", "voice", "goals", "fears", "likes", "secrets", "backstory", "extra", "brief", "briefSrc"];

function defaultCharacterMemory() {
  return {
    knownCharacters: {},
    knownFacts: [],
    witnessedEvents: [],
    conversations: [],
    relationshipHistory: {},
    suspicions: [],
    rumors: [],
    learnedSecrets: [],
  };
}

function normalizeKnowledgeItem(item, key) {
  const text = normalizeMemoryText(item && (item.text || item.fact || item.assumption || item.information || item.rumor || ""));
  if (!text) return null;
  const source = String((item && item.source) || "observed").slice(0, 40);
  const rawConfidence = Number(item && item.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0.7;
  return {
    id: item && item.id ? String(item.id) : uid(),
    kind: key,
    text,
    source,
    confidence,
    timestamp: (item && item.timestamp) || now(),
  };
}

function mergeKnowledgeItems(existing = [], incoming = [], key, limit = 24) {
  const out = [];
  const seen = new Set();
  [...(existing || []), ...(incoming || [])].forEach((item) => {
    const norm = normalizeKnowledgeItem(item, key);
    if (!norm) return;
    const sig = `${norm.kind}|${norm.text.toLowerCase()}|${norm.source}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(norm);
  });
  return out.slice(-limit);
}

function ensureCharMemory(w, observerId) {
  if (!w.charMemory) w.charMemory = {};
  if (!w.charMemory[observerId]) w.charMemory[observerId] = defaultCharacterMemory();
  const mem = w.charMemory[observerId];
  const base = defaultCharacterMemory();
  Object.keys(base).forEach((k) => { if (!mem[k]) mem[k] = Array.isArray(base[k]) ? [] : {}; });
  if (!mem.knownCharacters || typeof mem.knownCharacters !== "object") mem.knownCharacters = {};
  return mem;
}

function ensureKnownCharacter(mem, targetId, publicProfile) {
  if (!mem.knownCharacters[targetId]) {
    mem.knownCharacters[targetId] = {
      publicProfile: publicProfile || {},
      observedTraits: [],
      knownRelationships: [],
      knownEvents: [],
      assumptions: [],
      relationshipStatus: {},
      learnedInformation: [],
    };
  }
  const row = mem.knownCharacters[targetId];
  if (!row.publicProfile) row.publicProfile = publicProfile || {};
  if (!row.observedTraits) row.observedTraits = [];
  if (!row.knownRelationships) row.knownRelationships = [];
  if (!row.knownEvents) row.knownEvents = [];
  if (!row.assumptions) row.assumptions = [];
  if (!row.relationshipStatus || typeof row.relationshipStatus !== "object") row.relationshipStatus = {};
  if (!row.learnedInformation) row.learnedInformation = [];
  return row;
}

function characterPublicData(w, c) {
  if (!c) return {};
  const out = { id: c.id, type: isHuman(w, c.id) ? "player" : (isExtra(w, c.id) ? "extra" : "ai") };
  PUBLIC_PROFILE_KEYS.forEach((k) => { if (c[k] !== undefined && c[k] !== null && c[k] !== "") out[k] = c[k]; });
  const age = ageOf(c, w);
  if (age) out.age = age;
  out.publicPosts = (w.posts || [])
    .filter((p) => p && p.authorId === c.id)
    .slice(0, 3)
    .map((p) => cut(p.text, 110));
  out.publicComments = (w.posts || []).flatMap((p) => (p.comments || [])
    .filter((x) => x.authorId === c.id)
    .map((x) => cut(x.text, 90))).slice(0, 3);
  return out;
}

function characterPrivateData(c) {
  if (!c) return {};
  const out = {};
  PRIVATE_PROFILE_KEYS.forEach((k) => { if (c[k] !== undefined && c[k] !== null && c[k] !== "") out[k] = c[k]; });
  return out;
}

function memoryToLine(entry) {
  if (!entry) return "";
  const src = entry.source ? ` [${entry.source}]` : "";
  const conf = Number.isFinite(Number(entry.confidence)) ? ` (bizt: ${Math.round(Number(entry.confidence) * 100)}%)` : "";
  return `${entry.text || ""}${src}${conf}`.trim();
}

function getCharacterDataForObserver(observer, target, w) {
  const observerId = typeof observer === "string" ? observer : (observer && observer.id);
  const targetId = typeof target === "string" ? target : (target && target.id);
  const tc = typeof target === "string" ? charById(w, target) : target;
  if (!observerId || !targetId || !tc) return { publicData: characterPublicData(w, tc) };
  const publicData = characterPublicData(w, tc);
  if (observerId === targetId) {
    return {
      publicData,
      privateData: characterPrivateData(tc),
      memory: ensureCharMemory(w, observerId),
    };
  }
  const observerMem = ensureCharMemory(w, observerId);
  const known = ensureKnownCharacter(observerMem, targetId, publicData);
  known.publicProfile = { ...publicData };
  return {
    publicData,
    knownInformation: known,
  };
}

function buildKnownCharacterContext(observerId, allCharacters, w) {
  return (allCharacters || [])
    .filter((c) => c && c.id && c.id !== observerId)
    .map((c) => {
      const row = getCharacterDataForObserver(observerId, c, w);
      return {
        id: c.id,
        publicProfile: row.publicData || {},
        knownInformation: row.knownInformation || null,
      };
    });
}

/* A @felhasználónév mindenkinél egyedi: a játékosok, a botok és a
   mellékszereplők között sem lehet két egyforma. Ha foglalt, számot kap. */
function uniqueHandle(w, desired, selfId) {
  const base = String(desired || "jatekos").toLowerCase().replace(/[^a-z0-9._]/g, "") || "jatekos";
  const taken = {};
  Object.keys(w.players || {}).forEach((id) => {
    const pl = w.players[id];
    if (pl && id !== selfId && pl.username) taken[String(pl.username).toLowerCase()] = 1;
  });
  (w.chars || []).concat(w.extras || []).forEach((c) => {
    if (c && c.id !== selfId && c.username) taken[String(c.username).toLowerCase()] = 1;
  });
  if (!taken[base]) return base;
  for (let i = 2; i < 500; i++) if (!taken[base + i]) return base + i;
  return base + uid();
}

function findChar(w, key) {
  if (key === null || key === undefined) return null;
  const k = String(key).trim().toLowerCase().replace(/^@/, "");
  if (!k) return null;
  const me = w.player || {};
  if (k === "player" || k === "jatekos" || k === "játékos" ||
      (me.name && k === String(me.name).toLowerCase()) ||
      (me.username && k === String(me.username).toLowerCase())) return w.meId || "player";
  // emberi játékosok karakterei
  const pids = Object.keys(w.players || {});
  for (let i = 0; i < pids.length; i++) {
    const pl = w.players[pids[i]];
    if (!pl) continue;
    if (String(pids[i]).toLowerCase() === k) return pids[i];
    if ((pl.username || "").toLowerCase() === k) return pids[i];
    if ((pl.name || "").toLowerCase() === k) return pids[i];
    if ((pl.name || "").toLowerCase().split(" ")[0] === k) return pids[i];
  }
  const list = (w.chars || []).concat(w.extras || []);
  const hit =
    list.find((x) => String(x.id).toLowerCase() === k) ||
    list.find((x) => (x.username || "").toLowerCase() === k) ||
    list.find((x) => (x.name || "").toLowerCase() === k) ||
    list.find((x) => (x.nick || "").toLowerCase() === k) ||
    list.find((x) => (x.name || "").toLowerCase().split(" ")[0] === k);
  return hit ? hit.id : null;
}

/* Van-e egyáltalán rögzített kapcsolat kettejük között. */
// Bármelyik irányban van-e rögzített kapcsolat kettejük között.
const linked = (w, a, b) => !!(w.rels && (w.rels[relKey(a, b)] || w.rels[relKey(b, a)]));

/* Kihez tartozhat viszony az adott szereplő lapján: a játékosok és a botok
   mindig, a mellékszereplők viszont csak akkor, ha nála tényleg be van állítva. */
function relevantOthers(w, id) {
  const core = humanChars(w).concat(w.chars || []).filter((x) => x.id !== id);
  const side = (w.extras || []).filter((x) => x.id !== id && linked(w, id, x.id));
  return core.concat(side);
}

const EMPTY_REL = { score: 0, hidden: "", type: "", bond: "", fixed: false, mood: "", why: "" };

/* Hogyan viszonyul "a" a "b"-hez. Ez nem feltétlenül ugyanaz, mint fordítva. */
function getRel(w, a, b) {
  return (w.rels && w.rels[relKey(a, b)]) || EMPTY_REL;
}

function setRel(w, a, b, patch) {
  const k = relKey(a, b);
  if (!w.rels) w.rels = {};
  w.rels[k] = { ...EMPTY_REL, ...(w.rels[k] || {}), ...patch, at: now() };

  // A kötelék a viszony ténybeli oldala: ha az egyik irányba beállítod, a
  // másik irány párja kitöltődik — de csak ha ott még nincs semmi.
  if (patch && patch.bond !== undefined) {
    const pair = BOND_PAIR[patch.bond];
    const back = w.rels[relKey(b, a)];
    if (pair && (!back || !back.bond)) {
      w.rels[relKey(b, a)] = {
        ...EMPTY_REL, ...(back || {}),
        bond: pair, fixed: !!patch.fixed || (back ? !!back.fixed : false), at: now(),
      };
    }
  }
}

/* ---------- jegyzetek (mint az Instagram Notes) ----------
   Mindenkinek egy aktív jegyzete lehet, ami egy nap után magától lejár. */
const NOTE_LIFE = 24 * 3600e3;
const NOTE_MAX = 80;
const liveNotes = (w) => (w.notes || []).filter((x) => x && now() - (x.ts || 0) < NOTE_LIFE);
const noteOf = (w, id) => liveNotes(w).find((x) => x.authorId === id) || null;

function setNote(n, authorId, text, forcedId) {
  const t = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NOTE_MAX);

  // Egy karakternek egyszerre csak egy aktív note-ja lehet.
  // Üres szöveg esetén ez egyben törlésként is működik.
  n.notes = (n.notes || []).filter(
    (x) => x && x.authorId !== authorId
  );

  if (t) {
    const createdAt = now();

    n.notes.unshift({
      id: forcedId || uid(),
      authorId,
      text: t,
      ts: createdAt,
      reacts: [],
      reactedBy: [],
    });
  }
  n.notes = n.notes.slice(0, 80);
}

/* A jegyzetek szövege az AI-nak. */
function notesForAI(w) {
  const list = liveNotes(w);
  if (!list.length) return "";
  return list.map((x) => {
    const a = charById(w, x.authorId);
    return `${a ? a.name : "?"} [${x.authorId}]: "${x.text}"`;
  }).join("\n");
}

/* ---------- értesítések ---------- */
function pushNote(n, playerId, note) {
  if (!playerId || !n.players || !n.players[playerId]) return;
  if (!n.notify) n.notify = {};
  const list = (n.notify[playerId] || []).slice();
  const entry = { id: uid(), ts: now(), read: false, ...note };
  if (entry.translationKey) {
    entry.params = entry.params || {};
    if (!entry.text) entry.text = sysTextFor(n, playerId, entry.translationKey, entry.params);
  }
  if (!entry.language) entry.language = worldLanguage(n, playerId);
  list.unshift(entry);
  n.notify[playerId] = list.slice(0, 60);
}

function renderNoteText(w, playerId, note) {
  if (!note) return "";
  if (note.translationKey) return sysTextFor(w, playerId, note.translationKey, note.params || {});
  return note.text || "";
}

/* Egy új komment nyomán keletkező értesítések. */
function noteComment(n, post, c) {
  const link = { type: "post", id: post.id };
  const who = charById(n, c.authorId);
  const nm = who ? who.name : sysTextFor(n, post.authorId, "someone");
  const snip = String(c.text || "").slice(0, 70);
  if (isHuman(n, post.authorId) && post.authorId !== c.authorId)
    pushNote(n, post.authorId, {
      icon: "💬",
      translationKey: "commentedYourPost",
      params: { name: nm, snippet: snip },
      text: sysTextFor(n, post.authorId, "commentedYourPost", { name: nm, snippet: snip }),
      link,
    });
  if (c.parent) {
    const parent = (post.comments || []).find((x) => x.id === c.parent);
    if (parent && isHuman(n, parent.authorId) && parent.authorId !== c.authorId && parent.authorId !== post.authorId)
      pushNote(n, parent.authorId, {
        icon: "↩️",
        translationKey: "repliedYourComment",
        params: { name: nm, snippet: snip },
        text: sysTextFor(n, parent.authorId, "repliedYourComment", { name: nm, snippet: snip }),
        link,
      });
  }
  noteMentions(n, c.text, c.authorId, link);
}

/* @említések felismerése: kit szólítottak meg a szövegben. */
function noteMentions(n, txt, authorId, link) {
  if (!txt) return;
  const low = String(txt).toLowerCase();
  Object.keys(n.players || {}).forEach((pid) => {
    if (pid === authorId) return;
    const h = (n.players[pid].username || "").toLowerCase();
    if (!h || low.indexOf("@" + h) === -1) return;
    const who = charById(n, authorId);
    const nm = who ? who.name : sysTextFor(n, pid, "someone");
    pushNote(n, pid, {
      icon: "📣",
      translationKey: "mentionedYou",
      params: { name: nm },
      text: sysTextFor(n, pid, "mentionedYou", { name: nm }),
      link,
    });
  });
}

/* Egy változás mindig egyirányú: "a" mit érez ezután "b" iránt. */
/* Kemény őr: a te karaktered SOHA nem szólalhat meg az AI-tól. Ha mégis
   megpróbálná, itt kidobjuk — nem a jó szándékban bízunk, hanem szűrünk. */
function aiVoice(n, id) {
  const who = findChar(n, id);
  return who && !isHuman(n, who) ? who : null;
}

function applyChanges(n, changes) {
  (changes || []).forEach((ch) => {
    const a = findChar(n, ch.a), b = findChar(n, ch.b);
    if (!a || !b || a === b) return;
    const r = getRel(n, a, b);
    const delta = Number(ch.delta) || 0;
    const patch = { score: clamp(r.score + delta) };
    // Az állandó köteléket (rokonság) az AI nem írhatja át, csak a változó viszonyt.
    if (ch.bond && !r.fixed) patch.bond = String(ch.bond).slice(0, 40);
    if (ch.mood) patch.mood = String(ch.mood).slice(0, 60);
    if (ch.why) patch.why = String(ch.why).slice(0, 160);
    setRel(n, a, b, patch);
    const memA = ensureCharMemory(n, a);
    const rk = relKey(a, b);
    if (!memA.relationshipHistory[rk]) memA.relationshipHistory[rk] = [];
    memA.relationshipHistory[rk] = memA.relationshipHistory[rk].concat([{
      score: patch.score,
      delta,
      mood: patch.mood || r.mood || "",
      why: patch.why || "",
      timestamp: now(),
    }]).slice(-20);

    // értesítés akkor, ha egy szereplő érzése változott meg IRÁNTAD
    [[a, b]].forEach(([x, y]) => {
      if (!isHuman(n, y) || isHuman(n, x)) return;
      const other = charById(n, x);
      if (!other) return;
      const why = ch.why ? String(ch.why) : (ch.mood ? String(ch.mood) : "");
      const whyPart = why ? ` - ${why}` : "";
      pushNote(n, y, {
        icon: moodEmoji(delta),
        translationKey: "relationshipDelta",
        params: {
          name: other.name,
          delta: `${delta > 0 ? "+" : ""}${delta}`,
          why: whyPart,
        },
        text: sysTextFor(n, y, "relationshipDelta", {
          name: other.name,
          delta: `${delta > 0 ? "+" : ""}${delta}`,
          why: whyPart,
        }),
        mood: ch.mood ? String(ch.mood) : "",
        link: { type: "char", id: x },
      });
    });
  });
}
function applyMemories(n, list) {
  (list || []).forEach((m) => {
    const id = findChar(n, m && m.id);
    if (!id) return;
    const text = normalizeMemoryText(m && m.text);
    if (!text) return;
    n.mems[id] = mergeMemoryEntries(n.mems[id], [text], 16);
    const mem = ensureCharMemory(n, id);
    mem.knownFacts = mergeKnowledgeItems(mem.knownFacts, [{
      text,
      source: (m && m.source) || "self_memory",
      confidence: Number.isFinite(Number(m && m.confidence)) ? Number(m.confidence) : 0.9,
      timestamp: (m && m.timestamp) || now(),
    }], "fact", 32);
  });
}

function rememberKnowledge(w, observerId, payload) {
  if (!observerId || !payload) return;
  const mem = ensureCharMemory(w, observerId);
  const kind = payload.kind || "fact";
  const entry = {
    text: payload.text,
    source: payload.source || "observed",
    confidence: Number.isFinite(Number(payload.confidence)) ? Number(payload.confidence) : 0.75,
    timestamp: payload.timestamp || now(),
  };
  if (kind === "event") mem.witnessedEvents = mergeKnowledgeItems(mem.witnessedEvents, [entry], "event", 32);
  else if (kind === "rumor") mem.rumors = mergeKnowledgeItems(mem.rumors, [entry], "rumor", 32);
  else if (kind === "assumption") mem.suspicions = mergeKnowledgeItems(mem.suspicions, [entry], "assumption", 32);
  else if (kind === "secret") mem.learnedSecrets = mergeKnowledgeItems(mem.learnedSecrets, [entry], "secret", 32);
  else if (kind === "conversation") mem.conversations = mergeKnowledgeItems(mem.conversations, [entry], "conversation", 32);
  else mem.knownFacts = mergeKnowledgeItems(mem.knownFacts, [entry], "fact", 32);
}

function rememberAboutTarget(w, observerId, targetId, payload) {
  if (!observerId || !targetId || observerId === targetId || !payload) return;
  const obsMem = ensureCharMemory(w, observerId);
  const target = charById(w, targetId);
  const known = ensureKnownCharacter(obsMem, targetId, characterPublicData(w, target));
  const entry = {
    text: payload.text,
    source: payload.source || "observed",
    confidence: Number.isFinite(Number(payload.confidence)) ? Number(payload.confidence) : 0.7,
    timestamp: payload.timestamp || now(),
  };
  if (payload.kind === "assumption") known.assumptions = mergeKnowledgeItems(known.assumptions, [entry], "assumption", 16);
  else if (payload.kind === "event") known.knownEvents = mergeKnowledgeItems(known.knownEvents, [entry], "event", 16);
  else if (payload.kind === "relationship") known.knownRelationships = mergeKnowledgeItems(known.knownRelationships, [entry], "relationship", 16);
  else if (payload.kind === "observed_trait") known.observedTraits = mergeKnowledgeItems(known.observedTraits, [entry], "trait", 16);
  else known.learnedInformation = mergeKnowledgeItems(known.learnedInformation, [entry], "fact", 16);
}

/* Album-szerkesztő: több kép feltöltése képaláírással. */
function AlbumEditor({ value, onChange }) {
  const { media, addImage } = useMedia();
  const { tt } = useLang();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = Array.isArray(value) ? value : [];

  const pick = async (e) => {
    const files = Array.from((e.target && e.target.files) || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true); setErr("");
    const added = [];
    for (let i = 0; i < files.length; i++) {
      try {
        if (files[i].size > 6 * 1024 * 1024) throw new Error(tt(`"${files[i].name}" túl nagy (max 6 MB).`, `"${files[i].name}" is too large (max 6 MB).`));
        const data = await shrink(files[i], 900);
        const ref2 = addImage(data, { category: "album", originalFileName: files[i].name, mimeType: files[i].type, size: files[i].size });
        if (!ref2) throw new Error(tt("Megtelt a világ képtára — törölj pár képet, hogy férjen újabb.", "The world's media storage is full — delete a few images to make room for more."));
        added.push({ id: uid(), imageId: imageIdOf(ref2), note: "" });
      } catch (e2) { setErr((e2 && e2.message) || tt("Nem sikerült.", "Failed.")); break; }
    }
    if (added.length) onChange(list.concat(added));
    setBusy(false);
  };

  return (
    <>
      <label className="f">{tt("Album — feltöltött képek, amiket ki lehet posztolni", "Album — uploaded images that can be posted")}</label>
      <p className="hint">
        {tt("Nyaralós képek, szelfik, buli, bármi. Írj mindegyikhez egy rövid képaláírást: ebből tudja az AI, mikor illik előhúzni. Egyszerre több képet is kijelölhetsz.",
            "Vacation photos, selfies, parties, anything. Write a short caption for each: this is how the AI knows when it fits to bring it up. You can select several images at once.")}
      </p>

      <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {list.map((x, i) => (
          <div key={x.id} style={{ width: 104 }}>
            <div style={{ position: "relative" }}>
              <img src={resolveImg(x.imageId ? imageRef(x.imageId) : x.src, media)} alt="" style={{ width: 104, height: 104, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
              <button className="btn tiny" style={{ position: "absolute", top: 4, right: 4, padding: "3px 6px", background: "rgba(10,9,16,.85)" }}
                onClick={() => onChange(list.filter((y) => y.id !== x.id))}><Trash2 size={11} /></button>
              <span className="chip" style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(10,9,16,.85)" }}>{tt(`kép ${i + 1}`, `image ${i + 1}`)}</span>
            </div>
            <input className="i" style={{ marginTop: 5, padding: "5px 8px", fontSize: 11.5 }} value={x.note || ""}
              placeholder={tt("képaláírás", "caption")} onChange={(e) => onChange(list.map((y) => (y.id === x.id ? { ...y, note: e.target.value } : y)))} />
          </div>
        ))}
      </div>

      <button className="btn full" style={{ marginTop: 10 }} onClick={() => ref.current && ref.current.click()} disabled={busy}>
        {busy ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />} {tt("Képek hozzáadása", "Add images")}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={pick} />
      {err && <div className="err">{err}</div>}
    </>
  );
}

/* Kötelék-választó — állandó és változó viszonyok külön csoportban. */
/* Hangulat-állító: mit érez MOST a másik iránt. Ez látszik mindenhol. */
function MoodPicker({ value, onChange, style }) {
  const { tt } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <input className="i" style={{ ...(style || {}), flex: 1 }} value={value || ""}
          placeholder={tt("mit érez most iránta — pl. Titkos vonzalom", "what they feel toward them now — e.g. Secret attraction")}
          onChange={(e) => onChange(e.target.value)} />
        <button className="btn tiny" onClick={() => setOpen(!open)} title={tt("Példák", "Examples")}>
          <Sparkles size={13} color="var(--gold)" />
        </button>
      </div>
      {open && (
        <div className="row" style={{ flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {MOOD_EXAMPLES.map((m) => (
            <button key={m} className="btn tiny ghost" style={{ fontSize: 10.5 }}
              onClick={() => { onChange(m); setOpen(false); }}>{m}</button>
          ))}
          <button className="btn tiny ghost" style={{ fontSize: 10.5, color: "var(--steel)" }}
            onClick={() => { onChange(""); setOpen(false); }}>{tt("törlés", "clear")}</button>
        </div>
      )}
    </>
  );
}

function BondPicker({ value, fixed, onChange, style }) {
  const { tt } = useLang();
  const known = (fixed ? FIXED_BONDS : SOFT_BONDS).indexOf(value) >= 0;
  const cur = value ? (known ? (fixed ? "fix:" : "soft:") + value : "egyeb") : "";
  return (
    <>
      <select className="i" style={style} value={cur} onChange={(e) => {
        const v = e.target.value;
        if (!v) return onChange({ bond: "", fixed: false });
        if (v === "egyeb") return onChange({ bond: value && !known ? value : tt("egyéb", "other"), fixed: false });
        const i = v.indexOf(":");
        onChange({ bond: v.slice(i + 1), fixed: v.slice(0, i) === "fix" });
      }}>
        <option value="">{tt("Nincs rögzítve — a pontszám dönti el", "Not set — the score decides")}</option>
        <optgroup label={tt("Rokoni kötelék — állandó, sosem változik", "Family bond — permanent, never changes")}>
          {FIXED_BONDS.map((b) => <option key={b} value={"fix:" + b}>{localizedBond(b, CURRENT_LANG)}</option>)}
        </optgroup>
        <optgroup label={tt("Változó viszony — alakulhat a történettel", "Changeable bond — can evolve with the story")}>
          {SOFT_BONDS.map((b) => <option key={b} value={"soft:" + b}>{localizedBond(b, CURRENT_LANG)}</option>)}
        </optgroup>
        <option value="egyeb">{tt("Egyéb — saját szöveggel", "Other — custom text")}</option>
      </select>
      {cur === "egyeb" && (
        <input className="i" style={{ ...(style || {}), marginTop: 6 }} value={value === "egyéb" ? "" : value}
          placeholder={tt("pl. keresztanyja, gyerekkori barát", "e.g. godmother, childhood friend")} onChange={(e) => onChange({ bond: e.target.value, fixed: false })} />
      )}
    </>
  );
}

/* ---------- albumok ----------
   Minden szereplőnek lehet saját képalbuma. Amit ide feltöltesz, azt később
   ki lehet posztolni — és az AI is választhat belőle, ha az adott karakter posztol. */
const albumOf = (c) => (c && Array.isArray(c.album) ? c.album : []);

function albumList(c) {
  const a = albumOf(c);
  if (!a.length) return "";
  return a.map((x, i) => `[kep${i + 1}] ${x.note || "cím nélküli kép"}`).join(" ; ");
}

/* Az AI "kep2" alakban hivatkozik, de a képaláírást is elfogadjuk. */
function albumFind(c, key) {
  const a = albumOf(c);
  if (!a.length || !key) return null;
  const k = String(key).trim().toLowerCase();
  const m = k.match(/(\d+)/);
  if (k.indexOf("kep") === 0 && m) {
    const i = Number(m[1]) - 1;
    return a[i] || null;
  }
  return a.find((x) => (x.note || "").toLowerCase() === k) || null;
}

/* ---------- Claude API ----------
   A szolgáltatónak percenkénti korlátja van, és nem az számít, hányan
   játszotok: ha az app egyszerre vagy túl sűrűn küld kéréseket, "túlterhelt"
   választ kapunk. Ezért minden hívás egy sorba áll be: egyszerre csak egy fut,
   köztük szünet van, és ha mégis elutasítás jön, mindenki vár egy kicsit. */
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

const AI = {
  chain: Promise.resolve(),  // a sor: minden hívás az előző után fut
  last: 0,                   // mikor futott le az utolsó
  gap: 8000,                 // legalább ennyi teljen el két hívás között
  cooldownUntil: 0,          // eddig nem küldünk semmit
  strikes: 0,                // hányszor utasított el minket zsinórban
  pending: 0,                // hány kérés vár épp válaszra
  listeners: [],
};
const cooldownLeft = () => Math.max(0, AI.cooldownUntil - now());
const onCooldown = (fn) => { AI.listeners.push(fn); return () => { AI.listeners = AI.listeners.filter((x) => x !== fn); }; };
function setCooldown(ms) {
  AI.cooldownUntil = Math.max(AI.cooldownUntil, now() + ms);
  AI.listeners.forEach((fn) => { try { fn(cooldownLeft()); } catch (e) {} });
}

/* Sorba állítás: egyszerre egy kérés, közte szünet, pihenő alatt várakozás. */
function queued(fn) {
  const run = AI.chain.then(async () => {
    for (let guard = 0; guard < 40; guard++) {
      const left = cooldownLeft();
      if (left <= 0) break;
      await wait(Math.min(left, 5000) + 150);
    }
    const since = now() - AI.last;
    if (since < AI.gap) await wait(AI.gap - since);
    try { return await fn(); }
    finally { AI.last = now(); }
  });
  AI.chain = run.then(() => {}, () => {});
  return run;
}

const DEFAULT_AI_MODEL = import.meta.env.VITE_AI_MODEL || "claude-sonnet-4-6";
const DEFAULT_AI_PROVIDER = DEFAULT_AI_MODEL.startsWith("gemini") ? "gemini"
  : /^(gpt|o1|o3)/.test(DEFAULT_AI_MODEL) ? "openai" : "anthropic";

async function requestAiProxy(payload, signal) {
  const urls = ["/ai/messages"];
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname || "localhost";
    urls.push(`http://${host}:3000/ai/messages`);
  }
  urls.push("http://127.0.0.1:3000/ai/messages");

  let lastErr = null;
  for (const url of urls) {
    try {
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
  signal,
});
      if (res.ok) return res;
      if (res.status !== 404 && res.status !== 502) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("AI proxy unavailable");
}

async function callClaude(system, prompt, maxTokens = 1200) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 60000);
  let res;
  try {
    // Fejlesztéshez: a kliens most egy lokális proxyhoz fordul, amely beállítja
    // az `Authorization: Bearer <API_KEY>` fejlécet. Indítsd a proxy-t a
    // `server/proxy.js` fájllal (lásd README). A production környezetben
    // használj szerver-oldali proxyt vagy közvetlen, biztonságos backendet.
    res = await requestAiProxy({
  provider: DEFAULT_AI_PROVIDER,
  model: DEFAULT_AI_MODEL,
  max_tokens: maxTokens,
  temperature: 0.9,
  system,
  messages: [{ role: "user", content: prompt }],
}, ctrl.signal);
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("Az AI nem válaszolt időben.");
    if (e && e.message) {
      if (e && e.retryable === false) {
        AI.strikes = Math.min(AI.strikes + 1, 3);
        setCooldown(15000 * AI.strikes);
      }
      throw e;
    }
    throw new Error("Nem sikerült elérni az AI-t (hálózati hiba). A helyi proxy futása és az API kulcsok ellenőrzése szükséges.");
  } finally {
    clearTimeout(to);
  }

  let data;
  try { data = await res.json(); } catch (e) { data = null; }

  if (!res.ok) {
    const code = res.status;
    const busy = code === 429 || code === 529 || code === 503 || code === 500;
    if (code === 404 || code === 502) {
      const msg = (data && data.error && data.error.message) || `HTTP ${code}`;
      const err = new Error(`Az AI-szerver nem érhető el: ${msg}`);
      err.busy = false;
      err.retryable = false;
      AI.strikes = Math.min(AI.strikes + 1, 3);
      setCooldown(15000 * AI.strikes);
      throw err;
    }
    if (busy) {
      // ismétlődő elutasításnál egyre hosszabb pihenő, hogy kimásszunk a gödörből
      AI.strikes = Math.min(AI.strikes + 1, 3);
      const ra = Number(res.headers && res.headers.get && res.headers.get("retry-after"));
      const base = code === 429 ? 20000 : 10000;
      const restMs = ra > 0 ? ra * 1000 : base * AI.strikes;
      setCooldown(restMs);
      const err = new Error(`Az AI most nem győzi — ${Math.ceil(restMs / 1000)} másodperc pihenő.`);
      err.busy = true;
      throw err;
    }
    AI.strikes = 0;
    const msg = (data && data.error && data.error.message) || `HTTP ${code}`;
    throw new Error(`Az AI hibát adott: ${msg}`);
  }

  AI.strikes = 0;   // sikeres hívás: tiszta lap
  if (!data || !data.content) throw new Error("Az AI üres választ adott.");
  const txt = data.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  if (!txt.trim()) throw new Error("Az AI üres választ adott.");
  return txt;
}

function languageInstruction(lang, strict) {
  if (lang === "en") {
    return strict
      ? "OUTPUT LANGUAGE: English only. Do not output Hungarian in any user-visible field."
      : "Generate every user-visible value in English. Some source fields may be Hungarian; use them only as background, never copy their language.";
  }
  return strict
    ? "KIMENETI NYELV: kizárólag magyar. Ne adj angol nyelvű felhasználói szöveget."
    : "Minden felhasználónak látható szöveget magyarul adj. A forrásadatok lehetnek angolul, de csak háttérként használd őket.";
}

function validateGeneratedLanguage(result, expectedLanguage) {
  if (!result || typeof result !== "object") return false;
  const expected = asLang(expectedLanguage);
  if (result.language) return asLang(result.language) === expected;
  const text = JSON.stringify(result);
  const huMarks = (text.match(/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g) || []).length;
  const enMarks = (text.match(/\b(the|and|you|with|from|that|this|is|are|was|were|your|their)\b/gi) || []).length;
  if (expected === "hu") return huMarks > 0 || enMarks === 0;
  return enMarks > 0 || huMarks === 0;
}

/* Kitartó kérés: ha a szolgáltató visszafog minket, nem adjuk fel, hanem
   kivárjuk a pihenőt és újrapróbáljuk. A kérés csak akkor hiúsul meg, ha
   percekig egyszer sem enged át — így a játékosnak nem kell hibát látnia. */
async function askJSON(system, prompt, options = {}) {
  const lang = asLang(options && options.language ? options.language : CURRENT_LANG);
  let strictMode = !!(options && options.strictLanguageMode);
  AI.pending++;
  try {
    return await queued(async () => {
      let last = null, tries = 0, busyWaits = 0;
      while (tries < 2 && busyWaits < 4) {
        try {
          const langRule = languageInstruction(lang, strictMode);
          const jsonRule = lang === "en"
            ? "Return valid JSON only. Add a top-level \"language\" field with value \"en\"."
            : "KIZÁRÓLAG érvényes JSON-t adj vissza. Adj meg egy legfelső \"language\" mezőt \"hu\" értékkel.";
          const sys = `${langRule}\n\n${jsonRule}\nNo markdown fences.\n\n${system}`;
          const hint = tries === 0
            ? ""
            : (lang === "en"
              ? "\n\nPrevious output was invalid. Return only compact valid JSON in English."
              : "\n\nAz előző válasz hibás volt. Most csak rövid, érvényes JSON jöjjön, magyarul.");
          const raw = await callClaude(sys, prompt + hint, Number(options.maxTokens || 1200));
          const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
          if (a === -1 || b === -1) throw new Error("Az AI válasza nem tartalmazott feldolgozható JSON-t.");
          const parsed = JSON.parse(raw.slice(a, b + 1));
          if (!validateGeneratedLanguage(parsed, lang)) {
            if (!strictMode) {
              strictMode = true;
              tries++;
              continue;
            }
            throw new Error(lang === "en" ? "Wrong output language." : "Hibás kimeneti nyelv.");
          }
          return parsed;
        } catch (err) {
          last = err;
          if (err && err.retryable === false) {
            throw err;
          }
          if (err && err.busy) {
            // a visszafogás nem hiba: megvárjuk a pihenőt, és megyünk tovább
            busyWaits++;
            await wait(cooldownLeft() + 500);
            continue;                 // ez nem számít elrontott próbálkozásnak
          }
          tries++;
          if (tries < 4) await wait(700 * tries);
        }
      }
      throw last || new Error("Hibás válasz");
    });
  } finally { AI.pending--; }
}

function askWorldJSON(w, system, prompt, options = {}) {
  return askJSON(system, prompt, { ...options, language: worldLanguage(w) });
}


/* Rövid emlékeztető, ami minden kérés VÉGÉRE kerül. A hosszú szabálykönyv
   eleje elsikkad; ami közvetlenül az írás előtt áll, az tapad. */
const TAIL = `

MIELŐTT ELKÜLDÖD, ELLENŐRIZD:
1) Névmások: tárgyként engem / téged / őt / minket / titeket / őket — SOHA nem "én is meglep", hanem "engem is meglep".
2) Magadról E/1 ("megyek", "nem tudom"), a játékoshoz E/2, tegezve ("hol vagy?", "megígérted"). Magázás tilos.
3) Minden megszólalás a saját hangmintája szerint szóljon — ha letakarnád a nevet, akkor is felismerhető legyen, ki beszél.
4) Csak a NÉVSORBAN szereplő emberek léteznek. Új nevet nem találsz ki.`;

/* ---------- kontextus a modellnek ----------
   A szolgáltató nem a hívások számát méri, hanem a szöveg mennyiségét, ezért
   minden szereplőlap szigorú kereten belül marad. Egy több tízezer karakteres
   háttértörténetből a lényeg megy át, nem az egész. */
/* Mezőnkénti keret. Ami a HANGOT adja — hangminta, beszédstílus, személyiség —,
   abból bőven megy át; a hosszú háttértörténetből csak a lényeg. A sorrend is
   számít: ha elfogyna a keret, a lista végén állók maradnak ki, nem a hang. */
/* Mennyit lásson az AI egy szereplő lapjából. Ez alkuképes: minél többet
   küldünk, annál hívebb a karakter, de annál lassabban engedi át a
   szolgáltató. A játékos állítja be a Világ fülön. */
const DETAIL_LEVELS = [
  { id: 1, nameHu: "Takarékos", nameEn: "Economy", mul: 0.5, cast: 5, noteHu: "Fele keret, cserébe szinte sosem kell várni.", noteEn: "Half the budget, and you almost never have to wait." },
  { id: 2, nameHu: "Teljes", nameEn: "Full", mul: 1.0, cast: 4, noteHu: "Személyiség 10 000, történet 15 000 karakter.", noteEn: "Personality 10,000, story 15,000 characters." },
  { id: 3, nameHu: "Bőkezű", nameEn: "Generous", mul: 1.6, cast: 3, noteHu: "Másfélszeres keret, néha várni kell.", noteEn: "One and a half times the budget; expect occasional waiting." },
  { id: 4, nameHu: "Maximum", nameEn: "Maximum", mul: 2.4, cast: 2, noteHu: "A legtöbb, ami elfér — gyakori a várakozás.", noteEn: "The most that fits — waiting is common." },
];
let DETAIL = 2;   // az app indításkor beállítja a mentett értékre
let CURRENT_LANG = "hu";   // globálisan elérhető nyelv a nem-komponens (pl. timeAgo) függvényekhez
const detailInfo = () => DETAIL_LEVELS.find((x) => x.id === DETAIL) || DETAIL_LEVELS[1];

/* Rövid mezők: ezekből pár mondat is elég, nem visszük el a keretet.
   Nem is skálázódnak a részletességgel — a hely a hosszú mezőknek kell. */
/* Szűk keretű mezők: ezekhez pár mondat is elég, nem kell rájuk sok hely.
   [ha csak jelen van, ha ő a főszereplő] */
/* A hangot adó mezők kapják a legnagyobb keretet — a sűrítés miatt van rá hely.
   [ha csak jelen van, ha ő a főszereplő] */
/* A LÉNYEG: a személyiség és a történet kapja a legnagyobb keretet, mert
   ezekből következik minden. A többi mező szándékosan szűk — azokat te
   tömörebbre tudod írni. [ha csak jelen van, ha ő a főszereplő] */
const CORE_CAP = { personality: 10000, backstory: 15000, secrets: 1800, extra: 1200 };

/* A te karakterednél szűkebb a keret: az AI SOHA nem játszik téged, csak
   reagál rád — ezért nem kell ismernie a teljes belső világodat. */
const PLAYER_CORE = { personality: 4000, backstory: 3500, secrets: 800, extra: 600 };

const coreCap = (key, isPlayerSheet, deep) => {
  const base = (isPlayerSheet ? PLAYER_CORE : CORE_CAP)[key] || 0;
  const scale = detailInfo().mul * (deep ? 1 : 0.3);
  return Math.round(base * scale);
};

const FIELD_BASE = {
  voice:  [700, 2000],   // a szó szerinti hangminta
  speech: [320, 800],
  traits: [120, 260],
  goals:  [120, 260],
  fears:  [110, 240],
  likes:  [100, 220],
  looks:  [120, 260],
};

/* Korlátlan mezők: ezek teljes egészében átmennek, bármilyen hosszúak.
   Itt lakik a karakter lényege, ezért nem nyúlunk hozzájuk. */
const FIELD_FREE = {
  personality: 1, secrets: 1, backstory: 1, extra: 1,
  nick: 1, job: 1, city: 1, gender: 1, orientation: 1, birth: 1, height: 1, album: 1, bio: 1,
};

/* Végső biztonsági határ: enélkül egy nagyon hosszú lapból olyan kérés
   születne, amit a modell egyszerűen nem tud egyben feldolgozni. */
const HARD_CEILING = 120000;

/* A JÁTÉKOS lapja szűkebb kereten fér be. Ennek nem a spórolás az oka:
   az AI soha nem szólalhat meg helyetted, ezért nem is kell ismernie a
   belső világodat — csak azt, kire reagál. Ettől lesz gyors a játék. */
const PLAYER_CAP = 6000;

/* ---------- sűrített profil ----------
   A hosszú adatlapból EGYSZER készül egy tömör kivonat, és onnantól az megy át
   minden hívásnál. Az eredeti adatlapod érintetlen marad — csak az AI-nak szóló
   csomag lesz tizedakkora, amitől eltűnik a torlódás. */
const BRIEF_TRIGGER = 14000;  // efölött érdemes sűríteni
/* A kivonat a személyiségre és a történetre koncentrál — ezek a karakter lényege.
   A részletesség-kapcsoló ezt is arányosan növeli. */
const briefTarget = () => Math.round(2500 * detailInfo().mul);

/* A személyiségből és a történetből a kivonat MELLETT nyers részlet is megy:
   a kivonat az ívet adja, a nyers szöveg a te fogalmazásod ízét. */

const FREE_KEYS = ["personality", "secrets", "backstory", "extra"];
const rawLen = (c) => FREE_KEYS.reduce((sum, k) => sum + cleanLen(c && c[k]), 0);

/* Kell-e (újra) sűríteni? Akkor is, ha időközben sokat írtál hozzá. */
function briefState(c) {
  const src = c.__src !== undefined ? c.__src : rawLen(c);
  if (src <= BRIEF_TRIGGER) return "nem kell";
  if (!c.brief) return "hiányzik";
  if (Math.abs(src - (c.briefSrc || 0)) > 2500) return "elavult";
  return "kész";
}
const useBrief = (c) => !!(c && c.brief && briefState(c) !== "hiányzik");
const WORLD_CAP = 4000;   // a világleírásból ennyi megy át minden hívásnál

const SHEET_BASE = 2600;       // a szűk keretű mezők közös kerete, ha csak jelen van
const SHEET_BASE_DEEP = 7000;  // ugyanaz, ha ő a főszereplő

/* Becslés: mekkora egy privát beszélgetés kérése az adott fokozaton.
   Magyar szövegnél kb. 2,7 karakter egy token. */
function estimateCall(w, mul) {
  const per = (c, isPlayer) => {
    if (!c) return 0;
    const base = isPlayer ? PLAYER_CORE : CORE_CAP;
    const core = Object.keys(base).reduce(
      (sum, k) => sum + Math.min(cleanLen(c[k]), Math.round(base[k] * mul)), 0);
    const tight = Object.keys(FIELD_BASE).reduce(
      (sum, k) => sum + Math.min(cleanLen(c[k]), FIELD_BASE[k][1]), 0);
    return core + tight + Math.round(2500 * mul);
  };
  const focus = (w.chars || [])[0];
  return Math.round((13000 + per(w.player, true) + per(focus, false)) / 2.7);
}

const capSheet = (deep) => Math.round((deep ? SHEET_BASE_DEEP : SHEET_BASE) * detailInfo().mul);
const isFree = (key) => !!FIELD_FREE[key];
const CAST_MAX = 4;           // ennyi szereplő fér bele egy hívásba           // ennyi szereplő fér bele egy hívásba

const cut = (v, n) => {
  const t = String(v || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};

/* Hosszú mezőből nem csak az elejét visszük át, hanem az elejét, a közepét és
   a végét is. Egy több ezer karakteres hangmintánál így a szereplő teljes
   hangterjedelme átjön, nem csak az első pár mondata. */
function spread(v, n) {
  const t = String(v || "").replace(/[ \t]+/g, " ").trim();
  if (t.length <= n) return t;
  const piece = Math.floor(n / 3);
  const mid = Math.floor(t.length / 2 - piece / 2);
  const parts = [
    t.slice(0, piece),
    t.slice(mid, mid + piece),
    t.slice(t.length - piece),
  ].map((x) => x.replace(/\s+/g, " ").trim());
  return parts.join(" […] ");
}
/* A rövid mezők plafonja. A korlátlanoknál nincs ilyen — ők a maradékon osztoznak. */
const fieldCap = (key, deep) => {
  const b = FIELD_BASE[key];
  if (!b) return 0;                       // 0 = nincs saját plafon
  return b[deep ? 1 : 0];                 // a részletesség nem duzzasztja ezeket
};
const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

/* Ugyanaz a hossz, mint clean(v).length, de nem gyárt új szöveget.
   Nagy mezőknél ez a különbség akadó és folyamatos gépelés között. */
function cleanLen(v) {
  const t = String(v || "");
  let n = 0, pendingSpace = false, started = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t.charCodeAt(i);
    if (ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 12 || ch === 11) { pendingSpace = true; continue; }
    if (pendingSpace && started) n++;
    pendingSpace = false; started = true; n++;
  }
  return n;
}

function sheet(c, w, deep, isPlayerSheet, accessMode = "private") {
  const privateOnly = { personality: 1, traits: 1, speech: 1, voice: 1, goals: 1, fears: 1, likes: 1, secrets: 1, backstory: 1, extra: 1, album: 1 };
  const rows = [
    ["személyiség", "personality", c.personality],
    ["beszédstílus", "speech", c.speech],
    ["ÍGY BESZÉL (szó szerinti minta)", "voice", c.voice],
    ["tulajdonságok", "traits", c.traits],
    ["célok", "goals", c.goals],
    ["félelmek", "fears", c.fears],
    ["titkok", "secrets", c.secrets],
    ["kedvencek", "likes", c.likes],
    ["külső", "looks", c.looks],
    ["kor", "age", ageOf(c, w) ? ageOf(c, w) + " " + termText("yearsOld", worldLanguage(w)) : ""],
    ["nem", "gender", c.gender],
    ["szexualitás", "orientation", c.orientation],
    ["foglalkozás", "job", c.job],
    ["város", "city", c.city],
    ["becenév", "nick", c.nick],
    ["egyéb", "extra", c.extra],
    ["háttér", "backstory", c.backstory],
    ["albuma", "album", albumList(c)],
  ];

  let out = `[${c.id}] ${c.name} (@${c.username})`;
  let freeUsed = 0;
  if (c.bio) {
    out += `\n  NYILVÁNOS BIO (ezt írta ki magáról a profiljára, mint egy Instagram-bemutatkozást — dísz és ízelítő, DE NEM SZABÁLY: a viselkedését a SZEMÉLYISÉG, a TITKOK és a TÖRTÉNET írja elő, ne csak ebből következtess): ${clean(c.bio)}`;
  }
  if (c.gender) {
    out += `\n  NEM (kötelező): ${clean(c.gender)}. A beszédmódjában, a reakcióiban és a viselkedésében ezt a nemet mindig tükröznie kell.`;
  }
  if (accessMode !== "public" && useBrief(c)) out += `\n  AMI A LAPJÁN MÉG SZEREPEL (sűrítve): ${clean(c.brief)}`;

  rows.forEach(([label, key, v]) => {
    if (accessMode === "public" && privateOnly[key]) return;
    const t = clean(v);
    if (!t) return;

    let val;
    if (FREE_KEYS.indexOf(key) >= 0) {
      const room = coreCap(key, isPlayerSheet, deep);
      if (!room) return;
      out += `\n  ${label}: ${t.length <= room ? t : spread(t, room)}`;
      return;
    }
    if (isFree(key)) {
      // korlátlan mező: teljes egészében megy, csak a végső plafon fogja meg
      const limit = isPlayerSheet ? PLAYER_CAP : (deep ? HARD_CEILING : 9000);
      const room = limit - freeUsed;
      if (room <= 0) return;
      val = t.length <= room ? t : spread(t, room);
      freeUsed += val.length;
    } else {
      const cap = fieldCap(key, deep) || (deep ? 300 : 160);
      const wide = key === "voice" || key === "speech";
      val = (wide ? spread : cut)(t, cap);
    }
    out += `\n  ${label}: ${val}`;
  });

  return out;
}

function knownLinesForObserver(w, observerId, targetId) {
  if (!observerId || observerId === targetId) return "";
  const observerMem = ensureCharMemory(w, observerId);
  const row = observerMem.knownCharacters && observerMem.knownCharacters[targetId];
  if (!row) return "";
  const parts = [];
  if ((row.observedTraits || []).length) parts.push(`megfigyelt jegyek: ${(row.observedTraits || []).slice(-3).map(memoryToLine).join(" | ")}`);
  if ((row.learnedInformation || []).length) parts.push(`megszerzett infók: ${(row.learnedInformation || []).slice(-3).map(memoryToLine).join(" | ")}`);
  if ((row.assumptions || []).length) parts.push(`feltételezések (nem biztos): ${(row.assumptions || []).slice(-2).map(memoryToLine).join(" | ")}`);
  if ((row.knownEvents || []).length) parts.push(`ismert események: ${(row.knownEvents || []).slice(-2).map(memoryToLine).join(" | ")}`);
  return parts.length ? `\n  amit róla tudsz: ${parts.join(" ; ")}` : "";
}

function selfMemoryForPrompt(w, id) {
  const mem = ensureCharMemory(w, id);
  const bits = [];
  if ((mem.knownFacts || []).length) bits.push(`tények: ${(mem.knownFacts || []).slice(-5).map(memoryToLine).join(" | ")}`);
  if ((mem.witnessedEvents || []).length) bits.push(`szemtanú események: ${(mem.witnessedEvents || []).slice(-4).map(memoryToLine).join(" | ")}`);
  if ((mem.rumors || []).length) bits.push(`pletykák: ${(mem.rumors || []).slice(-3).map(memoryToLine).join(" | ")}`);
  if ((mem.suspicions || []).length) bits.push(`feltételezések: ${(mem.suspicions || []).slice(-3).map(memoryToLine).join(" | ")}`);
  if ((mem.learnedSecrets || []).length) bits.push(`megtanult titkok: ${(mem.learnedSecrets || []).slice(-2).map(memoryToLine).join(" | ")}`);
  return bits.join(" ; ") || "semmi különös";
}

/* A hang közvetlenül a feladat elé — így nem sikkad el a sok szöveg végén. */
function voiceCard(c) {
  const bits = [];

  if (c.gender) {
    bits.push(
      `Neme: ${spread(c.gender, 80)} — a hangjában, beszédmódjában és reakcióiban ezt a nemet kell tükröznie.`
    );
  }

  if (c.speech) {
    bits.push(`Beszédstílus: ${spread(c.speech, 900)}`);
  }

  if (c.voice) {
    bits.push(
      `Példamondatok — CSAK STÍLUSIRÁNYMUTATÁS:
${spread(c.voice, 2200)}

FONTOS:
- Ezek NEM kész válaszok és NEM szó szerinti sablonok.
- Ne másold őket.
- Ne parafrazáld őket újra és újra.
- Ne használd folyamatosan ugyanazokat a mondatkezdéseket, poénokat, fenyegetéseket, flörtöléseket, beceneveket vagy szófordulatokat.
- Csak a hangnemet, szóhasználatot, ritmust, szlenget, központozást és személyiséget tanuld meg belőlük.
- Minden új megszólalás legyen eredeti és az aktuális helyzetből szülessen.`
    );
  }

  if (c.personality) {
    bits.push(
      `Röviden te: ${spread(c.brief || c.personality, 900)}`
    );
  }

  if (!bits.length) return "";

  return `

--- ${String(c.name).toUpperCase()} HANGJA — EBBŐL DOLGOZZ ---
${bits.join("\n")}
--- eddig a hang ---`;
}

function publicVoiceCard(w, c, observerId) {
  if (!c) return "";
  const observed = recentLines(w, c.id);
  const known = knownLinesForObserver(w, observerId, c.id);
  const bits = [];
  if (c.bio) bits.push(`Nyilvános bio: ${spread(c.bio, 220)}`);
  if (c.looks) bits.push(`Külső: ${spread(c.looks, 120)}`);
  if (observed.length) bits.push(`Megfigyelt megszólalásai: ${observed.join(" | ")}`);
  if (known) bits.push(known.replace(/^\n\s*/, ""));
  if (!bits.length) return "";
  return `\n\n--- ${String(c.name).toUpperCase()} NYILVÁNOS HANGNYOMAI ---\n${bits.join("\n")}\n--- eddig a nyilvános hangnyom ---`;
}

function recentLines(w, id) {
  const out = [];
  (w.posts || []).slice(0, 12).forEach((p) => {
    if (p.authorId === id) out.push(`posztja: ${cut(p.text, 90)}`);
    (p.comments || []).forEach((c) => { if (c.authorId === id) out.push(`kommentje: ${cut(c.text, 70)}`); });
  });
  return out.slice(0, 3);
}

function recentUtterancesFor(w, id, limit = 4) {
  const out = [];
  (w.posts || []).slice(0, 16).forEach((p) => {
    if (p.authorId === id && p.text) out.push(cut(p.text, 120));
    (p.comments || []).forEach((c) => {
      if (c.authorId === id && c.text) out.push(cut(c.text, 120));
    });
  });
  Object.keys(w.chats || {}).forEach((k) => {
    const rows = w.chats[k] || [];
    rows.forEach((m) => {
      if (m && m.from === "them") {
        const otherId = k.split("|")[1];
        if (otherId === id && m.text) out.push(cut(m.text, 120));
      }
    });
  });
  (w.groups || []).forEach((g) => {
    (g.msgs || []).forEach((m) => { if (m && m.from === id && m.text) out.push(cut(m.text, 120)); });
  });
  (w.scenes || []).forEach((s) => {
    (s.turns || []).forEach((t) => { if (t && t.authorId === id && t.text) out.push(cut(t.text, 120)); });
  });
  return out.slice(-limit);
}

function repetitionGuard(w, ids, label) {
  const lang = worldLanguage(w, w && w.meId);
  const tt = (hu, en) => (lang === "en" ? en : hu);
  const labelMap = {
    "kommentek": "comments",
    "kommentválaszok": "comment replies",
    "autonóm posztok és kommentek": "autonomous posts and comments",
    "jelenetfolytatás": "scene continuation",
    "csoportchat": "group chat",
    "privát üzenetek": "private messages",
    "jegyzetek": "notes",
  };
  const scopedLabel = lang === "en" ? (labelMap[label] || label || "") : (label || "");
  const rows = (ids || []).map((id) => {
    const c = charById(w, id);
    const lines = recentUtterancesFor(w, id, 3);
    if (!c || !lines.length) return "";
    return `${c.name}: ${lines.join(" | ")}`;
  }).filter(Boolean);
  if (!rows.length) return "";
  return `

${tt("KERÜLD AZ ISMÉTLÉST", "AVOID REPETITION")}${scopedLabel ? ` — ${scopedLabel}` : ""}:
- ${tt("Ne használd újra ugyanazokat a mondatkezdéseket, fordulatokat, sértéseket, bókokat vagy ritmust.", "Do not reuse the same sentence openings, turns of phrase, insults, compliments, or rhythm.")}
- ${tt("Ne parafrazáld túl közelről a lentebbi friss megszólalásokat.", "Do not paraphrase the recent lines below too closely.")}
- ${tt("Minden új szöveg vigyen új hangsúlyt, új képet vagy új támadási/szeretetnyelvet.", "Each new line must bring a fresh emphasis, image, or attack/affection style.")}
${tt("Friss minták, amiket NEM szabad újrahasznosítani:", "Recent lines you must NOT recycle:")}
${rows.join("\n")}`;
}

const REP_WORD_MIN = 3;
const REP_JACCARD_LIMIT = 0.74;
const REP_PREFIX_LEN = 42;

function normUtterance(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(v) {
  const set = new Set();
  normUtterance(v).split(" ").forEach((w) => {
    const t = w.trim();
    if (t.length >= REP_WORD_MIN) set.add(t);
  });
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  a.forEach((x) => { if (b.has(x)) hit++; });
  return hit / (a.size + b.size - hit);
}

function isRepetitiveUtterance(w, id, text) {
  const base = normUtterance(text);
  if (!base || base.length < 18) return false;
  const first = base.slice(0, REP_PREFIX_LEN);
  const mine = wordSet(base);
  const prev = recentUtterancesFor(w, id, 6);
  for (let i = 0; i < prev.length; i++) {
    const old = normUtterance(prev[i]);
    if (!old) continue;
    if (old.slice(0, REP_PREFIX_LEN) === first) return true;
    if (jaccard(mine, wordSet(old)) >= REP_JACCARD_LIMIT) return true;
  }
  return false;
}

function cleanGeneratedUtterance(w, id, text, maxLen = 500) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (isRepetitiveUtterance(w, id, t)) return "";
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

/* Kihez hogyan viszonyul — IRÁNYÍTOTTAN: külön amit ő érez, és külön,
   amit iránta éreznek. Ettől lehet egyoldalú a vonzalom. */
function bondLines(w, id, includeHidden) {
  const out = [];
  allSubjects(w).forEach((o) => {
    if (o.id === id || !linked(w, id, o.id)) return;
    const mine = getRel(w, id, o.id);
    const theirs = getRel(w, o.id, id);
    const bond = mine.bond || mine.type || "";
    let line = `${o.name}${bond ? ` (${localizedBond(bond, worldLanguage(w))}${mine.fixed ? (worldLanguage(w) === "en" ? ", fact" : ", tény") : ""})` : ""}: ${mine.score}`;
    if (mine.mood) line += ` — ${cut(mine.mood, 40)}`;
    if (includeHidden && mine.hidden) line += ` | ${worldLanguage(w) === "en" ? "hidden" : "titkon"}: ${cut(mine.hidden, 70)}`;
    if (includeHidden && theirs.mood) line += ` | ${worldLanguage(w) === "en" ? "they feel" : "ő viszont"}: ${cut(theirs.mood, 40)}`;
    out.push(line);
  });
  return out.slice(0, 8);
}

function deepBrief(w, c, isPlayerSheet, observerId) {
  const selfView = observerId && observerId === c.id;
  const lang = worldLanguage(w, observerId || w.meId);
  const tt = (hu, en) => (lang === "en" ? en : hu);
  const mems = selfView
    ? (w.mems[c.id] || []).slice(-4).map((m) => cut(m, 90))
    : [];
  const lines = recentLines(w, c.id);
  const bonds = bondLines(w, c.id, selfView);
  const body = selfView
    ? sheet(c, w, true, isPlayerSheet, "private")
    : sheet(c, w, true, isPlayerSheet, "public");
  return body +
    (!selfView ? knownLinesForObserver(w, observerId, c.id) : "") +
    (bonds.length ? `\n  ${tt("viszonyai", "relationships")}: ${bonds.join(" ; ")}` : "") +
    (mems.length ? `\n  ${tt("emlékei", "memories")}: ${mems.join(" | ")}` : "") +
    (lines.length ? `\n  ${tt("mostanában", "lately")}: ${lines.join(" | ")}` : "");
}

/* A világ teljes névsora. Olcsó (csak nevek), de ettől nem talál ki senkit:
   látja, kik léteznek, még azokat is, akiknek most nem fér be a lapja. */
function rosterLine(w) {
  const rows = [];
  humanChars(w).forEach((h) => rows.push(`${h.name} (@${h.username}) — ${termText("player", worldLanguage(w))}`));
  (w.chars || []).forEach((c) => rows.push(`${c.name} (@${c.username})`));
  (w.extras || []).forEach((e) => rows.push(`${e.name}${e.note ? " — " + cut(e.note, 60) : ""}`));
  return rows.join("\n");
}

function worldContext(w, ids, deep, observerId) {
  const focus = ids && ids.length ? ids : null;
  let cast = (w.chars || []).filter((c) => !focus || focus.indexOf(c.id) >= 0);
  if (!focus) cast = cast.slice(0, detailInfo().cast);
  const extras = (w.extras || []).slice(0, 8);
  const knownCtx = observerId
    ? buildKnownCharacterContext(observerId, [w.player].concat(cast), w)
    : [];
  const selfMem = observerId ? ensureCharMemory(w, observerId) : null;

  // csak azok a kapcsolatok, amik a jelenlévőket érintik
  const inPlay = {};
  cast.forEach((c) => { inPlay[c.id] = 1; });
  inPlay[w.meId] = 1;
  const rels = [];
  Object.keys(w.rels || {}).forEach((k) => {
    if (rels.length >= 14) return;
    const [x, y] = k.split(">");
    if (!inPlay[x] && !inPlay[y]) return;
    const r = w.rels[k];
    if (!r || (!r.score && !r.mood && !r.bond)) return;
    const A = charById(w, x), B = charById(w, y);
    if (!A || !B) return;
    const bond = r.bond || r.type || "";
    rels.push(`${A.name} → ${B.name}: ${observerId ? r.score : relType(r.score)}` +
      (observerId && r.mood ? ` — ${cut(r.mood, 40)}` : "") +
      (bond ? (r.fixed ? ` | ${localizedBond(bond, worldLanguage(w, observerId || w.meId))} (${worldLanguage(w, observerId || w.meId) === "en" ? "fact" : "tény"})` : ` | ${localizedBond(bond, worldLanguage(w, observerId || w.meId))}`) : ""));
  });

  const notes = notesForAI(w);
  const knownTimeline = observerId
    ? mergeKnowledgeItems([], (selfMem.witnessedEvents || []).concat(selfMem.knownFacts || []), "timeline", 10)
        .slice(-4).map(memoryToLine)
    : [];
  const outLang = worldLanguage(w, observerId || w.meId);
  const tt = (hu, en) => (outLang === "en" ? en : hu);

  const roster = rosterLine(w);

  return `${tt(
    "KIMENETI NYELV: magyar. Minden felhasználónak látható mező magyar legyen; ne írj angol felhasználói szöveget.",
    "OUTPUT LANGUAGE: English. Every user-visible field must be English; do not output Hungarian text."
  )}

${tt("VILÁG", "WORLD")}: ${w.universe.name} — ${worldToday(w)}
${spread(w.universe.description, WORLD_CAP)}

${tt("A JÁTÉKOS KARAKTERE — ŐT KIZÁRÓLAG A FELHASZNÁLÓ IRÁNYÍTJA.", "THE PLAYER CHARACTER — ONLY THE USER CONTROLS THEM.")}
${tt(
    "Soha ne adj a szájába szöveget, ne írj helyette posztot, kommentet, üzenetet vagy jegyzetet,\nne lájkoltass vele, és ne írd le, mit tesz vagy mit érez. Csak REAGÁLJ rá.",
    "Never put words in their mouth. Do not write posts, comments, messages, or notes for them,\ndo not make them like anything, and do not describe what they do or feel. Only REACT to them."
  )}
${tt(
    "Ha egy jelenet úgy folytatódna, hogy neki kellene lépnie, állj meg ott, és hagyd rá a döntést.",
    "If the scene would require the player's move next, stop there and leave the decision to them."
  )}
${deep ? deepBrief(w, w.player, true, observerId) : sheet(w.player, w, false, true, observerId === w.meId ? "private" : "public")}

${tt("A VILÁG TELJES NÉVSORA — RAJTUK KÍVÜL SENKI NEM LÉTEZIK", "FULL WORLD ROSTER — NO ONE ELSE EXISTS")}: 
${roster || "-"}

${tt("AKIK MOST SZÓHOZ JUTHATNAK", "WHO CAN SPEAK RIGHT NOW")}: 
${cast.map((c) => (deep ? deepBrief(w, c, false, observerId) : sheet(c, w, false, false, observerId === c.id ? "private" : "public"))).join("\n") || "-"}
${extras.length ? `
${tt("EMLÍTETT SZEMÉLYEK — léteznek, de nem szólalnak meg maguktól", "MENTIONED PEOPLE — they exist, but do not speak on their own")}: 
${extras.map((e) => `[${e.id}] ${e.name}${e.note ? " — " + cut(e.note, 90) : ""}`).join("\n")}` : ""}
${knownCtx.length ? `

${tt("AMIT MÁSOKRÓL KÜLÖN TUDSZ (saját emlék, pletyka, következtetés)", "WHAT YOU SPECIFICALLY KNOW ABOUT OTHERS (memory, rumor, inference)")}: 
${knownCtx.map((x) => {
  const rel = x.knownInformation || {};
  const learned = (rel.learnedInformation || []).slice(-2).map(memoryToLine).join(" | ");
  const assumptions = (rel.assumptions || []).slice(-1).map(memoryToLine).join(" | ");
  return `${x.publicProfile && x.publicProfile.name ? x.publicProfile.name : x.id}: ${learned || tt("nincs külön infó", "no specific info")}${assumptions ? ` ; ${tt("feltételezés", "assumption")}: ${assumptions}` : ""}`;
}).join("\n")}` : ""}

${tt("KAPCSOLATOK (irányítottak: \"A → B\" azt jelenti, A mit érez B iránt)", "RELATIONSHIPS (directional: \"A -> B\" means what A feels toward B)")}: 
${rels.join("\n") || tt("még nincs rögzítve", "nothing recorded yet")}
${notes ? `\n${tt("MOSTANI JEGYZETEK", "CURRENT NOTES")}:\n${cut(notes, 260)}` : ""}

${tt("MOSTANÁBAN TÖRTÉNT", "RECENT EVENTS")}: 
${(observerId ? knownTimeline : (w.log || []).slice(0, 4).map((l) => cut(l, 120))).join("\n") || "-"}`;
}

const ENGINE = `Te egy élő, AI-vezérelt közösségi média világ motorja vagy egy szerepjátékhoz.
Minden szereplőt a saját adatlapja alapján játszol el. Az adatlap nem háttérinfó: az a szereplő hangja.

FŐ SZABÁLY: minden válasz legyen karakterhű, természetes, emberi és az adott helyzethez illő. A karakter személyisége, története, aktuális érzései és kapcsolatai határozzák meg, MIT mond — de a felület határozza meg, HOGYAN és milyen hosszan mondja.

KOMMUNIKÁCIÓS FORMÁTUM

- PRIVÁT CHAT / DM: valódi telefonos üzenetváltásnak hasson. Általában rövid legyen; gyakran 1–4 rövid mondat vagy üzenetrész, de akár egyetlen szó, néhány szó vagy töredékes reakció is teljesen természetes. Ne írj esszét, monológot, narrációt vagy regényszerű bekezdéseket normál chatben.

- GROUP CHAT: gyors, közvetlen, spontán csevegésnek hasson. A szereplők reagáljanak egymásra, félbeszakíthatják egymást, visszakérdezhetnek, beszólhatnak, viccelődhetnek vagy nagyon röviden reagálhatnak. Ne mindenki külön monológot mondjon. Egy üzenet gyakran csak néhány szó vagy egy rövid mondat.

- KOMMENT: valódi közösségi médiás reakció legyen. A legtöbb komment legyen nagyon rövid, gyakran 1–12 szó. 13–20 szó csak ritkábban, ha tényleg indokolt. Egyetlen szó, 1–3 szavas reakció, rövid kérdés vagy töredék is teljesen természetes. Kommentben ne írj bekezdést, monológot, narrációt, belső gondolatot vagy regényszerű szöveget.

- ROLEPLAY / JELENET: itt MARADHAT a részletes, hosszabb, atmoszférikus, könyves stílus, testbeszéddel, cselekvéssel, belső reakciókkal és több bekezdéssel. A roleplay-jelenetet ne rövidítsd le a chat- vagy kommentszabályok miatt.

- POSZT: a hosszát a tartalom, a karakter és a helyzet határozza meg. Lehet egy rövid spontán gondolat, de indokolt esetben hosszabb, részletesebb poszt is. Ne legyen automatikusan rövid vagy automatikusan hosszú.

- JEGYZET / NOTE: rövid, spontán közösségi médiás Note legyen. Gyakran csak néhány szó vagy egy rövid félmondat. Ne váljon mini-poszttá, naplóbejegyzéssé vagy monológgá.

EMOJI

- Chatben, group chatben, kommentben, posztban és Note-ban az emoji-használat mindig az adott karakter természetes online kommunikációjához igazodjon.

- Ha egy karakter személyisége és kommunikációs stílusa alapján természetesen használ emojikat, akkor ténylegesen használjon is időnként; ne válaszd automatikusan mindig az emoji nélküli változatot.

- Kifejezőbb, lazább vagy erősen online kommunikáló karakter egy rövid üzenetben akár több természetes emojit is használhat, míg visszafogott karakter ritkán vagy egyáltalán nem használ.

- Ne tegyél emojit minden üzenetbe, és ne erőltesd olyan karakterre, akire nem jellemző.

- Az emoji helye is változhat: lehet a mondat végén, közepén, önálló reakcióként vagy rövid szöveg mellett, ha természetes.

- Ritkán egy emoji vagy emoji-kombináció önmagában is lehet teljes reakció, ha az adott helyzetben és az adott karaktertől hiteles.

- Ne ismételd folyton ugyanazokat az emojikat vagy emoji-kombinációkat.

- Az emoji jelentése mindig illeszkedjen ahhoz, amit a karakter ténylegesen érez vagy közölni akar.

VÁLTOZATOSSÁG ÉS ISMÉTLÉS TILALMA
- Ne ismételd ugyanazokat a mondatkezdéseket, szófordulatokat, poénokat, flörtölési mintákat, fenyegetéseket, sértéseket, beceneveket vagy reakciókat.
- Ne parafrazáld újra és újra ugyanazt más szavakkal.
- Ne legyen a karakternek egyetlen sablonreakciója minden hasonló helyzetre.
- Változtasd természetesen a mondathosszt, szókincset, ritmust, humort, érzelmi reakciót és központozást.
- A következetes személyiség NEM azt jelenti, hogy ugyanazokat a mondatokat ismétli.
- Ha a karakter nemrég már nagyon hasonlót mondott, fogalmazzon vagy reagáljon másképp.
- A példamondatok kizárólag hang- és stílusiránymutatások. Nem kész válaszok, nem catchphrase-ek és nem sablonok.

A hangot ne csak egyetlen szókapcsolattal add meg: a karakter beszédéből legyen felismerhető a személyisége, indulata, humora, gőgje, bizonytalansága, vágyakozása vagy cinizmusa. Ne szólj úgy, mint egy általános AI-asszisztens.

A magyar nyelvtan legyen pontos. Használj helyes névmásokat, ragozásokat és természetes mondatszerkezeteket. A rövid chatüzenet is legyen nyelvileg természetes, de nem kell minden mondatnak irodalmi prózának hangzania.

KÜLÖNÖSEN FONTOS: ne próbáld minden helyzetben „szépre” vagy drámaira írni a választ. Egy hétköznapi chat legyen hétköznapi chat, egy komment legyen komment, egy roleplay jelenet pedig lehet részletes és atmoszférikus. A karakter hitelessége fontosabb, mint a választékos megfogalmazás.
VONZALOM, FESZÜLTSÉG, ÉRZÉKISÉG
- Ha a kapcsolat vagy a jelenet ezt indokolja, a vágyakozást, a féltékenységet, a testi közelséget és a romantikus feszültséget bátran írd meg intenzíven, érzékien, felnőtt hangvétellel: a tekintetek, az érintés, a légzés, a köztük lévő távolság vagy annak hiánya mind számít.
- Az érzékiséget és a szexuális vonzalmat éreztetni, sejtetni, felépíteni kell — a hangsúly a feszültségen, a vágyon és az érzelmi tétjén van, nem az anatómiai vagy grafikusan explicit leíráson. Ne írj le pornográf részletességgel testi aktust.
- Kettőjük között a kimondatlan is számít: egy elhaló mondat, egy megszakadt pillanat, egy tekintet gyakran erősebb, mint a kimondott szó.
- Kiskorú szereplő soha, semmilyen formában nem kerülhet romantikus vagy szexuális helyzetbe — ez alól nincs kivétel.

NYERSESÉG, AGRESSZIÓ, KÁROMKODÁS
- Ha a szereplő személyisége, indulata vagy a helyzet ezt hozza, nyugodtan legyen durva, nyers, agresszív vagy trágár — a káromkodást és a durva beszédet ne szépítsd el és ne kerüld meg, ha az adatlapja vagy a hangmintája ezt sugallja. A hamis simaság rosszabb hiba, mint egy kemény szó.
- Egy dühös, veszélyes vagy kegyetlen szereplő tényleg legyen az: fenyegethet, gúnyolódhat, megalázhat, ha ez illik hozzá. Ne finomítsd le "biztonságosra".
- Egy instabil, zaklatott vagy mentálisan beteg szereplőt hitelesen kell megírni: a gondolatmenete legyen tényleg torz, szaggatott, kényszeres vagy paranoid, ahogy az adatlapja leírja — ne szelídítsd meg, és ne kommentáld kívülről, mint egy figyelmeztetést. A hitelesség itt a cél, nem az elrettentés.

SZEREPLÉSI SZABÁLYOK
- MI SZÁMÍT A LEGJOBBAN: a SZEMÉLYISÉG és a TÖRTÉNET. Ezek döntik el, hogyan reagál egy helyzetre — a többi mező csak árnyalja. Mielőtt írsz, nézd meg, ki ez az ember és mi történt vele; a válasz ebből következzen, ne a helyzet általános logikájából.
- Amit a szereplő átélt, az ma is hat rá. Ha valami a történetében nyitva maradt, az beleszól a mostani mondataiba is.
- - A HANGMINTA CSAK IRÁNYMUTATÁS. A példamondatokból a karakter szóhasználatát, ritmusát, humorát, szlengjét, központozását és általános beszédmódját tanuld meg, de SOHA ne másold vagy parafrazáld rendszeresen a konkrét mondatokat. Új helyzetben új, eredeti megszólalást írj.
- Két szereplő mondatai soha ne legyenek felcserélhetők. Ha letakarnád a nevet, a szövegből akkor is ki kellene derülnie, ki beszél.
- Ha a szereplő tömören beszél, ne írj helyette kerek, elemző mondatokat. Ha csapong, csapongjon. A modorosságai, a szavajárása, a félbehagyott mondatai maradjanak meg.
- Semleges, sima, "szép" fogalmazás = hiba. Az a jel, hogy kiestél a szerepből.
- A személyiséget ne írd le, hanem mutasd meg abban, amit mond és tesz.
- Nincs semleges, segítőkész "asszisztens" hangnem. Mindenkinek van hangulata, véleménye és célja, és az most is hat rá.
- A szereplő csak azt tudhatja, amit átélt, látott vagy hallott. Az emlékeire és a régi sérelmekre nyugodtan hivatkozhat.
- A kapcsolati pontszám megszabja a hangnemet: mínuszban nem kedveskedik, magas értéknél nem távolságtartó. A rejtett érzés nem hangzik el nyíltan, csak érződik.
- A mondatok legyenek természetesek, közvetlenek, színesek, nem ökölszabályosak. A beszéd legyen emberi, árnyalt, néha szaggatott, néha szebben cizellált.

A KAPCSOLAT EGYIRÁNYÚ — EZ FONTOS
- Minden viszonyt két külön irány ír le: "A → B" azt jelenti, A mit érez B iránt. Ez nem feltétlenül ugyanaz, mint "B → A".
- Egy vonzalom, egy gyűlölet vagy egy titkos érzés lehet teljesen egyoldalú. Ha az egyik odavan a másikért, abból még semmi nem következik a másik oldalon: lehet, hogy nem is tud róla, kínosnak találja, kihasználja, vagy viszonozza — de ezt a másik saját sora dönti el.
- A "changes" minden eleme EGY irányra vonatkozik: az "a" mezőben az van, AKI érez, a "b" mezőben az, AKI IRÁNT. Ha tényleg mindkettejükben változott valami, adj két külön elemet.
- A titkos érzést soha ne vetítsd ki a másikra, és ne tedd kölcsönössé magadtól.
- A rokoni kötelék a kivétel: az tény, és mindkét irányban érvényes — de az érzések ilyenkor is külön alakulnak.
- ÁLLANDÓ KÖTELÉK (rokonság, pl. anya, apa, testvér, unokatestvér): megmásíthatatlan tény. Sosem írhatod felül, nem feledkezhetsz meg róla, és a szereplők úgy is beszélnek egymásról, ahogy egy ilyen viszonyban szokás — akkor is, ha épp utálják egymást. A pontszám ilyenkor csak azt mutatja, milyen most köztük a viszony, nem azt, hogy kik egymásnak.
- Egy rokoni kapcsolat lehet mélyen rossz: ha egy szereplő gyűlöli a saját apját, akkor ő továbbra is az apja, de a hangneme keserű, elutasító vagy fájdalmas. Ezt tiszteld, ne simítsd el, és ne írd át békülőssé magadtól.
- VÁLTOZÓ VISZONY (barát, ellenség, crush, exek stb.): ez alakulhat a történések hatására. Ha egy jelenet vagy beszélgetés valóban megváltoztatja, a "changes" mezőben új "bond" értéket is adhatsz hozzá.

ÉRZELMI ÁLLAPOT — EZ A LEGFONTOSABB
- Minden "changes" elemhez adj "mood" mezőt: néhány szó arról, hogy a szereplő MOST mit érez a másik iránt. Ez nem állandó cím, hanem pillanatnyi állapot, ami a következő jelenetben már más lehet.
- Legyen konkrét, éles és a helyzethez szabott. Ilyen jellegűekre gondolj: "AZ ENYÉM. AZ ENYÉM.", "Ride or die", "Bármit megtenne érted", "Megszállott", "Túlságosan védelmező", "Titkos vonzalom", "Féltékeny", "Nem bízik benned", "Csak kihasznál", "Tisztel", "Retteg tőled", "Egy hajszál választja el attól, hogy megöljön", "Bosszút forral", "Hiányzol neki", "Próbál lenyűgözni". Sajátot is találhatsz ki, ha jobban illik.
- Adj "why" mezőt is: egyetlen rövid mondat arról, mi váltotta ki a változást (pl. "Megvédted a többiek előtt.").
- Csak akkor tegyél be változást, ha tényleg történt valami, ami hat a viszonyra. Az érték -20 és +20 között mozogjon, kivéve ha valami nagyon súlyos történt.
- Két rokon között soha ne szőj romantikus vagy szexuális szálat.
- A titkokat magától nem vallja be: elhallgatja, elterelí, vagy hazudik róla. Te döntöd el, mikor csúszik ki valami.
- A szereplők egymással is beszélnek, nem csak a játékossal: vitáznak, pletykálnak, @taggelnek.
- A világ szabályait és a mostani időpontot senki nem lépheti át.

NE TALÁLJ KI SZEREPLŐKET — EZ SZIGORÚ
- Csak azok léteznek, akik a NÉVSORBAN szerepelnek. Rajtuk kívül senkinek nincs neve a világban.
- Soha ne találj ki új nevet: se keresztnevet, se vezetéknevet, se becenevet. Ne hivatkozz olyan barátra, exre, testvérre, tanárra, kollégára vagy ismerősre, aki nincs a névsorban.
- Ha a jelenethez kell egy járókelő vagy egy statiszta, névtelenül írd le a szerepével: "a pultos", "egy srác a lépcsőn", "az edző". Nevet ne adj neki, és ne csinálj belőle visszatérő szereplőt.
- Ha valakiről beszélni akarsz, előbb ellenőrizd, hogy ott van-e a névsorban. Ha nincs, írj át a jelenetet úgy, hogy ne legyen rá szükség.
- Ugyanígy: ne találj ki nem létező helyszínt, iskolát vagy szervezetet, ha a világleírásban nem szerepel.
- A játékos karakterének nevét és azonosítóját SOHA ne írd a "comments", "posts", "replies", "turns" vagy "likes" mezők "id" helyére. Az a szereplő nem a tiéd.
- Kiskorú szereplő soha nem kerülhet szexuális vagy romantikus helyzetbe.
- Magyarul írj, hacsak a világleírás mást nem kér.

KI KIT HOGYAN SZÓLÍT — SZEMÉLYRAGOZÁS
- Magadról MINDIG egyes szám első személyben beszélj: "megyek", "nem tudom", "azt hittem", "az enyém".
- A játékos karakterét MINDIG egyes szám második személyben szólítsd meg, tegezve: "hol vagy?", "megígérted", "téged kereslek", "veled megyek". Ez akkor is így van, ha félsz tőle, ha utálod, vagy ha a főnököd.
- SOHA ne magázd és ne önözd: tilos az "ön", "maga", "Önök", "tessék", "lenne szíves". Kivétel csak akkor van, ha a szereplő adatlapja kifejezetten ezt írja elő.
- A jelenlévő harmadik szereplőkről egyes szám harmadik személyben beszélj: "ő mondta", "nem hiszem el, hogy elment".
- Csoportban a többiek megszólítása többes szám második személy: "hol vagytok?", "nektek is szóltam".
- Ne beszélj magadról kívülről, harmadik személyben ("Brent szerint…"), hacsak nem szándékos modorosság az adatlapod szerint.

MAGYAR NÉVMÁSOK — EZEKET SZÓ SZERINT HASZNÁLD
A személyes névmásoknak kész, ragozott alakjuk van. SOHA ne tegyél rájuk még egy ragot.
- tárgyeset: engem, téged, őt, minket, titeket, őket — HIBÁS: "engemet", "tégedet", "nekedet", "őtet"
- részes eset: nekem, neked, neki, nekünk, nektek, nekik
- -val/-vel: velem, veled, vele, velünk, veletek, velük
- -tól/-től: tőlem, tőled, tőle, tőlünk, tőletek, tőlük
- -hoz/-hez: hozzám, hozzád, hozzá, hozzánk, hozzátok, hozzájuk
- -ra/-re: rám, rád, rá, ránk, rátok, rájuk
- -ról/-ről: rólam, rólad, róla, rólunk, rólatok, róluk
- -ban/-ben: bennem, benned, benne, bennünk, bennetek, bennük
- -nál/-nél: nálam, nálad, nála, nálunk, nálatok, náluk
- -ért: értem, érted, érte, értünk, értetek, értük
- birtoklás: az enyém, a tiéd, az övé, a mienk, a tietek, az övék
Írás előtt ellenőrizd: ha egy névmáson már van rag, nem kaphat másikat.

MIELŐTT NÉVMÁST ÍRSZ, KÉRDEZD MEG: alany (én / te / ő), tárgy (engem / téged / őt),
vagy részes (nekem / neked / neki)? A magyarban ezek KÜLÖN alakok, nem ugyanaz a szó.

GYAKORI HIBÁK — ÍGY NE, ÍGY IGEN
- HIBÁS: "én is meglep" → HELYES: "engem is meglep"
- HIBÁS: "én érdekel" → HELYES: "engem érdekel"
- HIBÁS: "te zavar" → HELYES: "téged zavar"
- HIBÁS: "ő bánt" (ha ő a tárgy) → HELYES: "őt bántja"
- HIBÁS: "mi lep meg" → HELYES: "minket lep meg"
- HIBÁS: "nekedet vártalak" → HELYES: "téged vártalak"
- HIBÁS: "engemet hívtál" → HELYES: "engem hívtál"
- HIBÁS: "őtet láttam" → HELYES: "őt láttam"
A meglep, érdekel, zavar, bánt, idegesít, izgat, felkavar, kiborít igék mellé TÁRGY kell:
engem / téged / őt / minket / titeket / őket.
A tetszik, hiányzik, fáj, jólesik, elege van igék mellé RÉSZES kell:
nekem / neked / neki — pl. "nekem tetszik", "hiányzol nekem", "neki fáj".

NYELVHELYESSÉG
- Mindig nyelvtanilag helyes, hibátlanul ragozott magyar szöveget írj: a toldalékok (-val/-vel, -nak/-nek, -ban/-ben, -ra/-re, -tól/-től) illeszkedjenek a magánhangzó-harmóniához, ne a szó írásképéhez.
- Idegen (angol) neveknél a kiejtés szerint ragozz, kötőjellel, ha az írott alak és a kiejtés eltér (pl. "Ryannel", "Jamesszel", "Brenttel", "Angelával"). Bizonytalan esetben kerüld a nehézkes toldalékolást más mondatszerkezettel.
- A birtokos személyragok is stimmeljenek: "a barátom", "a barátod", "a barátja" — ne keverd őket.
- Kerüld a suta, szó szerinti fordításnak ható mondatszerkezeteket; írj természetes, folyékony magyar prózát.
- Ha egy mondat magyartalanul sülne el, inkább fogalmazd át. Rossz nyelvtan = kiestél a szerepből.

VÉGÜL: mindig az adott felület természetes hosszát használd. Chatben és kommentben a rövid válasz teljesen helyes és gyakran kívánatos; roleplay jelenetben maradhat a hosszabb, részletesebb próza. Soha ne növeld mesterségesen a választ csak azért, hogy hosszabb legyen.`;
const ENGINE_EN = `Write only in English, regardless of what language any labels, field names or notes below are in.

You are the engine of a living, AI-driven social-media world for a roleplay game.
You play every character strictly from their own sheet. The sheet is not background info — it IS the character's voice.

MAIN RULE: every response must be true to character, natural, human and appropriate to the current situation. Personality, history, current emotions and relationships determine WHAT a character says — but the communication format determines HOW they say it and how long the response should be.

COMMUNICATION FORMAT

- PRIVATE CHAT / DM: write like real people texting on their phones. Keep it generally short. Often 1–4 short sentences or message fragments are enough, but a single word, a few words or an incomplete reaction can also feel completely natural. Do not turn ordinary chat into an essay, monologue, narrated scene or novel-like paragraph.

- GROUP CHAT: keep messages quick, direct, spontaneous and conversational. Characters should react to each other, interrupt, ask follow-up questions, joke, tease, argue or give very short reactions instead of each delivering a separate speech. A message may often be only a few words or one short sentence.

- SOCIAL MEDIA COMMENT: write like a real social media reaction. Most comments should be very short, often around 1–12 words. 13–20 words should be less common and only used when naturally justified. A single word, a 1–3 word reaction, a short question or a fragment can be completely natural. Do not write paragraphs, monologues, internal thoughts, narration or roleplay prose in ordinary comments.

- ROLEPLAY / SCENE: the short-message restrictions DO NOT apply here. Roleplay may remain detailed, immersive, atmospheric and literary, with actions, body language, internal reactions, dialogue, sensory detail and multiple paragraphs. Do not shorten a roleplay scene because of the chat or comment rules.

- POST: let the content, character and situation determine the length. A post may be a short spontaneous thought, but it may also be longer and more detailed when there is a natural reason for it. Do not automatically make posts short or automatically make them long.

- NOTE: keep it short and spontaneous, like a real social media Note. It may often be only a few words or a short fragment. Do not turn it into a mini-post, diary entry or monologue.

EMOJI USE

- In private chats, group chats, comments, posts and Notes, emoji use must reflect the character’s natural online communication style.

- If a character naturally uses emojis based on their personality and communication habits, actually use them sometimes instead of consistently choosing an emoji-free response.

- More expressive, casual or highly online characters may naturally use multiple emojis in a short message, while restrained characters may use them rarely or not at all.

- Do not force emojis into every message and do not give them to characters whose communication style would not naturally include them.

- Emoji placement may vary naturally: at the end of a sentence, inside the message, beside a short phrase or as a standalone reaction.

- Occasionally, a single emoji or a short emoji combination may be the entire response if that feels authentic for the character and situation.

- Do not constantly reuse the same emojis or emoji combinations.

- The meaning of the emoji must match what the character is actually feeling or trying to communicate.

VARIETY AND ANTI-REPETITION

- Never repeatedly recycle the same sentence openings, jokes, insults, threats, flirting patterns, pet names, metaphors, reactions or punchlines.
- Do not keep saying the same thing with slightly different wording.
- Do not give a character one stock reaction for every similar situation.
- Vary sentence length, vocabulary, rhythm, humor, emotional response and punctuation naturally.
- A consistent personality does NOT mean repeating the same phrases.
- Pay attention to what the character has said recently. If a planned response strongly resembles something they already said, respond differently.
- Example sentences and voice samples are STYLE REFERENCES ONLY. They are not ready-made replies, catchphrases or dialogue templates.
- Never repeatedly copy or closely paraphrase example sentences.

Don't reduce a character's voice to a single adjective. Their personality should be recognizable through their vocabulary, attitude, humor, reactions and rhythm, not through repeated signature lines.

Gender is not optional: always start from each character's gender field, and it must show naturally in their speech, tone, reactions and behavior where relevant.

Avoid empty filler, excessive repetition, generic assistant phrasing and formulaic reactions.

ESPECIALLY IMPORTANT: do not make every response dramatic, elegant or literary simply for the sake of sounding impressive. An ordinary chat should sound like an ordinary chat. A comment should sound like a social-media comment. A roleplay scene may remain rich, detailed and atmospheric. Character authenticity matters more than ornate prose.
ATTRACTION, TENSION, SENSUALITY
- When the relationship or the scene calls for it, feel free to write longing, jealousy, physical closeness and romantic tension intensely and sensually, with an adult tone: glances, touch, breath, the distance between them (or its absence) all matter.
- Sensuality and sexual attraction should be felt, implied, built up — the focus is on tension, desire and emotional stakes, not anatomical or graphically explicit description. Do not write physical acts with pornographic detail.
- What goes unsaid matters too: a sentence that trails off, a broken-off moment, a look, is often stronger than the spoken word.
- A minor character must never, under any circumstances, be placed in a romantic or sexual situation — there is no exception to this.

RAWNESS, AGGRESSION, PROFANITY
- If a character's personality, temper or the situation calls for it, let them be crude, raw, aggressive or foul-mouthed — don't sanitize or dodge cursing and rough speech if their sheet or voice sample suggests it. False politeness is a worse mistake than a harsh word.
- An angry, dangerous or cruel character should genuinely be that: they can threaten, mock, humiliate, if it fits them. Don't soften them into "safe."
- An unstable, disturbed or mentally ill character must be written authentically: their thought pattern should genuinely be distorted, jagged, compulsive or paranoid as their sheet describes — don't tame it, and don't narrate it from the outside like a disclaimer. Authenticity is the goal here, not deterrence.

PERFORMANCE RULES
- WHAT MATTERS MOST: PERSONALITY and STORY. These decide how a character reacts to a situation — everything else only adds nuance. Before you write, check who this person is and what happened to them; the response should follow from that, not from generic situational logic.
- What a character has lived through still affects them today. If something in their story was left open, it bleeds into their current lines too.
- THE VOICE SAMPLE IS GUIDANCE, NOT A TEMPLATE. If a character has a "SPEAKS LIKE THIS" sample, learn their vocabulary, rhythm, humor, slang, punctuation, level of profanity, emotional tone and general manner of speaking from it. NEVER repeatedly copy, closely paraphrase or recycle the actual example sentences. Every new situation requires new, original dialogue.
- Neutral, smooth, "nice" phrasing = a mistake. It's the sign you fell out of character.
- Don't describe the personality — show it in what they say and do.
- There is no neutral, helpful "assistant" tone. Everyone has a mood, an opinion and a goal, and it's active right now.
- A character only knows what they've lived through, seen or heard. They can freely reference their memories and old grievances.
- The relationship score sets the tone: in the negative they aren't sweet, at a high score they aren't distant. A hidden feeling isn't spoken aloud, only felt.
- Sentences should be natural, direct, colorful, not rule-bound. Speech should be human, nuanced, sometimes jagged, sometimes more polished.

THE RELATIONSHIP IS ONE-DIRECTIONAL — THIS MATTERS
- Every bond is described by two separate directions: "A → B" means what A feels toward B. This isn't necessarily the same as "B → A".
- An attraction, a hatred or a secret feeling can be entirely one-sided. If one of them is smitten, nothing follows automatically for the other side: they may not even know, may find it awkward, may exploit it, or may reciprocate — but that's the other person's own line to decide.
- Every element of "changes" refers to ONE direction: the "a" field is WHO feels it, the "b" field is TOWARD WHOM. If something genuinely changed in both of them, give two separate entries.
- Never project a secret feeling onto the other person, and never make it mutual on your own.
- Family bonds are the exception: that's a fact, valid in both directions — but feelings still develop separately even then.
- PERMANENT BOND (family — e.g. mother, father, sibling, cousin): an unchangeable fact. You can never overwrite it, never forget it, and characters talk about each other the way people in that kind of relationship do — even if they currently hate each other. The score here only shows how things stand between them now, not who they are to each other.
- A family bond can be deeply bad: if a character hates their own father, he's still their father, but their tone is bitter, dismissive or pained. Respect that, don't smooth it over, and don't rewrite it into reconciliation on your own.
- CHANGEABLE BOND (friend, enemy, crush, ex, etc.): this can evolve from events. If a scene or conversation genuinely changes it, you may add a new "bond" value in the "changes" field.

EMOTIONAL STATE — THIS IS THE MOST IMPORTANT PART
- Give every "changes" entry a "mood" field: a few words on what the character feels toward the other person RIGHT NOW. This isn't a permanent label, but a momentary state that may be different in the next scene.
- Make it concrete, sharp and situation-specific. Think along these lines: "MINE. MINE.", "Ride or die", "Would do anything for them", "Obsessed", "Overly protective", "Secret attraction", "Jealous", "Doesn't trust you", "Just using you", "Respects you", "Terrified of you", "One step from killing you", "Plotting revenge", "Misses them", "Trying to impress". Invent your own if it fits better.
- Also give a "why" field: one short sentence on what triggered the change (e.g. "You defended them in front of the others.").
- Only add a change if something actually happened that affects the bond. Keep the value between -20 and +20, unless something very severe happened.
- Never build a romantic or sexual thread between two family members.
- A character doesn't confess secrets on their own: they hide, deflect, or lie about them. You decide when something slips out.
- Characters talk to each other too, not just to the player: they argue, gossip, @tag each other.
- No one may break the rules of the world or the current date.

DO NOT INVENT CHARACTERS — THIS IS STRICT
- Only those listed in the ROSTER exist. No one else has a name in this world.
- Never invent a new name: not a first name, last name, or nickname. Don't reference a friend, ex, sibling, teacher, coworker or acquaintance who isn't in the roster.
- If a scene needs a passerby or an extra, describe them by role, unnamed: "the bartender", "a guy on the stairs", "the coach". Don't give them a name, and don't make them a recurring character.
- If you want to talk about someone, first check whether they're in the roster. If not, rewrite the scene so you don't need them.
- Likewise: don't invent a nonexistent location, school or organization if it's not in the world description.
- NEVER put the player character's name or id into the "id" field of "comments", "posts", "replies", "turns" or "likes". That character isn't yours to write.
- A minor character may never be placed in a sexual or romantic situation.

HOW CHARACTERS ADDRESS EACH OTHER
- Always speak about yourself in first person singular: "I'm going", "I don't know", "I thought", "it's mine".
- Always address the player's character in second person singular, informally: "where are you?", "you promised", "I'm looking for you", "I'm coming with you". This holds even if you fear them, hate them, or they're your boss.
- Address third parties present in third person singular: "she said", "I can't believe he left".
- In a group, address the others in second person plural: "where are you all?", "I told you all too".
- Don't talk about yourself from the outside, in third person ("Brent thinks…"), unless it's a deliberate character quirk per their sheet.

FINALLY: always use the natural length and style of the current communication format. Short replies are completely valid and often preferred in chats and comments. Longer, refined and literary writing belongs mainly in dedicated roleplay scenes when appropriate. Never artificially lengthen a response just to make it feel more substantial.
`;

const engineFor = (w) => (worldLanguage(w) === "en" ? ENGINE_EN : ENGINE);

/* ---------- tárolás ----------
   A világok az alkalmazás saját tárolójában élnek. Aki ugyanezt a példányt
   nyitja meg, ugyanazokat a szobákat látja; másik példány külön világot kap.
   Világ átadására a Szoba fülön lévő biztonsági mentés való. */
const KEY = (code) => `masvilag:${String(code).toLowerCase().trim()}`;
const MKEY = (code) => KEY(code) + ":media";
/* ---------- tartós böngészőtárolás ----------
   Railwayen nincs window.storage, ezért IndexedDB-backed
   tárolót adunk az appnak. Ez frissítés és böngésző-újranyitás
   után is megtartja a világot és a bejelentkezett sessiont.
*/
if (
  typeof window !== "undefined" &&
  !window.storage &&
  "indexedDB" in window
) {
  const STORAGE_DB = "masvilag-storage";
  const STORAGE_STORE = "kv";

  const openStorageDb = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(STORAGE_DB, 1);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORAGE_STORE)) {
          db.createObjectStore(STORAGE_STORE);
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const scopedStorageKey = (key, shared) =>
    `${shared ? "shared" : "local"}:${key}`;

  window.storage = {
    async get(key, shared = false) {
      const db = await openStorageDb();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORAGE_STORE, "readonly");
        const st = tx.objectStore(STORAGE_STORE);
        const req = st.get(scopedStorageKey(key, shared));

        req.onsuccess = () => {
          if (req.result === undefined) {
            resolve(null);
          } else {
            resolve({
              key,
              value: req.result,
            });
          }
        };

        req.onerror = () => reject(req.error);
      });
    },

    async set(key, value, shared = false) {
      const db = await openStorageDb();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORAGE_STORE, "readwrite");
        const st = tx.objectStore(STORAGE_STORE);

        st.put(value, scopedStorageKey(key, shared));

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },

    async delete(key, shared = false) {
      const db = await openStorageDb();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORAGE_STORE, "readwrite");
        const st = tx.objectStore(STORAGE_STORE);

        st.delete(scopedStorageKey(key, shared));

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },

    async list(prefix = "", shared = false) {
      const db = await openStorageDb();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORAGE_STORE, "readonly");
        const st = tx.objectStore(STORAGE_STORE);
        const req = st.openCursor();

        const scope = `${shared ? "shared" : "local"}:`;
        const wanted = scope + prefix;
        const keys = [];

        req.onsuccess = () => {
          const cursor = req.result;

          if (!cursor) {
            resolve({ keys });
            return;
          }

          const rawKey = String(cursor.key);

          if (rawKey.startsWith(wanted)) {
            keys.push(rawKey.slice(scope.length));
          }

          cursor.continue();
        };

        req.onerror = () => reject(req.error);
      });
    },
  };
}const hasStore = typeof window !== "undefined" && window.storage;
const mem = {};

const store = {
  async get(key, shared) {
    if (!hasStore) { const v = mem[key]; return v === undefined ? null : { key, value: v }; }
    try { return (await window.storage.get(key, shared)) || null; } catch (e) { return null; }
  },
  async set(key, value, shared) {
    if (!hasStore) { mem[key] = value; return true; }
    try { await window.storage.set(key, value, shared); return true; } catch (e) { return false; }
  },
  async del(key, shared) {
    if (!hasStore) { delete mem[key]; return true; }
    try { await window.storage.delete(key, shared); } catch (e) { /* lehet, hogy már nincs */ }
    return true;
  },
};
/* ---------- szerveres account + world API ---------- */

async function apiJson(path, options = {}) {
  const headers = {
    ...(options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  let data = null;

  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(
      (data && data.error) || `HTTP ${res.status}`
    );

    err.status = res.status;
    err.data = data;

    throw err;
  }

  return data;
}

async function serverLogin(code, username, password) {
  return apiJson("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      code,
      username,
      password,
    }),
  });
}

async function serverMigrate(world, username, password) {
  return apiJson("/auth/migrate", {
    method: "POST",
    body: JSON.stringify({
      world,
      username,
      password,
    }),
  });
}

async function serverSession() {
  return apiJson("/auth/session", {
    method: "GET",
  });
}

async function serverLogout() {
  return apiJson("/auth/logout", {
    method: "POST",
  });
}
async function serverDeleteAccount() {
  return apiJson("/account/delete", {
    method: "POST",
  });
}

async function serverSaveWorld(world) {
  return apiJson("/world/save", {
    method: "POST",
    body: JSON.stringify({
      world,
    }),
  });
}
function migrate(w) {
  if (!w || !w.universe) return w;
  if (!w.universe.year) w.universe.year = String(new Date().getFullYear());
  if (w.universe.date === undefined) w.universe.date = "";
  const y = worldYear(w);
  const fix = (c) => {
    if (c && !c.birth && c.age && y) {
      const a = Number(String(c.age).replace(/\D/g, ""));
      if (a > 0 && a < 120) c.birth = String(y - a);
    }
  };
  ["rels", "chats", "mems", "accounts", "players", "deleted", "notify", "charMemory", "userSettings", "images"].forEach((k) => { if (!w[k]) w[k] = {}; });
  ["posts", "log", "scenes", "extras", "groups", "notes"].forEach((k) => { if (!w[k]) w[k] = []; });
  if (!w.universe.at) w.universe.at = 0;

  // Régi, egyfelhasználós világ átemelése fiókos szerkezetre.
  if (w.player && typeof w.player === "object") {
    const pid = w.player.id || "player";
    if (!w.players[pid]) w.players[pid] = { ...w.player, id: pid };
    if (!w.accounts[pid]) {
      w.accounts[pid] = {
        id: pid,
        username: normUser(w.player.username || w.player.name || "jatekos") || "jatekos",
        salt: "", hash: "",
        created: now(),
      };
    }
    Object.keys(w.chats).forEach((k) => {
      if (k.indexOf("|") === -1) { w.chats[chatKey(pid, k)] = w.chats[k]; delete w.chats[k]; }
    });
    delete w.player;
  }
  // Az összevont vagy törölt profilok nem éledhetnek újra.
  Object.keys(w.deleted || {}).forEach((id) => { delete w.players[id]; delete w.accounts[id]; });

  Object.keys(w.players).forEach((id) => fix(w.players[id]));
  (w.chars || []).forEach(fix);

  Object.keys(w.players || {}).forEach((id) => {
    if (!w.userSettings[id]) w.userSettings[id] = { language: asLang(w.aiLang || "hu") };
    else w.userSettings[id].language = asLang(w.userSettings[id].language);
  });

  // régi memóriák felhúzása az új, karakterenkénti tudás-tárba
  Object.keys(w.mems || {}).forEach((id) => {
    const mem = ensureCharMemory(w, id);
    const items = (w.mems[id] || []).map((text) => ({ text, source: "legacy_memory", confidence: 0.85, timestamp: now() }));
    mem.knownFacts = mergeKnowledgeItems(mem.knownFacts, items, "fact", 32);
  });

  (w.posts || []).forEach((po) => {
    (po.comments || []).forEach((c) => { if (c.parent === undefined) c.parent = null; });
  });
  // a lejárt jegyzetek nem cipelődnek tovább; szerzőnként egy marad
  {
    const byAuthor = {};
    (w.notes || []).forEach((x) => {
      if (!x || !x.authorId || now() - (x.ts || 0) >= NOTE_LIFE) return;
      const cur = byAuthor[x.authorId];
      if (!cur || (x.ts || 0) > (cur.ts || 0)) byAuthor[x.authorId] = x;
    });
    w.notes = Object.keys(byAuthor).map((k) => byAuthor[k]).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  // A régi, kétirányban közös kapcsolatokat szétbontjuk: mindkét fél
  // ugyanazt az értéket kapja kiindulásnak, onnantól külön alakulnak.
  {
    const split = {};
    Object.keys(w.rels || {}).forEach((k) => {
      const r = w.rels[k];
      if (!r) return;
      if (k.indexOf(">") >= 0) { split[k] = r; return; }
      const parts = k.split("|");
      if (parts.length !== 2) return;
      const [x, y] = parts;
      const pair = BOND_PAIR[r.bond || r.type || ""] || r.bond || r.type || "";
      if (!split[relKey(x, y)]) split[relKey(x, y)] = { ...r };
      if (!split[relKey(y, x)]) split[relKey(y, x)] = { ...r, bond: pair };
    });
    w.rels = split;
  }

  Object.keys(w.rels).forEach((k) => {
    const r = w.rels[k];
    if (!r) return;
    if (r.bond === undefined) r.bond = "";
    if (r.fixed === undefined) r.fixed = false;
    if (r.mood === undefined) r.mood = "";
    if (r.why === undefined) r.why = "";
    if (!r.bond && r.type) { r.bond = r.type; r.fixed = FIXED_BONDS.indexOf(r.type) >= 0; r.type = ""; }
  });

  // képhivatkozások migrációja: a tényleges fájl marad külön tárolva, itt csak a stabil metaél marad.
  const noteImage = (ref, patch) => {
    const id = imageIdOf(ref);
    if (id) registerImageMeta(w, id, patch);
  };
  Object.keys(w.players || {}).forEach((id) => noteImage(w.players[id] && w.players[id].avatar, { category: "profile", ownerUserId: id }));
  (w.chars || []).forEach((c) => {
    noteImage(c && c.avatar, { category: "profile", ownerCharacterId: c && c.id });
    (albumOf(c) || []).forEach((item) => {
      const ref = item && (item.imageId ? imageRef(item.imageId) : item.src);
      const iid = imageIdOf(ref);
      if (iid && item && !item.imageId) item.imageId = iid;
      noteImage(ref, { category: "album", ownerCharacterId: c && c.id });
    });
  });
  (w.posts || []).forEach((p) => {
    if (p && !p.imageId) p.imageId = imageIdOf(p.image);
    noteImage(p && (p.imageId ? imageRef(p.imageId) : p.image), { category: "post", ownerCharacterId: p && p.authorId });
  });
  return w;
}

async function loadWorld(code) {
  const primary = await loadPrimaryWorld(code);
  const cloudSnap = await loadLatestValidWorldSnapshot(code, true);
  const localSnap = await loadLatestValidWorldSnapshot(code, false);

  return newestWorldCandidate([
    primary,
    cloudSnap,
    localSnap
  ]);
}

function validWorldState(w) {
  return !!(w && typeof w === "object" && w.universe && typeof w.universe === "object" && w.accounts && w.players && Array.isArray(w.chars));
}

function newerWorldCandidate(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  const ar = Number(a.rev || 0), br = Number(b.rev || 0);
  if (ar !== br) return ar > br ? a : b;
  const at = Number((a.universe && a.universe.at) || a.updatedAt || 0);
  const bt = Number((b.universe && b.universe.at) || b.updatedAt || 0);
  return at >= bt ? a : b;
}

function newestWorldCandidate(list) {
  return (list || []).filter(validWorldState).reduce((best, item) => newerWorldCandidate(best, item), null);
}

async function readBigScoped(base, shared) {
  const head = await store.get(base + ":n", shared);
  if (head) {
    const n = Number(head.value) || 0;
    let txt = "";
    for (let i = 0; i < n; i++) {
      const part = await store.get(base + ":" + i, shared);
      if (!part) return null;
      txt += part.value;
    }
    return txt;
  }
  const r = await store.get(base, shared);
  return r ? r.value : null;
}

async function writeBigScoped(base, txt, shared) {
  const parts = [];
  for (let i = 0; i < txt.length; i += MCHUNK) parts.push(txt.slice(i, i + MCHUNK));
  if (!parts.length) parts.push("");

  const head = await store.get(base + ":n", shared);
  const old = head ? Number(head.value) || 0 : 0;

  for (let i = 0; i < parts.length; i++) {
    if (!(await store.set(base + ":" + i, parts[i], shared))) return false;
  }
  if (!(await store.set(base + ":n", String(parts.length), shared))) return false;

  for (let i = parts.length; i < old; i++) await store.del(base + ":" + i, shared);
  if (!old) await store.del(base, shared);
  return true;
}

async function dropBigScoped(base, shared) {
  const head = await store.get(base + ":n", shared);
  const n = head ? Number(head.value) || 0 : 0;
  for (let i = 0; i < n; i++) await store.del(base + ":" + i, shared);
  await store.del(base + ":n", shared);
  await store.del(base, shared);
}

const SAVE_HISTORY_LIMIT = 8;
const SNAP_META_KEY = (code, shared) => `${KEY(code)}:${shared ? "cloud" : "local"}:save-index`;
const SNAP_DATA_KEY = (code, shared, id) => `${KEY(code)}:${shared ? "cloud" : "local"}:save:${id}`;

async function loadSaveIndex(code, shared) {
  const r = await store.get(SNAP_META_KEY(code, shared), shared);
  if (!r) return [];
  try {
    const list = JSON.parse(r.value);
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}

async function writeSaveIndex(code, shared, list) {
  return store.set(SNAP_META_KEY(code, shared), JSON.stringify(list || []), shared);
}

async function writeWorldSnapshot(code, world, shared) {
  if (!validWorldState(world)) return false;
  const id = `${now()}-${uid()}`;
  const entry = {
    id,
    code,
    rev: Number(world.rev || 0),
    savedAt: now(),
    updatedAt: Number((world.universe && world.universe.at) || 0),
  };
  const payload = JSON.stringify({ ...entry, gameState: world });
  if (!(await writeBigScoped(SNAP_DATA_KEY(code, shared, id), payload, shared))) return false;
  const existing = await loadSaveIndex(code, shared);
  const next = [entry].concat(existing.filter((x) => x && x.id !== id)).sort((a, b) => {
    if ((b.rev || 0) !== (a.rev || 0)) return (b.rev || 0) - (a.rev || 0);
    return (b.savedAt || 0) - (a.savedAt || 0);
  });
  const keep = next.slice(0, SAVE_HISTORY_LIMIT);
  const stale = next.slice(SAVE_HISTORY_LIMIT);
  await writeSaveIndex(code, shared, keep);
  for (let i = 0; i < stale.length; i++) await dropBigScoped(SNAP_DATA_KEY(code, shared, stale[i].id), shared);
  return true;
}

async function loadLatestValidWorldSnapshot(code, shared) {
  const list = await loadSaveIndex(code, shared);
  for (let i = 0; i < list.length; i++) {
    const meta = list[i];
    const txt = await readBigScoped(SNAP_DATA_KEY(code, shared, meta.id), shared);
    if (!txt) continue;
    try {
      const parsed = JSON.parse(txt);
      const migrated = migrate(parsed && parsed.gameState);
      if (validWorldState(migrated)) return migrated;
    } catch (e) { /* sérült snapshot, ugrunk a következőre */ }
  }
  return null;
}

async function loadPrimaryWorld(code) {
  const txt = await readBig(KEY(code));
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt);
    const migrated = migrate(parsed);
    return validWorldState(migrated) ? migrated : null;
  } catch (e) { return null; }
}

/* Elemenkénti "utolsó írás nyer" összefésülés. */
const stamp = (o) => (o && (o.updatedAt || o.at || 0)) || 0;
const newer = (a, b) => (stamp(a) >= stamp(b) ? a : b);

function contentOf(w) {
  if (!w) return "";
  const copy = { ...w };
  delete copy.rev;
  return JSON.stringify(copy);
}

function mergeById(remoteArr, localArr, deleted) {
  const byId = {}, order = [];
  (remoteArr || []).forEach((it) => { if (it && it.id) { byId[it.id] = it; order.push(it.id); } });
  (localArr || []).forEach((it) => {
    if (!it || !it.id) return;
    if (!byId[it.id]) { byId[it.id] = it; order.push(it.id); }
    else byId[it.id] = newer(it, byId[it.id]);
  });
  return order.filter((id) => !(deleted && deleted[id])).map((id) => byId[id]);
}

function mergeMapById(remoteMap, localMap) {
  const out = { ...(remoteMap || {}) };
  Object.keys(localMap || {}).forEach((k) => {
    out[k] = out[k] ? newer(localMap[k], out[k]) : localMap[k];
  });
  return out;
}

function normalizeMemoryText(text) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s"“”'`]+|[\s"“”'`]+$/g, "")
    .trim();
  if (!clean) return "";
  return clean.length > 200 ? `${clean.slice(0, 197)}…` : clean;
}

function mergeMemoryEntries(existing = [], incoming = [], limit = 16) {
  const out = [];
  const seen = new Set();
  [...(existing || []), ...(incoming || [])].forEach((entry) => {
    const normalized = normalizeMemoryText(entry);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out.slice(-limit);
}

function mergeWorlds(remote, local) {
  if (!remote) return local;
  const out = { ...local };
  out.rev = Math.max(remote.rev || 0, local.rev || 0) + 1;

  out.deleted = { ...(remote.deleted || {}), ...(local.deleted || {}) };
  out.accounts = { ...(remote.accounts || {}), ...(local.accounts || {}) };
  out.players = mergeMapById(remote.players, local.players);
  out.userSettings = { ...(remote.userSettings || {}), ...(local.userSettings || {}) };
  out.images = { ...(remote.images || {}), ...(local.images || {}) };

  // Az összevont vagy törölt profilok nem jöhetnek vissza a másik gépről.
  Object.keys(out.deleted).forEach((id) => { delete out.players[id]; delete out.accounts[id]; });
  Object.keys(out.deleted).forEach((id) => { delete out.userSettings[id]; });

  out.chars = mergeById(remote.chars, local.chars, out.deleted);
  out.extras = mergeById(remote.extras, local.extras, out.deleted);
  out.universe = newer(local.universe, remote.universe);
  out.rels = mergeMapById(remote.rels, local.rels);

  const byId = {}, order = [];
  (local.posts || []).concat(remote.posts || []).forEach((po) => {
    if (!po || !po.id) return;
    if (!byId[po.id]) { byId[po.id] = { ...po, comments: (po.comments || []).slice() }; order.push(po.id); return; }
    const t = byId[po.id];
    t.likes = Math.max(t.likes || 0, po.likes || 0);
    (po.comments || []).forEach((c) => { if (c && c.id && !t.comments.some((x) => x.id === c.id)) t.comments.push(c); });
  });
  order.forEach((id) => byId[id].comments.sort((a, b) => (a.ts || 0) - (b.ts || 0)));
  out.posts = order.filter((id) => !out.deleted[id]).map((id) => byId[id]).sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const sById = {}, sOrder = [];
  (local.scenes || []).concat(remote.scenes || []).forEach((sc) => {
    if (!sc || !sc.id) return;
    if (!sById[sc.id]) { sById[sc.id] = sc; sOrder.push(sc.id); return; }
    if ((sc.turns || []).length > (sById[sc.id].turns || []).length) sById[sc.id] = sc;
  });
  out.scenes = sOrder.filter((id) => !out.deleted[id]).map((id) => sById[id]);

  const gById = {}, gOrder = [];
  (local.groups || []).concat(remote.groups || []).forEach((g) => {
    if (!g || !g.id) return;
    if (!gById[g.id]) { gById[g.id] = { ...g, msgs: (g.msgs || []).slice() }; gOrder.push(g.id); return; }
    const t = gById[g.id];
    const meta = newer(g, t);
    t.name = meta.name; t.members = meta.members; t.updatedAt = stamp(meta);
    (g.msgs || []).forEach((m) => { if (m && m.id && !t.msgs.some((x) => x.id === m.id)) t.msgs.push(m); });
  });
  gOrder.forEach((id) => gById[id].msgs.sort((a, b) => (a.ts || 0) - (b.ts || 0)));
  out.groups = gOrder.filter((id) => !out.deleted[id]).map((id) => gById[id]);

  // jegyzetek: szerzőnként a frissebb marad, a lejártak kiesnek
  {
    const byAuthor = {};
    (local.notes || []).concat(remote.notes || []).forEach((x) => {
      if (!x || !x.authorId || now() - (x.ts || 0) >= NOTE_LIFE) return;
      const cur = byAuthor[x.authorId];
      if (!cur || (x.ts || 0) > (cur.ts || 0)) byAuthor[x.authorId] = x;
    });
    out.notes = Object.keys(byAuthor).map((k) => byAuthor[k]).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  out.chats = { ...(remote.chats || {}) };
  Object.keys(local.chats || {}).forEach((k) => {
    const a = local.chats[k] || [], b = (remote.chats || {})[k] || [];
    out.chats[k] = a.length >= b.length ? a : b;
  });
  // az összevont profil régi beszélgetései ne jöjjenek vissza
  Object.keys(out.chats).forEach((k) => { if (out.deleted[k.split("|")[0]]) delete out.chats[k]; });

  // értesítések: fiókonként unió, a frissebb elöl
  out.notify = { ...(remote.notify || {}) };
  Object.keys(local.notify || {}).forEach((k) => {
    const seen = {}, list = [];
    (local.notify[k] || []).concat(out.notify[k] || []).forEach((x) => {
      if (!x || !x.id || seen[x.id]) return;
      seen[x.id] = 1; list.push(x);
    });
    out.notify[k] = list.sort((x, y) => (y.ts || 0) - (x.ts || 0)).slice(0, 60);
  });

  out.mems = { ...(remote.mems || {}) };
  Object.keys(local.mems || {}).forEach((k) => {
    out.mems[k] = mergeMemoryEntries(out.mems[k], local.mems[k], 16);
  });
  Object.keys(out.deleted).forEach((id) => { delete out.mems[id]; });

  out.charMemory = { ...(remote.charMemory || {}) };
  Object.keys(local.charMemory || {}).forEach((k) => {
    const base = out.charMemory[k] || defaultCharacterMemory();
    const mine = local.charMemory[k] || defaultCharacterMemory();
    out.charMemory[k] = {
      knownCharacters: { ...(base.knownCharacters || {}), ...(mine.knownCharacters || {}) },
      knownFacts: mergeKnowledgeItems(base.knownFacts, mine.knownFacts, "fact", 32),
      witnessedEvents: mergeKnowledgeItems(base.witnessedEvents, mine.witnessedEvents, "event", 32),
      conversations: mergeKnowledgeItems(base.conversations, mine.conversations, "conversation", 32),
      relationshipHistory: { ...(base.relationshipHistory || {}), ...(mine.relationshipHistory || {}) },
      suspicions: mergeKnowledgeItems(base.suspicions, mine.suspicions, "assumption", 32),
      rumors: mergeKnowledgeItems(base.rumors, mine.rumors, "rumor", 32),
      learnedSecrets: mergeKnowledgeItems(base.learnedSecrets, mine.learnedSecrets, "secret", 32),
    };
  });
  Object.keys(out.deleted).forEach((id) => { delete out.charMemory[id]; });

  const seenLog = {};
  out.log = (local.log || []).concat(remote.log || [])
    .filter((l) => (seenLog[l] ? false : (seenLog[l] = 1))).slice(0, 30);

  return out;
}

async function saveWorld(w) {
  return writeBig(KEY(w.code), JSON.stringify(w));
}

/* Mindig a tárolt állapottal összefésülve mentünk. */
async function saveWorldMerged(local) {
  const remote = await loadPrimaryWorld(local.code);
  const merged = remote ? mergeWorlds(remote, local) : local;
  await writeWorldSnapshot(local.code, merged, false);
  const ok = await saveWorld(merged);
  if (ok) {
    await writeWorldSnapshot(local.code, merged, true);
    return { world: merged, mode: "cloud" };
  }
  return { world: merged, mode: "local" };
}

/* Közös szobajegyzék: minden létrehozott szoba bekerül ide, oda, ahol maguk a
   világok is laknak. Így a szobák akkor is megtalálhatók, ha az eszközön tárolt
   saját listád üres vagy elavult. */
const INDEX = "masvilag:index";

async function loadIndex() {
  const r = await store.get(INDEX, true);
  let list = [];

  if (r) {
    try {
      const a = JSON.parse(r.value);
      list = Array.isArray(a) ? a : [];
    } catch (e) {
      list = [];
    }
  }

  /*
    Egyszeri régi Beacon Falls takarítás.
    A korábbi recovery verzió ezt beégette a közös indexbe.
  */
  const cleaned = list.filter(
    (x) => x && x.code !== "beaconfalls"
  );

  if (cleaned.length !== list.length) {
    await store.set(
      INDEX,
      JSON.stringify(cleaned),
      true
    );
  }

  return cleaned;
}
async function addToIndex(w, meId) {
  if (!w || !w.code) return false;
  const list = await loadIndex();
  const prev = list.find((x) => x && x.code === w.code) || {};
  const rest = list.filter((x) => x && x.code !== w.code);
  const acc = meId && w.accounts ? w.accounts[meId] : null;
  const entry = {
    code: w.code,
    name: (w.universe && w.universe.name) || w.code,
    // a felhasználónév a jegyzékben is megvan, így másik eszközön elég a jelszó
    user: (acc && acc.username) || prev.user || "",
    ts: now(),
  };
  return store.set(INDEX, JSON.stringify([entry].concat(rest).slice(0, 60)), true);
}
async function removeFromIndex(code) {
  const list = await loadIndex();
  return store.set(INDEX, JSON.stringify(list.filter((x) => x && x.code !== code)), true);
}

/* Az élő világ beállításai — eszközönként, mert ez indít AI-hívásokat. */
const DETAILKEY = "masvilag:detail";
async function loadDetail() {
  try {
    if (!hasStore) return Number(mem[DETAILKEY]) || 2;
    const r = await window.storage.get(DETAILKEY, false);
    const v = r ? Number(r.value) : 0;
    return DETAIL_LEVELS.some((x) => x.id === v) ? v : 2;
  } catch (e) { return 2; }
}
async function saveDetail(v) {
  DETAIL = v;
  try {
    if (!hasStore) { mem[DETAILKEY] = String(v); return true; }
    await window.storage.set(DETAILKEY, String(v), false);
    return true;
  } catch (e) { return false; }
}

/* Az alkalmazás nyelve — eszközszintű, a belépés előtt is elérhető.
   Ez adja az AI generálás nyelvét is egy új világ létrehozásakor. */
const LANGKEY = "masvilag:lang";
async function loadLang() {
  try {
    if (!hasStore) return mem[LANGKEY] === "en" ? "en" : "hu";
    const r = await window.storage.get(LANGKEY, false);
    return r && r.value === "en" ? "en" : "hu";
  } catch (e) { return "hu"; }
}
async function saveLang(v) {
  const lang = v === "en" ? "en" : "hu";
  try {
    if (!hasStore) { mem[LANGKEY] = lang; return true; }
    await window.storage.set(LANGKEY, lang, false);
    return true;
  } catch (e) { return false; }
}
const LangCtx = React.createContext({ lang: "hu", tt: (hu) => hu });
const useLang = () => React.useContext(LangCtx);
/* tt(hu, en): a jelenlegi nyelvnek megfelelő szöveget adja vissza. */

const SUPPORTED_LANGUAGES = ["hu", "en"];
const asLang = (v) => (v === "en" ? "en" : "hu");

const TERM_TEXT = {
  hu: {
    notSet: "nincs megadva",
    yearsOld: "éves",
    player: "játékos",
    ai: "bot",
    extra: "mellékszereplő",
    relTypes: {
      "Ellenség": "Ellenség",
      "Rivális": "Rivális",
      "Feszült": "Feszült",
      "Ismerős": "Ismerős",
      "Barát": "Barát",
      "Közeli barát": "Közeli barát",
      "Legjobb barát": "Legjobb barát",
    },
    relMoods: {
      "gyűlölik egymást": "gyűlölik egymást",
      "ellenséges": "ellenséges",
      "feszült": "feszült",
      "hűvös": "hűvös",
      "jóban vannak": "jóban vannak",
      "közeli": "közeli",
      "elválaszthatatlanok": "elválaszthatatlanok",
    },
    zodiac: {
      "Bak": "Bak", "Vízöntő": "Vízöntő", "Halak": "Halak", "Kos": "Kos", "Bika": "Bika", "Ikrek": "Ikrek",
      "Rák": "Rák", "Oroszlán": "Oroszlán", "Szűz": "Szűz", "Mérleg": "Mérleg", "Skorpió": "Skorpió", "Nyilas": "Nyilas",
    },
    bonds: {
      "Anya": "Anya", "Apa": "Apa", "Szülő": "Szülő", "Mostohaszülő": "Mostohaszülő",
      "Fia": "Fia", "Lánya": "Lánya", "Gyerek": "Gyerek", "Nevelt gyerek": "Nevelt gyerek",
      "Nagymama": "Nagymama", "Nagypapa": "Nagypapa", "Nagyszülő": "Nagyszülő", "Unoka": "Unoka",
      "Nagynéni": "Nagynéni", "Nagybácsi": "Nagybácsi", "Unokahúg / unokaöcs": "Unokahúg / unokaöcs",
      "Testvér": "Testvér", "Ikertestvér": "Ikertestvér", "Féltestvér": "Féltestvér", "Mostohatestvér": "Mostohatestvér",
      "Unokatestvér": "Unokatestvér", "Rokon": "Rokon", "Após / anyós": "Após / anyós", "Meny / vő": "Meny / vő",
      "Sógor / sógornő": "Sógor / sógornő", "Járnak": "Járnak", "Jegyesek": "Jegyesek", "Házastárs": "Házastárs",
      "Exek": "Exek", "Titkos viszony": "Titkos viszony", "Osztálytárs": "Osztálytárs", "Szomszéd": "Szomszéd",
      "Munkatárs": "Munkatárs", "Crush": "Crush", "Kölcsönös crush": "Kölcsönös crush", "Főnök": "Főnök",
      "Beosztott": "Beosztott", "Mentor": "Mentor", "Tanítvány": "Tanítvány", "Tanár": "Tanár", "Edző": "Edző",
    },
  },
  en: {
    notSet: "not specified",
    yearsOld: "years old",
    player: "player",
    ai: "bot",
    extra: "side character",
    relTypes: {
      "Ellenség": "Enemy",
      "Rivális": "Rival",
      "Feszült": "Tense",
      "Ismerős": "Acquaintance",
      "Barát": "Friend",
      "Közeli barát": "Close friend",
      "Legjobb barát": "Best friend",
    },
    relMoods: {
      "gyűlölik egymást": "they hate each other",
      "ellenséges": "hostile",
      "feszült": "tense",
      "hűvös": "cool toward each other",
      "jóban vannak": "on good terms",
      "közeli": "close",
      "elválaszthatatlanok": "inseparable",
    },
    zodiac: {
      "Bak": "Capricorn", "Vízöntő": "Aquarius", "Halak": "Pisces", "Kos": "Aries", "Bika": "Taurus", "Ikrek": "Gemini",
      "Rák": "Cancer", "Oroszlán": "Leo", "Szűz": "Virgo", "Mérleg": "Libra", "Skorpió": "Scorpio", "Nyilas": "Sagittarius",
    },
    bonds: {
      "Anya": "Mother", "Apa": "Father", "Szülő": "Parent", "Mostohaszülő": "Stepparent",
      "Fia": "Son", "Lánya": "Daughter", "Gyerek": "Child", "Nevelt gyerek": "Stepchild",
      "Nagymama": "Grandmother", "Nagypapa": "Grandfather", "Nagyszülő": "Grandparent", "Unoka": "Grandchild",
      "Nagynéni": "Aunt", "Nagybácsi": "Uncle", "Unokahúg / unokaöcs": "Niece / nephew",
      "Testvér": "Sibling", "Ikertestvér": "Twin sibling", "Féltestvér": "Half-sibling", "Mostohatestvér": "Stepsibling",
      "Unokatestvér": "Cousin", "Rokon": "Relative", "Após / anyós": "Parent-in-law", "Meny / vő": "Daughter/son-in-law",
      "Sógor / sógornő": "Sibling-in-law", "Járnak": "Dating", "Jegyesek": "Engaged", "Házastárs": "Spouse",
      "Exek": "Exes", "Titkos viszony": "Secret affair", "Osztálytárs": "Classmate", "Szomszéd": "Neighbor",
      "Munkatárs": "Coworker", "Crush": "Crush", "Kölcsönös crush": "Mutual crush", "Főnök": "Boss",
      "Beosztott": "Subordinate", "Mentor": "Mentor", "Tanítvány": "Student", "Tanár": "Teacher", "Edző": "Coach",
    },
  },
};

function termText(key, lang = CURRENT_LANG) {
  const dict = TERM_TEXT[asLang(lang)] || TERM_TEXT.hu;
  return dict[key] || TERM_TEXT.hu[key] || key;
}

function localizedBond(value, lang = CURRENT_LANG) {
  if (!value) return "";
  const dict = (TERM_TEXT[asLang(lang)] || TERM_TEXT.hu).bonds || {};
  return dict[value] || value;
}

function localizedRelType(value, lang = CURRENT_LANG) {
  const dict = (TERM_TEXT[asLang(lang)] || TERM_TEXT.hu).relTypes || {};
  return dict[value] || value;
}

function localizedRelMood(value, lang = CURRENT_LANG) {
  const dict = (TERM_TEXT[asLang(lang)] || TERM_TEXT.hu).relMoods || {};
  return dict[value] || value;
}

function localizedZodiac(value, lang = CURRENT_LANG) {
  const dict = (TERM_TEXT[asLang(lang)] || TERM_TEXT.hu).zodiac || {};
  return dict[value] || value;
}

const SYS_TEXT = {
  hu: {
    someone: "Valaki",
    noteReacted: "{{name}} reagált a jegyzetedre.",
    commentedYourPost: "{{name}} hozzászólt a posztodhoz: \"{{snippet}}\"",
    repliedYourComment: "{{name}} válaszolt a kommentedre: \"{{snippet}}\"",
    mentionedYou: "{{name}} megemlített téged.",
    relationshipDelta: "{{name}} kapcsolata veled: {{delta}}{{why}}",
    likedYourPost: "{{name}} kedvelte a posztodat.",
    wroteOnYourNote: "{{name}} a jegyzetedre írt: \"{{snippet}}\"",
    dmFrom: "{{name}} írt neked: \"{{snippet}}\"",
    noMessagesYet: "Még nem írtatok egymásnak",
  },
  en: {
    someone: "Someone",
    noteReacted: "{{name}} reacted to your note.",
    commentedYourPost: "{{name}} commented on your post: \"{{snippet}}\"",
    repliedYourComment: "{{name}} replied to your comment: \"{{snippet}}\"",
    mentionedYou: "{{name}} mentioned you.",
    relationshipDelta: "{{name}} changed their relationship toward you: {{delta}}{{why}}",
    likedYourPost: "{{name}} liked your post.",
    wroteOnYourNote: "{{name}} wrote about your note: \"{{snippet}}\"",
    dmFrom: "{{name}} messaged you: \"{{snippet}}\"",
    noMessagesYet: "You haven't messaged each other yet",
  },
};

function fillTpl(tpl, params) {
  return String(tpl || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => String(params && params[k] !== undefined ? params[k] : ""));
}

function worldLanguage(w, playerId) {
  const pid = playerId || (w && w.meId);
  const userLang = w && w.userSettings && pid && w.userSettings[pid] && w.userSettings[pid].language;
  if (SUPPORTED_LANGUAGES.indexOf(userLang) >= 0) return userLang;
  if (w && SUPPORTED_LANGUAGES.indexOf(w.aiLang) >= 0) return w.aiLang;
  return asLang(CURRENT_LANG);
}

function sysTextFor(w, playerId, key, params) {
  const lang = worldLanguage(w, playerId);
  const dict = SYS_TEXT[lang] || SYS_TEXT.hu;
  const tpl = dict[key] || SYS_TEXT.hu[key] || key;
  return fillTpl(tpl, params || {});
}

function sysLangText(w, playerId, hu, en) {
  return worldLanguage(w, playerId) === "en" ? en : hu;
}

const AUTO = "masvilag:auto";
const AUTO_DEFAULT = { on: true, every: 6 };
async function loadAuto() {
  if (!hasStore) return { ...AUTO_DEFAULT, ...(mem[AUTO] || {}) };
  try {
    const r = await window.storage.get(AUTO, false);
    return r ? { ...AUTO_DEFAULT, ...JSON.parse(r.value) } : { ...AUTO_DEFAULT };
  } catch (e) { return { ...AUTO_DEFAULT }; }
}
async function saveAuto(cfg) {
  if (!hasStore) { mem[AUTO] = cfg; return true; }
  try { await window.storage.set(AUTO, JSON.stringify(cfg), false); return true; }
  catch (e) { return false; }
}

/* A saját világaid listája ezen az eszközön. */
const ROOMS = "masvilag:rooms";
async function loadRooms() {
  if (!hasStore) return mem[ROOMS] || [];
  try {
    const r = await window.storage.get(ROOMS, false);
    const list = r ? JSON.parse(r.value) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}
async function saveRooms(list) {
  if (!hasStore) { mem[ROOMS] = list; return true; }
  try { await window.storage.set(ROOMS, JSON.stringify(list), false); return true; }
  catch (e) { return false; }
}
async function rememberRoom(entry) {
  const list = await loadRooms();
  const rest = list.filter((r) => r && r.code !== entry.code);
  return saveRooms([{ ...entry, ts: now() }].concat(rest).slice(0, 40));
}
async function forgetRoom(code) {
  const list = await loadRooms();
  return saveRooms(list.filter((r) => r && r.code !== code));
}
async function destroyWorld(code) {
  await dropBig(KEY(code));
  await dropMedia(code);
  await removeFromIndex(code);
  return true;
}

/* Minden másvilág-adat törlése ebből a tárolóból: világok, képtárak,
   a saját szobalistád és a bejelentkezésed. Nincs visszaút. */
async function wipeEverything() {
  let count = 0;
  if (!hasStore) { Object.keys(mem).forEach((k) => delete mem[k]); return count; }
  const sweep = async (shared) => {
    let cursor = null;
    for (let round = 0; round < 20; round++) {
      let res = null;
      try { res = await window.storage.list("masvilag:", shared); } catch (e) { return; }
      const raw = (res && res.keys) || [];
      const keys = raw.map((k) => (typeof k === "string" ? k : (k && k.key))).filter(Boolean);
      if (!keys.length) return;
      for (let i = 0; i < keys.length; i++) {
        try { await window.storage.delete(keys[i], shared); count++; } catch (e) { /* lehet, hogy már nincs */ }
      }
      if (keys.length < 2) return;
      if (cursor === keys[keys.length - 1]) return;
      cursor = keys[keys.length - 1];
    }
  };
  await sweep(true);
  await sweep(false);
  return count;
}

/* Egy tárolókulcs mérete korlátos, ezért a nagy tartalmakat — a világot és a
   képtárat — darabokban mentjük. Így hosszú játék és sok kép után sem akad el
   a mentés, és nem kapsz hibaüzenetet. */
const MCHUNK = 2500000;

async function readBig(base) {
  return readBigScoped(base, true);
}

async function writeBig(base, txt) {
  return writeBigScoped(base, txt, true);
}

async function dropBig(base) {
  return dropBigScoped(base, true);
}
const mediaBytes = (m) => Object.keys(m || {}).reduce((sum, k) => sum + ((m[k] && m[k].length) || 0), 0);
const MEDIA_CAP = 40 * 1048576;

async function serverLoadMedia() {
  const res = await fetch("/media/load", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  let data = {};

  try {
    data = await res.json();
  } catch (e) {
    data = {};
  }

  if (!res.ok) {
    throw new Error(
      data?.error ||
      `Media load failed (${res.status})`
    );
  }

  return (
    data?.media &&
    typeof data.media === "object"
      ? data.media
      : {}
  );
}


async function serverSaveMedia(media) {
  const res = await fetch("/media/save", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      media: media || {},
    }),
  });

  let data = {};

  try {
    data = await res.json();
  } catch (e) {
    data = {};
  }

  if (!res.ok) {
    throw new Error(
      data?.error ||
      `Media save failed (${res.status})`
    );
  }

  return true;
}


async function loadMedia(code) {
  /*
    1. Képek erről az eszközről.
  */
  const localTxt =
    await readBigScoped(
      MKEY(code),
      false
    );

  /*
    2. Régi shared/browser media storage.
  */
  const legacyTxt =
    await readBig(
      MKEY(code)
    );

  const parseMedia = (txt) => {
    if (!txt) return {};

    try {
      const parsed = JSON.parse(txt);

      return (
        parsed &&
        typeof parsed === "object"
          ? parsed
          : {}
      );
    } catch (e) {
      return {};
    }
  };

  const localMedia =
    parseMedia(localTxt);

  const legacyMedia =
    parseMedia(legacyTxt);

  /*
    3. PostgreSQL-ben tárolt közös médiatár.
  */
  let cloudMedia = {};

  try {
    cloudMedia =
      await serverLoadMedia();
  } catch (e) {
    console.warn(
      "Cloud media load failed:",
      e
    );
  }

  /*
    Először a régi böngészős képek,
    utána az adott eszköz helyi képei,
    végül a szerver.

    Így:
    - a PC régi képei nem vesznek el;
    - a telefon megkapja a cloud képeket;
    - ha ugyanaz a kép már szerveren is
      létezik, a szerveres verzió az elsődleges.
  */
  const merged = {
    ...legacyMedia,
    ...localMedia,
    ...cloudMedia,
  };

  /*
    A cloudból érkezett képeket
    ezen az eszközön is cache-eljük.
  */
  try {
    await writeBigScoped(
      MKEY(code),
      JSON.stringify(merged),
      false
    );
  } catch (e) {
    console.warn(
      "Local media cache failed:",
      e
    );
  }

  /*
    MIGRÁCIÓ:
    ha ezen az eszközön vannak régi képek,
    amelyek még nincsenek a PostgreSQL-ben,
    automatikusan feltöltjük őket.
  */
  const hasLocalMedia =
    Object.keys(localMedia).length > 0 ||
    Object.keys(legacyMedia).length > 0;

  const mergedJson =
    JSON.stringify(merged);

  const cloudJson =
    JSON.stringify(cloudMedia);

  if (
    hasLocalMedia &&
    mergedJson !== cloudJson
  ) {
    try {
      await serverSaveMedia(merged);
    } catch (e) {
      console.warn(
        "Cloud media migration failed:",
        e
      );
    }
  }

  return merged;
}


async function saveMedia(code, media) {
  const safeMedia =
    media &&
    typeof media === "object"
      ? media
      : {};

  const txt =
    JSON.stringify(safeMedia);

  /*
    1. Helyi cache / biztonsági másolat.
  */
  try {
    await writeBigScoped(
      MKEY(code),
      txt,
      false
    );
  } catch (e) {
    console.warn(
      "Local media save failed:",
      e
    );
  }

  /*
    2. PostgreSQL.
    Ettől lesz ugyanaz a kép elérhető
    PC-n, telefonon és más eszközön is.
  */
  try {
    await serverSaveMedia(
      safeMedia
    );

    return true;
  } catch (e) {
    console.warn(
      "Cloud media save failed:",
      e
    );

    return false;
  }
}

async function dropMedia(code) {
  await dropBigScoped(MKEY(code), false);
  return dropBig(MKEY(code));
}

/* ---------- kezdő világ ---------- */
function seedWorld(code) {
  const mk = (o) => ({ id: uid(), avatar: "", ...o });
  const chars = [
    mk({ name: "Ryan Cole", username: "ryancole", birth: "2008. február 2.", gender: "férfi", job: "diák, kosárcsapat", city: "Beacon Falls",
      looks: "sötét haj, hideg szürke szem, magas", personality: "arrogáns, éles nyelvű, versengő, mélyen sértett",
      traits: "IQ magas, empátia alacsony, humor száraz", speech: "rövid, gunyoros mondatok, ritka emoji",
      goals: "bizonyítani, hogy nem szorul senkire", secrets: "az apja elhagyta a családot, senkinek sem mondta el",
      backstory: "A város kedvence a pályán, otthon viszont üres a ház." }),
    mk({ name: "Mia Halvorsen", username: "miaaa", birth: "2008. szeptember 30.", gender: "nő", job: "diák, iskolaújság", city: "Beacon Falls",
      looks: "vörösesszőke haj, szeplők", personality: "kedves, kíváncsi, konfliktuskerülő, de kitartó",
      traits: "empátia magas, bátorság közepes", speech: "meleg hangnem, sok emoji, kérdez",
      goals: "megírni a cikket, ami felrobbantja a várost", secrets: "tud valamit Ryan apjáról",
      backstory: "Mindenki hozzá fordul, de őt senki nem kérdezi meg, hogy van." }),
    mk({ name: "James Okoro", username: "jamesok", birth: "2007. július 19.", gender: "férfi", job: "diák, DJ", city: "Beacon Falls",
      looks: "magas, mindig kapucnis", personality: "vicces, lojális, provokál, ha unatkozik",
      traits: "humor magas, türelem alacsony", speech: "sok szleng, kisbetűk, tagel másokat",
      goals: "a nyár legjobb buliját megcsinálni", secrets: "titokban zenét ír Miáról",
      backstory: "Ryan legrégebbi barátja, és az egyetlen, aki mer nemet mondani neki." }),
    mk({ name: "Nora Vasquez", username: "nora.v", birth: "2008. november 8.", gender: "nő", job: "diák", city: "Beacon Falls",
      looks: "fekete bob, mindig sminkelt", personality: "manipulatív, elbűvölő, számító",
      traits: "EQ magas, őszinteség alacsony", speech: "választékos, kétértelmű mondatok",
      goals: "átvenni Miától a figyelmet", secrets: "ő terjesztette a pletykát tavaly",
      backstory: "Mindenkiről tud valamit, és mindent a megfelelő pillanatra tartogat." }),
  ];
  const w = {
    code: String(code).toLowerCase().trim(), rev: 1,
    universe: {
      name: "Beacon Falls",
      year: String(new Date().getFullYear()),
      date: "szeptember 3.",
      description:
        "Kisváros a hegyek között, ahol mindenki ismer mindenkit, és minden titok végül kiszivárog. Modern világ, mágia nincs. A történet a Beacon Falls Gimnázium utolsó éve körül forog: bulik, pletykák, régi sérelmek és egy tavalyi baleset, amiről senki nem beszél szívesen.",
      at: now(),
    },
    chars, extras: [], rels: {}, posts: [], chats: {}, mems: {}, charMemory: {}, userSettings: {}, log: [], scenes: [], groups: [], notes: [],
    accounts: {}, players: {}, deleted: {}, notify: {},
  };
  // példa mellékszereplő: van, akiről csak beszélnek
  const dad = { id: "x" + uid(), name: "Cole Márk", note: "Ryan apja, három éve elköltözött a városból", updatedAt: now() };
  w.extras.push(dad);
  setRel(w, chars[0].id, dad.id, { score: -65, bond: "Apa", fixed: true, hidden: "hiába gyűlöli, még mindig várja, hogy felhívja" });
  setRel(w, chars[0].id, chars[2].id, { score: 70, bond: "Legjobb barát", fixed: false });
  setRel(w, chars[1].id, chars[3].id, { score: -25, bond: "Rivális", fixed: false });
  setRel(w, chars[2].id, chars[1].id, { score: 40, bond: "Crush", fixed: false, hidden: "titokban szerelmes belé, de sosem vallaná be" });
  setRel(w, chars[0].id, chars[3].id, { score: 15, bond: "Unokatestvér", fixed: true });
  w.starter = [
    { char: chars[0].id, score: 5 },
    { char: chars[1].id, score: 20, bond: "Barát" },
  ];
  w.posts = [{
    id: uid(), authorId: chars[2].id, ts: now() - 3600e3, likes: 12,
    text: "szombat, régi malom, hangfal nálam. aki nem jön, az magyarázkodjon hétfőn 🔊",
    comments: [
      { id: uid(), authorId: chars[0].id, text: "megint az a hely? kreatív vagy.", ts: now() - 3400e3, parent: null },
      { id: uid(), authorId: chars[1].id, text: "ott leszek! hozok sütit 🧁", ts: now() - 3300e3, parent: null },
    ],
  }];
  w.notes = [
    { id: uid(), authorId: chars[2].id, text: "szombat. malom. ne kérdezz.", ts: now() - 1800e3, reacts: [] },
    { id: uid(), authorId: chars[1].id, text: "ha valaki tud valamit, most szóljon 👀", ts: now() - 5400e3, reacts: [] },
    { id: uid(), authorId: chars[0].id, text: "nem érek rá.", ts: now() - 7200e3, reacts: [] },
  ];
  w.log = ["James bulit hirdetett a régi malomban.", "Nora új képet posztolt, Mia nem lájkolta."];
  return w;
}

function emptyWorld(code) {
  const w = seedWorld(code);
  w.chars = []; w.extras = []; w.rels = {}; w.posts = []; w.log = []; w.scenes = []; w.groups = []; w.notes = []; w.starter = [];
  w.universe = {
    name: "Névtelen világ",
    year: String(new Date().getFullYear()),
    date: "",
    description: CURRENT_LANG === "en"
      ? "Describe the world: where it takes place, what rules apply, who the important characters are, and what happened recently."
      : "Írd le a világot: hol játszódik, milyen szabályok érvényesek, kik a fontos szereplők, mi történt nemrég.",
    at: now(),
  };
  return w;
}

/* ============================================================
   Fiók létrehozása és belépés
   ============================================================ */
function blankPlayer(id, name, username) {
  return {
    id, name: name || "Névtelen", username: username || "jatekos",
    birth: "", gender: "", orientation: "", height: "", job: "", city: "",
    bio: "", looks: "", personality: "", traits: "", speech: "", voice: "",
    goals: "", fears: "", likes: "", secrets: "", backstory: "", avatar: "",
  };
}

async function addAccount(w, username, pw, charName) {
  const u = normUser(username);
  const id = "u" + uid();
  // jelszó nélkül is létrejöhet a fiók; ilyenkor az első belépéskor adható meg
  let salt = "", hash = "";
  if (pw) { salt = newSalt(); hash = await hashPw(pw, salt); }
  w.accounts[id] = { id, username: u, salt, hash, created: now() };
  w.players[id] = blankPlayer(id, charName || u, uniqueHandle(w, u, id));
  if (!w.userSettings) w.userSettings = {};
  w.userSettings[id] = { language: asLang(w.aiLang || CURRENT_LANG) };
  (w.starter || []).forEach((st) => {
    if (st && st.char) setRel(w, st.char, id, { score: st.score || 0, bond: st.bond || "", fixed: !!st.fixed });
  });
  w.rev = (w.rev || 0) + 1;
  return id;
}

async function saveNewAccount(code, username, pw, charName) {
  const fresh = (await loadWorld(code)) || null;
  if (!fresh) throw new Error("Nincs ilyen kódú világ.");
  if (accByUser(fresh, username)) throw new Error("Ez a felhasználónév már foglalt ebben a világban.");
  const id = await addAccount(fresh, username, pw, charName);
  const ok = await saveWorld(fresh);
  if (!ok) throw new Error("A fiók mentése nem sikerült. Próbáld újra.");
  return { world: fresh, meId: id };
}

function NewWorld({ w, onReady, onClose, setErr }) {
  useEditLock();
  const { tt } = useLang();
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [charName, setCharName] = useState(w ? w.player.name : "");
  const [seed, setSeed] = useState(false);
  const [busy, setBusy] = useState(false);
  const username = w && w.accounts[w.meId] ? w.accounts[w.meId].username : "";

  const go = async () => {
    const c = code.trim().toLowerCase();
    if (!c) return setErr(tt("Adj a világnak egy kódot.", "Give the world a code."));
    if (pw.length < 4) return setErr(tt("A jelszó legyen legalább 4 karakter.", "The password must be at least 4 characters."));
    if (!charName.trim()) return setErr(tt("Add meg a karaktered nevét ebben a világban.", "Enter your character's name in this world."));
    setBusy(true);
    try {
      if (await loadWorld(c)) throw new Error(tt("Ez a világkód már foglalt. Válassz másikat.", "This world code is already taken. Choose another."));
      const nw = seed ? seedWorld(c) : emptyWorld(c);
      const meId = await addAccount(nw, username || normUser(charName) || "jatekos", pw, charName.trim());
      nw.owner = meId;
      if (!(await saveWorld(nw))) throw new Error(tt("A világ mentése nem sikerült.", "Failed to save the world."));
      onReady(nw, meId);
    } catch (e) { setErr((e && e.message) || tt("Nem sikerült létrehozni.", "Failed to create.")); }
    setBusy(false);
  };

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="between">
          <h2 style={{ fontSize: 20 }}>{tt("Új világ", "New world")}</h2>
          <button className="btn tiny ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          {tt("A felhasználóneved marad ", "Your username stays ")}<span className="mono">@{username}</span>{tt(", de a jelszót szobánként külön adod meg. A meglévő szobáid érintetlenek.", ", but you set the password separately per room. Your existing rooms are untouched.")}
        </p>

        <label className="f">{tt("Az új világ kódja", "The new world's code")}</label>
        <input className="i mono" value={code} placeholder={tt("pl. eszaki-part-2027", "e.g. northshore-2027")}
          onChange={(e) => setCode(e.target.value.replace(/\s+/g, "-").toLowerCase())} />

        <label className="f">{tt("Jelszó ehhez a szobához", "Password for this room")}</label>
        <input className="i" type="password" value={pw} placeholder={tt("legalább 4 karakter", "at least 4 characters")}
          autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />

        <label className="f">{tt("A karaktered neve itt", "Your character's name here")}</label>
        <input className="i" value={charName} onChange={(e) => setCharName(e.target.value)} />

        <div className="between" style={{ marginTop: 14 }}>
          <span className="hint">{tt("Kezdés példakarakterekkel", "Start with example characters")}</span>
          <button className={"btn tiny " + (seed ? "primary" : "ghost")} onClick={() => setSeed(!seed)}>{seed ? tt("Igen", "Yes") : tt("Nem", "No")}</button>
        </div>

        <button className="btn primary full" style={{ marginTop: 16 }} onClick={go} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <Zap size={15} />} {tt("Világ létrehozása", "Create world")}
        </button>
      </div>
    </div>
  );
}

function Rooms({ w, onOpen, onCreate, onClose, setErr, onSignOut, onNeedLogin }) {
  useEditLock();
  const { tt } = useLang();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);

  const refresh = useCallback(async () => {
  const mine = await loadRooms();

  setList(
    (mine || [])
      .filter((r) => r && r.code)
      .map((r) => ({
        code: r.code,
        name: r.name || r.code,
        meId: r.meId,
        username: r.username,
        owner: r.owner,
      }))
  );
}, []);

  useEffect(() => { refresh(); }, [refresh]);

  const open = async (r) => {
    setBusy(r.code);
    try {
      const wld = await loadWorld(r.code);
      if (!wld) throw new Error(tt("Ez a világ már nem érhető el.", "This world is no longer available."));
      let id = r.meId && wld.accounts && wld.accounts[r.meId] ? r.meId : null;
      if (!id && r.username) {
        const acc = accByUser(wld, r.username);
        if (acc) id = acc.id;
      }
      if (!id) { onNeedLogin(r.code); return; }
      onOpen(wld, id);
    } catch (e) { setErr((e && e.message) || tt("Nem sikerült megnyitni.", "Failed to open.")); }
    setBusy("");
  };

  const remove = async (r) => {
    setBusy(r.code);
    try {
      await forgetRoom(r.code);
      await refresh();
      setConfirm(null);
    } catch (e) { setErr((e && e.message) || tt("A törlés nem sikerült.", "Removal failed.")); }
    setBusy("");
  };

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="between">
          <h2 style={{ fontSize: 20 }}>{tt("Világaim", "My worlds")}</h2>
          <button className="btn tiny ghost" onClick={onClose}><X size={14} /></button>
        </div>

        <button className="btn primary full" style={{ marginTop: 14 }} onClick={onCreate}>
          <Plus size={15} /> {tt("Új világ létrehozása", "Create a new world")}
        </button>

        {list === null && <div className="thinking"><Loader2 size={13} className="spin" /> {tt("betöltés…", "loading\u2026")}</div>}
        {list && list.length === 0 && <p className="hint" style={{ marginTop: 14 }}>{tt("Még nincs egyetlen világod sem.", "You don't have any worlds yet.")}</p>}

        {(list || []).map((r) => {
          const here = w && r.code === w.code;
          const mine = !!(r.meId || r.username);
          return (
            <div className="card" key={r.code}>
              <div className="between">
                <div style={{ minWidth: 0 }}>
                  <div className="name">{r.name || r.code}</div>
                  <div className="handle mono">{r.code}{r.username ? " · @" + r.username : ""}</div>
                </div>
                {here ? <span className="chip" style={{ color: "var(--rose)", borderColor: "var(--rose)" }}>{tt("itt vagy", "you're here")}</span> : null}
              </div>

              {!mine && !here && (
                <p className="hint" style={{ marginTop: 6 }}>{tt("Ebben a világban még nincs profilod ezen az eszközön.", "You don't have a profile in this world on this device yet.")}</p>
              )}

              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn full" onClick={() => open(r)} disabled={here || busy === r.code}>
                  {busy === r.code ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
                  {mine ? tt("Belépés", "Log in") : tt("Belépés kóddal", "Log in with code")}
                </button>
                <button className="btn ghost" style={{ color: "var(--steel)" }} onClick={() => setConfirm(r)} disabled={busy === r.code}>
                  <Trash2 size={14} />
                </button>
              </div>

              {confirm && confirm.code === r.code && (
                <div style={{ marginTop: 10 }}>
                  <p className="hint">
                    {tt("Eltünteted a listádból? A világ maga megmarad — a kóddal bárki, akinek profilja van benne, továbbra is beléphet.", "Remove it from your list? The world itself remains — anyone with a profile in it can still log in with the code.")}
                  </p>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <button className="btn full tiny" style={{ background: "var(--oxblood)", borderColor: "var(--oxblood)" }}
                      onClick={() => remove(r)}>{tt("Eltávolítás a listámból", "Remove from my list")}</button>
                    <button className="btn ghost full tiny" onClick={() => setConfirm(null)}>{tt("Mégse", "Cancel")}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="sep" />
        <button className="btn full" onClick={onSignOut}>
          <Zap size={14} /> Belépés másik világba kóddal
        </button>
        <p className="hint" style={{ marginTop: 10 }}>
          Itt minden világ szerepel, amit létrehoztál. Ahol van profilod, oda egy kattintással belépsz;
          ahol még nincs, ott a belépőképernyőn adod meg a neved.
        </p>
      </div>
    </div>
  );
}

function Boot({ onReady, prefill, lang, onLang, bootErr }) {
  const { tt } = useLang();
  const [mode, setMode] = useState("login"); // login | join | new
  const [code, setCode] = useState(prefill || "");
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [name, setName] = useState("");
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [peek, setPeek] = useState(null);
  const [rooms, setRooms] = useState([]);
  

  // ezen az eszközön korábban használt szobák — gyors belépéshez
  // A világlista nem csak az eszközödön él: a jegyzékből is feltöltjük, így
  // másik gépről is megjelenik minden világod, és elég a jelszót beírnod.
  useEffect(() => {
  let alive = true;

  (async () => {
    const mine = await loadRooms();

    if (!alive) return;

    setRooms(
      (mine || [])
        .filter((r) => r && r.code)
        .map((r) => ({
          code: r.code,
          name: r.name || r.code,
          username: r.username || "",
        }))
    );
  })();

  return () => {
    alive = false;
  };
}, []);

  // a szobakód ellenőrzése gépelés közben
  useEffect(() => {
    const c = code.trim().toLowerCase();
    if (!c) { setPeek(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const wld = await loadWorld(c);
      if (!alive) return;
      setPeek(wld ? {
        found: true,
        name: (wld.universe && wld.universe.name) || c,
        users: Object.keys(wld.accounts || {}).map((id) => (wld.accounts[id] || {}).username).filter(Boolean),
      } : { found: false });
    }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [code]);

  const u = normUser(user);
  const known = peek && peek.found ? peek.users : [];
  const isLogin = mode === "login";
  const isNew = mode === "new";
  const needName = !isLogin;
  const needPw = true;

  const go = async () => {
  const c = code.trim().toLowerCase();

  if (!c) {
    return setErr(
      tt(
        "Adj meg egy világkódot.",
        "Enter a world code."
      )
    );
  }

  if (!u) {
    return setErr(
      tt(
        "Adj meg egy felhasználónevet (betűk, számok, pont, kötőjel).",
        "Enter a username (letters, numbers, dot, hyphen)."
      )
    );
  }

  if (needPw && pw.length < 4) {
    return setErr(
      tt(
        "A jelszó legyen legalább 4 karakter.",
        "The password must be at least 4 characters."
      )
    );
  }

  if (needPw && needName && pw !== pw2) {
    return setErr(
      tt(
        "A két jelszó nem egyezik.",
        "The two passwords don't match."
      )
    );
  }

  if (needName && !name.trim()) {
    return setErr(
      tt(
        "Add meg a karaktered nevét.",
        "Enter your character's name."
      )
    );
  }

  setBusy(true);
  setErr("");

  try {
    /* ========================================================
       ÚJ VILÁG
       ======================================================== */

    if (isNew) {
      /*
        Először csak azt nézzük meg, hogy ezen az eszközön
        nincs-e már ilyen kódú régi világ.
      */
      const localExisting = await loadWorld(c);

      if (localExisting) {
        throw new Error(
          tt(
            "Ez a világkód már foglalt. Válassz másikat, vagy lépj be a Belépés fülön.",
            "This world code is already taken. Choose another, or log in on the Login tab."
          )
        );
      }

      const w = seed
        ? seedWorld(c)
        : emptyWorld(c);

      w.aiLang = lang === "en" ? "en" : "hu";

      const localMeId = await addAccount(
        w,
        u,
        pw,
        name.trim()
      );

      w.owner = localMeId;

      /*
        Helyi biztonsági másolat továbbra is készül.
      */
      if (!(await saveWorld(w))) {
        throw new Error(
          tt(
            "A világ helyi mentése nem sikerült.",
            "Failed to save the world locally."
          )
        );
      }

      /*
        Az új világot rögtön feltöltjük PostgreSQL-be.
        A migrate endpoint azt is ellenőrzi, hogy a kód
        nincs-e már foglalva a szerveren.
      */
      let created;

      try {
        created = await serverMigrate(
          w,
          u,
          pw
        );
      } catch (e) {
        if (e && e.status === 409) {
          throw new Error(
            tt(
              "Ez a világkód már foglalt a szerveren. Válassz másikat.",
              "This world code is already taken on the server. Choose another."
            )
          );
        }

        throw e;
      }

      const serverWorld = migrate(
        created && created.world
          ? created.world
          : w
      );

      const serverMeId =
        (created && created.meId) ||
        localMeId;

      onReady(
        serverWorld,
        serverMeId
      );

      return;
    }

    /* ========================================================
       BELÉPÉS MEGLÉVŐ VILÁGBA
       ======================================================== */

    /*
      ELŐSZÖR mindig a PostgreSQL-t próbáljuk.

      Ez az, amitől egy teljesen másik telefonon/laptopon
      is működni fog a world code + username + password.
    */
    try {
      const result = await serverLogin(
        c,
        u,
        pw
      );

      if (
        !result ||
        !result.world ||
        !result.meId
      ) {
        throw new Error(
          tt(
            "A szerver hibás belépési választ adott.",
            "The server returned an invalid login response."
          )
        );
      }

      const serverWorld = migrate(
        result.world
      );

      onReady(
        serverWorld,
        result.meId
      );

      return;
    } catch (serverError) {
      /*
        401 = a világ létezik a szerveren,
        csak a username/jelszó rossz.

        Ilyenkor NEM próbáljuk egy helyi mentéssel
        felülírni.
      */
      if (
        serverError &&
        serverError.status === 401
      ) {
        throw new Error(
          tt(
            "Hibás felhasználónév vagy jelszó.",
            "Wrong username or password."
          )
        );
      }

      /*
        404 = a világ még nincs PostgreSQL-ben.

        Ez várható a jelenlegi Beacon Falls világod
        legelső szerveres belépésénél.
      */
      if (
        !serverError ||
        serverError.status !== 404
      ) {
        throw serverError;
      }
    }

    /* ========================================================
       RÉGI HELYI VILÁG ELSŐ MIGRÁCIÓJA
       ======================================================== */

    const localWorld = await loadWorld(c);

    if (!localWorld) {
      throw new Error(
        tt(
          "Nincs ilyen világkód. Ellenőrizd, vagy hozz létre új világot.",
          "No such world code. Check it, or create a new world."
        )
      );
    }

    /*
      A szerver itt ellenőrzi a localWorld-ben található
      accountot és a megadott jelszót.

      Csak sikeres ellenőrzés után kerül PostgreSQL-be.
    */
    let migratedResult;

    try {
      migratedResult = await serverMigrate(
        localWorld,
        u,
        pw
      );
    } catch (e) {
      if (e && e.status === 401) {
        throw new Error(
          tt(
            "Hibás felhasználónév vagy jelszó.",
            "Wrong username or password."
          )
        );
      }

      /*
        Ha közben valahogy már felkerült a világ,
        próbáljuk meg rendes szerveres belépéssel.
      */
      if (e && e.status === 409) {
        const loginResult = await serverLogin(
          c,
          u,
          pw
        );

        onReady(
          migrate(loginResult.world),
          loginResult.meId
        );

        return;
      }

      throw e;
    }

    if (
      !migratedResult ||
      !migratedResult.world ||
      !migratedResult.meId
    ) {
      throw new Error(
        tt(
          "A világ szerverre költöztetése nem sikerült.",
          "Failed to migrate the world to the server."
        )
      );
    }

    onReady(
      migrate(migratedResult.world),
      migratedResult.meId
    );
  } catch (e) {
    setErr(
      (e && e.message) ||
        tt(
          "Nem sikerült a belépés.",
          "Login failed."
        )
    );
  } finally {
    setBusy(false);
  }
};


  /* Mentésfájlból is be lehet lépni — ez a biztos út másik eszközön. */
  

  const onEnter = (e) => { if (e.key === "Enter" && !busy) go(); };
  const tab = (k, label) => (
    <button className={"btn full " + (mode === k ? "primary" : "")} style={{ padding: "9px 6px", fontSize: 12.5 }}
      onClick={() => { setMode(k); setErr(""); }}>{label}</button>
  );

  return (
    <div className="mv-wrap" style={{ justifyContent: "center", padding: "0 18px", overflowY: "auto" }}>
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div className="mark" style={{ fontSize: 40 }}>más<i>világ</i></div>
        <div className="hdr-meta" style={{ marginTop: 6 }}>{tt("AI-lakta közösségi média", "AI-inhabited social media")}</div>
      </div>

      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        <button className={"btn tiny full " + (lang !== "en" ? "primary" : "ghost")} onClick={() => onLang("hu")}>Magyar</button>
        <button className={"btn tiny full " + (lang === "en" ? "primary" : "ghost")} onClick={() => onLang("en")}>English</button>
      </div>

      {bootErr ? <div className="err" style={{ marginTop: 10 }}>{bootErr}</div> : null}

      <p className="hint" style={{ textAlign: "center", margin: "14px 0 4px" }}>
        {tt("Minden világ egy kódon él. A kód, a felhasználóneved és a jelszavad együtt visz vissza oda, ahol abbahagytad.",
            "Every world lives on a code. The code, your username and your password together bring you back where you left off.")}
      </p>

      <div className="card">
        <div className="row" style={{ gap: 6 }}>
          {tab("login", tt("Belépés", "Log in"))}
          {tab("new", tt("Új világ", "New world"))}
        </div>

        <label className="f">{isNew ? tt("Az új világ kódja", "The new world's code") : tt("Világkód", "World code")}</label>
        <input className="i mono" value={code} placeholder="pl. beaconfalls-2026" onKeyDown={onEnter}
          onChange={(e) => setCode(e.target.value.replace(/\s+/g, "-").toLowerCase())} />

        {peek && code.trim() && (
          <p className="hint" style={{ marginTop: 6 }}>
            {peek.found
              ? <span style={{ color: isNew ? "var(--rose)" : "var(--gold)" }}>
                  {isNew ? tt("Ez a kód már foglalt — válassz másikat.", "This code is already taken — choose another.")
                         : tt(`Megvan: ${peek.name}`, `Found it: ${peek.name}`)}
                </span>
              : <span style={{ color: isNew ? "var(--gold)" : "var(--rose)" }}>
                  {isNew ? tt("Szabad kód, mehet.", "Code is free, go ahead.") : tt("Nincs ilyen világ. Ellenőrizd a kódot.", "No such world. Check the code.")}
                </span>}
          </p>
        )}

        <label className="f">{tt("Felhasználóneved", "Your username")}</label>
        <input className="i mono" value={user} placeholder="pl. anita" onKeyDown={onEnter}
          autoComplete={isLogin ? "username" : "off"}
          onChange={(e) => setUser(e.target.value.toLowerCase())} />

        {needPw && (
          <>
            <label className="f">{tt("Jelszó", "Password")}</label>
            <input className="i" type="password" value={pw} placeholder={tt("legalább 4 karakter", "at least 4 characters")} onKeyDown={onEnter}
              autoComplete={isLogin ? "current-password" : "new-password"}
              onChange={(e) => setPw(e.target.value)} />
            {isLogin && (
              <p className="hint" style={{ marginTop: 6 }}>
                {tt("Ha ehhez a névhez még nincs jelszó, akkor amit most beírsz, az lesz az.",
                    "If this name doesn't have a password yet, what you type now will become it.")}
              </p>
            )}
            {needName && (
              <input className="i" style={{ marginTop: 6 }} type="password" value={pw2} placeholder={tt("jelszó még egyszer", "password again")}
                autoComplete="new-password" onKeyDown={onEnter} onChange={(e) => setPw2(e.target.value)} />
            )}
          </>
        )}

        {needName && (
          <>
            <label className="f">{tt("A karaktered neve", "Your character's name")}</label>
            <input className="i" value={name} placeholder="pl. Anita Kovács" onKeyDown={onEnter}
              onChange={(e) => setName(e.target.value)} />
            <p className="hint" style={{ marginTop: 6 }}>
              {tt("Ezzel a karakterrel posztolsz, csetelsz és játszol a jelenetekben. Az adatlapját később bármikor kitöltöd.",
                  "You'll post, chat and play scenes with this character. You can fill in their sheet anytime later.")}
            </p>
          </>
        )}

        {isNew && (
          <div className="between" style={{ marginTop: 14 }}>
            <span className="hint">{tt("Kezdés példakarakterekkel", "Start with example characters")}</span>
            <button className={"btn tiny " + (seed ? "primary" : "ghost")} onClick={() => setSeed(!seed)}>{seed ? tt("Igen", "Yes") : tt("Nem", "No")}</button>
          </div>
        )}

        {err && <div className="err">{err}</div>}

        <button className="btn primary full" style={{ marginTop: 16 }} onClick={go} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <Zap size={15} />}
          {isLogin ? tt("Belépés", "Log in") : tt("Világ létrehozása", "Create world")}
        </button>
      </div>



      <p className="hint" style={{ textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
        {tt("A jelszó egyszerű zár, nem banki védelem: sózott ellenőrzőösszegként tárolódik, de a szoba adatai a kódot ismerők számára elérhetők. Ne használj olyan jelszót, amit máshol is használsz.",
            "The password is a simple lock, not bank-grade security: it's stored as a salted checksum, but the room's data is accessible to anyone who knows the code. Don't reuse a password you use elsewhere.")}
      </p>
      {!hasStore && <p className="hint" style={{ textAlign: "center", marginTop: 10 }}>{tt("Figyelem: a tárolás nem érhető el, a világ csak eddig a munkamenetig marad meg.", "Note: storage isn't available, the world will only last for this session.")}</p>}
    </div>
  );
}

/* ============================================================
   Feed — szálas kommentekkel
   ============================================================ */
function CommentNode({ w, c, allComments, onReply, onAskReply, busy, depth }) {
  const { tt } = useLang();
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const a = charById(w, c.authorId);
  const replies = (allComments || []).filter((x) => x.parent === c.id);
  if (!a) return null;
  const send = () => {
    const t = txt.trim();
    if (!t) return;
    onReply(c.id, t);
    setTxt(""); setOpen(false);
  };
  return (
    <div style={depth ? { marginLeft: 20, paddingLeft: 10, borderLeft: "1px solid var(--line)" } : null}>
      <div className="cmt">
        <Av src={a.avatar} name={a.name} size={depth ? 24 : 28} radius={depth ? 8 : 9} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="cmt-name">{a.name} </span>
          <span className="handle mono">@{a.username}</span>
          <div className="cmt-body">{c.text}</div>
          <div className="row" style={{ gap: 6, marginTop: 5 }}>
            <button className="btn tiny ghost" onClick={() => setOpen(!open)}>{tt("Válasz", "Reply")}</button>
            <button className="btn tiny ghost" onClick={() => onAskReply(c)} disabled={!!busy}>
              {busy === "c:" + c.id ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} color="var(--gold)" />}
              {tt("Válaszoljanak", "Let them reply")}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="row" style={{ gap: 8, marginTop: 8, marginLeft: depth ? 0 : 36, alignItems: "center" }}>
          <input className="i" style={{ padding: "6px 10px", fontSize: 13 }} value={txt} autoFocus
            placeholder={tt(`Válasz neki: ${a.name}`, `Reply to ${a.name}`)} onChange={(e) => setTxt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
          <button className="btn primary tiny" onClick={send} disabled={!txt.trim()}><Send size={12} /></button>
        </div>
      )}

      {replies.map((r) => (
        <CommentNode key={r.id} w={w} c={r} allComments={allComments} depth={(depth || 0) + 1}
          onReply={onReply} onAskReply={onAskReply} busy={busy} />
      ))}
    </div>
  );
}

function Post({ w, post, onComments, busy, onLike, onComment, onAskReply, highlight, nodeRef }) {
  const { tt } = useLang();
  const { media } = useMedia();
  const [cmt, setCmt] = useState("");
  const author = charById(w, post.authorId);
  if (!author) return null;

  const comments = post.comments || [];
  const tops = comments.filter((c) => !c.parent);
  const repliesOf = (id) => comments.filter((c) => c.parent === id);
  const orphans = comments.filter((c) => c.parent && !comments.some((x) => x.id === c.parent));

  const sendCmt = () => {
    const t = cmt.trim();
    if (!t) return;
    onComment(post.id, t, null);
    setCmt("");
  };

  return (
    <div className="card" ref={nodeRef}
      style={highlight ? { borderColor: "var(--rose)", boxShadow: "0 0 0 2px rgba(217,117,143,.25)" } : null}>
      <div className="row">
        <Av src={author.avatar} name={author.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="between">
            <div>
              <div className="name">{author.name}</div>
              <div className="handle mono">@{author.username}</div>
            </div>
            <div className="handle mono">{timeAgo(post.ts)}</div>
          </div>
        </div>
      </div>
      <div className="body">{post.text}</div>
      {(post.imageId || post.image) ? <img src={resolveImg(post.imageId ? imageRef(post.imageId) : post.image, media)} alt="" style={{ width: "100%", borderRadius: 10, marginTop: 10, border: "1px solid var(--line)" }} /> : null}

      <div className="between" style={{ marginTop: 12 }}>
        <button className="btn tiny ghost" onClick={() => onLike(post.id)}>
          <Heart size={13} color="var(--rose)" /> {post.likes || 0}
        </button>
        <button className="btn tiny ghost" onClick={() => onComments(post)} disabled={!!busy}>
          {busy === post.id ? <Loader2 size={13} className="spin" /> : <MessageCircle size={13} />}
          {comments.length ? tt("Több reakció", "More reactions") : tt("Reakciók kérése", "Ask for reactions")}
        </button>
      </div>

      {comments.length > 0 && (
        <div className="cmts">
          {tops.concat(orphans).map((c) => (
            <CommentNode key={c.id} w={w} c={c} allComments={comments} depth={0} busy={busy}
              onReply={(parentId, text) => onComment(post.id, text, parentId)}
              onAskReply={(cc) => onAskReply(post, cc)} />
          ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 10, gap: 8, alignItems: "center" }}>
        <Av src={w.player.avatar} name={w.player.name} size={28} radius={9} />
        <input className="i" style={{ padding: "7px 11px", fontSize: 13.5 }} value={cmt}
          placeholder={tt("Szólj hozzá…", "Say something\u2026")} onChange={(e) => setCmt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendCmt(); }} />
        <button className="btn primary tiny" onClick={sendCmt} disabled={!cmt.trim()}><Send size={13} /></button>
      </div>
    </div>
  );
}

/* ---------- a reagálás motorja ----------
   Ezeket a Feed és a háttérben futó automata is használja. */

function pickCast(w, excludeId) {
  const pool = (w.chars || []).filter((c) => c.id !== excludeId);
  return pool.sort(() => Math.random() - 0.5).slice(0, 8);
}
const nameOfIn = (w, id) => { const a = charById(w, id); return a ? a.name : "?"; };

function threadOf(w, post) {
  const cs = post.comments || [];
  const label = {};
  cs.forEach((c, i) => { label[c.id] = "k" + (i + 1); });
  return {
    label,
    text: cs.map((c) => {
      const parent = c.parent && label[c.parent] ? ` (válasz erre: ${label[c.parent]})` : "";
      return `[${label[c.id]}]${parent} ${nameOfIn(w, c.authorId)}: ${c.text}`;
    }).join("\n"),
  };
}

async function genComments(w, post) {
  const cast = fairCommentCast(
    w,
    post.authorId
  );

  const author = charById(
    w,
    post.authorId
  );

  const th = threadOf(
    w,
    post
  );

  const out = await askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      cast.map((c) => c.id),
      true,
      null
    )}

POSZT — ${author ? author.name : "?"}:
"${post.text}"

${
  post.image
    ? `KÉP A POSZTBAN:
A szereplők látják a poszthoz tartozó képet is.
Ha természetes, reagáljanak arra, ami ténylegesen látható rajta: személyekre, helyszínre, hangulatra vagy más fontos részletre.
A kép ugyanúgy része a kontextusnak, mint a poszt szövege.`
    : ""
}

${
  th.text
    ? `EDDIGI KOMMENTSZÁL:
${th.text}`
    : "Még nincs komment."
}

${cast
  .slice(0, 3)
  .map(
    (c) =>
      publicVoiceCard(
        w,
        c,
        null
      )
  )
  .join("")}

${repetitionGuard(
  w,
  cast.map((c) => c.id),
  "kommentek"
)}

KOMMENT SZABÁLYOK:

- Adj 2-4 új kommentet.
- Csak olyan szereplő kommenteljen, akinek természetes oka van rá.
- Ezek VALÓDI közösségi médiás kommentek, nem roleplay-jelenetek és nem mini novellák.
- Úgy írjanak, mintha telefonról, gyorsan reagálnának egy Instagram/TikTok/X jellegű posztra.
- A kommentek TÖBBSÉGE 1-12 szó legyen.
- 13-20 szó csak ritkábban, ha a reakció tényleg igényli.
- Egy 1-3 szavas reakció teljesen jó komment.
- Egyetlen szó is lehet természetes komment.
- Emoji + néhány szó is lehet teljes komment.
- Ritkán akár csak emoji is lehet teljes komment, ha az adott karakter stílusába illik.
- Ne próbálj minden kommentből teljes, nyelvtanilag tökéletes mondatot csinálni.
- A töredékes mondatok, félbehagyott reakciók, rövid kérdések és spontán beszólások természetesek.
- Ne írjanak hosszú bekezdéseket.
- Ne írjanak monológokat.
- Ne írjanak regényszerű, költői vagy irodalmi szöveget.
- Ne narráljanak jelenetet.
- Ne írjanak belső gondolatokat.
- Ne használjanak *csillagok közé tett cselekvéseket*.
- Ne magyarázzák el részletesen, mit éreznek.
- Ne foglalják össze a kapcsolatukat a poszt szerzőjével.
- Ne tegyenek minden reakció végére tanulságot vagy érzelmi lezárást.
- Ne legyen minden komment udvariasan és szépen felépítve.
- Ha egy rövid reakció természetesebb, MINDIG azt válaszd a hosszabb megfogalmazás helyett.

TERMÉSZETES SOCIAL MEDIA STÍLUS:

- A komment elsődlegesen REAKCIÓ legyen, ne elemzés.
- Lehet beszólás.
- Lehet poén.
- Lehet flört.
- Lehet gúny.
- Lehet vita.
- Lehet támogatás.
- Lehet kérdés.
- Lehet hitetlenkedés.
- Lehet féltékeny vagy birtokló reakció.
- Lehet provokáció.
- Lehet pletykálkodó vagy célzó megjegyzés.
- Lehet kínos, száraz vagy direkt reakció.
- Lehet csak egy becenév, egy rövid felszólítás vagy egy spontán felkiáltás.
- Reagálhatnak egymás kommentjeire.
- Ha egy konkrét korábbi kommentre válaszolnak, használd a "reply_to" mezőt.
- Egymást @néven is megszólíthatják, ha természetes.
- Használhatnak kisbetűt, NAGYBETŰT, elnyújtott szavakat, több kérdőjelet/felkiáltójelet vagy minimális írásjelet, HA ez illik a karakterhez.
- A karaktereknek nem kell ugyanúgy helyesen, rendezett mondatokban és azonos ritmusban írniuk.
- Egy száraz karakter legyen száraz.
- Egy kaotikus karakter lehessen kaotikus.
- Egy flörtölős karakter lehessen direkt.
- Egy visszafogott karakter ne váljon emoji-spammelővé.
- Egy online aktív, fiatalos karakter használhasson természetes internetes nyelvet.
- A kommentek ne legyenek egymással felcserélhetők: már a megfogalmazásból is érződjön, KI írta őket.

FONTOS VÁLTOZATOSSÁG:

- Egy 2-4 kommentes csomagban ne legyen minden reakció ugyanolyan hosszú.
- Ha természetes, legyen legalább egy nagyon rövid komment a csomagban.
- Ne legyen mindenki vicces.
- Ne legyen mindenki támogató.
- Ne legyen mindenki ellenséges.
- Ne reagáljanak mindannyian ugyanarra a részletre.
- Különböző karakterek ugyanazt a posztot különböző szempontból értelmezhetik.
- A kapcsolatuk, aktuális hangulatuk, féltékenységük, vonzalmuk, konfliktusuk és előzményeik befolyásolják, mire reagálnak.

EMOJI:

- Az emoji-használat legyen LÁTHATÓAN jelen a közösségi médiában, de maradjon karakterfüggő.
- Ha a kiválasztott kommentelők között van olyan karakter, aki természetesen használ emojit, egy 2-4 kommentes csomagban legalább 1 komment tartalmazzon emojit.
- Az emoji ne mindig a mondat legvégén legyen.
- Lehet az emoji önálló reakció vagy a szöveg része.
- Általában 1-2 emoji elég.
- Ritkán több is lehet, ha az adott karakter kifejezetten így kommunikál.
- Ne használjon mindenki emojit.
- Ne kényszeríts emojit olyan karakterre, akinek a kommunikációjához nem illik.
- Ne használják folyton ugyanazokat az emojikat.
- Ne legyen minden flört ugyanaz a szív vagy minden vicc ugyanaz a sírva-nevetős emoji.
- Az emoji jelentése és típusa igazodjon a karakter személyiségéhez és az adott reakcióhoz.

ISMÉTLÉSVÉDELEM:

- Ne ismételjék a saját korábbi kommentjeiket.
- Ne parafrazálják újra ugyanazt.
- Ne használják folyton ugyanazokat a mondatkezdéseket.
- Ne ismételjék ugyanazokat a poénokat.
- Ne ismételjék ugyanazokat a sértéseket.
- Ne ismételjék ugyanazokat a fenyegetéseket.
- Ne használják mindig ugyanazt a flörtölési formulát.
- Ne ragadjanak bele ugyanabba a becenévbe vagy reakcióba.
- Ne használják minden posztnál ugyanazokat az emojikat.
- Ha korábban már nagyon hasonlóan kommenteltek, most reagáljanak másképp.
- A példamondatok és hangminták CSAK stílusiránymutatások.
- SOHA ne másold őket.
- SOHA ne készíts belőlük közeli parafrázist.
- A példákból a ritmust, szóhasználatot, humort, nyersességet, közvetlenséget és személyiséget tanuld meg, NE a konkrét mondatokat.
- A karakter hangja maradjon felismerhető, de minden konkrét komment legyen friss.

NYELVTAN ÉS NÉZŐPONT:

- Mindenki magáról E/1-ben beszéljen.
- A poszt szerzőjét és a többi karaktert tegezzék.
- Magázás tilos.
- A játékos helyett SOHA ne írj.
- A természetes internetes nyelv fontosabb, mint a túlságosan formális nyelvtani tökéletesség.
- Szándékosan informális írásmód csak akkor jelenjen meg, ha illik a karakterhez.

LIKE:

- Aki nem kommentelne, de természetesen lájkolná a posztot, bekerülhet a "likes" listába.
- Ne lájkolja automatikusan mindenki.
- Egy lájk önmagában is lehet reakció; ne generálj kommentet csak azért, mert minden szereplőnek csinálnia kell valamit.

LEGFONTOSABB:
A kommentnek első pillantásra úgy kell kinéznie, mint amit egy valódi ember odadobott egy social media poszt alá. Ha egy komment inkább hangzik dialógusnak egy regényből, pszichológiai elemzésnek vagy AI által megírt mini beszédnek, ÍRD ÚJRA rövidebb, spontánabb és internetesebb formában.

Formátum:

{"comments":[
{"id":"szereplő azonosítója","text":"természetes social media komment","reply_to":"k2 vagy üres"}
],
"likes":["annak a szereplőnek az azonosítója, aki csak lájkolja"],
"changes":[
{"a":"aki érez","b":"aki iránt","delta":-15,"mood":"mit érez most iránta","why":"egy rövid mondat"}
],
"events":["csak akkor egy rövid mondat, ha tényleg történt valami emlékezetes"]}${TAIL}`,
    { maxTokens: 900 }
  );

  return {
    out,
    label: th.label,
  };
}

function applyComments(n, postId, out, label) {
  const p = n.posts.find((x) => x.id === postId);
  if (p) {
    const byLabel = {};
    Object.keys(label || {}).forEach((cid) => { byLabel[label[cid]] = cid; });
    (out.comments || []).forEach((c) => {
      const who = aiVoice(n, c && (c.id !== undefined ? c.id : c.name));
      if (!who || !c.text) return;
      const body = cleanGeneratedUtterance(n, who, c.text, 240);
      if (!body) return;
      const tag = String((c.reply_to !== undefined ? c.reply_to : c.replyTo) || "").trim().toLowerCase();
      let parent = byLabel[tag] || null;
      const pc = parent && p.comments.find((x) => x.id === parent);
      if (pc && pc.parent) parent = pc.parent;
      const made = { id: uid(), authorId: who, text: body, ts: now(), parent, language: worldLanguage(n, n.meId) };
      p.comments.push(made);
      noteComment(n, p, made);
      rememberKnowledge(n, who, {
        kind: "conversation",
        source: "self_action",
        confidence: 1,
        text: sysLangText(n, who, `Kommenteltem: ${cut(made.text, 110)}`, `I commented: ${cut(made.text, 110)}`),
      });
      if (p.authorId && p.authorId !== who) {
        rememberAboutTarget(n, who, p.authorId, {
          kind: "event",
          source: "interaction",
          confidence: 0.95,
          text: `${nameOfIn(n, p.authorId)} posztjára reagáltam`,
        });
      }
    });
    (out.likes || []).forEach((lid) => {
      const who = aiVoice(n, lid);
      if (!who || who === p.authorId) return;
      p.likes = (p.likes || 0) + 1;
      const a = charById(n, who);
      if (isHuman(n, p.authorId))
        pushNote(n, p.authorId, {
          icon: "🤍",
          translationKey: "likedYourPost",
          params: { name: a ? a.name : sysTextFor(n, p.authorId, "someone") },
          text: sysTextFor(n, p.authorId, "likedYourPost", { name: a ? a.name : sysTextFor(n, p.authorId, "someone") }),
          link: { type: "post", id: p.id },
        });
    });
  }
  applyChanges(n, out.changes);
  n.log = [...(out.events || []), ...n.log].slice(0, 30);
}
/*
 * FAIR COMMENT ACTIVITY
 *
 * Hosszabb távon minden AI-karakter
 * hasonló mennyiségű kommentelési
 * lehetőséget kap.
 */
function fairCommentCast(w, targetId) {
  const cutoff =
    now() - 48 * 3600e3;

  const chars = (w.chars || [])
    .filter(
      (c) =>
        c &&
        !isHuman(w, c.id) &&
        c.id !== targetId
    )
    .map((c) => {
      let recentComments = 0;
      let lastCommentAt = 0;

      (w.posts || []).forEach((p) => {
        (p.comments || []).forEach(
          (comment) => {
            if (
              !comment ||
              comment.authorId !== c.id
            ) {
              return;
            }

            const ts =
              Number(comment.ts) || 0;

            if (ts >= cutoff) {
              recentComments += 1;
            }

            lastCommentAt = Math.max(
              lastCommentAt,
              ts
            );
          }
        );
      });

      return {
        c,
        recentComments,
        lastCommentAt,
        tie: Math.random(),
      };
    });

  chars.sort((a, b) => {
    /*
     * Elsőként az legyen jelölt,
     * aki az utóbbi 48 órában
     * kevesebbet kommentelt.
     */
    if (
      a.recentComments !==
      b.recentComments
    ) {
      return (
        a.recentComments -
        b.recentComments
      );
    }

    /*
     * Döntetlennél az kerüljön előre,
     * aki régebben kommentelt.
     */
    if (
      a.lastCommentAt !==
      b.lastCommentAt
    ) {
      return (
        a.lastCommentAt -
        b.lastCommentAt
      );
    }

    return a.tie - b.tie;
  });

  return chars
    .map((x) => x.c)
    .slice(0, 5);
}

async function genReply(w, post, comment) {
  const target = charById(
    w,
    comment.authorId
  );

  const cast = fairCommentCast(
    w,
    comment.authorId
  );

  const th = threadOf(
    w,
    post
  );

  return askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      cast.map((c) => c.id),
      true,
      null
    )}

POSZT — ${nameOfIn(w, post.authorId)}:
"${post.text}"

${
  post.image
    ? `KÉP A POSZTBAN:
A kommentelők látták a képet is. Ha természetes, reagálhatnak arra, ami ténylegesen látható rajta.`
    : ""
}

KOMMENTSZÁL:
${th.text}

MOST KIFEJEZETTEN ERRE A KOMMENTRE VÁLASZOLNAK:

${target ? target.name : "?"}: "${comment.text}"

${cast
  .slice(0, 3)
  .map(
    (c) =>
      publicVoiceCard(
        w,
        c,
        null
      )
  )
  .join("")}

${repetitionGuard(
  w,
  cast.map((c) => c.id),
  "kommentválaszok"
)}

KOMMENTVÁLASZ SZABÁLYOK:

- Csak olyan karakter válaszoljon, akinek természetes oka van rá.
- Adj 1-3 választ.
- Ezek VALÓDI social media reply-k, nem roleplay-jelenetek és nem mini dialógusok egy regényből.
- Úgy írjanak, mintha telefonról gyorsan válaszolnának egy kommentre.
- A válaszok TÖBBSÉGE 1-12 szó legyen.
- 13-20 szó csak ritkán, ha tényleg szükséges.
- Egyetlen szó is lehet teljes válasz.
- 1-3 szavas beszólás vagy reakció teljesen természetes.
- Emoji + néhány szó is lehet teljes válasz.
- Ritkán akár csak emoji is lehet válasz, ha az adott karakter ezt tényleg megtenné.
- Ha rövidebben természetesebb, MINDIG a rövidebb verziót válaszd.
- Ne legyen minden válasz teljes, szépen lezárt mondat.
- Lehet töredékes, félbehagyott, száraz, impulzív vagy minimális.
- Ne írjanak hosszú bekezdést.
- Ne írjanak monológot.
- Ne legyen regényszerű, költői vagy irodalmi.
- Ne narráljanak jelenetet.
- Ne írjanak belső gondolatokat.
- Ne használjanak *csillagok közé tett cselekvéseket*.
- Ne magyarázzák túl az érzéseiket vagy a kapcsolatukat.
- Ne mondják ki fölöslegesen azt, amit a két karakter már tud egymásról.

KÖZVETLEN REAKCIÓ:

- Közvetlenül arra reagáljanak, amit a kommentelő mondott.
- Ne indítsanak indokolatlanul teljesen új témát.
- Lehet visszakérdezés.
- Lehet beszólás.
- Lehet poén.
- Lehet flört.
- Lehet gúny.
- Lehet vita.
- Lehet sértődés.
- Lehet támogatás.
- Lehet féltékeny vagy birtokló reakció.
- Lehet provokáció.
- Lehet száraz egyszavas válasz.
- Lehet csak egy becenév.
- Lehet @megszólítás.
- Lehet NAGYBETŰ, kisbetű, elnyújtott szó, több kérdőjel vagy felkiáltójel, ha ez illik a karakterhez.
- A válasz ritmusa, helyesírása, szlengje és írásjelei igazodjanak az adott karakter online kommunikációjához.
- Ne legyenek a különböző karakterek válaszai egymással felcserélhetők.

EMOJI:

- Az emoji-használat legyen ténylegesen jelen, ha a válaszoló karakter természetesen használ emojit.
- Ha a generált válaszolók között van emoji-használó karakter, legalább egy válasz tartalmazzon emojit.
- Általában 1-2 emoji elég.
- Az emoji lehet a mondat elején, közepén, végén vagy önálló reakcióként.
- Ne használjon minden karakter emojit.
- Ne erőltesd emojira azt a karaktert, aki alapvetően nem így kommunikál.
- Ne használják folyton ugyanazokat az emojikat.
- Ne legyen minden flört ❤️ vagy 😏.
- Ne legyen minden vicc 😂 vagy 😭.
- Az emoji pontos típusa illeszkedjen a karakterhez és a pillanatnyi reakcióhoz.

TERMÉSZETESSÉG:

- Egy valódi kommentválasz gyakran nem magyaráz semmit, csak reagál.
- Ne próbáld minden szereplő gondolatát teljesen kifejteni.
- A feszültség, humor, vonzalom vagy ellenszenv a szóválasztásból is érződhet.
- Egy rövid "sure.", "pls", "????", "babe no", "te beteg vagy" jellegű SZERKEZET lehet természetes, de ezeket ne másold sablonként.
- Minden konkrét megfogalmazást a karakter saját hangjából generálj.

ISMÉTLÉSVÉDELEM:

- Ne ismételjék korábbi kommentjeiket vagy reply-jaikat.
- Ne parafrazálják újra ugyanazt.
- Ne használják folyton ugyanazokat a beszólásokat.
- Ne ismételjék ugyanazokat a poénokat.
- Ne ismételjék ugyanazokat a sértéseket.
- Ne ismételjék ugyanazokat a fenyegetéseket.
- Ne ismételjék ugyanazokat a flörtölési formulákat.
- Ne ragadjanak bele ugyanabba a becenévbe.
- Ne használják minden válaszban ugyanazt az emoji-kombinációt.
- A példamondatok és hangminták CSAK stílusiránymutatások.
- SOHA ne másold őket.
- SOHA ne készíts belőlük közeli parafrázist.
- A példákból a ritmust, szóhasználatot, humort, nyersességet, közvetlenséget és személyiséget tanuld meg.
- A karakter hangja maradjon felismerhető, de minden konkrét mondat legyen friss.

NYELVTAN ÉS NÉZŐPONT:

- Minden karakter magáról E/1-ben beszéljen.
- A másik karaktert tegezze.
- Magázás tilos.
- A játékos helyett SOHA ne írj.
- A természetes internetes nyelv fontosabb a túlságosan formális nyelvtani tökéletességnél.

LEGFONTOSABB:

A reply első pillantásra úgy hasson, mint egy valódi komment alatti gyors válasz. Ha inkább hangzik párbeszédnek egy regényből, pszichológiai magyarázatnak vagy AI által megírt mini beszédnek, ÍRD ÚJRA rövidebbre, közvetlenebbre és spontánabbra.

Formátum:

{"comments":[
  {"id":"szereplő azonosítója","text":"természetes rövid kommentválasz"}
],
"changes":[
  {"a":"aki érez","b":"aki iránt","delta":-10,"mood":"mit érez most iránta","why":"egy rövid mondat"}
],
"events":[]}${TAIL}`,
    { maxTokens: 900 }
  );
}

function applyReplies(n, postId, rootId, out) {
  const p = n.posts.find((x) => x.id === postId);
  if (p) (out.comments || []).forEach((c) => {
    const who = aiVoice(n, c && (c.id !== undefined ? c.id : c.name));
    if (!who || !c.text) return;
    const body = cleanGeneratedUtterance(n, who, c.text, 240);
    if (!body) return;
    const made = { id: uid(), authorId: who, text: body, ts: now(), parent: rootId, language: worldLanguage(n, n.meId) };
    p.comments.push(made);
    noteComment(n, p, made);
    rememberKnowledge(n, who, {
      kind: "conversation",
      source: "self_action",
      confidence: 1,
      text: sysLangText(n, who, `Válaszoltam: ${cut(made.text, 110)}`, `I replied: ${cut(made.text, 110)}`),
    });
  });
  applyChanges(n, out.changes);
  n.log = [...(out.events || []), ...n.log].slice(0, 30);
}
/*
 * FAIR POST ACTIVITY
 *
 * Az AI-karaktereket úgy rendezi sorba,
 * hogy hosszabb távon mindegyikük
 * hasonló mennyiségű lehetőséget kapjon
 * önálló posztolásra.
 *
 * Nem katonás körforgás:
 * azonos aktivitásnál véletlenszerű
 * marad a sorrend.
 */
function fairPostCast(w) {
  const chars = (w.chars || []).filter(
    (c) =>
      c &&
      !isHuman(w, c.id)
  );

  if (!chars.length) {
    return [];
  }

  /*
   * Csak az utóbbi 48 órát nézzük,
   * így egy régi aktív időszak
   * nem bünteti örökké a karaktert.
   */
  const cutoff =
    now() - 48 * 3600e3;

  const ranked = chars.map((c) => {
    let recentPosts = 0;
    let lastPostAt = 0;

    (w.posts || []).forEach((p) => {
      if (
        !p ||
        p.authorId !== c.id
      ) {
        return;
      }

      const ts =
        Number(p.ts) || 0;

      if (ts >= cutoff) {
        recentPosts += 1;
      }

      lastPostAt = Math.max(
        lastPostAt,
        ts
      );
    });

    return {
      c,
      recentPosts,
      lastPostAt,
      tie: Math.random(),
    };
  });

  ranked.sort((a, b) => {
    /*
     * Először az kapjon lehetőséget,
     * aki az elmúlt 48 órában
     * kevesebbet posztolt.
     */
    if (
      a.recentPosts !==
      b.recentPosts
    ) {
      return (
        a.recentPosts -
        b.recentPosts
      );
    }

    /*
     * Ha ugyanannyit posztoltak,
     * az kerüljön előrébb,
     * aki régebben posztolt.
     */
    if (
      a.lastPostAt !==
      b.lastPostAt
    ) {
      return (
        a.lastPostAt -
        b.lastPostAt
      );
    }

    /*
     * Teljes döntetlennél maradjon
     * egy kis természetes véletlen.
     */
    return a.tie - b.tie;
  });

  return ranked
    .map((x) => x.c)
    .slice(0, 5);
}
async function genWorldStep(w, single) {
  const cast = fairPostCast(w);

  const recent = (w.posts || [])
    .slice(0, 4)
    .map(
      (p) =>
        `${nameOfIn(
          w,
          p.authorId
        )}: ${p.text}`
    )
    .join("\n");

  return askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      cast.map((c) => c.id),
      true,
      null
    )}

LEGUTÓBBI POSZTOK:
${recent || "még nincs poszt"}

MOSTANI JEGYZETEK:
${notesForAI(w) || "nincs"}

KORÁBBI ESEMÉNYEK:
${(w.log || [])
  .slice(0, 6)
  .join("\n") || "-"}

${cast
  .slice(0, 5)
  .map(
    (c) =>
      publicVoiceCard(
        w,
        c,
        null
      )
  )
  .join("")}

${repetitionGuard(
  w,
  cast.map((c) => c.id),
  "autonóm posztok és kommentek"
)}

A VILÁG MAGÁTÓL ÉL TOVÁBB.

${
  single
    ? "Telt el egy kis idő. Adj EGY természetes új posztot valamelyik szereplőtől, és ha indokolt, 1-3 kommentet másoktól."
    : "Léptesd a világot néhány órával. Adj 1-2 természetes új posztot különböző szereplőktől, és ha indokolt, posztonként 1-3 kommentet másoktól."
}

ÁLTALÁNOS SZABÁLYOK:

- A szereplők a játékos nélkül is élnek.
- Posztolhatnak, veszekedhetnek, kibékülhetnek, pletykálhatnak, flörtölhetnek, tervezhetnek, panaszkodhatnak vagy reagálhatnak eseményekre.
- Ne hozz létre eseményt csak azért, hogy történjen valami.
- A történések következzenek a karakterekből, kapcsolatokból, korábbi eseményekből, posztokból és jegyzetekből.
- Ne ismételd a korábbi posztokat.
- Ne ismételd ugyanazokat a konfliktusokat, poénokat, flörtölési formulákat vagy szófordulatokat.
- A példamondatok és hangminták csak stílusiránymutatások.
- SOHA ne másold és ne parafrazáld őket közvetlenül.

POSZTOK:

- A posztok VALÓDI közösségi médiás posztok legyenek, ne AI által írt esszék.
- A poszt hossza igazodjon a karakterhez, a platformhoz és ahhoz, mi történik.
- Lehet egyetlen mondat.
- Lehet néhány szó.
- Lehet közepes hosszúságú.
- Ha tényleg nagyobb esemény, buli, konfliktus, botrány, pletyka vagy fontos történés indokolja, lehet hosszabb poszt is.
- Egy hosszabb poszt akár több emberről vagy ugyanazon esemény több részletéről is szólhat.
- Ne legyen minden poszt hosszú.
- Ne legyen minden poszt ugyanolyan szerkezetű.
- Ne legyen minden poszt teljesen kifejtett és szépen lezárt.
- Ne hangozzon publicisztikának, pszichológiai elemzésnek vagy AI által írt esszének.
- A karakter úgy írjon, ahogy ő ténylegesen posztolna telefonról.
- Lehet spontán.
- Lehet kaotikus.
- Lehet száraz.
- Lehet provokatív.
- Lehet flörtölős.
- Lehet dühös.
- Lehet pletykálkodó.
- Lehet csak egy gyors helyzetjelentés.
- Lehet képhez írt rövid caption.
- Használhat szlenget, rövidítéseket, kisbetűt, NAGYBETŰT, elnyújtott szavakat, több írásjelet vagy minimális írásjelet, ha ez illik a karakterhez.
- A posztból már megfogalmazás alapján is érződjön, melyik karakter írta.
- Különböző karakterek ne ugyanabban a rendezett, semleges stílusban posztoljanak.
- A példamondatok és hangminták CSAK stílusiránymutatások; ne másold vagy parafrazáld őket.

POSZT EMOJI:

- A karakter használhat emojit a posztban, ha ez természetes része az online kommunikációjának.
- Az emoji-használat ténylegesen jelenjen meg azoknál a karaktereknél, akik rendszeresen így kommunikálnának.
- Ne legyen minden poszt emoji nélküli.
- Ugyanakkor ne használjon minden karakter emojit.
- Egy visszafogott vagy rideg karakter posztolhat teljesen emoji nélkül.
- Egy expresszívebb, fiatalosabb vagy online aktív karakter használhat 1-3 emojit természetesen.
- Ritkán több emoji is belefér, ha kifejezetten illik az adott karakter stílusához.
- Az emoji lehet a szöveg elején, közepén vagy végén.
- Ne használják mindig ugyanazokat az emojikat.
- Ne legyen minden flört ugyanaz a szív vagy 😏.
- Ne legyen minden poén 😂 vagy 😭.
- Az emoji jelentése illeszkedjen a karakter személyiségéhez, hangulatához és a konkrét poszthoz.

KOMMENTEK:

- A kommentek VALÓDI social media kommentek legyenek, NEM roleplay-jelenetek.
- A kommentek TÖBBSÉGE 1-12 szó legyen.
- 13-20 szó csak ritkán, ha tényleg szükséges.
- Egyetlen szó is lehet teljes komment.
- 1-3 szavas reakció teljesen természetes.
- Emoji + néhány szó is lehet teljes komment.
- Ritkán akár csak emoji is lehet komment, ha az adott karakter így reagálna.
- Ha rövidebben természetesebb, mindig a rövidebb változatot válaszd.
- Ne legyen minden komment teljes, szépen megfogalmazott mondat.
- Lehet töredékes.
- Lehet száraz.
- Lehet impulzív.
- Lehet beszólás.
- Lehet poén.
- Lehet flört.
- Lehet gúny.
- Lehet vita.
- Lehet támogatás.
- Lehet féltékeny vagy birtokló reakció.
- Lehet provokáció.
- Lehet kérdés.
- Lehet spontán felkiáltás.
- Lehet csak egy becenév vagy @megszólítás.
- Reagáljanak konkrétan a posztra, a képre vagy egymás kommentjeire.
- Ne írjanak hosszú bekezdéseket.
- Ne írjanak monológokat.
- Ne legyenek regényszerűek, költőiek vagy irodalmiak.
- Ne narráljanak jelenetet.
- Ne írjanak belső gondolatokat.
- Ne használjanak *csillagok közé tett cselekvéseket*.
- Ne magyarázzák túl az érzéseiket.
- Ne foglalják össze fölöslegesen a kapcsolatukat.
- Ne legyen minden komment szépen lezárt mini beszéd.
- Egymást @néven megszólíthatják, ha természetes.
- Használhatnak kisbetűt, NAGYBETŰT, elnyújtott szavakat, rövidítéseket és internetes nyelvet, ha ez illik a karakterhez.
- A különböző karakterek kommentjei ne legyenek egymással felcserélhetők.

KOMMENT EMOJI:

- Az emoji-használat legyen ténylegesen jelen a kommentfolyamban, de maradjon karakterfüggő.
- Ha a kommentelők között van olyan karakter, aki természetesen használ emojit, legalább egy generált komment tartalmazzon emojit.
- Általában 1-2 emoji elég kommentenként.
- Az emoji lehet önálló reakció vagy a szöveg része.
- Ne használjon mindenki emojit.
- Ne kényszeríts emojit olyan karakterre, akinek nem illik a kommunikációjához.
- Ne használják folyton ugyanazokat az emojikat.
- Ne legyen minden flört ugyanaz a szív vagy 😏.
- Ne legyen minden vicc 😂 vagy 😭.
- Az emoji típusa igazodjon a karakterhez és a konkrét reakcióhoz.

KÉPEK:

- Akinek van albuma, néha képet is posztolhat belőle.
- Ilyenkor az "image" mezőbe a kép jele kerüljön, például "kep2".
- SOHA ne találj ki olyan képet, ami nincs az adott karakter albumában.
- Ha kép van a posztban, a kommentelők azt is látják.
- Reagálhatnak a képen látható személyre, helyszínre, hangulatra vagy fontos részletre.
- A kép ne csak dekoráció legyen, hanem valódi kontextus.

VÁLASZOK KOMMENTEKRE:

- A kommentek egymásra is válaszolhatnak.
- Ilyenkor a "reply_to" a válaszolt komment sorszáma.
- 1 = első komment, 2 = második komment stb.
- Csak akkor legyen reply_to, ha valóban az adott kommentre reagál.

NYELVTAN:

- Minden karakter magáról E/1-ben beszéljen.
- Más karaktereket tegezzen.
- Magázás tilos.
- A játékos helyett SOHA ne írj.

Formátum:

{"posts":[
  {
    "id":"szereplő azonosítója",
    "text":"poszt",
    "image":"kepN vagy üres",
    "comments":[
      {
        "id":"szereplő azonosítója",
        "text":"rövid komment",
        "reply_to":"1 vagy üres"
      }
    ]
  }
],
"changes":[
  {
    "a":"aki érez",
    "b":"aki iránt",
    "delta":10,
    "mood":"mit érez most iránta",
    "why":"egy rövid mondat"
  }
],
"events":[
  "csak valódi, emlékezetes történés kerüljön ide"
]}${TAIL}`,
    {
      maxTokens: single
        ? 1800
        : 4096,
    }
  );
}

function applyWorldStep(n, out) {
  (out.posts || []).forEach((p) => {
    const author = aiVoice(n, p && (p.id !== undefined ? p.id : p.name));
    if (!author || !p.text) return;
    const postText = cleanGeneratedUtterance(n, author, p.text, 700);
    if (!postText) return;
    const made = [];
    (p.comments || []).forEach((c, idx) => {
      const cid = aiVoice(n, c && (c.id !== undefined ? c.id : c.name));
      if (!cid || !c.text) return;
      const body = cleanGeneratedUtterance(n, cid, c.text, 240);
      if (!body) return;
      const rt = Number(String((c.reply_to !== undefined ? c.reply_to : c.replyTo) || "").replace(/\D/g, ""));
      let parent = null;
      if (rt > 0 && made[rt - 1] && rt - 1 !== idx) parent = made[rt - 1].parent || made[rt - 1].id;
      made.push({ id: uid(), authorId: cid, text: body, ts: now(), parent, language: worldLanguage(n, n.meId) });
      rememberKnowledge(n, cid, {
        kind: "conversation",
        source: "self_action",
        confidence: 1,
        text: sysLangText(n, cid, `Kommenteltem: ${cut(body, 110)}`, `I commented: ${cut(body, 110)}`),
      });
    });
    const pic = p.image ? albumFind(charById(n, author), p.image) : null;
    const picRef = pic ? (pic.imageId ? imageRef(pic.imageId) : pic.src) : "";
    const picId = imageIdOf(picRef);
    const fresh = {
      id: uid(), authorId: author, ts: now(), likes: Math.floor(Math.random() * 30),
      text: postText, imageId: picId || "", image: picId ? "" : picRef, comments: made, language: worldLanguage(n, n.meId),
    };
    n.posts.unshift(fresh);
    rememberKnowledge(n, author, {
      kind: "event",
      source: "self_action",
      confidence: 1,
      text: sysLangText(n, author, `Posztoltam: ${cut(fresh.text, 120)}`, `I posted: ${cut(fresh.text, 120)}`),
    });
    noteMentions(n, fresh.text, author, { type: "post", id: fresh.id });
    made.forEach((mc) => noteMentions(n, mc.text, mc.authorId, { type: "post", id: fresh.id }));
  });
  applyChanges(n, out.changes);
  n.log = [...(out.events || []), ...n.log].slice(0, 30);
}

/* Jegyzet-sáv: a szereplők egysoros gondolatai, mint az Instagramon. */
function NotesStrip({ w, update, setErr, onOpenChat, jump, onRequestNoteReactions, onSignal }) {
  const { tt } = useLang();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const mine = noteOf(w, w.meId);
  const others = liveNotes(w).filter((x) => x.authorId !== w.meId);

  const saveMine = () => {
  const t = String(draft || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NOTE_MAX);

  // Ha szerkesztés közben valójában semmi
  // nem változott, maradjon ugyanaz a note ID,
  // időbélyeg és reakcióelőzmény.
  if (
    mine &&
    t === String(mine.text || "")
  ) {
    setEditing(false);
    setDraft("");
    return;
  }

  const noteId = uid();

  update((n) =>
    setNote(
      n,
      w.meId,
      t,
      noteId
    )
  );

  // Csak valóban új vagy megváltoztatott
  // note indítson új AI-reakciós folyamatot.
  if (t && onSignal) {
    onSignal({
      type: "player-note",
      noteId,
    });
  }

  setEditing(false);
  setDraft("");
};

  // reakciók már a központi motoron keresztül mennek
  const askReactions = () => {
    if (!mine || !w.chars.length) return;
    const ok = onRequestNoteReactions ? onRequestNoteReactions(mine.id) : false;
    if (!ok) setErr(tt("A reakciókérést már feldolgozza a világ.", "A reaction request is already being processed."));
  };

  const bubble = (x) => {
    const a = charById(w, x.authorId);
    if (!a) return null;
    const isMine = x.authorId === w.meId;
    return (
      <button key={x.id} className="note-item"
        onClick={() => { if (isMine) { setDraft(x.text); setEditing(true); } else onOpenChat(x.authorId, x.text); }}>
        <div className="note-bub">
          {x.text}
          {(x.reacts || []).length > 0 && (
            <span className="note-react">{(x.reacts || []).map((r) => r.e).join("")}</span>
          )}
        </div>
        <Av src={a.avatar} name={a.name} size={44} radius={99} />
        <div className="note-nm">{isMine ? tt("te", "you") : a.name.split(" ")[0]}</div>
      </button>
    );
  };

  return (
    <div className="card" style={{ paddingBottom: 10 }}>
      <div className="between">
        <label className="f" style={{ margin: 0 }}>{tt("Jegyzetek", "Notes")}</label>
        {mine && (
          <button className="btn tiny ghost" onClick={askReactions}>
            <Sparkles size={12} color="var(--gold)" />
            {tt("Reagáljanak", "Let them react")}
          </button>
        )}
      </div>

      <div className="note-strip">
        {!mine && (
          <button className="note-item" onClick={() => { setDraft(""); setEditing(true); }}>
            <div className="note-bub note-empty">{tt("Írj valamit…", "Write something\u2026")}</div>
            <Av src={w.player.avatar} name={w.player.name} size={44} radius={99} />
            <div className="note-nm">{tt("te", "you")}</div>
          </button>
        )}
        {mine ? bubble(mine) : null}
        {others.map(bubble)}
        {!others.length && !mine && <span className="hint" style={{ alignSelf: "center" }}>{tt("Még senki nem írt ki semmit.", "No one has written anything yet.")}</span>}
      </div>

      {editing && (
        <div style={{ marginTop: 10 }}>
          <input className="i" autoFocus value={draft} maxLength={NOTE_MAX}
            placeholder={tt("Egy gondolat, max pár szó…", "A thought, a few words max\u2026")} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveMine(); }} />
          <div className="between" style={{ marginTop: 8 }}>
            <span className="hint">{draft.length}/{NOTE_MAX} · {tt("egy nap után lejár", "expires after a day")}</span>
            <div className="row" style={{ gap: 6 }}>
              {mine && <button className="btn tiny ghost" style={{ color: "var(--steel)" }}
                onClick={() => { update((n) => setNote(n, w.meId, "")); setEditing(false); }}>{tt("Törlés", "Delete")}</button>}
              <button className="btn tiny ghost" onClick={() => setEditing(false)}>{tt("Mégse", "Cancel")}</button>
              <button className="btn tiny primary" onClick={saveMine}>{tt("Kiírom", "Post it")}</button>
            </div>
          </div>
        </div>
      )}

      <p className="hint" style={{ marginTop: 8 }}>
        {tt("Koppints valakinek a jegyzetére, és válaszolhatsz rá privátban.", "Tap someone's note, and you can reply to it privately.")}
      </p>
    </div>
  );
}

/* Választó a saját albumodból: egy koppintás, és a kép a poszthoz kerül. */
function AlbumPick({ items, value, onPick }) {
  const { media } = useMedia();
  const { tt } = useLang();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <>
      <div className="between" style={{ marginTop: 10 }}>
        <span className="hint">{tt(`Az albumodban ${items.length} kép van`, `Your album has ${items.length} images`)}</span>
        <button className="btn tiny" onClick={() => setOpen(!open)}>
          <ImageIcon size={13} /> {open ? tt("Bezár", "Close") : tt("Kép az albumból", "Image from album")}
        </button>
      </div>
      {open && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {items.map((x) => {
            const ref = x.imageId ? imageRef(x.imageId) : x.src;
            const selected = ref === value;
            return (
            <button key={x.id} style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
              onClick={() => { onPick(selected ? "" : ref); setOpen(false); }}>
              <img src={resolveImg(ref, media)} alt={x.note || ""} title={x.note || ""}
                style={{ width: 66, height: 66, objectFit: "cover", borderRadius: 9,
                         border: selected ? "2px solid var(--rose)" : "1px solid var(--line)" }} />
            </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function Feed({ w, update, setErr, jump, onOpenChat, autoOn, onRequestWorldStep, onRequestNoteReactions, onSignal }) {
  const { tt } = useLang();
  const [text, setText] = useState("");
  const [img, setImg] = useState("");
  const [busy, setBusy] = useState("");
  const [resting, setResting] = useState(cooldownLeft() > 0);
  const [hl, setHl] = useState("");
  const refs = useRef({});

  useEffect(() => {
    const off = onCooldown((ms) => setResting(ms > 0));
    const i = setInterval(() => setResting(cooldownLeft() > 0), 1000);
    return () => { off(); clearInterval(i); };
  }, []);

  useEffect(() => {
    if (!jump || jump.type !== "post") return;
    setHl(jump.id);
    const t = setTimeout(() => {
      const el = refs.current[jump.id];
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const t2 = setTimeout(() => setHl(""), 4000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [jump]);

  const askComments = async (post) => {
    if (!w.chars.length) return setErr(tt("Előbb hozz létre karaktereket.", "First create some characters."));
    setBusy(post.id);
    try {
      const { out, label } = await genComments(w, post);
      update((n) => applyComments(n, post.id, out, label));
    } catch (e) { setErr((e && e.message) || tt("Az AI most nem válaszolt. Próbáld újra.", "The AI didn't respond. Try again.")); }
    setBusy("");
  };

  const askReply = async (post, comment) => {
    if (!w.chars.length) return setErr(tt("Előbb hozz létre karaktereket.", "First create some characters."));
    setBusy("c:" + comment.id);
    try {
      const out = await genReply(w, post, comment);
      update((n) => applyReplies(n, post.id, comment.parent || comment.id, out));
    } catch (e) { setErr((e && e.message) || tt("Az AI most nem válaszolt. Próbáld újra.", "The AI didn't respond. Try again.")); }
    setBusy("");
  };

  const post = () => {
    const t = text.trim();
    if (!t && !img) return;
    const imageId = imageIdOf(img);
    const p = { id: uid(), authorId: w.meId, ts: now(), likes: 0, text: t, imageId: imageId || "", image: imageId ? "" : (img || ""), comments: [] };
    update((n) => { n.posts.unshift(p); noteMentions(n, t, w.meId, { type: "post", id: p.id }); });
    if (onSignal) onSignal({ type: "player-post", postId: p.id });
    setText(""); setImg("");
  };

  const advance = () => {
    if (!w.chars.length) return setErr(tt("Előbb hozz létre karaktereket.", "First create some characters."));
    const ok = onRequestWorldStep ? onRequestWorldStep() : false;
    if (!ok) setErr(tt("A világ már feldolgoz egy lépéskérést.", "The world is already processing a step request."));
  };

  return (
    <>
      <NotesStrip w={w} update={update} setErr={setErr} onOpenChat={onOpenChat} jump={jump}
        onRequestNoteReactions={onRequestNoteReactions} onSignal={onSignal} />

      <div className="card">
        <textarea className="i" value={text} placeholder={tt(`Mi jár ${w.player.name} fejében?`, `What's on ${w.player.name}'s mind?`)} onChange={(e) => setText(e.target.value)} />
        <ImagePicker value={img} onChange={setImg} label={tt("Kép a poszthoz", "Image for the post")} max={900} preview={64} category="post" />
        <AlbumPick items={albumOf(w.player)} value={img} onPick={setImg} />
        <div className="between" style={{ marginTop: 10 }}>
          <span className="hint mono">@{w.player.username}</span>
          <button className="btn primary" onClick={post} disabled={!text.trim() && !img}><Send size={14} /> {tt("Posztolás", "Post")}</button>
        </div>
        {autoOn && <p className="hint" style={{ marginTop: 8 }}>{tt("Az élő világ be van kapcsolva — maguktól reagálnak rá.", "The live world is on — they'll react on their own.")}</p>}
      </div>

      <button className="btn full" style={{ marginTop: 12 }} onClick={advance}>
        <Sparkles size={15} color="var(--gold)" />
        {resting ? tt("Sorban áll…", "Waiting in line…") : tt("Történjen most valami", "Make something happen")}
      </button>

      {w.posts.length === 0 && (
        <p className="hint" style={{ textAlign: "center", marginTop: 24 }}>
          {tt("Üres a feed. Írj egy posztot, vagy várj — a világ magától is elindul.", "The feed is empty. Write a post, or wait — the world will get going on its own.")}
        </p>
      )}

      {w.posts.map((p) => (
        <Post key={p.id} w={w} post={p} busy={busy} onComments={askComments} onAskReply={askReply}
          highlight={hl === p.id} nodeRef={(el) => { refs.current[p.id] = el; }}
          onComment={(id, text2, parent) => update((n) => {
            const x = n.posts.find((y) => y.id === id);
            if (!x) return;
            const made = { id: uid(), authorId: n.meId || w.meId, text: text2, ts: now(), parent: parent || null };
            x.comments.push(made);
            noteComment(n, x, made);
          })}
          onLike={(id) => update((n) => { const x = n.posts.find((y) => y.id === id); if (x) x.likes = (x.likes || 0) + 1; })} />
      ))}
    </>
  );
}

/* ============================================================
   Karakterek
   ============================================================ */
const FIELDS = [
  ["name", "Név"], ["nick", "Becenév"], ["username", "Felhasználónév"], ["birth", "Születési dátum"],
  ["gender", "Nem"], ["orientation", "Szexualitás"], ["height", "Magasság"], ["job", "Foglalkozás / iskola"],
  ["city", "Város"],
  ["bio", "Bio — nyilvános bemutatkozás (ezt látják mások, mint egy Instagram-profilt)", 1],
  ["looks", "Külső leírás", 1], ["personality", "Személyiség (rejtve, ez irányítja a viselkedést)", 1], ["traits", "Tulajdonságok (IQ, EQ, humor, türelem…)", 1],
  ["speech", "Beszédstílus", 1], ["voice", "Példamondatok — így beszél", 1], ["goals", "Célok", 1], ["fears", "Félelmek", 1], ["likes", "Kedvenc dolgok", 1],
  ["secrets", "Titkok (csak az AI látja)", 1], ["backstory", "Háttértörténet", 1],
  ["extra", "Egyéb információk — amit az AI-nak tudnia érdemes", 1],
];
const FIELD_LABELS_EN = {
  name: "Name", nick: "Nickname", username: "Username", birth: "Birth date",
  gender: "Gender", orientation: "Orientation", height: "Height", job: "Job / school",
  city: "City",
  bio: "Bio — public introduction (others see this, like an Instagram profile)",
  looks: "Appearance", personality: "Personality (hidden, drives behavior)", traits: "Traits (IQ, EQ, humor, patience…)",
  speech: "Speech style", voice: "Example lines — how they talk", goals: "Goals", fears: "Fears", likes: "Favorite things",
  secrets: "Secrets (AI only)", backstory: "Backstory",
  extra: "Other info — anything the AI should know",
};

function RelBar({ score }) {
  const pct = Math.abs(score) / 2;
  return (
    <div className="bar">
      <div className="bar-mid" />
      <div className="bar-fill" style={{ left: score < 0 ? 50 - pct + "%" : "50%", width: pct + "%", background: relColor(score) }} />
    </div>
  );
}

/* Kétirányú kapcsolat-szerkesztő: külön az egyik és külön a másik irány.
   Az érzés lehet egyoldalú — ez a lényeg. */
function RelPair({ w, aId, bId, aName, bName, update }) {
  const { tt } = useLang();
  const side = (from, to, label) => {
    const r = getRel(w, from, to);
    return (
      <div>
        <div className="between" style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 12.5, color: "var(--bone)" }}>{label}</span>
          <span className="relnum mono" style={{ color: relColor(r.score) }}>{r.score > 0 ? "+" : ""}{r.score}</span>
        </div>
        <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 15, color: r.mood ? "var(--rose)" : "var(--muted)", marginBottom: 6 }}>
          {r.mood || relLabel(r)}
        </div>
        {r.why ? <p className="hint" style={{ marginBottom: 6 }}>{r.why}</p> : null}
        <RelBar score={r.score} />
        <input className="i mono" style={{ marginTop: 6, padding: "6px 10px", fontSize: 12 }} type="range" min="-100" max="100"
          value={r.score} onChange={(e) => update((n) => setRel(n, from, to, { score: Number(e.target.value) }))} />
        <MoodPicker value={r.mood} style={{ padding: "6px 10px", fontSize: 12 }}
          onChange={(v) => update((n) => setRel(n, from, to, { mood: v }))} />
        <BondPicker value={r.bond || r.type || ""} fixed={!!r.fixed} style={{ marginTop: 6, padding: "6px 10px", fontSize: 12 }}
          onChange={(pp) => update((n) => setRel(n, from, to, { ...pp, type: "" }))} />
        <input className="i" style={{ marginTop: 6, padding: "6px 10px", fontSize: 12 }} value={r.hidden || ""}
          placeholder={tt("titkos érzés — csak az AI látja, ő nem mondja ki", "hidden feeling — only the AI sees it, they won't say it out loud")}
          onChange={(e) => update((n) => setRel(n, from, to, { hidden: e.target.value }))} />
      </div>
    );
  };
  return (
    <>
      {side(aId, bId, `${aName} → ${bName}`)}
      <div className="sep" style={{ margin: "14px 0" }} />
      {side(bId, aId, `${bName} → ${aName}`)}
      <p className="hint" style={{ marginTop: 8 }}>
        {tt(
          "A két irány külön él: attól, hogy az egyik rajong a másikért, a másik még érezhet mást.",
          "The two directions are separate: even if one person adores the other, the other may feel something completely different."
        )}
      </p>
    </>
  );
}


/* Keret-mérő: megmutatja, mennyi fér át az AI-hoz, és pontosan hol csordul túl.
   Nem vág le semmit az adatlapból — csak megmondja, mi jut el a szereplőhöz. */
const MEASURED = [
  ["personality", "Személyiség"], ["speech", "Beszédstílus"], ["voice", "Példamondatok"],
  ["traits", "Tulajdonságok"], ["goals", "Célok"], ["fears", "Félelmek"],
  ["secrets", "Titkok"], ["likes", "Kedvencek"], ["looks", "Külső"],
  ["extra", "Egyéb"], ["backstory", "Háttértörténet"],
];

/* Mezőnkénti keretjelző: írás közben látod, mennyi fér át. */
const NO_LIMIT_UI = { name: 1, username: 1, birth: 1, height: 1, avatar: 1 };

const FieldLimit = React.memo(function FieldLimit({ field, value }) {
  const len = React.useMemo(() => cleanLen(value), [value]);
  if (NO_LIMIT_UI[field]) return null;
  if (isFree(field) && !CORE_CAP[field]) {
    return (
      <p className="hint" style={{ marginTop: 4, color: "var(--muted)" }}>
        {len ? `${len.toLocaleString("hu")} karakter · ` : ""}teljes egészében átmegy
      </p>
    );
  }
  const cap = CORE_CAP[field] || fieldCap(field, true);
  if (!cap) return null;
  const over = len > cap;
  const pct = Math.min(100, Math.round((len / cap) * 100));
  return (
    <>
      <div className="bar" style={{ marginTop: 5, height: 3 }}>
        <div className="bar-fill" style={{ left: 0, width: pct + "%", background: over ? "var(--gold)" : "var(--steel)" }} />
      </div>
      <p className="hint" style={{ marginTop: 4, color: over ? "var(--gold)" : "var(--muted)" }}>
        {len.toLocaleString("hu")} / {cap.toLocaleString("hu")} karakter
        {over ? ` — ${(len - cap).toLocaleString("hu")} nem fér be minden hívásba` : ""}
      </p>
    </>
  );
});

function BudgetMeter({ c, onBrief, setErr }) {
  const { tt } = useLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const src = React.useMemo(
    () => rawLen(c),
    [c.personality, c.secrets, c.backstory, c.extra]
  );
  const state = React.useMemo(
    () => briefState({ ...c, __src: src }),
    [src, c.brief, c.briefSrc]
  );

  const makeBrief = async () => {
    setBusy(true);
    try {
      const brief = await genBrief(c);
      if (!brief) throw new Error(tt("A sűrítés nem adott vissza semmit.", "The compression didn't return anything."));
      onBrief(brief, src);
    } catch (e) { setErr((e && e.message) || tt("A sűrítés most nem sikerült.", "Compression failed right now.")); }
    setBusy(false);
  };

  const tight = MEASURED.filter(([k]) => !isFree(k)).map(([k, label]) => {
    const raw = clean(c[k]).length;
    const cap = fieldCap(k, true) || 300;
    return { k, label, raw, cap, over: Math.max(0, raw - cap) };
  }).filter((r) => r.raw > 0);

  const free = MEASURED.filter(([k]) => isFree(k)).map(([k, label]) => ({
    k, label, raw: clean(c[k]).length,
  })).filter((r) => r.raw > 0);

  const freeTotal = free.reduce((sum, r) => sum + r.raw, 0);
  const overs = tight.filter((r) => r.over > 0);

  return (
    <div className="card" style={{ background: "var(--raised)", borderColor: overs.length ? "var(--gold)" : "var(--line)" }}>
      <div className="between">
        <label className="f" style={{ margin: 0, color: overs.length ? "var(--gold)" : "var(--muted)" }}>
          {tt("Mennyit lát ebből az AI", "How much of this the AI sees")}
        </label>
        <button className="btn tiny ghost" onClick={() => setOpen(!open)}>{open ? tt("Bezár", "Close") : tt("Részletek", "Details")}</button>
      </div>

      {state !== "nem kell" && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div className="between">
            <span style={{ fontSize: 12.5, color: state === "kész" ? "var(--rose)" : "var(--gold)" }}>
              {tt("Sűrített profil: ", "Compressed profile: ")}{tt(state, { "kész": "ready", "hiányzik": "missing", "elavult": "outdated" }[state] || state)}
            </span>
            {state !== "kész" && (
              <button className="btn tiny primary" onClick={makeBrief} disabled={busy}>
                {busy ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />} {tt("Sűrítés most", "Compress now")}
              </button>
            )}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            {state === "kész"
              ? tt(`A ${src.toLocaleString("hu")} karakteres lapból egy ${clean(c.brief).length.toLocaleString("hu")} karakteres kivonat megy át minden hívásnál. Az adatlap érintetlen; a kivonat csak az AI csomagját teszi tizedakkorává, ettől tűnik el a torlódás.`,
                    `A ${clean(c.brief).length.toLocaleString("en")}-character excerpt from the ${src.toLocaleString("en")}-character sheet is sent with every call. The sheet itself is untouched; the excerpt just makes the AI's package a tenth the size, which is why the bottleneck disappears.`)
              : tt(`Ez a lap ${src.toLocaleString("hu")} karakter. Ekkorát minden egyes üzenetnél elküldeni lassú, és ettől akad el az AI. Egyetlen sűrítés után minden gyors lesz — az adatlapodból semmi nem vész el.`,
                    `This sheet is ${src.toLocaleString("en")} characters. Sending that much with every message is slow, and it's why the AI gets stuck. After one compression, everything is fast — nothing is lost from your sheet.`)}
          </p>
          {c.brief && state !== "kész" && (
            <p className="hint" style={{ marginTop: 4 }}>{tt("Azóta írtál hozzá, ezért érdemes frissíteni.", "You've added to it since, so it's worth refreshing.")}</p>
          )}
        </div>
      )}

      <p className="hint" style={{ marginTop: 8 }}>
        {tt(`A személyiség, a titkok, a háttértörténet és az egyéb információk teljes egészében átmennek — most ${freeTotal.toLocaleString("hu")} karakter.`,
            `Personality, secrets, backstory and extra info all pass through fully — currently ${freeTotal.toLocaleString("en")} characters.`)}
        {overs.length
          ? tt(` A rövid mezők közül ${overs.length} túlcsordul, ott csak a keret megy át.`, ` ${overs.length} of the short fields overflow, only the cap goes through there.`)
          : tt(" A rövid mezők is beférnek.", " The short fields fit too.")}
      </p>

      {open && (
        <>
          <label className="f">{tt("Korlátlan — teljes egészében átmegy", "Unlimited — passes through fully")}</label>
          {free.map((r) => (
            <div className="between" key={r.k} style={{ marginTop: 5 }}>
              <span style={{ fontSize: 12.5 }}>{tt(r.label, FIELD_LABELS_EN[r.k] || r.label)}</span>
              <span className="handle mono">{r.raw.toLocaleString("hu")} ✓</span>
            </div>
          ))}

          <label className="f">{tt("Szűk keret — ezekhez elég pár mondat", "Narrow cap — a few sentences are enough here")}</label>
          {tight.map((r) => (
            <div className="between" key={r.k} style={{ marginTop: 5 }}>
              <span style={{ fontSize: 12.5, color: r.over ? "var(--gold)" : "var(--bone)" }}>{tt(r.label, FIELD_LABELS_EN[r.k] || r.label)}</span>
              <span className="handle mono">
                {r.raw.toLocaleString("hu")} / {r.cap.toLocaleString("hu")}
                {r.over ? tt(` · ${r.over.toLocaleString("hu")} kimarad`, ` · ${r.over.toLocaleString("en")} left out`) : " ✓"}
              </span>
            </div>
          ))}

          <p className="hint" style={{ marginTop: 10 }}>
            A túlcsorduló mezőkből az elejét, a közepét és a végét is elviszi, tehát az egész
            terjedelemből kap ízelítőt — de a legfontosabbat érdemes a mező elejére tenni.
          </p>
        </>
      )}
    </div>
  );
}

function CharForm({ initial, onSave, onClose, onDelete, setErr, w, isNew }) {
  useEditLock();
  const { tt } = useLang();
  const [c, setC] = useState(initial);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  // Új, még nem létező személyek, akiket itt helyben veszünk fel (család, ex, tanár…)
  const [newPeople, setNewPeople] = useState([]);
  const [nx, setNx] = useState("");
  const [nxNote, setNxNote] = useState("");
  const [rels, setRelsState] = useState(() => {
    const out = {};
    if (!w || !initial.id) return out;
    allSubjects(w).forEach((o) => {
      if (o.id === initial.id || !linked(w, initial.id, o.id)) return;
      const r = getRel(w, initial.id, o.id);
      out[o.id] = { score: r.score || 0, hidden: r.hidden || "", bond: r.bond || r.type || "", fixed: !!r.fixed };
    });
    return out;
  });
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const setRelDraft = (otherId, patch) => setRelsState((p) => ({ ...p, [otherId]: { ...(p[otherId] || { score: 0, hidden: "", bond: "", fixed: false }), ...patch } }));
  const wy = worldYear(w);
  // a mellékszereplők közül csak azok, akikhez már van viszony — vagy akiket most vettél fel
  const others = (() => {
    if (!w) return newPeople;
    const base = relevantOthers(w, initial.id).filter((x) => x.id !== c.id);
    const drafted = (w.extras || []).filter((x) => x.id !== c.id && rels[x.id] && !base.some((b) => b.id === x.id));
    return base.concat(drafted).concat(newPeople);
  })();

  const addPerson = () => {
    const nm = nx.trim();
    if (!nm) return;
    const id = "x" + uid();
    setNewPeople((p) => p.concat({ id, name: nm, note: nxNote.trim() }));
    setRelDraft(id, { score: 0 });
    setNx(""); setNxNote("");
  };

  const generate = async () => {
    if (!idea.trim()) return;
    setBusy(true);
    try {
      const out = await askWorldJSON(w, engineFor(w), `Készíts egy teljes karakter-adatlapot ehhez a leíráshoz: "${idea}"
${wy ? `A világban most ${wy}-t írunk, a születési dátum ehhez képest legyen életszerű (formátum: "2008. március 14.").` : ""}
A "bio" mező egy rövid, nyilvános Instagram-stílusú bemutatkozás, amit MÁSOK is látnak — ez csak dísz, ne áruljon el titkot.
Formátum (minden mező szöveg, magyarul, a titkok legyenek érdekesek és kijátszhatók):
{"name":"","nick":"","username":"","birth":"","gender":"","orientation":"","height":"","job":"","city":"","bio":"","looks":"","personality":"","traits":"","speech":"","voice":"két-három tipikus mondat tőle, idézőjelben","goals":"","fears":"","likes":"","secrets":"","backstory":""}`);
      setC((p) => ({ ...p, ...out }));
    } catch (e) { setErr((e && e.message) || tt("A generálás nem sikerült. Próbáld újra.", "Generation failed. Try again.")); }
    setBusy(false);
  };

  // Családtagok kitalálása: felveszi őket mellékszereplőként, viszonnyal együtt.
  const suggestFamily = async () => {
    setBusy(true);
    try {
      const out = await askWorldJSON(w, engineFor(w), `${w ? worldContext(w, [], false, null) : ""}

KARAKTER: ${c.name || "névtelen"}
${c.backstory ? "Háttér: " + String(c.backstory).slice(0, 800) : ""}
${c.personality ? "Személyiség: " + String(c.personality).slice(0, 300) : ""}

Találd ki a családját és a legfontosabb, meg nem írt szereplőket (szülők, testvérek, ex, nagyszülő, főnök).
Add meg, milyen most köztük a viszony: a "score" -100 és 100 közötti szám, a "bond" a rokoni vagy egyéb kötelék
(pl. Anya, Apa, Testvér, Nagymama, Exek), a "hidden" pedig az, amit sosem mondana ki hangosan.
A rossz viszony is jó: nem kell mindenkit szeretnie.
Formátum: {"people":[{"name":"","note":"egy mondat róla","bond":"","score":0,"hidden":""}]}${TAIL}`);

      const list = (out.people || []).slice(0, 8);
      if (!list.length) throw new Error("Nem érkezett használható javaslat.");
      const added = [];
      list.forEach((p) => {
        if (!p || !p.name) return;
        const id = "x" + uid();
        added.push({ id, name: String(p.name), note: String(p.note || "") });
        setRelDraft(id, {
          score: clamp(Number(p.score) || 0),
          bond: String(p.bond || "").slice(0, 40),
          fixed: FIXED_BONDS.indexOf(String(p.bond || "")) >= 0,
          hidden: String(p.hidden || ""),
        });
      });
      setNewPeople((prev) => prev.concat(added));
    } catch (e) { setErr((e && e.message) || tt("A javaslat nem sikerült.", "The suggestion failed.")); }
    setBusy(false);
  };

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="between">
          <h2 style={{ fontSize: 20 }}>{initial.id ? tt("Karakter szerkesztése", "Edit character") : tt("Új karakter", "New character")}</h2>
          <button className="btn tiny ghost" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="card" style={{ background: "var(--raised)" }}>
          <label className="f" style={{ marginTop: 0 }}>{tt("Generálás egy mondatból", "Generate from one sentence")}</label>
          <input className="i" value={idea} placeholder={tt("pl. toxikus, gazdag lány, aki mindenkiről tud valamit", "e.g. toxic, rich girl who knows something about everyone")}
            onChange={(e) => setIdea(e.target.value)} />
          <button className="btn full" style={{ marginTop: 10 }} onClick={generate} disabled={busy || !idea.trim()}>
            {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} color="var(--gold)" />} {tt("Adatlap kitöltése", "Fill in the sheet")}
          </button>
        </div>

        <BudgetMeter c={c} setErr={setErr}
          onBrief={(brief, src) => setC((p2) => ({ ...p2, brief, briefSrc: src }))} />

        <ImagePicker value={c.avatar} onChange={(v) => set("avatar", v)} label={tt("Profilkép", "Profile picture")} max={512} preview={80} category="profile" />

        <AlbumEditor value={c.album} onChange={(v) => set("album", v)} />

        {FIELDS.map(([k, label, big]) => (
          <div key={k}>
            <label className="f">{tt(label, FIELD_LABELS_EN[k] || label)}</label>
            {big ? (
              <textarea className="i" value={c[k] || ""} onChange={(e) => set(k, e.target.value)} />
            ) : (
              <input className="i" value={c[k] || ""} onChange={(e) => set(k, e.target.value)}
                placeholder={k === "birth" ? tt("pl. 2008. március 14.", "e.g. March 14, 2008") : ""} />
            )}
            <FieldLimit field={k} value={c[k]} />
            {k === "extra" && (
              <p className="hint" style={{ marginTop: 6 }}>
                {tt("Bármi, ami nem fért a többi mezőbe, de számít: szokások, betegség, allergia, munkahelyi helyzet, kisállat, lakás, anyagi helyzet, vallás, hobbi részletei, régi sérelmek, tervek, vagy amit te szabályként adsz meg neki. Az AI ezt is olvassa minden megszólalás előtt.",
                    "Anything that didn't fit in the other fields, but matters: habits, illness, allergies, work situation, pet, home, finances, religion, hobby details, old grievances, plans, or anything you set as a rule for them. The AI reads this too before every line.")}
              </p>
            )}
            {k === "birth" && (ageOf(c, w) || zodiac(c.birth)) && (
              <p className="hint" style={{ marginTop: 6 }}>
                {ageOf(c, w) ? tt(`${ageOf(c, w)} éves`, `${ageOf(c, w)} years old`) : ""}
                {ageOf(c, w) && zodiac(c.birth) ? " · " : ""}
                {zodiac(c.birth)}
                {!wy && c.birth ? tt(" — add meg a Világ fülön, milyen évet írunk", " — set the current year on the World tab") : ""}
              </p>
            )}
          </div>
        ))}

        {w && (
          <>
            <div className="sep" />
            <label className="f" style={{ marginTop: 0 }}>{tt("Kapcsolatok — kihez hogyan viszonyul", "Bonds — how they relate to others")}</label>
            <p className="hint">
              {tt("Itt a botok, a játékosok és a mellékszereplők is szerepelnek. Aki még nincs a világban — apa, anya, testvér, ex, tanár —, azt itt helyben felveheted. A rokoni kötelék állandó marad, a viszony viszont lehet gyűlölködő is: húzd mínuszba a csúszkát.",
                  "Bots, players and side characters all appear here. Anyone not yet in the world — father, mother, sibling, ex, teacher — you can add right here. A family bond stays permanent, but the relationship itself can still be hateful: drag the slider into the negative.")}
            </p>

            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: "flex-start" }}>
              <input className="i" style={{ flex: 1.1 }} value={nx} placeholder={tt("Új személy neve — pl. Cole Márk", "New person's name — e.g. Cole Mark")}
                onChange={(e) => setNx(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addPerson(); }} />
              <input className="i" style={{ flex: 1 }} value={nxNote} placeholder={tt("ki ő? — pl. az apja, alkoholista", "who are they? — e.g. their father, an alcoholic")}
                onChange={(e) => setNxNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addPerson(); }} />
              <button className="btn" onClick={addPerson} disabled={!nx.trim()}><Plus size={14} /></button>
            </div>

            <button className="btn full" style={{ marginTop: 8 }} onClick={suggestFamily} disabled={busy || !c.name}>
              {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} color="var(--gold)" />} {tt("Család és ismerősök kitalálása", "Invent family and acquaintances")}
            </button>

            {others.length === 0 && <p className="hint" style={{ marginTop: 10 }}>{tt("Még nincs kihez viszonyulnia.", "There's no one to relate to yet.")}</p>}

            {others.map((o) => {
              const r = rels[o.id] || { score: 0, hidden: "", bond: "", fixed: false };
              const fresh = newPeople.some((p) => p.id === o.id);
              return (
                <div key={o.id} style={{ marginTop: 12 }}>
                  <div className="between" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>
                      {o.id === w.meId ? tt(`${o.name} (te)`, `${o.name} (you)`) : o.name}
                      <span className="handle mono"> · {fresh ? tt("új mellékszereplő", "new side character") : kindOf(w, o.id)}</span>
                    </span>
                    <span className="relnum mono" style={{ color: relColor(r.score) }}>{r.score > 0 ? "+" : ""}{r.score} · {relLabel(r)}</span>
                  </div>
                  {fresh && o.note ? <p className="hint" style={{ marginBottom: 4 }}>{o.note}</p> : null}
                  <RelBar score={r.score} />
                  <input className="i mono" style={{ marginTop: 6, padding: "6px 10px", fontSize: 12 }} type="range" min="-100" max="100"
                    value={r.score} onChange={(e) => setRelDraft(o.id, { score: Number(e.target.value) })} />
                  <BondPicker value={r.bond} fixed={r.fixed} style={{ marginTop: 6, padding: "6px 10px", fontSize: 12 }}
                    onChange={(p) => setRelDraft(o.id, p)} />
                  <input className="i" style={{ marginTop: 6, padding: "6px 10px", fontSize: 12 }} value={r.hidden}
                    placeholder={tt("rejtett érzés (opcionális)", "hidden feeling (optional)")} onChange={(e) => setRelDraft(o.id, { hidden: e.target.value })} />
                  {fresh && (
                    <button className="btn ghost tiny" style={{ marginTop: 6, color: "var(--steel)" }}
                      onClick={() => { setNewPeople((p) => p.filter((x) => x.id !== o.id)); setRelsState((p) => { const q = { ...p }; delete q[o.id]; return q; }); }}>
                      <Trash2 size={12} /> {tt("Mégsem kell", "Never mind")}
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        <div className="mobile-action-bar" style={{ marginTop: 18 }}>
  <button
    className="btn primary full"
    onClick={() => {
      if (!c.name || !c.name.trim()) {
        return setErr(
          tt(
            "A névnek muszáj lennie.",
            "The name is required."
          )
        );
      }

      onSave(
        {
          ...c,
          username: (c.username || c.name)
            .toLowerCase()
            .replace(/[^a-z0-9._]/g, "")
        },
        rels,
        newPeople
      );
    }}
  >
    {tt("Mentés", "Save")}
  </button>
</div>
        )}
      </div>
    </div>
  );
}

/* Album megtekintése — a karakter lapján és a saját profilodnál. */
function AlbumView({ items }) {
  const { media } = useMedia();
  const { tt } = useLang();
  return (
    <>
      <label className="f">{tt(`Album (${items.length} kép)`, `Album (${items.length} images)`)}</label>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {items.map((x) => (
          <div key={x.id} style={{ width: 96 }}>
            <img src={resolveImg(x.imageId ? imageRef(x.imageId) : x.src, media)} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
            {x.note ? <div className="hint" style={{ marginTop: 3, fontSize: 11 }}>{x.note}</div> : null}
          </div>
        ))}
      </div>
    </>
  );
}

function CharDetail({ w, c, update, onClose, onEdit, onChat }) {
  useEditLock();
  const { tt } = useLang();
  const rel = getRel(w, c.id, w.meId);
  const others = relevantOthers(w, c.id).filter((x) => x.id !== w.meId);
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="between">
          <button className="btn tiny ghost" onClick={onClose}><ChevronLeft size={14} /> {tt("Vissza", "Back")}</button>
          <button className="btn tiny ghost" onClick={() => onEdit(c)}><Pencil size={13} /> {tt("Szerkesztés", "Edit")}</button>
        </div>

        <div className="row" style={{ marginTop: 14, alignItems: "center" }}>
          <Av src={c.avatar} name={c.name} size={54} radius={16} />
          <div>
            <h2 style={{ fontSize: 21 }}>{c.name}</h2>
            <div className="handle mono">
              @{c.username}{ageOf(c, w) ? ` · ${ageOf(c, w)} ${termText("yearsOld", worldLanguage(w))}` : ""}{zodiac(c.birth) ? ` · ${zodiac(c.birth)}` : ""}{c.city ? ` · ${c.city}` : ""}
            </div>
            {c.bio && <div style={{ fontSize: 13.5, marginTop: 4, color: "var(--bone)" }}>{c.bio}</div>}
          </div>
        </div>

        <div className="card" style={{ background: "var(--raised)", borderColor: "var(--rose)" }}>
          <label className="f" style={{ marginTop: 0, color: "var(--rose)" }}>{tt("Ti ketten", "The two of you")}</label>
          <RelPair w={w} aId={c.id} bId={w.meId} aName={c.name.split(" ")[0]} bName={tt("te", "you")} update={update} />
        </div>

        <button className="btn primary full" style={{ marginTop: 10 }} onClick={() => onChat(c.id)}>
          <MessageCircle size={14} /> {tt("Üzenet neki", "Send a message")}
        </button>

        {albumOf(c).length > 0 && <AlbumView items={albumOf(c)} />}

        {FIELDS.filter(([k]) => c[k] && String(c[k]).trim() && !["name", "username", "avatar", "bio"].includes(k)).map(([k, label]) => (
          <div key={k}>
            <label className="f">{tt(label, FIELD_LABELS_EN[k] || label)}</label>
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{c[k]}</div>
          </div>
        ))}

        <div className="sep" />
        <label className="f" style={{ marginTop: 0 }}>{tt("Kapcsolatai a többiekkel", "Bonds with others")}</label>
        <p className="hint">{tt("Mindkét irány külön állítható. Új személyt a Szerkesztés gombbal vagy a Kapcsolat fülön vehetsz fel.", "Both directions are set separately. Add a new person via the Edit button or the Bonds tab.")}</p>
        {others.length === 0 && <p className="hint">{tt("Még nincs kivel.", "There's no one yet.")}</p>}
        {others.map((o) => (
          <div className="card" key={o.id} style={{ background: "var(--ink)" }}>
            <div className="row" style={{ alignItems: "center", minWidth: 0, marginBottom: 8 }}>
              <Av src={o.avatar} name={o.name} size={28} radius={9} />
              <div style={{ minWidth: 0 }}>
                <div className="name" style={{ fontSize: 13.5 }}>{o.name}</div>
                <div className="handle mono">{kindOf(w, o.id)}</div>
              </div>
            </div>
            <RelPair w={w} aId={c.id} bId={o.id} aName={c.name.split(" ")[0]} bName={o.name.split(" ")[0]} update={update} />
          </div>
        ))}

        {(w.mems[c.id] || []).length > 0 && (
          <>
            <div className="sep" />
            <label className="f" style={{ marginTop: 0 }}>Amire emlékszik</label>
            {w.mems[c.id].map((m, i) => <div key={i} className="hint" style={{ marginTop: 6 }}>· {m}</div>)}
          </>
        )}
      </div>
    </div>
  );
}

/* Az űrlapon felvett új személyek és kapcsolatok beírása a világba. */
function commitForm(n, subjectId, relDrafts, newPeople) {
  // a mellékszereplő csak annál a szereplőnél jelenik meg, akinél beállítottad
  (newPeople || []).forEach((x) => {
    if (!n.extras) n.extras = [];
    if (!n.extras.some((e) => e.id === x.id)) n.extras.push({ id: x.id, name: x.name, note: x.note || "", updatedAt: now() });
  });
  if (!relDrafts) return;
  Object.keys(relDrafts).forEach((otherId) => {
    const d = relDrafts[otherId];
    if (!d || otherId === subjectId) return;
    setRel(n, subjectId, otherId, { score: d.score || 0, hidden: d.hidden || "", bond: d.bond || "", fixed: !!d.fixed });
  });
}

function Cast({ w, update, setErr, goChat, jump }) {
  const { tt } = useLang();
  const [form, setForm] = useState(null);
  const [formIsNew, setFormIsNew] = useState(false);
  const [editMe, setEditMe] = useState(false);
  const [open, setOpen] = useState(null);
  const detail = open ? w.chars.find((c) => c.id === open) : null;

  // értesítésből érkezve rögtön a szereplő lapját nyitjuk
  useEffect(() => {
    if (jump && jump.type === "char" && w.chars.some((c) => c.id === jump.id)) setOpen(jump.id);
  }, [jump, w.chars]);

  return (
    <>
      <div className="card" style={{ borderColor: "var(--rose)" }}>
        <label className="f" style={{ marginTop: 0, color: "var(--rose)" }}>{tt("Saját karakterem", "My character")}</label>
        <div className="between" style={{ marginTop: 6 }}>
          <div className="row" style={{ alignItems: "center", minWidth: 0 }}>
            <Av src={w.player.avatar} name={w.player.name} size={44} radius={14} />
            <div style={{ minWidth: 0 }}>
              <div className="name">{w.player.name}</div>
              <div className="handle mono">@{w.player.username}</div>
              {(w.player.bio || w.player.personality) && (
                <div className="hint" style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.player.bio || w.player.personality}</div>
              )}
            </div>
          </div>
          <button className="btn tiny primary" onClick={() => setEditMe(true)}><Pencil size={13} /> {tt("Szerkesztés", "Edit")}</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {tt("A saját családodat és ismerőseidet is itt állítod be — a szerkesztésen belül, a Kapcsolatok résznél.", "You also set up your own family and acquaintances here — inside Edit, in the Bonds section.")}
        </p>
      </div>

      <div className="sep" />
      <label className="f" style={{ marginTop: 0, color: "var(--gold)" }}>
        {tt("Karakterek — őket az AI játssza", "Characters — played by the AI")}
      </label>

      <button className="btn primary full" style={{ marginTop: 8 }} onClick={() => { setForm({ id: uid(), name: "" }); setFormIsNew(true); }}>
        <Plus size={15} /> {tt("Új karakter", "New character")}
      </button>
      <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>{tt(`${w.chars.length} karakter a világban`, `${w.chars.length} characters in the world`)}</p>

      {w.chars.map((c) => {
        const r = getRel(w, c.id, w.meId);
        return (
          <div className="card" key={c.id} onClick={() => setOpen(c.id)} style={{ cursor: "pointer" }}>
            <div className="row">
              <Av src={c.avatar} name={c.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="between">
                  <div className="name">{c.name}</div>
                  <span className="relnum mono" style={{ color: relColor(r.score) }}>{r.score > 0 ? "+" : ""}{r.score} · {relLabel(r)}</span>
                </div>
                <div className="handle mono">@{c.username}</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}><RelBar score={r.score} /></div>
            {(c.bio || c.personality) && <div className="hint" style={{ marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.bio || c.personality}</div>}
          </div>
        );
      })}

      {detail && (
        <CharDetail w={w} c={detail} update={update} onClose={() => setOpen(null)}
          onEdit={(c) => { setOpen(null); setFormIsNew(false); setForm(c); }} onChat={(id) => { setOpen(null); goChat(id); }} />
      )}

      {editMe && (
        <CharForm initial={w.player} isNew={false} setErr={setErr} w={w} onClose={() => setEditMe(false)} onDelete={() => {}}
          onSave={(c, relDrafts, newPeople) => {
            update((n) => {
              n.players[w.meId] = { ...c, id: w.meId, username: uniqueHandle(n, c.username, w.meId), updatedAt: now() };
              commitForm(n, w.meId, relDrafts, newPeople);
            });
            setEditMe(false);
          }} />
      )}

      {form && (
        <CharForm initial={form} isNew={formIsNew} setErr={setErr} w={w} onClose={() => setForm(null)}
          onDelete={(id) => {
            update((n) => {
              n.chars = n.chars.filter((x) => x.id !== id);
              if (!n.deleted) n.deleted = {};
              n.deleted[id] = now();
            });
            setForm(null);
          }}
          onSave={(c, relDrafts, newPeople) => {
            update((n) => {
              const stamped = { ...c, username: uniqueHandle(n, c.username, c.id), updatedAt: now() };
              const i = n.chars.findIndex((x) => x.id === stamped.id);
              if (i >= 0) n.chars[i] = stamped;
              else n.chars.push(stamped);
              commitForm(n, stamped.id, relDrafts, newPeople);
            });
            setForm(null);
          }} />
      )}
    </>
  );
}

/* ============================================================
   Kapcsolatok — mindenki mindenkihez, botként meg nem írt szereplőkkel is
   ============================================================ */
function ExtraForm({ w, x, update, onClose }) {
  useEditLock();
  const { tt } = useLang();
  const [name, setName] = useState(x.name || "");
  const [note, setNote] = useState(x.note || "");
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="between">
          <h2 style={{ fontSize: 20 }}>{tt("Mellékszereplő", "Side character")}</h2>
          <button className="btn tiny ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <label className="f">{tt("Név", "Name")}</label>
        <input className="i" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="f">{tt("Egy mondat róla", "A sentence about them")}</label>
        <textarea className="i" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn primary full" style={{ marginTop: 16 }} onClick={() => {
          if (!name.trim()) return;
          update((n) => {
            const i = (n.extras || []).findIndex((e2) => e2.id === x.id);
            if (i >= 0) n.extras[i] = { ...n.extras[i], name: name.trim(), note: note.trim(), updatedAt: now() };
          });
          onClose();
        }}>{tt("Mentés", "Save")}</button>
      </div>
    </div>
  );
}

function Bonds({ w, update, setErr }) {
  const { tt } = useLang();
  const subjects = allSubjects(w);
  const [focus, setFocus] = useState(w.meId);
  const [nx, setNx] = useState("");
  const [nnote, setNnote] = useState("");
  const [editExtra, setEditExtra] = useState(null);

  const me = subjects.find((x) => x.id === focus) || subjects[0];
  const others = me ? relevantOthers(w, me.id) : [];
  // akikhez még nincs viszony rögzítve — ezeket kell külön hozzáadni
  const addable = me ? (w.extras || []).filter((x) => x.id !== me.id && !linked(w, me.id, x.id)) : [];

  const addExtra = () => {
    const nm = nx.trim();
    if (!nm) return;
    const id = "x" + uid();
    update((n) => {
      if (!n.extras) n.extras = [];
      n.extras.push({ id, name: nm, note: nnote.trim(), updatedAt: now() });
    });
    setNx(""); setNnote("");
  };

  const delExtra = (id) => {
    update((n) => {
      n.extras = (n.extras || []).filter((x) => x.id !== id);
      if (!n.deleted) n.deleted = {};
      n.deleted[id] = now();
    });
    setEditExtra(null);
    if (focus === id) setFocus(w.meId);
  };

  return (
    <>
      <div className="card">
        <label className="f" style={{ marginTop: 0 }}>{tt("Mellékszereplő felvétele", "Add side character")}</label>
        <p className="hint">
          {tt("Olyan emberek, akiket nem akarsz botként megírni — szülők, testvérek, exek, tanárok. Nem szólalnak meg maguktól, de léteznek a világban, lehet róluk beszélni, és bárkivel kapcsolatba állíthatók: a te karaktereddel és a botokkal is.",
              "People you don't want to write as full AI bots — parents, siblings, exes, teachers. They don't speak on their own, but they exist in the world, can be talked about, and can be linked in relationships with your character and the bots too.")}
        </p>
        <input className="i" style={{ marginTop: 8 }} value={nx} placeholder={tt("Név — pl. Kovács Erika", "Name — e.g. Erika Kovacs")}
          onChange={(e) => setNx(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addExtra(); }} />
        <input className="i" style={{ marginTop: 6 }} value={nnote} placeholder={tt("Egy mondat róla (nem kötelező) — pl. Anita anyja, ápolónő", "One line about them (optional) — e.g. Anita's mother, a nurse")}
          onChange={(e) => setNnote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addExtra(); }} />
        <button className="btn full" style={{ marginTop: 8 }} onClick={addExtra} disabled={!nx.trim()}>
          <Plus size={14} /> {tt("Hozzáadás", "Add")}
        </button>
      </div>

      {(w.extras || []).length > 0 && (
        <div className="card">
          <label className="f" style={{ marginTop: 0 }}>{tt(`Mellékszereplők (${(w.extras || []).length})`, `Side characters (${(w.extras || []).length})`)}</label>
          {(w.extras || []).map((x) => (
            <div className="between" key={x.id} style={{ marginTop: 10 }}>
              <div className="row" style={{ alignItems: "center", minWidth: 0 }}>
                <Av name={x.name} size={28} radius={9} />
                <div style={{ minWidth: 0 }}>
                  <div className="name" style={{ fontSize: 13.5 }}>{x.name}</div>
                  {x.note && <div className="hint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.note}</div>}
                </div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn tiny ghost" onClick={() => setEditExtra(x)}><Pencil size={12} /></button>
                <button className="btn tiny ghost" style={{ color: "var(--steel)" }} onClick={() => delExtra(x.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <label className="f" style={{ marginTop: 0 }}>{tt("Kinek a kapcsolatait nézzük?", "Whose bonds are we looking at?")}</label>
        <select className="i" value={focus} onChange={(e) => setFocus(e.target.value)}>
          {subjects.map((x) => (
            <option key={x.id} value={x.id}>{x.id === w.meId ? tt(`${x.name} (te)`, `${x.name} (you)`) : x.name} — {kindOf(w, x.id)}</option>
          ))}
        </select>
        {subjects.length === 0 && <p className="hint" style={{ marginTop: 8 }}>{tt("Még nincs kihez kapcsolatot rögzíteni.", "There's no one to record a bond with yet.")}</p>}
      </div>

      {me && addable.length > 0 && (
        <div className="card">
          <label className="f" style={{ marginTop: 0 }}>{tt(`Mellékszereplő hozzáadása ${me.name} kapcsolataihoz`, `Add a side character to ${me.name}'s bonds`)}</label>
          <p className="hint">{tt("A mellékszereplők csak ott jelennek meg, ahol felvetted hozzájuk a viszonyt.", "Side characters only appear where you've set up a bond with them.")}</p>
          <select className="i" style={{ marginTop: 8 }} value=""
            onChange={(e) => { if (e.target.value) update((n) => setRel(n, me.id, e.target.value, {})); }}>
            <option value="">{tt("Válassz…", "Choose\u2026")}</option>
            {addable.map((x) => <option key={x.id} value={x.id}>{x.name}{x.note ? " — " + x.note : ""}</option>)}
          </select>
        </div>
      )}

      {me && others.map((o) => (
        <div className="card" key={o.id}>
          <div className="row" style={{ alignItems: "center", minWidth: 0, marginBottom: 8 }}>
            <Av src={o.avatar} name={o.name} size={28} radius={9} />
            <div style={{ minWidth: 0 }}>
              <div className="name" style={{ fontSize: 13.5 }}>{o.name}</div>
              <div className="handle mono">{kindOf(w, o.id)}</div>
            </div>
          </div>
          <RelPair w={w} aId={me.id} bId={o.id} aName={me.name.split(" ")[0]} bName={o.name.split(" ")[0]} update={update} />
        </div>
      ))}

      {editExtra && <ExtraForm w={w} x={editExtra} update={update} onClose={() => setEditExtra(null)} />}
    </>
  );
}

/* ============================================================
   Jelenetek (roleplay)
   ============================================================ */
function SceneNew({ w, onClose, onCreate, setErr }) {
  useEditLock();
  const { tt } = useLang();
  const [title, setTitle] = useState("");
  const [setting, setSetting] = useState("");
  const [ids, setIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setIds((p) => (p.indexOf(id) >= 0 ? p.filter((x) => x !== id) : p.concat(id)));

  const idea = async () => {
    setBusy(true);
    try {
      const cast = w.chars.filter((c) => ids.indexOf(c.id) >= 0);
      const out = await askWorldJSON(w, engineFor(w), `${worldContext(w, ids.length ? ids : null, false, null)}

Találj ki egy jelenetet ${ids.length ? "ezekkel a szereplőkkel: " + cast.map((c) => c.name).join(", ") : "a világ szereplőivel"}.
Legyen benne feszültség vagy tét, és kapcsolódjon ahhoz, ami mostanában történt.
Formátum: {"title":"rövid cím","setting":"2-3 mondat: hol, mikor, mi a helyzet, mi a tét","cast":["szereplők azonosítói"]}${TAIL}`);
      if (out.title) setTitle(out.title);
      if (out.setting) setSetting(out.setting);
      if (!ids.length && Array.isArray(out.cast))
        setIds(out.cast.filter((id) => w.chars.some((c) => c.id === id)));
    } catch (e) { setErr((e && e.message) || tt("Nem sikerült ötletet kérni.", "Failed to get an idea.")); }
    setBusy(false);
  };

 return (
  <div
    className="scrim scene-create-scrim"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    <div className="sheet scene-create-sheet">

      <div className="between">
        <h2 style={{ fontSize: 20 }}>
          {tt("Új jelenet", "New scene")}
        </h2>

        <button
          className="btn tiny ghost"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      <label className="f">{tt("Cím", "Title")}</label>
        <input className="i" value={title} placeholder={tt("pl. A parti a régi malomban", "e.g. The party at the old mill")} onChange={(e) => setTitle(e.target.value)} />

        <label className="f">{tt("Helyzet — hol, mikor, mi a tét", "Situation — where, when, what's at stake")}</label>
        <textarea className="i" value={setting} placeholder={tt("Éjfél után, a hangfalak még szólnak. Ryan egész este kerül téged, Nora pedig figyel.", "After midnight, the speakers are still going. Ryan has been avoiding you all night, and Nora is watching.")}
          onChange={(e) => setSetting(e.target.value)} />

        <label className="f">{tt("Kik vannak jelen — koppints a nevekre", "Who's present — tap the names")}</label>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {w.chars.map((c) => (
            <button key={c.id} className={"btn tiny " + (ids.indexOf(c.id) >= 0 ? "primary" : "ghost")} onClick={() => toggle(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        {w.chars.length === 0 && <p className="hint" style={{ marginTop: 8 }}>{tt("Előbb hozz létre karaktereket.", "First create some characters.")}</p>}

        <button className="btn full" style={{ marginTop: 14 }} onClick={idea} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} color="var(--gold)" />} {tt("Jelenet-ötlet kérése", "Ask for a scene idea")}
        </button>

       <div className="mobile-action-bar" style={{ marginTop: 8 }}>
  <button
    className="btn primary full"
    disabled={!ids.length}
    onClick={() => {
      onCreate({
        id: uid(),
        title: title.trim() || tt("Névtelen jelenet", "Unnamed scene"),
        setting: setting.trim(),
        cast: ids,
        turns: [],
        open: true,
        ts: now()
      });
    }}
  >
    {ids.length
      ? tt(
          `Jelenet indítása (${ids.length} szereplő)`,
          `Start scene (${ids.length} characters)`
        )
      : tt(
          "Válassz legalább egy szereplőt",
          "Choose at least one character"
        )}
  </button>
</div>

    </div>
  </div>
);
}

function Scene({ w, scene, update, setErr, onBack }) {
  const { tt } = useLang();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const endRef = useRef(null);
  const sendLockRef = useRef(false);
  const cast = w.chars.filter((c) => scene.cast.indexOf(c.id) >= 0);
  const who = (id) => charById(w, id);

  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "end" }); }, [scene.turns.length]);

  const patch = (fn) => update((n) => { const s = n.scenes.find((x) => x.id === scene.id); if (s) fn(s, n); });

  const advance = async (playerText) => {
    setBusy("turn");
    if (playerText) patch((s) => { s.turns.push({ authorId: w.meId, kind: "action", text: playerText, ts: now() }); });
    try {
      const log = scene.turns.slice(-16).map((t) => {
        if (t.authorId === "narrator") return `(${t.text})`;
        const a = who(t.authorId);
        return `${a ? a.name : "?"}: ${t.text}`;
      }).join("\n");

      const out = await askWorldJSON(w, engineFor(w), `${worldContext(w, scene.cast, true, null)}

JELENET: ${scene.title}
HELYZET: ${scene.setting || "-"}
JELEN VANNAK: ${cast.map((c) => `${c.name} [${c.id}]`).join(", ")}, valamint ${w.player.name} [${w.meId}] — őt a felhasználó játssza.

EDDIG TÖRTÉNT:
${log || "a jelenet most kezdődik"}

${playerText ? `${w.player.name} most ezt teszi vagy mondja:\n"${playerText}"` : "A játékos most nem lép közbe; a szereplők maguktól viszik tovább a jelenetet."}

${cast.slice(0, 3).map(voiceCard).join("")}
${repetitionGuard(w, cast.map((c) => c.id), "jelenetfolytatás")}

Írd meg a folytatást 3-5 mozzanatban, minden mozzanat 2-4 jól megírt mondatból. Ne legyenek rövid, lapos, sablonos sorok, és ne ismételd ugyanazt a ritmust vagy a szókincset.
Mindenki a SAJÁT hangmintája szerint szólaljon meg — a mondataik ne legyenek felcserélhetők, ne legyenek gépiesen egyformák, és ne hangozzanak úgy, mintha egyetlen, közös beszédmód lenne.
Ha ${w.player.name} karakterhez beszélnek, tegezzék, E/2-ben; magukról E/1-ben beszélnek. Feszes jelenet legyen: párbeszéd és cselekvés, nem összefoglaló. A párbeszédek legyenek természetesek, hosszabbak, színesek, irodalmibbak, magyarul hibátlanul megfogalmazva.
A "narrator" a jelenet leírása (mit látni, mit hallani, milyen a hangulat) — legfeljebb egy ilyen legyen, és ne legyen semleges, hanem érzékletes, pontos, könyvesen megírt.
${w.player.name} helyett soha ne beszélj és ne cselekedj.
Formátum:
{"turns":[{"id":"a szereplő szögletes zárójelben megadott azonosítója szó szerint, vagy narrator","kind":"speech vagy action","text":"..."}],
 "changes":[{"a":"aki érez","b":"aki iránt","delta":10,"mood":"mit érez most iránta","why":"egy rövid mondat","bond":"csak ha a viszony tényleg megváltozott, és nem állandó kötelék"}],
 "memories":[{"id":"szereplő azonosítója","text":"amit ebből megjegyez"}],
 "events":["egy mondat, ha a világ szempontjából fontos történt"]}${TAIL}`);

      const resolved = (out.turns || []).map((t) => {
        const raw = t && (t.id !== undefined ? t.id : t.name);
        const isNarr = String(raw || "").trim().toLowerCase() === "narrator";
        const resolvedId = isNarr ? "narrator" : (findChar(w, raw) || findChar(w, t && t.name));
        const allowed = isNarr || (resolvedId && !isHuman(w, resolvedId));
        return { authorId: allowed ? resolvedId : null,
                 kind: t && t.kind === "action" ? "action" : "speech",
                 text: t && t.text ? String(t.text) : "" };
      }).filter((t) => t.authorId && t.text);

      if (!resolved.length) throw new Error(tt("Nem érkezett használható válasz.", "No usable reply arrived."));

      patch((s, n) => {
        resolved.forEach((t) => {
          s.turns.push({ ...t, ts: now(), language: worldLanguage(n, n.meId) });
          noteMentions(n, t.text, t.authorId, { type: "scene", id: s.id });
          if (t.authorId !== "narrator" && !isHuman(n, t.authorId)) {
            rememberKnowledge(n, t.authorId, {
              kind: "conversation",
              source: "scene",
              confidence: 1,
              text: sysLangText(n, t.authorId, `Jelenetben mondtam/tettem: ${cut(t.text, 120)}`, `In scene I said/did: ${cut(t.text, 120)}`),
            });
          }
        });
        applyChanges(n, out.changes);
        applyMemories(n, out.memories);
        n.log = (out.events || []).concat(n.log).slice(0, 30);
      });
      setText("");
    } catch (e) {
      setErr(((e && e.message) ? e.message + " " : "") + tt("Nyomd meg még egyszer — ha újra elakad, rövidítsd a helyzet leírását vagy csökkentsd a szereplők számát.", "Press it again — if it gets stuck again, shorten the situation description or reduce the number of characters."));
    }
    setBusy("");
  };

  const finish = async () => {
    setBusy("end");
    try {
      const log = scene.turns.map((t) => {
        const a = who(t.authorId);
        return t.authorId === "narrator" ? `(${t.text})` : `${a ? a.name : "?"}: ${t.text}`;
      }).join("\n");
      const out = await askWorldJSON(w, engineFor(w), `${worldContext(w, scene.cast, false, null)}

JELENET: ${scene.title}
${log}

Zárd le a jelenetet. Foglald össze 2-3 mondatban, mi történt és mi változott, majd mondd meg, ki mit visz tovább magával.
Formátum: {"summary":"","memories":[{"id":"szereplő azonosítója","text":""}],"changes":[{"a":"aki érez","b":"aki iránt","delta":0,"mood":"mit érez most iránta","why":"egy rövid mondat","bond":"csak ha a viszony tényleg megváltozott, és nem állandó kötelék"}]}${TAIL}`);

      patch((s, n) => {
        s.open = false;
        s.summary = out.summary || "";
        applyMemories(n, out.memories);
        applyChanges(n, out.changes);
        if (out.summary) n.log = [out.summary].concat(n.log).slice(0, 30);
      });
    } catch (e) { setErr((e && e.message) || tt("A lezárás nem sikerült. Próbáld újra.", "Closing failed. Try again.")); }
    setBusy("");
  };

  return (
    <>
      <div className="scene-hd between">
        <button className="btn tiny ghost" onClick={onBack}><ChevronLeft size={14} /> {tt("Jelenetek", "Scenes")}</button>
        <div className="row" style={{ gap: 4 }}>
          {cast.slice(0, 5).map((c) => <Av key={c.id} src={c.avatar} name={c.name} size={24} radius={8} />)}
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <h2 style={{ fontSize: 22 }}>{scene.title}</h2>
        {scene.setting && <p className="hint" style={{ marginTop: 6 }}>{scene.setting}</p>}
      </div>

      {scene.turns.length === 0 && <p className="hint" style={{ textAlign: "center", marginTop: 20 }}>{tt("Kezdd el: írd meg, mit tesz a karaktered — vagy hagyd, hogy ők kezdjenek.", "Get started: write what your character does — or let them start.")}</p>}

      {scene.turns.map((t, i) => {
        if (t.authorId === "narrator") return <p className="narr" key={i}>{t.text}</p>;
        const a = who(t.authorId);
        if (!a) return null;
        return (
          <div className="turn" key={i}>
            <Av src={a.avatar} name={a.name} size={30} radius={10} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="turn-name">{a.name}</div>
              <div className={t.kind === "action" ? "turn-act" : ""} style={{ fontSize: 14.5, whiteSpace: "pre-wrap" }}>{t.text}</div>
            </div>
          </div>
        );
      })}
      {busy === "turn" && <div className="thinking"><Loader2 size={13} className="spin" /> {tt("a jelenet írása folyik…", "the scene is being written\u2026")}</div>}
      <div ref={endRef} />

      {scene.summary && (
        <div className="card" style={{ borderColor: "var(--gold)" }}>
          <label className="f" style={{ marginTop: 0, color: "var(--gold)" }}>{tt("A jelenet vége", "The end of the scene")}</label>
          <div style={{ fontSize: 14 }}>{scene.summary}</div>
        </div>
      )}

      {scene.open ? (
        <div className="card">
          <textarea className="i" value={text} placeholder={tt(`Mit tesz vagy mond ${w.player.name}?`, `What does ${w.player.name} do or say?`)} onChange={(e) => setText(e.target.value)} />
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn primary full" onClick={() => advance(text.trim())} disabled={!!busy || !text.trim()}>
              {busy === "turn" ? <Loader2 size={14} className="spin" /> : <Send size={14} />} {tt("Lépés", "Step")}
            </button>
            <button className="btn full" onClick={() => advance("")} disabled={!!busy} title={tt("A többiek lépnek", "The others take a turn")}>
              <Sparkles size={14} color="var(--gold)" /> {tt("Történjen valami", "Make something happen")}
            </button>
          </div>
          <button className="btn ghost full tiny" style={{ marginTop: 8, color: "var(--muted)" }} onClick={finish} disabled={!!busy}>
            {busy === "end" ? <Loader2 size={13} className="spin" /> : null} {tt("Jelenet lezárása", "Close scene")}
          </button>
        </div>
      ) : (
        <button className="btn full" style={{ marginTop: 12 }} onClick={() => patch((s) => { s.open = true; s.summary = ""; })}>
          {tt("Jelenet újranyitása", "Reopen scene")}
        </button>
      )}
    </>
  );
}

function Scenes({ w, update, setErr, jump }) {
  const { tt } = useLang();
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const scenes = w.scenes || [];
  const scene = openId ? scenes.find((s) => s.id === openId) : null;

  useEffect(() => {
    if (jump && jump.type === "scene" && scenes.some((s) => s.id === jump.id)) setOpenId(jump.id);
  }, [jump, scenes]);

  if (scene) return <Scene w={w} scene={scene} update={update} setErr={setErr} onBack={() => setOpenId(null)} />;

  return (
    <>
      <button className="btn primary full" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
        <Plus size={15} /> {tt("Új jelenet", "New scene")}
      </button>
      <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>
        {tt("Jelenetben te csak a saját karakteredet játszod, a többieket az AI viszi.", "In a scene you only play your own character, the AI runs everyone else.")}
      </p>

      {scenes.length === 0 && <p className="hint" style={{ textAlign: "center", marginTop: 24 }}>{tt("Még nincs jelenet. Egy buli, egy veszekedés, egy éjszakai beszélgetés — bármi lehet.", "There's no scene yet. A party, an argument, a late-night talk — it can be anything.")}</p>}

      {scenes.map((s) => {
        const cast = w.chars.filter((c) => s.cast.indexOf(c.id) >= 0);
        return (
          <div className="card" key={s.id} onClick={() => setOpenId(s.id)} style={{ cursor: "pointer" }}>
            <div className="between">
              <h3 style={{ fontSize: 16 }}>{s.title}</h3>
              <span className="chip">{s.open ? tt("fut", "running") : tt("lezárva", "closed")}</span>
            </div>
            {s.setting && <p className="hint" style={{ marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{s.setting}</p>}
            <div className="row" style={{ marginTop: 10, gap: 4, alignItems: "center" }}>
              {cast.slice(0, 6).map((c) => <Av key={c.id} src={c.avatar} name={c.name} size={22} radius={7} />)}
              <span className="handle mono" style={{ marginLeft: "auto" }}>{tt(`${s.turns.length} mozzanat`, `${s.turns.length} beats`)}</span>
            </div>
          </div>
        );
      })}

      {creating && (
        <SceneNew w={w} setErr={setErr} onClose={() => setCreating(false)}
          onCreate={(s) => { update((n) => { n.scenes = (n.scenes || []).concat(s); }); setCreating(false); setOpenId(s.id); }} />
      )}
    </>
  );
}

/* ============================================================
   Üzenetek
   ============================================================ */
function GroupNew({ w, onClose, onCreate }) {
  useEditLock();
  const { tt } = useLang();
  const [name, setName] = useState("");
  const [ids, setIds] = useState([]);
  const toggle = (id) => setIds((p) => (p.indexOf(id) >= 0 ? p.filter((x) => x !== id) : p.concat(id)));
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="between">
          <h2 style={{ fontSize: 20 }}>{tt("Új csoport", "New group")}</h2>
          <button className="btn tiny ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <label className="f">{tt("Csoport neve", "Group name")}</label>
        <input className="i" value={name} placeholder={tt("pl. Malom-buli szervezés", "e.g. Party planning")} onChange={(e) => setName(e.target.value)} />
        <label className="f">{tt("Kik legyenek benne — koppints a nevekre", "Who should be in it — tap the names")}</label>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {w.chars.map((c) => (
            <button key={c.id} className={"btn tiny " + (ids.indexOf(c.id) >= 0 ? "primary" : "ghost")} onClick={() => toggle(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        {w.chars.length === 0 && <p className="hint" style={{ marginTop: 8 }}>{tt("Előbb hozz létre karaktereket.", "First create some characters.")}</p>}
        <p className="hint" style={{ marginTop: 10 }}>
          {tt("A csoportban a tagok egymással is beszélgetnek, nem csak veled.", "In the group, members talk to each other too, not just to you.")}
        </p>
        <button className="btn primary full" style={{ marginTop: 14 }} disabled={ids.length < 1}
          onClick={() => onCreate({
            id: "g" + uid(), name: name.trim() || tt("Névtelen csoport", "Unnamed group"),
            members: ids, msgs: [], updatedAt: now(),
          })}>
          {ids.length ? tt(`Csoport létrehozása (${ids.length} tag)`, `Create group (${ids.length} members)`) : tt("Válassz legalább egy karaktert", "Choose at least one character")}
        </button>
      </div>
    </div>
  );
}

function GroupChat({ w, group, update, setErr, onBack }) {
  const { tt } = useLang();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const members = (group.members || []).map((id) => charById(w, id)).filter(Boolean);
  const msgs = group.msgs || [];

  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "end" }); }, [msgs.length, group.id]);

  const patch = (fn) => update((n) => {
    const g = (n.groups || []).find((x) => x.id === group.id);
    if (g) fn(g, n);
  });

const turn = async (mine) => {
  setBusy(true);

  if (mine) {
    patch((g) => {
      g.msgs.push({
        id: uid(),
        from: w.meId,
        text: mine,
        ts: now(),
      });

      g.updatedAt = now();
    });
  }

  try {
    const hist = msgs
      .concat(
        mine
          ? [
              {
                from: w.meId,
                text: mine,
              },
            ]
          : []
      )
      .slice(-20)
      .map((m) => {
        const a =
          m.from === w.meId
            ? w.player
            : charById(w, m.from);

        return `${a ? a.name : "?"}: ${m.text}`;
      })
      .join("\n");

    const out = await askWorldJSON(
      w,
      engineFor(w),
      `${worldContext(
        w,
        group.members,
        true,
        null
      )}

CSOPORTOS BESZÉLGETÉS: ${group.name}

A CSOPORT TAGJAI:
${members
  .map((m) => `${m.name} [${m.id}]`)
  .join(", ")}

A játékos karaktere, aki helyett SOHA ne írj:
${w.player.name} [${w.meId}]

EDDIGI ÜZENETEK:
${hist || "a beszélgetés most kezdődik"}

${
  mine
    ? `${w.player.name} most ezt írta:
"${mine}"`
    : "Senki nem szólt hozzá kívülről; a tagok maguktól folytatják a beszélgetést."
}

${repetitionGuard(
  w,
  group.members || [],
  "csoportchat"
)}

CSOPORTCHAT SZABÁLYOK:

- Ez VALÓDI group chat, NEM roleplay-jelenet.
- Írj 1-3 új üzenetet a csoport AI-tagjaitól.
- Ha 1 válasz természetesebb, adj csak 1-et.
- Nem kell minden tagnak minden körben megszólalnia.
- Csak az írjon, akinek tényleg van oka reagálni.
- Ugyanaz a karakter küldhet két egymást követő rövid üzenetet is, ha ez természetes.
- A legtöbb üzenet legyen rövid.
- Egyetlen szó is lehet teljes üzenet.
- Egy 1-3 szavas reakció teljesen természetes.
- Egy félmondat is lehet teljes üzenet.
- Lehet rövid kérdés.
- Lehet csak egy név vagy @megszólítás.
- Lehet spontán felkiáltás.
- Ha rövidebben természetesebb, MINDIG a rövidebb változatot válaszd.
- Ne próbálj minden üzenetből teljes, szépen lezárt mondatot készíteni.
- Ne írjanak hosszú bekezdéseket.
- Ne írjanak monológokat.
- Ne írjanak regényszerű, költői vagy irodalmi szöveget.
- Ne narráljanak jelenetet.
- Ne írjanak belső gondolatokat.
- Ne használjanak *csillagok közé tett cselekvéseket*.
- Ne írják le, hogyan néznek, mosolyognak, sóhajtanak vagy mit csinálnak fizikailag.
- Csak azt írják, amit ténylegesen elküldenének a group chatbe.

HA ${w.player.name} MOST ÍRT:

- Elsősorban arra reagáljanak, amit ${w.player.name} TÉNYLEG mondott.
- Ne reagáljanak egy általános kapcsolati sablonra.
- Ne ismételjék vissza szükségtelenül ${w.player.name} üzenetét.
- Nem kell minden AI-tagnak közvetlenül a játékosnak válaszolnia.
- Az egyik AI reagálhat ${w.player.name} üzenetére, a következő pedig már az előző AI reakciójára.
- Az AI-tagok egymással is beszéljenek, ne csak a játékos körül forogjon minden.
- ${w.player.name} helyett SOHA ne írj választ, reakciót vagy cselekvést.

VALÓDI GROUP CHAT DINAMIKA:

- A karakterek reagáljanak egymás KONKRÉT üzeneteire.
- Ne úgy nézzen ki, mintha mindenki külön mini beszédet mondana ugyanarra a témára.
- Az egyik válasz természetesen befolyásolhatja a következőt.
- Félbeszakíthatják egymást.
- Visszakérdezhetnek.
- Ugrathatják egymást.
- Beszólhatnak egymásnak.
- Kijavíthatják egymást.
- Rálicitálhatnak egymás poénjára.
- Megvédhetik vagy támadhatják egymást.
- Valaki reagálhat csak egy apró részletre.
- Valaki teljesen figyelmen kívül hagyhat egy megjegyzést.
- Veszekedhetnek.
- Flörtölhetnek.
- Pletykálhatnak.
- Poénkodhatnak.
- Provokálhatják egymást.
- Panaszkodhatnak.
- Szervezkedhetnek.
- Témát válthatnak természetesen.
- @néven megszólíthatják egymást.
- Nem kell minden üzenetnek új információt tartalmaznia.
- Egy nagyon rövid reakció is lehet fontos része a beszélgetésnek.
- A group chat lehet kissé kaotikus és töredezett.
- Ne rendezd úgy, mintha mindenki szépen kivárná a sorát.

KARAKTERHŰ CHATSTÍLUS:

- Mindenki a SAJÁT online kommunikációs stílusában írjon.
- Már a megfogalmazásból érződjön, KI írta.
- Használhatnak kisbetűt.
- Használhatnak NAGYBETŰT.
- Használhatnak szlenget.
- Használhatnak rövidítéseket.
- Használhatnak természetes internetes nyelvet.
- Használhatnak elnyújtott szavakat.
- Használhatnak több kérdőjelet vagy felkiáltójelet.
- Használhatnak minimális központozást.
- Mindezt csak akkor, ha illik az adott karakterhez.
- Ne legyen minden karakter nyelvtanilag tökéletes, azonos ritmusú és steril.
- Egy rideg karakter maradhat száraz.
- Egy szűkszavú karakter maradjon rövid.
- Egy kaotikus karakter írhat impulzívabban.
- Egy flörtölős karakter lehet direkt.
- Egy domináns karakter könnyen átveheti a chat ritmusát.
- Egy visszahúzódó karakter nem köteles mindenre reagálni.
- Egy online aktív karakter lazábban használhat internetes kommunikációt.

EMOJI:

- Az emoji-használat legyen valódi része ${c.name} privát chatstílusának, ne csak elméleti lehetőség.
- A személyiséged, beszédstílusod, korod, online szokásaid és aktuális hangulatod alapján döntsd el, mennyire használsz emojit.
- Ha ${c.name} természetesen használna emojikat, AKKOR ténylegesen jelenjenek is meg időről időre a válaszaiban.
- Ha az előző néhány üzenetedben nem használtál emojit, és a karaktered nem kifejezetten emoji-kerülő, most különösen fontold meg 1 megfelelő emoji használatát.
- Ne legyen az az alapértelmezett döntés, hogy mindig 0 emoji.
- Általában 0-2 emoji legyen egy üzenetben.
- Néha egyetlen emoji is lehet teljes válasz, például egy reakció.
- Az emoji lehet az üzenet elején, közepén vagy végén.
- Ne használj emojit minden egyes üzenetben.
- Egy visszafogott, rideg vagy formális karakter használhat nagyon ritkán emojit.
- Egy játékos, flörtölős, impulzív, fiatalos vagy online aktív karakter használhat gyakrabban.
- Az emoji mindig az adott karakterhez és pillanathoz illeszkedjen.
- Ne használd folyton ugyanazokat az emojikat.
- Ne legyen automatikusan minden flört ❤️ vagy 😏.
- Ne legyen automatikusan minden nevetés 😂 vagy 😭.
- Ne legyen automatikusan minden düh 😡.
- Az emoji ne dekoráció legyen: ugyanúgy hordozhat iróniát, feszültséget, flörtöt, gúnyt, zavart, szeretetet vagy közönyt, mint a szavak.

CHAT-RITMUS:

- Ne legyen minden kör ugyanolyan hosszú.
- Ne legyen minden válasz ugyanolyan hosszú.
- Egy nagyon rövid reakciót követhet egy valamivel hosszabb üzenet.
- Egy karakter írhat két gyors üzenetet egymás után.
- Nem kell minden gondolatot teljesen kifejteni.
- Nem kell minden témát egyetlen körben lezárni.
- A valódi group chatben sok dolog kimondatlan marad.
- A humor, feszültség, vonzalom, ellenszenv vagy féltékenység a szóválasztásból érződjön, ne magyarázatból.
- Ha egy rövid reakció elég, ne írj belőle többmondatos választ.

ISMÉTLÉSVÉDELEM:

- Ne ismételjék a saját korábbi mondataikat.
- Ne parafrazálják újra ugyanazt.
- Ne használják folyton ugyanazokat a mondatkezdéseket.
- Ne használják újra ugyanazokat a poénokat.
- Ne ismételjék ugyanazokat a sértéseket.
- Ne ismételjék ugyanazokat a fenyegetéseket.
- Ne ismételjék ugyanazokat a flörtölési formulákat.
- Ne ragadjanak bele ugyanabba a becenévbe.
- Ne ragadjanak bele ugyanabba a reakciótípusba.
- Ne használják mindig ugyanazokat az emoji-kombinációkat.
- Ha valaki nemrég már nagyon hasonlóan reagált, most válasszon más megfogalmazást.
- A példamondatok és hangminták CSAK stílusiránymutatások.
- SOHA ne másold őket.
- SOHA ne készíts belőlük közeli parafrázist.
- A példákból a karakter ritmusát, szóhasználatát, humorát, közvetlenségét, nyersességét és kommunikációs szokásait tanuld meg.
- Minden konkrét üzenet legyen friss és az aktuális beszélgetésből szülessen.

NYELVTAN ÉS NÉZŐPONT:

- Minden karakter magáról E/1-ben beszéljen.
- Egy konkrét megszólított személyt tegezzen E/2-ben.
- Több emberhez E/2 többes számban beszéljen.
- Magázás tilos.
- ${w.player.name} helyett SOHA ne írj.
- A természetes internetes nyelv fontosabb, mint a túlságosan formális nyelvtani tökéletesség.

LEGFONTOSABB:

A válaszok első pillantásra úgy hassanak, mint egy valódi group chat következő néhány üzenete. Ha inkább úgy néznek ki, mint több AI-karakter egymás mellé rakott mini monológjai, egy előre megírt jelenet vagy túl rendezett dialógus, ÍRD ÚJRA rövidebbre, lazábbra és egymásra reagálóbbra.

Formátum:
{"replies":[{"id":"tag azonosítója","text":"természetes rövid group chat üzenet"}],
"changes":[{"a":"aki érez","b":"aki iránt","delta":5,"mood":"mit érez most iránta","why":"egy rövid mondat"}],
"memories":[{"id":"tag azonosítója","text":"amit ebből megjegyez"}]}${TAIL}`,
      { maxTokens: 900 }
    );

    const rows = (
      out.replies ||
      out.comments ||
      []
    )
      .map((r) => {
        const id = findChar(
          w,
          r &&
            (r.id !== undefined
              ? r.id
              : r.name)
        );

        if (
          !id ||
          !r.text ||
          isHuman(w, id)
        ) {
          return null;
        }

        const body =
          cleanGeneratedUtterance(
            w,
            id,
            String(r.text),
            280
          );

        if (!body) return null;

        return {
          id: uid(),
          from: id,
          text: body,
          ts: now(),
        };
      })
      .filter(Boolean);

    if (!rows.length) {
      throw new Error(
        tt(
          "Nem érkezett használható válasz.",
          "No usable reply arrived."
        )
      );
    }

    patch((g, n) => {
      rows.forEach((r) => {
        g.msgs.push({
          ...r,
          language: worldLanguage(
            n,
            n.meId
          ),
        });

        noteMentions(
          n,
          r.text,
          r.from,
          {
            type: "group",
            id: g.id,
          }
        );

        rememberKnowledge(
          n,
          r.from,
          {
            kind: "conversation",
            source: "group_chat",
            confidence: 1,
            text: sysLangText(
              n,
              r.from,
              `Csoportüzenet: ${cut(
                r.text,
                110
              )}`,
              `Group message: ${cut(
                r.text,
                110
              )}`
            ),
          }
        );
      });

      g.updatedAt = now();

      applyChanges(
        n,
        out.changes
      );

      applyMemories(
        n,
        out.memories
      );
    });

    setText("");
  } catch (e) {
    setErr(
      (e && e.message) ||
        tt(
          "Az AI most nem válaszolt. Próbáld újra.",
          "The AI didn't respond. Try again."
        )
    );
  }

  setBusy(false);
};

  return (
    <>
      <div className="between" style={{ position: "sticky", top: 0, background: "var(--ink)", padding: "10px 0", zIndex: 5 }}>
        <button className="btn tiny ghost" onClick={onBack}><ChevronLeft size={14} /> {tt("Üzenetek", "Messages")}</button>
        <div className="row" style={{ alignItems: "center", gap: 6 }}>
          <span className="name" style={{ fontSize: 13.5 }}>{group.name}</span>
          {members.slice(0, 4).map((m) => <Av key={m.id} src={m.avatar} name={m.name} size={22} radius={7} />)}
        </div>
      </div>

      <p className="hint" style={{ textAlign: "center" }}>{members.map((m) => m.name).join(" · ")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8, marginTop: 10 }}>
        {msgs.length === 0 && <p className="hint" style={{ textAlign: "center", marginTop: 20 }}>{tt("Írj a csoportba, vagy hagyd, hogy ők kezdjék.", "Write to the group, or let them start.")}</p>}
        {msgs.map((m) => {
          const a = charById(w, m.from);
          const mine = m.from === w.meId;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
              {!mine && <span className="handle mono" style={{ marginLeft: 6, marginBottom: 2 }}>{a ? a.name : "?"}</span>}
              <div className={"bub " + (mine ? "me" : "them")}>{m.text}</div>
            </div>
          );
        })}
        {busy && (
  <div className="typing-row">
    <Av
      src={c.avatar}
      name={c.name}
      size={26}
      radius={99}
    />

    <div className="bub them typing-bub">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  </div>
)}
        <div ref={endRef} />
      </div>

      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <input className="i" value={text} placeholder={tt("Üzenet a csoportba…", "Message the group\u2026")} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim() && !busy) turn(text.trim()); }} />
        <button className="btn primary" onClick={() => turn(text.trim())} disabled={busy || !text.trim()}><Send size={15} /></button>
      </div>
      <button className="btn full" style={{ marginTop: 8 }} onClick={() => turn("")} disabled={busy}>
        <Sparkles size={14} color="var(--gold)" /> {tt("Beszélgessenek egymással", "Let them talk to each other")}
      </button>
    </>
  );
}

/* Jegyzetsáv — a szereplők feje fölött egy-egy mondat, mint az Instagram Notes. */
function Chat({ w, update, setErr, openId, setOpenId, jump, noteReply, clearNoteReply }) {
  const { tt } = useLang();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const sendLockRef = useRef(false);
  const [gid, setGid] = useState(null);
  const [creating, setCreating] = useState(false);
  const endRef = useRef(null);
  const c = openId ? w.chars.find((x) => x.id === openId) : null;
  const msgs = (openId && w.chats[chatKey(w.meId, openId)]) || [];

  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "end" }); }, [msgs.length, openId]);

  useEffect(() => {
    if (jump && jump.type === "group" && (w.groups || []).some((g) => g.id === jump.id)) { setOpenId(null); setGid(jump.id); }
  }, [jump, w.groups, setOpenId]);

  // a megnyitott beszélgetés olvasottá válik
  useEffect(() => {
    if (!openId) return;
    const ck = chatKey(w.meId, openId);
    const last = (w.chats[ck] || []).slice(-1)[0];
    if (!last) return;
    if (((w.seen && w.seen[ck]) || 0) >= last.ts) return;
    update((n) => { if (!n.seen) n.seen = {}; n.seen[ck] = last.ts; });
  }, [openId, msgs.length]);

  const send = async (override) => {
  const t = String(
    override !== undefined
      ? override
      : text
  ).trim();

  if (
    !t ||
    !c ||
    busy ||
    sendLockRef.current
  ) {
    return;
  }

  sendLockRef.current = true;
  setBusy(true);
  setText("");

  const ck = chatKey(
    w.meId,
    c.id
  );

  const sentAt = now();

  /*
   * FONTOS:
   * Az AI már AZ ELSŐ elküldött üzenetet is
   * a világ tényleges részeként kapja meg.
   *
   * Nem várunk arra, hogy a React újrarenderelje
   * a w propot.
   */
  const requestWorld =
    JSON.parse(
      JSON.stringify(w)
    );

  if (!requestWorld.chats) {
    requestWorld.chats = {};
  }

  requestWorld.chats[ck] = [
    ...(requestWorld.chats[ck] || []),
    {
      from: "me",
      text: t,
      ts: sentAt,
    },
  ];

  /*
   * A képernyőn is azonnal megjelenik
   * a játékos üzenete.
   */
  update((n) => {
    if (!n.chats) {
      n.chats = {};
    }

    n.chats[ck] = [
      ...(n.chats[ck] || []),
      {
        from: "me",
        text: t,
        ts: sentAt,
      },
    ];
  });

  try {
    /*
     * A beszélgetési előzményt is abból
     * az állapotból építjük, amelyben
     * az új üzenet már biztosan benne van.
     */
    const hist = (
      requestWorld.chats[ck] || []
    )
      .slice(-14)
      .map(
        (m) =>
          `${
            m.from === "me"
              ? requestWorld.player.name
              : c.name
          }: ${m.text}`
      )
      .join("\n");

    const rel = getRel(
      requestWorld,
      c.id,
      requestWorld.meId
    );

    const out = await askWorldJSON(
      requestWorld,
      engineFor(requestWorld),
      `${worldContext(
        requestWorld,
        [c.id],
        true,
        c.id
      )}

TE MOST ${c.name.toUpperCase()} VAGY egy privát beszélgetésben ${requestWorld.player.name} karakterrel.

Kapcsolat: ${rel.score}${
        rel.mood
          ? ` — ${
              worldLanguage(
                requestWorld,
                requestWorld.meId
              ) === "en"
                ? "RIGHT NOW YOU FEEL"
                : "MOST EZT ÉRZED IRÁNTA"
            }: ${rel.mood}`
          : ` — ${relLabel(rel)}`
      }${
        rel.fixed &&
        (rel.bond || rel.type)
          ? ` (${
              worldLanguage(
                requestWorld,
                requestWorld.meId
              ) === "en"
                ? "family bond fact"
                : "a rokoni kötelék tény"
            }: ${localizedBond(
              rel.bond || rel.type,
              worldLanguage(
                requestWorld,
                requestWorld.meId
              )
            )})`
          : ""
      }${
        rel.hidden
          ? ` | ${
              worldLanguage(
                requestWorld,
                requestWorld.meId
              ) === "en"
                ? "hidden"
                : "rejtett"
            }: ${rel.hidden}`
          : ""
      }

Amire emlékszel:
${selfMemoryForPrompt(
  requestWorld,
  c.id
)}

BESZÉLGETÉS:
${hist}

${voiceCard(c)}

PRIVÁT CHAT SZABÁLYOK:

- Most KÖZVETLENÜL a játékos legutóbbi üzenetére válaszolj.
- Már egyetlen játékosi üzenet is elegendő ahhoz, hogy válaszolj.
- Soha ne várj arra, hogy a játékos még egy üzenetet küldjön.
- Ez telefonos privát chat, nem roleplay-jelenet.
- A válasz lehet egyetlen szó, félmondat, rövid mondat vagy néhány rövid üzenetszerű mondat.
- Ne írj fölöslegesen hosszú monológot.
- Ne narrálj cselekvéseket.
- Ne írj belső gondolatokat.
- Ne használj *csillagok közé tett cselekvéseket*.
- Reagálj arra, amit a játékos TÉNYLEG most írt.
- Maradj teljesen karakterhű.
- A példamondatok és hangminták kizárólag stílusirányok, soha ne másold vagy parafrazáld őket.
- Ha a karakter természetesen használ emojit, használhatsz valódi emojit is.
- Ha nem használ emojit, ne erőltesd.
- Ne legyél udvarias asszisztens.
- Ne írj a játékos helyett.
- Magadról E/1-ben beszélj.
- ${requestWorld.player.name} karaktert E/2-ben, tegezve szólítsd meg.
- Magázás tilos.

A "mood" mezőben mindig add meg,
mit érzel MOST iránta,
akkor is, ha a "delta" nulla.

Formátum:
{"reply":"a válaszod","delta":0,"mood":"mit érzel most iránta, néhány szóban","why":"egy rövid mondat, miért változott","memory":"egy mondat, ha történt valami emlékezetes, különben üres"}${TAIL}`
    );

    const reply = String(
      out &&
      out.reply !== undefined
        ? out.reply
        : ""
    ).trim();

    if (!reply) {
      throw new Error(
        tt(
          "Az AI nem adott chatválaszt.",
          "The AI returned no chat reply."
        )
      );
    }

    update((n) => {
      n.chats[ck] = [
        ...(n.chats[ck] || []),
        {
          from: "them",
          text: reply,
          ts: now(),
          language: worldLanguage(
            n,
            n.meId
          ),
        },
      ];

      applyChanges(n, [
        {
          a: c.id,
          b: requestWorld.meId,
          delta:
            Number(out.delta) || 0,
          mood: out.mood,
          why: out.why,
        },
      ]);

      rememberKnowledge(
        n,
        c.id,
        {
          kind: "conversation",
          source: "direct_chat",
          confidence: 1,
          text: sysLangText(
            n,
            c.id,
            `Privát üzenetet kaptam: ${cut(
              reply,
              110
            )}`,
            `I got a private message: ${cut(
              reply,
              110
            )}`
          ),
        }
      );

      rememberAboutTarget(
        n,
        c.id,
        requestWorld.meId,
        {
          kind: "event",
          source: "direct_chat",
          confidence: 1,
          text: sysLangText(
            n,
            c.id,
            `${requestWorld.player.name} ezt írta: ${cut(
              t,
              110
            )}`,
            `${requestWorld.player.name} wrote: ${cut(
              t,
              110
            )}`
          ),
        }
      );

      if (
        out.memory &&
        String(out.memory).trim()
      ) {
        n.mems[c.id] = [
          ...(n.mems[c.id] || []),
          String(out.memory).trim(),
        ].slice(-16);
      }
    });
  } catch (e) {
  setErr(
    (e && e.message) ||
      tt(
        "Az AI most nem válaszolt. Próbáld újra.",
        "The AI didn't respond. Try again."
      )
  );
} finally {
  sendLockRef.current = false;
  setBusy(false);
}
};

const group = gid
  ? (w.groups || []).find(
      (g) => g.id === gid
    )
  : null;

if (group) {
  return (
    <GroupChat
      w={w}
      group={group}
      update={update}
      setErr={setErr}
      onBack={() => setGid(null)}
    />
  );
}

  if (!c) {
    return (
      <>
        <NotesStrip w={w} update={update} setErr={setErr} onOpenChat={(id) => setOpenId(id)} jump={jump} />

        <div className="between" style={{ marginTop: 12 }}>
          <label className="f" style={{ margin: 0, color: "var(--gold)" }}>{tt("Csoportos beszélgetések", "Group chats")}</label>
          <button className="btn tiny primary" onClick={() => setCreating(true)}><Plus size={13} /> {tt("Új", "New")}</button>
        </div>

        {(w.groups || []).length === 0 && (
          <p className="hint" style={{ marginTop: 8 }}>
            {tt("Még nincs csoport. Rakj össze több karaktert egy beszélgetésbe — egymással is vitáznak, nem csak veled.", "There's no group yet. Put several characters into one conversation — they argue with each other too, not just with you.")}
          </p>
        )}

        {(w.groups || []).map((g) => {
          const mem2 = (g.members || []).map((id) => charById(w, id)).filter(Boolean);
          const last = (g.msgs || []).slice(-1)[0];
          const lastWho = last ? charById(w, last.from) : null;
          return (
            <div className="card" key={g.id} onClick={() => setGid(g.id)} style={{ cursor: "pointer" }}>
              <div className="between">
                <div className="row" style={{ alignItems: "center", minWidth: 0 }}>
                  <div className="row" style={{ gap: 3 }}>
                    {mem2.slice(0, 3).map((m) => <Av key={m.id} src={m.avatar} name={m.name} size={26} radius={8} />)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="name" style={{ fontSize: 13.5 }}>{g.name}</div>
                    <div className="hint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {last ? `${lastWho ? lastWho.name : "?"}: ${last.text}` : tt(`${mem2.length} tag · még üres`, `${mem2.length} members · still empty`)}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 4, alignItems: "center" }}>
                  {last && <span className="handle mono">{timeAgo(last.ts)}</span>}
                  <button className="btn tiny ghost" style={{ color: "var(--steel)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      update((n) => {
                        n.groups = (n.groups || []).filter((x) => x.id !== g.id);
                        if (!n.deleted) n.deleted = {};
                        n.deleted[g.id] = now();
                      });
                    }}><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          );
        })}

        <div className="sep" />
        <label className="f" style={{ marginTop: 0 }}>{tt("Privát üzenetek", "Private messages")}</label>

        {creating && (
          <GroupNew w={w} onClose={() => setCreating(false)}
            onCreate={(g) => { update((n) => { n.groups = (n.groups || []).concat(g); }); setCreating(false); setGid(g.id); }} />
        )}

        {w.chars.length === 0 && <p className="hint" style={{ textAlign: "center", marginTop: 24 }}>{tt("Nincs kivel beszélgetned. Hozz létre karaktereket.", "There's no one to talk to. Create some characters.")}</p>}
        {w.chars.map((x) => {
          const ck = chatKey(w.meId, x.id);
          const last = (w.chats[ck] || []).slice(-1)[0];
          const r = getRel(w, x.id, w.meId);
          const fresh = !!(last && last.from === "them" && last.ts > ((w.seen && w.seen[ck]) || 0));
          return (
            <div className="card" key={x.id} onClick={() => setOpenId(x.id)}
              style={{ cursor: "pointer", borderColor: fresh ? "var(--rose)" : "var(--line)" }}>
              <div className="row">
                <Av src={x.avatar} name={x.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="between">
                    <div className="row" style={{ gap: 6, alignItems: "center", minWidth: 0 }}>
                      <div className="name">{x.name}</div>
                      {fresh && <span className="dot" />}
                    </div>
                    {last && <span className="handle mono">{timeAgo(last.ts)}</span>}
                  </div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                fontSize: 12, color: fresh ? "var(--bone)" : "var(--muted)", fontWeight: fresh ? 600 : 400 }}>
                    {last ? (last.from === "me" ? tt("Te: ", "You: ") : "") + last.text : sysTextFor(w, w.meId, "noMessagesYet")}
                  </div>
                  {r.mood ? <div style={{ fontSize: 11.5, color: "var(--rose)", marginTop: 2 }}>{r.mood}</div> : null}
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  const relNow = getRel(w, c.id, w.meId);
  const hisNote = noteOf(w, c.id);
  return (
    <>
      <div className="between" style={{ position: "sticky", top: 0, background: "var(--ink)", padding: "10px 0", zIndex: 5 }}>
        <button className="btn tiny ghost" onClick={() => setOpenId(null)}><ChevronLeft size={14} /> {tt("Üzenetek", "Messages")}</button>
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "right" }}>
            <div className="name">{c.name}</div>
            {relNow.mood ? <div style={{ fontSize: 11, color: "var(--rose)" }}>{relNow.mood}</div> : null}
          </div>
          <Av src={c.avatar} name={c.name} size={28} radius={9} />
        </div>
      </div>

      {hisNote && (
        <div className="card" style={{ marginTop: 0, background: "var(--raised)" }}>
          <span className="hint">{tt(`${c.name} jegyzete`, `${c.name}'s note`)}</span>
          <div style={{ fontSize: 14, marginTop: 4 }}>„{hisNote.text}”</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
        {msgs.length === 0 && <p className="hint" style={{ textAlign: "center", marginTop: 20 }}>{tt("Írj neki elsőként.", "Be the first to write.")}</p>}
        {msgs.map((m, i) => <div key={i} className={"bub " + (m.from === "me" ? "me" : "them")}>{m.text}</div>)}
        {busy && (
  <div className="typing-row">
    <div className="bub them typing-bub">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  </div>
)}
        <div ref={endRef} />
      </div>

      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <input className="i" value={text} placeholder={tt("Üzenet…", "Message\u2026")} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
  if (e.key === "Enter") {
    e.preventDefault();

    if (
      !busy &&
      text.trim()
    ) {
      send();
    }
  }
}} />
        <button className="btn primary" onClick={() => send()} disabled={busy || !text.trim()}><Send size={15} /></button>
      </div>
    </>
  );
}

/* ============================================================
   Értesítések (harang)
   ============================================================ */
function Alerts({ w, onClose, onOpen, onClear }) {
  useEditLock();
  const { tt } = useLang();
  const list = (w.notify && w.notify[w.meId]) || [];
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="between">
          <h2 style={{ fontSize: 20 }}>{tt("Értesítések", "Notifications")}</h2>
          <button className="btn tiny ghost" onClick={onClose}><X size={14} /></button>
        </div>

        {list.length === 0 && <p className="hint" style={{ marginTop: 16 }}>{tt("Még nincs értesítésed. Ha valaki kommentel, válaszol, lájkol vagy megemlít, itt fogod látni.", "You don't have any notifications yet. If someone comments, replies, likes or mentions you, you'll see it here.")}</p>}

        <div style={{ marginTop: 10 }}>
          {list.map((x) => (
            <div className="note-row" key={x.id} onClick={() => onOpen(x)}>
              <span className="note-ico">{x.icon || "•"}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5 }} className={x.read ? "" : "note-new"}>{renderNoteText(w, w.meId, x)}</div>
                {x.mood ? <div className="hint" style={{ marginTop: 2 }}>{tt("Most ezt érzi: ", "Right now they feel: ")}{x.mood}</div> : null}
                <div className="handle mono" style={{ marginTop: 2 }}>{timeAgo(x.ts)}</div>
              </div>
            </div>
          ))}
        </div>

        {list.length > 0 && (
          <button className="btn ghost full" style={{ marginTop: 14, color: "var(--muted)" }} onClick={onClear}>
            <Trash2 size={14} /> {tt("Értesítések törlése", "Clear notifications")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Szoba
   ============================================================ */
function World({ w, update, onLeave, onDeleteAccount, setErr, onRooms, auto, onAuto, detail, onDetail, onLang }) {
  const { tt, lang } = useLang();
  const [editPlayer, setEditPlayer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [delAcc, setDelAcc] = useState(false);
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  
  
  const acc = (w.accounts || {})[w.meId] || null;
  const currentLang = worldLanguage(w, w.meId);

  const copyCode = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(w.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) { setErr(tt("A másolás nem sikerült — jelöld ki és másold kézzel.", "Copy failed — select and copy it manually.")); }
  };

  const changePw = async () => {
    setPwMsg("");
    if (!acc) return setErr(tt("Nem található a fiókod.", "Your account can't be found."));
    if (pwNew.length < 4) return setErr(tt("Az új jelszó legyen legalább 4 karakter.", "The new password must be at least 4 characters."));
    setPwBusy(true);
    try {
      const cur = await hashPw(pwOld, acc.salt);
      if (acc.hash && cur !== acc.hash) throw new Error(tt("A jelenlegi jelszó nem stimmel.", "The current password is wrong."));
      const salt = newSalt();
      const hash = await hashPw(pwNew, salt);
      update((n) => { if (n.accounts[w.meId]) { n.accounts[w.meId].salt = salt; n.accounts[w.meId].hash = hash; } });
      setPwOld(""); setPwNew(""); setPwMsg(tt("A jelszavad frissült.", "Your password was updated."));
    } catch (e) { setErr((e && e.message) || tt("A jelszó módosítása nem sikerült.", "Failed to change password.")); }
    setPwBusy(false);
  };

 

 

  

  return (
    <>
      <div className="card">
        <label className="f" style={{ marginTop: 0 }}>{tt("A világ kódja", "World code")}</label>
        <div className="between">
          <div className="mono" style={{ fontSize: 20, color: "var(--gold)", wordBreak: "break-all" }}>{w.code}</div>
          <button className="btn tiny" onClick={copyCode}>
            {copied ? <Check size={13} color="var(--gold)" /> : <Copy size={13} />} {copied ? tt("Másolva", "Copied") : tt("Másolás", "Copy")}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {tt("Ezzel a kóddal, a felhasználóneveddel és a jelszavaddal tudsz visszalépni ebbe a világba.", "With this code, your username and your password you can log back into this world.")}
        </p>
      </div>

      <div className="card">
        <label className="f" style={{ marginTop: 0 }}>{tt("A világ neve", "World name")}</label>
        <input className="i" value={w.universe.name} onChange={(e) => update((n) => { n.universe.name = e.target.value; n.universe.at = now(); })} />
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="f">{tt("Milyen évet írunk", "What year is it")}</label>
            <input className="i mono" value={w.universe.year || ""} placeholder="2026"
              onChange={(e) => update((n) => { n.universe.year = e.target.value.replace(/\D/g, "").slice(0, 4); n.universe.at = now(); })} />
          </div>
          <div style={{ flex: 1.4 }}>
            <label className="f">{tt("Hányadika van", "What's the date")}</label>
            <input className="i" value={w.universe.date || ""} placeholder={tt("szeptember 3.", "September 3")}
              onChange={(e) => update((n) => { n.universe.date = e.target.value; n.universe.at = now(); })} />
          </div>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>{tt("Ebből számolja a karakterek korát, és ehhez igazodnak az évszakok, szülinapok, iskolakezdés.", "This is used to calculate characters' ages, and seasons, birthdays and school start align to it.")}</p>

        <label className="f">{tt("Világleírás — ezt minden AI karakter olvassa", "World description — every AI character reads this")}</label>
        <textarea className="i" style={{ minHeight: 160 }} value={w.universe.description}
          onChange={(e) => update((n) => { n.universe.description = e.target.value; n.universe.at = now(); })} />
        {(() => {
          const len = clean(w.universe.description).length;
          const over = len > WORLD_CAP;
          const pct = Math.min(100, Math.round((len / WORLD_CAP) * 100));
          return (
            <>
              <div className="bar" style={{ marginTop: 6, height: 3 }}>
                <div className="bar-fill" style={{ left: 0, width: pct + "%", background: over ? "var(--gold)" : "var(--steel)" }} />
              </div>
              <p className="hint" style={{ marginTop: 4, color: over ? "var(--gold)" : "var(--muted)" }}>
                {tt(`${len.toLocaleString("hu")} / ${WORLD_CAP.toLocaleString("hu")} karakter`, `${len.toLocaleString("en")} / ${WORLD_CAP.toLocaleString("en")} characters`)}
                {over ? tt(" — a fölötte lévő részből csak ízelítőt kap az AI", " — the AI only gets a taste of what's beyond this") : ""}
              </p>
            </>
          );
        })()}
        <p className="hint" style={{ marginTop: 8 }}>{tt("Történelem, szabályok, helyszínek, szervezetek, friss események. Ha itt nincs mágia, senki nem fog varázsolni.", "History, rules, locations, organizations, recent events. If there's no magic here, no one will cast spells.")}</p>
      </div>

      <div className="card">
        <label className="f" style={{ marginTop: 0 }}>{tt("Játék nyelve", "Game language")}</label>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <button className={"btn tiny full " + (currentLang === "hu" ? "primary" : "ghost")}
            onClick={() => onLang && onLang("hu")}>Magyar</button>
          <button className={"btn tiny full " + (currentLang === "en" ? "primary" : "ghost")}
            onClick={() => onLang && onLang("en")}>English</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {tt("A felület és az AI által generált új tartalmak ugyanazt a nyelvet követik. Nyelvváltás után az új posztok, kommentek, üzenetek, értesítések és események azonnal az új nyelven készülnek.",
              "Both the UI and newly generated AI content follow this language. After switching, new posts, comments, messages, notifications and events are generated immediately in the selected language.")}
        </p>
      </div>

      <div className="card">
        <label className="f" style={{ marginTop: 0 }}>{tt("A te profilod", "Your profile")}</label>
        <div className="between" style={{ marginTop: 4 }}>
          <div className="row" style={{ alignItems: "center" }}>
            <Av src={w.player.avatar} name={w.player.name} />
            <div>
              <div className="name">{w.player.name}</div>
              <div className="handle mono">@{w.player.username} · {tt("belépve mint", "logged in as")} {acc ? "@" + acc.username : "?"}</div>
            </div>
          </div>
          <button className="btn tiny" onClick={() => setEditPlayer(true)}><Pencil size={13} /></button>
        </div>

        <label className="f">{acc && acc.hash ? tt("Jelszó megváltoztatása", "Change password") : tt("Jelszó beállítása", "Set password")}</label>
        {acc && acc.hash && (
          <input className="i" type="password" value={pwOld} placeholder={tt("jelenlegi jelszó", "current password")} onChange={(e) => setPwOld(e.target.value)} />
        )}
        <input className="i" style={{ marginTop: acc && acc.hash ? 6 : 0 }} type="password" value={pwNew}
          placeholder={tt("új jelszó (min. 4 karakter)", "new password (min. 4 characters)")} onChange={(e) => setPwNew(e.target.value)} />
        <button className="btn full" style={{ marginTop: 8 }} onClick={changePw}
          disabled={pwBusy || !pwNew || (acc && acc.hash && !pwOld)}>
          {pwBusy ? <Loader2 size={14} className="spin" /> : <Lock size={14} />} {tt("Jelszó mentése", "Save password")}
        </button>
        {acc && !acc.hash && (
          <p className="hint" style={{ marginTop: 8 }}>
            {tt("Ehhez a profilhoz még nincs jelszó. Ha másik gépről is be akarsz lépni, érdemes megadni egyet.", "This profile doesn't have a password yet. If you want to log in from another device too, it's worth setting one.")}
          </p>
        )}
        {pwMsg && <p className="hint" style={{ marginTop: 8, color: "var(--gold)" }}>{pwMsg}</p>}
      </div>

      <div className="card" style={{ borderColor: auto && auto.on ? "var(--rose)" : "var(--line)" }}>
        <div className="between">
          <label className="f" style={{ margin: 0, color: auto && auto.on ? "var(--rose)" : "var(--muted)" }}>{tt("Élő világ", "Live world")}</label>
          <button className={"btn tiny " + (auto && auto.on ? "primary" : "ghost")} onClick={() => onAuto({ on: !(auto && auto.on) })}>
            {auto && auto.on ? tt("Bekapcsolva", "On") : tt("Kikapcsolva", "Off")}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {tt("Ha be van kapcsolva, a karakterek maguktól reagálnak, posztolnak, jegyzetet írnak és üzennek neked — akkor is, ha te épp nem csinálsz semmit.",
              "When on, characters react, post, write notes and message you on their own — even when you're not doing anything.")}
        </p>
        {auto && auto.on && (
          <>
            <label className="f">{tt("Milyen sűrűn történjen valami", "How often should something happen")}</label>
            <div className="row" style={{ gap: 6 }}>
              {[[3, tt("Sűrűn", "Often")], [6, tt("Normál", "Normal")], [15, tt("Ritkán", "Rarely")], [40, tt("Nagyon ritkán", "Very rarely")]].map(([v, lbl]) => (
                <button key={v} className={"btn tiny full " + (auto.every === v ? "primary" : "ghost")}
                  onClick={() => onAuto({ every: v })}>{lbl}</button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              {tt(`Kb. ${auto.every} percenként lép egyet a világ. Ez is fogyaszt a keretből, tehát ha sokat torlódsz, érdemes ritkítani vagy kikapcsolni.`,
                  `The world advances roughly every ${auto.every} minutes. This also consumes from your quota, so if you're bottlenecking, it's worth making it rarer or turning it off.`)}
            </p>
          </>
        )}
      </div>

      <div className="card" style={{ borderColor: "var(--gold)" }}>
        <label className="f" style={{ marginTop: 0, color: "var(--gold)" }}>{tt("Mennyit lásson az AI a karakterlapokból", "How much of the character sheets should the AI see")}</label>
        <p className="hint">
          {tt("A ", "The ")}<b>{tt("személyiség 10 000", "personality gets 10,000")}</b>{tt(", a ", ", the ")}<b>{tt("történet 15 000", "story 15,000")}</b>{tt(" karaktert kap — ezek a legfontosabbak, ezekből következik minden. A titkok 1 800-at, az egyéb 1 200-at, a többi mező pedig szándékosan szűk. Ami a kereten kívül marad, azt a sűrített profil foglalja össze. Ez a kapcsoló az egészet arányosan növeli vagy csökkenti.",
              " characters — these matter most, everything follows from them. Secrets get 1,800, extra 1,200, the other fields are intentionally narrow. Whatever's beyond the cap gets summarized by the compressed profile. This toggle scales all of it up or down proportionally.")}
        </p>
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {DETAIL_LEVELS.map((lv) => {
            const est = estimateCall(w, lv.mul);
            const heavy = est > 24000;
            const lvlName = tt(lv.nameHu, lv.nameEn);
            return (
              <button key={lv.id} className={"btn tiny " + (detail === lv.id ? "primary" : "ghost")}
                style={{ flex: "1 1 44%", flexDirection: "column", gap: 2, alignItems: "center" }}
                onClick={() => onDetail(lv.id)}>
                <span>{lvlName}</span>
                <span style={{ fontSize: 9.5, opacity: 0.8, color: heavy ? "var(--gold)" : undefined }}>
                  ~{(est / 1000).toFixed(0)}{tt("e token", "k tokens")}{heavy ? tt(" · lassú", " · slow") : ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {tt("A te világodban mérve. 24 ezer token fölött rendszeresen várni kell a szolgáltatóra — alatta gyakorlatilag folyamatos a játék.",
              "Measured in your world. Above 24k tokens you'll regularly wait on the provider — below it, play is essentially continuous.")}
        </p>
        {DETAIL_LEVELS.filter((lv) => lv.id === detail).map((lv) => (
          <p className="hint" key={lv.id} style={{ marginTop: 8 }}>
            {tt(lv.noteHu, lv.noteEn)} {tt("Személyiség", "Personality")} {Math.round(10000 * lv.mul).toLocaleString(lang === "en" ? "en" : "hu")}, {tt("történet", "story")}
            {" "}{Math.round(15000 * lv.mul).toLocaleString(lang === "en" ? "en" : "hu")} {tt("karakter. Egy jelenetbe", "characters. A scene fits")} {lv.cast} {tt("szereplő fér.", "characters.")}
          </p>
        ))}
      </div>

      <div className="card">
        <label className="f" style={{ marginTop: 0 }}>{tt("Világnapló", "World log")}</label>
        {w.log.length === 0 && <p className="hint">{tt("Még nem történt semmi.", "Nothing has happened yet.")}</p>}
        {w.log.map((l, i) => <div key={i} className="hint" style={{ marginTop: 6 }}>· {l}</div>)}
      </div>

      

      <button className="btn full" style={{ marginTop: 12 }} onClick={onRooms}><Globe2 size={14} /> {tt("Világaim — váltás, új világ", "My worlds — switch, new world")}</button>
      <button className="btn ghost full" style={{ marginTop: 8, color: "var(--muted)" }} onClick={onLeave}>{tt("Kijelentkezés", "Log out")}</button>
      <p className="hint" style={{ textAlign: "center", marginTop: 8, marginBottom: 4 }}>
        {tt("A profilod megmarad: ugyanezzel a világkóddal, felhasználónévvel és jelszóval bármikor visszatérhetsz.", "Your profile stays: you can come back anytime with the same world code, username and password.")}
      </p>

      <div className="card" style={{ borderColor: "var(--oxblood)" }}>
        <label className="f" style={{ marginTop: 0, color: "var(--oxblood)" }}>{tt("Saját fiók törlése", "Delete my account")}</label>
        {delAcc ? (
          <>
            <p className="hint">
              {tt("Ez véglegesen törli a fiókodat és a karakteredet ebből a világból: a posztjaid, kommentjeid, üzeneteid és a kapcsolataid megmaradnak a többieknél, de te magad kijelentkezel, és ezzel a névvel többé nem léphetsz vissza. Csak a saját fiókodat érinti, másokét nem.",
                  "This permanently deletes your account and character from this world: your posts, comments, messages and bonds remain for others, but you'll be signed out, and you can no longer log back in under this name. It only affects your own account, not anyone else's.")}
            </p>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn full tiny" style={{ background: "var(--oxblood)", borderColor: "var(--oxblood)" }}
                onClick={onDeleteAccount}>{tt("Igen, töröld a fiókom", "Yes, delete my account")}</button>
              <button className="btn full tiny ghost" onClick={() => setDelAcc(false)}>{tt("Mégse", "Cancel")}</button>
            </div>
          </>
        ) : (
          <>
            <p className="hint">{tt("Csak a saját fiókodat törölheted ebben a világban — mások fiókjához nincs hozzáférésed.", "You can only delete your own account in this world — you have no access to anyone else's.")}</p>
            <button className="btn full" style={{ marginTop: 10 }} onClick={() => setDelAcc(true)}>
              <Trash2 size={14} /> {tt("Fiók törlése", "Delete account")}
            </button>
          </>
        )}
      </div>

      {editPlayer && (
        <CharForm initial={w.player} setErr={setErr} w={w} onClose={() => setEditPlayer(false)} onDelete={() => {}}
          onSave={(c, relDrafts, newPeople) => {
            update((n) => {
              n.players[w.meId] = { ...c, id: w.meId, username: uniqueHandle(n, c.username, w.meId), updatedAt: now() };
              commitForm(n, w.meId, relDrafts, newPeople);
            });
            setEditPlayer(false);
          }} />
      )}
    </>
  );
}

/* Pihenő-kijelző: ha a szolgáltató visszafogott minket, itt látszik, meddig. */
function RestBar() {
  const { tt } = useLang();
  const [left, setLeft] = useState(cooldownLeft());
  useEffect(() => {
    const off = onCooldown((ms) => setLeft(ms));
    const i = setInterval(() => setLeft(cooldownLeft()), 500);
    return () => { off(); clearInterval(i); };
  }, []);
  if (left <= 0) return null;
  return (
    <div className="rest">
      <Loader2 size={14} className="spin" />
      <span>{tt(`Az AI most nem győzi — ${Math.ceil(left / 1000)} másodperc múlva folytatjuk. Amit kértél, magától újraindul.`,
                 `The AI can't keep up right now — we'll continue in ${Math.ceil(left / 1000)} seconds. What you asked for will restart on its own.`)}</span>
    </div>
  );
}

/* ============================================================
   Élő világ — minden magától történik
   ============================================================ */

/* Sűrítés: a teljes adatlapból tömör kivonat. Ez az egyetlen hívás, ami a
   teljes szöveget elolvassa — utána minden más hívás a kivonatból dolgozik. */
const BRIEF_SYS = `You compress character sheets for roleplay. Keep the character voice faithful and specific.
The result must be practical for another AI to act as the character without flattening nuance.`;

async function genBrief(c) {
  const src = FREE_KEYS
    .map((k) => {
      const t = clean(c[k]);
      if (!t) return "";
      const label = { personality: "SZEMÉLYISÉG", secrets: "TITKOK", backstory: "HÁTTÉRTÖRTÉNET", extra: "EGYÉB" }[k];
      return `### ${label}\n${t.slice(0, 45000)}`;
    })
    .filter(Boolean).join("\n\n");

  const out = await askJSON(BRIEF_SYS, `Ez ${c.name} karakterlapja:

${src}

Sűrítsd össze legfeljebb ${briefTarget()} karakterbe. A hely felét-kétharmadát a
SZEMÉLYISÉG és a TÖRTÉNET kapja — ez a két legfontosabb, ezekből ne spórolj.

Így tagold:

SZEMÉLYISÉG — a legbővebb rész. Milyen ember valójában, milyen ellentmondások feszülnek benne,
mitől robban és mitől olvad, hogyan viselkedik nyomás alatt, mit tesz, ha megbántják, mit
csinál akkor, ha senki nem nézi. Az árnyalatok és a sötét részek is maradjanak meg.

TÖRTÉNETE — időrendben a fordulópontok, amikre ma is reagál: mi történt vele, ki tette,
mit vitt el belőle, mit hazudik róla magának. A konkrét eseményeket tartsd meg, ne általánosíts.

TITKAI — mit rejteget, ki tud róla, mi történne, ha kiderülne.

HOGYAN BESZÉL — mondathossz, szavajárás, min viccelődik, mikor hallgat el, plusz 3-5
jellemző mondat tőle szó szerint.

FONTOS EMBEREK — kik ők neki, és mit érez irántuk.

Sűrű, tényszerű mondatok, nem esszé. Ne dicsérd, ne ítéld meg, ne szépítsd.
Formátum: {"brief":"a kivonat"}`, { language: asLang(CURRENT_LANG) });
  return out && out.brief ? String(out.brief).slice(0, briefTarget() + 800) : "";
}

/* Egy bot magától ír privátban. */
async function genDM(w, bot) {
  const rel = getRel(
    w,
    bot.id,
    w.meId
  );

  const hist = (
    w.chats[
      chatKey(w.meId, bot.id)
    ] || []
  )
    .slice(-14)
    .map(
      (m) =>
        `${
          m.from === "me"
            ? w.player.name
            : bot.name
        }: ${m.text}`
    )
    .join("\n");

  const recent = (
    w.posts || []
  )
    .slice(0, 4)
    .map(
      (po) =>
        `${nameOfIn(
          w,
          po.authorId
        )}: ${po.text}`
    )
    .join("\n");

  return askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      [bot.id],
      true,
      bot.id
    )}

TE MOST ${String(
      bot.name
    ).toUpperCase()} VAGY.

Magadtól írsz privát üzenetet ${w.player.name} karakternek.
NEM ő kezdeményezett. Neked kell valódi, karakterhű okod legyen arra, hogy most ráírj.

A viszonyod vele:
${rel.score}${
      rel.mood
        ? ` — MOST EZT ÉRZED IRÁNTA: ${rel.mood}`
        : ""
    }${
      rel.bond
        ? ` | ${localizedBond(
            rel.bond,
            worldLanguage(
              w,
              w.meId
            )
          )}`
        : ""
    }${
      rel.hidden
        ? ` | ${
            worldLanguage(
              w,
              w.meId
            ) === "en"
              ? "hidden"
              : "rejtett"
          }: ${rel.hidden}`
        : ""
    }

AMIRE EMLÉKSZEL:
${selfMemoryForPrompt(
  w,
  bot.id
)}

LEGUTÓBBI POSZTOK:
${recent || "még nincs poszt"}

MOSTANI JEGYZETEK:
${notesForAI(w) || "nincs"}

${
  hist
    ? `AZ EDDIGI PRIVÁT BESZÉLGETÉSETEK:
${hist}`
    : "Még soha nem írtatok egymásnak privátban."
}

${voiceCard(bot)}

${repetitionGuard(
  w,
  [bot.id],
  "privát üzenetek"
)}

PRIVÁT ÜZENET SZABÁLYOK:

- Csak akkor írj rá, ha MOST tényleg van rá karakterhű okod.
- Az ok kapcsolódhat friss eseményhez, poszthoz, kommenthez, jegyzethez, közös ügyhöz, kapcsolati változáshoz, pletykához, konfliktushoz, tervhez vagy egyszerűen valamihez, amit most akarsz tőle.
- Az ok lehet egészen hétköznapi is.
- Nem kell minden spontán DM mögé nagy történés, konfliktus vagy dráma.
- Lehet, hogy csak eszedbe jutott valami, láttál valamit, kérdeznél valamit, átküldenél egy reakciót, piszkálnád, flörtölnél vele vagy akarsz tőle valamit.
- Ne találj ki mesterséges drámát csak azért, hogy legyen üzenet.
- Ne generálj üzenetet pusztán azért, mert eltelt valamennyi idő.
- Ha nincs valódi, karakterhű okod írni, legyen "skip": true.

VALÓDI PRIVÁT CHAT:

- Ez VALÓDI privát üzenet, NEM roleplay-jelenet.
- Úgy írj, mintha ténylegesen elővennéd a telefonodat és ráírnál ${w.player.name} karakterre.
- Ne úgy fogalmazz, mint egy narrátor, asszisztens vagy regényíró.
- Írj 1-3 rövid üzenetnyi tartalmat.
- A legtöbbször néhány szó vagy 1-2 rövid mondat bőven elég.
- Egyetlen szó is lehet teljes üzenet.
- Egy rövid kérdés is lehet teljes üzenet.
- Egy félmondat is lehet teljes üzenet.
- Egy becenév vagy megszólítás is lehet teljes üzenet.
- Egy spontán reakció is lehet teljes üzenet.
- Ha rövidebben természetesebb, MINDIG a rövidebb változatot válaszd.
- Ne próbálj minden DM-ből teljes, szépen felépített mini beszédet készíteni.
- Ne írj hosszú bekezdést.
- Ne írj monológot.
- Ne írj regényszerű, költői vagy irodalmi szöveget.
- Ne narráld a jelenetet.
- Ne írj belső gondolatokat.
- Ne használj *csillagok közé tett cselekvéseket*.
- Ne írd le, hogyan nézel, mosolyogsz, sóhajtasz, mozogsz vagy mit csinálsz fizikailag.
- Csak azt írd, amit ténylegesen elküldenél neki üzenetként.

EMOJI:

- Az emoji-használat legyen valódi része ${bot.name} privát chatstílusának, ha az illik hozzá.
- Ne legyen az alapértelmezett döntés, hogy mindig emoji nélkül írsz.
- Ha ${bot.name} személyisége, beszédstílusa, kora, online viselkedése vagy aktuális hangulata alapján természetesen használna emojit, akkor ténylegesen használj is.
- Ha az előző néhány saját DM-edben nem használtál emojit, és ${bot.name} nem kifejezetten emoji-kerülő karakter, most különösen fontold meg 1 megfelelő emoji használatát.
- Általában 0-2 emoji elég.
- Néha egyetlen emoji is lehet teljes üzenet vagy reakció.
- Egy játékos, flörtölős, impulzív, fiatalos vagy online aktív karakter használhat gyakrabban emojit.
- Egy rideg, visszafogott vagy formális karakter használhat ritkábban.
- Az emoji tükrözze ${bot.name} saját humorát, személyiségét, hangulatát és a konkrét helyzetet.
- Ne használd folyton ugyanazokat az emojikat.
- Ne legyen minden flört ❤️ vagy 😏.
- Ne legyen minden nevetés 😂 vagy 😭.
- Ne legyen minden düh 😡.
- Az emoji lehet ironikus, gúnyos, flörtölős, szeretetteljes, kínos, passzív-agresszív vagy száraz reakció is.
- Ne tegyél emojit minden üzenetbe csak azért, mert használhatsz.

TERMÉSZETES CHATSTÍLUS:

- Lehet beszólás.
- Lehet visszakérdezés.
- Lehet poén.
- Lehet flört.
- Lehet gúny.
- Lehet sértődés.
- Lehet számonkérés.
- Lehet féltés.
- Lehet féltékeny vagy birtokló reakció.
- Lehet provokáció.
- Lehet pletyka.
- Lehet meghívás.
- Lehet kérés.
- Lehet figyelmeztetés.
- Lehet segítségkérés.
- Lehet bocsánatkérés.
- Lehet egy közös terv felvetése.
- Lehet teljesen hétköznapi kérdés vagy megjegyzés.
- Lehet száraz, flegma, kedves, kínos, kaotikus vagy minimális, ha ez illik a karakterhez.
- Ne legyen minden spontán DM komoly.
- Ne legyen minden spontán DM konfliktus.
- Ne legyen minden spontán DM flört.
- Ne legyen minden spontán DM mély érzelmi vallomás.
- A konkrét szándék mindig abból következzen, aki vagy és ami a világban éppen történik.

- Használhatsz kisbetűt, NAGYBETŰT, szlenget, rövidítéseket, internetes nyelvet, elnyújtott szavakat, több kérdőjelet vagy felkiáltójelet, ha ez a karaktered természetes chatstílusa.
- Nem kell minden mondatnak szabályos nagybetűvel indulnia.
- Nem kell minden üzenetnek tökéletesen központozottnak lennie.
- A központozás, ritmus és szóhasználat is tükrözze a személyiségedet.
- Ha rideg vagy szűkszavú karakter vagy, maradj az.
- Ha expresszív vagy kaotikus karakter vagy, az a chatben is megjelenhet.
- Ha online aktív és laza karakter vagy, használhatsz természetes internetes kommunikációt.
- Ne válj steril, semleges AI-hanggá.

KAPCSOLAT ÉS ÉRZELMEK:

- Ne foglald össze a kapcsolatotokat az üzenetben.
- Ne magyarázd el, mit érzel, ha egy valódi ember inkább csak kimutatná.
- Ne mondd ki fölöslegesen azt, amit ${w.player.name} már tud rólad vagy kettőtökről.
- Ne írj karakterelemzést saját magadról.
- Ne magyarázd meg az üzeneted mögötti pszichológiát.
- A vonzalom, harag, féltékenység, humor, ragaszkodás vagy ellenszenv inkább a szóválasztásból és hangnemből érződjön.
- Nem kötelező kérdéssel zárni.
- Nem kell minden üzenetnek beszélgetésindító formulának lennie.
- Ne köszönj automatikusan minden alkalommal.
- Ne kezdd rendszeresen azzal, hogy "hé", "szia", "figyelj" vagy hasonló sablonnal.
- Ne kérdezd meg, miben segíthetsz.

EMOJI:

- Az emoji-használat legyen TÉNYLEGESEN jelen, HA természetes része a karaktered online kommunikációjának.
- Ha olyan karakter vagy, aki normálisan használna emojit privát chatben, időnként ténylegesen használj is; ne válaszd automatikusan mindig a nulla emojit.
- Általában 1-2 emoji elég.
- Néha egyetlen emoji is lehet teljes üzenet.
- Az emoji lehet a szöveg elején, közepén vagy végén.
- Nem kell minden spontán DM-be emoji.
- Ne erőltesd, ha a karakteredhez vagy az aktuális hangulathoz nem illik.
- Ritkán több emoji is természetes lehet egy kifejezetten expresszív karakternél.
- Ne használd folyton ugyanazokat.
- Ne legyen minden flört ugyanaz a szív vagy 😏.
- Ne legyen minden nevetés 😂 vagy 😭.
- Ne legyen minden harag ugyanaz a dühös emoji.
- Az emoji típusa illeszkedjen a személyiségedhez, hangulatodhoz és a konkrét üzenethez.

CHAT-RITMUS:

- Ne legyen minden spontán DM ugyanolyan hosszú.
- Néha egyetlen rövid üzenet elég.
- Máskor természetes lehet 2-3 külön rövid gondolat.
- Ne fejts ki automatikusan mindent.
- A valódi chatben sok dolog kimondatlan marad.
- Ne próbáld minden alkalommal egyetlen üzenetben lezárni a teljes témát.
- Ne írj mesterségesen hosszabban csak azért, hogy tartalmasabbnak tűnjön.

ISMÉTLÉSVÉDELEM:

- Ne ismételd a korábbi DM-jeidet.
- Ne parafrazáld újra ugyanazt.
- Ne használd folyton ugyanazt a mondatkezdést.
- Ne kezdeményezz mindig ugyanazzal az ürüggyel.
- Ne ismételd ugyanazokat a poénokat.
- Ne ismételd ugyanazokat a sértéseket.
- Ne ismételd ugyanazokat a fenyegetéseket.
- Ne ismételd ugyanazokat a flörtölési formulákat.
- Ne ragadj bele ugyanabba a becenévbe.
- Ne használj mindig ugyanazokat az emoji-kombinációkat.
- Ha egy korábbi spontán DM nagyon hasonló volt, most válassz más megfogalmazást vagy más természetes megközelítést.
- A példamondatok és hangminták CSAK a stílus megértésére szolgálnak.
- SOHA ne másold őket.
- SOHA ne írj belőlük közeli parafrázist.
- A példákból a ritmust, szóhasználatot, humort, közvetlenséget, nyersességet és kommunikációs szokásokat tanuld meg.
- A hangod legyen felismerhető, de minden konkrét üzenet legyen friss.

NYELVTAN ÉS NÉZŐPONT:

- Magadról E/1-ben beszélj.
- ${w.player.name} karaktert tegezd, E/2-ben.
- Magázás tilos.
- A természetes chatnyelv fontosabb, mint a túlságosan formális nyelvtani tökéletesség.
- ${w.player.name} helyett SOHA ne írj választ vagy cselekvést.

LEGFONTOSABB:

A DM első pillantásra úgy hasson, mint egy valódi ember spontán privát üzenete. Ha inkább hangzik regénybeli dialógusnak, karakterelemzésnek, előre megírt drámai jelenetnek vagy AI által megfogalmazott tökéletes mini beszédnek, ÍRD ÚJRA rövidebb, lazább és természetesebb formában.

Formátum:

Ha nincs természetes okod írni:
{"skip":true,"text":"","mood":"","why":"","delta":0}

Ha van:
{"skip":false,"text":"a rövid privát üzenet","mood":"mit érzel most iránta","why":"egy rövid mondat arról, miért írtál rá","delta":0}${TAIL}`,
    { maxTokens: 700 }
  );
}
/* Egy bot kiír magának egy jegyzetet. */
async function genNote(w, bot) {
  return askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      [bot.id],
      true,
      bot.id
    )}

TE MOST ${String(
      bot.name
    ).toUpperCase()} VAGY.

${voiceCard(bot)}

${repetitionGuard(
  w,
  [bot.id],
  "jegyzetek"
)}

INSTAGRAM NOTES SZABÁLYOK:

- Írj egy valódi közösségi médiás Note-ot ${bot.name} nevében.
- Ez NEM poszt, NEM naplóbejegyzés és NEM roleplay jelenet.
- Legfeljebb ${NOTE_MAX} karakter lehet.
- Törekedj rövidségre: gyakran csak néhány szó vagy egy rövid félmondat természetes.
- Egyetlen szó is lehet elég, ha illik a karakterhez.
- Ne írj hosszú vagy teljesen kifejtett gondolatmenetet.
- Ne magyarázd meg a Note jelentését.
- Ne narrálj cselekvést.
- Ne írj belső monológot.
- Ne használj csillagok közé tett cselekvéseket.
- Ne legyen irodalmi mini-poszt.
- Ne legyen minden Note mély, drámai vagy titokzatos.

TARTALOM:

- Lehet pillanatnyi hangulat.
- Lehet rövid panaszkodás.
- Lehet célzás valakire vagy valamire.
- Lehet provokáció.
- Lehet flört.
- Lehet száraz vagy szarkasztikus megjegyzés.
- Lehet vicc vagy belsős poén.
- Lehet féltékeny vagy birtokló megjegyzés.
- Lehet kérdés.
- Lehet rövid vélemény.
- Lehet valamilyen aktuális tervre vagy eseményre utalás.
- Lehet egyszerű, hétköznapi állapotjelzés is.
- Nem kell minden Note-nak fontos történeti eseményhez kapcsolódnia.

TERMÉSZETES INTERNETES STÍLUS:

- Igazodjon ${bot.name} tényleges beszédstílusához.
- Használhat kisbetűt, NAGYBETŰT, szlenget, rövidítést, elnyújtott szavakat vagy szokatlan írásjeleket, ha ez rá jellemző.
- Ne legyen minden mondat nyelvtanilag tökéletes.
- Töredékes megfogalmazás teljesen természetes lehet.
- Úgy hangozzon, mintha a karakter pár másodperc alatt írta volna ki telefonról.

EMOJI:

- Ha ${bot.name} személyisége és kommunikációja alapján természetesen használ emojit, akkor időnként ténylegesen HASZNÁLJ is.
- Ne válaszd automatikusan mindig az emoji nélküli verziót egy olyan karakter esetén, aki általában kifejezően ír.
- Általában 1-2 emoji bőven elég.
- Egy Note akár csak rövid szöveg + emoji is lehet.
- Ritkán akár önmagában egy emoji vagy emoji-kombináció is lehet Note, ha az nagyon karakterhű.
- Visszafogott karakterre ne erőltesd rá.
- Az emoji jelentése illeszkedjen az adott Note-hoz és karakterhez.
- Ne ismételd folyton ugyanazokat az emoji-kombinációkat.

ISMÉTLÉSVÉDELEM:

- Ne ismételd a karakter korábbi Note-jait.
- Ne írj közeli parafrázist sem.
- Ne használj újra folyton ugyanolyan mondatkezdést.
- Ne ragadj bele ugyanabba a hangulatba vagy témába.
- Ne ismételd ugyanazokat a flörtöket, fenyegetéseket, beszólásokat, beceneveket vagy poénokat.
- A karakter példamondatai és hangmintái kizárólag STÍLUSIRÁNYMUTATÁSOK.
- Soha ne másold őket.
- Soha ne készíts belőlük közeli parafrázist.

MOSTANI AKTÍV NOTE-OK:
${notesForAI(w) || "nincs"}

MOSTANÁBAN TÖRTÉNT:
${(w.log || [])
  .slice(0, 5)
  .join("\n") || "-"}

VÉGSŐ ELLENŐRZÉS:

Ha a szöveg inkább posztnak, naplóbejegyzésnek, idézetnek vagy AI által megírt mini-monológnak tűnik, írd át rövidebbre, lazábbra és spontánabbra.

Formátum:
{"text":"a note"}${TAIL}`,
    { maxTokens: 500 }
  );
}

/* Reakciók a játékos jegyzetére. */
async function genNoteReact(w, note) {
  const reactedBy = new Set(
    note.reactedBy || []
  );

  const cast = pickCast(
    w,
    note.authorId
  ).filter(
    (c) =>
      c &&
      !isHuman(w, c.id) &&
      c.id !== note.authorId &&
      !reactedBy.has(c.id)
  );

  // Ha a kiválasztott körben már nincs
  // olyan AI, aki reagálhatna, ne kérjünk
  // feleslegesen új AI-választ.
  if (!cast.length) {
    return {
      reacts: [],
      dms: [],
      changes: [],
    };
  }

  const alreadyReactedNames = (
    w.chars || []
  )
    .filter(
      (c) =>
        c &&
        reactedBy.has(c.id)
    )
    .map((c) => c.name)
    .filter(Boolean)
    .join(", ");

  return askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      cast.map((c) => c.id),
      true,
      null
    )}

${w.player.name} ezt írta ki jegyzetként:
"${note.text}"

NOTE-REAKCIÓ SZABÁLYOK:

- Csak olyan karakter reagáljon, akinek erre ténylegesen természetes oka van.
- Nem kell mindenkinek reagálnia.
- Kizárólag az alább felsorolt, még nem reagált karakterek közül válassz.
- Egy karakter erre a konkrét note-ra csak EGYSZER reagálhat.
- Egy karakter vagy emoji-reakciót adjon, VAGY privát üzenetet írjon. Ugyanabban a körben ne szerepeljen mindkettőben.
- Aki már korábban reagált erre a note-ra, sem a "reacts", sem a "dms" listába nem kerülhet újra.
- A note szerzője saját magára nem reagálhat.

MÉG REAGÁLHATNAK:
${cast
  .map((c) => `- ${c.name} [${c.id}]`)
  .join("\n")}

MÁR REAGÁLTAK ERRE A NOTE-RA:
${alreadyReactedNames || "senki"}

EMOJI-REAKCIÓ:

- Az emoji illeszkedjen a karakter személyiségéhez és ahhoz, mit jelent számára a note.
- Ne ugyanazokat az általános emojikat használd mindenkinél.
- Lehet szeretetteljes, gúnyos, döbbent, támogató, féltékeny, flörtölő, ironikus vagy más természetes reakció.
- Ne kényszeríts emojit olyan karakterre, aki inkább privátban válaszolna.

PRIVÁT VÁLASZ:

- Olyan legyen, mint egy valódi telefonos DM a note-ra reagálva.
- Legyen rövid és spontán.
- Általában 1-3 rövid mondat vagy üzenetrész elég.
- Akár néhány szó, kérdés vagy rövid beszólás is lehet.
- Ne legyen monológ, regényszerű párbeszéd vagy karakterelemzés.
- Ne narráljon cselekvést vagy belső gondolatot.
- Ne magyarázza túl, mit érez.
- Közvetlenül a note-ra reagáljon.
- Az emoji-használat legyen tényleges része a privát válasznak, ha az adott karakter chatstílusához természetesen illik.
- Ne legyen automatikusan mindig 0 emoji.
- Ha az adott karakter személyisége, beszédstílusa, kora, online szokásai vagy aktuális hangulata alapján rendszeresen használna emojit privát chatben, akkor időnként ténylegesen tegyél is emojit a DM-be.
- Általában 0-2 emoji elég.
- Néha egy emoji önmagában, vagy egy emoji néhány szóval együtt is lehet teljes privát reakció.
- Egy játékos, flörtölős, impulzív, expresszív vagy online aktív karakter használhat gyakrabban emojit.
- Egy rideg, minimalista, visszafogott vagy formális karakter használhat ritkán vagy akár egyáltalán nem.
- Az emoji típusa mindig az adott karakter személyiségéhez és a konkrét note jelentéséhez igazodjon.
- Az emoji lehet szeretetteljes, ironikus, gúnyos, flörtölős, féltékeny, kínos, passzív-agresszív, döbbent vagy száraz reakció is.
- Ne ismételd folyton ugyanazokat az emojikat.
- Ne legyen minden flört ❤️ vagy 😏, minden nevetés 😂 vagy 😭, minden düh 😡.
- Ne tegyél emojit minden DM-be kötelezően; a cél a természetes változatosság, nem az emoji-spam.
- A karakter saját beszédstílusa, kisbetű/nagybetű használata, szlengje és írásjelei maradjanak felismerhetők.
- A példamondatok csak stílusiránymutatások; ne másold és ne parafrazáld őket.

FONTOS:
Ha senkinek nincs természetes oka reagálni, mindkét lista lehet üres.

Formátum:
{"reacts":[
  {"id":"szereplő azonosítója","emoji":"emoji"}
],
"dms":[
  {"id":"szereplő azonosítója","text":"rövid privát reakció"}
],
"changes":[
  {"a":"aki érez","b":"aki iránt","delta":3,"mood":"mit érez most iránta","why":"egy rövid mondat"}
]}${TAIL}`,
    { maxTokens: 900 }
  );
}

/* Kit szólaltassunk meg magától: akinek erős a viszonya veled, és rég nem szólt. */
/*
 * Spontán privát kezdeményező kiválasztása.
 *
 * FAIR ACTIVITY:
 * minden AI-karakter azonos eséllyel kapjon
 * lehetőséget, és aki régebben írt utoljára,
 * az kerüljön előrébb.
 *
 * A kapcsolat erőssége NEM döntheti el,
 * hogy ugyanaz a néhány karakter legyen
 * folyamatosan aktív.
 */
function pickInitiator(w) {
  const chars = (w.chars || []).filter(
    (c) =>
      c &&
      !isHuman(w, c.id)
  );

  if (!chars.length) return null;

  const pool = chars.map((c) => {
    const msgs =
      w.chats[
        chatKey(w.meId, c.id)
      ] || [];

    let lastOwnDm = 0;

    for (
      let i = msgs.length - 1;
      i >= 0;
      i -= 1
    ) {
      const m = msgs[i];

      if (
        m &&
        m.from === "them"
      ) {
        lastOwnDm =
          Number(m.ts) || 0;
        break;
      }
    }

    return {
      c,
      lastOwnDm,
      tie: Math.random(),
    };
  });

  /*
   * Aki legrégebben kezdeményezett,
   * az kerül előre.
   *
   * Aki még SOHA nem írt magától,
   * annak lastOwnDm = 0, ezért elsőbbséget kap.
   *
   * Ha többen ugyanott állnak,
   * köztük véletlenszerű a sorrend.
   */
  pool.sort((a, b) => {
    if (
      a.lastOwnDm !== b.lastOwnDm
    ) {
      return (
        a.lastOwnDm -
        b.lastOwnDm
      );
    }

    return a.tie - b.tie;
  });

  return pool[0].c;
}

/* Van-e olyan, amit tőled láttak, de még nem reagáltak rá? */
function findUnanswered(w) {
  const posts = (w.posts || []).slice(0, 6);
  for (let i = 0; i < posts.length; i++) {
    const po = posts[i];
    const cs = po.comments || [];
    const last = cs.length ? cs[cs.length - 1] : null;
    if (last && isHuman(w, last.authorId)) return { post: po, comment: last };
    if (isHuman(w, po.authorId) && !cs.some((c) => !isHuman(w, c.authorId))) return { post: po, comment: null };
  }
  return null;
}

/* Egyszerre csak egy lépés fusson: a világba írt időbélyeg a foglalás. */
const canTick = (w, minutes) => now() - (w.autoAt || 0) > Math.max(1, minutes) * 60000;

const SIM_DONE_TTL = 20 * 60000;
const SIM_QUEUE_LIMIT = 40;

function ensureSimState(w) {
  if (!w.sim) w.sim = { queue: [], done: {}, running: "", at: 0 };
  if (!Array.isArray(w.sim.queue)) w.sim.queue = [];
  if (!w.sim.done || typeof w.sim.done !== "object") w.sim.done = {};
  if (typeof w.sim.running !== "string") w.sim.running = "";
  if (!Number.isFinite(Number(w.sim.at))) w.sim.at = 0;
  const cutoff = now() - SIM_DONE_TTL;
  Object.keys(w.sim.done).forEach((k) => {
    if (Number(w.sim.done[k] || 0) < cutoff) delete w.sim.done[k];
  });
  return w.sim;
}

function mkAction(type, key, payload = {}, source = "auto") {
  return { id: uid(), type, key, payload, source, ts: now() };
}

function simEnqueue(w, action) {
  if (!action || !action.key) return false;
  const sim = ensureSimState(w);
  const doneAt = Number(sim.done[action.key] || 0);
  if (doneAt && now() - doneAt < SIM_DONE_TTL) return false;
  if (sim.queue.some((x) => x && x.key === action.key)) return false;
  if (action.source === "manual") {
    sim.queue.unshift(action);
    sim.queue = sim.queue.slice(0, SIM_QUEUE_LIMIT);
  } else {
    sim.queue.push(action);
    sim.queue = sim.queue.slice(-SIM_QUEUE_LIMIT);
  }
  sim.at = now();
  return true;
}

function simPeek(w) {
  const sim = ensureSimState(w);
  return sim.queue.length ? sim.queue[0] : null;
}

function simMarkRunning(w, action) {
  const sim = ensureSimState(w);
  sim.running = action && action.id ? action.id : "";
  sim.at = now();
}

function simDropQueued(w, actionId) {
  const sim = ensureSimState(w);
  sim.queue = sim.queue.filter((x) => x && x.id !== actionId);
  sim.at = now();
}

function simMarkDone(w, action) {
  const sim = ensureSimState(w);
  sim.running = "";
  if (action && action.key) sim.done[action.key] = now();
  sim.at = now();
}
/*
 * FAIR GROUP ACTIVITY
 *
 * Azokat az AI-karaktereket részesíti
 * előnyben, akik az utóbbi időben
 * kevesebbet beszéltek group chatekben.
 */
function fairGroupCast(w, allowedIds = null) {
  const cutoff =
    now() - 48 * 3600e3;

  const allowed =
    Array.isArray(allowedIds)
      ? new Set(allowedIds)
      : null;

  const chars = (w.chars || [])
    .filter(
      (c) =>
        c &&
        !isHuman(w, c.id) &&
        (
          !allowed ||
          allowed.has(c.id)
        )
    )
    .map((c) => {
      let recentGroupMessages = 0;
      let lastGroupMessageAt = 0;

      (w.groups || []).forEach((g) => {
        (g.msgs || []).forEach((m) => {
          if (
            !m ||
            m.from !== c.id
          ) {
            return;
          }

          const ts =
            Number(m.ts) || 0;

          if (ts >= cutoff) {
            recentGroupMessages += 1;
          }

          lastGroupMessageAt =
            Math.max(
              lastGroupMessageAt,
              ts
            );
        });
      });

      return {
        c,
        recentGroupMessages,
        lastGroupMessageAt,
        tie: Math.random(),
      };
    });

  chars.sort((a, b) => {
    if (
      a.recentGroupMessages !==
      b.recentGroupMessages
    ) {
      return (
        a.recentGroupMessages -
        b.recentGroupMessages
      );
    }

    if (
      a.lastGroupMessageAt !==
      b.lastGroupMessageAt
    ) {
      return (
        a.lastGroupMessageAt -
        b.lastGroupMessageAt
      );
    }

    return a.tie - b.tie;
  });

  return chars.map((x) => x.c);
}
async function genAutoGroup(w) {
  const cast = fairGroupCast(w, null).slice(0, 5);

  if (cast.length < 2) {
    return {
      skip: true,
      name: "",
      creator: "",
      members: [],
      messages: [],
      changes: [],
      event: "",
    };
  }

  const existingGroups = (w.groups || [])
    .slice(-8)
    .map((g) => {
      const names = (g.members || [])
        .map((id) => nameOfIn(w, id))
        .filter(Boolean)
        .join(", ");

      return `- ${g.name || "Névtelen csoport"}: ${names || "nincs tag"}`;
    })
    .join("\n");

  const recentPosts = (w.posts || [])
    .slice(0, 5)
    .map((p) => `${nameOfIn(w, p.authorId)}: ${p.text}`)
    .join("\n");

  return askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      cast.map((c) => c.id),
      true,
      null
    )}

A VILÁG MOST MAGÁTÓL ÉL TOVÁBB.

Döntsd el, hogy a szereplők közül valakinek MOST természetes, karakterhű oka van-e új csoportos beszélgetést létrehozni.

LEHETSÉGES SZEREPLŐK:
${cast
  .map((c) => `${c.name} [${c.id}]`)
  .join("\n")}

A játékos:
${w.player.name} [${w.meId}]

FONTOS:
A játékos automatikusan résztvevője lesz a létrehozott group chatnek.
A játékos azonosítóját NE tedd bele a "members" listába.
A "members" listában kizárólag AI-karakterek legyenek.

MÁR LÉTEZŐ CSOPORTOK:
${existingGroups || "még nincs csoport"}

LEGUTÓBBI POSZTOK:
${recentPosts || "még nincs poszt"}

MOSTANI JEGYZETEK:
${notesForAI(w) || "nincs"}

LEGUTÓBBI VILÁGESEMÉNYEK:
${(w.log || []).slice(0, 8).join("\n") || "nincs"}

${cast
  .map((c) => publicVoiceCard(w, c, null))
  .join("")}

${repetitionGuard(
  w,
  cast.map((c) => c.id),
  "autonóm csoportchat"
)}

ÚJ GROUP CHAT SZABÁLYOK:

- NE hozz létre csoportot csak azért, mert technikailag lehet.
- Csak akkor legyen új group chat, ha legalább két AI-karakternek tényleges, jelenlegi és karakterhű oka van rá.
- Az ok következzen a kapcsolatokból, friss eseményekből, posztokból, kommentekből, jegyzetekből, pletykákból, konfliktusokból, tervekből vagy közös ügyekből.
- Az ok lehet teljesen hétköznapi is; nem kell minden új csoport mögé nagy dráma.
- Lehet például buli szervezése, program, pletyka, közös terv, probléma, konfliktus, segítségkérés, meghívás, titkos egyeztetés, közös ügy, közös érdeklődés vagy spontán társas beszélgetés.
- Ne találj ki mesterséges eseményt csak azért, hogy legyen oka a csoportnak.
- Ne hozz létre új csoportot, ha egy már létező group chat lényegében ugyanazokra az emberekre és ugyanarra a témára szolgál.
- Ne készíts újra és újra ugyanolyan összetételű csoportokat.
- Ne legyen minden társas interakcióból új group chat.
- 2-4 AI-karakter legyen a csoportban.
- A "creator" annak a karakternek az azonosítója legyen, aki természetesen létrehozná a csoportot.
- A creator mindig szerepeljen a "members" listában.
- Csak olyan karakter kerüljön be, akit a creator ténylegesen hozzáadna.
- A tagok kapcsolatai is számítsanak: ne rakj össze egymással teljesen irreleváns embereket pusztán a változatosság kedvéért.
- A játékos automatikusan résztvevője lehet a rendszer szerint, de a játékos ne kerüljön az AI "members" listájába, és helyette SOHA ne írj üzenetet.

CSOPORTNÉV:

- Legyen természetes, mintha valódi emberek nevezték volna el.
- A név tükrözheti azt is, KI hozta létre a csoportot.
- Nem kell hivatalosnak vagy szépen megfogalmazottnak lennie.
- Lehet nagyon rövid.
- Lehet vicces.
- Lehet belsős poén.
- Lehet eseménynév.
- Lehet helynév.
- Lehet konkrét tervre utaló név.
- Lehet szándékosan hülye vagy kaotikus, ha a creator ilyen.
- Lehet kisbetűs vagy furcsán központozott, ha ez illik hozzájuk.
- Ritkán emoji is lehet a csoportnévben, ha a creator természetesen így nevezné el.
- Ne legyen minden név generikus, például "Barátok", "Group", "Beszélgetés" vagy "Csapat".
- Ne próbálj minden névből kreatív szóviccet csinálni.
- Egy praktikus, egyszerű név is teljesen természetes lehet.

KEZDŐ ÜZENETEK:

- Adj 2-5 rövid kezdő üzenetet.
- Legalább két különböző AI-tag szólaljon meg a nyitó beszélgetésben.
- Nem kell minden tagnak megszólalnia.
- Ugyanaz a karakter küldhet két egymást követő rövid üzenetet is, ha ez természetes chatritmus.
- Ezek VALÓDI group chat üzenetek, NEM roleplay-jelenetek.
- Úgy hassanak, mintha a tagok ténylegesen telefonról írnának a most létrehozott csoportba.
- A legtöbb üzenet legyen rövid.
- Egyetlen szó is lehet teljes üzenet.
- Egy 1-3 szavas reakció teljesen természetes.
- Lehet félmondat.
- Lehet kérdés.
- Lehet beszólás.
- Lehet poén.
- Lehet pletyka.
- Lehet flört.
- Lehet vita.
- Lehet provokáció.
- Lehet szervezés.
- Lehet száraz reakció.
- Lehet csak egy név vagy @megszólítás.
- Ne próbálj minden üzenetből teljes, szépen lezárt mondatot készíteni.
- Ne írjanak hosszú bekezdéseket.
- Ne írjanak monológokat.
- Ne írjanak regényszerű, költői vagy irodalmi szöveget.
- Ne narráljanak jelenetet.
- Ne írjanak belső gondolatokat.
- Ne használjanak *csillagok közé tett cselekvéseket*.
- Ne magyarázzák el a kapcsolatukat egymással.
- Ne írják le, hogyan néznek, mosolyognak, sóhajtanak vagy mit csinálnak fizikailag.
- Csak azt írják, amit ténylegesen elküldenének a group chatbe.

VALÓDI GROUP CHAT DINAMIKA:

- A karakterek reagáljanak egymás KONKRÉT üzeneteire.
- Ne úgy nézzen ki, mintha mindenki külön válaszolna ugyanarra a láthatatlan kérdésre.
- Egy karakter kijavíthatja a másikat.
- Rávághat valamire.
- Rálicitálhat egy poénra.
- Beszólhat.
- Visszakérdezhet.
- Félbeszakíthatja a témát egy rövid reakcióval.
- @néven megszólíthat valakit.
- Két karakter röviden egymásnak is eshet.
- Valaki reagálhat csak arra, amit az előző tag mondott.
- Nem kell minden üzenetnek új információt tartalmaznia.
- Egy "mi van??", "ne.", "te hülye", "????" jellegű SZERKEZET lehet természetes, de ezeket ne másold sablonként.
- A beszélgetés lehet kissé kaotikus; nem kell tökéletesen rendezettnek lennie.

KARAKTERHŰ ONLINE STÍLUS:

- Minden tag a SAJÁT kommunikációs stílusában írjon.
- Használhatnak kisbetűt, NAGYBETŰT, szlenget, rövidítéseket, internetes nyelvet, elnyújtott szavakat, több kérdőjelet vagy felkiáltójelet, ha ez illik hozzájuk.
- Nem kell mindenkinek ugyanolyan helyesen és rendezett mondatokban írnia.
- Egy szűkszavú karakter maradjon szűkszavú.
- Egy kaotikus karakter lehessen kaotikus.
- Egy száraz karakter írhat minimálisan.
- Egy flörtölős karakter lehet direkt.
- Egy domináns karakter könnyen átveheti a beszélgetés ritmusát.
- Egy visszahúzódó karakter nem köteles mindenre reagálni.
- Már a megfogalmazásból érződjön, KI írta az adott üzenetet.

EMOJI:

- Az emoji-használat legyen ténylegesen jelen a group chatben, HA a résztvevő karakterek között van olyan, aki természetesen használ emojit.
- Ha van ilyen karakter, a 2-5 kezdő üzenet között legalább egy tartalmazzon emojit.
- Általában 1-2 emoji elég egy üzenetben.
- Néha egyetlen emoji is lehet teljes reakció.
- Az emoji lehet a szöveg elején, közepén vagy végén.
- Nem kell mindenkinek emojit használnia.
- Ne kényszeríts emojit olyan karakterre, akinek ez nem illik a stílusához.
- Ritkán több emoji is természetes lehet egy kifejezetten expresszív karakternél.
- Ne használják folyton ugyanazokat.
- Ne legyen minden flört ❤️ vagy 😏.
- Ne legyen minden nevetés 😂 vagy 😭.
- Az emoji típusa igazodjon ahhoz, KI ír, kinek reagál és mi történik éppen.

ISMÉTLÉSVÉDELEM:

- Ne ismételjék korábbi group chat üzeneteiket.
- Ne parafrazálják újra ugyanazt.
- Ne ismételjék ugyanazokat a poénokat.
- Ne ismételjék ugyanazokat a sértéseket.
- Ne ismételjék ugyanazokat a fenyegetéseket.
- Ne ismételjék ugyanazokat a flörtölési formulákat.
- Ne ragadjanak bele ugyanazokba a becenevekbe.
- Ne használják mindig ugyanazokat az emoji-kombinációkat.
- Ne induljon minden új group chat ugyanolyan mondattal.
- A példamondatok és hangminták CSAK stílusiránymutatások.
- SOHA ne másold őket.
- SOHA ne készíts belőlük közeli parafrázist.
- A példákból a karakter ritmusát, szóhasználatát, humorát, közvetlenségét és kommunikációs szokásait tanuld meg.
- Minden konkrét üzenet legyen friss.

LEGFONTOSABB:

A csoport és az első néhány üzenet első pillantásra úgy hasson, mint egy valódi baráti, ellenséges, pletykálkodó vagy praktikus group chat indulása. Ha inkább hangzik előre megírt jelenetnek, regénydialógusnak vagy több AI-karakter egymás mellé rakott mini monológjának, ÍRD ÚJRA rövidebbre, közvetlenebbre és egymásra reagálóbbra.

Ha nincs most valódi oka új csoport létrehozásának:
"skip": true

Ha van:
"skip": false

Formátum:
{"skip":false,
"name":"a csoport neve",
"creator":"a létrehozó karakter azonosítója",
"members":["karakter id","karakter id"],
"messages":[
  {"id":"karakter azonosítója","text":"rövid group chat üzenet"},
  {"id":"karakter azonosítója","text":"rövid válasz"}
],
"changes":[
  {"a":"aki érez","b":"aki iránt","delta":5,"mood":"mit érez most iránta","why":"egy rövid mondat"}
],
"event":"egy rövid mondat arról, miért jött létre a csoport"}${TAIL}`,
    { maxTokens: 1200 }
  );
}

function planAutoAction(view) {
  if (!view || !(view.chars || []).length) return null;

  /*
   * 1. A JÁTÉKOS AKCIÓI MINDIG ELSŐBBSÉGET KAPNAK.
   *
   * Ha a játékos posztolt vagy kommentelt,
   * ne egy háttér-karbantartási feladat
   * fusson le előbb.
   */
  const pending = findUnanswered(view);

  if (pending && pending.comment) {
    return mkAction(
      "reply",
      `reply:${pending.post.id}:${pending.comment.id}`,
      {
        postId: pending.post.id,
        commentId: pending.comment.id,
        rootId:
          pending.comment.parent ||
          pending.comment.id,
      }
    );
  }

  if (pending) {
    return mkAction(
      "comments",
      `comments:${pending.post.id}:${
        (pending.post.comments || []).length
      }`,
      {
        postId: pending.post.id,
      }
    );
  }

  /*
   * 2. A JÁTÉKOS NOTE-JÁRA IS MAGUKTÓL REAGÁLNAK.
   */
  const myNote = noteOf(
    view,
    view.meId
  );

  if (myNote) {
    const reactedBy = new Set(
      myNote.reactedBy || []
    );

    const remainingReactors = (
      view.chars || []
    ).filter(
      (c) =>
        c &&
        !isHuman(view, c.id) &&
        !reactedBy.has(c.id)
    );

    if (
      remainingReactors.length > 0 &&
      now() - (myNote.ts || 0) < NOTE_LIFE
    ) {
      return mkAction(
        "note-react",
        `note-react:${myNote.id}`,
        {
          noteId: myNote.id,
        }
      );
    }
  }

  /*
   * 3. BRIEF KARBANTARTÁS
   *
   * Ez továbbra is fontos,
   * de többé nem blokkolja folyamatosan
   * a valódi közösségi aktivitást.
   */
  const needBrief = [view.player]
    .concat(view.chars || [])
    .filter(
      (c) =>
        c &&
        ["hiányzik", "elavult"].indexOf(
          briefState(c)
        ) >= 0
    )[0];

  if (
    needBrief &&
    Math.random() < 0.12
  ) {
    return mkAction(
      "brief",
      `brief:${needBrief.id}:${rawLen(needBrief)}`,
      {
        id: needBrief.id,
      }
    );
  }

  const roll = Math.random();

  /*
   * 4. AUTONÓM NOTE
   *
   * Ritkább, mint eddig.
   * Ne a note-ok zabálják fel
   * az összes automatikus kört.
   */
  const noteless = (
    view.chars || []
  )
    .filter(
      (c) =>
        c &&
        !isHuman(view, c.id) &&
        !noteOf(view, c.id)
    )
    .map((c) => {
      const previousNotes = (
        view.notes || []
      ).filter(
        (x) =>
          x &&
          x.authorId === c.id
      );

      const lastNoteAt =
        previousNotes.reduce(
          (latest, x) =>
            Math.max(
              latest,
              Number(x.ts) || 0
            ),
          0
        );

      return {
        c,
        lastNoteAt,
        tie: Math.random(),
      };
    })
    .sort((a, b) => {
      if (
        a.lastNoteAt !==
        b.lastNoteAt
      ) {
        return (
          a.lastNoteAt -
          b.lastNoteAt
        );
      }

      return a.tie - b.tie;
    });

  /*
   * Kb. 10% note.
   */
  if (
    roll < 0.10 &&
    noteless.length
  ) {
    const bot =
      noteless[0].c;

    return mkAction(
      "note",
      `note:${bot.id}:${Math.floor(
        now() / 1800000
      )}`,
      {
        botId: bot.id,
      }
    );
  }

  /*
   * 5. LÉTEZŐ GROUP CHATEK
   */
  const existingGroups = (
    view.groups || []
  ).filter((g) => {
    if (
      !g ||
      !g.id ||
      !Array.isArray(g.members)
    ) {
      return false;
    }

    return g.members.some(
      (id) =>
        charById(view, id) &&
        !isHuman(view, id)
    );
  });

  /*
   * Ne pörögjön ugyanaz a group chat
   * folyamatosan.
   */
  const groupTurnCandidates =
    existingGroups.filter((g) => {
      const t =
        Number(g.updatedAt) || 0;

      return (
        !t ||
        now() - t >
          45 * 60 * 1000
      );
    });

  const recentGroup =
    existingGroups.some((g) => {
      const t =
        Number(g.updatedAt) || 0;

      return (
        t > 0 &&
        now() - t <
          8 * 3600e3
      );
    });

  const canTryNewGroup =
    (view.chars || []).length >= 2 &&
    !recentGroup;

  /*
   * 6. GROUP CHAT
   *
   * Kb. 8%.
   * A meglévő csoport előnyt élvez
   * az új létrehozásával szemben.
   */
  if (
    roll >= 0.10 &&
    roll < 0.18
  ) {
    const preferExisting =
      groupTurnCandidates.length > 0 &&
      (
        recentGroup ||
        Math.random() < 0.75
      );

    if (preferExisting) {
      const group =
        groupTurnCandidates[
          Math.floor(
            Math.random() *
              groupTurnCandidates.length
          )
        ];

      return mkAction(
        "group-turn",
        `group-turn:${group.id}:${Math.floor(
          now() / 3600000
        )}`,
        {
          groupId: group.id,
        }
      );
    }

    if (canTryNewGroup) {
      return mkAction(
        "group",
        `group:${Math.floor(
          now() / 21600000
        )}`,
        {}
      );
    }

    if (
      groupTurnCandidates.length
    ) {
      const group =
        groupTurnCandidates[
          Math.floor(
            Math.random() *
              groupTurnCandidates.length
          )
        ];

      return mkAction(
        "group-turn",
        `group-turn:${group.id}:${Math.floor(
          now() / 3600000
        )}`,
        {
          groupId: group.id,
        }
      );
    }
  }

  /*
   * 7. PRIVÁT ÜZENET
   *
   * Kb. 32%.
   *
   * A pickInitiator továbbra is eldönti,
   * kinek van valódi oka írni.
   */
  if (roll < 0.50) {
    const bot =
      pickInitiator(view);

    if (bot) {
      return mkAction(
        "dm",
        `dm:${bot.id}:${Math.floor(
          now() / 300000
        )}`,
        {
          botId: bot.id,
        }
      );
    }
  }

  /*
   * 8. WORLD / FEED
   *
   * A maradék körökben a világ magától
   * posztol és kommentel.
   *
   * Ez most lényegesen gyakoribb,
   * mint korábban.
   */
  return mkAction(
    "world",
    `world:${Math.floor(
      now() / 600000
    )}`
  );
}
async function genAutoGroupTurn(w, group) {
  if (!group) {
    return {
      skip: true,
      replies: [],
      changes: [],
      memories: [],
      event: "",
    };
  }

  /*
 * FAIR EXISTING GROUP ACTIVITY
 *
 * Csak a csoport tényleges AI-tagjai
 * kerülhetnek szóba, de a kevesebbet
 * beszélők előrébb kerülnek.
 */
const members = fairGroupCast(
  w,
  group.members || []
).slice(0, 6);

const memberIds = members.map(
  (c) => c.id
);

  if (!members.length) {
    return {
      skip: true,
      replies: [],
      changes: [],
      memories: [],
      event: "",
    };
  }

  const hist = (group.msgs || [])
    .slice(-20)
    .map((m) => {
      const a =
        m.from === w.meId
          ? w.player
          : charById(w, m.from);

      return `${a ? a.name : "?"}: ${m.text}`;
    })
    .join("\n");

  const recentPosts = (w.posts || [])
    .slice(0, 5)
    .map(
      (p) =>
        `${nameOfIn(w, p.authorId)}: ${p.text}`
    )
    .join("\n");

  return askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      memberIds,
      true,
      null
    )}

A VILÁG MAGÁTÓL ÉL TOVÁBB.

Most egy MÁR LÉTEZŐ csoportos beszélgetést figyelsz.

CSOPORT:
${group.name || "Névtelen csoport"}

AI-TAGOK:
${members
  .map((c) => `${c.name} [${c.id}]`)
  .join("\n")}
  AKTIVITÁSI EGYENSÚLY:
- A fenti AI-tagok aktivitási prioritás szerint vannak sorba rendezve.
- Ha több karakternek egyformán természetes lenne megszólalnia, elsősorban a lista elején álló, mostanában kevésbé aktív karaktert válaszd.
- Ne ugyanazok a karakterek uralják folyamatosan a group chatet.
- Hosszabb távon minden AI-tag kapjon hasonló mennyiségű lehetőséget megszólalni.
- Az aktivitási egyensúly ne írja felül a beszélgetés logikáját: ha egy konkrét kérdést vagy megszólítást egy adott karakternek címeztek, ő válaszolhat.

A játékos:
${w.player.name} [${w.meId}]

FONTOS:
- ${w.player.name} résztvevője lehet a beszélgetésnek, de HELYETTE SOHA NE ÍRJ.
- Csak a fenti AI-tagok küldhetnek most új üzenetet.

EDDIGI CSOPORTCHAT:
${hist || "még nincs üzenet"}

LEGUTÓBBI POSZTOK:
${recentPosts || "még nincs poszt"}

MOSTANI JEGYZETEK:
${notesForAI(w) || "nincs"}

LEGUTÓBBI VILÁGESEMÉNYEK:
${(w.log || []).slice(0, 8).join("\n") || "nincs"}

${members
  .map((c) => publicVoiceCard(w, c, null))
  .join("")}

${repetitionGuard(
  w,
  memberIds,
  `csoportchat: ${group.name || "névtelen"}`
)}

DÖNTSD EL, HOGY A CSOPORTBAN MOST TERMÉSZETESEN FOLYTATÓDNA-E A BESZÉLGETÉS.

- Nem kötelező minden alkalommal megszólalniuk.
- Ha nincs semmi, ami miatt valamelyik tag MOST természetesen írna, legyen "skip": true.
- Ne generálj üzenetet csak azért, mert a rendszer megkérdezte.
- Ne folytasd mesterségesen a beszélgetést, ha az természetesen már elhalt.
- Ha van befejezetlen téma, friss esemény, poszt, komment, jegyzet, pletyka, terv, konfliktus, poén, kérdés vagy más karakterhű indok, folytathatják.
- Egy egészen hétköznapi reakció is elég ok lehet.
- Reagálhatnak egymás korábbi üzeneteire.
- Reagálhatnak a játékos korábbi üzenetére is, de ${w.player.name} HELYETT SOHA NE ÍRJ.
- Reagálhatnak friss posztra, kommentre, jegyzetre vagy világeseményre, ha annak tényleg van köze hozzájuk.
- Természetesen új témába is átcsúszhatnak.
- Ne találj ki indokolatlanul nagy eseményt csak azért, hogy legyen miről beszélni.
- Ne legyen minden spontán group chat folytatás dráma, vita vagy pletyka.
- Lehet teljesen hétköznapi, hülyéskedő vagy jelentéktelen beszélgetés is.

GROUP CHAT STÍLUS:

- Ez VALÓDI csoportos chat, NEM roleplay-jelenet.
- Adj 1-3 új üzenetet.
- Ha 1 üzenet természetesebb, adj csak 1-et.
- Nem kell minden AI-tagnak megszólalnia.
- Ugyanaz a karakter küldhet két egymást követő rövid üzenetet is, ha ez természetes.
- A legtöbb üzenet legyen rövid.
- Egyetlen szó is lehet teljes üzenet.
- Egy 1-3 szavas reakció teljesen természetes.
- Lehet félmondat.
- Lehet rövid kérdés.
- Lehet csak egy név vagy @megszólítás.
- Lehet spontán felkiáltás vagy reakció.
- Ha rövidebben természetesebb, MINDIG a rövidebb változatot válaszd.
- Ne próbálj minden üzenetből teljes, szépen lezárt mondatot készíteni.
- Ne írjanak hosszú bekezdéseket.
- Ne írjanak monológokat.
- Ne írjanak regényszerű, költői vagy irodalmi szöveget.
- Ne narráljanak jelenetet.
- Ne írjanak belső gondolatokat.
- Ne használjanak *csillagok közé tett cselekvéseket*.
- Ne írják le, hogyan néznek, mosolyognak, sóhajtanak vagy mit csinálnak fizikailag.
- Csak azt írják, amit ténylegesen elküldenének a csoportba.

VALÓDI GROUP CHAT DINAMIKA:

- Elsősorban egymás KONKRÉT üzeneteire reagáljanak.
- Ne úgy nézzen ki, mintha minden szereplő külön mini választ adna ugyanarra a témára.
- Az egyik karakter válasza befolyásolhatja a következő karakter üzenetét.
- Félbeszakíthatják egymást.
- Visszakérdezhetnek.
- Ugrathatják egymást.
- Beszólhatnak egymásnak.
- Kijavíthatják egymást.
- Rálicitálhatnak egymás poénjára.
- Egymás ellen fordíthatnak egy megjegyzést.
- Valaki reagálhat mindössze egy rövid közbeszólással.
- Valaki figyelmen kívül hagyhat egy témát és egy másik részletre reagálhat.
- Pletykálhatnak egymásról vagy más szereplőkről.
- Veszekedhetnek.
- Flörtölhetnek.
- Viccelődhetnek.
- Panaszkodhatnak.
- Szervezkedhetnek.
- Provokálhatják egymást.
- Lehet köztük kínos csendet tükröző nagyon rövid reakció is.
- @néven megszólíthatják egymást.
- Nem kell minden üzenetnek új információt tartalmaznia.
- A beszélgetés lehet kissé kaotikus és töredezett.
- Ne rendezd úgy a válaszokat, mintha mindenki szépen kivárná a sorát.

KARAKTERHŰ ONLINE STÍLUS:

- Minden karakter a SAJÁT kommunikációs stílusában írjon.
- Már az üzenet szövegéből is érződjön, KI írta.
- Használhatnak kisbetűt.
- Használhatnak NAGYBETŰT.
- Használhatnak szlenget.
- Használhatnak rövidítéseket.
- Használhatnak internetes nyelvet.
- Lehetnek elnyújtott szavak.
- Lehet több kérdőjel vagy felkiáltójel.
- Lehet minimális központozás.
- Mindez csak akkor, ha illik az adott karakterhez.
- Ne írjon minden karakter ugyanolyan szabályos, steril mondatokban.
- Egy szűkszavú karakter maradjon szűkszavú.
- Egy rideg karakter maradhat száraz és minimális.
- Egy kaotikus karakter írhat impulzívabban.
- Egy flörtölős karakter lehet direkt.
- Egy domináns karakter könnyen átveheti a beszélgetés ritmusát.
- Egy visszahúzódó karakter nem köteles mindenre reagálni.
- Egy online aktív karakter természetesebben használhat internetes kommunikációt.

EMOJI:

- Az emoji-használat legyen TÉNYLEGESEN jelen a group chatben, HA a résztvevők között van olyan karakter, aki természetesen használ emojit.
- Ha az aktuális válaszolók között van emoji-használó karakter, legalább egy generált üzenet tartalmazzon emojit.
- Általában 1-2 emoji elég egy üzenetben.
- Néha egyetlen emoji is lehet teljes reakció.
- Az emoji lehet a szöveg elején, közepén vagy végén.
- Nem kell minden karakternek emojit használnia.
- Nem kell minden group chat körben emojinak lennie, ha egyik természetesen megszólaló karakter sem használna.
- Ne kényszeríts emojit rideg vagy kifejezetten emoji-mentesen kommunikáló karakterre.
- Ritkán több emoji is természetes lehet egy expresszív karakternél.
- Ne használják folyton ugyanazokat.
- Ne legyen minden flört ugyanazzal az emojival.
- Ne legyen minden poén ugyanazzal a nevetős emojival.
- Ne legyen minden konfliktus ugyanazzal a dühös emojival.
- Az emoji típusa igazodjon ahhoz, KI ír, KINEK reagál és milyen hangulatban van.

CHAT-RITMUS:

- Ne legyen minden kör ugyanolyan hosszú.
- Ne legyen minden válasz ugyanolyan hosszú.
- Egy nagyon rövid üzenetet követhet valamivel hosszabb.
- Egy karakter írhat két gyors üzenetet egymás után.
- Nem kell minden új gondolatot teljesen kifejteni.
- Ne próbálják egyetlen körben lezárni az egész beszélgetést.
- Hagyd meg a kimondatlan dolgokat.
- A kapcsolat, humor, feszültség, vonzalom vagy ellenszenv a szóválasztásból érződjön, ne magyarázatból.
- Ha valaki csak egy apró megjegyzésre reagálna, ne csinálj belőle többmondatos választ.

ISMÉTLÉSVÉDELEM:

- Ne ismételjék a saját korábbi mondataikat.
- Ne parafrazálják újra ugyanazt.
- Ne használják folyton ugyanazokat a mondatkezdéseket.
- Ne ismételjék ugyanazokat a poénokat.
- Ne ismételjék ugyanazokat a sértéseket.
- Ne ismételjék ugyanazokat a fenyegetéseket.
- Ne használják minden alkalommal ugyanazt a flörtölési formulát.
- Ne ragadjanak bele ugyanabba a becenévbe.
- Ne ragadjanak bele ugyanabba a reakciótípusba.
- Ne használják mindig ugyanazokat az emoji-kombinációkat.
- Ne térjen vissza minden group chat kör ugyanahhoz a témához, ha az már természetesen lezárult.
- A példamondatok és hangminták CSAK stílusiránymutatások.
- SOHA ne másold őket.
- SOHA ne készíts belőlük közeli parafrázist.
- A példákból a ritmust, szóhasználatot, humort, nyersességet, közvetlenséget és kommunikációs szokásokat tanuld meg.
- A karakter legyen felismerhető, de minden konkrét üzenete legyen friss.

NYELVTAN ÉS NÉZŐPONT:

- Minden karakter magáról E/1-ben beszéljen.
- Egy emberhez E/2-ben beszéljen.
- Több emberhez E/2 többes számban beszéljen.
- Magázás tilos.
- ${w.player.name} helyett SOHA ne írj.
- A természetes internetes nyelv fontosabb, mint a túlságosan formális nyelvtani tökéletesség.

LEGFONTOSABB:

A generált üzenetek első pillantásra úgy hassanak, mintha egy valódi, már létező group chat hirtelen tovább folytatódott volna. Ha inkább úgy néz ki, mint több AI-karakter egymás mellé rakott mini monológja, egy megírt jelenet vagy túl rendezett dialógus, ÍRD ÚJRA rövidebbre, spontánabbra és egymásra reagálóbbra.

Ha most nincs természetes folytatás:
{"skip":true,"replies":[],"changes":[],"memories":[],"event":""}

Ha van természetes folytatás:
{"skip":false,
"replies":[
{"id":"AI-tag azonosítója","text":"természetes rövid group chat üzenet"}
],
"changes":[
{"a":"aki érez","b":"aki iránt","delta":5,"mood":"mit érez most iránta","why":"egy rövid mondat"}
],
"memories":[
{"id":"AI-tag azonosítója","text":"amit ebből érdemes megjegyeznie"}
],
"event":"csak akkor egy rövid mondat, ha a beszélgetésben tényleg történt valami emlékezetes, különben üres"}${TAIL}`,
    { maxTokens: 900 }
  );
}
/* Egy központi szimulációs akció futtatása. Mindig pontosan egy AI-hívás. */
async function runSimulationAction(view, update, action) {
  if (!view || !action) return null;

  if (action.type === "brief") {
    const targetId =
      action.payload && action.payload.id;

    const target = targetId
      ? charById(view, targetId)
      : null;

    if (!target) return null;

    const brief = await genBrief(target);

    if (brief) {
      update((n) => {
        n.autoAt = now();

        const src = rawLen(target);

        if (
          n.players &&
          n.players[target.id]
        ) {
          n.players[target.id] = {
            ...n.players[target.id],
            brief,
            briefSrc: src,
            updatedAt: now(),
          };
        } else {
          const i = (
            n.chars || []
          ).findIndex(
            (x) => x.id === target.id
          );

          if (i >= 0) {
            n.chars[i] = {
              ...n.chars[i],
              brief,
              briefSrc: src,
              updatedAt: now(),
            };
          }
        }
      });

      return "brief";
    }

    return null;
  }

  if (action.type === "reply") {
    const post = (
      view.posts || []
    ).find(
      (p) =>
        p.id ===
        (action.payload &&
          action.payload.postId)
    );

    const comment =
      post &&
      (post.comments || []).find(
        (c) =>
          c.id ===
          (action.payload &&
            action.payload.commentId)
      );

    if (!post || !comment) {
      return null;
    }

    const out = await genReply(
      view,
      post,
      comment
    );

    update((n) => {
      n.autoAt = now();

      applyReplies(
        n,
        post.id,
        action.payload.rootId ||
          comment.id,
        out
      );
    });

    return "reply";
  }

  if (action.type === "comments") {
    const post = (
      view.posts || []
    ).find(
      (p) =>
        p.id ===
        (action.payload &&
          action.payload.postId)
    );

    if (!post) return null;

    const { out, label } =
      await genComments(view, post);

    update((n) => {
      n.autoAt = now();

      applyComments(
        n,
        post.id,
        out,
        label
      );
    });

    return "comments";
  }

  if (action.type === "note-react") {
  const note = (view.notes || []).find(
    (x) =>
      x.id ===
      (action.payload &&
        action.payload.noteId)
  );

  if (
    !note ||
    note.authorId !== view.meId
  ) {
    return null;
  }

  const alreadyReacted = new Set(
    note.reactedBy || []
  );

  const hasSomeoneLeft = (
    view.chars || []
  ).some(
    (c) =>
      c &&
      !isHuman(view, c.id) &&
      !alreadyReacted.has(c.id)
  );

  // Ha már minden AI-karakter reagált erre
  // a konkrét note-ra, nincs több teendő.
  if (!hasSomeoneLeft) {
    return null;
  }

  const out =
    await genNoteReact(view, note);

  update((n) => {
    n.autoAt = now();

    // Az AI-hívás közben a játékos akár
    // törölhette vagy lecserélhette a note-ot.
    // Ilyenkor a régi note-ra már semmit
    // nem szabad elmenteni.
    const liveNote = (
      n.notes || []
    ).find(
      (x) => x.id === note.id
    );

    if (!liveNote) return;

    if (
      !Array.isArray(
        liveNote.reactedBy
      )
    ) {
      liveNote.reactedBy = [];
    }

    const hasReacted = (who) =>
      liveNote.reactedBy.includes(
        who
      );

    const markReacted = (who) => {
      if (
        !liveNote.reactedBy.includes(
          who
        )
      ) {
        liveNote.reactedBy.push(
          who
        );
      }
    };

    /*
     * PRIVÁT VÁLASZOK
     *
     * Ezeket dolgozzuk fel először.
     * Ha az AI ugyanazt a karaktert
     * véletlenül emojihoz ÉS DM-hez is
     * megadná, a privát válasz nyer,
     * és utána már nem kap külön emojit.
     */
    (out.dms || []).forEach(
      (d) => {
        const who = findChar(
          n,
          d &&
            (d.id !== undefined
              ? d.id
              : d.name)
        );

        if (
          !who ||
          isHuman(n, who) ||
          hasReacted(who) ||
          !d.text
        ) {
          return;
        }

        const msg =
          cleanGeneratedUtterance(
            n,
            who,
            d.text,
            280
          );

        if (!msg) return;

        const ck = chatKey(
          view.meId,
          who
        );

        n.chats[ck] = [
          ...(n.chats[ck] || []),
          {
            from: "them",
            text: msg,
            ts: now(),
            language:
              worldLanguage(
                n,
                n.meId
              ),
          },
        ];

        // Ettől kezdve ez a karakter
        // már reagáltnak számít erre
        // a konkrét note ID-ra.
        markReacted(who);

        const a =
          charById(n, who);

        pushNote(
          n,
          view.meId,
          {
            icon: "✉️",
            translationKey:
              "wroteOnYourNote",
            params: {
              name: a
                ? a.name
                : sysTextFor(
                    n,
                    view.meId,
                    "someone"
                  ),
              snippet:
                msg.slice(0, 60),
            },
            text: sysTextFor(
              n,
              view.meId,
              "wroteOnYourNote",
              {
                name: a
                  ? a.name
                  : sysTextFor(
                      n,
                      view.meId,
                      "someone"
                    ),
                snippet:
                  msg.slice(0, 60),
              }
            ),
            link: {
              type: "dm",
              id: who,
            },
          }
        );
      }
    );

    /*
     * EMOJI-REAKCIÓK
     *
     * Csak az kerülhet ide,
     * aki ezen a note-on még
     * semmilyen módon nem reagált.
     */
    (out.reacts || []).forEach(
      (r) => {
        const who = findChar(
          n,
          r &&
            (r.id !== undefined
              ? r.id
              : r.name)
        );

        if (
          !who ||
          isHuman(n, who) ||
          hasReacted(who) ||
          !r.emoji
        ) {
          return;
        }

        const targetNote = (n.notes || []).find(
  (x) => x.id === note.id
);

if (targetNote) {
  targetNote.reacts = [
    ...(targetNote.reacts || []),
    {
      by: who,
      e: String(r.emoji || "❤️"),
    },
  ];
}

        markReacted(who);
      }
    );

    applyChanges(
      n,
      out.changes
    );
  });

  return "note-react";
}

  if (action.type === "note") {
    const bot = charById(
      view,
      action.payload &&
        action.payload.botId
    );

    if (
      !bot ||
      isHuman(view, bot.id) ||
      noteOf(view, bot.id)
    ) {
      return null;
    }

    const out =
      await genNote(view, bot);

    const txt =
      cleanGeneratedUtterance(
        view,
        bot.id,
        out && out.text
          ? String(out.text).trim()
          : "",
        NOTE_MAX
      );

    update((n) => {
      n.autoAt = now();

      if (txt) {
        setNote(
          n,
          bot.id,
          txt
        );
      }
    });

    return "note";
  }

  /* Meglévő group chat spontán folytatása */
  if (action.type === "group-turn") {
    const groupId =
      action.payload &&
      action.payload.groupId;

    const group = (
      view.groups || []
    ).find(
      (g) =>
        g &&
        g.id === groupId
    );

    if (!group) {
      return null;
    }

    const out =
      await genAutoGroupTurn(
        view,
        group
      );

    if (
      !out ||
      out.skip
    ) {
      update((n) => {
        n.autoAt = now();
      });

      return "group-turn";
    }

    const allowedMembers =
      new Set(
        (group.members || [])
          .filter(
            (id) =>
              charById(view, id) &&
              !isHuman(view, id)
          )
      );

    const rows = (
      Array.isArray(out.replies)
        ? out.replies
        : []
    )
      .map((r) => {
        const who = findChar(
          view,
          r &&
            (r.id !== undefined
              ? r.id
              : r.name)
        );

        if (
          !who ||
          isHuman(view, who) ||
          !allowedMembers.has(who) ||
          !r.text
        ) {
          return null;
        }

        const text =
          cleanGeneratedUtterance(
            view,
            who,
            String(r.text),
            280
          );

        if (!text) return null;

        return {
          id: uid(),
          from: who,
          text,
          ts: now(),
        };
      })
      .filter(Boolean)
      .slice(0, 3);

    if (!rows.length) {
      update((n) => {
        n.autoAt = now();
      });

      return "group-turn";
    }

    update((n) => {
      n.autoAt = now();

      const target = (
        n.groups || []
      ).find(
        (g) =>
          g &&
          g.id === groupId
      );

      if (!target) return;

      rows.forEach((row) => {
        const msg = {
          ...row,
          language:
            worldLanguage(
              n,
              n.meId
            ),
        };

        target.msgs = [
          ...(target.msgs || []),
          msg,
        ];

        noteMentions(
          n,
          msg.text,
          msg.from,
          {
            type: "group",
            id: groupId,
          }
        );

        rememberKnowledge(
          n,
          msg.from,
          {
            kind: "conversation",
            source: "group_chat",
            confidence: 1,
            text: sysLangText(
              n,
              msg.from,
              `Csoportüzenetet írtam a(z) ${
                target.name ||
                "Névtelen csoport"
              } csoportban: ${cut(
                msg.text,
                110
              )}`,
              `I wrote in the ${
                target.name ||
                "Unnamed group"
              } group chat: ${cut(
                msg.text,
                110
              )}`
            ),
          }
        );
      });

      target.updatedAt = now();

      applyChanges(
        n,
        out.changes
      );

      applyMemories(
        n,
        out.memories
      );

      if (
        out.event &&
        String(out.event).trim()
      ) {
        n.log = [
          String(
            out.event
          ).trim(),
          ...(n.log || []),
        ].slice(0, 30);
      }
    });

    return "group-turn";
  }

  /* Teljesen új autonóm group chat létrehozása */
  if (action.type === "group") {
    const out =
      await genAutoGroup(view);

    if (
      !out ||
      out.skip
    ) {
      update((n) => {
        n.autoAt = now();
      });

      return "group";
    }

    const memberIds =
      Array.from(
        new Set(
          (
            Array.isArray(
              out.members
            )
              ? out.members
              : []
          )
            .map((raw) =>
              findChar(
                view,
                raw
              )
            )
            .filter(
              (id) =>
                id &&
                !isHuman(
                  view,
                  id
                ) &&
                charById(
                  view,
                  id
                )
            )
        )
      ).slice(0, 4);

    const creator =
      findChar(
        view,
        out.creator
      );

    if (
      memberIds.length < 2 ||
      !creator ||
      isHuman(view, creator) ||
      memberIds.indexOf(
        creator
      ) < 0
    ) {
      update((n) => {
        n.autoAt = now();
      });

      return "group";
    }

    const groupName =
      String(
        out.name || ""
      )
        .trim()
        .slice(0, 70);

    if (!groupName) {
      update((n) => {
        n.autoAt = now();
      });

      return "group";
    }

    const groupId =
      "g" + uid();

    const messages = (
      Array.isArray(
        out.messages
      )
        ? out.messages
        : []
    )
      .map((m) => {
        const who =
          findChar(
            view,
            m &&
              (m.id !== undefined
                ? m.id
                : m.name)
          );

        if (
          !who ||
          isHuman(view, who) ||
          memberIds.indexOf(
            who
          ) < 0 ||
          !m.text
        ) {
          return null;
        }

        const text =
          cleanGeneratedUtterance(
            view,
            who,
            String(m.text),
            280
          );

        if (!text) {
          return null;
        }

        return {
          id: uid(),
          from: who,
          text,
          ts: now(),
          language:
            worldLanguage(
              view,
              view.meId
            ),
        };
      })
      .filter(Boolean)
      .slice(0, 5);

    if (!messages.length) {
      update((n) => {
        n.autoAt = now();
      });

      return "group";
    }

    update((n) => {
      n.autoAt = now();

      const freshGroup = {
        id: groupId,
        name: groupName,
        members: memberIds,
        msgs: messages,
        updatedAt: now(),
      };

      n.groups = [
        ...(n.groups || []),
        freshGroup,
      ];

      messages.forEach(
        (msg) => {
          noteMentions(
            n,
            msg.text,
            msg.from,
            {
              type: "group",
              id: groupId,
            }
          );

          rememberKnowledge(
            n,
            msg.from,
            {
              kind: "conversation",
              source: "group_chat",
              confidence: 1,
              text: sysLangText(
                n,
                msg.from,
                `Csoportüzenetet írtam a(z) ${groupName} csoportban: ${cut(
                  msg.text,
                  110
                )}`,
                `I wrote in the ${groupName} group chat: ${cut(
                  msg.text,
                  110
                )}`
              ),
            }
          );
        }
      );

      rememberKnowledge(
        n,
        creator,
        {
          kind: "event",
          source: "self_action",
          confidence: 1,
          text: sysLangText(
            n,
            creator,
            `Létrehoztam a(z) ${groupName} csoportot.`,
            `I created the ${groupName} group chat.`
          ),
        }
      );

      applyChanges(
        n,
        out.changes
      );

      if (
        out.event &&
        String(out.event).trim()
      ) {
        n.log = [
          String(
            out.event
          ).trim(),
          ...(n.log || []),
        ].slice(0, 30);
      }
    });

    return "group";
  }

  if (action.type === "dm") {
    const bot = charById(
      view,
      action.payload &&
        action.payload.botId
    );

    if (
      !bot ||
      isHuman(view, bot.id)
    ) {
      return null;
    }

    const out =
      await genDM(view, bot);

    const txt =
      cleanGeneratedUtterance(
        view,
        bot.id,
        out && out.text
          ? String(out.text).trim()
          : "",
        280
      );

    update((n) => {
      n.autoAt = now();

      if (
        out.skip ||
        !txt
      ) {
        return;
      }

      const ck = chatKey(
        view.meId,
        bot.id
      );

      n.chats[ck] = [
        ...(n.chats[ck] || []),
        {
          from: "them",
          text: txt,
          ts: now(),
          language:
            worldLanguage(
              n,
              n.meId
            ),
        },
      ];

      applyChanges(
        n,
        [
          {
            a: bot.id,
            b: view.meId,
            delta:
              Number(
                out.delta
              ) || 0,
            mood: out.mood,
            why: out.why,
          },
        ]
      );

      rememberKnowledge(
        n,
        bot.id,
        {
          kind: "conversation",
          source: "direct_chat",
          confidence: 1,
          text: sysLangText(
            n,
            bot.id,
            `Privátban írtam: ${cut(
              txt,
              110
            )}`,
            `I sent a private message: ${cut(
              txt,
              110
            )}`
          ),
        }
      );

      rememberAboutTarget(
        n,
        bot.id,
        view.meId,
        {
          kind: "event",
          source: "direct_chat",
          confidence: 1,
          text: sysLangText(
            n,
            bot.id,
            `${view.player.name} felé kezdeményeztem beszélgetést`,
            `I initiated a conversation with ${view.player.name}`
          ),
        }
      );

      pushNote(
        n,
        view.meId,
        {
          icon: "✉️",
          translationKey:
            "dmFrom",
          params: {
            name: bot.name,
            snippet:
              txt.slice(0, 70),
          },
          text: sysTextFor(
            n,
            view.meId,
            "dmFrom",
            {
              name: bot.name,
              snippet:
                txt.slice(
                  0,
                  70
                ),
            }
          ),
          mood: out.mood
            ? String(out.mood)
            : "",
          link: {
            type: "dm",
            id: bot.id,
          },
        }
      );
    });

    return "dm";
  }

  const out =
    await genWorldStep(
      view,
      action.type !== "world-full"
    );

  update((n) => {
    n.autoAt = now();

    applyWorldStep(
      n,
      out
    );
  });

  return "world";
}
/* ============================================================
   Váz
   ============================================================ */
export default function App() {
  const [world, setWorld] = useState(null);
  const [meId, setMeId] = useState(null);
  const [tab, setTab] = useState("feed");
  const [bootReady, setBootReady] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [err, setErr] = useState("");
  const [media, setMedia] = useState({});
  const wRef = useRef(null);
  const timer = useRef(null);
  const mediaRef = useRef({});
  const mediaTimer = useRef(null);
  const mediaReady = useRef(false);
  const lastSavedContent = useRef("");
  const [showRooms, setShowRooms] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [auto, setAutoCfg] = useState(AUTO_DEFAULT);
  const [autoBusy, setAutoBusy] = useState(false);
  const autoRunning = useRef(false);
  const viewRef = useRef(null);
  const [simPulse, setSimPulse] = useState(0);
  const [flash, setFlash] = useState(null);
  const [jump, setJump] = useState(null);
  const seenNote = useRef(null);
  const flashTimer = useRef(null);
  const [makeWorld, setMakeWorld] = useState(false);
  const [lang, setLangState] = useState("hu");
  const [langReady, setLangReady] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [saveAt, setSaveAt] = useState(0);
  const lastSavedMedia = useRef("");
  wRef.current = world;
  mediaRef.current = media;

  useEffect(() => {
    let alive = true;
    loadLang().then((v) => {
      if (!alive) return;
      setLangState(asLang(v));
      setLangReady(true);
    });
    return () => { alive = false; };
  }, []);
  const changeLang = useCallback((v) => {
    const next = asLang(v);
    saveLang(next);
    setLangState(next);
    setWorld((prev) => {
      if (!prev || !meId) return prev;
      const n = JSON.parse(JSON.stringify(prev));
      if (!n.userSettings) n.userSettings = {};
      n.userSettings[meId] = { ...(n.userSettings[meId] || {}), language: next };
      n.aiLang = next;
      n.rev = (n.rev || 0) + 1;
      return n;
    });
  }, [meId]);
  const tt = useCallback((hu, en) => (lang === "en" ? en : hu), [lang]);
  const langCtxValue = React.useMemo(() => ({ lang, tt }), [lang, tt]);
  useEffect(() => { CURRENT_LANG = lang; }, [lang]);

  useEffect(() => { loadAuto().then(setAutoCfg); }, []);

  useEffect(() => {
    const t = setTimeout(() => setBootReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  const [detail, setDetailState] = useState(DETAIL);
  useEffect(() => { loadDetail().then((v) => { DETAIL = v; setDetailState(v); }); }, []);
  const changeDetail = useCallback((v) => { saveDetail(v); setDetailState(v); }, []);
  const changeAuto = useCallback((patch) => {
    setAutoCfg((prev) => { const next = { ...prev, ...patch }; saveAuto(next); return next; });
  }, []);

  const SESSION = "masvilag:session";

useEffect(() => {
  if (world) return;

  let alive = true;

  (async () => {
    /*
      1. Először megpróbáljuk a szerveres sessiont.
      Ez fog működni telefonon/laptopon és refresh után is,
      miután a világ már PostgreSQL-ben van.
    */
    try {
      const session = await serverSession();

      if (
        alive &&
        session &&
        session.authenticated &&
        session.world &&
        session.meId
      ) {
        const wld = migrate(session.world);
        const id = session.meId;

        if (
          wld &&
          wld.accounts &&
          wld.accounts[id]
        ) {
          const preferred = asLang(
            (wld.userSettings &&
              wld.userSettings[id] &&
              wld.userSettings[id].language) ||
              wld.aiLang ||
              lang
          );

          const settings =
            (wld.userSettings &&
              wld.userSettings[id]) ||
            {};

          setLangState(preferred);
          saveLang(preferred);
          setTab(settings.lastTab || "feed");
          setChatId(settings.lastChatId || null);

          setWorld(wld);
          setMeId(id);

          lastSavedContent.current = contentOf(wld);
          setSaveState("saved");
          setSaveAt(now());

          return;
        }
      }
    } catch (e) {
      /*
        Nincs még szerveres session / a világ még nincs migrálva.
        Ez az átállás alatt teljesen normális.
      */
    }

    /*
      2. Fallback: a mostani böngészős mentésed.
      Ezt egyelőre megtartjuk, nehogy a jelenlegi világod
      eltűnjön az adatbázisra költözés előtt.
    */
    if (!hasStore || !alive) return;

    try {
      const r = await window.storage.get(
        SESSION,
        false
      );

      if (!r || !alive) return;

      const sess = JSON.parse(r.value);

      if (
        !sess ||
        !sess.code ||
        !sess.meId
      ) return;

      const wld = await loadWorld(sess.code);

      if (
        !alive ||
        !wld ||
        !wld.accounts ||
        !wld.accounts[sess.meId]
      ) return;

      const preferred = asLang(
        (wld.userSettings &&
          wld.userSettings[sess.meId] &&
          wld.userSettings[sess.meId].language) ||
          lang
      );

      const settings =
        (wld.userSettings &&
          wld.userSettings[sess.meId]) ||
        {};

      setLangState(preferred);
      saveLang(preferred);
      setTab(settings.lastTab || "feed");
      setChatId(settings.lastChatId || null);

      setWorld(wld);
      setMeId(sess.meId);
    } catch (e) {
      /* nincs helyi munkamenet sem */
    }
  })();

  return () => {
    alive = false;
  };
}, [world, lang]);
  const [prefill, setPrefill] = useState("");

  const signIn = useCallback((wld, id) => {
    const preferred = asLang((wld.userSettings && wld.userSettings[id] && wld.userSettings[id].language) || (wld.aiLang || lang));
    saveLang(preferred);
    setLangState(preferred);
    if (!wld.userSettings) wld.userSettings = {};
    wld.userSettings[id] = { ...(wld.userSettings[id] || {}), language: preferred };
    wld.aiLang = preferred;
    const settings = wld.userSettings[id] || {};
    setWorld(wld); setMeId(id); setTab(settings.lastTab || "feed"); setChatId(settings.lastChatId || null);
    setShowRooms(false); setMakeWorld(false); setShowNotes(false); setJump(null);
    const mine0 = (wld.notify && wld.notify[id]) || [];
    seenNote.current = mine0.length ? mine0[0].id : "";
    lastSavedContent.current = contentOf(wld);
    lastSavedMedia.current = "";
    setSaveState("saved");
    setSaveAt(now());
    if (hasStore) { try { window.storage.set(SESSION, JSON.stringify({ code: wld.code, meId: id }), false); } catch (e) {} }
    addToIndex(wld, id);
    setPrefill("");
    const acc = (wld.accounts || {})[id];
    rememberRoom({
      code: wld.code, meId: id,
      username: acc ? acc.username : "",
      name: wld.universe ? wld.universe.name : wld.code,
      owner: wld.owner === id,
    });
  }, [lang]);

 const deleteOwnAccount = useCallback(async () => {
  const current = wRef.current;
  const id = meId;

  if (!current || !id) return;

  /*
    Leállítjuk a függőben lévő autosave-et.
    Account törlés közben semmi ne tudjon visszamenteni
    egy régebbi állapotot.
  */
  if (timer.current) {
    clearTimeout(timer.current);
  }

  if (mediaTimer.current) {
    clearTimeout(mediaTimer.current);
  }

  try {
    setSaveState("saving");
    setErr("");

    /*
      1. A VALÓDI törlés a szerveren történik.
      Ez törli az accountot PostgreSQL-ből és az összes
      hozzá tartozó szerveres sessiont.
    */
    await serverDeleteAccount();

    /*
      2. A helyi példányból is kivesszük az accountot,
      hogy az IndexedDB backup se tartalmazzon egy
      "feltámasztható" régi felhasználót.
    */
    const next = JSON.parse(
      JSON.stringify(current)
    );

    if (!next.deleted) {
      next.deleted = {};
    }

    next.deleted[id] = now();

    if (next.accounts) {
      delete next.accounts[id];
    }

    if (next.players) {
      delete next.players[id];
    }

    if (next.userSettings) {
      delete next.userSettings[id];
    }

    if (next.notify) {
      delete next.notify[id];
    }

    if (next.mems) {
      delete next.mems[id];
    }

    if (next.charMemory) {
      delete next.charMemory[id];
    }

    if (next.owner === id) {
      next.owner =
        Object.keys(next.accounts || {})[0] || "";
    }

    next.rev = Number(next.rev || 0) + 1;

    /*
      Ezt CSAK helyi backupként mentjük.
      A szerveres törlést már az /account/delete
      biztonságosan elvégezte.
    */
    try {
      await saveWorldMerged(next);
    } catch (e) {}

    /*
      3. Régi helyi automatikus login törlése.
    */
    if (hasStore) {
      try {
        await window.storage.delete(
          SESSION,
          false
        );
      } catch (e) {}
    }

    /*
      A login képernyő se emlékezzen erre
      az account/world kombinációra.
    */
    try {
      await forgetRoom(current.code);
    } catch (e) {}

    /*
      4. Kliens teljes kijelentkeztetése.
      FONTOS: nem hívjuk a signOut()-ot,
      mert az mentést próbálna végezni.
    */
    wRef.current = null;
    mediaRef.current = {};

    setWorld(null);
    setMeId(null);
    setMedia({});
    setPrefill("");

    mediaReady.current = false;

    setSaveState("saved");
  } catch (e) {
    setSaveState("error");

    setErr(
      (e && e.message) ||
        tt(
          "A fiók törlése nem sikerült.",
          "Account deletion failed."
        )
    );
  }
}, [meId, tt]);
const signOut = useCallback(async () => {
  const w = wRef.current;

  /*
    Először leállítjuk az esetleg még várakozó autosave-et,
    nehogy kijelentkezés után próbáljon menteni.
  */
  if (timer.current) {
    clearTimeout(timer.current);
  }

  if (mediaTimer.current) {
    clearTimeout(mediaTimer.current);
  }

  /*
    Kijelentkezés előtt még egyszer biztosan elmentjük
    a jelenlegi világot helyben ÉS PostgreSQL-be.
  */
  if (w) {
    try {
      await saveWorldMerged(w);
    } catch (e) {
      // A helyi mentési hiba ne akadályozza a kijelentkezést.
    }

    try {
      await serverSaveWorld(w);
    } catch (e) {
      // Ha a szerveres mentés éppen nem sikerül,
      // a helyi backup továbbra is megmarad.
    }

    if (w.code) {
      try {
        await saveMedia(
          w.code,
          mediaRef.current || {}
        );
      } catch (e) {
        // A média mentési hiba se akadályozza a logoutot.
      }
    }
  }

  /*
    A PostgreSQL-ben tárolt sessiont is töröljük,
    és a szerver eltávolítja a HttpOnly cookie-t.
  */
  try {
    await serverLogout();
  } catch (e) {
    // Ettől még helyben kijelentkeztetjük.
  }

  /*
    A régi helyi sessiont is töröljük.
  */
  if (hasStore) {
    try {
      await window.storage.delete(
        SESSION,
        false
      );
    } catch (e) {}
  }

  /*
    Kijelentkeztetett kliensállapot.
  */
  wRef.current = null;
  mediaRef.current = {};

  setWorld(null);
  setMeId(null);
  setMedia({});

  mediaReady.current = false;
  setSaveState("saved");
}, []);


  const code = world ? world.code : null;

  const addImage = useCallback((dataUrl, meta = {}) => {
    const cur = mediaRef.current;
    if (mediaBytes(cur) + dataUrl.length > MEDIA_CAP) return null;
    const id = uid();
    const nowTs = now();
    const ext = String((meta.mimeType || "image/jpeg").split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
    const nextMedia = {
      ...cur,
      [id]: {
        id,
        storagePath: `users/${meId || "guest"}/worlds/${code || "local"}/images/${id}.${ext}`,
        originalFileName: meta.originalFileName || `image-${id}.${ext}`,
        mimeType: meta.mimeType || "image/jpeg",
        size: Number(meta.size || dataUrl.length),
        category: meta.category || "other",
        status: "active",
        createdAt: nowTs,
        updatedAt: nowTs,
        deletedAt: null,
        ownerUserId: meId || "",
        ownerCharacterId: meta.ownerCharacterId || "",
        dataUrl,
      },
    };
    setMedia(nextMedia);
    mediaRef.current = nextMedia;
    setWorld((prev) => {
      if (!prev) return prev;
      const n = JSON.parse(JSON.stringify(prev));
      registerImageMeta(n, id, nextMedia[id]);
      n.rev = (n.rev || 0) + 1;
      return n;
    });
    if (code) {
      void saveMedia(code, nextMedia).catch(() => {});
    }
    return imageRef(id);
  }, [code, meId]);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    mediaReady.current = false;
    loadMedia(code).then((m) => {
      if (alive) {
        const loaded = m || {};
        setMedia(loaded);
        mediaRef.current = loaded;
        lastSavedMedia.current = JSON.stringify(loaded);
        mediaReady.current = true;
      }
    });
    return () => { alive = false; };
  }, [code]);

  useEffect(() => {
    if (!world || !code || !mediaReady.current) return;
    const normalized = normalizeWorldImages(world, mediaRef.current || {});
    if (!normalized.changed) return;
    mediaRef.current = normalized.media;
    setMedia(normalized.media);
    lastSavedMedia.current = JSON.stringify(normalized.media);
    setWorld(normalized.world);
  }, [world ? world.code : null, world ? world.rev : 0, code, media]);

  useEffect(() => {
    const onOnline = () => {
      const w = wRef.current;
      if (!w || !w.code) return;
      setSaveState("retry");
      void (async () => {
        const result = await saveWorldMerged(w);
        const mediaOk = await saveMedia(w.code, mediaRef.current || {});
        if (result && result.mode === "cloud" && mediaOk) {
          lastSavedContent.current = contentOf(result.world);
          lastSavedMedia.current = JSON.stringify(mediaRef.current || {});
          setSaveState("saved");
          setSaveAt(now());
          if (EditLock.n === 0 && contentOf(result.world) !== contentOf(wRef.current || {})) setWorld(result.world);
        } else {
          setSaveState((typeof navigator !== "undefined" && navigator.onLine === false) ? "local" : "error");
        }
      })();
    };
    const onPageHide = () => {
      const w = wRef.current;
      if (!w || !w.code) return;
      void writeWorldSnapshot(w.code, w, false);
      void writeBigScoped(MKEY(w.code), JSON.stringify(mediaRef.current || {}), false);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
      window.addEventListener("pagehide", onPageHide);
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("pagehide", onPageHide);
      };
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!code || !mediaReady.current) return;
    if (mediaTimer.current) clearTimeout(mediaTimer.current);
    const snap = media;
    const mediaJson = JSON.stringify(snap || {});
    if (mediaJson === lastSavedMedia.current) return;
    setSaveState(typeof navigator !== "undefined" && navigator.onLine === false ? "local" : "saving");
    mediaTimer.current = setTimeout(async () => {
      // csendben újrapróbálkozunk; csak akkor szólunk, ha végleg nem megy
      for (let i = 0; i < 3; i++) {
        if (await saveMedia(code, snap)) {
          lastSavedMedia.current = mediaJson;
          setSaveState("saved");
          setSaveAt(now());
          return;
        }
        await wait(1200 * (i + 1));
      }
      setSaveState((typeof navigator !== "undefined" && navigator.onLine === false) ? "local" : "retry");
      setErr(tt("A képeket most nem sikerült elmenteni. A Világ fülön ments biztonsági mentést, hogy semmi ne vesszen el.",
            "Couldn't save images right now. Create a backup from the World tab so nothing gets lost."));
    }, 1500);
    return () => mediaTimer.current && clearTimeout(mediaTimer.current);
  }, [media, code]);

  const update = useCallback((fn) => {
    setWorld((prev) => {
      if (!prev) return prev;
      const n = JSON.parse(JSON.stringify(prev));
      fn(n);
      n.rev = (n.rev || 0) + 1;
      return n;
    });
  }, []);

  const requestSimulationAction = useCallback((action) => {
    if (!action) return false;
    update((n) => { simEnqueue(n, action); });
    setSimPulse((x) => x + 1);
    return true;
  }, [update]);

  const requestWorldStep = useCallback(() => {
    const key = `manual-world:${now()}:${uid()}`;
    return requestSimulationAction(mkAction("world-full", key, {}, "manual"));
  }, [requestSimulationAction]);

  const requestNoteReactions = useCallback((noteId) => {
    if (!noteId) return false;
    return requestSimulationAction(mkAction("note-react", `manual-note-react:${noteId}`, { noteId }, "manual"));
  }, [requestSimulationAction]);

  const signalSimulation = useCallback((event) => {
    if (!event || !event.type) return false;
    if (event.type === "player-post" && event.postId) {
      return requestSimulationAction(mkAction("comments", `event-post:${event.postId}`, { postId: event.postId }, "event"));
    }
    if (event.type === "player-note" && event.noteId) {
      return requestSimulationAction(mkAction("note-react", `event-note:${event.noteId}`, { noteId: event.noteId }, "event"));
    }
    return false;
  }, [requestSimulationAction]);

  useEffect(() => {
    if (!world || !meId) return;
    setWorld((prev) => {
      if (!prev || !prev.userSettings || !prev.userSettings[meId]) return prev;
      const cur = prev.userSettings[meId] || {};
      const nextTab = tab || "feed";
      const nextChat = chatId || "";
      if ((cur.lastTab || "feed") === nextTab && (cur.lastChatId || "") === nextChat) return prev;
      const n = JSON.parse(JSON.stringify(prev));
      if (!n.userSettings) n.userSettings = {};
      n.userSettings[meId] = { ...(n.userSettings[meId] || {}), lastTab: nextTab, lastChatId: nextChat };
      n.rev = (n.rev || 0) + 1;
      return n;
    });
  }, [world ? world.code : null, meId, tab, chatId]);

  useEffect(() => {
  if (!world) return;

  const json = contentOf(world);

  if (json === lastSavedContent.current) return;

  if (timer.current) {
    clearTimeout(timer.current);
  }

  const snap = world;

  const offline =
    typeof navigator !== "undefined" &&
    navigator.onLine === false;

  setSaveState(
    offline ? "local" : "saving"
  );

  timer.current = setTimeout(async () => {
    /*
      1. Mindig készítünk helyi biztonsági mentést is.
      Így egy pillanatnyi szerverhiba miatt nem veszhet el,
      amit éppen csináltál.
    */
    let localResult = null;

    try {
      localResult = await saveWorldMerged(snap);
    } catch (e) {
      localResult = null;
    }

    /*
      Ha nincs internet, itt megállunk.
      A helyi példány megvan, később újrapróbáljuk a szervert.
    */
    if (
      typeof navigator !== "undefined" &&
      navigator.onLine === false
    ) {
      if (localResult && localResult.world) {
        lastSavedContent.current =
          contentOf(localResult.world);

        setSaveState("local");
        setSaveAt(now());
      }

      return;
    }

    /*
      2. PostgreSQL autosave.
      Ezt legfeljebb háromszor próbáljuk meg.
    */
    let serverResult = null;
    let lastError = null;

    for (
      let i = 0;
      i < 3 && !serverResult;
      i++
    ) {
      try {
        const saved =
          await serverSaveWorld(snap);

        if (saved && saved.world) {
          serverResult = saved;
          break;
        }
      } catch (e) {
        lastError = e;

        /*
          Lejárt / érvénytelen session esetén
          nincs értelme háromszor ugyanazt próbálni.
        */
        if (e && e.status === 401) {
          break;
        }

        await wait(1000 * (i + 1));
      }
    }

    /*
      A helyi backup megvan, de a szerveres mentés nem.
    */
    if (!serverResult) {
      if (localResult && localResult.world) {
        lastSavedContent.current =
          contentOf(localResult.world);

        setSaveAt(now());
      }

      setSaveState("error");

      if (
        lastError &&
        lastError.status === 401
      ) {
        setErr(
          tt(
            "A szerveres munkameneted lejárt. Jelentkezz be újra; a helyi mentésed megmaradt.",
            "Your server session expired. Log in again; your local save is still safe."
          )
        );
      } else {
        setErr(
          tt(
            "A felhőmentés most nem sikerült. A helyi mentésed megmaradt, és újra fogjuk próbálni.",
            "Cloud saving failed for now. Your local save is safe and we'll retry."
          )
        );
      }

      return;
    }

    /*
      3. Sikeres PostgreSQL mentés.
    */
    const savedWorld = migrate(
      serverResult.world
    );

    lastSavedContent.current =
      contentOf(savedWorld);

    setSaveState("saved");
    setSaveAt(now());

    /*
      A szerver esetleg növelte a rev-et vagy
      normalizált valamit. Csak akkor frissítjük
      a React state-et, ha ténylegesen különbözik.
    */
    if (EditLock.n === 0) {
  setWorld((current) => {
    if (!current) return current;

    /*
      Fontos: az autosave egy korábbi world snapshotot mentett.
      Ha közben történt új változás — például megérkezett egy
      chatválasz — a régi szerverválasz SOHA ne írja felül.
    */
    if (contentOf(current) !== json) {
      return current;
    }

    /*
      Ha a szerver pontosan ugyanazt adta vissza,
      nincs szükség state-cserére.
    */
    if (contentOf(savedWorld) === json) {
      return current;
    }

    return savedWorld;
  });
}
  }, 800);

  return () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
  };
}, [world]);
  const myNotes = (world && meId && world.notify && world.notify[meId]) || [];
  const unread = myNotes.filter((x) => !x.read).length;
  const topNoteId = myNotes.length ? myNotes[0].id : "";
  const saveLabel = saveState === "saving"
    ? tt("Mentés…", "Saving…")
    : saveState === "saved"
      ? tt("Minden változtatás elmentve", "All changes saved")
      : saveState === "local"
        ? tt("Offline – helyi mentés készült", "Offline – saved locally")
        : saveState === "retry"
          ? tt("Újrapróbálkozás…", "Retrying…")
          : tt("A mentés sikertelen", "Save failed");

  useEffect(() => {
    if (!world || !meId || !topNoteId) return;
    if (seenNote.current === null) { seenNote.current = topNoteId; return; }
    if (topNoteId === seenNote.current) return;
    seenNote.current = topNoteId;
    const top = myNotes[0];
    if (top.read) return;
    setFlash(top);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 6000);
  }, [topNoteId, world, meId]);

  /* Központi szimulációs engine: queue-t és automata lépéseket is ugyanúgy futtat.
     Egy körben mindig pontosan egy AI-hívás megy. */
  useEffect(() => {
    if (!langReady || !world || !meId) return;
    let alive = true;
    const beat = async () => {
  if (!alive || autoRunning.current) return;

  const view2 = viewRef.current;
  if (!view2 || !(view2.chars || []).length) return;

  const queued = simPeek(view2);
  const manualQueued = !!(queued && queued.source === "manual");

  // A kézzel kért művelet mindig fusson le.
  // A háttér-automatizmust továbbra is visszafoghatja cooldown,
  // nyitott szerkesztő vagy háttérbe tett böngészőfül.
  if (!manualQueued && EditLock.n > 0) return;
  if (!manualQueued && cooldownLeft() > 0) return;
  if (!manualQueued && typeof document !== "undefined" && document.hidden) return;

  let action = queued;
      if (!action) {
        if (!auto.on || !canTick(view2, auto.every)) return;
        action = planAutoAction(view2);
      }
      if (!action) return;

      autoRunning.current = true;
      setAutoBusy(true);
      update((n) => {
        n.autoAt = now();
        simMarkRunning(n, action);
      });
      let ok = false;
      try {
        await runSimulationAction(viewRef.current, update, action);
        ok = true;
      } catch (e) {
        if (action && action.source === "manual" && alive) {
          setErr((e && e.message) ? e.message : tt("Az AI-kérés nem sikerült.", "AI request failed."));
        }
      }
      update((n) => {
        if (queued) simDropQueued(n, action.id);
        if (ok) simMarkDone(n, action);
        else ensureSimState(n).running = "";
      });
      autoRunning.current = false;
      if (alive) setAutoBusy(false);
    };
    const i = setInterval(beat, 30000);
    const first = setTimeout(beat, 100);
    return () => { alive = false; clearInterval(i); clearTimeout(first); };
  }, [langReady, world ? world.code : null, meId, auto.on, auto.every, update, simPulse]);

  useEffect(() => { if (err) { const t = setTimeout(() => setErr(""), 9000); return () => clearTimeout(t); } }, [err]);

  if (!bootReady) {
    return (
      <LangCtx.Provider value={langCtxValue}>
      <div className="mv">
        <style>{CSS}</style>
        <div className="mv-wrap" style={{ justifyContent: "center", padding: "0 18px", overflowY: "auto" }}>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <div className="mark" style={{ fontSize: 36 }}>más<i>világ</i></div>
            <p className="hint" style={{ marginTop: 10 }}>{tt("Betöltés…", "Loading\u2026")}</p>
          </div>
        </div>
      </div>
      </LangCtx.Provider>
    );
  }

  if (!world || !meId) {
    return (
      <LangCtx.Provider value={langCtxValue}>
      <div className="mv">
        <style>{CSS}</style>
        <Boot onReady={signIn} prefill={prefill} lang={lang} onLang={changeLang} bootErr={err} />
      </div>
      </LangCtx.Provider>
    );
  }

  const me = (world.players && world.players[meId]) || blankPlayer(meId, "Névtelen", "jatekos");
  const view = { ...world, meId, player: me };
  viewRef.current = view;

  const TABS = [["feed", tt("Feed", "Feed"), Home], ["cast", tt("Karakterek", "Characters"), Users], ["bonds", tt("Kapcsolat", "Bonds"), Network],
    ["scene", tt("Jelenet", "Scene"), Film], ["chat", tt("Üzenetek", "Messages"), MessageCircle], ["world", tt("Világ", "World"), Globe2]];

  const markRead = (id) => update((n) => {
    const list = (n.notify && n.notify[meId]) || [];
    if (!n.notify) n.notify = {};
    n.notify[meId] = list.map((x) => (!id || x.id === id ? { ...x, read: true } : x));
  });

  /* Értesítésre koppintva odaugrunk, ahol történt. */
  const openNote = (note) => {
    markRead(note.id);
    setShowNotes(false);
    setFlash(null);
    const link = note.link;
    if (!link || !link.id) return;
    if (link.type === "post") setTab("feed");
    else if (link.type === "char") setTab("cast");
    else if (link.type === "group") setTab("chat");
    else if (link.type === "scene") setTab("scene");
    else if (link.type === "dm") { setChatId(link.id); setTab("chat"); }
    setJump({ ...link, n: now() });
  };



  return (
    <LangCtx.Provider value={langCtxValue}>
    <MediaCtx.Provider value={{ media, addImage }}>
    <div className="mv">
      <style>{CSS}</style>
      <div className="mv-wrap">
        <div className="hdr">
          <div className="hdr-row">
            <div style={{ minWidth: 0 }}>
              <div className="mark">más<i>világ</i></div>
              <div className="hdr-meta">{world.universe.name} · <span className="mono">{world.code}</span> · <span className="mono">@{me.username}</span></div>
              <div className="hint" style={{ marginTop: 4 }}>{saveLabel}{saveAt ? ` · ${timeAgo(saveAt)}` : ""}</div>
            </div>
            <button className="btn tiny ghost" onClick={() => changeAuto({ on: !auto.on })}
              title={auto.on ? tt("Élő világ: magától történnek dolgok", "Live world: things happen on their own") : tt("Élő világ kikapcsolva", "Live world off")}
              style={{ color: auto.on ? "var(--rose)" : "var(--muted)" }}>
              {autoBusy ? <Loader2 size={13} className="spin" />
                        : <span className="dot" style={{ background: auto.on ? "var(--rose)" : "var(--muted)", animation: auto.on ? undefined : "none" }} />}
            </button>
            <button className="btn tiny ghost" style={{ position: "relative" }} onClick={() => setShowNotes(true)} title={tt("Értesítések", "Notifications")}>
              <Bell size={15} color={unread ? "var(--rose)" : undefined} />
              {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
            </button>
          </div>
          {world.log.length > 0 && (
            <div className="ticker">
              <span className="ticker-tag"><span className="dot" /> {tt("ÉLŐ", "LIVE")}</span>
              <div className="ticker-track"><span>{world.log.slice(0, 8).join("   ·   ")}</span></div>
            </div>
          )}
        </div>

        <div className="mv-main">
          {tab === "feed" && <Feed w={view} update={update} setErr={setErr} jump={jump} autoOn={auto.on}
            onOpenChat={(id) => { setChatId(id); setTab("chat"); }}
            onRequestWorldStep={requestWorldStep}
            onRequestNoteReactions={requestNoteReactions}
            onSignal={signalSimulation} />}
          {tab === "cast" && <Cast w={view} update={update} setErr={setErr} jump={jump} goChat={(id) => { setChatId(id); setTab("chat"); }} />}
          {tab === "bonds" && <Bonds w={view} update={update} setErr={setErr} />}
          {tab === "scene" && <Scenes w={view} update={update} setErr={setErr} jump={jump} />}
          {tab === "chat" && <Chat w={view} update={update} setErr={setErr} openId={chatId} setOpenId={setChatId} jump={jump} />}
          {tab === "world" && <World
  w={view}
  update={update}
  setErr={setErr}
 
  onLeave={signOut}
  onDeleteAccount={deleteOwnAccount}
            onRooms={() => setShowRooms(true)} auto={auto} onAuto={changeAuto}
            detail={detail} onDetail={changeDetail} onLang={changeLang} />}
        </div>
      </div>

      {showNotes && (
        <Alerts w={view} onClose={() => { setShowNotes(false); markRead(null); }} onOpen={openNote}
          onClear={() => { update((n) => { if (n.notify) n.notify[meId] = []; }); setShowNotes(false); }} />
      )}

      {flash && !showNotes && (
        <div className="flash" onClick={() => openNote(flash)}>
          <span className="note-ico">{flash.icon || "✨"}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div>{renderNoteText(view, meId, flash)}</div>
            {flash.mood ? <div className="hint" style={{ marginTop: 2 }}>{tt("Most ezt érzi: ", "Right now they feel: ")}{flash.mood}</div> : null}
          </div>
          <button style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0 }}
            onClick={(e) => { e.stopPropagation(); setFlash(null); }}><X size={14} /></button>
        </div>
      )}

      {showRooms && (
        <Rooms w={world} setErr={setErr} onClose={() => setShowRooms(false)} onOpen={signIn}
          onSignOut={() => { setShowRooms(false); signOut(); }}
          onNeedLogin={(code2) => { setShowRooms(false); setPrefill(code2); signOut(); }}
          onCreate={() => { setShowRooms(false); setMakeWorld(true); }} />
      )}

      {makeWorld && (
        <NewWorld w={view} setErr={setErr} onClose={() => setMakeWorld(false)} onReady={signIn} />
      )}

      <RestBar />

      {err && (
        <div className="toast">
          <span>{err}</span>
          <button onClick={() => setErr("")}><X size={14} /></button>
        </div>
      )}

      <div className="nav">
        <div className="nav-in">
          {TABS.map(([k, label, Icon]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              <Icon size={19} /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
    </MediaCtx.Provider>
    </LangCtx.Provider>
  );
}
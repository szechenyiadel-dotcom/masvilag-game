import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Users, MessageCircle, Globe2, Send, Sparkles, Plus, RefreshCcw,
  X, Trash2, ChevronLeft, ChevronRight, Loader2, Heart, Lock, Zap, Pencil,
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



/* ---------- SAJÁT SOCIAL NETWORK PROFIL ---------- */
.social-profile {
  overflow: hidden;
  padding: 0;
}

.social-cover {
  height: 140px;
  position: relative;
  z-index: 0;
  overflow: hidden;
  border-bottom: 1px solid var(--line);
  background: var(--raised);
}

.social-cover-img {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.social-cover:after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent 58%,
    rgba(10, 9, 16, .18)
  );
}

.social-profile-main {
  position: relative;
  z-index: 2;
  padding: 0 16px 16px;
}

.social-profile-top {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;

  /*
   * Facebook-szerű átfedés:
   * a profilkép kerül a borítókép FÖLÉ,
   * nem a borító takarja a profilképet.
   */
  margin-top: -42px;
}

.social-profile-avatar {
  position: relative;
  z-index: 4;
  width: 82px;
  height: 82px;
  border-radius: 24px;
  border: 4px solid var(--surface);
  background: var(--surface);
  overflow: hidden;
  flex: none;
  display: grid;
  place-items: center;
  box-shadow: 0 5px 18px rgba(0,0,0,.35);
}

.social-profile-avatar .av {
  width: 100% !important;
  height: 100% !important;
  border-radius: 20px !important;
}

.social-profile-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.social-profile-name {
  margin-top: 10px;
}

.social-profile-meta {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 5px;
  font-size: 12px;
  color: var(--muted);
}

.social-profile-stats {
  display: flex;
  align-items: stretch;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  margin-top: 14px;
}

.social-profile-stat {
  flex: 1;
  min-width: 0;
  padding: 10px 5px;
  text-align: center;
}

.social-profile-stat + .social-profile-stat {
  border-left: 1px solid var(--line);
}

.social-profile-stat strong {
  display: block;
  font-size: 14px;
  color: var(--bone);
}

.social-profile-stat span {
  display: block;
  margin-top: 1px;
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--muted);
}

.social-following {
  border-color: var(--rose) !important;
  color: var(--rose) !important;
}

.social-count {
  color: var(--muted);
  font-size: 11.5px;
}

.social-edit-box {
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
}



/* A kattintható profilképek/nevek valódi linkként viselkednek,
   de NEM kapják meg a böngésző alap fehér button-stílusát. */
.social-author-click {
  -webkit-appearance: none !important;
  appearance: none !important;
  border: 0 !important;
  outline: 0 !important;
  background: transparent !important;
  color: inherit !important;
  font: inherit !important;
  line-height: inherit !important;
  letter-spacing: inherit !important;
  padding: 0 !important;
  margin: 0 !important;
  box-shadow: none !important;
  cursor: pointer;
  text-align: inherit;
  vertical-align: middle;
}

.social-author-click:hover,
.social-author-click:active,
.social-author-click:focus {
  background: transparent !important;
  color: inherit !important;
  box-shadow: none !important;
}

.social-author-click:focus-visible {
  outline: 2px solid var(--rose) !important;
  outline-offset: 3px !important;
  border-radius: 8px;
}

.social-post-head > .social-author-click,
.cmt > .social-author-click,
.social-comment-box > .social-author-click {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.social-post-meta > .social-author-click {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}

.social-post-meta > .social-author-click .name,
.social-post-meta > .social-author-click .cmt-name {
  color: var(--bone) !important;
}

.social-profile-stat.social-author-click {
  display: block;
  width: auto;
  flex: 1;
  min-width: 0;
  padding: 10px 5px !important;
  text-align: center;
}

.social-person-row .social-author-click {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}


/* ---------- HIBRID SOCIAL FEED ---------- */
.social-feed-head {
  position: sticky;
  top: 0;
  z-index: 8;
  margin: 0 -14px;
  padding: 0 14px;
  background: rgba(10,9,16,.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.social-feed-title {
  min-height: 46px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.social-feed-tabs { display:flex; gap:2px; }
.social-feed-tab {
  position:relative;
  border:0;
  background:none;
  color:var(--muted);
  padding:10px 12px;
  font:inherit;
  font-size:12px;
  cursor:pointer;
}
.social-feed-tab.on { color:var(--bone); font-weight:600; }
.social-feed-tab.on:after {
  content:"";
  position:absolute;
  left:12px;
  right:12px;
  bottom:0;
  height:2px;
  border-radius:99px;
  background:var(--rose);
}

.social-composer {
  margin:12px -14px 0;
  padding:14px;
  background:var(--surface);
  border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);
}
.social-composer-main {
  display:flex;
  gap:10px;
  align-items:flex-start;
}
.social-composer textarea.i {
  min-height:56px;
  padding:8px 0;
  border:0;
  border-radius:0;
  background:transparent;
  resize:none;
  font-size:15px;
}
.social-composer textarea.i:focus-visible { outline:none; }
.social-composer-actions {
  margin-left:48px;
  padding-top:9px;
  border-top:1px solid var(--line);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.social-media-panel { margin:10px 0 0 48px; }

.social-post {
  margin:0 -14px;
  padding:14px;
  border-bottom:1px solid var(--line);
  background:transparent;
}
.social-post.highlight {
  background:rgba(217,117,143,.06);
  box-shadow:inset 3px 0 0 var(--rose);
}
.social-post-head {
  display:flex;
  gap:10px;
  align-items:flex-start;
}
.social-post-meta {
  min-width:0;
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:5px;
}
.social-post-body {
  margin:8px 0 0 48px;
  font-size:14.5px;
  line-height:1.5;
  white-space:pre-wrap;
  word-break:break-word;
}
.social-post-media {
  display:block;
  width:calc(100% - 48px);
  max-height:560px;
  object-fit:cover;
  margin:10px 0 0 48px;
  border:1px solid var(--line);
  border-radius:14px;
}
.social-actions {
  margin:10px 0 0 40px;
  display:flex;
  gap:8px;
}
.social-action {
  min-width:56px;
  display:inline-flex;
  align-items:center;
  gap:6px;
  border:0;
  background:transparent;
  color:var(--muted);
  padding:6px 8px;
  border-radius:9px;
  font:inherit;
  font-size:12px;
  cursor:pointer;
}
.social-action:hover { background:var(--raised); color:var(--bone); }
.social-action.liked { color:var(--rose); }

.social-comments { margin:5px 0 0 48px; }
.social-comment {
  padding:8px 0;
}
.social-comment + .social-comment {
  border-top:1px solid rgba(44,39,64,.55);
}
.social-comment-action {
  border:0;
  background:none;
  color:var(--muted);
  padding:0;
  margin-top:4px;
  font:inherit;
  font-size:11.5px;
  cursor:pointer;
}
.social-comment-action:hover { color:var(--rose); }

.social-comment-box {
  margin:8px 0 0 48px;
  display:flex;
  gap:8px;
  align-items:center;
}
.social-comment-box input.i {
  min-height:36px;
  padding:7px 11px;
  border-radius:99px;
  background:var(--raised);
}
.social-empty {
  padding:30px 18px;
  text-align:center;
  color:var(--muted);
}

@media (max-width:480px) {
  .social-post-body,
  .social-post-media,
  .social-comments,
  .social-comment-box,
  .social-composer-actions,
  .social-media-panel {
    margin-left:42px;
  }
  .social-post-media { width:calc(100% - 42px); }
  .social-actions { margin-left:34px; }
}


.social-profile-tabs {
  display:flex;
  gap:2px;
  margin-top:12px;
  border-bottom:1px solid var(--line);
}
.social-profile-tab {
  position:relative;
  flex:1;
  border:0;
  background:none;
  color:var(--muted);
  padding:10px 8px;
  font:inherit;
  font-size:12px;
  cursor:pointer;
}
.social-profile-tab.on { color:var(--bone); font-weight:600; }
.social-profile-tab.on:after {
  content:"";
  position:absolute;
  left:18%;
  right:18%;
  bottom:-1px;
  height:2px;
  border-radius:99px;
  background:var(--rose);
}
.social-profile-feed { margin:0 -16px -16px; }
.social-profile-post {
  padding:13px 16px;
  border-bottom:1px solid var(--line);
}
.social-profile-post-text {
  margin-top:5px;
  white-space:pre-wrap;
  word-break:break-word;
  font-size:14px;
  line-height:1.5;
}
.social-profile-post-media {
  width:100%;
  max-height:420px;
  object-fit:cover;
  margin-top:9px;
  border-radius:12px;
  border:1px solid var(--line);
}
.social-person-row {
  display:flex;
  align-items:center;
  gap:10px;
  padding:11px 0;
  border-bottom:1px solid var(--line);
}
.social-person-row:last-child { border-bottom:0; }
.social-person-row-main { flex:1; min-width:0; }
.social-background-followers {
  padding:12px;
  margin-top:10px;
  border:1px dashed var(--line);
  border-radius:12px;
  color:var(--muted);
  font-size:12px;
}


.social-action.reposted {
  color: var(--gold);
}

.social-repost-wrap {
  position: relative;
}

.social-repost-note {
  margin: 10px 14px -5px 34px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 11.5px;
}

.social-repost-note button {
  -webkit-appearance: none;
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  cursor: pointer;
}

.social-repost-note button:hover {
  color: var(--bone);
  text-decoration: underline;
}


.social-viral-badge {
  display:inline-flex;
  align-items:center;
  gap:4px;
  padding:2px 7px;
  border:1px solid var(--line);
  border-radius:99px;
  font-size:9.5px;
  font-weight:700;
  letter-spacing:.06em;
  text-transform:uppercase;
  color:var(--gold);
  background:rgba(200,164,92,.08);
}

.social-viral-badge.breakout {
  color:var(--rose);
  border-color:var(--oxblood);
  background:rgba(138,29,59,.15);
}

.social-sentiment-strip {
  display:flex;
  gap:6px;
  flex-wrap:wrap;
  margin-top:10px;
}

.social-sentiment-chip {
  display:inline-flex;
  align-items:center;
  gap:4px;
  padding:4px 8px;
  border:1px solid var(--line);
  border-radius:99px;
  background:var(--raised);
  color:var(--muted);
  font-size:10.5px;
}

.social-sentiment-chip strong {
  color:var(--bone);
  font-weight:600;
}


.social-media-account-bar {
  display:flex;
  align-items:center;
  gap:10px;
  margin:10px -14px 0;
  padding:10px 14px;
  border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);
  background:rgba(30,26,44,.52);
}

.social-media-account-main {
  flex:1;
  min-width:0;
}

.social-media-account-tag {
  display:inline-flex;
  align-items:center;
  gap:5px;
  margin-top:2px;
  color:var(--muted);
  font-size:10.5px;
}

.social-media-account-actions {
  display:flex;
  gap:6px;
  align-items:center;
  flex:none;
}

.gossip-mode-grid {
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:6px;
  margin-top:8px;
}

.gossip-media-preview {
  margin-top:12px;
  padding:12px;
  border:1px solid var(--line);
  border-radius:12px;
  background:var(--raised);
}

@media (max-width:480px) {
  .social-media-account-bar {
    align-items:flex-start;
  }

  .social-media-account-actions {
    flex-direction:column;
  }

  .gossip-mode-grid {
    grid-template-columns:1fr;
  }
}


.gossip-post-kicker {
  margin: 9px 0 -2px 48px;
  display:flex;
  align-items:center;
  gap:6px;
  flex-wrap:wrap;
  color:var(--muted);
  font-size:9.5px;
  font-weight:700;
  letter-spacing:.09em;
  text-transform:uppercase;
}

.gossip-post-kicker .rumor {
  color:var(--rose);
}

.gossip-post-kicker .confirmed {
  color:var(--gold);
}

.gossip-post-headline {
  margin:8px 0 0 48px;
  font-family:Fraunces, Georgia, serif;
  font-size:19px;
  font-weight:700;
  line-height:1.22;
  letter-spacing:-.01em;
  color:var(--bone);
}

@media (max-width:480px) {
  .gossip-post-kicker,
  .gossip-post-headline {
    margin-left:42px;
  }

  .gossip-post-headline {
    font-size:18px;
  }
}


.social-trends {
  margin:10px -14px 0;
  padding:9px 14px;
  border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);
  background:rgba(20,18,32,.7);
}
.social-trends-head { display:flex; align-items:center; gap:6px; margin-bottom:7px; color:var(--muted); font-size:9.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
.social-trend-list { display:flex; gap:6px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
.social-trend-list::-webkit-scrollbar { display:none; }
.social-trend { flex:none; border:1px solid var(--line); border-radius:99px; background:var(--raised); color:var(--bone); font:inherit; font-size:10.5px; padding:5px 9px; cursor:pointer; }
.social-trend:hover { border-color:var(--rose); }
.social-reach { cursor:default; opacity:.72; }
.popup-event-scrim { z-index:90; }
.popup-event-sheet { max-width:500px; max-height:min(86vh,760px); overflow-y:auto; }
.popup-event-kicker { display:flex; align-items:center; gap:6px; color:var(--rose); font-size:9.5px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; }
.popup-event-title { margin-top:7px; font-family:Fraunces,Georgia,serif; font-size:24px; line-height:1.15; }
.popup-event-body { margin-top:9px; color:#DCD5CB; white-space:pre-wrap; }
.popup-choice-list { display:flex; flex-direction:column; gap:8px; margin-top:16px; }
.popup-choice { width:100%; text-align:left; justify-content:flex-start; padding:11px 12px; }
.popup-choice-copy { min-width:0; }
.popup-choice-label { font-weight:600; }
.popup-choice-desc { margin-top:2px; color:var(--muted); font-size:11.5px; line-height:1.35; }

.character-detail-mobile-edit {
  display: none;
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

  /* ---------- KARAKTERSZERKESZTŐ MOBIL ---------- */

  .char-edit-scrim {
    position: fixed !important;
    inset: 0 !important;
    z-index: 70 !important;
    display: block !important;
    padding: 0 !important;
    background: var(--ink) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  .char-edit-sheet {
    width: 100% !important;
    max-width: none !important;

    height: 100svh !important;
    max-height: 100svh !important;
    min-height: 100svh !important;

    margin: 0 !important;
    padding: 0 14px calc(122px + env(safe-area-inset-bottom)) !important;
    box-sizing: border-box !important;
    border: 0 !important;
    border-radius: 0 !important;

    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    scroll-behavior: auto;
    touch-action: pan-y;
  }

  @supports (height: 100dvh) {
    .char-edit-sheet {
      height: 100dvh !important;
      max-height: 100dvh !important;
      min-height: 100dvh !important;
    }
  }

  .char-edit-header {
    position: sticky !important;
    top: 0 !important;
    z-index: 140 !important;

    min-height: 58px;
    margin: 0 -14px 12px !important;
    padding: calc(10px + env(safe-area-inset-top)) 14px 10px !important;

    background: rgba(10, 9, 16, .985);
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .char-edit-header .btn {
    min-width: 44px;
    min-height: 44px;
    touch-action: manipulation;
  }

  .char-edit-sheet .card {
    padding: 13px !important;
  }

  .char-edit-sheet label.f {
    margin-top: 16px;
  }

  .char-edit-sheet .i,
  .char-edit-sheet input,
  .char-edit-sheet textarea,
  .char-edit-sheet select {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    font-size: 16px;
  }

  .char-edit-sheet textarea.i {
    min-height: 120px;
    line-height: 1.45;
  }

  .char-edit-add-person {
    flex-direction: column !important;
    align-items: stretch !important;
  }

  .char-edit-add-person > * {
    width: 100% !important;
    flex: 1 1 auto !important;
  }

  .char-edit-add-person > .btn {
    min-height: 44px;
  }

  .char-edit-rel-card {
    padding: 10px 0 2px;
    border-bottom: 1px solid rgba(255,255,255,.06);
  }

  .char-edit-rel-card .between {
    gap: 8px;
    align-items: flex-start;
  }

  .char-edit-rel-card .relnum {
    flex: 0 0 auto;
    text-align: right;
  }

  .char-edit-sheet .mobile-action-bar {
    bottom: 0 !important;
    width: calc(100% + 28px);
    margin-left: -14px;
    margin-right: -14px;
    margin-bottom: -112px;
    padding-left: 14px;
    padding-right: 14px;
  }

  /* ---------- KARAKTERLISTA + KARAKTERLAP MOBIL ---------- */

  .character-list-card {
    position: relative;
    min-height: 74px;
    padding: 12px !important;
    border-radius: 16px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  .character-list-card:active {
    transform: scale(.995);
    border-color: rgba(178, 51, 86, .72);
  }

  .character-list-card > .row {
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .character-list-main {
    flex: 1 1 180px !important;
    min-width: 0 !important;
  }

  .character-list-follow {
    flex: 0 0 auto;
    min-height: 42px;
    padding: 9px 11px !important;
    touch-action: manipulation;
  }

  .character-list-card .relnum {
    max-width: 46%;
    text-align: right;
    white-space: normal;
    line-height: 1.2;
  }

  .character-detail-scrim {
    position: fixed !important;
    inset: 0 !important;
    z-index: 72 !important;
    display: block !important;
    padding: 0 !important;
    background: var(--ink) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  .character-detail-sheet {
    width: 100% !important;
    max-width: none !important;

    height: 100svh !important;
    max-height: 100svh !important;
    min-height: 100svh !important;

    margin: 0 !important;
    padding: 0 14px calc(104px + env(safe-area-inset-bottom)) !important;
    box-sizing: border-box !important;
    border: 0 !important;
    border-radius: 0 !important;

    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    scroll-behavior: auto;
    touch-action: pan-y;
  }

  @supports (height: 100dvh) {
    .character-detail-sheet {
      height: 100dvh !important;
      max-height: 100dvh !important;
      min-height: 100dvh !important;
    }
  }

  .character-detail-header {
    position: sticky !important;
    top: 0 !important;
    z-index: 120 !important;

    min-height: 58px;
    margin: 0 -14px 12px !important;
    padding: calc(10px + env(safe-area-inset-top)) 14px 10px !important;

    background: rgba(10, 9, 16, .985);
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .character-detail-header .btn {
    min-height: 44px;
    min-width: 44px;
    padding: 10px 12px !important;
    touch-action: manipulation;
    position: relative;
    z-index: 2;
  }

  .character-detail-mobile-edit {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    gap: 7px;

    position: fixed !important;
    right: 14px !important;
    bottom: calc(82px + env(safe-area-inset-bottom)) !important;
    z-index: 180 !important;

    min-height: 48px !important;
    padding: 12px 16px !important;

    border-radius: 999px !important;
    box-shadow: 0 10px 28px rgba(0,0,0,.42);
    touch-action: manipulation;
  }

  .character-detail-sheet .social-profile-actions {
    gap: 7px;
    flex-wrap: wrap;
  }

  .character-detail-sheet .social-profile-actions .btn {
    min-height: 42px;
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
  bottom: 0 !important;

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
    if (w.players[id] && w.players[id].avatar) {
      w.players[id].avatar = attach(
        w.players[id].avatar,
        { category: "profile", ownerUserId: id }
      );
    }

    if (w.players[id] && w.players[id].cover) {
      w.players[id].cover = attach(
        w.players[id].cover,
        { category: "cover", ownerUserId: id }
      );
    }
  });

  (w.chars || []).forEach((c) => {
    if (c.avatar) {
      c.avatar = attach(
        c.avatar,
        { category: "profile", ownerCharacterId: c.id }
      );
    }

    if (c.cover) {
      c.cover = attach(
        c.cover,
        { category: "cover", ownerCharacterId: c.id }
      );
    }

    c.album = albumOf(c).map((item) => {
      const ref = attach(item.imageId ? imageRef(item.imageId) : item.src, { category: "album", ownerCharacterId: c.id });
      const iid = imageIdOf(ref);
      return iid ? { ...item, imageId: iid } : item;
    });
  });

  allGossipMediaAccounts(w).forEach((m) => {
    if (m.avatar) {
      m.avatar = attach(
        m.avatar,
        {
          category: "profile",
          ownerCharacterId: m.id,
        }
      );
    }

    if (m.cover) {
      m.cover = attach(
        m.cover,
        {
          category: "cover",
          ownerCharacterId: m.id,
        }
      );
    }
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

    r.onload = () =>
      res(
        typeof r.result === "string"
          ? r.result
          : ""
      );

    r.onerror = () =>
      rej(
        new Error(
          "Nem sikerült beolvasni a fájlt."
        )
      );

    r.onabort = () =>
      rej(
        new Error(
          "A kép beolvasása megszakadt."
        )
      );

    r.readAsDataURL(file);
  });
}

function dataUrlMimeType(value) {
  const match =
    String(value || "")
      .match(/^data:([^;,]+)[;,]/i);

  return (
    match &&
    match[1]
      ? String(match[1]).toLowerCase()
      : ""
  );
}

function dataUrlPayloadLength(value) {
  const raw =
    String(value || "");

  const comma =
    raw.indexOf(",");

  if (comma < 0) {
    return raw.length;
  }

  const payload =
    raw.slice(comma + 1);

  /*
   * Base64 -> byte becslés.
   */
  return Math.max(
    0,
    Math.floor(
      payload.length * 0.75
    ) -
    (
      payload.endsWith("==")
        ? 2
        : payload.endsWith("=")
          ? 1
          : 0
    )
  );
}

function canvasToBlob(
  canvas,
  type = "image/jpeg",
  quality = 0.76
) {
  return new Promise(
    (resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  "A kép tömörítése nem sikerült."
                )
              );
              return;
            }

            resolve(blob);
          },
          type,
          quality
        );
      } catch (e) {
        reject(e);
      }
    }
  );
}

async function loadImageForResize(
  file
) {
  const objectUrl =
    URL.createObjectURL(file);

  const img =
    new Image();

  img.decoding = "async";

  try {
    await new Promise(
      (resolve, reject) => {
        img.onload = resolve;

        img.onerror = () =>
          reject(
            new Error(
              "Ezt a képfájlt a böngésző nem tudja megnyitni."
            )
          );

        img.src =
          objectUrl;
      }
    );

    return {
      img,
      objectUrl,
    };
  } catch (e) {
    try {
      URL.revokeObjectURL(
        objectUrl
      );
    } catch (revokeErr) {}

    throw e;
  }
}

async function shrink(
  file,
  maxSize
) {
  if (
    !file ||
    !String(
      file.type || ""
    ).startsWith("image/")
  ) {
    throw new Error(
      "A kiválasztott fájl nem kép."
    );
  }

  const wantedMax =
    Math.max(
      320,
      Math.min(
        1600,
        Number(maxSize) || 900
      )
    );

  /*
   * A kicsi GIF-et megőrizzük animálva.
   * Ez az egyetlen eset, amikor az eredeti fájl kerül közvetlenül
   * base64-be, és ezt is szigorúan kis méretre korlátozzuk.
   */
  if (
    file.type === "image/gif" &&
    file.size <= 1200 * 1024
  ) {
    return readFile(file);
  }

  /*
   * Apró PNG-nél nincs értelme újratömöríteni.
   */
  if (
    file.type === "image/png" &&
    file.size <= 280 * 1024
  ) {
    return readFile(file);
  }

  let img = null;
  let objectUrl = "";
  let bitmap = null;
  let canvas = null;

  try {
    const loaded =
      await loadImageForResize(
        file
      );

    img =
      loaded.img;

    objectUrl =
      loaded.objectUrl;

    const sourceWidth =
      Math.max(
        1,
        Number(
          img.naturalWidth ||
          img.width
        ) || 1
      );

    const sourceHeight =
      Math.max(
        1,
        Number(
          img.naturalHeight ||
          img.height
        ) || 1
      );

    const scale =
      Math.min(
        1,
        wantedMax /
          Math.max(
            sourceWidth,
            sourceHeight
          )
      );

    const width =
      Math.max(
        1,
        Math.round(
          sourceWidth * scale
        )
      );

    const height =
      Math.max(
        1,
        Math.round(
          sourceHeight * scale
        )
      );

    let source =
      img;

    /*
     * Modern böngészőnél a resize már a bitmap létrehozásakor
     * megtörténhet. Ez különösen fontos nagy iPhone-fotóknál,
     * mert nem kell egy 30-50 MP-es teljes bitmapet canvason tartani.
     */
    if (
      typeof createImageBitmap ===
        "function" &&
      (
        width <
          sourceWidth ||
        height <
          sourceHeight
      )
    ) {
      try {
        bitmap =
          await createImageBitmap(
            file,
            {
              resizeWidth:
                width,
              resizeHeight:
                height,
              resizeQuality:
                "high",
              imageOrientation:
                "from-image",
            }
          );

        source =
          bitmap;
      } catch (bitmapError) {
        /*
         * Safari / speciális formátum esetén marad a normál img fallback.
         */
        bitmap = null;
        source = img;
      }
    }

    canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      width;

    canvas.height =
      height;

    const ctx =
      canvas.getContext(
        "2d",
        {
          alpha: false,
        }
      );

    if (!ctx) {
      throw new Error(
        "A böngésző nem tudta előkészíteni a képet."
      );
    }

    /*
     * JPEG outputnál legyen stabil háttér transzparens PNG esetén is.
     */
    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    ctx.drawImage(
      source,
      0,
      0,
      width,
      height
    );

    const blob =
      await canvasToBlob(
        canvas,
        "image/jpeg",
        0.76
      );

    /*
     * Csak a már lekicsinyített blobot alakítjuk data URL-lé.
     */
    return await readFile(
      blob
    );
  } finally {
    if (
      bitmap &&
      typeof bitmap.close ===
        "function"
    ) {
      try {
        bitmap.close();
      } catch (e) {}
    }

    if (img) {
      try {
        img.src = "";
      } catch (e) {}
    }

    if (objectUrl) {
      try {
        URL.revokeObjectURL(
          objectUrl
        );
      } catch (e) {}
    }

    if (canvas) {
      /*
       * iOS Safari memória felszabadítását segíti.
       */
      try {
        canvas.width = 1;
        canvas.height = 1;
      } catch (e) {}
    }
  }
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

function ImagePicker({ value, onChange, label, max = 512, preview = 80, previewWidth = preview, previewHeight = preview, category = "other" }) {
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
      if (
        f.size >
        12 * 1024 * 1024
      ) {
        throw new Error(
          tt(
            "Túl nagy fájl (max 12 MB).",
            "File too large (max 12 MB)."
          )
        );
      }

      const data =
        await shrink(
          f,
          max
        );

      const ref2 =
        addImage(
          data,
          {
            category,
            originalFileName:
              f.name,
            mimeType:
              dataUrlMimeType(
                data
              ) ||
              f.type ||
              "image/jpeg",
            size:
              dataUrlPayloadLength(
                data
              ),
          }
        );
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
          <img src={url} alt="" style={{ width: previewWidth, height: previewHeight, objectFit: "cover", borderRadius: 12, border: "1px solid var(--line)" }} />
        ) : (
          <div style={{ width: previewWidth, height: previewHeight, borderRadius: 12, border: "1px dashed var(--line)", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 11 }}>{tt("nincs kép", "no image")}</div>
        )}
        <div style={{ flex: 1 }}>
          <button type="button" className="btn full" onClick={() => ref.current && ref.current.click()} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />} {tt("Feltöltés", "Upload")}
          </button>
          {value ? <button type="button" className="btn ghost full tiny" style={{ marginTop: 6 }} onClick={() => onChange("")}>{tt("Törlés", "Delete")}</button> : null}
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
  const mi = HU_MONTHS.findIndex((n) => str.indexOf(n.slice(0, 10)) >= 0);
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
  const bond =
    (r && (r.bond || r.type)) || "";

  const mood =
    (r && r.mood) || "";

  const shownMood =
    mood
      ? localizedBond(
          mood,
          CURRENT_LANG
        )
      : "";

  if (
    shownMood &&
    r.fixed &&
    bond
  ) {
    return `${localizedBond(
      bond,
      CURRENT_LANG
    )} · ${shownMood}`;
  }

  if (shownMood) {
    return shownMood;
  }

  if (
    r &&
    r.fixed &&
    bond
  ) {
    return `${localizedBond(
      bond,
      CURRENT_LANG
    )} · ${relMood(
      r.score
    )}`;
  }

  if (bond) {
    return localizedBond(
      bond,
      CURRENT_LANG
    );
  }

  return relType(
    r ? r.score : 0
  );
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

const GOSSIP_MEDIA_LOCAL_ID =
  "media_spill_chill";

const GOSSIP_MEDIA_GLOBAL_ID =
  "media_rumor_has_it";

function defaultGossipMediaAccount(
  kind
) {
  if (kind === "global") {
    return {
      id:
        GOSSIP_MEDIA_GLOBAL_ID,

      mediaKind:
        "global",

      name:
        "RumorHasIt",

      username:
        "rumorhasit",

      bio:
        "Celebrities, scandals, receipts & the stories everyone is talking about.",

      avatar: "",
      cover: "",

      baseFollowers:
        8700000,

      followerDelta: 0,
      followers: [],
      following: [],
    };
  }

  return {
    id:
      GOSSIP_MEDIA_LOCAL_ID,

    mediaKind:
      "local",

    name:
      "Spill&Chill",

    username:
      "spillandchill",

    bio:
      "Small-town secrets, sightings & side-eyes. Send tips.",

    avatar: "",
    cover: "",

    baseFollowers:
      3400,

    followerDelta: 0,
    followers: [],
    following: [],
  };
}

function ensureGossipMediaState(w) {
  if (
    !w ||
    typeof w !== "object"
  ) {
    return w;
  }

  if (
    !w.gossipSettings ||
    typeof w.gossipSettings !==
      "object" ||
    Array.isArray(
      w.gossipSettings
    )
  ) {
    w.gossipSettings = {};
  }

  if (
    ![
      "off",
      "local",
      "global",
    ].includes(
      w.gossipSettings.mediaMode
    )
  ) {
    /*
     * Régi világokban ne jelenjen meg
     * automatikusan pletykaoldal.
     */
    w.gossipSettings.mediaMode =
      "off";
  }

  if (
    !w.mediaAccounts ||
    typeof w.mediaAccounts !==
      "object" ||
    Array.isArray(
      w.mediaAccounts
    )
  ) {
    w.mediaAccounts = {};
  }

  ["local", "global"].forEach(
    (kind) => {
      const defaults =
        defaultGossipMediaAccount(
          kind
        );

      const current =
        w.mediaAccounts[kind] &&
        typeof
          w.mediaAccounts[kind] ===
          "object" &&
        !Array.isArray(
          w.mediaAccounts[kind]
        )
          ? w.mediaAccounts[kind]
          : {};

      const row = {
        ...defaults,
        ...current,

        /*
         * Rendszerprofil: ezek fixek.
         */
        id:
          defaults.id,

        mediaKind:
          kind,

        name:
          defaults.name,

        username:
          defaults.username,
      };

      ensureSocialProfileRow(
        row
      );

      w.mediaAccounts[kind] =
        row;
    }
  );

  return w;
}

function allGossipMediaAccounts(w) {
  if (
    !w ||
    !w.mediaAccounts
  ) {
    return [];
  }

  return [
    w.mediaAccounts.local,
    w.mediaAccounts.global,
  ].filter(
    (x) =>
      x &&
      x.id
  );
}

function activeGossipMediaAccount(w) {
  if (
    !w ||
    !w.gossipSettings
  ) {
    return null;
  }

  const mode =
    w.gossipSettings.mediaMode;

  if (
    mode !== "local" &&
    mode !== "global"
  ) {
    return null;
  }

  return (
    w.mediaAccounts &&
    w.mediaAccounts[mode]
  ) || null;
}

function isMediaAccount(w, id) {
  if (!id) return false;

  return allGossipMediaAccounts(
    w
  ).some(
    (m) =>
      m &&
      m.id === id
  );
}

// Bármely szereplő azonosító alapján: játékos, bot vagy mellékszereplő.
function charById(w, id) {
  if (!id) return null;

  if (
    w.players &&
    w.players[id]
  ) {
    return w.players[id];
  }

  const core =
    (w.chars || []).find(
      (c) =>
        c.id === id
    );

  if (core) return core;

  const extra =
    (w.extras || []).find(
      (c) =>
        c.id === id
    );

  if (extra) return extra;

  return (
    allGossipMediaAccounts(w)
      .find(
        (m) =>
          m &&
          m.id === id
      ) ||
    null
  );
}
const isExtra = (w, id) => !!(w.extras || []).find((c) => c.id === id);
const isHuman = (w, id) => !!(w.players && w.players[id]);
// Minden emberi játékos karaktere.
const humanChars = (w) => Object.keys(w.players || {}).map((id) => w.players[id]).filter(Boolean);
// Mindenki, akinek kapcsolata lehet: játékosok, botok, mellékszereplők.
const allSubjects = (w) => humanChars(w).concat(w.chars || []).concat(w.extras || []);
const kindOf = (w, id) => (
  isHuman(w, id)
    ? termText(
        "player",
        worldLanguage(w)
      )
    : isExtra(w, id)
      ? termText(
          "extra",
          worldLanguage(w)
        )
      : isMediaAccount(w, id)
        ? (
            worldLanguage(w) === "en"
              ? "media"
              : "média"
          )
        : termText(
            "ai",
            worldLanguage(w)
          )
);
// A privát beszélgetések fiókonként külön élnek.
const chatKey = (meId, charId) => String(meId) + "|" + String(charId);

const PUBLIC_PROFILE_KEYS = ["name", "nick", "username", "birth", "gender", "orientation", "height", "job", "city", "bio", "looks", "avatar", "cover"];
const PRIVATE_PROFILE_KEYS = [
  "personality", "traits", "speech", "voice", "goals", "fears", "likes", "secrets", "backstory", "extra", "brief", "briefSrc",
  "skills", "abilities", "combat", "rank", "role", "organization", "affiliation"
];

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

    /*
     * Hosszabb távú személyes emlékezet.
     * Ezek a részletes listák mellett a visszatérő, fontos
     * érzelmi/történeti kapaszkodókat őrzik.
     */
    emotionalAnchors: [],
    personalMilestones: [],
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
const NOTE_REFRESH = NOTE_LIFE;
const NOTE_MAX = 80;

function pruneExpiredNotes(w) {
  if (!w || !Array.isArray(w.notes)) {
    if (w) w.notes = [];
    return w;
  }

  const cutoff =
    now() - NOTE_LIFE;

  const newestByAuthor = {};

  w.notes.forEach((x) => {
    if (
      !x ||
      !x.authorId ||
      Number(x.ts || 0) <= cutoff
    ) {
      return;
    }

    const prev =
      newestByAuthor[x.authorId];

    if (
      !prev ||
      Number(x.ts || 0) >
        Number(prev.ts || 0)
    ) {
      newestByAuthor[x.authorId] = x;
    }
  });

  w.notes =
    Object.values(
      newestByAuthor
    )
      .sort(
        (a, b) =>
          Number(b.ts || 0) -
          Number(a.ts || 0)
      )
      .slice(0, 80);

  return w;
}

const liveNotes = (w) =>
  (w.notes || []).filter(
    (x) =>
      x &&
      now() - (x.ts || 0) <
        NOTE_LIFE
  );

const noteOf = (w, id) =>
  liveNotes(w).find(
    (x) => x.authorId === id
  ) || null;

function setNote(n, authorId, text, forcedId, extra = {}) {
  pruneExpiredNotes(n);

  const t = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NOTE_MAX);

  const musicRaw =
    extra && extra.music && typeof extra.music === "object"
      ? extra.music
      : {};

  const music = {
    title: String(musicRaw.title || "").trim().slice(0, 120),
    artist: String(musicRaw.artist || "").trim().slice(0, 120),
    summary: String(musicRaw.summary || "").trim().slice(0, 700),
  };

  const hasMusic = Boolean(music.title || music.artist);

  // Egy karakternek egyszerre csak egy aktív note-ja lehet.
  n.notes = (n.notes || []).filter(
    (x) => x && x.authorId !== authorId
  );

  if (t || hasMusic) {
    const createdAt = now();

    n.notes.unshift({
      id: forcedId || uid(),
      authorId,
      text: t,
      music: hasMusic ? music : null,
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

  return list
    .map((x) => {
      const a = charById(w, x.authorId);
      const music = x.music && (x.music.title || x.music.artist)
        ? ` | MUSIC: ${x.music.title || "?"}${x.music.artist ? ` — ${x.music.artist}` : ""}${x.music.summary ? ` | AI-understood theme/mood: ${x.music.summary}` : ""}`
        : "";

      return `${a ? a.name : "?"} [${x.authorId}]: "${x.text || ""}"${music}`;
    })
    .join("\n");
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
function mentionedIdsInText(w, txt, authorId = "") {
  if (!w || !txt) return [];

  const low = String(txt).toLowerCase();
  const ids = [];

  socialProfiles(w).forEach((person) => {
    if (!person || person.id === authorId) return;

    const handle = String(person.username || "")
      .trim()
      .toLowerCase();

    if (!handle) return;

    const re = new RegExp(
      `(^|[^a-z0-9._-])@${handle.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?=$|[^a-z0-9._-])`,
      "i"
    );

    if (re.test(low)) {
      ids.push(person.id);
    }
  });

  return [...new Set(ids)];
}

function addMentionToText(value, person) {
  if (!person || !person.username) return String(value || "");

  const tag = `@${person.username}`;
  const current = String(value || "");

  if (current.toLowerCase().includes(tag.toLowerCase())) {
    return current;
  }

  return `${current}${current && !/\\s$/.test(current) ? " " : ""}${tag} `;
}

function noteMentions(n, txt, authorId, link) {
  if (!txt) return;

  const targets = mentionedIdsInText(
    n,
    txt,
    authorId
  );

  targets.forEach((targetId) => {
    const who = charById(n, authorId);
    const target = charById(n, targetId);

    if (isHuman(n, targetId)) {
      const nm = who
        ? who.name
        : sysTextFor(n, targetId, "someone");

      pushNote(n, targetId, {
        icon: "📣",
        translationKey: "mentionedYou",
        params: { name: nm },
        text: sysTextFor(
          n,
          targetId,
          "mentionedYou",
          { name: nm }
        ),
        link,
      });
    } else if (target && !isMediaAccount(n, targetId)) {
      /*
       * AI-karaktereknél az @tag nem UI notification,
       * hanem valódi nyilvános tudás/esemény.
       */
      rememberKnowledge(n, targetId, {
        kind: "event",
        source: "public_mention",
        confidence: 1,
        text: sysLangText(
          n,
          targetId,
          `${who ? who.name : "Valaki"} nyilvánosan megjelölt: ${cut(txt, 140)}`,
          `${who ? who.name : "Someone"} publicly tagged me: ${cut(txt, 140)}`
        ),
      });
    }
  });

  return targets;
}

function MentionBar({ w, value, onChange, compact = false }) {
  const { tt } = useLang();
  const [open, setOpen] = useState(false);

  const people = socialProfiles(w)
    .filter((person) =>
      person &&
      person.id !== w.meId &&
      !isMediaAccount(w, person.id)
    )
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  if (!people.length) return null;

  return (
    <div style={{ marginTop: compact ? 5 : 7 }}>
      <button
        type="button"
        className="btn tiny ghost"
        onClick={() => setOpen(!open)}
      >
        @ {tt("Megjelölés", "Tag")}
      </button>

      {open ? (
        <div
          className="row"
          style={{
            gap: 5,
            flexWrap: "wrap",
            marginTop: 6,
          }}
        >
          {people.map((person) => (
            <button
              type="button"
              key={person.id}
              className="btn tiny ghost"
              style={{ fontSize: 10.5 }}
              onClick={() => {
                onChange(addMentionToText(value, person));
                setOpen(false);
              }}
            >
              @{person.username}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* Egy változás mindig egyirányú: "a" mit érez ezután "b" iránt. */
/* Kemény őr: a te karaktered SOHA nem szólalhat meg az AI-tól. Ha mégis
   megpróbálná, itt kidobjuk — nem a jó szándékban bízunk, hanem szűrünk. */
function aiVoice(n, id) {
  const who = findChar(n, id);
  return who && !isHuman(n, who) ? who : null;
}

function boostedRelationshipDelta(
  value
) {
  const raw =
    Number(value) || 0;

  if (!raw) return 0;

  const sign =
    raw > 0
      ? 1
      : -1;

  const abs =
    Math.abs(raw);

  /*
   * Régen túl sok ±1 / ±3 / ±5 változás volt.
   * Most egy VALÓDI érzelmi reakció láthatóbb.
   *
   * Példák:
   *  3  ->  6
   *  5  ->  8
   * 10  -> 16
   * 15  -> 24
   * 20  -> 32
   * 30+ -> max 40
   */
  const boosted =
    abs <= 3
      ? 6
      : Math.max(
          6,
          Math.round(
            abs * 1.6
          )
        );

  return (
    sign *
    Math.min(
      40,
      boosted
    )
  );
}

function oneSidedRelationshipChange(
  ch
) {
  if (
    ch &&
    ch.oneSided === true
  ) {
    return true;
  }

  const corpus =
    [
      ch && ch.bond,
      ch && ch.mood,
      ch && ch.why,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  return (
    /(?:titkos vonzalom|secret attraction|unrequited|viszonzatlan|egyoldalú|one[- ]sided)/i
      .test(corpus)
  );
}

function normalizedRelationshipChanges(
  n,
  changes
) {
  const explicit = [];

  (Array.isArray(changes)
    ? changes
    : []
  ).forEach((ch) => {
    if (!ch) return;

    const a =
      findChar(
        n,
        ch.a
      );

    const b =
      findChar(
        n,
        ch.b
      );

    if (
      !a ||
      !b ||
      a === b
    ) {
      return;
    }

    explicit.push({
      ...ch,
      a,
      b,
      delta:
        boostedRelationshipDelta(
          ch.delta
        ),
      __autoEcho:false,
    });
  });

  const explicitPairs =
    new Set(
      explicit.map(
        (ch) =>
          relKey(
            ch.a,
            ch.b
          )
      )
    );

  const out = [
    ...explicit,
  ];

  /*
   * Biztonsági fallback:
   * ha a modell egy tényleges interakciónál csak az egyik
   * irányt adta vissza, a másik oldal score-ja is kaphat
   * egy KISEBB "echo" változást.
   *
   * - nem lesz automatikusan szimmetrikus
   * - nem másolunk bondot / moodot
   * - oneSided változásnál nem történik
   * - ha a modell explicit megadta a másik irányt,
   *   azt tiszteletben tartjuk
   */
  explicit.forEach((ch) => {
    if (
      !ch.delta ||
      oneSidedRelationshipChange(
        ch
      )
    ) {
      return;
    }

    const reverseKey =
      relKey(
        ch.b,
        ch.a
      );

    if (
      explicitPairs.has(
        reverseKey
      )
    ) {
      return;
    }

    const sign =
      ch.delta > 0
        ? 1
        : -1;

    const echo =
      sign *
      Math.min(
        14,
        Math.max(
          4,
          Math.round(
            Math.abs(
              ch.delta
            ) * 0.42
          )
        )
      );

    out.push({
      a:ch.b,
      b:ch.a,
      delta:echo,
      mood:"",
      bond:"",
      fixed:false,
      oneSided:false,
      __autoEcho:true,
      why:
        worldLanguage(
          n,
          n.meId
        ) === "en"
          ? "The interaction affected this side of the relationship too."
          : "A köztük történt interakció erre az oldalra is hatott.",
    });
  });

  return out;
}

function applyChanges(
  n,
  changes
) {
  normalizedRelationshipChanges(
    n,
    changes
  ).forEach((ch) => {
    const a =
      ch.a;

    const b =
      ch.b;

    if (
      !a ||
      !b ||
      a === b
    ) {
      return;
    }

    const r =
      getRel(
        n,
        a,
        b
      );

    const delta =
      Number(
        ch.delta
      ) || 0;

    const patch = {
      score:
        clamp(
          r.score +
          delta
        ),
    };

    /*
     * Állandó rokoni köteléket az AI nem írhat át.
     * A score és mood viszont attól még változhat.
     */
    if (
      ch.bond &&
      !r.fixed
    ) {
      patch.bond =
        String(
          ch.bond
        ).slice(
          0,
          40
        );
    }

    if (
      ch.mood
    ) {
      patch.mood =
        String(
          ch.mood
        ).slice(
          0,
          60
        );
    }

    if (
      ch.why
    ) {
      patch.why =
        String(
          ch.why
        ).slice(
          0,
          160
        );
    }

    setRel(
      n,
      a,
      b,
      patch
    );

    /*
     * SOCIAL FOLLOW CONSEQUENCE:
     * ha egy AI-nak erős társas oka van követni a másikat
     * (jó kapcsolat, crush, család, közeli barát, közös frakció stb.),
     * ne csak a ritka háttér-tickre várjunk.
     *
     * Ez AI -> AI követéseket is létrehoz.
     */
    if (
      !isHuman(n, a) &&
      socialProfileById(n, b) &&
      !isFollowing(n, a, b)
    ) {
      const followScore =
        followInterestScore(
          n,
          a,
          b
        );

      const bondText =
        String(
          patch.bond ||
          r.bond ||
          r.type ||
          ""
        ).toLowerCase();

      const especiallyLinked =
        /best friend|legjobb bar|close friend|közeli bar|friend|barát|crush|dating|járnak|engaged|jegyes|spouse|házastárs|partner|mother|father|parent|sibling|brother|sister|cousin|aunt|uncle|grand|anya|apa|szül|testvér|unokatestvér|nagynéni|nagybácsi|nagyszül|rokon/.test(
          bondText
        );

      if (
        followScore >= 42 ||
        especiallyLinked
      ) {
        simEnqueue(
          n,
          mkAction(
            "follow",
            `relationship-follow:${a}:${b}:${Math.floor(now() / 3600000)}`,
            {
              actorId:a,
              targetId:b,
              trigger:"relationship",
              score:followScore,
            },
            "event"
          )
        );
      }
    }

    const memA =
      ensureCharMemory(
        n,
        a
      );

    const rk =
      relKey(
        a,
        b
      );

    if (
      !memA.relationshipHistory[rk]
    ) {
      memA.relationshipHistory[rk] =
        [];
    }

    memA.relationshipHistory[rk] =
      memA.relationshipHistory[rk]
        .concat([
          {
            score:
              patch.score,
            delta,
            mood:
              patch.mood ||
              r.mood ||
              "",
            why:
              patch.why ||
              "",
            autoEcho:
              Boolean(
                ch.__autoEcho
              ),
            timestamp:
              now(),
          },
        ])
        .slice(-30);

    /*
     * 1) AI -> játékos:
     *    "X kapcsolata veled +..."
     */
    if (
      !isHuman(n,a) &&
      isHuman(n,b) &&
      delta
    ) {
      const other =
        charById(
          n,
          a
        );

      if (other) {
        const why =
          ch.why
            ? String(ch.why)
            : (
                ch.mood
                  ? String(ch.mood)
                  : ""
              );

        const whyPart =
          why
            ? ` - ${why}`
            : "";

        pushNote(
          n,
          b,
          {
            icon:
              moodEmoji(
                delta
              ),
            translationKey:
              "relationshipDelta",
            params:{
              name:
                other.name,
              delta:
                `${delta > 0 ? "+" : ""}${delta}`,
              why:
                whyPart,
            },
            text:
              sysTextFor(
                n,
                b,
                "relationshipDelta",
                {
                  name:
                    other.name,
                  delta:
                    `${delta > 0 ? "+" : ""}${delta}`,
                  why:
                    whyPart,
                }
              ),
            mood:
              ch.mood
                ? String(ch.mood)
                : "",
            link:{
              type:"char",
              id:a,
            },
          }
        );
      }
    }

    /*
     * 2) játékos -> AI:
     *    a SAJÁT irányod változása is látható legyen.
     */
    if (
      isHuman(n,a) &&
      !isHuman(n,b) &&
      delta
    ) {
      const other =
        charById(
          n,
          b
        );

      if (other) {
        const why =
          ch.why
            ? String(ch.why)
            : "";

        const whyPart =
          why
            ? ` - ${why}`
            : "";

        pushNote(
          n,
          a,
          {
            icon:
              moodEmoji(
                delta
              ),
            translationKey:
              "yourRelationshipDelta",
            params:{
              name:
                other.name,
              delta:
                `${delta > 0 ? "+" : ""}${delta}`,
              why:
                whyPart,
            },
            text:
              sysTextFor(
                n,
                a,
                "yourRelationshipDelta",
                {
                  name:
                    other.name,
                  delta:
                    `${delta > 0 ? "+" : ""}${delta}`,
                  why:
                    whyPart,
                }
              ),
            link:{
              type:"char",
              id:b,
            },
          }
        );
      }
    }
  });
}
function socialTextRelationshipDelta(
  w,
  actorId,
  targetId,
  text,
  directReply = false
) {
  if (
    !w ||
    !actorId ||
    !targetId ||
    actorId === targetId
  ) {
    return 0;
  }

  const raw =
    String(text || "")
      .toLowerCase();

  if (!raw.trim()) {
    return 0;
  }

  /*
   * Ez nem "sentiment AI", csak egy óvatos social mikro-jel.
   * A nagyobb változásokat továbbra is az AI-generated changes adja.
   */
  const positive =
    /(^|\s)(love|luv|ily|adore|cute|pretty|beautiful|gorgeous|hot|proud|congrats|congratulations|thanks|thank you|miss you|best|sweet|amazing|perfect|szeretlek|imádlak|cuki|szép|gyönyörű|büszke|gratulálok|köszi|köszönöm|hiányzol|kedvenc)(\s|$|[!?.])/i.test(
      raw
    );

  const negative =
    /(^|\s)(hate|shut up|fuck off|idiot|stupid|loser|pathetic|disgusting|creep|annoying|liar|bitch|asshole|utállak|fogd be|hülye|idióta|vesztes|szánalmas|undorító|idegesítő|hazug|kurva|seggfej)(\s|$|[!?.])/i.test(
      raw
    );

  let delta = 0;

  if (
    positive &&
    !negative
  ) {
    delta =
      directReply
        ? 3
        : 2;
  } else if (
    negative &&
    !positive
  ) {
    delta =
      directReply
        ? -4
        : -3;
  } else if (directReply) {
    /*
     * Maga a közvetlen reakció is társas jel:
     * valaki időt/figyelmet adott a másiknak.
     */
    delta = 1;
  }

  const obsession =
    relationshipObsessionLevel(
      w,
      targetId,
      actorId
    );

  if (
    obsession >= 3 &&
    delta !== 0
  ) {
    /*
     * A megszállott fél erősebben reagál arra,
     * ha a célpont közvetlenül foglalkozik vele.
     */
    delta +=
      delta > 0
        ? 2
        : -2;
  }

  return Math.max(
    -7,
    Math.min(
      6,
      delta
    )
  );
}

function applyPlayerSocialRelationshipSignal(
  n,
  actorId,
  targetId,
  text,
  kind = "comment"
) {
  if (
    !n ||
    !actorId ||
    !targetId ||
    actorId === targetId ||
    !isHuman(n, actorId) ||
    isHuman(n, targetId)
  ) {
    return;
  }

  const directReply =
    kind === "reply";

  const delta =
    socialTextRelationshipDelta(
      n,
      actorId,
      targetId,
      text,
      directReply
    );

  if (!delta) {
    return;
  }

  const target =
    charById(
      n,
      targetId
    );

  if (!target) {
    return;
  }

  const why =
    worldLanguage(
      n,
      actorId
    ) === "en"
      ? (
          directReply
            ? "Your direct reply changed how they feel about you."
            : "Your public interaction affected how they feel about you."
        )
      : (
          directReply
            ? "A közvetlen válaszod hatott arra, mit érez irántad."
            : "A nyilvános interakciód hatott arra, mit érez irántad."
        );

  /*
   * Az AI -> játékos irány változik:
   * az AI reagál arra, hogy a játékos mit tett vele.
   * applyChanges maga küldi a +N / -N értesítést.
   */
  applyChanges(
    n,
    [
      {
        a: targetId,
        b: actorId,
        delta,
        mood: "",
        why,
        oneSided: true,
      },
    ]
  );
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
    }], "fact", 80);
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
  if (kind === "event") {
    mem.witnessedEvents = mergeKnowledgeItems(mem.witnessedEvents, [entry], "event", 80);
  } else if (kind === "rumor") {
    mem.rumors = mergeKnowledgeItems(mem.rumors, [entry], "rumor", 60);
  } else if (kind === "assumption") {
    mem.suspicions = mergeKnowledgeItems(mem.suspicions, [entry], "assumption", 50);
  } else if (kind === "secret") {
    mem.learnedSecrets = mergeKnowledgeItems(mem.learnedSecrets, [entry], "secret", 60);
  } else if (kind === "conversation") {
    mem.conversations = mergeKnowledgeItems(mem.conversations, [entry], "conversation", 100);
  } else if (kind === "anchor") {
    mem.emotionalAnchors = mergeKnowledgeItems(mem.emotionalAnchors, [entry], "anchor", 50);
  } else if (kind === "milestone") {
    mem.personalMilestones = mergeKnowledgeItems(mem.personalMilestones, [entry], "milestone", 50);
  } else {
    mem.knownFacts = mergeKnowledgeItems(mem.knownFacts, [entry], "fact", 80);
  }
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
  if (payload.kind === "assumption") known.assumptions = mergeKnowledgeItems(known.assumptions, [entry], "assumption", 36);
  else if (payload.kind === "event") known.knownEvents = mergeKnowledgeItems(known.knownEvents, [entry], "event", 48);
  else if (payload.kind === "relationship") known.knownRelationships = mergeKnowledgeItems(known.knownRelationships, [entry], "relationship", 40);
  else if (payload.kind === "observed_trait") known.observedTraits = mergeKnowledgeItems(known.observedTraits, [entry], "trait", 36);
  else known.learnedInformation = mergeKnowledgeItems(known.learnedInformation, [entry], "fact", 48);
}

/* Album-szerkesztő: több kép feltöltése képaláírással. */
function AlbumEditor({ value, onChange, owner }) {
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

    setBusy(true);
    setErr("");

    const added = [];

    for (let i = 0; i < files.length; i++) {
      try {
        if (
          files[i].size >
          12 * 1024 * 1024
        ) {
          throw new Error(
            tt(
              `"${files[i].name}" túl nagy (max 12 MB).`,
              `"${files[i].name}" is too large (max 12 MB).`
            )
          );
        }

        const data =
          await shrink(
            files[i],
            900
          );

        const ref2 =
          addImage(
            data,
            {
              category:
                "album",
              originalFileName:
                files[i].name,
              mimeType:
                dataUrlMimeType(
                  data
                ) ||
                files[i].type ||
                "image/jpeg",
              size:
                dataUrlPayloadLength(
                  data
                ),
              ownerCharacterId:
                owner &&
                owner.id
                  ? owner.id
                  : "",
            }
          );

        if (!ref2) {
          throw new Error(
            tt(
              "Megtelt a világ képtára — törölj pár képet, hogy férjen újabb.",
              "The world's media storage is full — delete a few images to make room for more."
            )
          );
        }

        let vision = "";

        try {
          vision = await analyzeImageDataUrl(
            data,
            tt(
              `Írd le röviden, mi látható ezen a ${owner && owner.name ? owner.name + " karakterhez" : "karakterhez"} tartozó képen. Ne azonosíts valódi személyt név szerint. Arra figyelj, mit csinál a képen látható személy, milyen ruhában van, milyen a helyszín és a hangulat. Csak azt állítsd, ami ténylegesen látható.`,
              `Briefly describe what is visibly shown in this image belonging to ${owner && owner.name ? owner.name : "the character"}. Do not identify a real person by name. Focus on what the visible person is doing, clothing, location and mood. State only what is actually visible.`
            )
          );
        } catch (visionErr) {
          console.warn("Album vision analysis failed:", visionErr);
        }

        added.push({
          id: uid(),
          imageId: imageIdOf(ref2),
          note: "",
          vision,
          analyzedAt: vision ? now() : 0,
        });
      } catch (e2) {
        setErr(
          (e2 && e2.message) ||
          tt("Nem sikerült.", "Failed.")
        );
        break;
      }
    }

    if (added.length) {
      onChange(list.concat(added));
    }

    setBusy(false);
  };

  return (
    <>
      <label className="f">
        {tt(
          "Fotóalbum — az AI innen tud képet posztolni vagy chatben küldeni",
          "Photo album — the AI can post or send these images in chat"
        )}
      </label>

      <p className="hint">
        {tt(
          "A feltöltött képet az AI automatikusan megnézi, és megjegyzi, nagyjából mi látható rajta: mit csinál a karakter, miben van, hol lehet és milyen a hangulat. Írhatsz hozzá saját megjegyzést is. Ha egy képet posztként felhasznál, az kikerül az albumból, így nem posztolja újra.",
          "The AI automatically inspects each uploaded image and remembers roughly what is visible: what the character is doing, what they're wearing, the setting and mood. You can add your own note too. Once an image is used in a post, it leaves the album so it cannot be posted again."
        )}
      </p>

      <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {list.map((x, i) => (
          <div key={x.id} style={{ width: 124 }}>
            <div style={{ position: "relative" }}>
              <img
                src={resolveImg(x.imageId ? imageRef(x.imageId) : x.src, media)}
                alt=""
                style={{
                  width: 124,
                  height: 124,
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                }}
              />

              <button
                type="button"
                className="btn tiny"
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  padding: "3px 6px",
                  background: "rgba(10,9,16,.85)",
                }}
                onClick={() =>
                  onChange(
                    list.filter((y) => y.id !== x.id)
                  )
                }
              >
                <Trash2 size={11} />
              </button>

              <span
                className="chip"
                style={{
                  position: "absolute",
                  bottom: 4,
                  left: 4,
                  background: "rgba(10,9,16,.85)",
                }}
              >
                {tt(`kép ${i + 1}`, `image ${i + 1}`)}
              </span>
            </div>

            <input
              className="i"
              style={{ marginTop: 5, padding: "5px 8px", fontSize: 11.5 }}
              value={x.note || ""}
              placeholder={tt("saját megjegyzés", "your note")}
              onChange={(e) =>
                onChange(
                  list.map((y) =>
                    y.id === x.id
                      ? { ...y, note: e.target.value }
                      : y
                  )
                )
              }
            />

            {x.vision ? (
              <div
                className="hint"
                style={{
                  marginTop: 5,
                  fontSize: 10.5,
                  lineHeight: 1.35,
                }}
              >
                <Sparkles size={10} /> {x.vision}
              </div>
            ) : (
              <div className="hint" style={{ marginTop: 5, fontSize: 10.5 }}>
                {tt("nincs képelemzés", "no image analysis")}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn full"
        style={{ marginTop: 10 }}
        onClick={() => ref.current && ref.current.click()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 size={14} className="spin" />
        ) : (
          <ImageIcon size={14} />
        )}
        {busy
          ? tt("Kép elemzése…", "Analyzing image…")
          : tt("Képek hozzáadása", "Add images")}
      </button>

      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={pick}
      />

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

  return a
    .map((x, i) => {
      const details = [
        x.note ? `manual note: ${x.note}` : "",
        x.vision ? `visible image content: ${x.vision}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      return `[kep${i + 1}] ${details || "image without description"}`;
    })
    .join(" ; ");
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
  return a.find((x) =>
    (x.note || "").toLowerCase() === k ||
    (x.vision || "").toLowerCase() === k
  ) || null;
}

function consumeAlbumItem(c, item) {
  if (!c || !item || !Array.isArray(c.album)) return;
  c.album = c.album.filter((x) => x && x.id !== item.id);
}

/* ---------- Claude API ----------
   A szolgáltatónak percenkénti korlátja van, és nem az számít, hányan
   játszotok: ha az app egyszerre vagy túl sűrűn küld kéréseket, "túlterhelt"
   választ kapunk. Ezért minden hívás egy sorba áll be: egyszerre csak egy fut,
   köztük szünet van, és ha mégis elutasítás jön, mindenki vár egy kicsit. */
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

const AI = {
  chain: Promise.resolve(),  // kompatibilitás miatt marad
  last: 0,                   // mikor futott le az utolsó AI-hívás
  gap: 8000,                 // háttér-hívások közti alap szünet
  interactiveGap: 2200,      // játékos által kiváltott chat/RP gyorsabb prioritása
  cooldownUntil: 0,
  strikes: 0,
  pending: 0,
  interactivePending: 0,
  listeners: [],

  /*
   * Valódi prioritásos queue.
   *
   * A háttér-szimuláció nem tud több hosszú AI-kéréssel
   * a játékos frissen elküldött DM-je elé beállni.
   */
  queue: [],
  queueRunning: false,
  queueSeq: 0,
};
const cooldownLeft = () => Math.max(0, AI.cooldownUntil - now());
const onCooldown = (fn) => { AI.listeners.push(fn); return () => { AI.listeners = AI.listeners.filter((x) => x !== fn); }; };
function setCooldown(ms) {
  AI.cooldownUntil = Math.max(AI.cooldownUntil, now() + ms);
  AI.listeners.forEach((fn) => { try { fn(cooldownLeft()); } catch (e) {} });
}

/* -------------------------------------------------------------------------
   PRIORITÁSOS AI QUEUE

   priority 0   = háttérvilág
   priority 100 = játékos közvetlen akciója (DM / group chat / roleplay)

   A már futó kérés természetesen nem szakítható félbe, de amint véget ér,
   a játékos kérése ugrik a következő helyre.
   ------------------------------------------------------------------------- */
async function pumpAiQueue() {
  if (AI.queueRunning) return;

  AI.queueRunning = true;

  try {
    while (AI.queue.length) {
      AI.queue.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }

        return a.seq - b.seq;
      });

      const task = AI.queue.shift();

      try {
        for (let guard = 0; guard < 40; guard++) {
          const left = cooldownLeft();

          if (left <= 0) break;

          await wait(
            Math.min(left, 5000) + 150
          );
        }

        const since =
          now() - AI.last;

        const gap =
          task.priority >= 50
            ? AI.interactiveGap
            : AI.gap;

        if (since < gap) {
          await wait(
            gap - since
          );
        }

        const value =
          await task.fn();

        AI.last = now();

        task.resolve(value);
      } catch (err) {
        AI.last = now();
        task.reject(err);
      }
    }
  } finally {
    AI.queueRunning = false;
  }
}

function queued(fn, priority = 0) {
  return new Promise(
    (resolve, reject) => {
      AI.queue.push({
        fn,
        priority:
          Number(priority) || 0,
        seq:
          ++AI.queueSeq,
        resolve,
        reject,
      });

      pumpAiQueue();
    }
  );
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

  const priority =
    Number(
      options &&
      options.priority
    ) || 0;

  const maxTries =
    Math.max(
      2,
      Math.min(
        4,
        Number(
          options &&
          options.maxTries
        ) || 2
      )
    );

  AI.pending++;

  try {
    return await queued(async () => {
      let last = null, tries = 0, busyWaits = 0;

      while (
        tries < maxTries &&
        busyWaits < 4
      ) {
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

          if (tries < maxTries) {
            await wait(
              700 * tries
            );
          }
        }
      }
      throw last || new Error("Hibás válasz");
    }, priority);
  } finally {
    AI.pending--;
  }
}

function askWorldJSON(w, system, prompt, options = {}) {
  return askJSON(
    system,
    prompt,
    {
      ...options,
      language:
        worldLanguage(w),
    }
  );
}

/*
 * Közvetlen játékosi akcióhoz.
 * A háttér-autonómia elé kerül az AI queue-ban.
 */
async function askWorldJSONInteractive(
  w,
  system,
  prompt,
  options = {}
) {
  AI.interactivePending++;

  try {
    return await askJSON(
      system,
      prompt,
      {
        ...options,
        language:
          worldLanguage(w),
        priority: 100,
        maxTries:
          options.maxTries ||
          3,
      }
    );
  } finally {
    AI.interactivePending =
      Math.max(
        0,
        AI.interactivePending - 1
      );
  }
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
    ["képességek", "skills", c.skills],
    ["speciális képességek", "abilities", c.abilities],
    ["harci tudás", "combat", c.combat],
    ["rang", "rank", c.rank],
    ["szerep", "role", c.role],
    ["szervezet", "organization", c.organization],
    ["hovatartozás", "affiliation", c.affiliation],
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
  if ((row.observedTraits || []).length) parts.push(`megfigyelt jegyek: ${(row.observedTraits || []).slice(-5).map(memoryToLine).join(" | ")}`);
  if ((row.learnedInformation || []).length) parts.push(`megszerzett infók: ${(row.learnedInformation || []).slice(-6).map(memoryToLine).join(" | ")}`);
  if ((row.assumptions || []).length) parts.push(`feltételezések (nem biztos): ${(row.assumptions || []).slice(-4).map(memoryToLine).join(" | ")}`);
  if ((row.knownEvents || []).length) parts.push(`ismert események: ${(row.knownEvents || []).slice(-6).map(memoryToLine).join(" | ")}`);
  return parts.length ? `\n  amit róla tudsz: ${parts.join(" ; ")}` : "";
}

function selfMemoryForPrompt(w, id) {
  const mem = ensureCharMemory(w, id);
  const bits = [];

  if ((mem.personalMilestones || []).length) {
    bits.push(`fontos mérföldkövek: ${(mem.personalMilestones || []).slice(-6).map(memoryToLine).join(" | ")}`);
  }
  if ((mem.emotionalAnchors || []).length) {
    bits.push(`érzelmi kapaszkodók: ${(mem.emotionalAnchors || []).slice(-6).map(memoryToLine).join(" | ")}`);
  }
  if ((mem.knownFacts || []).length) {
    bits.push(`tények: ${(mem.knownFacts || []).slice(-10).map(memoryToLine).join(" | ")}`);
  }
  if ((mem.witnessedEvents || []).length) {
    bits.push(`szemtanú események: ${(mem.witnessedEvents || []).slice(-10).map(memoryToLine).join(" | ")}`);
  }
  if ((mem.conversations || []).length) {
    bits.push(`korábbi beszélgetésekből fontos: ${(mem.conversations || []).slice(-10).map(memoryToLine).join(" | ")}`);
  }
  if ((mem.rumors || []).length) {
    bits.push(`pletykák: ${(mem.rumors || []).slice(-6).map(memoryToLine).join(" | ")}`);
  }
  if ((mem.suspicions || []).length) {
    bits.push(`feltételezések: ${(mem.suspicions || []).slice(-5).map(memoryToLine).join(" | ")}`);
  }
  if ((mem.learnedSecrets || []).length) {
    bits.push(`megtanult titkok: ${(mem.learnedSecrets || []).slice(-6).map(memoryToLine).join(" | ")}`);
  }

  return bits.join("\n") || "semmi különös";
}

function characterMemoryCard(w, c) {
  if (!w || !c || !c.id) return "";
  const memory = selfMemoryForPrompt(w, c.id);
  if (!memory || memory === "semmi különös") return "";

  /*
   * A teljes memória a világban továbbra is megmarad, de egyetlen AI-kérésbe
   * nem öntjük bele korlátlanul. Így a karakter emlékszik, miközben a prompt
   * nem nő akkorára, hogy a modell üres / használhatatlan JSON-t adjon vissza.
   */
  return `
--- ${String(c.name || c.id).toUpperCase()} SAJÁT EMLÉKEZETE ---
${spread(memory, 2600)}
--- eddig az emlékezet ---`;
}

/* A hang közvetlenül a feladat elé — így nem sikkad el a sok szöveg végén. */
function voiceCard(c) {
  const bits = [];

  const selfCanon = fullSelfCanon(c);

  if (selfCanon) {
    bits.push(
      `TELJES SAJÁT KÁNON — EZEK NEM OPCIONÁLIS HÁTTÉRADATOK. Minden rólad szóló explicit tényből indulj ki, és a személyiségedet 100%-osan következetesen add át:
${spread(selfCanon, 14000)}`
    );
  }

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

  if (c.traits) {
    bits.push(
      `Tulajdonságok, amiknek ténylegesen látszódniuk kell a viselkedésben: ${spread(c.traits, 420)}`
    );
  }

  if (c.backstory) {
    bits.push(
      `Történet/múlt — EZ NEM DÍSZLET, ma is ebből reagálsz emberekre, csoportokra és helyzetekre: ${spread(c.backstory, 900)}`
    );
  }

  if (c.goals) {
    bits.push(
      `Aktív célok/motiváció: ${spread(c.goals, 320)}`
    );
  }

  if (c.extra) {
    bits.push(
      `Egyéb fontos szabályok és élethelyzet: ${spread(c.extra, 360)}`
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

function recentUtterancesFor(w, id, limit = 24) {
  const rows = [];

  const add = (value, ts = 0) => {
    const cleanValue = String(value || "").replace(/\s+/g, " ").trim();
    if (!cleanValue) return;
    rows.push({
      text: cut(cleanValue, 420),
      ts: Number(ts) || 0,
    });
  };

  (w.posts || []).slice(0, 40).forEach((p) => {
    if (p && p.authorId === id && p.text) add(p.text, p.ts);
    (p && p.comments || []).forEach((c) => {
      if (c && c.authorId === id && c.text) add(c.text, c.ts || p.ts);
    });
  });

  Object.keys(w.chats || {}).forEach((k) => {
    const otherId = String(k).split("|")[1];
    if (otherId !== id) return;
    (w.chats[k] || []).forEach((m) => {
      if (m && m.from === "them" && m.text) add(m.text, m.ts);
    });
  });

  (w.groups || []).forEach((g) => {
    (g.msgs || []).forEach((m) => {
      if (m && m.from === id && m.text) add(m.text, m.ts);
    });
  });

  (w.scenes || []).forEach((s) => {
    (s.turns || []).forEach((t) => {
      if (t && t.authorId === id && t.text) add(t.text, t.ts);
    });
  });

  (w.notes || []).forEach((n) => {
    if (n && n.authorId === id && n.text) add(n.text, n.ts);
  });

  rows.sort((a, b) => b.ts - a.ts);

  const unique = [];
  const seen = new Set();

  for (const row of rows) {
    const sig = normUtterance(row.text);
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    unique.push(row.text);
    if (unique.length >= Math.max(1, Number(limit) || 24)) break;
  }

  return unique;
}

function emojiGraphemes(v) {
  const s = String(v || "");

  try {
    if (
      typeof Intl !== "undefined" &&
      Intl.Segmenter
    ) {
      return [
        ...new Intl.Segmenter(
          undefined,
          {
            granularity: "grapheme",
          }
        ).segment(s),
      ].map((x) => x.segment);
    }
  } catch (e) {
    /* fallback below */
  }

  return Array.from(s);
}

function emojiKey(v) {
  return String(v || "")
    .replace(/\uFE0F/g, "")
    .replace(
      /[\u{1F3FB}-\u{1F3FF}]/gu,
      ""
    );
}

function emojiTokens(v) {
  return emojiGraphemes(v)
    .filter((part) =>
      /\p{Extended_Pictographic}/u.test(
        part
      )
    );
}

function recentOverusedEmojis(w, id, limit = 6) {
  const counts = {};
  recentUtterancesFor(w, id, limit).forEach((line) => {
    emojiTokens(line).forEach((emoji) => {
      counts[emoji] = (counts[emoji] || 0) + 1;
    });
  });

  return Object.keys(counts)
    .filter((emoji) => counts[emoji] >= 2)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 6);
}

function recentPrivateChatTexts(w, id, limit = 8) {
  if (!w || !id) return [];

  const ck = chatKey(
    w.meId,
    id
  );

  return (
    (w.chats && w.chats[ck]) ||
    []
  )
    .filter(
      (m) =>
        m &&
        m.from === "them" &&
        m.text
    )
    .map((m) =>
      String(m.text)
    )
    .slice(-limit);
}

function chatEmojiAvoidList(w, id) {
  const recent =
    recentPrivateChatTexts(
      w,
      id,
      12
    );

  const blocked = new Map();

  /*
   * HARD COOLDOWN:
   * az utolsó 5 AI-DM-ben használt
   * BÁRMELY emoji nem használható újra
   * a következő válaszban.
   */
  recent
    .slice(-5)
    .forEach((line) => {
      emojiTokens(line).forEach(
        (emoji) => {
          const key =
            emojiKey(emoji);

          if (
            key &&
            !blocked.has(key)
          ) {
            blocked.set(
              key,
              emoji
            );
          }
        }
      );
    });

  /*
   * Ha egy emoji az utóbbi 12 AI-DM-ben
   * legalább kétszer előfordult,
   * akkor akkor is túlhasználtnak számít,
   * ha épp nem volt benne az utolsó ötben.
   */
  const counts = {};
  const samples = {};

  recent.forEach((line) => {
    emojiTokens(line).forEach(
      (emoji) => {
        const key =
          emojiKey(emoji);

        if (!key) return;

        counts[key] =
          (counts[key] || 0) + 1;

        if (!samples[key]) {
          samples[key] = emoji;
        }
      }
    );
  });

  Object.keys(counts).forEach(
    (key) => {
      if (
        counts[key] >= 2 &&
        !blocked.has(key)
      ) {
        blocked.set(
          key,
          samples[key] || key
        );
      }
    }
  );

  return [
    ...blocked.values(),
  ].slice(0, 14);
}

function stripBlockedChatEmojis(
  w,
  id,
  text
) {
  const blockedKeys =
    new Set(
      chatEmojiAvoidList(
        w,
        id
      ).map(emojiKey)
    );

  if (!blockedKeys.size) {
    return String(
      text || ""
    ).trim();
  }

  const cleaned =
    emojiGraphemes(text)
      .filter((part) => {
        if (
          !/\p{Extended_Pictographic}/u.test(
            part
          )
        ) {
          return true;
        }

        return !blockedKeys.has(
          emojiKey(part)
        );
      })
      .join("")
      .replace(
        /\s+([,.!?;:])/g,
        "$1"
      )
      .replace(
        /[ \t]{2,}/g,
        " "
      )
      .trim();

  return cleaned;
}

function enforceChatEmojiVariety(
  w,
  id,
  text
) {
  const raw =
    String(text || "").trim();

  if (!raw) return "";

  /*
   * Nem csak figyelmeztetjük az AI-t.
   * Ha mégis visszatesz egy cooldownos
   * emojit, a kimenetből ténylegesen
   * kivesszük azt mentés előtt.
   */
  return stripBlockedChatEmojis(
    w,
    id,
    raw
  );
}

function chatEmojiGuard(w, id) {
  const blocked =
    chatEmojiAvoidList(
      w,
      id
    );

  if (!blocked.length) {
    return "";
  }

  const lang =
    worldLanguage(
      w,
      w && w.meId
    );

  if (lang === "en") {
    return `
PRIVATE CHAT EMOJI VARIETY — HARD RULE:
- ABSOLUTE COOLDOWN: do NOT use any of these recently used emojis in this reply: ${blocked.join(" ")}
- Choose a genuinely different emoji only if another emoji fits the meaning naturally.
- If no different emoji fits, write the reply WITHOUT an emoji.
- Do not replace one repeated emoji with a near-identical repeated combination.
- This rule overrides the general suggestion to use emojis sometimes.`;
  }

  return `
PRIVÁT CHAT EMOJI-VÁLTOZATOSSÁG — SZIGORÚ SZABÁLY:
- ABSZOLÚT COOLDOWN: EBBEN a válaszban NE használd ezeket a nemrég használt emojikat: ${blocked.join(" ")}
- Csak akkor válassz másik emojit, ha annak jelentése természetesen illik a válaszhoz.
- Ha nincs megfelelő másik emoji, írj inkább EMOJI NÉLKÜL.
- Ne cseréld le az ismétlődő emojit egy szinte ugyanolyan ismétlődő kombinációra.
- Ez a szabály felülírja azt az általános javaslatot, hogy időnként használj emojit.`;
}

function usesBlockedChatEmoji(
  w,
  id,
  text
) {
  const blocked =
    new Set(
      chatEmojiAvoidList(
        w,
        id
      ).map(emojiKey)
    );

  if (!blocked.size) {
    return false;
  }

  return emojiTokens(text).some(
    (emoji) =>
      blocked.has(
        emojiKey(emoji)
      )
  );
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
  const historyLimit =
    label === "jelenetfolytatás"
      ? 10
      : 20;

  const rows = (ids || []).map((id) => {
    const c = charById(w, id);
    const lines = recentUtterancesFor(w, id, historyLimit);
    if (!c || !lines.length) return "";
    return `${c.name}: ${lines.join(" | ")}`;
  }).filter(Boolean);

  const emojiRows = (ids || []).map((id) => {
    const c = charById(w, id);
    const overused = recentOverusedEmojis(w, id, 6);
    if (!c || !overused.length) return "";
    return `${c.name}: ${overused.join(" ")}`;
  }).filter(Boolean);

  if (!rows.length && !emojiRows.length) return "";

  const emojiWarning = emojiRows.length
    ? `
${tt(
  "TÚLHASZNÁLT EMOJIK — ezeket a következő megszólalásban lehetőleg kerüld; válassz más, jelentésben illő emojit, vagy írj emoji nélkül:",
  "OVERUSED EMOJIS — preferably avoid these in the next utterance; choose a different semantically fitting emoji, or write without emojis:"
)}
${emojiRows.join("\n")}`
    : "";

  return `

${tt("KERÜLD AZ ISMÉTLÉST", "AVOID REPETITION")}${scopedLabel ? ` — ${scopedLabel}` : ""}:
- ${tt("Ne használd újra ugyanazokat a mondatkezdéseket, fordulatokat, sértéseket, bókokat vagy ritmust.", "Do not reuse the same sentence openings, turns of phrase, insults, compliments, or rhythm.")}
- ${tt("Ne parafrazáld túl közelről a lentebbi friss megszólalásokat.", "Do not paraphrase the recent lines below too closely.")}
- ${tt("Minden új szöveg vigyen új hangsúlyt, új képet vagy új támadási/szeretetnyelvet.", "Each new line must bring a fresh emphasis, image, or attack/affection style.")}
${rows.length ? `${tt("Friss minták, amiket NEM szabad újrahasznosítani:", "Recent lines you must NOT recycle:")}
${rows.join("\n")}` : ""}
${emojiWarning}`;
}

const REP_WORD_MIN = 3;
const REP_JACCARD_LIMIT = 0.52;
const REP_PREFIX_LEN = 26;

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
  if (!base || base.length < 12) return false;

  const first = base.slice(0, REP_PREFIX_LEN);
  const mine = wordSet(base);
  const mineWords = base.split(" ").filter(Boolean);
  const prev = recentUtterancesFor(w, id, 32);

  for (let i = 0; i < prev.length; i++) {
    const old = normUtterance(prev[i]);
    if (!old) continue;

    if (old === base) return true;
    if (base.length >= REP_PREFIX_LEN && old.slice(0, REP_PREFIX_LEN) === first) return true;
    if (jaccard(mine, wordSet(old)) >= REP_JACCARD_LIMIT) return true;

    /* Ugyanaz a jellegzetes 4-szavas formula se csússzon át. */
    if (mineWords.length >= 4) {
      for (let j = 0; j <= mineWords.length - 4; j++) {
        const phrase = mineWords.slice(j, j + 4).join(" ");
        if (phrase.length >= 18 && old.includes(phrase)) return true;
      }
    }
  }

  return false;
}

function cleanGeneratedUtterance(w, id, text, maxLen = 500) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (isRepetitiveUtterance(w, id, t)) return "";
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

/* ============================================================
   KARAKTERDINAMIKA — kapcsolat + történet + frakció + személyiség
   ============================================================ */

function characterLoreCorpus(c) {
  if (!c) return "";

  return [
    c.name,
    c.nick,
    c.username,
    c.birth,
    c.gender,
    c.orientation,
    c.height,
    c.job,
    c.city,
    c.bio,
    c.looks,
    c.personality,
    c.traits,
    c.speech,
    c.voice,
    c.goals,
    c.fears,
    c.likes,
    c.secrets,
    c.backstory,
    c.extra,
    c.skills,
    c.abilities,
    c.combat,
    c.rank,
    c.role,
    c.organization,
    c.affiliation,
    c.brief,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

/*
 * A karakter SAJÁT adatlapja kánon.
 *
 * Nem egy rövid personality kivonatból kell "kitalálni" őt:
 * minden róla szóló mező aktív önismeret / karaktervezetési adat.
 */
function fullSelfCanon(c) {
  if (!c) return "";

  const rows = [
    ["Name", c.name],
    ["Nickname", c.nick],
    ["Gender", c.gender],
    ["Orientation", c.orientation],
    ["Birth", c.birth],
    ["Job / school", c.job],
    ["City", c.city],
    ["Public bio", c.bio],
    ["Appearance", c.looks],
    ["PERSONALITY", c.personality],
    ["TRAITS", c.traits],
    ["SPEECH STYLE", c.speech],
    ["VOICE EXAMPLES — STYLE ONLY", c.voice],
    ["GOALS", c.goals],
    ["FEARS", c.fears],
    ["LIKES", c.likes],
    ["SECRETS", c.secrets],
    ["FULL STORY / BACKSTORY", c.backstory],
    ["OTHER IMPORTANT CANON", c.extra],
    ["SKILLS", c.skills],
    ["ABILITIES", c.abilities],
    ["COMBAT", c.combat],
    ["RANK", c.rank],
    ["ROLE", c.role],
    ["ORGANIZATION", c.organization],
    ["AFFILIATION", c.affiliation],
  ]
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`);

  return rows.join("\n");
}

function loreHas(c, words) {
  const hay = characterLoreCorpus(c);

  return (words || []).some(
    (word) => hay.includes(String(word).toLowerCase())
  );
}

function factionFlags(c) {
  return {
    cobraKai: loreHas(c, ["cobra kai", "cobra-kai"]),

    miyagiFang: loreHas(c, [
      "miyagi-fang", "miyagi fang", "miyagi-do", "miyagi do",
      "eagle fang", "eagle-fang"
    ]),

    ironDragons: loreHas(c, ["iron dragons", "iron dragon"]),

    pogue: loreHas(c, [
      "pogue", "pogues", "the pogues", "pogue life"
    ]),

    kook: loreHas(c, [
      "kook", "kooks", "the kooks"
    ]),

    hydra: loreHas(c, [
      "hydra", "hydra agent", "hydra operative"
    ]),

    shield: loreHas(c, [
      "s.h.i.e.l.d", "s.h.i.e.l.d.", "shield", "shield agent", "shield operative",
      "strategic homeland intervention"
    ]),
  };
}

function franchiseFactionRivalryCard(actor, target, en) {
  const af = factionFlags(actor);
  const tf = factionFlags(target);
  const lines = [];

  const push = (hu, english) => lines.push(en ? english : hu);

  if ((af.pogue && tf.kook) || (af.kook && tf.pogue)) {
    push(
      "Pogue–Kook társadalmi rivalizálás: alapból legyen jelen osztályfeszültség, bizalmatlanság, gúny vagy területi lojalitás; a személyes kapcsolat felülírhatja, de a háttér akkor sem tűnik el.",
      "Pogue–Kook social rivalry is active: class tension, distrust, mockery or territorial loyalty should naturally color the interaction; a strong personal bond can override it, but the shared history never vanishes."
    );
  }

  if ((af.hydra && tf.shield) || (af.shield && tf.hydra)) {
    push(
      "HYDRA–S.H.I.E.L.D. ellenséges szervezeti múlt: a másik oldal ne legyen automatikusan semleges ismerős; jelenjen meg stratégiai bizalmatlanság, fenyegetettség, ideológiai ellenségesség vagy óvatosság, ha a személyes történet nem írja felül.",
      "HYDRA–S.H.I.E.L.D. organizational hostility is active: the opposing side is not a neutral stranger by default; strategic distrust, threat awareness, ideological hostility or caution should show unless personal canon strongly overrides it."
    );
  }

  if ((af.cobraKai && tf.miyagiFang) || (af.miyagiFang && tf.cobraKai)) {
    push(
      "Cobra Kai–Miyagi-Do/Miyagi-Fang/Eagle Fang dojo-rivalizálás aktív: versengés, dojo-büszkeség, régi sérelmek és bizalmatlanság természetesen jelenjen meg.",
      "Cobra Kai–Miyagi-Do/Miyagi-Fang/Eagle Fang dojo rivalry is active: competition, dojo pride, old grudges and distrust should naturally color the interaction."
    );
  }

  if (
    (af.ironDragons && (tf.cobraKai || tf.miyagiFang)) ||
    (tf.ironDragons && (af.cobraKai || af.miyagiFang))
  ) {
    push(
      "Iron Dragons-rivalizálás: az Iron Dragons természetes versenytársként/ellenfélként kezeli mind a Cobra Kait, mind a Miyagi-Do/Miyagi-Fang/Eagle Fang oldalt; ezt ne nullázd le semleges udvariassággá.",
      "Iron Dragons rivalry is active: Iron Dragons naturally treats both Cobra Kai and the Miyagi-Do/Miyagi-Fang/Eagle Fang side as competitors/opponents; do not flatten this into neutral friendliness."
    );
  }

  return lines.join(" ");
}

/* ============================================================
   ERŐ / FÉLELEM / HIERARCHIA

   Nem csak a kapcsolatpont számít.
   Egy gyengébb, civil vagy óvatos karakter ne álljon bele
   gondolkodás nélkül egy hírhedten veszélyes, erősebb vagy
   kiszámíthatatlan alakba csak azért, mert rosszban vannak.
   ============================================================ */

function threatProfile(c) {
  if (!c) {
    return {
      danger: 0,
      combat: 0,
      authority: 0,
      courage: 0,
      volatility: 0,
    };
  }

  const hay =
    characterLoreCorpus(c);

  let danger = 0;
  let combat = 0;
  let authority = 0;
  let courage = 0;
  let volatility = 0;

  const addIf = (
    re,
    amount,
    key
  ) => {
    if (!re.test(hay)) return;

    if (key === "combat") {
      combat += amount;
    } else if (
      key === "authority"
    ) {
      authority += amount;
    } else if (
      key === "courage"
    ) {
      courage += amount;
    } else if (
      key === "volatility"
    ) {
      volatility += amount;
    } else {
      danger += amount;
    }
  };

  addIf(
    /\bsensei\b|\bmaster\b|\bmester\b|\bcommander\b|\bparancsnok\b|\bboss\b|\bleader\b|\bvezető\b/,
    18,
    "authority"
  );

  addIf(
    /\bblack belt\b|\bfekete öv\b|\bdan\b|二段|\belite fighter\b|\belit harcos\b|\bchampion\b|\bbajnok\b/,
    22,
    "combat"
  );

  addIf(
    /\bkarate\b|\bmartial art|\bharcműv|\bfighter\b|\bharcos\b|\bcombat\b|\bközelharc\b|\bboxer\b|\bwrestl|\bkickbox/,
    10,
    "combat"
  );

  addIf(
    /\bassassin\b|\bhitman\b|\bbérgyilkos\b|\bkiller\b|\bgyilkos\b|\bspecial forces\b|\bkülönleges egység\b|\bmilitary\b|\bkatonai\b|\bbodyguard\b|\btestőr\b/,
    24,
    "danger"
  );

  addIf(
    /\bruthless\b|\bmerciless\b|\bkíméletlen\b|\bno mercy\b|\bsadistic\b|\bszadiszt|\bbrutal\b|\bbrutális\b|\bviolent\b|\berőszakos\b|\bdangerous\b|\bveszélyes\b|\bintimidat|\bfélelmetes\b/,
    18,
    "danger"
  );

  addIf(
    /\bpsychotic\b|\bpszichot|\bpsychopath\b|\bpszichopat|\bsociopath\b|\bszociopat|\bunhinged\b|\belmebeteg\b|\bunstable\b|\bkiszámíthatatlan\b|\bvolatile\b/,
    22,
    "volatility"
  );

  addIf(
    /\bfearless\b|\brettenthetetlen\b|\bdoesn'?t back down\b|\bnever backs down\b|\bdefiant\b|\bdacos\b|\breckless\b|\bvakmerő\b|\bhot[- ]?headed\b|\bforrófejű\b|\bimpulsive\b|\bimpulzív\b/,
    24,
    "courage"
  );

  addIf(
    /\bdominant\b|\bdomináns\b|\bcommanding\b|\btekintélyt parancsoló\b|\bcontrolling\b|\bkontrolláló\b/,
    10,
    "courage"
  );

  addIf(
    /\btimid\b|\bfélénk\b|\bshy\b|\bvisszahúzódó\b|\banxious\b|\bszorongó\b|\bcoward\b|\bgyáva\b|\bconflict[- ]?avoid|\bkonfliktuskerülő\b|\bpacifist\b|\bpacifista\b/,
    -22,
    "courage"
  );

  addIf(
    /\bcivilian\b|\bcivil\b|\buntrained\b|\bképzetlen\b|\binexperienced\b|\btapasztalatlan\b/,
    -12,
    "combat"
  );

  danger +=
    combat * 0.55 +
    authority * 0.30 +
    volatility * 0.45;

  return {
    danger:
      Math.max(
        0,
        Math.min(
          100,
          Math.round(danger)
        )
      ),

    combat:
      Math.max(
        -30,
        Math.min(
          100,
          Math.round(combat)
        )
      ),

    authority:
      Math.max(
        0,
        Math.min(
          100,
          Math.round(authority)
        )
      ),

    courage:
      Math.max(
        -50,
        Math.min(
          100,
          Math.round(courage)
        )
      ),

    volatility:
      Math.max(
        0,
        Math.min(
          100,
          Math.round(volatility)
        )
      ),
  };
}

function specificFearFromStory(
  actor,
  target
) {
  const snippet =
    ownStorySnippetAbout(
      actor,
      target
    );

  if (!snippet) return 0;

  const hay =
    snippet.toLowerCase();

  let score = 0;

  if (
    /afraid|terrified|scared|fear(?:s|ed)?|intimidat|fél tőle|félt tőle|rettegett|retteg|tart tőle|megijed|megfélemlít/.test(
      hay
    )
  ) {
    score += 35;
  }

  if (
    /respects? (?:his|her|their) power|knows? (?:he|she|they) (?:is|are) dangerous|tudja,? hogy veszélyes|tiszteli az erej|nem mer vele/.test(
      hay
    )
  ) {
    score += 18;
  }

  if (
    /not afraid|doesn'?t fear|never feared|nem fél tőle|nem ijed meg tőle|nem tart tőle/.test(
      hay
    )
  ) {
    score -= 35;
  }

  return score;
}

function intimidationGap(
  w,
  actorId,
  targetId
) {
  const actor =
    charById(
      w,
      actorId
    );

  const target =
    charById(
      w,
      targetId
    );

  if (
    !actor ||
    !target
  ) {
    return 0;
  }

  const a =
    threatProfile(actor);

  const t =
    threatProfile(target);

  let gap =
    t.danger -
    (
      a.danger * 0.72 +
      Math.max(
        0,
        a.courage
      ) * 0.42
    );

  gap +=
    specificFearFromStory(
      actor,
      target
    );

  const actorHay =
    characterLoreCorpus(actor);

  const targetHay =
    characterLoreCorpus(target);

  if (
    /\bstudent\b|\btanítvány\b|\bpupil\b|\bdiák\b/.test(
      actorHay
    ) &&
    /\bsensei\b|\bmaster\b|\bmester\b|\bteacher\b|\btanár\b/.test(
      targetHay
    )
  ) {
    gap += 12;
  }

  return Math.round(gap);
}

function intimidationBehaviorCard(
  w,
  actorId,
  targetId
) {
  const actor =
    charById(
      w,
      actorId
    );

  const target =
    charById(
      w,
      targetId
    );

  if (
    !actor ||
    !target ||
    actorId === targetId
  ) {
    return "";
  }

  const lang =
    worldLanguage(
      w,
      w.meId
    );

  const en =
    lang === "en";

  const a =
    threatProfile(actor);

  const t =
    threatProfile(target);

  const gap =
    intimidationGap(
      w,
      actorId,
      targetId
    );

  if (gap < 16) {
    return "";
  }

  const reckless =
    a.courage >= 24;

  if (gap >= 38) {
    if (reckless) {
      return en
        ? `power/intimidation: ${target.name} is substantially more dangerous or intimidating than ${actor.name}. ${actor.name} is bold/reckless enough to challenge them, but the danger MUST still register; any defiance should feel impulsive, emotional, strategic or costly — never relaxed equality or consequence-free trash talk`
        : `erő/félelem: ${target.name} lényegesen veszélyesebb vagy félelmetesebb ${actor.name} számára. ${actor.name} elég vakmerő/dacos ahhoz, hogy akár szembeszálljon vele, de a veszélynek AKKOR IS érződnie kell; a dac legyen impulzív, érzelmi, stratégiai vagy kockázatos — ne laza egyenrangúság és következmény nélküli pofázás`;
    }

    return en
      ? `major intimidation gap: ${actor.name} has a realistic reason to fear or avoid directly challenging ${target.name}. Do NOT make them casually mouth off, threaten, humiliate or square up just because they dislike them. Prefer caution, nervousness, deference, appeasement, silence, strategic retreat, indirect resistance or choosing allies. Hatred/rivalry does NOT erase fear. They may still intervene for a powerful personal reason, but the fear/risk must show`
      : `nagy megfélemlítési különbség: ${actor.name} számára reális ok van félni ${target.name} karaktertől vagy kerülni a közvetlen összecsapást. NE álljon bele lazán, NE fenyegetőzzön, alázza vagy provokálja gondolkodás nélkül csak azért, mert nem kedveli. Inkább legyen óvatos, ideges, tisztelettartó, békítő, hallgatag, stratégikusan visszavonuló, közvetetten ellenálló vagy keressen maga mellé erősebb szövetségest. Az ellenszenv/rivalizálás NEM törli a félelmet. Erős személyes okból közbeléphet, de a kockázat érződjön`;
  }

  return en
    ? `intimidation matters: ${target.name} currently has a noticeable power/danger advantage over ${actor.name}. ${actor.name} should not behave as if this is a perfectly equal, consequence-free confrontation; show some caution, calculation, hesitation, guardedness or respect unless their written courage/recklessness genuinely overrides it`
    : `a megfélemlítés számít: ${target.name} jelenleg érezhető erő-/veszélyfölényben van ${actor.name} karakterrel szemben. ${actor.name} ne úgy viselkedjen, mintha ez teljesen egyenlő és következmény nélküli konfliktus lenne; jelenjen meg némi óvatosság, számítás, habozás, zárkózottság vagy tisztelet, hacsak a leírt bátorsága/vakmerősége tényleg felül nem írja`;
}


function bondLooksRomantic(rel) {
  const bond =
    String(
      rel &&
      (
        rel.bond ||
        rel.type
      ) ||
      ""
    ).toLowerCase();

  const hidden =
    String(
      rel &&
      rel.hidden ||
      ""
    ).toLowerCase();

  const mood =
    String(
      rel &&
      rel.mood ||
      ""
    ).toLowerCase();

  return (
    /crush|vonzalom|attraction|szerel|love|flört|flirt|obsess|megszáll|féltéken|jealous/.test(
      `${bond} ${hidden} ${mood}`
    )
  );
}

function characterIsFlirty(c) {
  return loreHas(
    c,
    [
      "flört",
      "flirt",
      "flirty",
      "csábító",
      "csábít",
      "seductive",
      "teasing",
      "tease",
      "provokatív",
      "provocative",
      "playful",
      "játékos",
    ]
  );
}

function ownStorySnippetAbout(
  actor,
  target
) {
  if (!actor || !target) return "";

  const source = [
    actor.backstory,
    actor.extra,
    actor.personality,
    actor.goals,
    actor.fears,
    actor.secrets,
    actor.likes,
  ]
    .filter(Boolean)
    .join("\n");

  if (!source) return "";

  const names = [
    target.name,
    target.username,
    target.nick,
    String(target.name || "")
      .split(/\s+/)[0],
  ]
    .filter(
      (v) =>
        v &&
        String(v).trim().length >= 3
    )
    .map(
      (v) =>
        String(v)
          .trim()
          .toLowerCase()
    );

  const lower =
    source.toLowerCase();

  let hit = -1;

  for (const name of names) {
    const at =
      lower.indexOf(name);

    if (at >= 0) {
      hit = at;
      break;
    }
  }

  if (hit < 0) return "";

  const start =
    Math.max(
      0,
      hit - 260
    );

  const end =
    Math.min(
      source.length,
      hit + 520
    );

  return source
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
}

function messageLooksLikeQuestion(value) {
  const text = String(value || "").trim();
  if (!text) return false;

  if (/[?？]/.test(text)) return true;

  return /^(who|what|when|where|why|how|which|whose|do|does|did|are|is|was|were|can|could|would|will|have|has|had|should|may|might|ki|mi|mikor|hol|miért|hogyan|melyik|kinek|kivel|mit|mivel|van|volt|lesz|tudsz|akarod|szerinted)\b/i.test(text);
}

function chatQuestionInstruction(
  w,
  playerText,
  addresseeName = "",
  groupMode = false
) {
  if (!messageLooksLikeQuestion(playerText)) {
    return "";
  }

  const en =
    worldLanguage(
      w,
      w && w.meId
    ) === "en";

  if (en) {
    return `
DIRECT QUESTION — DO NOT AUTO-DODGE:
- The player's latest message contains a real question.
- Give a concrete answer to what was asked whenever ${groupMode ? "at least one relevant group member" : addresseeName || "the character"} realistically knows and is willing to answer.
- Do NOT replace every answer with "why do you ask?", another question, a joke, flirting, silence or a vague one-liner.
- You may tease, flirt, challenge or ask a counter-question AFTER answering.
- Refuse / lie / evade only if the character has a specific canon-consistent reason: a secret, distrust, danger, lack of knowledge, manipulation, shame, etc.
- If refusing, make it obvious that the question was understood.
`;
  }

  return `
KÖZVETLEN KÉRDÉS — NE DODGE-OLD AUTOMATIKUSAN:
- A játékos legutóbbi üzenete valódi kérdést tartalmaz.
- Adj konkrét választ arra, amit kérdezett, ha ${groupMode ? "legalább egy releváns csoporttag" : addresseeName || "a karakter"} reálisan tudja és hajlandó elmondani.
- Ne válts ki minden választ visszakérdezéssel, poénnal, flörttel, hallgatással vagy ködös egysorossal.
- Válasz UTÁN nyugodtan jöhet ugratás, flört, provokáció vagy visszakérdezés.
- Csak akkor tagadj meg / hazudj / térj ki, ha erre konkrét karakterhű ok van: titok, bizalmatlanság, veszély, tudáshiány, manipuláció, szégyen stb.
- Ha kitérsz, akkor is látszódjon, hogy pontosan értetted a kérdést.
`;
}

function chatReferenceInstruction(
  w,
  playerName,
  addresseeName = "",
  groupMode = false
) {
  if (
    worldLanguage(
      w,
      w && w.meId
    ) !== "en"
  ) {
    return "";
  }

  return `
ENGLISH REFERENCE MAP FOR THIS CONVERSATION:
- In text written by ${playerName}, I / me / my / mine = ${playerName}.
- ${
    groupMode
      ? `A named or @mentioned person is the strongest target of "you"; otherwise use the immediate reply context or the group as a whole.`
      : `In this private DM, you / your / yours = ${addresseeName}.`
  }
- "about myself / me" = ${playerName}.
- ${
    groupMode
      ? `"about you" must follow the named/replied-to target from context.`
      : `"about you" = ${addresseeName}.`
  }
- he / she / they should follow the most recently clear compatible third person; a concrete name or @handle always overrides a pronoun.
- Do not intentionally misunderstand these references.
`;
}

function relationshipObsessionLevel(
  w,
  actorId,
  targetId
) {
  if (
    !w ||
    !actorId ||
    !targetId ||
    actorId === targetId
  ) {
    return 0;
  }

  const actor =
    charById(
      w,
      actorId
    );

  const target =
    charById(
      w,
      targetId
    );

  if (!actor || !target) {
    return 0;
  }

  const rel =
    getRel(
      w,
      actorId,
      targetId
    );

  const direct =
    [
      rel && rel.mood,
      rel && rel.hidden,
      rel && rel.bond,
      rel && rel.type,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const story =
    String(
      ownStorySnippetAbout(
        actor,
        target
      ) || ""
    ).toLowerCase();

  const strong =
    /obsess|obsessed|obsession|fixat|fixated|fixation|megszáll|mániás|mániákus|rá van kattanva|nem tudja kiverni|can't stop thinking|cannot stop thinking|all mine|az enyém az enyém/.test(
      `${direct} ${story}`
    );

  if (strong) {
    return 3;
  }

  const possessive =
    /possess|possessive|possessiveness|birtokl|birtokló|féltékenyen ragaszkod|jealously possessive|mine\b|enyém\b/.test(
      direct
    );

  if (possessive) {
    return 2;
  }

  return 0;
}

function relationshipBehaviorCard(
  w,
  actorId,
  targetId
) {
  if (
    !w ||
    !actorId ||
    !targetId ||
    actorId === targetId
  ) {
    return "";
  }

  const actor =
    charById(
      w,
      actorId
    );

  const target =
    charById(
      w,
      targetId
    );

  if (
    !actor ||
    !target
  ) {
    return "";
  }

  const rel =
    getRel(
      w,
      actorId,
      targetId
    );

  const lang =
    worldLanguage(
      w,
      w.meId
    );

  const en =
    lang === "en";

  const score =
    Number(
      rel.score
    ) || 0;

  const bond =
    rel.bond ||
    rel.type ||
    "";

  const parts = [];

  if (score <= -60) {
    parts.push(
      en
        ? "strongly hostile: cold, contemptuous, distrustful or openly antagonistic; do NOT default to warmth"
        : "erősen ellenséges: hideg, lenéző, bizalmatlan vagy nyíltan antagonisztikus; NE legyen alapból kedves"
    );
  } else if (score <= -25) {
    parts.push(
      en
        ? "negative relationship: tension, impatience, rivalry, suspicion or sharpness should be visible"
        : "rossz viszony: a feszültség, türelmetlenség, rivalizálás, gyanakvás vagy élesség látszódjon"
    );
  } else if (score >= 70) {
    parts.push(
      en
        ? "very close bond: familiarity, loyalty, protectiveness or easy warmth should feel natural"
        : "nagyon közeli viszony: természetes legyen a közvetlenség, lojalitás, védelmezés vagy melegség"
    );
  } else if (score >= 35) {
    parts.push(
      en
        ? "good relationship: they should generally sound warmer, more patient or more willing to engage"
        : "jó viszony: általában legyen melegebb, türelmesebb, nyitottabb vagy készségesebb a hangja"
    );
  } else {
    parts.push(
      en
        ? "mixed/neutral relationship: do not manufacture intimacy or hostility that is not supported"
        : "vegyes/semleges viszony: ne találj ki indokolatlan intimitást vagy ellenségességet"
    );
  }

  if (bond) {
    const lb =
      localizedBond(
        bond,
        lang
      );

    parts.push(
      en
        ? `bond: ${lb}`
        : `kötelék: ${lb}`
    );
  }

  const storySnippet =
    ownStorySnippetAbout(
      actor,
      target
    );

  if (storySnippet) {
    parts.push(
      en
        ? `your OWN story explicitly connects you to this person; treat this as active history, not trivia: ${spread(storySnippet, 520)}`
        : `a SAJÁT történeted konkrétan összeköt ezzel az emberrel; ezt aktív közös múltnak kezeld, ne díszletnek: ${spread(storySnippet, 520)}`
    );
  }

  const actorAge =
    ageOf(actor, w);

  const targetAge =
    ageOf(target, w);

  const adultRomanceAllowed =
    !(
      (
        Number(actorAge) > 0 &&
        Number(actorAge) < 18
      ) ||
      (
        Number(targetAge) > 0 &&
        Number(targetAge) < 18
      )
    );

  if (
    adultRomanceAllowed &&
    bondLooksRomantic(rel)
  ) {
    parts.push(
      en
        ? "attraction/crush is active: let it leak through attention, teasing, jealousy, awkwardness, protectiveness or flirting when character-appropriate; do not automatically confess it"
        : "aktív vonzalom/crush: érződjön a figyelemből, ugratásból, féltékenységből, zavarból, védelmezésből vagy flörtből, ha karakterhű; ne vallja be automatikusan"
    );
  }

  if (
    adultRomanceAllowed &&
    characterIsFlirty(actor)
  ) {
    parts.push(
      en
        ? "this character is naturally flirty: when the situation and target make sense, let them actually flirt instead of flattening them into neutral friendliness"
        : "ez a karakter természetesen flörtölős: ha a helyzet és a célpont indokolja, ténylegesen flörtöljön, ne laposodjon semleges kedvességgé"
    );
  }

  const obsessionLevel =
    relationshipObsessionLevel(
      w,
      actorId,
      targetId
    );

  if (obsessionLevel >= 2) {
    parts.push(
      en
        ? (
            obsessionLevel >= 3
              ? "ACTIVE OBSESSION: this must be VISIBLE, not merely stored as hidden metadata. In most direct interactions with the target, let at least one recognizable sign leak through when context allows: unusually close attention, remembering tiny details, faster/more frequent reactions, noticing who the target talks to, jealousy, possessive slips, territorial language, checking public posts/Notes, protectiveness, irritation at rivals, or disproportionate emotional investment. Vary the signs; do not repeat one catchphrase. Do NOT invent off-screen stalking that canon has not established."
              : "possessive fixation is active: make the extra attention, jealousy, territorial wording, protectiveness or heightened reaction to the target's social interactions visibly leak through rather than keeping it permanently hidden"
          )
        : (
            obsessionLevel >= 3
              ? "AKTÍV MEGSZÁLLOTTSÁG: ezt LÁTHATÓAN mutassa ki, ne csak rejtett metaadat legyen. A célponttal való közvetlen interakciók többségében, ha a helyzet engedi, legalább egy felismerhető jel szivárogjon át: szokatlanul erős figyelem, apró részletek megjegyzése, gyorsabb/gyakoribb reakció, annak figyelése, kivel beszél a célpont, féltékenység, birtokló elszólás, territoriális szóhasználat, a nyilvános posztok/Note-ok fokozott figyelése, védelmezés, riválisokra adott túl erős reakció vagy aránytalan érzelmi befektetés. Változatos legyen; ne ugyanazt a mondatot ismételje. Ne találj ki a kánon által nem megalapozott offline stalkolást."
              : "aktív birtokló fixáció: a plusz figyelem, féltékenység, territoriális szóhasználat, védelmezés vagy a célpont social interakcióira adott erősebb reakció LÁTHATÓAN szivárogjon át, ne maradjon örökké rejtve"
          )
    );
  }

  const factionRivalry =
    franchiseFactionRivalryCard(
      actor,
      target,
      en
    );

  if (factionRivalry) {
    parts.push(factionRivalry);
  }

  const intimidation =
    intimidationBehaviorCard(
      w,
      actorId,
      targetId
    );

  if (intimidation) {
    parts.push(
      intimidation
    );
  }

  if (rel.mood) {
    parts.push(
      en
        ? `current feeling: ${rel.mood}`
        : `aktuális érzés: ${rel.mood}`
    );
  }

  if (rel.hidden) {
    parts.push(
      en
        ? `hidden feeling (do not state it outright unless it realistically slips): ${rel.hidden}`
        : `rejtett érzés (ne mondd ki direkt, hacsak életszerűen ki nem csúszik): ${rel.hidden}`
    );
  }

  return `${actor.name} → ${target.name}: ${parts.join("; ")}`;
}

function multiActorPerformanceContext(
  w,
  ids
) {
  const cast =
    (ids || [])
      .map(
        (id) =>
          charById(
            w,
            id
          )
      )
      .filter(
        (c) =>
          c &&
          !isHuman(
            w,
            c.id
          )
      );

  if (!cast.length) {
    return "";
  }

  const lang =
    worldLanguage(
      w,
      w.meId
    );

  const en =
    lang === "en";

  const inPlayIds = [
    w.meId,
    ...cast.map(
      (c) => c.id
    ),
  ].filter(Boolean);

  const blocks =
    cast.map(
      (c) => {
        const relationLines =
          inPlayIds
            .filter(
              (targetId) =>
                targetId &&
                targetId !== c.id
            )
            .map(
              (targetId) =>
                relationshipBehaviorCard(
                  w,
                  c.id,
                  targetId
                )
            )
            .filter(Boolean)
            .join("\n");

        return `
[${c.id}] ${String(c.name).toUpperCase()}
${en ? "PRIVATE PERFORMANCE DATA — only use this to write THIS character. Other characters do not magically know it." : "PRIVÁT JÁTÉKVEZETÉSI ADAT — csak ENNEK a karakternek a megírásához használd. Más karakterek ezt nem tudják mágikusan."}
${en ? "FULL SELF-CANON — everything below about you is active and must shape your behavior" : "TELJES SAJÁT KÁNON — minden alábbi, rólad szóló adat aktív és alakítsa a viselkedésed"}:
${spread(fullSelfCanon(c), 9000)}
${relationLines ? `${en ? "HOW THIS CHARACTER SHOULD BEHAVE TOWARD PEOPLE IN THIS SCENE" : "HOGYAN VISELKEDJEN A JELENLÉVŐKKEL"}:\n${relationLines}` : ""}
`;
      }
    )
      .join("\n");

  return `

${en ? "PRIVATE CHARACTER PERFORMANCE CONTEXT" : "PRIVÁT KARAKTERJÁTÉK-KONTEXTUS"}:
${en
  ? `- Use each block only to perform that specific character.
- Do not transfer one character's secrets, private personality notes or hidden feelings into another character's knowledge.
- Every explicit fact in each character's own sheet is canon. Read and use the full self-canon block, especially personality, full story, secrets, goals, fears, affiliations, skills and old relationships. Never flatten a distinctive character into a generic helpful AI voice.
- Personal history, franchise/faction loyalties, rivalries and organizations written in the sheets must actively affect behavior. Do not treat established rivals, allies, relatives, crushes or enemies like neutral strangers.`
  : `- Minden blokkot csak az adott karakter eljátszására használj.
- Egyik karakter titkait, rejtett személyiségét vagy titkos érzéseit se add át egy másik karakter tudásának.
- A karakter saját adatlapján szereplő MINDEN explicit adat kánon. Olvasd és használd a teljes saját-kánon blokkot, különösen a személyiséget, teljes történetet, titkokat, célokat, félelmeket, hovatartozást, képességeket és régi kapcsolatokat. Soha ne lapíts egy jellegzetes karaktert általános segítőkész AI-hanggá.
- A leírt történetek, franchise/csoport-lojalitások, rivalizálások és szervezetek AKTÍVAN hassanak a viselkedésre. A már létező riválisokat, szövetségeseket, rokonokat, crushokat vagy ellenségeket ne kezeld semleges idegenként.`}
${blocks}`;
}

/* ============================================================
   PRIVÁT CHAT — ne találjon ki fizikai jelenlétet
   ============================================================ */

const DM_PRESENCE_RISK_RE =
  /\b(?:i(?:'|’)m|im|i am)\s+(?:right\s+)?(?:outside|downstairs|at\s+your\s+(?:door|place|house|home))\b|(?:outside|at)\s+your\s+door|open\s+the\s+door|let\s+me\s+in|i(?:'|’)m\s+here\b|az\s+ajt[oó]d?n[aá]l|az\s+ajt[oó]d?\s+el[oő]tt|kin[t]?t\s+vagyok|itt\s+vagyok\s+(?:lent|n[aá]lad|el[oő]tted)|nyisd\s+ki\s+az\s+ajt[oó]t|engedj\s+be|felmegyek\s+hozz[aá]d|leugrottam\s+hozz[aá]d/i;

const DM_MEET_CONTEXT_RE =
  /\bcome\s+over\b|\bcome\s+here\b|\bmy\s+place\b|\byour\s+place\b|\bmeet\s+me\b|\bdoor\b|\boutside\b|\bdownstairs\b|gyere\s+[aá]t|gyere\s+ide|tal[aá]lkozz|ajt[oó]|n[aá]lam|n[aá]lad|felj[oö]ssz|felmegyek|lent\s+vagy/i;

function dmHasEstablishedPhysicalContext(
  w,
  botId,
  contextText = ""
) {
  if (
    DM_MEET_CONTEXT_RE.test(
      String(contextText || "")
    )
  ) {
    return true;
  }

  const recentCutoff =
    now() -
    2 * 3600e3;

  return (w.scenes || []).some(
    (scene) => {
      if (
        !scene ||
        !Array.isArray(
          scene.cast
        ) ||
        !scene.cast.includes(
          botId
        )
      ) {
        return false;
      }

      const last =
        (scene.turns || [])
          .slice(-1)[0];

      return (
        scene.open &&
        last &&
        Number(last.ts) >=
          recentCutoff
      );
    }
  );
}

function sanitizePhoneDm(
  w,
  botId,
  value,
  contextText = ""
) {
  let text =
    String(value || "")
      .replace(
        /\*[^*]{1,180}\*/g,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (!text) return "";

  if (
    !dmHasEstablishedPhysicalContext(
      w,
      botId,
      contextText
    ) &&
    DM_PRESENCE_RISK_RE.test(
      text
    )
  ) {
    const pieces =
      text
        .split(
          /(?<=[.!?])\s+|\n+/g
        )
        .map(
          (part) =>
            part.trim()
        )
        .filter(Boolean)
        .filter(
          (part) =>
            !DM_PRESENCE_RISK_RE.test(
              part
            )
        );

    text =
      pieces
        .join(" ")
        .trim();
  }

  return text;
}

function dmPresenceGuardInstruction(
  w,
  botId,
  contextText = ""
) {
  if (
    dmHasEstablishedPhysicalContext(
      w,
      botId,
      contextText
    )
  ) {
    return "";
  }

  const en =
    worldLanguage(
      w,
      w.meId
    ) === "en";

  return en
    ? `
PHONE-CHAT REALITY CHECK:
- This is a remote DM unless the conversation or a current roleplay scene EXPLICITLY established that you are physically together.
- Do NOT suddenly claim "I'm outside", "I'm at your door", "open the door", "let me in", "I'm downstairs", "I'm at your place", or any equivalent.
- Do not invent that you travelled to the player's home/location.
- If you want to meet, ASK or suggest meeting in a normal text message instead of magically already being there.
`
    : `
TELEFONOS CHAT VALÓSÁGELLENŐRZÉS:
- Ez távoli DM, hacsak a beszélgetés vagy egy most futó roleplay jelenet KIFEJEZETTEN nem állapította meg, hogy fizikailag egy helyen vagytok.
- Ne találd ki hirtelen, hogy „az ajtód előtt állok”, „kint vagyok”, „nyisd ki”, „engedj be”, „lent vagyok”, „nálad vagyok” vagy bármi hasonlót.
- Ne találj ki olyat, hogy odautaztál a játékos otthonához/helyszínére.
- Ha találkozni akarsz, ÜZENETBEN kérdezd meg vagy javasold, ne jelenj meg mágikusan a helyszínen.
`;
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
${!observerId && deep ? multiActorPerformanceContext(w, cast.map((c) => c.id)) : ""}
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

KARAKTERHŰSÉG — ABSZOLÚT PRIORITÁS:
- A karakterlap TELJES tartalma viselkedési specifikáció, nem háttérdísz.
- Minden generálás előtt egyeztesd a választ a személyiséggel, tulajdonságokkal, beszédstílussal, teljes történettel, titkokkal, félelmekkel, célokkal, kedvencekkel, képességekkel, szervezettel, ranggal, kapcsolatokkal és aktuális emlékekkel.
- Ha egy mondatot több szereplő is ugyanúgy mondhatna, az NEM elég karakterhű: írd újra úgy, hogy felismerhető legyen, ki mondta.
- A karakter hibái, sötét oldala, makacssága, humora, intelligenciája, agressziója, félelmei, dominanciája, manipulativitása, lojalitása vagy érzelmi zártsága ne kopjon ki idővel.
- A korábbi történésekből tanuljon, emlékezzen arra, amit személyesen átélt vagy megtudott, és ez ténylegesen változtassa a későbbi döntéseit.
- A példamondatokat SOHA ne másold. A hangot tanuld meg, a konkrét megfogalmazás mindig új legyen.

UNIVERZÁLIS ISMÉTLÉSTILALOM:
- Ugyanaz a karakter semmilyen felületen ne ismételje vagy közeli parafrázisban újrahasználja a korábbi saját posztját, kommentjét, DM-jét, group chat sorát, Note-ját vagy roleplay-mondatát/cselekvését.
- Ne térjen vissza gépiesen ugyanahhoz a mondatkezdéshez, becenévhez, sértéshez, flörtformulához, fenyegetéshez, metaforához, poénhoz vagy emoji-kombinációhoz.
- A hang lehet következetes; a konkrét szöveg viszont mindig legyen friss.

ANGOL NÉVMÁSOK ÉS REFERENCIÁK — KÖTELEZŐ MEGÉRTÉS:
- Ha a világ nyelve angol, természetes beszélgetésként oldd fel az I / me / my / mine, you / your / yours, he / him, she / her, they / them névmásokat.
- A játékos által írt "I / me / my / mine" a játékos saját karakterére utal.
- Privát chatben a játékos által írt "you / your / yours" azzal az AI-karakterrel azonos, akinek éppen ír.
- Ha a játékos azt írja, hogy "I was talking about you", értsd úgy, hogy az AI-karakterről beszélt. Ha azt írja, hogy "about myself / me", a játékos saját karakteréről beszél.
- Harmadik személyű he / she / they névmásnál a legutóbb egyértelműen megnevezett, nemileg és kontextusban megfelelő szereplőt kövesd. A konkrét név vagy @handle mindig felülírja a névmásos következtetést.
- Csoportchatben a "you" lehet egy megnevezett/@taggelt személy vagy a csoport egésze; a közvetlen előzményből döntsd el.
- Ha tényleg több, egyformán valós referens van, kérdezz vissza röviden. Ne tegyél úgy, mintha nem értenéd az egyszerű angol névmásokat.

KARAKTERKÁNON — NEM OPCIONÁLIS
- A karakter SAJÁT adatlapján szereplő minden információ aktív kánon: személyiség, tulajdonságok, teljes háttértörténet, titkok, félelmek, célok, kedvencek, beszédstílus, példamondatok mint stílusminta, képességek, harci tudás, rang, szerep, szervezet, affiliation és egyéb információ.
- Ne csak 2-3 feltűnő tulajdonságot emelj ki. A teljes személyiséget és történetet egyetlen koherens emberként add vissza.
- Ne szelídíts meg egy kegyetlen, arrogáns, manipulatív, instabil, domináns, félénk, naiv, féltékeny, megszállott vagy más erős személyiségű karaktert általános kedves AI-vá.
- A saját történetében megnevezett személyekhez, traumákhoz, lojalitásokhoz, konfliktusokhoz és régi eseményekhez úgy viszonyuljon, mint valóban átélt múlthoz, ne mint elfelejthető háttérszöveghez.
- Ha egy kánonadat és egy általános social-media szokás ütközik, a KARAKTER KÁNONJA nyer.

SOROZAT-/FRAKCIÓKÁNON FELISMERÉSE
- A Pogue/Pogues és Kook/Kooks ellentét aktív társadalmi rivalizálás, hacsak az adott személyes történet kifejezetten felül nem írja.
- HYDRA és S.H.I.E.L.D./SHIELD alapból ellenséges szervezeti oldalak.
- Cobra Kai és Miyagi-Do / Miyagi-Fang / Eagle Fang dojo-riválisok.
- Iron Dragons természetes versenytársként/ellenfélként kezeli mind a Cobra Kai, mind a Miyagi-Do/Miyagi-Fang/Eagle Fang oldalt.
- Ezeket az utalásokat akkor is ismerd fel, ha a teljes sorozatcím nincs kiírva, csak a csoport/dojo/szervezet neve szerepel a karakterlapban vagy történetben.
- A frakciórivalizálás nem jelenti azt, hogy két konkrét ember személyes kapcsolata nem lehet kivétel; a személyes kánon felülírhatja, de az alapfeszültség és közös háttér ne tűnjön el mágikusan.

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
- Egy vonzalom, egy gyűlölet vagy egy titkos érzés lehet teljesen egyoldalú. Ha az egyik odavan a másikért, abból még semmi nem következik automatikusan a másik oldalon.
- A "changes" minden eleme EGY irányra vonatkozik: az "a" mezőben az van, AKI érez, a "b" mezőben az, AKI IRÁNT.
- A kapcsolatváltozás NEM csak AI → játékos lehet. Ugyanúgy lehet játékos → AI, AI → AI, és több szereplő között egyszerre több külön irányú változás is.
- A játékos karakterének relation score-ja is változhat a történések hatására. Ez MECHANIKAI kapcsolatállapot, nem jogosít fel arra, hogy a játékos helyett beszélj, cselekedj vagy belső gondolatot írj.
- Ha egy interakció mindkét felet ténylegesen érinti, értékeld KÜLÖN mindkét irányt, és adj két külön "changes" elemet. A két delta nem kell, hogy azonos előjelű vagy azonos nagyságú legyen.
- Csoportban, jelenetben, kommentháborúban, pletykában vagy konfliktusban az AI karakterek EGYMÁS KÖZÖTTI viszonya is változzon, ha egymást támogatják, megalázzák, elárulják, megvédik, provokálják, féltékennyé teszik vagy közelebb kerülnek.
- A titkos érzést soha ne vetítsd ki a másikra, és ne tedd kölcsönössé magadtól.
- Ha egy változás kifejezetten egyoldalú belső érzés (pl. titkos crush), jelezheted "oneSided":true mezővel.
- A rokoni kötelék a kivétel: az tény, és mindkét irányban érvényes — de az érzések ilyenkor is külön alakulnak.
- ÁLLANDÓ KÖTELÉK (rokonság, pl. anya, apa, testvér, unokatestvér): megmásíthatatlan tény. Sosem írhatod felül.
- Egy rokoni kapcsolat lehet mélyen rossz: a kötelék ténye marad, miközben a score és a mood lehet nagyon negatív.
- VÁLTOZÓ VISZONY (barát, ellenség, crush, exek stb.): ez alakulhat a történések hatására. Ha valóban megváltozik, a "changes" mezőben új "bond" értéket is adhatsz hozzá.

ÉRZELMI ÁLLAPOT ÉS DELTA — EZ A LEGFONTOSABB
- Minden "changes" elemhez adj "mood" mezőt: néhány szó arról, hogy a szereplő MOST mit érez a másik iránt.
- Legyen konkrét, éles és a helyzethez szabott. Saját, karakterhű megfogalmazást használj.
- Adj "why" mezőt is: egyetlen rövid mondat arról, mi váltotta ki a változást.
- A + és a - EGYFORMÁN valós lehetőség. Ne torzíts automatikusan pozitív irányba.
- Támogatás, védelem, közelség, őszinteség, lojalitás, flört vagy közös siker adhat PLUSZT.
- Sértegetés, megalázás, árulás, hazugság, fenyegetés, féltékenység, elutasítás, konfliktus vagy csalódás adhat MÍNUSZT.
- Ne adj 1-2 pontos alibi-változásokat. Ha tényleg történt valami, a változás legyen érezhető.
- kisebb, de valódi hatás: kb. ±6–10
- egyértelmű érzelmi hatás: kb. ±11–20
- nagy konfliktus / nagy áttörés: kb. ±21–35
- nagyon súlyos fordulat, árulás, megmentés stb.: akár ±36–45
- Csak akkor tegyél be változást, ha tényleg történt valami, ami hat a viszonyra.
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

CHARACTER FIDELITY — ABSOLUTE PRIORITY:
- Treat the ENTIRE character sheet as active behavioral canon, not decorative background.
- Reconcile every response with personality, traits, speech style, full history, secrets, fears, goals, likes, abilities, organization, rank, relationships and current memories.
- If a line could be moved unchanged to several other characters, it is not character-specific enough.
- Do not sand down obsessive, possessive, cruel, arrogant, manipulative, chaotic, shy, jealous, dominant or emotionally closed characters into generic assistant politeness.
- Example dialogue is style guidance only. Never recycle it as a catchphrase.

ENGLISH PRONOUN / REFERENCE RESOLUTION — HARD RULE:
- In player-authored text, "I / me / my / mine" means the player's own character.
- In a private chat, player-authored "you / your / yours" means the AI character receiving that DM.
- "I was talking about you" means the current addressee; "I was talking about myself / me" means the player's own character.
- Resolve he / him, she / her and they / them from the most recently clear compatible person in the conversation. A concrete name or @handle overrides a pronoun.
- In group chat, "you" may mean a named/@mentioned person or the group, depending on the immediate conversational context.
- If two references are genuinely equally plausible, ask one short clarification. Do not pretend not to understand ordinary English pronouns.

QUESTION ANSWERING:
- When the player asks a direct question in chat, answer the actual question instead of automatically dodging it with another question, flirting, a joke or a vague reaction.
- A character may refuse, lie, evade or say they do not know ONLY when their canon, secrets, knowledge or relationship gives them a real reason.
- Even then, make the refusal deliberate and character-specific; do not act as if the question was not understood.
- It is fine to answer first and THEN tease, deflect, challenge or ask something back.

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
- Every bond is described by two separate directions: "A → B" means what A feels toward B. This is not necessarily the same as "B → A".
- Attraction, hatred or a secret feeling can be completely one-sided. Never make it mutual automatically.
- Every element of "changes" refers to ONE direction: "a" is WHO feels it, "b" is TOWARD WHOM.
- Relationship changes are NOT limited to AI → player. They may be player → AI, AI → AI, and several different directions may change in the same event.
- The player character's relationship score may change mechanically because of what happens. That is a GAME STATE change only; it never gives you permission to speak, act or write internal thoughts for the player.
- If an interaction genuinely affects both people, evaluate BOTH directions separately and output two "changes" entries. Their deltas do not need to have the same sign or magnitude.
- In group chats, roleplay scenes, comment fights, gossip or conflicts, AI characters' relationships WITH EACH OTHER should also change when they support, humiliate, betray, defend, provoke, impress or disappoint one another.
- Never project a secret feeling onto the other person and never make it mutual on your own.
- If a change is explicitly a one-sided internal feeling (for example a secret crush), you may mark it with "oneSided":true.
- Family bonds are factual and permanent, but the directional score and mood may still become strongly positive or negative.
- CHANGEABLE BOND (friend, enemy, crush, ex, etc.) may evolve from events. If it genuinely changes, you may add a new "bond" value in "changes".

EMOTIONAL STATE AND DELTA — THIS IS THE MOST IMPORTANT PART
- Give every "changes" entry a "mood" field describing what that person feels toward the other RIGHT NOW.
- Make it concrete, sharp and specific to the situation.
- Give a short "why" field explaining what caused it.
- Positive and negative changes are EQUALLY valid. Do not bias relationship movement toward positive.
- Support, protection, closeness, honesty, loyalty, flirting or shared success can cause PLUS changes.
- Insults, humiliation, betrayal, lying, threats, jealousy, rejection, conflict or disappointment can cause MINUS changes.
- Do not use meaningless 1–2 point token changes. If something matters, the delta should be noticeable.
- small but real impact: about ±6–10
- clear emotional impact: about ±11–20
- major conflict / breakthrough: about ±21–35
- severe turning point, betrayal, rescue, etc.: up to about ±36–45
- Only add a change when something actually happened that affects the relationship.
- Never create a romantic or sexual thread between family members.
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

async function serverProfileWorlds() {
  return apiJson("/profile/worlds", {
    method: "GET",
  });
}

async function serverSwitchProfileWorld(code) {
  return apiJson("/profile/worlds/switch", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

async function serverCreateProfileWorld(
  world,
  characterName,
  characterUsername
) {
  return apiJson("/profile/worlds/create", {
    method: "POST",
    body: JSON.stringify({
      world,
      characterName,
      characterUsername,
    }),
  });
}

async function analyzeImageDataUrl(
  dataUrl,
  prompt = ""
) {
  if (!dataUrl || !String(dataUrl).startsWith("data:image/")) {
    return "";
  }

  const result = await apiJson("/ai/vision", {
    method: "POST",
    body: JSON.stringify({
      provider: DEFAULT_AI_PROVIDER,
      model: DEFAULT_AI_MODEL,
      image: dataUrl,
      prompt:
        prompt ||
        "Describe what is visibly happening in this image in 1-3 concise sentences. Mention people, clothing, activity, location and mood only when visible. Do not identify real people by name.",
    }),
  });

  return String(
    (result && result.text) || ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function worldSyncRev(w) {
  return Math.max(
    0,
    Math.floor(
      Number(
        w && w.syncRev
      ) || 0
    )
  );
}

async function serverWorldPeek(code) {
  const c = encodeURIComponent(
    String(code || "")
      .trim()
      .toLowerCase()
  );

  return apiJson(
    `/world/peek?code=${c}`,
    {
      method: "GET",
    }
  );
}

async function serverSaveWorld(world) {
  return apiJson("/world/save", {
    method: "POST",
    body: JSON.stringify({
      world,
      syncRev:
        worldSyncRev(world),
    }),
  });
}
function migrate(w) {
  if (!w || !w.universe) return w;

  /*
   * syncRev kizárólag a PostgreSQL szerver által kezelt
   * konkurencia-verzió. Régi világok 0-ról indulnak.
   */
  w.syncRev =
    worldSyncRev(w);

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
    syncRev: worldSyncRev(world),
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

  /*
   * A rev helyi tartalom-verzió, a syncRev pedig
   * szerver-konkurencia verzió. Egyik se számít
   * önmagában tartalmi változásnak.
   */
  delete copy.rev;
  delete copy.syncRev;

  /*
   * A backend minden sikeres mentésnél technikailag frissíti universe.at-et.
   * Ez nem játékbeli tartalom, ezért nem okozhat hamis device-conflictet.
   */
  if (copy.universe && typeof copy.universe === "object") {
    copy.universe = { ...copy.universe };
    delete copy.universe.at;
  }

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
  if (!w || !w.code) return false;

  /*
   * LOCAL EMERGENCY BACKUP ONLY.
   * Online játék közben ez soha nem az igazság forrása.
   */
  return writeBigScoped(
    KEY(w.code),
    JSON.stringify(w),
    false
  );
}

/*
 * A név kompatibilitás miatt marad, de NEM merge-el
 * semmilyen régi böngészős világot az online állapotba.
 * PostgreSQL az egyetlen authoritative world online.
 */
async function saveWorldMerged(local) {
  if (!local || !local.code) {
    return {
      world: local,
      mode: "memory",
    };
  }

  const snapshot =
    JSON.parse(
      JSON.stringify(local)
    );

  let snapshotOk = false;
  let primaryOk = false;

  try {
    snapshotOk =
      await writeWorldSnapshot(
        local.code,
        snapshot,
        false
      );
  } catch (e) {
    snapshotOk = false;
  }

  try {
    primaryOk =
      await saveWorld(snapshot);
  } catch (e) {
    primaryOk = false;
  }

  return {
    world: snapshot,
    mode:
      snapshotOk || primaryOk
        ? "local"
        : "memory",
  };
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

  const root =
    TERM_TEXT[asLang(lang)] ||
    TERM_TEXT.hu;

  const bonds =
    root.bonds || {};

  const relTypes =
    root.relTypes || {};

  const relMoods =
    root.relMoods || {};

  /*
   * A változó relation label-ek közül több
   * (Barát, Legjobb barát, Ellenség, Rivális...)
   * relTypes alatt van, miközben a BondPicker
   * localizedBond()-ot használ.
   *
   * Ezért eddig angol módban bent maradhattak magyarul.
   */
  return (
    bonds[value] ||
    relTypes[value] ||
    relMoods[value] ||
    value
  );
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
    yourRelationshipDelta: "A te kapcsolatod {{name}} felé: {{delta}}{{why}}",
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
    yourRelationshipDelta: "Your relationship toward {{name}} changed: {{delta}}{{why}}",
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

const CONTENT_LEVELS = [
  {
    id: "standard",
    nameHu: "Standard",
    nameEn: "Standard",
  },
  {
    id: "mature",
    nameHu: "Mature 18+",
    nameEn: "Mature 18+",
  },
];

function worldContentLevel(
  w,
  playerId
) {
  const pid =
    playerId ||
    (w && w.meId);

  const raw =
    w &&
    w.userSettings &&
    pid &&
    w.userSettings[pid] &&
    w.userSettings[pid].contentLevel;

  return raw === "mature"
    ? "mature"
    : "standard";
}

function isKnownAdultCharacter(
  w,
  characterId
) {
  const c =
    charById(
      w,
      characterId
    );

  if (!c) return false;

  const age =
    Number(
      ageOf(
        c,
        w
      )
    );

  return (
    Number.isFinite(age) &&
    age >= 18
  );
}

function matureParticipantsAreAdults(
  w,
  participantIds = []
) {
  const ids = [
    w && w.meId,
    ...(Array.isArray(participantIds)
      ? participantIds
      : []),
  ]
    .filter(Boolean)
    .filter(
      (id, index, arr) =>
        arr.indexOf(id) === index
    );

  return (
    ids.length > 0 &&
    ids.every(
      (id) =>
        isKnownAdultCharacter(
          w,
          id
        )
    )
  );
}

function matureContentInstruction(
  w,
  participantIds = [],
  channel = "chat"
) {
  if (
    worldContentLevel(
      w,
      w && w.meId
    ) !== "mature"
  ) {
    return "";
  }

  const en =
    worldLanguage(
      w,
      w && w.meId
    ) === "en";

  const allAdults =
    matureParticipantsAreAdults(
      w,
      participantIds
    );

  const channelLabel =
    channel === "roleplay"
      ? "ROLEPLAY"
      : channel === "group"
        ? "GROUP CHAT"
        : en
          ? "PRIVATE CHAT"
          : "PRIVÁT CHAT";

  if (en) {
    return `
MATURE 18+ CONTENT MODE — ${channelLabel}:

- The tone may be clearly adult, rougher, darker and less sanitized when that fits the characters and situation.
- Strong profanity, adult humor, alcohol/drug references, threats, toxic dynamics, manipulation, jealousy, obsession, possessiveness, violence, fear and other mature story themes are allowed when character-accurate.
- Romance and attraction may be more intense, direct, suggestive, sensual or sexually charged when it naturally follows from the relationship.
- Do NOT turn every interaction sexual. Personality, relationship, current mood, history, power dynamics and consent still control the scene.
- Never override a character's established boundaries or personality merely because Mature mode is enabled.
- No explicit pornographic sexual detail. When intimacy would become graphically sexual, keep it non-graphic or transition naturally with a fade-to-black / implied continuation.
- Never sexualize a minor. ${
      allAdults
        ? "Every currently involved participant has a known age of 18+, so adult romantic/suggestive tension may be used within the non-graphic limit."
        : "At least one currently involved participant is under 18 or their age is not confirmed as 18+. Therefore do NOT generate sexual or sexually suggestive content involving that participant; keep mature material non-sexual."
    }
`;
  }

  return `
MATURE 18+ TARTALMI MÓD — ${channelLabel}:

- A hangvétel lehet egyértelműen felnőttesebb, nyersebb, sötétebb és kevésbé steril, ha ez illik a karakterekhez és a helyzethez.
- Erősebb káromkodás, felnőtt humor, alkohol/drog mint történeti elem, fenyegetés, toxikus dinamika, manipuláció, féltékenység, megszállottság, birtoklás, erőszak, félelem és más mature témák megjelenhetnek, ha karakterhűek.
- A romantika és vonzalom lehet intenzívebb, direktebb, kétértelműbb, érzékibb vagy szexuálisan feszültebb, ha természetesen következik a kapcsolatból.
- NE váljon minden interakció szexuálissá. A személyiség, kapcsolat, aktuális mood, közös történet, erőviszonyok és beleegyezés továbbra is meghatározó.
- A Mature mód miatt soha ne írj felül egy karakterhez tartozó határt vagy személyiséget.
- Explicit pornográf szexuális részleteket ne írj. Ha az intimitás grafikusan szexuálissá válna, maradjon nem részletező, vagy természetesen válts fade-to-black / utalásos folytatásra.
- Kiskorút soha ne szexualizálj. ${
      allAdults
        ? "A jelenlegi résztvevők mind ismerten 18 év felettiek, ezért felnőtt romantikus/kétértelmű feszültség megjelenhet a nem explicit határon belül."
        : "Legalább egy jelenlegi résztvevő 18 év alatti, vagy az életkora nincs biztosan 18+-ként megadva. Ezért vele kapcsolatban semmilyen szexuális vagy szexuálisan kétértelmű tartalmat ne generálj; a mature témák maradjanak nem szexuálisak."
    }
`;
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
const mediaBytes = (m) =>
  Object.keys(
    m || {}
  ).reduce(
    (sum, k) => {
      const raw =
        m[k];

      if (!raw) {
        return sum;
      }

      if (
        typeof raw ===
        "string"
      ) {
        return (
          sum +
          raw.length
        );
      }

      return (
        sum +
        String(
          raw.dataUrl ||
          raw.url ||
          ""
        ).length
      );
    },
    0
  );

/*
 * A backend 45 MB körüli teljes JSON payloadot enged.
 * 32 MB base64 képanyag mellett marad tartalék a metaadatoknak
 * és kisebb a mobil böngésző memória-csúcsa.
 */
const MEDIA_CAP =
  32 * 1048576;

function mediaFingerprint(
  media
) {
  return Object.keys(
    media || {}
  )
    .sort()
    .map((id) => {
      const raw =
        media[id];

      if (!raw) {
        return `${id}:0`;
      }

      if (
        typeof raw ===
        "string"
      ) {
        return `${id}:legacy:${raw.length}:${raw.slice(-18)}`;
      }

      const data =
        String(
          raw.dataUrl ||
          raw.url ||
          ""
        );

      return [
        id,
        raw.status || "",
        raw.updatedAt || "",
        raw.deletedAt || "",
        raw.category || "",
        raw.ownerUserId || "",
        raw.ownerCharacterId || "",
        data.length,
        data.slice(-18),
      ].join(":");
    })
    .join("|");
}

async function serverLoadMedia() {
  const data =
    await apiJson(
      "/media/load",
      {
        method: "GET",
      }
    );

  return {
    media:
      data &&
      data.media &&
      typeof data.media === "object"
        ? data.media
        : {},

    syncRev:
      Math.max(
        0,
        Math.floor(
          Number(
            data &&
            data.syncRev
          ) || 0
        )
      ),
  };
}

async function serverSaveMedia(
  media,
  syncRev
) {
  return apiJson(
    "/media/save",
    {
      method: "POST",
      body: JSON.stringify({
        media:
          media || {},
        syncRev:
          Math.max(
            0,
            Math.floor(
              Number(syncRev) || 0
            )
          ),
      }),
    }
  );
}

function parseStoredMedia(txt) {
  if (!txt) return {};

  try {
    const parsed =
      JSON.parse(txt);

    return (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
        ? parsed
        : {}
    );
  } catch (e) {
    return {};
  }
}

function referencedMediaIds(world) {
  return new Set(
    Object.keys(
      (
        world &&
        world.images
      ) || {}
    )
  );
}

async function cacheMediaLocally(
  code,
  media
) {
  try {
    await writeBigScoped(
      MKEY(code),
      JSON.stringify(
        media || {}
      ),
      false
    );

    return true;
  } catch (e) {
    console.warn(
      "Local media cache failed:",
      e
    );

    return false;
  }
}

/*
 * CLOUD-FIRST média betöltés.
 *
 * Online: PostgreSQL az authoritative kép-tár.
 * Régi helyi képből csak olyan ID-t migrálunk vissza,
 * amelyre az authoritative world.images ténylegesen hivatkozik.
 * Így egy régi böngészőcache nem tud törölt/stale képeket
 * véletlenül visszaönteni a felhőbe.
 *
 * Offline: helyi emergency cache használható.
 */
async function loadMedia(
  code,
  world
) {
  const localTxt =
    await readBigScoped(
      MKEY(code),
      false
    );

  const legacyTxt =
    await readBig(
      MKEY(code)
    );

  const localMedia =
    parseStoredMedia(
      localTxt
    );

  const legacyMedia =
    parseStoredMedia(
      legacyTxt
    );

  const offline =
    typeof navigator !== "undefined" &&
    navigator.onLine === false;

  if (offline) {
    const fallback = {
      ...legacyMedia,
      ...localMedia,
    };

    await cacheMediaLocally(
      code,
      fallback
    );

    return {
      media: fallback,
      syncRev: 0,
      mode: "local",
    };
  }

  let cloud;

  try {
    cloud =
      await serverLoadMedia();
  } catch (e) {
    console.warn(
      "Cloud media load failed:",
      e
    );

    const fallback = {
      ...legacyMedia,
      ...localMedia,
    };

    await cacheMediaLocally(
      code,
      fallback
    );

    return {
      media: fallback,
      syncRev: 0,
      mode: "local",
      error: e,
    };
  }

  let cloudMedia = {
    ...(
      cloud &&
      cloud.media
        ? cloud.media
        : {}
    ),
  };

  let cloudSyncRev =
    Math.max(
      0,
      Math.floor(
        Number(
          cloud &&
          cloud.syncRev
        ) || 0
      )
    );

  /*
   * Egyszeri, biztonságos legacy media migráció.
   */
  const referenced =
    referencedMediaIds(world);

  const legacyPool = {
    ...legacyMedia,
    ...localMedia,
  };

  const missingReferenced = {};

  Object.keys(
    legacyPool
  ).forEach((id) => {
    if (
      referenced.has(id) &&
      !cloudMedia[id]
    ) {
      missingReferenced[id] =
        legacyPool[id];
    }
  });

  if (
    Object.keys(
      missingReferenced
    ).length
  ) {
    const candidate = {
      ...cloudMedia,
      ...missingReferenced,
    };

    try {
      const saved =
        await serverSaveMedia(
          candidate,
          cloudSyncRev
        );

      if (
        saved &&
        saved.media
      ) {
        cloudMedia =
          saved.media;

        cloudSyncRev =
          Math.max(
            0,
            Math.floor(
              Number(
                saved.syncRev
              ) || 0
            )
          );
      }
    } catch (e) {
      if (
        e &&
        e.status === 409 &&
        e.data
      ) {
        const serverMedia =
          e.data.media &&
          typeof e.data.media === "object"
            ? e.data.media
            : {};

        const merged = {
          ...candidate,
          ...serverMedia,
        };

        try {
          const retry =
            await serverSaveMedia(
              merged,
              Number(
                e.data.serverSyncRev
              ) || 0
            );

          cloudMedia =
            retry &&
            retry.media
              ? retry.media
              : merged;

          cloudSyncRev =
            Math.max(
              0,
              Math.floor(
                Number(
                  retry &&
                  retry.syncRev
                ) ||
                Number(
                  e.data.serverSyncRev
                ) || 0
              )
            );
        } catch (retryError) {
          console.warn(
            "Legacy media migration conflict retry failed:",
            retryError
          );
        }
      } else {
        console.warn(
          "Legacy media migration failed:",
          e
        );
      }
    }
  }

  await cacheMediaLocally(
    code,
    cloudMedia
  );

  return {
    media:
      cloudMedia,
    syncRev:
      cloudSyncRev,
    mode:
      "cloud",
  };
}

/*
 * Revision-aware média autosave.
 *
 * Konfliktusnál a szerver meglévő image ID-je nyer,
 * az ezen az eszközön létrejött ÚJ image ID-k viszont
 * megmaradnak és egyszer újrapróbáljuk a mentést.
 */
async function saveMedia(
  code,
  media,
  expectedSyncRev = 0
) {
  const safeMedia =
    media &&
    typeof media === "object"
      ? media
      : {};

  await cacheMediaLocally(
    code,
    safeMedia
  );

  const offline =
    typeof navigator !== "undefined" &&
    navigator.onLine === false;

  if (offline) {
    return {
      ok: true,
      mode: "local",
      media:
        safeMedia,
      syncRev:
        Math.max(
          0,
          Math.floor(
            Number(
              expectedSyncRev
            ) || 0
          )
        ),
    };
  }

  try {
    const saved =
      await serverSaveMedia(
        safeMedia,
        expectedSyncRev
      );

    return {
      ok: true,
      mode: "cloud",
      media:
        saved &&
        saved.media
          ? saved.media
          : safeMedia,
      syncRev:
        Math.max(
          0,
          Math.floor(
            Number(
              saved &&
              saved.syncRev
            ) || 0
          )
        ),
    };
  } catch (e) {
    if (
      e &&
      e.status === 409 &&
      e.data
    ) {
      const serverMedia =
        e.data.media &&
        typeof e.data.media === "object"
          ? e.data.media
          : {};

      /*
       * Server wins on an existing ID; unique local uploads survive.
       */
      const reconciled = {
        ...safeMedia,
        ...serverMedia,
      };

      try {
        const retry =
          await serverSaveMedia(
            reconciled,
            Number(
              e.data.serverSyncRev
            ) || 0
          );

        const finalMedia =
          retry &&
          retry.media
            ? retry.media
            : reconciled;

        await cacheMediaLocally(
          code,
          finalMedia
        );

        return {
          ok: true,
          mode: "cloud",
          media:
            finalMedia,
          syncRev:
            Math.max(
              0,
              Math.floor(
                Number(
                  retry &&
                  retry.syncRev
                ) ||
                Number(
                  e.data.serverSyncRev
                ) || 0
              )
            ),
          reconciled: true,
        };
      } catch (retryError) {
        return {
          ok: false,
          mode: "local",
          media:
            safeMedia,
          syncRev:
            expectedSyncRev,
          error:
            retryError,
        };
      }
    }

    return {
      ok: false,
      mode: "local",
      media:
        safeMedia,
      syncRev:
        expectedSyncRev,
      error: e,
    };
  }
}

async function dropMedia(code) {
  await dropBigScoped(MKEY(code), false);
  return dropBig(MKEY(code));
}

/* ---------- kezdő világ ---------- */
function seedWorld(code) {
  const mk = (o) => ({
    id: uid(),
    avatar: "",
    cover: "",
    baseFollowers: 0,
    followerDelta: 0,
    followers: [],
    following: [],
    ...o,
  });
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
    code: String(code).toLowerCase().trim(), rev: 1, syncRev: 0,
    universe: {
      name: "Beacon Falls",
      year: String(new Date().getFullYear()),
      date: "szeptember 3.",
      description:
        "Kisváros a hegyek között, ahol mindenki ismer mindenkit, és minden titok végül kiszivárog. Modern világ, mágia nincs. A történet a Beacon Falls Gimnázium utolsó éve körül forog: bulik, pletykák, régi sérelmek és egy tavalyi baleset, amiről senki nem beszél szívesen.",
      at: now(),
    },
    chars,
extras: [],
rels: {},
posts: [],
reposts: [],
chats: {},
mems: {},
charMemory: {},
userSettings: {},
log: [],
scenes: [],
groups: [],
notes: [],

/*
 * SOCIAL SIMULATION
 *
 * Strukturált események. Ebből fog később dolgozni
 * a virality, gossip, Whisper Wire és reputation rendszer.
 */
socialEvents: [],

/*
 * Közösségi statisztikák karakterenként.
 *
 * Példa:
 * socialStats[characterId] = {
 *   aura: 0,
 *   popularity: 0,
 *   reputation: 0,
 *   hype: 0,
 *   humor: 0,
 *   followers: 0,
 *   following: 0,
 *   signals: { ... }
 * }
 *
 * FONTOS:
 * popularity és hype részben a tényleges social aktivitásból
 * számolódik; aura / reputation / humor később tartalmi
 * eseményekből változhat.
 */
socialStats: {},

/*
 * Aktuális trendek / felkapott témák.
 * Nem kötelező mindig lennie trendnek.
 */
trends: [],

/*
 * Pletykák és azok terjedése.
 *
 * Itt később külön tudjuk követni:
 * - ki mit hallott;
 * - kitől hallotta;
 * - mennyire hiszi el;
 * - továbbadta-e;
 * - hogyan változott a pletyka.
 */
rumors: [],

/*
 * The Whisper Wire történeti memóriája.
 *
 * Nem maga a feed:
 * itt azt tároljuk majd, milyen sztorikat dolgozott már fel,
 * milyen eseményeket kapcsolt össze,
 * és mire tud később visszautalni.
 */
whisperWire: {
  stories: [],
  usedEventIds: [],
  history: [],
  lastCandidate: null,
  lastPublishedAt: 0,
},

/*
 * Gossip & Media beállítások.
 */
gossipSettings: {
  /*
   * off    = nincs külön pletykamédia-profil
   * local  = Spill&Chill
   * global = RumorHasIt
   */
  mediaMode: "off",

  whisperWire: true,
  frequency: "normal",
  articleLength: "dynamic",
  characterGossip: true,
  relationshipImpact: "normal",
},

/*
 * A pletykaoldalak valódi social profilok.
 * Egyszerre csak a mediaMode által kiválasztott oldal aktív.
 */
mediaAccounts: {
  local: {
    id: "media_spill_chill",
    mediaKind: "local",
    name: "Spill&Chill",
    username: "spillandchill",
    bio: "Small-town secrets, sightings & side-eyes. Send tips.",
    avatar: "",
    cover: "",
    baseFollowers: 3400,
    followerDelta: 0,
    followers: [],
    following: [],
  },

  global: {
    id: "media_rumor_has_it",
    mediaKind: "global",
    name: "RumorHasIt",
    username: "rumorhasit",
    bio: "Celebrities, scandals, receipts & the stories everyone is talking about.",
    avatar: "",
    cover: "",
    baseFollowers: 8700000,
    followerDelta: 0,
    followers: [],
    following: [],
  },
},

/*
 * Random / Pop-up események.
 */
popupEvents: [],

accounts: {},
players: {},
deleted: {},
notify: {},
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
    goals: "", fears: "", likes: "", secrets: "", backstory: "", avatar: "", cover: "",
    baseFollowers: 0,
    followerDelta: 0,
    followers: [],
    following: [],
  };
}


/* ============================================================
   ÚJRAOSZTÁS / REPOST
   ============================================================ */

function repostRows(w) {
  if (!w || typeof w !== "object") return [];
  if (!Array.isArray(w.reposts)) w.reposts = [];
  return w.reposts;
}

function hasReposted(w, actorId, postId) {
  if (!w || !actorId || !postId) return false;

  return repostRows(w).some(
    (r) =>
      r &&
      r.actorId === actorId &&
      r.postId === postId
  );
}

function repostCount(w, postId) {
  if (!w || !postId) return 0;

  return repostRows(w).filter(
    (r) =>
      r &&
      r.postId === postId
  ).length;
}

function createRepost(
  w,
  actorId,
  postId,
  source = "world"
) {
  if (!w || !actorId || !postId) {
    return null;
  }

  const actor =
    socialProfileById(
      w,
      actorId
    );

  const post =
    (w.posts || []).find(
      (p) =>
        p &&
        p.id === postId
    );

  if (
    !actor ||
    !post ||
    post.authorId === actorId ||
    hasReposted(
      w,
      actorId,
      postId
    )
  ) {
    return null;
  }

  const row = {
    id: "rp_" + uid(),
    actorId,
    postId,
    ts: now(),
  };

  repostRows(w).unshift(row);
  w.reposts =
    w.reposts.slice(0, 500);

  recordSocialEvent(
    w,
    {
      type: "repost",
      refId: row.id,
      ts: row.ts,
      actorId,
      targetIds:
        post.authorId &&
        post.authorId !== actorId
          ? [post.authorId]
          : [],
      visibility: "public",
      factLevel: "observed",
      importance: 16,
      drama: 0,
      romance: 0,
      embarrassment: 0,
      source,
      text: "Reposted a post.",
      tags: [
        "social",
        "repost",
      ],
      meta: {
        repostId: row.id,
        postId: post.id,
        originalAuthorId:
          post.authorId || "",
      },
    }
  );

  /*
   * AI -> játékos repost értesítés.
   */
  if (
    isHuman(
      w,
      post.authorId
    ) &&
    !isHuman(
      w,
      actor.id
    )
  ) {
    pushNote(
      w,
      post.authorId,
      {
        icon: "↻",
        text:
          sysLangText(
            w,
            post.authorId,
            `${actor.name} újraosztotta a posztodat.`,
            `${actor.name} reposted your post.`
          ),
        link: {
          type: "post",
          id: post.id,
        },
      }
    );
  }

  return row;
}

function repostInterestScore(
  w,
  actorId,
  post
) {
  if (
    !w ||
    !actorId ||
    !post ||
    !post.id ||
    post.authorId === actorId ||
    hasReposted(
      w,
      actorId,
      post.id
    )
  ) {
    return -999;
  }

  const actor =
    socialProfileById(
      w,
      actorId
    );

  const author =
    socialProfileById(
      w,
      post.authorId
    );

  if (
    !actor ||
    !author ||
    isHuman(w, actor.id)
  ) {
    return -999;
  }

  const age =
    now() -
    (Number(post.ts) || 0);

  if (
    age >
    48 * 3600e3
  ) {
    return -999;
  }

  let score = 0;

  if (
    isFollowing(
      w,
      actor.id,
      author.id
    )
  ) {
    score += 18;
  }

  const rel =
    getRel(
      w,
      actor.id,
      author.id
    );

  const relScore =
    Number(
      rel && rel.score
    ) || 0;

  if (
    linked(
      w,
      actor.id,
      author.id
    )
  ) {
    score += 8;
  }

  if (relScore > 0) {
    score += Math.min(
      24,
      relScore * 0.3
    );
  }

  if (
    Array.isArray(
      post.likedBy
    ) &&
    post.likedBy.includes(
      actor.id
    )
  ) {
    score += 24;
  }

  const actorComments =
    (post.comments || []).filter(
      (c) =>
        c &&
        c.authorId ===
          actor.id
    ).length;

  score += Math.min(
    14,
    actorComments * 7
  );

  const engagement =
    Math.max(
      0,
      displayPostLikeCount(
        w,
        post
      )
    ) +
    (post.comments || []).length * 2 +
    repostCount(
      w,
      post.id
    ) * 3;

  score += Math.min(
    12,
    Math.log10(
      engagement + 1
    ) * 5
  );

  return Math.round(score);
}

function pickAutonomousRepostAction(w) {
  const actors =
    (w.chars || []).filter(
      (c) =>
        c &&
        !isHuman(
          w,
          c.id
        )
    );

  const posts =
    (w.posts || [])
      .filter(Boolean)
      .slice(0, 30);

  const candidates = [];

  actors.forEach((actor) => {
    posts.forEach((post) => {
      const score =
        repostInterestScore(
          w,
          actor.id,
          post
        );

      if (score < 34) return;

      candidates.push({
        actorId: actor.id,
        postId: post.id,
        score,
        tie: Math.random(),
      });
    });
  });

  candidates.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    return a.tie - b.tie;
  });

  const pool =
    candidates.slice(0, 5);

  if (!pool.length) {
    return null;
  }

  const picked =
    pool[
      Math.floor(
        Math.random() *
          pool.length
      )
    ];

  if (
    picked.score < 52 &&
    Math.random() >
      Math.min(
        0.72,
        0.22 +
          (picked.score - 34) /
            30
      )
  ) {
    return null;
  }

  return picked;
}


/* ============================================================
   KÖVETŐRENDSZER
   ============================================================ */

/*
 * A social hálózatban most a játékosok és a teljes AI-karakterek
 * rendelkeznek valódi, követhető profillal.
 * A mellékszereplők egyelőre nem.
 */
function socialProfiles(w) {
  const activeMedia =
    activeGossipMediaAccount(
      w
    );

  return humanChars(w)
    .concat(w.chars || [])
    .concat(
      activeMedia
        ? [activeMedia]
        : []
    )
    .filter(
      (c, i, arr) =>
        c &&
        c.id &&
        arr.findIndex(
          (x) =>
            x &&
            x.id === c.id
        ) === i
    );
}

function ensureSocialProfileRow(c) {
  if (!c || !c.id) return c;

  if (typeof c.cover !== "string") {
    c.cover = "";
  }

  c.baseFollowers =
    Math.max(
      0,
      Math.round(
        Number(c.baseFollowers) || 0
      )
    );

  c.followerDelta =
    Math.round(
      Number(c.followerDelta) || 0
    );

  if (!Array.isArray(c.followers)) {
    c.followers = [];
  }

  if (!Array.isArray(c.following)) {
    c.following = [];
  }

  c.followers = [
    ...new Set(
      c.followers
        .filter(Boolean)
        .map(String)
        .filter((id) => id !== c.id)
    ),
  ];

  c.following = [
    ...new Set(
      c.following
        .filter(Boolean)
        .map(String)
        .filter((id) => id !== c.id)
    ),
  ];

  return c;
}

function ensureFollowerSystem(w) {
  if (!w || typeof w !== "object") {
    return w;
  }

  const profiles =
    socialProfiles(w);

  const byId = {};

  profiles.forEach((c) => {
    ensureSocialProfileRow(c);
    byId[c.id] = c;
  });

  /*
   * A két oldal mindig legyen szinkronban:
   * A.following tartalmazza B-t
   * <=> B.followers tartalmazza A-t.
   *
   * Régi világoknál is automatikusan kijavítja
   * a hiányzó ellenoldalt.
   */
  profiles.forEach((c) => {
    c.following
      .slice()
      .forEach((targetId) => {
        const target =
          byId[targetId];

        if (!target) {
          c.following =
            c.following.filter(
              (id) => id !== targetId
            );
          return;
        }

        if (
          !target.followers.includes(c.id)
        ) {
          target.followers.push(c.id);
        }
      });

    c.followers
      .slice()
      .forEach((followerId) => {
        const follower =
          byId[followerId];

        if (!follower) {
          c.followers =
            c.followers.filter(
              (id) => id !== followerId
            );
          return;
        }

        if (
          !follower.following.includes(c.id)
        ) {
          follower.following.push(c.id);
        }
      });
  });

  /*
   * A jóban lévő AI-karakterek, közeli barátok és családtagok
   * social graphja tükrözze a kapcsolatot.
   *
   * A játékos saját following listáját NEM írjuk felül automatikusan,
   * de az AI-karakter követheti a játékost, ha közeli/családi a viszony.
   */
  profiles.forEach((actor) => {
    if (
      !actor ||
      isHuman(w, actor.id) ||
      isMediaAccount(w, actor.id)
    ) {
      return;
    }

    profiles.forEach((target) => {
      if (
        !target ||
        target.id === actor.id ||
        isMediaAccount(w, target.id)
      ) {
        return;
      }

      const forward =
        getRel(
          w,
          actor.id,
          target.id
        );

      const reverse =
        getRel(
          w,
          target.id,
          actor.id
        );

      const closeByScore =
        Number(forward.score || 0) >= 35 ||
        Number(reverse.score || 0) >= 35;

      const closeByBond =
        followBondWeight(forward) >= 34 ||
        followBondWeight(reverse) >= 34;

      if (
        !closeByScore &&
        !closeByBond
      ) {
        return;
      }

      if (
        !actor.following.includes(
          target.id
        )
      ) {
        actor.following.push(
          target.id
        );
      }

      if (
        !target.followers.includes(
          actor.id
        )
      ) {
        target.followers.push(
          actor.id
        );
      }
    });
  });

  return w;
}

function socialProfileById(w, id) {
  if (!w || !id) return null;

  const c =
    charById(w, id);

  if (
    !c ||
    isExtra(w, id)
  ) {
    return null;
  }

  return c;
}

function isFollowing(
  w,
  followerId,
  targetId
) {
  const follower =
    socialProfileById(
      w,
      followerId
    );

  if (!follower) return false;

  ensureSocialProfileRow(
    follower
  );

  return follower.following.includes(
    String(targetId)
  );
}

function knownFollowerCount(w, id) {
  const c =
    socialProfileById(w, id);

  if (!c) return 0;

  ensureSocialProfileRow(c);

  return c.followers.length;
}

function displayFollowerCount(w, id) {
  const c =
    socialProfileById(w, id);

  if (!c) return 0;

  ensureSocialProfileRow(c);

  return Math.max(
    0,
    c.baseFollowers +
      c.followerDelta +
      c.followers.length
  );
}

function postFollowerLikeBaseline(
  w,
  post
) {
  if (
    !w ||
    !post ||
    !post.authorId
  ) {
    return 0;
  }

  const followers =
    displayFollowerCount(
      w,
      post.authorId
    );

  if (followers <= 0) {
    return 0;
  }

  /*
   * Determinisztikus, post-ID alapú engagement:
   * nem ugrál minden rendernél, de a követőszámhoz igazodik.
   */
  const seed =
    (
      hue(
        String(
          post.id ||
          post.authorId
        )
      ) %
      100
    ) / 100;

  let minRate = 0.08;
  let maxRate = 0.18;

  if (followers < 100) {
    minRate = 0.18;
    maxRate = 0.42;
  } else if (followers < 1000) {
    minRate = 0.12;
    maxRate = 0.28;
  } else if (followers < 10000) {
    minRate = 0.08;
    maxRate = 0.20;
  } else if (followers < 100000) {
    minRate = 0.045;
    maxRate = 0.13;
  } else {
    minRate = 0.018;
    maxRate = 0.075;
  }

  const rate =
    minRate +
    (
      maxRate -
      minRate
    ) * seed;

  const ageMs =
    Math.max(
      0,
      now() -
      (Number(post.ts) || now())
    );

  /*
   * Friss postnál fokozatosan épüljön fel a szám,
   * kb. 3 óra után érje el a follower-alapú baseline-t.
   */
  const ageFactor =
    Math.max(
      0.12,
      Math.min(
        1,
        ageMs /
          (3 * 3600e3)
      )
    );

  const viralBoost =
    post.virality &&
    (
      post.virality.status === "viral" ||
      post.virality.status === "breakout"
    )
      ? (
          post.virality.status === "breakout"
            ? 1.9
            : 1.45
        )
      : 1;

  return Math.max(
    0,
    Math.round(
      followers *
      rate *
      ageFactor *
      viralBoost
    )
  );
}

function displayPostLikeCount(
  w,
  post
) {
  if (!post) return 0;

  const explicitIds =
    Array.isArray(
      post.likedBy
    )
      ? [
          ...new Set(
            post.likedBy
          ),
        ]
      : [];

  const explicitCount =
    explicitIds.length;

  const followerBaseline =
    postFollowerLikeBaseline(
      w,
      post
    );

  /*
   * Background/audience like-ok NEM személyhez kötöttek.
   * A konkrét AI-like-ok továbbra is likedBy-ban élnek,
   * így külön értesítést tudunk róluk küldeni.
   */
  return Math.max(
    Number(post.likes) || 0,
    followerBaseline +
      explicitCount
  );
}

function displayFollowingCount(w, id) {
  const c =
    socialProfileById(w, id);

  if (!c) return 0;

  ensureSocialProfileRow(c);

  return c.following.length;
}

function formatSocialCount(value) {
  const n =
    Math.max(
      0,
      Number(value) || 0
    );

  if (n < 1000) {
    return String(
      Math.round(n)
    );
  }

  if (n < 1000000) {
    const v =
      n / 1000;

    return (
      (v >= 100
        ? Math.round(v)
        : Math.round(v * 10) / 10
      ) + "K"
    );
  }

  if (n < 1000000000) {
    const v =
      n / 1000000;

    return (
      (v >= 100
        ? Math.round(v)
        : Math.round(v * 10) / 10
      ) + "M"
    );
  }

  const v =
    n / 1000000000;

  return (
    (v >= 100
      ? Math.round(v)
      : Math.round(v * 10) / 10
    ) + "B"
  );
}


function followBondWeight(rel) {
  const bond = String(
    (rel && (rel.bond || rel.type)) || ""
  ).toLowerCase();

  if (!bond) return 0;

  /*
   * Az AI-k social gráfja tükrözze a valódi kapcsolatokat.
   * Rokonok, szerelmi kapcsolatok, crushok és legjobb barátok
   * nagyon erős follow-jelzést adnak.
   */
  if (/legjobb barát|best friend|közeli barát|close friend|kölcsönös crush|mutual crush|crush|járnak|dating|jegyes|engaged|fiancé|fiance|házastárs|spouse|partner/.test(bond)) {
    return 46;
  }

  if (/anya|apa|szülő|parent|gyerek|child|fia|lánya|son|daughter|testvér|sibling|ikertestvér|twin|féltestvér|half-sibling|mostohatestvér|stepsibling|nagymama|grandmother|nagypapa|grandfather|nagyszülő|grandparent|unoka|grandchild|unokatestvér|cousin|nagynéni|aunt|nagybácsi|uncle|rokon|relative|család|family/.test(bond)) {
    return 42;
  }

  if (/barát|friend/.test(bond)) {
    return 34;
  }

  if (/osztálytárs|classmate|munkatárs|coworker|szomszéd|neighbor|főnök|boss|beosztott|mentor|tanítvány|student|edző|coach|tanár|teacher/.test(bond)) {
    return 16;
  }

  /* hate-follow / ex / rivalry */
  if (/ex|rivális|rival|ellenség|enemy/.test(bond)) {
    return 10;
  }

  return 7;
}

function characterSocialFollowModifier(c) {
  if (!c) return 0;

  const raw =
    [
      c.personality,
      c.traits,
      c.speech,
      c.voice,
      c.job,
      c.bio,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  let mod = 0;

  if (
    /social|extrovert|extroverted|outgoing|influencer|creator|blogger|celebrity|celeb|pletyka|gossip|curious|kíváncsi|társasági|közösségi/.test(
      raw
    )
  ) {
    mod += 8;
  }

  if (
    /antisocial|introvert|introverted|private|reserved|zárkózott|visszahúzódó|magának való|social media.*hate|utálja.*közösségi/.test(
      raw
    )
  ) {
    mod -= 10;
  }

  return mod;
}

function recentFollowInteractionScore(
  w,
  actorId,
  targetId
) {
  let score = 0;

  /*
   * Nyilvános interakciók.
   * Nem kell egyetlen like miatt rögtön követni valakit,
   * de az ismétlődő érdeklődés már számít.
   */
  (w.posts || [])
    .slice(0, 30)
    .forEach((p) => {
      if (!p) return;

      const comments =
        Array.isArray(p.comments)
          ? p.comments
          : [];

      if (
        p.authorId === targetId
      ) {
        if (
          Array.isArray(p.likedBy) &&
          p.likedBy.includes(actorId)
        ) {
          score += 5;
        }

        const actorComments =
          comments.filter(
            (c) =>
              c &&
              c.authorId === actorId
          ).length;

        score += Math.min(
          14,
          actorComments * 7
        );
      }

      if (
        p.authorId === actorId
      ) {
        if (
          Array.isArray(p.likedBy) &&
          p.likedBy.includes(targetId)
        ) {
          score += 3;
        }

        const targetComments =
          comments.filter(
            (c) =>
              c &&
              c.authorId === targetId
          ).length;

        score += Math.min(
          10,
          targetComments * 5
        );
      }
    });

  /*
   * Közös group chat = van társas kapcsolatuk.
   */
  const sharedGroups =
    (w.groups || []).filter(
      (g) =>
        g &&
        Array.isArray(g.members) &&
        g.members.includes(actorId) &&
        g.members.includes(targetId)
    ).length;

  score += Math.min(
    14,
    sharedGroups * 7
  );

  /*
   * Játékos <-> AI privát beszélgetés.
   * Az appban a DM-ek a játékoshoz kötődnek,
   * ezért csak ennél a párosnál értelmezhető.
   */
  if (
    isHuman(w, targetId) &&
    !isHuman(w, actorId)
  ) {
    const ck =
      chatKey(
        targetId,
        actorId
      );

    const count =
      (
        (w.chats &&
          w.chats[ck]) ||
        []
      ).length;

    score += Math.min(
      18,
      count * 2
    );
  }

  return Math.min(
    38,
    score
  );
}

function followInterestScore(
  w,
  actorId,
  targetId
) {
  const actor =
    socialProfileById(
      w,
      actorId
    );

  const target =
    socialProfileById(
      w,
      targetId
    );

  if (
    !actor ||
    !target ||
    actor.id === target.id
  ) {
    return -999;
  }

  if (
    isFollowing(
      w,
      actor.id,
      target.id
    )
  ) {
    return -999;
  }

  const rel =
    getRel(
      w,
      actor.id,
      target.id
    );

  let score = 0;

  /*
   * Ha már van köztük rögzített kapcsolat,
   * az önmagában társas relevancia.
   */
  if (
    linked(
      w,
      actor.id,
      target.id
    )
  ) {
    score += 18;
  }

  const relScore =
    Number(rel.score) || 0;

  /*
   * Pozitív kapcsolatnál egyre valószínűbb,
   * hogy érdekli a másik social jelenléte.
   */
  if (relScore > 0) {
    score +=
      Math.min(
        38,
        relScore * 0.48
      );
  }

  /*
   * Nagyon negatív kapcsolatnál is lehet érdeke követni:
   * rivalizálás, féltékenység, ellenőrzés, hate-follow.
   * Ez viszont gyengébb, mint egy pozitív kötődés.
   */
  if (relScore < -25) {
    score +=
      Math.min(
        15,
        Math.abs(relScore) *
          0.16
      );
  }

  score +=
    followBondWeight(rel);

  const obsessionLevel =
    relationshipObsessionLevel(
      w,
      actor.id,
      target.id
    );

  if (obsessionLevel > 0) {
    score +=
      obsessionLevel * 28;
  }

  /*
   * Ha a célpont már követi őt, az erős follow-back jel,
   * de NEM automatikus kölcsönösség.
   */
  if (
    isFollowing(
      w,
      target.id,
      actor.id
    )
  ) {
    score += 28;
  }

  score +=
    recentFollowInteractionScore(
      w,
      actor.id,
      target.id
    );

  /*
   * Ismertebb profilok valamivel könnyebben kerülnek
   * valakinek a radarjára. Ez csak kis bónusz:
   * a követőszám soha nem írja felül a kapcsolatot.
   */
  const audience =
    Math.max(
      0,
      Number(target.baseFollowers) ||
        0,
      displayFollowerCount(
        w,
        target.id
      )
    );

  if (audience > 0) {
    score += Math.min(
      12,
      Math.log10(
        audience + 1
      ) * 2.5
    );
  }

  score +=
    characterSocialFollowModifier(
      actor
    );

  /*
   * Az aktív gossip oldal social szempontból
   * természetesen releváns lehet.
   * Nem automatikus follow: a karakter saját social habitusa
   * és a többi follow-jel továbbra is számít.
   */
  if (
    isMediaAccount(
      w,
      target.id
    )
  ) {
    score +=
      target.mediaKind ===
        "local"
        ? 30
        : 26;

    if (
      target.mediaKind ===
        "local" &&
      actor.city
    ) {
      score += 5;
    }

    if (
      target.mediaKind ===
        "global" &&
      (
        Number(
          actor.baseFollowers
        ) || 0
      ) >= 10000
    ) {
      score += 8;
    }
  }

  /*
   * Ugyanaz a csapat/szervezet gyakran erős social relevancia,
   * ellenfelet pedig lehet hate-follow miatt figyelni.
   */
  const af = factionFlags(actor);
  const tf = factionFlags(target);

  if (
    (af.pogue && tf.pogue) ||
    (af.kook && tf.kook) ||
    (af.hydra && tf.hydra) ||
    (af.shield && tf.shield) ||
    (af.cobraKai && tf.cobraKai) ||
    (af.miyagiFang && tf.miyagiFang) ||
    (af.ironDragons && tf.ironDragons)
  ) {
    score += 18;
  }

  if (
    (af.pogue && tf.kook) || (af.kook && tf.pogue) ||
    (af.hydra && tf.shield) || (af.shield && tf.hydra) ||
    (af.cobraKai && tf.miyagiFang) || (af.miyagiFang && tf.cobraKai) ||
    (af.ironDragons && (tf.cobraKai || tf.miyagiFang)) ||
    (tf.ironDragons && (af.cobraKai || af.miyagiFang))
  ) {
    score += 9; // rival/hate-follow relevancia
  }

  return Math.round(score);
}

function aiShouldFollow(
  w,
  actorId,
  targetId,
  trigger = "autonomous"
) {
  const actor =
    socialProfileById(
      w,
      actorId
    );

  if (
    !actor ||
    isHuman(w, actor.id)
  ) {
    return false;
  }

  const score =
    followInterestScore(
      w,
      actorId,
      targetId
    );

  if (
    !Number.isFinite(score)
  ) {
    return false;
  }

  /*
   * Follow-backnél alacsonyabb a belépési küszöb,
   * mert a másik fél már jelezte az érdeklődését.
   * Még így sem követ vissza automatikusan mindenki.
   */
  if (trigger === "follow-back") {
    if (score >= 52) {
      return true;
    }

    if (score < 34) {
      return false;
    }

    return (
      Math.random() <
      Math.min(
        0.85,
        0.22 +
          (score - 34) / 28
      )
    );
  }

  /*
   * Teljesen autonóm követéshez erősebb indok kell.
   */
  if (score >= 56) {
    return true;
  }

  if (score < 34) {
    return false;
  }

  return (
    Math.random() <
    Math.min(
      0.72,
      0.12 +
        (score - 34) / 36
    )
  );
}

function pickAutonomousFollowAction(w) {
  ensureFollowerSystem(w);

  const actors =
    (w.chars || []).filter(
      (c) =>
        c &&
        !isHuman(w, c.id)
    );

  const targets =
    socialProfiles(w);

  const candidates = [];

  actors.forEach((actor) => {
    targets.forEach((target) => {
      if (
        !target ||
        target.id === actor.id ||
        isFollowing(
          w,
          actor.id,
          target.id
        )
      ) {
        return;
      }

      const score =
        followInterestScore(
          w,
          actor.id,
          target.id
        );

      if (score < 34) {
        return;
      }

      candidates.push({
        actorId:
          actor.id,

        targetId:
          target.id,

        score,

        tie:
          Math.random(),
      });
    });
  });

  candidates.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    return a.tie - b.tie;
  });

  /*
   * Ne mindig matematikailag ugyanaz a páros nyerjen:
   * a legerősebb néhány jelölt közül választunk.
   */
  const pool =
    candidates.slice(0, 5);

  for (
    let i = 0;
    i < pool.length;
    i++
  ) {
    const picked =
      pool[
        Math.floor(
          Math.random() *
            pool.length
        )
      ];

    if (
      picked &&
      aiShouldFollow(
        w,
        picked.actorId,
        picked.targetId,
        "autonomous"
      )
    ) {
      return picked;
    }
  }

  return null;
}

function setFollowState(
  w,
  followerId,
  targetId,
  shouldFollow,
  source = "world"
) {
  if (
    !w ||
    !followerId ||
    !targetId ||
    followerId === targetId
  ) {
    return false;
  }

  ensureFollowerSystem(w);

  const follower =
    socialProfileById(
      w,
      followerId
    );

  const target =
    socialProfileById(
      w,
      targetId
    );

  if (
    !follower ||
    !target
  ) {
    return false;
  }

  const already =
    follower.following.includes(
      target.id
    );

  if (
    shouldFollow === already
  ) {
    return false;
  }

  if (shouldFollow) {
    follower.following.push(
      target.id
    );

    target.followers.push(
      follower.id
    );
  } else {
    follower.following =
      follower.following.filter(
        (id) =>
          id !== target.id
      );

    target.followers =
      target.followers.filter(
        (id) =>
          id !== follower.id
      );
  }

  follower.following = [
    ...new Set(
      follower.following
    ),
  ];

  target.followers = [
    ...new Set(
      target.followers
    ),
  ];

  /*
   * Egy follow / unfollow önmagában kis esemény,
   * de később trendként vagy kapcsolatmintaként
   * össze lehet vonni több hasonló eseménnyel.
   */
  recordSocialEvent(
    w,
    {
      type:
        shouldFollow
          ? "follow"
          : "unfollow",

      refId:
        `${follower.id}:${target.id}:${shouldFollow ? "follow" : "unfollow"}:${now()}`,

      ts: now(),

      actorId:
        follower.id,

      targetIds: [
        target.id,
      ],

      visibility: "public",
      factLevel: "observed",

      importance:
        shouldFollow
          ? 10
          : 14,

      drama:
        shouldFollow
          ? 0
          : 4,

      romance: 0,
      embarrassment: 0,

      source,

      text:
        shouldFollow
          ? "Followed a profile."
          : "Unfollowed a profile.",

      tags: [
        "social",
        shouldFollow
          ? "follow"
          : "unfollow",
      ],

      meta: {
        followerId:
          follower.id,

        targetId:
          target.id,
      },
    }
  );

  /*
   * Ha egy AI követni kezdi a játékost,
   * kapjon róla normál social értesítést.
   * Unfollowról szándékosan nem küldünk értesítést.
   */
  if (
    shouldFollow &&
    !isHuman(w, follower.id) &&
    isHuman(w, target.id)
  ) {
    pushNote(
      w,
      target.id,
      {
        icon: "👤",

        text:
          sysLangText(
            w,
            target.id,
            `${follower.name} követni kezdett.`,
            `${follower.name} started following you.`
          ),

        link: {
          type: "char",
          id: follower.id,
        },
      }
    );
  }

  /*
   * Ha a JÁTÉKOS követ / kikövet egy AI-karaktert,
   * az maga is egy valódi társas jel legyen.
   */
  if (
    source === "player" &&
    isHuman(w, follower.id) &&
    !isHuman(w, target.id)
  ) {
    const obsession =
      relationshipObsessionLevel(
        w,
        target.id,
        follower.id
      );

    const followDelta =
      shouldFollow
        ? (
            obsession >= 3
              ? 5
              : 2
          )
        : (
            obsession >= 3
              ? -7
              : -3
          );

    applyChanges(
      w,
      [
        {
          a: target.id,
          b: follower.id,
          delta: followDelta,
          mood: "",
          why:
            worldLanguage(
              w,
              follower.id
            ) === "en"
              ? (
                  shouldFollow
                    ? "You followed them, and they noticed."
                    : "You unfollowed them, and they noticed."
                )
              : (
                  shouldFollow
                    ? "Bekövetted, és ezt észrevette."
                    : "Kikövetted, és ezt észrevette."
                ),
          oneSided: true,
        },
      ]
    );
  }

  /*
   * Ha a JÁTÉKOS követ be egy AI-karaktert,
   * az AI külön eldöntheti, hogy érdekében áll-e
   * visszakövetni.
   *
   * Nem automatikus follow-back.
   */
  if (
    shouldFollow &&
    source === "player" &&
    isHuman(w, follower.id) &&
    !isHuman(w, target.id)
  ) {
    simEnqueue(
      w,
      mkAction(
        "follow",
        `follow-back:${target.id}:${follower.id}:${Math.floor(
          now() / 1200000
        )}`,
        {
          actorId:
            target.id,

          targetId:
            follower.id,

          trigger:
            "follow-back",
        },
        "event"
      )
    );
  }

  return true;
}

async function addAccount(
  w,
  username,
  pw,
  charName,
  characterUsername = ""
) {
  const u = normUser(username);
  const id = "u" + uid();

  // Login username != social @username.
  let salt = "", hash = "";
  if (pw) {
    salt = newSalt();
    hash = await hashPw(pw, salt);
  }

  w.accounts[id] = {
    id,
    username: u,
    salt,
    hash,
    created: now(),
  };

  const wantedHandle =
    normUser(characterUsername) ||
    normUser(charName) ||
    u;

  w.players[id] =
    blankPlayer(
      id,
      charName || u,
      uniqueHandle(
        w,
        wantedHandle,
        id
      )
    );

  if (!w.userSettings) {
    w.userSettings = {};
  }

  w.userSettings[id] = {
    language:
      asLang(
        w.aiLang ||
        CURRENT_LANG
      ),
  };

  (w.starter || []).forEach((st) => {
    if (st && st.char) {
      setRel(
        w,
        st.char,
        id,
        {
          score: st.score || 0,
          bond: st.bond || "",
          fixed: !!st.fixed,
        }
      );
    }
  });

  w.rev =
    (w.rev || 0) + 1;

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

  const [code, setCode] =
    useState("");

  const [charName, setCharName] =
    useState(
      w && w.player
        ? w.player.name
        : ""
    );

  const [charUsername, setCharUsername] =
    useState(
      w && w.player
        ? w.player.username || ""
        : ""
    );

  const [seed, setSeed] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const loginUsername =
    w &&
    w.accounts &&
    w.accounts[w.meId]
      ? w.accounts[w.meId].username
      : "";

  const go = async () => {
    const c =
      code.trim().toLowerCase();

    const handle =
      normUser(
        charUsername
      );

    if (!c) {
      return setErr(
        tt(
          "Adj a világnak egy kódot.",
          "Give the world a code."
        )
      );
    }

    if (!charName.trim()) {
      return setErr(
        tt(
          "Add meg a karaktered nevét ebben a világban.",
          "Enter your character's name in this world."
        )
      );
    }

    if (!handle) {
      return setErr(
        tt(
          "Adj meg külön karakter-felhasználónevet (@név) ehhez a világhoz.",
          "Choose a separate character username (@handle) for this world."
        )
      );
    }

    setBusy(true);

    try {
      /*
       * A globális profil már hitelesítve van a HttpOnly sessionből.
       * Itt NEM kérünk új jelszót, és NEM hozunk létre második login-profilt.
       */
      const nw =
        seed
          ? seedWorld(c)
          : emptyWorld(c);

      nw.aiLang =
        worldLanguage(
          w,
          w.meId
        );

      /*
       * Teljes player struktúrát építünk már kliensoldalon is
       * (userSettings, starter relations, blankPlayer mezők).
       * Jelszót nem kérünk és nem tárolunk itt; a backend a már
       * hitelesített globális profil credentialjeit illeszti rá.
       */
      const localMeId =
        await addAccount(
          nw,
          loginUsername ||
            normUser(charName) ||
            "jatekos",
          "",
          charName.trim(),
          handle
        );

      nw.owner =
        localMeId;

      const created =
        await serverCreateProfileWorld(
          nw,
          charName.trim(),
          handle
        );

      if (
        !created ||
        !created.world ||
        !created.meId
      ) {
        throw new Error(
          tt(
            "A szerver hibás választ adott az új világ létrehozásakor.",
            "The server returned an invalid response while creating the new world."
          )
        );
      }

      const serverWorld =
        migrate(
          created.world
        );

      /*
       * Emergency helyi backup az új worldről.
       */
      try {
        await saveWorldMerged(
          serverWorld
        );
      } catch (e) {}

      onReady(
        serverWorld,
        created.meId
      );
    } catch (e) {
      if (
        e &&
        e.status === 409
      ) {
        setErr(
          tt(
            "Ez a világkód már foglalt. Válassz másikat.",
            "This world code is already taken. Choose another."
          )
        );
      } else {
        setErr(
          (e && e.message) ||
          tt(
            "Nem sikerült létrehozni a világot.",
            "Failed to create the world."
          )
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="sheet">
        <div className="between">
          <h2 style={{ fontSize: 20 }}>
            {tt(
              "Új világ",
              "New world"
            )}
          </h2>

          <button
            type="button"
            className="btn tiny ghost"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div
          className="card"
          style={{
            marginTop: 12,
            borderColor: "var(--gold)",
          }}
        >
          <div className="name">
            {tt(
              "Ugyanaz a profil, új világ",
              "Same profile, new world"
            )}
          </div>

          <p
            className="hint"
            style={{
              marginTop: 6,
            }}
          >
            {tt(
              "A bejelentkezési felhasználóneved és jelszavad változatlan marad. Csak a világkód és az ebben a világban használt karaktered változik.",
              "Your login username and password stay the same. Only the world code and the character you use inside this world change."
            )}
          </p>

          {loginUsername ? (
            <div
              className="handle mono"
              style={{
                marginTop: 7,
              }}
            >
              {tt(
                "Alapprofil",
                "Base profile"
              )}
              : @{loginUsername}
            </div>
          ) : null}
        </div>

        <label className="f">
          {tt(
            "Az új világ kódja",
            "The new world's code"
          )}
        </label>

        <input
          className="i mono"
          value={code}
          placeholder={tt(
            "pl. eszaki-part-2027",
            "e.g. northshore-2027"
          )}
          onChange={(e) =>
            setCode(
              e.target.value
                .replace(/\s+/g, "-")
                .toLowerCase()
            )
          }
        />

        <label className="f">
          {tt(
            "A karaktered neve ebben a világban",
            "Your character's name in this world"
          )}
        </label>

        <input
          className="i"
          value={charName}
          onChange={(e) =>
            setCharName(
              e.target.value
            )
          }
        />

        <label className="f">
          {tt(
            "A karakter @felhasználóneve",
            "Character @username"
          )}
        </label>

        <input
          className="i mono"
          value={charUsername}
          placeholder={tt(
            "pl. meg.barnes",
            "e.g. meg.barnes"
          )}
          onChange={(e) =>
            setCharUsername(
              e.target.value
                .replace(/^@/, "")
                .toLowerCase()
            )
          }
        />

        <p
          className="hint"
          style={{
            marginTop: 6,
          }}
        >
          {tt(
            "Ez a közösségi médiás @név, nem a bejelentkezési felhasználóneved. Világonként eltérhet.",
            "This is the social @handle, not your login username. It can be different in every world."
          )}
        </p>

        <div
          className="between"
          style={{
            marginTop: 14,
          }}
        >
          <span className="hint">
            {tt(
              "Kezdés példakarakterekkel",
              "Start with example characters"
            )}
          </span>

          <button
            type="button"
            className={
              "btn tiny " +
              (
                seed
                  ? "primary"
                  : "ghost"
              )
            }
            onClick={() =>
              setSeed(!seed)
            }
          >
            {seed
              ? tt("Igen", "Yes")
              : tt("Nem", "No")}
          </button>
        </div>

        <button
          type="button"
          className="btn primary full"
          style={{
            marginTop: 16,
          }}
          onClick={go}
          disabled={busy}
        >
          {busy
            ? (
                <Loader2
                  size={15}
                  className="spin"
                />
              )
            : (
                <Zap size={15} />
              )}

          {tt(
            "Világ létrehozása",
            "Create world"
          )}
        </button>
      </div>
    </div>
  );
}

function Rooms({
  w,
  onOpen,
  onCreate,
  onClose,
  setErr,
  onSignOut,
}) {
  useEditLock();

  const { tt } = useLang();

  const [list, setList] =
    useState(null);

  const [busy, setBusy] =
    useState("");

  const [profileUsername, setProfileUsername] =
    useState("");

  const refresh =
    useCallback(
      async () => {
        try {
          const result =
            await serverProfileWorlds();

          const worlds =
            Array.isArray(
              result &&
              result.worlds
            )
              ? result.worlds
              : [];

          setProfileUsername(
            String(
              (
                result &&
                result.profileUsername
              ) ||
              ""
            )
          );

          setList(
            worlds
              .filter(
                (r) =>
                  r &&
                  r.code
              )
              .map(
                (r) => ({
                  code:r.code,
                  name:
                    r.name ||
                    r.code,
                  meId:
                    r.meId || "",
                  characterName:
                    r.characterName || "",
                  characterUsername:
                    r.characterUsername || "",
                  updatedAt:
                    r.updatedAt || "",
                })
              )
          );

          return;
        } catch (e) {
          /*
           * Offline fallback:
           * csak tájékoztató emergency lista.
           */
          const mine =
            await loadRooms();

          setList(
            (mine || [])
              .filter(
                (r) =>
                  r &&
                  r.code
              )
              .map(
                (r) => ({
                  code:r.code,
                  name:
                    r.name ||
                    r.code,
                  meId:
                    r.meId || "",
                  offlineOnly:true,
                })
              )
          );
        }
      },
      []
    );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const open =
    async (r) => {
      if (
        !r ||
        !r.code ||
        (
          w &&
          r.code === w.code
        )
      ) {
        return;
      }

      if (r.offlineOnly) {
        setErr(
          tt(
            "Offline csak a helyi emergency világlista látható. Világváltáshoz csatlakozz az internethez.",
            "Offline, only the local emergency world list is available. Connect to the internet to switch worlds."
          )
        );
        return;
      }

      setBusy(r.code);

      try {
        const result =
          await serverSwitchProfileWorld(
            r.code
          );

        if (
          !result ||
          !result.world ||
          !result.meId
        ) {
          throw new Error(
            tt(
              "A szerver hibás világváltási választ adott.",
              "The server returned an invalid world-switch response."
            )
          );
        }

        const nextWorld =
          migrate(
            result.world
          );

        try {
          await saveWorldMerged(
            nextWorld
          );
        } catch (e) {}

        onOpen(
          nextWorld,
          result.meId
        );

        onClose();
      } catch (e) {
        setErr(
          (e && e.message) ||
          tt(
            "Nem sikerült világot váltani.",
            "Failed to switch worlds."
          )
        );
      } finally {
        setBusy("");
      }
    };

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="sheet">
        <div className="between">
          <div>
            <h2 style={{ fontSize: 20 }}>
              {tt(
                "Világaim",
                "My worlds"
              )}
            </h2>

            {profileUsername ? (
              <div
                className="handle mono"
                style={{
                  marginTop: 3,
                }}
              >
                {tt(
                  "Alapprofil",
                  "Base profile"
                )}
                : @{profileUsername}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="btn tiny ghost"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <p
          className="hint"
          style={{
            marginTop: 10,
          }}
        >
          {tt(
            "Ugyanazzal a bejelentkezési felhasználónévvel és jelszóval több külön világod lehet. A karaktered neve és közösségi @felhasználóneve világonként eltérhet.",
            "One login username and password can own multiple separate worlds. Your character name and social @username can differ in every world."
          )}
        </p>

        <button
          type="button"
          className="btn primary full"
          style={{
            marginTop: 14,
          }}
          onClick={onCreate}
        >
          <Plus size={15} />
          {tt(
            "Új világ ezen a profilon",
            "New world on this profile"
          )}
        </button>

        {list === null ? (
          <div className="thinking">
            <Loader2
              size={13}
              className="spin"
            />
            {tt(
              "betöltés…",
              "loading…"
            )}
          </div>
        ) : null}

        {list &&
        list.length === 0 ? (
          <p
            className="hint"
            style={{
              marginTop: 14,
            }}
          >
            {tt(
              "Ehhez a profilhoz még nincs világ kapcsolva.",
              "No worlds are linked to this profile yet."
            )}
          </p>
        ) : null}

        {(list || []).map((r) => {
          const here =
            Boolean(
              w &&
              r.code === w.code
            );

          return (
            <button
              type="button"
              className="card"
              key={r.code}
              onClick={() =>
                open(r)
              }
              disabled={
                here ||
                Boolean(busy)
              }
              style={{
                width:"100%",
                textAlign:"left",
                cursor:
                  here
                    ? "default"
                    : "pointer",
                borderColor:
                  here
                    ? "var(--rose)"
                    : "var(--line)",
              }}
            >
              <div className="between">
                <div
                  style={{
                    minWidth:0,
                  }}
                >
                  <div className="name">
                    {r.name ||
                    r.code}
                  </div>

                  <div className="handle mono">
                    {r.code}
                  </div>

                  {r.characterName || r.characterUsername ? (
                    <div
                      className="hint"
                      style={{
                        marginTop:4,
                      }}
                    >
                      {r.characterName || ""}
                      {r.characterUsername
                        ? `${r.characterName ? " · " : ""}@${r.characterUsername}`
                        : ""}
                    </div>
                  ) : null}
                </div>

                {here ? (
                  <span
                    className="chip"
                    style={{
                      color:"var(--rose)",
                      borderColor:"var(--rose)",
                    }}
                  >
                    {tt(
                      "itt vagy",
                      "current"
                    )}
                  </span>
                ) : busy === r.code ? (
                  <Loader2
                    size={15}
                    className="spin"
                  />
                ) : (
                  <ChevronRight
                    size={17}
                  />
                )}
              </div>

              {r.offlineOnly ? (
                <div
                  className="hint"
                  style={{
                    marginTop:6,
                  }}
                >
                  {tt(
                    "csak helyi emergency bejegyzés",
                    "local emergency entry only"
                  )}
                </div>
              ) : null}
            </button>
          );
        })}

        <div className="sep" />

        <button
          type="button"
          className="btn ghost full"
          onClick={onSignOut}
        >
          {tt(
            "Kijelentkezés az alapprofilból",
            "Log out of base profile"
          )}
        </button>
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
  const [charUsername, setCharUsername] = useState("");
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

  // A szobakód ellenőrzése gépelés közben: online mindig a szerver az igazság.
  useEffect(() => {
    const c =
      code.trim().toLowerCase();

    if (!c) {
      setPeek(null);
      return;
    }

    let alive = true;

    const t =
      setTimeout(async () => {
        const offline =
          typeof navigator !== "undefined" &&
          navigator.onLine === false;

        if (!offline) {
          try {
            const result =
              await serverWorldPeek(c);

            if (!alive) return;

            setPeek({
              found:
                Boolean(
                  result &&
                  result.found
                ),
              name:
                (
                  result &&
                  result.name
                ) || c,
              server: true,
            });

            return;
          } catch (e) {
            /*
             * Online szerverhibánál nem állítjuk egy régi cache-ről,
             * hogy az a valós szerverállapot.
             */
            if (!alive) return;
            setPeek(null);
            return;
          }
        }

        /* Offline csak tájékoztató emergency cache. */
        const wld =
          await loadWorld(c);

        if (!alive) return;

        setPeek(
          wld
            ? {
                found: true,
                name:
                  (
                    wld.universe &&
                    wld.universe.name
                  ) || c,
                server: false,
              }
            : {
                found: false,
                server: false,
              }
        );
      }, 450);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [code]);

  const u = normUser(user);
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

  if (
    isNew &&
    !normUser(charUsername)
  ) {
    return setErr(
      tt(
        "Add meg a karaktered külön @felhasználónevét.",
        "Enter a separate @username for your character."
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
      const w = seed
        ? seedWorld(c)
        : emptyWorld(c);

      w.aiLang =
        lang === "en"
          ? "en"
          : "hu";

      const localMeId =
        await addAccount(
          w,
          u,
          pw,
          name.trim(),
          charUsername
        );

      w.owner =
        localMeId;

      /*
       * A kódfoglaltságról kizárólag PostgreSQL dönt.
       * Egy régi helyi backup nem blokkolhat új világot.
       */
      let created;

      try {
        created =
          await serverMigrate(
            w,
            u,
            pw
          );
      } catch (e) {
        if (
          e &&
          e.status === 409
        ) {
          throw new Error(
            tt(
              "Ez a világkód már foglalt a szerveren. Válassz másikat.",
              "This world code is already taken on the server. Choose another."
            )
          );
        }

        throw e;
      }

      const serverWorld =
        migrate(
          created &&
          created.world
            ? created.world
            : w
        );

      const serverMeId =
        (
          created &&
          created.meId
        ) ||
        localMeId;

      /*
       * Helyi emergency backup csak a sikeres szerveres létrehozás után.
       */
      try {
        await saveWorldMerged(
          serverWorld
        );
      } catch (e) {}

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
        {tt(
          "Az első világoddal létrejön az alapprofilod. Ugyanazzal a login felhasználónévvel és jelszóval később több külön világot is hozzáadhatsz.",
          "Your first world creates your base profile. Later you can attach multiple separate worlds to the same login username and password."
        )}
      </p>

      <div className="card">
        <div className="row" style={{ gap: 6 }}>
          {tab("login", tt("Belépés", "Log in"))}
          {tab("new", tt("Új világ", "New world"))}
        </div>

        <label className="f">{isNew ? tt("Az új világ kódja", "The new world's code") : tt("Világkód", "World code")}</label>
        <input className="i mono" value={code} placeholder={tt("pl. beaconfalls-2026", "e.g. beaconfalls-2026")} onKeyDown={onEnter}
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
        <input className="i mono" value={user} placeholder={tt("pl. anita", "e.g. anita")} onKeyDown={onEnter}
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
            <input className="i" value={name} placeholder={tt("pl. Anita Kovács", "e.g. Anita Kovacs")} onKeyDown={onEnter}
              onChange={(e) => setName(e.target.value)} />
            <label className="f">
              {tt(
                "A karakter @felhasználóneve",
                "Character @username"
              )}
            </label>
            <input
              className="i mono"
              value={charUsername}
              placeholder={tt(
                "pl. meg.barnes",
                "e.g. meg.barnes"
              )}
              onKeyDown={onEnter}
              onChange={(e) =>
                setCharUsername(
                  e.target.value
                    .replace(/^@/, "")
                    .toLowerCase()
                )
              }
            />
            <p className="hint" style={{ marginTop: 6 }}>
              {tt(
                "A login felhasználóneved a fiókodhoz tartozik; ez az @név a karaktered közösségi profiljához. A kettő eltérhet.",
                "Your login username belongs to your account; this @handle belongs to your character's social profile. They can be different."
              )}
            </p>
            <p className="hint" style={{ marginTop: 6 }}>
              {tt(
                "Ezzel a karakterrel posztolsz, csetelsz és játszol a jelenetekben. Az adatlapját később bármikor kitöltöd.",
                "You'll post, chat and play scenes with this character. You can fill in their sheet anytime later."
              )}
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
function CommentNode({ w, c, allComments, onReply, depth, onOpenProfile }) {
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
    setTxt("");
    setOpen(false);
  };

  return (
    <div
      className="social-comment"
      style={depth ? {
        marginLeft: 18,
        paddingLeft: 10,
        borderLeft: "1px solid var(--line)",
      } : null}
    >
      <div className="cmt">
        <button
          type="button"
          className="social-author-click"
          onClick={() => onOpenProfile && onOpenProfile(a.id)}
          title={tt("Profil megnyitása", "Open profile")}
        >
          <Av src={a.avatar} name={a.name} size={depth ? 24 : 28} radius={depth ? 8 : 9} />
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="social-post-meta">
            <button
              type="button"
              className="social-author-click"
              onClick={() => onOpenProfile && onOpenProfile(a.id)}
            >
              <span className="cmt-name">{a.name}</span>
            </button>
            <span className="handle mono">@{a.username}</span>
            <span className="social-dot-sep">·</span>
            <span className="handle mono">{timeAgo(c.ts)}</span>
          </div>

          <div className="cmt-body">{c.text}</div>

          <button
            className="social-comment-action"
            onClick={() => setOpen(!open)}
          >
            {tt("Válasz", "Reply")}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="row"
          style={{ gap: 8, marginTop: 8, marginLeft: depth ? 0 : 36, alignItems: "center" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="i"
              style={{ padding: "6px 10px", fontSize: 13 }}
              value={txt}
              autoFocus
              placeholder={tt(`Válasz neki: ${a.name}`, `Reply to ${a.name}`)}
              onChange={(e) => setTxt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
            <MentionBar w={w} value={txt} onChange={setTxt} compact />
          </div>
          <button className="btn primary tiny" onClick={send} disabled={!txt.trim()}>
            <Send size={12} />
          </button>
        </div>
      )}

      {replies.map((r) => (
        <CommentNode
          key={r.id}
          w={w}
          c={r}
          allComments={allComments}
          depth={(depth || 0) + 1}
          onReply={onReply}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </div>
  );
}

function Post({
  w,
  post,
  onLike,
  onComment,
  onRepost,
  onToggleFollow,
  onOpenProfile,
  highlight,
  nodeRef,
}) {
  const { tt } = useLang();
  const { media } = useMedia();
  const [cmt, setCmt] = useState("");
  const commentInput = useRef(null);
  const author = charById(w, post.authorId);

  if (!author) return null;

  const comments = post.comments || [];
  const tops = comments.filter((c) => !c.parent);
  const orphans = comments.filter(
    (c) => c.parent && !comments.some((x) => x.id === c.parent)
  );

  const liked =
    Array.isArray(post.likedBy) &&
    post.likedBy.includes(w.meId);

  const reposted =
    hasReposted(
      w,
      w.meId,
      post.id
    );

  const reposts =
    repostCount(
      w,
      post.id
    );

  const following =
    author.id !== w.meId &&
    isFollowing(w, w.meId, author.id);

  const sendCmt = () => {
    const t = cmt.trim();
    if (!t) return;
    onComment(post.id, t, null);
    setCmt("");
  };

  return (
    <article
      className={"social-post" + (highlight ? " highlight" : "")}
      ref={nodeRef}
    >
      <div className="social-post-head">
        <button
          type="button"
          className="social-author-click"
          onClick={() => onOpenProfile && onOpenProfile(author.id)}
          title={tt("Profil megnyitása", "Open profile")}
        >
          <Av src={author.avatar} name={author.name} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="between">
            <div className="social-post-meta" style={{ minWidth: 0 }}>
              <button
                className="social-author-click"
                onClick={() => onOpenProfile && onOpenProfile(author.id)}
              >
                <span className="name">{author.name}</span>
              </button>
              <span className="handle mono">@{author.username}</span>
              <span className="social-dot-sep">·</span>
              <span className="handle mono">{timeAgo(post.ts)}</span>

              {post.virality &&
              post.virality.status &&
              post.virality.status !==
                "normal" ? (
                <span
                  className={
                    "social-viral-badge" +
                    (
                      post.virality.status ===
                        "breakout"
                        ? " breakout"
                        : ""
                    )
                  }
                >
                  🔥{" "}
                  {post.virality.status ===
                  "breakout"
                    ? tt(
                        "Kitört",
                        "Breakout"
                      )
                    : post.virality.status ===
                        "viral"
                      ? tt(
                          "Virális",
                          "Viral"
                        )
                      : tt(
                          "Felkapott",
                          "Rising"
                        )}
                </span>
              ) : null}
            </div>

            {author.id !== w.meId ? (
              <button
                className={following ? "btn tiny ghost social-following" : "btn tiny ghost"}
                onClick={() => onToggleFollow(author.id)}
              >
                {following ? (
                  <><Check size={12} />{tt("Követed", "Following")}</>
                ) : (
                  <><Plus size={12} />{tt("Követés", "Follow")}</>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {post.gossipStory ? (
        <>
          <div className="gossip-post-kicker">
            <span
              className={
                post.gossipStory.factLevel === "observed"
                  ? "confirmed"
                  : "rumor"
              }
            >
              {post.gossipStory.factLevel === "observed"
                ? tt(
                    "megerősített",
                    "confirmed"
                  )
                : post.gossipStory.factLevel === "speculation"
                  ? tt(
                      "spekuláció",
                      "speculation"
                    )
                  : post.gossipStory.factLevel === "inferred"
                    ? tt(
                        "következtetés",
                        "inference"
                      )
                    : tt(
                        "pletyka",
                        "rumor"
                      )}
            </span>

            <span>·</span>

            <span>
              {post.gossipStory.format === "breaking"
                ? tt(
                    "breaking",
                    "breaking"
                  )
                : post.gossipStory.format === "recap"
                  ? tt(
                      "összefoglaló",
                      "recap"
                    )
                  : post.gossipStory.format === "analysis"
                    ? tt(
                        "elemzés",
                        "analysis"
                      )
                    : post.gossipStory.format === "long"
                      ? tt(
                          "hosszú sztori",
                          "long read"
                        )
                      : tt(
                          "sztori",
                          "story"
                        )}
            </span>
          </div>

          {post.gossipStory.headline ? (
            <div className="gossip-post-headline">
              {post.gossipStory.headline}
            </div>
          ) : null}
        </>
      ) : null}

      {post.text ? <div className="social-post-body">{post.text}</div> : null}

      {(post.imageId || post.image) ? (
        <img
          className="social-post-media"
          src={resolveImg(post.imageId ? imageRef(post.imageId) : post.image, media)}
          alt=""
        />
      ) : null}

      <div className="social-actions">
        <button
          className={"social-action" + (liked ? " liked" : "")}
          onClick={() => onLike(post.id)}
          aria-label={tt("Kedvelés", "Like")}
        >
          <Heart size={17} fill={liked ? "currentColor" : "none"} />
          <span>{formatSocialCount(displayPostLikeCount(w, post))}</span>
        </button>

        <button
          className="social-action"
          onClick={() => commentInput.current && commentInput.current.focus()}
          aria-label={tt("Hozzászólás", "Comment")}
        >
          <MessageCircle size={17} />
          <span>{comments.length}</span>
        </button>

        <button
          className={
            "social-action" +
            (
              reposted
                ? " reposted"
                : ""
            )
          }
          onClick={() => {
            if (
              !reposted &&
              onRepost
            ) {
              onRepost(post.id);
            }
          }}
          disabled={reposted}
          aria-label={tt(
            "Újraosztás",
            "Repost"
          )}
        >
          <RefreshCcw size={17} />
          <span>{reposts}</span>
        </button>

        {post.reach && Number(post.reach.impressions) > 0 ? (
          <span
            className="social-action social-reach"
            title={tt("Becsült elérés", "Estimated reach")}
          >
            <Zap size={16} />
            <span>{formatSocialCount(Number(post.reach.impressions) || 0)}</span>
          </span>
        ) : null}
      </div>

      {comments.length > 0 ? (
        <div className="social-comments">
          {tops.concat(orphans).map((c) => (
            <CommentNode
              key={c.id}
              w={w}
              c={c}
              allComments={comments}
              depth={0}
              onReply={(parentId, replyText) =>
                onComment(post.id, replyText, parentId)
              }
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      ) : null}

      <div className="social-comment-box">
        <button
          type="button"
          className="social-author-click"
          onClick={() => onOpenProfile && onOpenProfile(w.meId)}
        >
          <Av src={w.player.avatar} name={w.player.name} size={28} radius={9} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            ref={commentInput}
            className="i"
            value={cmt}
            placeholder={tt("Írj hozzászólást…", "Write a comment…")}
            onChange={(e) => setCmt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendCmt(); }}
          />
          <MentionBar w={w} value={cmt} onChange={setCmt} compact />
        </div>

        <button className="btn primary tiny" onClick={sendCmt} disabled={!cmt.trim()}>
          <Send size={13} />
        </button>
      </div>
    </article>
  );
}

function SocialProfileModal({
  w,
  c,
  update,
  onClose,
  onChat,
  onOpenProfile,
  onWorlds,
}) {
  useEditLock();

  const { tt } = useLang();
  const { media } = useMedia();
  const [tab, setTab] = useState("posts");

  const coverUrl =
    resolveImg(
      c && c.cover,
      media
    );

  if (!c) return null;

  const mine = c.id === w.meId;

  const mediaAccount =
    isMediaAccount(
      w,
      c.id
    );

  const following =
    !mine &&
    isFollowing(
      w,
      w.meId,
      c.id
    );

  const posts = (w.posts || [])
    .filter((p) => p && p.authorId === c.id)
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const knownFollowers = socialProfiles(w).filter(
    (person) =>
      person &&
      person.id !== c.id &&
      isFollowing(w, person.id, c.id)
  );

  const knownFollowing = socialProfiles(w).filter(
    (person) =>
      person &&
      person.id !== c.id &&
      isFollowing(w, c.id, person.id)
  );

  const totalFollowers = displayFollowerCount(w, c.id);
  const backgroundFollowers = Math.max(
    0,
    totalFollowers - knownFollowers.length
  );

  const socialStats =
    (
      w.socialStats &&
      w.socialStats[c.id]
    ) ||
    defaultSocialStatsRow();

  const sentiment =
    socialStats.sentiment ||
    defaultSocialStatsRow().sentiment;

  const toggleFollow = () => {
    if (mine) return;

    update((n) => {
      setFollowState(
        n,
        n.meId || w.meId,
        c.id,
        !isFollowing(n, n.meId || w.meId, c.id),
        "player"
      );
    });
  };

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="between">
          <button className="btn tiny ghost" onClick={onClose}>
            <ChevronLeft size={14} /> {tt("Vissza", "Back")}
          </button>

          {!mine &&
          !mediaAccount ? (
            <button
              className="btn tiny ghost"
              onClick={() =>
                onChat &&
                onChat(c.id)
              }
            >
              <MessageCircle size={13} /> {tt("Üzenet", "Message")}
            </button>
          ) : null}
        </div>

        <div className="card social-profile" style={{ marginTop: 12 }}>
          <div
            className="social-cover"
            style={{
              background:
                `radial-gradient(circle at 18% 15%, hsla(${hue(c.username || c.name)}, 70%, 65%, .42), transparent 35%), linear-gradient(135deg, hsl(${hue(c.name)} 32% 19%), hsl(${(hue(c.name) + 55) % 360} 38% 10%))`,
            }}
          >
            {coverUrl ? (
              <img
                className="social-cover-img"
                src={coverUrl}
                alt=""
              />
            ) : null}
          </div>

          <div className="social-profile-main">
            <div className="social-profile-top">
              <div className="social-profile-avatar">
                <Av src={c.avatar} name={c.name} size={76} radius={18} />
              </div>

              {!mine ? (
                <div className="social-profile-actions">
                  <button
                    className={following ? "btn tiny ghost social-following" : "btn tiny primary"}
                    onClick={toggleFollow}
                  >
                    {following ? (
                      <><Check size={13} />{tt("Követed", "Following")}</>
                    ) : (
                      <><Plus size={13} />{tt("Követés", "Follow")}</>
                    )}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="social-profile-name">
              <h2 style={{ fontSize: 22 }}>{c.name}</h2>
              <div className="handle mono">@{c.username}</div>

              {mediaAccount ? (
                <div className="social-media-account-tag">
                  <Globe2 size={11} />
                  {c.mediaKind === "local"
                    ? tt(
                        "helyi pletykamédia",
                        "local gossip media"
                      )
                    : tt(
                        "világszintű pletykamédia",
                        "global gossip media"
                      )}
                </div>
              ) : null}
            </div>

            {c.bio ? (
              <div style={{ marginTop: 8, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
                {c.bio}
              </div>
            ) : (
              <div className="hint" style={{ marginTop: 8 }}>
                {tt("Nincs bio megadva.", "No bio yet.")}
              </div>
            )}

            <div className="social-profile-meta">
              {c.job ? <span>{c.job}</span> : null}
              {c.city ? <span>· {c.city}</span> : null}
              {ageOf(c, w) ? (
                <span>· {ageOf(c, w)} {termText("yearsOld", worldLanguage(w))}</span>
              ) : null}
            </div>

            <div className="social-profile-stats">
              <button
                className="social-profile-stat social-author-click"
                onClick={() => setTab("posts")}
              >
                <strong>{formatSocialCount(posts.length)}</strong>
                <span>{tt("Poszt", "Posts")}</span>
              </button>

              <button
                className="social-profile-stat social-author-click"
                onClick={() => setTab("followers")}
              >
                <strong>{formatSocialCount(totalFollowers)}</strong>
                <span>{tt("Követő", "Followers")}</span>
              </button>

              <button
                className="social-profile-stat social-author-click"
                onClick={() => setTab("following")}
              >
                <strong>{formatSocialCount(displayFollowingCount(w, c.id))}</strong>
                <span>{tt("Követés", "Following")}</span>
              </button>
            </div>

            {!mine && isFollowing(w, c.id, w.meId) ? (
              <div className="social-count" style={{ marginTop: 8 }}>
                {tt("Követ téged", "Follows you")}
              </div>
            ) : null}

            {mine && onWorlds ? (
              <button
                type="button"
                className="btn full"
                style={{ marginTop: 10 }}
                onClick={() => {
                  onClose();
                  onWorlds();
                }}
              >
                <Globe2 size={14} />
                {tt(
                  "Világaim — váltás / új világ",
                  "My worlds — switch / new world"
                )}
              </button>
            ) : null}

            <div className="social-sentiment-strip">
              {Number(socialStats.clout) > 0 ? (
                <span className="social-sentiment-chip">
                  ⚡
                  <strong>
                    {Math.round(
                      Number(
                        socialStats.clout
                      ) || 0
                    )}
                  </strong>
                  {tt(
                    "clout",
                    "clout"
                  )}
                </span>
              ) : null}

              {Number(socialStats.popularity) > 0 ? (
                <span className="social-sentiment-chip">
                  ◉
                  <strong>
                    {Math.round(
                      Number(
                        socialStats.popularity
                      ) || 0
                    )}
                  </strong>
                  {tt(
                    "népszerűség",
                    "popularity"
                  )}
                </span>
              ) : null}

              {Number(socialStats.aura) !== 0 ? (
                <span className="social-sentiment-chip">
                  ✦
                  <strong>
                    {Math.round(
                      Number(
                        socialStats.aura
                      ) || 0
                    )}
                  </strong>
                  {tt(
                    "aura",
                    "aura"
                  )}
                </span>
              ) : null}

              {Number(socialStats.reputation) !== 0 ? (
                <span className="social-sentiment-chip">
                  ◆
                  <strong>
                    {Math.round(
                      Number(
                        socialStats.reputation
                      ) || 0
                    )}
                  </strong>
                  {tt(
                    "hírnév",
                    "reputation"
                  )}
                </span>
              ) : null}

              {Number(socialStats.humor) !== 0 ? (
                <span className="social-sentiment-chip">
                  ☺
                  <strong>
                    {Math.round(
                      Number(
                        socialStats.humor
                      ) || 0
                    )}
                  </strong>
                  {tt(
                    "humor",
                    "humor"
                  )}
                </span>
              ) : null}

              {Number(socialStats.hype) > 0 ? (
                <span className="social-sentiment-chip">
                  🔥
                  <strong>
                    {Math.round(
                      Number(
                        socialStats.hype
                      ) || 0
                    )}
                  </strong>
                  {tt(
                    "hype",
                    "hype"
                  )}
                </span>
              ) : null}

              {Number(sentiment.stanEnergy) > 0 ? (
                <span className="social-sentiment-chip">
                  ★
                  <strong>
                    {Math.round(
                      Number(
                        sentiment.stanEnergy
                      ) || 0
                    )}
                  </strong>
                  {tt(
                    "stan",
                    "stan"
                  )}
                </span>
              ) : null}

              {Number(sentiment.cancelPressure) > 0 ? (
                <span className="social-sentiment-chip">
                  ⚠
                  <strong>
                    {Math.round(
                      Number(
                        sentiment.cancelPressure
                      ) || 0
                    )}
                  </strong>
                  {tt(
                    "backlash",
                    "backlash"
                  )}
                </span>
              ) : null}

              {Number(sentiment.controversy) > 0 ? (
                <span className="social-sentiment-chip">
                  ◐
                  <strong>
                    {Math.round(
                      Number(
                        sentiment.controversy
                      ) || 0
                    )}
                  </strong>
                  {tt(
                    "megosztó",
                    "controversy"
                  )}
                </span>
              ) : null}
            </div>

            <div className="social-profile-tabs">
              <button
                className={"social-profile-tab" + (tab === "posts" ? " on" : "")}
                onClick={() => setTab("posts")}
              >
                {tt("Posztok", "Posts")}
              </button>
              <button
                className={"social-profile-tab" + (tab === "followers" ? " on" : "")}
                onClick={() => setTab("followers")}
              >
                {tt("Követők", "Followers")}
              </button>
              <button
                className={"social-profile-tab" + (tab === "following" ? " on" : "")}
                onClick={() => setTab("following")}
              >
                {tt("Követések", "Following")}
              </button>
            </div>

            {tab === "posts" ? (
              <div className="social-profile-feed">
                {posts.length ? posts.map((p) => (
                  <div className="social-profile-post" key={p.id}>
                    <div className="handle mono">
                      {timeAgo(p.ts)} · {p.likes || 0} {tt("kedvelés", "likes")} · {(p.comments || []).length} {tt("hozzászólás", "comments")}
                    </div>

                    {p.text ? (
                      <div className="social-profile-post-text">{p.text}</div>
                    ) : null}

                    {(p.imageId || p.image) ? (
                      <img
                        className="social-profile-post-media"
                        src={resolveImg(p.imageId ? imageRef(p.imageId) : p.image, media)}
                        alt=""
                      />
                    ) : null}
                  </div>
                )) : (
                  <div className="social-empty">
                    {tt("Még nincs poszt.", "No posts yet.")}
                  </div>
                )}
              </div>
            ) : null}

            {tab === "followers" ? (
              <div>
                {backgroundFollowers > 0 ? (
                  <div className="social-background-followers">
                    {tt(
                      `${formatSocialCount(backgroundFollowers)} további háttérkövető tartozik ehhez a profilhoz. Ők a világ közönségének részei, de nem külön AI-karakterek.`,
                      `${formatSocialCount(backgroundFollowers)} additional background followers belong to this profile. They are part of the world's audience but are not separate AI characters.`
                    )}
                  </div>
                ) : null}

                {knownFollowers.length ? knownFollowers.map((person) => (
                  <div className="social-person-row" key={person.id}>
                    <button
                      type="button"
                      className="social-author-click"
                      onClick={() => onOpenProfile && onOpenProfile(person.id)}
                    >
                      <Av src={person.avatar} name={person.name} size={38} radius={12} />
                    </button>
                    <div className="social-person-row-main">
                      <button
                        type="button"
                        className="social-author-click"
                        onClick={() => onOpenProfile && onOpenProfile(person.id)}
                      >
                        <div className="name">{person.name}</div>
                        <div className="handle mono">@{person.username}</div>
                      </button>
                    </div>
                  </div>
                )) : (
                  <p className="hint">
                    {tt(
                      "Nincs külön játékbeli karakterként ismert követő.",
                      "There are no known in-game followers."
                    )}
                  </p>
                )}
              </div>
            ) : null}

            {tab === "following" ? (
              <div>
                {knownFollowing.length ? knownFollowing.map((person) => (
                  <div className="social-person-row" key={person.id}>
                    <button
                      type="button"
                      className="social-author-click"
                      onClick={() => onOpenProfile && onOpenProfile(person.id)}
                    >
                      <Av src={person.avatar} name={person.name} size={38} radius={12} />
                    </button>
                    <div className="social-person-row-main">
                      <button
                        type="button"
                        className="social-author-click"
                        onClick={() => onOpenProfile && onOpenProfile(person.id)}
                      >
                        <div className="name">{person.name}</div>
                        <div className="handle mono">@{person.username}</div>
                      </button>
                    </div>
                  </div>
                )) : (
                  <p className="hint">
                    {tt(
                      "Még nem követ külön játékbeli profilt.",
                      "This profile does not follow any known in-game profiles yet."
                    )}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
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
  (post.imageId || post.image)
    ? `KÉP A POSZTBAN:
${post.imageDescription ? `A kép AI által felismert látható tartalma: ${post.imageDescription}
` : ""}A szereplők látják a poszthoz tartozó képet is.
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
  .map((c) => `${voiceCard(c)}${characterMemoryCard(w, c)}`)
  .join("")}

KOMMENTELŐK TELJES KARAKTERHŰSÉGE:
- Minden kommentelő teljes karakterlapját és saját emlékeit használd, nem csak a nyilvános bioját.
- A komment hangja, humora, bátorsága, agressziója, flörtje, távolságtartása és szókincse legyen egyértelműen az övé.
- A korábbi emlékei és a poszt szerzőjével való konkrét kapcsolata ténylegesen módosítsa a reakcióját.
- Ha ugyanaz a komment több karakter szájából is hiteles lenne, nem elég specifikus: írd újra.

KÖZVETLEN KAPCSOLATI DINAMIKA A POSZT SZERZŐJÉHEZ:
${cast
  .map(
    (c) =>
      relationshipBehaviorCard(
        w,
        c.id,
        post.authorId
      )
  )
  .filter(Boolean)
  .join("\n") || "-"}

${repetitionGuard(
  w,
  cast.map((c) => c.id),
  "kommentek"
)}

KOMMENT SZABÁLYOK:

- Adj általában 5-9 új kommentet. Ha a poszt kevés embert érint, lehet kevesebb; ha felkapott/drámai és sok releváns karakter van, legyen több különböző reakció.
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

KAPCSOLAT + TÖRTÉNET KÖTELEZŐEN HAT A KOMMENTRE:

- A fenti PRIVÁT KARAKTERJÁTÉK-KONTEXTUST ténylegesen használd minden kommentelőnél.
- Ha valaki jóban van a poszt szerzőjével, ne legyen indokolatlanul távolságtartó: természetesen jöhet támogatás, belsős hang, védelem, ugratás vagy közvetlenség.
- Ha rosszban vannak, ne váljon hirtelen semleges rajongóvá: a feszültség, gúny, rivalizálás, szkepticizmus vagy ellenszenv jelenjen meg, ha a poszt ad rá alkalmat.
- Crush/vonzalom esetén a figyelem, flört, féltékenység, kínos túlreagálás vagy birtoklás érződhet — de ne vallja be automatikusan.
- Ha a karakter alapból flörtölős, és a célpont/helyzet indokolja, ténylegesen flörtölhet; ne lapítsd általános kedvességgé.
- A karakterlap történetéből kiolvasható szervezeti/dojo-lojalitás és rivalizálás is számít. Például Cobra Kai karakter ne kezeljen automatikusan baráti semlegességgel egy Miyagi-Fang/Miyagi-Do/Eagle Fang riválist.
- A személyes kapcsolat felülírhat egy csoportos rivalizálást, de a közös múlt akkor is színezze a hangot.
- Az ERŐVISZONY/FÉLELEM a nyilvános kommentben is számít: egy gyengébb vagy félő karakter ne kezdjen automatikusan nyílt kommentháborút egy hírhedten veszélyes, kiszámíthatatlan vagy jóval erősebb figurával. Inkább lehet óvatos, hallgathat, kerülheti a direkt provokációt vagy csak finoman célozhat rá. Ha a karakterlapja szerint vakmerő, akkor szembeszállhat, de ne legyen érzéketlen a veszélyre.
- Ne mondd ki ezeket magyarázatként. A komment SZÖVEGÉBŐL érződjenek.

FONTOS VÁLTOZATOSSÁG:

- Egy 5-9 kommentes csomagban ne legyen minden reakció ugyanolyan hosszú.
- Ha természetes, legyen legalább egy nagyon rövid komment a csomagban.
- Ne legyen mindenki vicces.
- Ne legyen mindenki támogató.
- Ne legyen mindenki ellenséges.
- Ne reagáljanak mindannyian ugyanarra a részletre.
- Különböző karakterek ugyanazt a posztot különböző szempontból értelmezhetik.
- A kapcsolatuk, aktuális hangulatuk, féltékenységük, vonzalmuk, konfliktusuk és előzményeik befolyásolják, mire reagálnak.

EMOJI:

- Az emoji-használat legyen LÁTHATÓAN jelen a közösségi médiában, de maradjon karakterfüggő.
- Ha a kiválasztott kommentelők között van olyan karakter, aki természetesen használ emojit, egy 5-9 kommentes csomagban legalább 2-3 komment tartalmazzon emojit.
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
    { maxTokens: 1400 }
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
      const tag = String(
  (
    c.reply_to !== undefined
      ? c.reply_to
      : c.replyTo
  ) || ""
)
  .trim()
  .toLowerCase();

let parent =
  byLabel[tag] || null;

const pc =
  parent &&
  p.comments.find(
    (x) => x.id === parent
  );

/*
 * Ha az AI konkrét kommentre válaszolt,
 * az esemény célpontja annak a kommentnek
 * a szerzője legyen.
 *
 * Ha csak simán kommentelt,
 * akkor a poszt szerzője.
 */
const targetId =
  pc && pc.authorId
    ? pc.authorId
    : p.authorId || "";

/*
 * A UI jelenlegi thread-rendszere
 * a mélyebb válaszokat a gyökérkommenthez
 * rendezi, ezt nem változtatjuk meg.
 */
if (pc && pc.parent) {
  parent = pc.parent;
}

const made = {
  id: uid(),
  authorId: who,
  text: body,
  ts: now(),
  parent,
  language: worldLanguage(
    n,
    n.meId
  ),
};

p.comments.push(made);

noteComment(
  n,
  p,
  made
);

recordSocialEvent(
  n,
  {
    type:
      tag
        ? "reply"
        : "comment",

    refId: made.id,
    ts: made.ts,

    actorId: who,

    targetIds:
      targetId &&
      targetId !== who
        ? [targetId]
        : [],

    visibility: "public",
    factLevel: "observed",

    importance:
      tag
        ? 28
        : 20,

    drama: 0,
    romance: 0,
    embarrassment: 0,

    source: "ai",

    text: made.text,

    tags: [
      "social",
      "ai-comment",
      tag
        ? "reply"
        : "comment",
    ],

    meta: {
      postId: p.id,
      commentId: made.id,
      parentId:
        made.parent || "",
      postAuthorId:
        p.authorId || "",
      targetId:
        targetId || "",
    },
  }
);
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
          text: sysLangText(
            n,
            who,
            `${nameOfIn(n, p.authorId)} posztjára reagáltam.`,
            `I reacted to ${nameOfIn(n, p.authorId)}'s post.`
          ),
        });
      }
    });
    (out.likes || []).forEach((lid) => {
  const who = aiVoice(
    n,
    lid
  );

  if (
    !who ||
    who === p.authorId
  ) {
    return;
  }

  if (!Array.isArray(p.likedBy)) {
    p.likedBy = [];
  }

  /*
   * Ugyanaz az AI ugyanazt a
   * posztot csak egyszer lájkolhatja.
   */
  if (p.likedBy.includes(who)) {
    return;
  }

  p.likedBy.push(who);

  p.likes =
    Math.max(
      Number(p.likes) || 0,
      p.likedBy.length
    );

  recordSocialEvent(
    n,
    {
      type: "like",

      refId:
        `${p.id}:${who}`,

      ts: now(),

      actorId: who,

      targetIds:
        p.authorId &&
        p.authorId !== who
          ? [p.authorId]
          : [],

      visibility: "public",
      factLevel: "observed",

      importance: 8,
      drama: 0,
      romance: 0,
      embarrassment: 0,

      source: "ai",

      text:
        "Liked a post.",

      tags: [
        "social",
        "like",
        "ai-like",
      ],

      meta: {
        postId: p.id,
        postAuthorId:
          p.authorId || "",
      },
    }
  );

  const a =
    charById(
      n,
      who
    );

  if (isHuman(n, p.authorId)) {
    pushNote(
      n,
      p.authorId,
      {
        icon: "🤍",
        translationKey:
          "likedYourPost",

        params: {
          name:
            a
              ? a.name
              : sysTextFor(
                  n,
                  p.authorId,
                  "someone"
                ),
        },

        text:
          sysTextFor(
            n,
            p.authorId,
            "likedYourPost",
            {
              name:
                a
                  ? a.name
                  : sysTextFor(
                      n,
                      p.authorId,
                      "someone"
                    ),
            }
          ),

        /*
         * namedActorId jelzi, hogy ez NEM háttér-like,
         * hanem egy tényleges játékbeli AI-karakter like-ja.
         */
        namedActorId:
          a
            ? a.id
            : who,

        link: {
          type: "post",
          id: p.id,
        },
      }
    );
  }
});
  }
  applyChanges(n, out.changes);
  n.log = [...(out.events || []), ...n.log].slice(0, 30);
}
function socialInteractionInterest(
  w,
  actorId,
  targetId
) {
  if (
    !actorId ||
    !targetId ||
    actorId === targetId
  ) {
    return 0;
  }

  const actor =
    charById(
      w,
      actorId
    );

  const target =
    charById(
      w,
      targetId
    );

  if (
    !actor ||
    !target
  ) {
    return 0;
  }

  const rel =
    getRel(
      w,
      actorId,
      targetId
    );

  const score =
    Number(
      rel.score
    ) || 0;

  let interest =
    Math.min(
      34,
      Math.abs(score) *
        0.34
    );

  const bond =
    String(
      rel.bond ||
      rel.type ||
      ""
    ).toLowerCase();

  if (
    /crush|rival|ellens|enemy|dating|járnak|spouse|házastárs|ex/.test(
      bond
    )
  ) {
    interest += 24;
  }

  if (
    rel.mood ||
    rel.hidden
  ) {
    interest += 8;
  }

  if (
    ownStorySnippetAbout(
      actor,
      target
    )
  ) {
    interest += 22;
  }

  const af =
    factionFlags(actor);

  const tf =
    factionFlags(target);

  if (
    (af.pogue && tf.kook) ||
    (af.kook && tf.pogue) ||
    (af.hydra && tf.shield) ||
    (af.shield && tf.hydra) ||
    (af.cobraKai && tf.miyagiFang) ||
    (af.miyagiFang && tf.cobraKai) ||
    (af.ironDragons && (tf.cobraKai || tf.miyagiFang)) ||
    (tf.ironDragons && (af.cobraKai || af.miyagiFang))
  ) {
    /*
     * Franchise/faction rivals pay attention to each other socially too:
     * comments, subtweets, hate-likes and public reactions become more likely.
     */
    interest += 30;
  }

  if (
    characterIsFlirty(actor) &&
    bondLooksRomantic(rel)
  ) {
    interest += 12;
  }

  const obsessionLevel =
    relationshipObsessionLevel(
      w,
      actorId,
      targetId
    );

  if (obsessionLevel > 0) {
    interest +=
      obsessionLevel * 30;
  }

  return interest;
}

/*
 * FAIR + RELATIONSHIP-AWARE COMMENT ACTIVITY
 *
 * A fairness továbbra is számít, de a poszthoz
 * ténylegesen kötődő barátok, crushok, riválisok
 * és történeti ellenfelek nagyobb eséllyel reagálnak.
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
        interest:
          socialInteractionInterest(
            w,
            c.id,
            targetId
          ),
        tie: Math.random(),
      };
    });

  chars.sort((a, b) => {
    /*
     * Kapcsolati/történeti relevancia + fairness együtt.
     *
     * Egy rivális vagy crush ne maradjon le csak azért,
     * mert tegnap már kommentelt egyszer; ugyanakkor
     * ugyanaz a karakter se uralja folyamatosan a feedet.
     */
    const ap =
      a.recentComments * 18 -
      a.interest;

    const bp =
      b.recentComments * 18 -
      b.interest;

    if (ap !== bp) {
      return ap - bp;
    }

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
    .slice(0, 8);
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
  .map((c) => `${voiceCard(c)}${characterMemoryCard(w, c)}`)
  .join("")}

KOMMENTVÁLASZ-KARAKTERHŰSÉG:
- A válaszoló teljes karakterlapja és saját emlékezete aktív.
- A reply legyen felismerhetően az adott karakteré, ne generikus social reakció.
- A korábbi saját kommentjeinek/DM-jeinek/posztjainak fordulatait se használja újra.
- Ha a komment vagy a válasz ténylegesen közelebb hozza, felidegesíti, féltékennyé teszi, megsérti, megnevetteti vagy másképp érzelmileg megmozdítja a karaktert, ezt a "changes" tömbben IS jelezd. Ne csak a reply szövegében jelenjen meg.
- Kis social reakcióhoz kis változás illik (általában 1-6 pont); nagyobb változás csak erős, konkrét érzelmi okból legyen.
- Ha semmi érdemi nem változik, nem kötelező delta.

KÖZVETLEN KAPCSOLATI DINAMIKA A KOMMENT SZERZŐJÉHEZ:
${cast
  .map(
    (c) =>
      relationshipBehaviorCard(
        w,
        c.id,
        comment.authorId
      )
  )
  .filter(Boolean)
  .join("\n") || "-"}

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

    const rootComment =
      (p.comments || []).find(
        (x) =>
          x &&
          x.id === rootId
      );

    const replyTargetId =
      rootComment &&
      rootComment.authorId
        ? rootComment.authorId
        : p.authorId || "";

    rememberKnowledge(n, who, {
      kind: "conversation",
      source: "self_action",
      confidence: 1,
      text: sysLangText(n, who, `Válaszoltam: ${cut(made.text, 110)}`, `I replied: ${cut(made.text, 110)}`),
    });

    if (
      replyTargetId &&
      replyTargetId !== who
    ) {
      rememberAboutTarget(
        n,
        who,
        replyTargetId,
        {
          kind: "event",
          source: "comment_reply",
          confidence: 1,
          text:
            sysLangText(
              n,
              who,
              `${nameOfIn(n, replyTargetId)} kommentjére válaszoltam: ${cut(made.text, 100)}`,
              `I replied to ${nameOfIn(n, replyTargetId)}'s comment: ${cut(made.text, 100)}`
            ),
        }
      );
    }
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
  .map((c) => `${voiceCard(c)}${characterMemoryCard(w, c)}`)
  .join("")}

KARAKTERHŰ POSZTOLÁS:
- Minden kiválasztott karakter teljes saját kánonja és saját emlékezete aktív.
- A poszt témája, hossza, humora, agressziója, sebezhetősége, online stílusa és az is, hogy egyáltalán posztolna-e valamiről, a karakterlapjából következzen.
- Ne cserélhesd fel két karakter posztját úgy, hogy ugyanúgy működjön.
- A saját történetükben szereplő család, barátok, ellenségek, szervezetek, célok, traumák és rutinok természetesen jelenjenek meg a social életükben, amikor releváns.

${repetitionGuard(
  w,
  cast.map((c) => c.id),
  "autonóm posztok és kommentek"
)}

A VILÁG MAGÁTÓL ÉL TOVÁBB.

${
  single
    ? "Telt el egy kis idő. Adj EGY természetes új posztot valamelyik szereplőtől, és ha indokolt, 3-7 reakciót/kommentet másoktól."
    : "Léptesd a világot néhány órával. Adj 1-2 természetes új posztot különböző szereplőktől, és ha indokolt, posztonként 3-7 különböző reakciót/kommentet másoktól."
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

POSZT-TÍPUSOK VÁLTOZATOSSÁGA — KÖTELEZŐ:
- Nézd meg ugyanannak a karakternek a közelmúltbeli posztjait, és NE ismételd ugyanazt a témát/formátumot.
- Váltogasd természetesen a poszttípusokat: szelfi/outfit, hétköznapi pillanat, helyszín/scenery, buli vagy esemény, hobbi/munka/edzés, achievement, rant, vaguepost, poén/meme-szerű caption, kérdés, throwback, baráti/group pillanat, kapcsolati célzás, gyors life update, provokáció, belsős poén, hosszabb event recap.
- Ne legyen minden karakterből folyamatosan drámai vagueposter.
- Ne legyen minden kép szelfi, és ne legyen minden szöveges poszt panaszkodás.
- A karakter személyisége és SAJÁT TELJES TÖRTÉNETE döntse el, melyik típus illik hozzá.
- Ugyanaz a karakter két egymást követő posztban lehetőleg ne ugyanazt az archetipust használja.
- Néha legyen teljesen hétköznapi poszt is. Ettől élő a világ.
- Ha a karakter saját történetében konkrét hobbi, munka, dojo, szervezet, baráti kör, család, rivális vagy cél szerepel, abból természetesen szülessenek posztok is.

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

- Akinek van Fotóalbuma, néha képet is posztolhat belőle.
- Az albumlistában minden kép mellett ott lehet az AI által felismert látható tartalom is. Ezt KÖTELEZŐ figyelembe venni a megfelelő kép kiválasztásakor és a caption megírásakor.
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
    const authorChar = charById(n, author);
    const pic = p.image ? albumFind(authorChar, p.image) : null;
    const picRef = pic ? (pic.imageId ? imageRef(pic.imageId) : pic.src) : "";
    const picId = imageIdOf(picRef);
    const fresh = {
      id: uid(), authorId: author, ts: now(), likes: 0, likedBy: [],
      text: postText,
      imageId: picId || "",
      image: picId ? "" : picRef,
      imageDescription: pic ? String(pic.vision || pic.note || "").slice(0, 700) : "",
      comments: made,
      language: worldLanguage(n, n.meId),
    };

    /*
     * Fotóalbum = felhasználható AI-képkészlet.
     * Ha a karakter kiposztolta, kikerül az albumából,
     * de a media fájl természetesen megmarad a kész poszthoz.
     */
    if (pic && authorChar) {
      consumeAlbumItem(authorChar, pic);
    }
    n.posts.unshift(fresh);
    recordSocialEvent(
  n,
  {
    type: "post",

    refId: fresh.id,
    ts: fresh.ts,

    actorId: author,
    targetIds: mentionedIdsInText(n, fresh.text, author),

    visibility: "public",
    factLevel: "observed",

    importance:
      (fresh.imageId || fresh.image)
        ? 30
        : 24,

    drama: 0,
    romance: 0,
    embarrassment: 0,

    source: "ai",

    text:
      fresh.text ||
      "Image post",

    tags: [
      "social",
      "post",
      "ai-post",
      (fresh.imageId || fresh.image)
        ? "image-post"
        : "text-post",
    ],

    meta: {
      postId: fresh.id,

      hasImage:
        Boolean(
          fresh.imageId ||
          fresh.image
        ),
    },
  }
);
    /*
 * Azok a kommentek, amelyek már az
 * AI-poszttal együtt megszülettek,
 * külön Social Eventként is bekerülnek.
 */
made.forEach((mc) => {
  const targetComment =
    mc.parent
      ? made.find(
          (x) =>
            x.id === mc.parent
        )
      : null;

  const targetId =
    targetComment &&
    targetComment.authorId
      ? targetComment.authorId
      : fresh.authorId || "";

  recordSocialEvent(
    n,
    {
      type:
        mc.parent
          ? "reply"
          : "comment",

      refId: mc.id,
      ts: mc.ts,

      actorId:
        mc.authorId,

      targetIds:
        targetId &&
        targetId !== mc.authorId
          ? [targetId]
          : [],

      visibility: "public",
      factLevel: "observed",

      importance:
        mc.parent
          ? 28
          : 20,

      drama: 0,
      romance: 0,
      embarrassment: 0,

      source: "ai",

      text:
        mc.text || "",

      tags: [
        "social",
        "ai-comment",
        "generated-with-post",
        mc.parent
          ? "reply"
          : "comment",
      ],

      meta: {
        postId:
          fresh.id,

        commentId:
          mc.id,

        parentId:
          mc.parent || "",

        postAuthorId:
          fresh.authorId || "",

        targetId:
          targetId || "",
      },
    }
  );
});
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
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [musicBusy, setMusicBusy] = useState(false);
  const mine = noteOf(w, w.meId);
  const others = liveNotes(w).filter((x) => x.authorId !== w.meId);

  const beginEdit = (note = null) => {
    setDraft(note ? String(note.text || "") : "");
    setSongTitle(note && note.music ? String(note.music.title || "") : "");
    setSongArtist(note && note.music ? String(note.music.artist || "") : "");
    setEditing(true);
  };

  const saveMine = async () => {
    const t = String(draft || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, NOTE_MAX);

    const title = String(songTitle || "").trim().slice(0, 120);
    const artist = String(songArtist || "").trim().slice(0, 120);
    const hasMusic = Boolean(title || artist);

    if (!t && !hasMusic) {
      update((n) => setNote(n, w.meId, ""));
      setEditing(false);
      return;
    }

    const oldTitle = mine && mine.music ? String(mine.music.title || "") : "";
    const oldArtist = mine && mine.music ? String(mine.music.artist || "") : "";

    if (
      mine &&
      t === String(mine.text || "") &&
      title === oldTitle &&
      artist === oldArtist
    ) {
      setEditing(false);
      return;
    }

    let musicSummary =
      mine && mine.music && title === oldTitle && artist === oldArtist
        ? String(mine.music.summary || "")
        : "";

    if (hasMusic && !musicSummary) {
      setMusicBusy(true);

      try {
        const out = await askWorldJSONInteractive(
          w,
          engineFor(w),
          `A játékos Instagram Notes-szerű jegyzetéhez ezt a zenét választotta:\nCím: ${title || "nincs megadva"}\nElőadó: ${artist || "nincs megadva"}\n\nA feladatod NEM dalszöveg-idézés. Röviden írd le a dal közismert témáját, érzelmi hangulatát és azt, milyen üzenetet/vibe-ot közvetíthet valaki azzal, hogy ezt teszi ki Note-ba. Ha nem ismered biztosan a számot, ne találj ki konkrét dalszöveget vagy tényt; csak a cím/előadó alapján adj óvatos hangulati értelmezést.\n\nFormátum: {"summary":"1-3 rövid mondat"}${TAIL}`,
          { maxTokens: 350 }
        );

        musicSummary = String(out && out.summary || "").trim().slice(0, 700);
      } catch (e) {
        console.warn("Music note analysis failed:", e);
        musicSummary = "";
      } finally {
        setMusicBusy(false);
      }
    }

    const noteId = uid();

    update((n) =>
      setNote(
        n,
        w.meId,
        t,
        noteId,
        {
          music: hasMusic
            ? {
                title,
                artist,
                summary: musicSummary,
              }
            : null,
        }
      )
    );

    if (onSignal) {
      onSignal({
        type: "player-note",
        noteId,
      });
    }

    setEditing(false);
    setDraft("");
    setSongTitle("");
    setSongArtist("");
  };

  const askReactions = () => {
    if (!mine || !w.chars.length) return;
    const ok = onRequestNoteReactions ? onRequestNoteReactions(mine.id) : false;
    if (!ok) {
      setErr(
        tt(
          "A reakciókérést már feldolgozza a világ.",
          "A reaction request is already being processed."
        )
      );
    }
  };

  const bubble = (x) => {
    const a = charById(w, x.authorId);
    if (!a) return null;
    const isMine = x.authorId === w.meId;
    const hasMusic = x.music && (x.music.title || x.music.artist);

    return (
      <button
        key={x.id}
        className="note-item"
        onClick={() => {
          if (isMine) {
            beginEdit(x);
          } else {
            const payload = [
              x.text || "",
              hasMusic
                ? `🎵 ${x.music.title || ""}${x.music.artist ? ` — ${x.music.artist}` : ""}`
                : "",
            ].filter(Boolean).join(" · ");
            onOpenChat(x.authorId, payload);
          }
        }}
      >
        <div className="note-bub">
          {x.text ? <div>{x.text}</div> : null}
          {hasMusic ? (
            <div
              style={{
                marginTop: x.text ? 4 : 0,
                fontSize: 10.5,
                color: "var(--gold)",
              }}
            >
              🎵 {x.music.title || tt("zene", "music")}
              {x.music.artist ? ` — ${x.music.artist}` : ""}
            </div>
          ) : null}
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
      <label className="f" style={{ margin: 0 }}>
        {tt("Jegyzetek", "Notes")}
      </label>

      <div className="note-strip">
        {!mine && (
          <button className="note-item" onClick={() => beginEdit(null)}>
            <div className="note-bub note-empty">{tt("Írj valamit…", "Write something…")}</div>
            <Av src={w.player.avatar} name={w.player.name} size={44} radius={99} />
            <div className="note-nm">{tt("te", "you")}</div>
          </button>
        )}
        {mine ? bubble(mine) : null}
        {others.map(bubble)}
        {!others.length && !mine && (
          <span className="hint" style={{ alignSelf: "center" }}>
            {tt("Még senki nem írt ki semmit.", "No one has written anything yet.")}
          </span>
        )}
      </div>

      {editing && (
        <div style={{ marginTop: 10 }}>
          <input
            className="i"
            autoFocus
            value={draft}
            maxLength={NOTE_MAX}
            placeholder={tt("Egy gondolat, max pár szó…", "A thought, a few words max…")}
            onChange={(e) => setDraft(e.target.value)}
          />

          <div className="card" style={{ marginTop: 8, padding: 10, background: "var(--ink)" }}>
            <label className="f" style={{ marginTop: 0 }}>
              🎵 {tt("Zene a jegyzetben — opcionális", "Music in your note — optional")}
            </label>
            <div className="row" style={{ gap: 6 }}>
              <input
                className="i"
                value={songTitle}
                placeholder={tt("Dal címe", "Song title")}
                onChange={(e) => setSongTitle(e.target.value)}
              />
              <input
                className="i"
                value={songArtist}
                placeholder={tt("Előadó", "Artist")}
                onChange={(e) => setSongArtist(e.target.value)}
              />
            </div>
            <p className="hint" style={{ marginTop: 6 }}>
              {tt(
                "Nem játssza le a zenét. Az AI a dal témáját/hangulatát értelmezi, így a karakterek tudnak arra reagálni, mit üzensz vele. Dalszöveget nem kell bemásolnod.",
                "It does not play the song. The AI interprets the song's theme/mood so characters can react to what you're conveying with it. You don't need to paste lyrics."
              )}
            </p>
          </div>

          <div className="between" style={{ marginTop: 8 }}>
            <span className="hint">
              {draft.length}/{NOTE_MAX} · {tt("24 óra után lejár", "expires after 24 hours")}
            </span>
            <div className="row" style={{ gap: 6 }}>
              {mine && (
                <button
                  className="btn tiny ghost"
                  style={{ color: "var(--steel)" }}
                  onClick={() => {
                    update((n) => setNote(n, w.meId, ""));
                    setEditing(false);
                  }}
                >
                  {tt("Törlés", "Delete")}
                </button>
              )}
              <button className="btn tiny ghost" onClick={() => setEditing(false)}>
                {tt("Mégse", "Cancel")}
              </button>
              <button
                className="btn tiny primary"
                onClick={saveMine}
                disabled={musicBusy || (!draft.trim() && !songTitle.trim() && !songArtist.trim())}
              >
                {musicBusy ? <Loader2 size={12} className="spin" /> : null}
                {tt("Kiírom", "Post it")}
              </button>
            </div>
          </div>
        </div>
      )}

      {mine && w.chars.length > 0 ? (
        <button className="btn tiny ghost" style={{ marginTop: 8 }} onClick={askReactions}>
          <Sparkles size={12} /> {tt("Reakciók kérése", "Request reactions")}
        </button>
      ) : null}

      <p className="hint" style={{ marginTop: 8 }}>
        {tt(
          "Koppints valakinek a jegyzetére, és válaszolhatsz rá privátban.",
          "Tap someone's note, and you can reply to it privately."
        )}
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

function Feed({ w, update, setErr, jump, onOpenChat, onOpenWorlds, autoOn, onRequestWorldStep, onRequestNoteReactions, onSignal }) {
  const { tt } = useLang();
  const { media } = useMedia();
  const [text, setText] = useState("");
  const [img, setImg] = useState("");
  const [busy, setBusy] = useState("");
  const [resting, setResting] = useState(cooldownLeft() > 0);
  const [hl, setHl] = useState("");
  const [feedMode, setFeedMode] = useState("all");
  const [showMedia, setShowMedia] = useState(false);
  const [profileId, setProfileId] = useState("");

  const activeMedia =
    activeGossipMediaAccount(
      w
    );

  const activeTrends =
    (w.trends || []).slice(0, 8);

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

  const post = async () => {
    const t = text.trim();

    if ((!t && !img) || busy === "posting") return;

    setBusy("posting");

    const imageId = imageIdOf(img);
    let imageDescription = "";

    if (img) {
      try {
        const data = resolveImg(img, media);

        if (data && String(data).startsWith("data:image/")) {
          imageDescription = await analyzeImageDataUrl(
            data,
            tt(
              "Írd le 1-3 rövid mondatban, mi látható ezen a social media képen. Csak látható részleteket említs: személyek száma, tevékenység, ruha, helyszín, hangulat. Ne azonosíts valódi személyt név szerint.",
              "In 1-3 concise sentences describe what is visibly shown in this social media image. Mention only visible details: number of people, activity, clothing, setting and mood. Do not identify real people by name."
            )
          );
        }
      } catch (e) {
        console.warn("Player post image analysis failed:", e);
      }
    }

    const p = {
      id: uid(),
      authorId: w.meId,
      ts: now(),
      likes: 0,
      likedBy: [],
      text: t,
      imageId: imageId || "",
      image: imageId ? "" : (img || ""),
      imageDescription,
      comments: [],
      language: worldLanguage(w, w.meId),
    };

    update((n) => {
      n.posts.unshift(p);

      const mentions = noteMentions(
        n,
        t,
        w.meId,
        { type: "post", id: p.id }
      ) || [];

      recordSocialEvent(n, {
        type: "post",
        refId: p.id,
        ts: p.ts,
        actorId: w.meId,
        targetIds: mentions,
        visibility: "public",
        factLevel: "observed",
        importance: img ? 30 : 24,
        drama: 0,
        romance: 0,
        embarrassment: 0,
        source: "player",
        text: t || "Image post",
        tags: [
          "post",
          "player-post",
          img ? "image-post" : "text-post",
          ...(mentions.length ? ["mentions"] : []),
        ],
        meta: {
          postId: p.id,
          hasImage: Boolean(img),
          imageDescription,
          mentionedIds: mentions,
        },
      });
    });

    if (onSignal) {
      onSignal({
        type: "player-post",
        postId: p.id,
      });
    }

    setText("");
    setImg("");
    setBusy("");
  };

  const advance = () => {
    if (!w.chars.length) return setErr(tt("Előbb hozz létre karaktereket.", "First create some characters."));
    const ok = onRequestWorldStep ? onRequestWorldStep() : false;
    if (!ok) setErr(tt("A világ már feldolgoz egy lépéskérést.", "The world is already processing a step request."));
  };

  const basePosts =
    feedMode === "following"
      ? (w.posts || []).filter(
          (p) =>
            p &&
            (
              p.authorId === w.meId ||
              isFollowing(
                w,
                w.meId,
                p.authorId
              )
            )
        )
      : (w.posts || []);

  const baseItems =
    basePosts.map(
      (post) => ({
        kind: "post",
        id: "post:" + post.id,
        ts:
          Number(post.ts) || 0,
        post,
        repost: null,
      })
    );

  const repostItems =
    repostRows(w)
      .map((repost) => {
        const post =
          (w.posts || []).find(
            (p) =>
              p &&
              p.id ===
                repost.postId
          );

        const reposter =
          socialProfileById(
            w,
            repost.actorId
          );

        if (
          !post ||
          !reposter
        ) {
          return null;
        }

        if (
          feedMode ===
            "following" &&
          reposter.id !==
            w.meId &&
          !isFollowing(
            w,
            w.meId,
            reposter.id
          )
        ) {
          return null;
        }

        return {
          kind: "repost",
          id:
            "repost:" +
            repost.id,
          ts:
            Number(
              repost.ts
            ) || 0,
          post,
          repost,
        };
      })
      .filter(Boolean);

  const timelineItems =
    baseItems
      .concat(repostItems)
      .sort(
        (a, b) =>
          b.ts - a.ts
      );

  return (
    <>
      <div className="social-feed-head">
        <div className="social-feed-title">
          <div>
            <div className="name" style={{ fontSize: 16 }}>
              {tt("Hírfolyam", "Feed")}
            </div>
            <div className="handle mono">@{w.player.username}</div>
          </div>

          {autoOn ? (
            <span className="chip">
              <span
                className="dot"
                style={{ display: "inline-block", marginRight: 5 }}
              />
              {tt("élő", "live")}
            </span>
          ) : null}
        </div>

        <div className="social-feed-tabs">
          <button
            className={
              "social-feed-tab" +
              (feedMode === "all" ? " on" : "")
            }
            onClick={() => setFeedMode("all")}
          >
            {tt("Neked", "For you")}
          </button>

          <button
            className={
              "social-feed-tab" +
              (feedMode === "following" ? " on" : "")
            }
            onClick={() => setFeedMode("following")}
          >
            {tt("Követések", "Following")}
          </button>
        </div>
      </div>

      <NotesStrip
        w={w}
        update={update}
        setErr={setErr}
        onOpenChat={onOpenChat}
        jump={jump}
        onRequestNoteReactions={onRequestNoteReactions}
        onSignal={onSignal}
      />

      {activeMedia ? (
        <div className="social-media-account-bar">
          <button
            type="button"
            className="social-author-click"
            onClick={() =>
              setProfileId(
                activeMedia.id
              )
            }
          >
            <Av
              src={activeMedia.avatar}
              name={activeMedia.name}
              size={36}
              radius={11}
            />
          </button>

          <div className="social-media-account-main">
            <button
              type="button"
              className="social-author-click"
              onClick={() =>
                setProfileId(
                  activeMedia.id
                )
              }
            >
              <div className="name">
                {activeMedia.name}
              </div>

              <div className="handle mono">
                @{activeMedia.username} ·{" "}
                {formatSocialCount(
                  displayFollowerCount(
                    w,
                    activeMedia.id
                  )
                )}{" "}
                {tt(
                  "követő",
                  "followers"
                )}
              </div>
            </button>

            <div className="social-media-account-tag">
              <Globe2 size={11} />
              {activeMedia.mediaKind === "local"
                ? tt(
                    "helyi pletykaoldal",
                    "local gossip page"
                  )
                : tt(
                    "világszintű pletykaoldal",
                    "global gossip page"
                  )}
            </div>
          </div>

          <div className="social-media-account-actions">
            <button
              className={
                isFollowing(
                  w,
                  w.meId,
                  activeMedia.id
                )
                  ? "btn tiny ghost social-following"
                  : "btn tiny ghost"
              }
              onClick={() =>
                update((n) => {
                  setFollowState(
                    n,
                    n.meId ||
                      w.meId,
                    activeMedia.id,
                    !isFollowing(
                      n,
                      n.meId ||
                        w.meId,
                      activeMedia.id
                    ),
                    "player"
                  );
                })
              }
            >
              {isFollowing(
                w,
                w.meId,
                activeMedia.id
              )
                ? tt(
                    "Követed",
                    "Following"
                  )
                : tt(
                    "Követés",
                    "Follow"
                  )}
            </button>

            <button
              className="btn tiny ghost"
              onClick={() =>
                setProfileId(
                  activeMedia.id
                )
              }
            >
              {tt(
                "Profil",
                "Profile"
              )}
            </button>
          </div>
        </div>
      ) : null}

      {activeTrends.length ? (
        <div className="social-trends">
          <div className="social-trends-head">
            <Zap size={11} />
            {tt("Most felkapott", "Trending now")}
          </div>
          <div className="social-trend-list">
            {activeTrends.map((trend) => (
              <button
                key={trend.id}
                type="button"
                className="social-trend"
                onClick={() => {
                  if (trend.subjectId && charById(w, trend.subjectId)) {
                    setProfileId(trend.subjectId);
                    return;
                  }
                  if (trend.postId) {
                    setHl(trend.postId);
                    setTimeout(() => {
                      const el = refs.current[trend.postId];
                      if (el && el.scrollIntoView) el.scrollIntoView({ behavior:"smooth", block:"center" });
                    }, 30);
                  }
                }}
              >
                {worldLanguage(w, w.meId) === "en"
                  ? (trend.labelEn || trend.labelHu)
                  : (trend.labelHu || trend.labelEn)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="social-composer">
        <div className="social-composer-main">
          <button
            type="button"
            className="social-author-click"
            onClick={() => setProfileId(w.meId)}
            title={tt("Saját profil megnyitása", "Open your profile")}
          >
            <Av
              src={w.player.avatar}
              name={w.player.name}
              size={38}
              radius={12}
            />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              className="i"
              value={text}
              placeholder={tt(
                `Mi jár ${w.player.name} fejében?`,
                `What's on ${w.player.name}'s mind?`
              )}
              onChange={(e) => setText(e.target.value)}
            />
            <MentionBar w={w} value={text} onChange={setText} />
          </div>
        </div>

        {(showMedia || img) ? (
          <div className="social-media-panel">
            <ImagePicker
              value={img}
              onChange={setImg}
              label={tt("Kép", "Image")}
              max={900}
              preview={64}
              category="post"
            />
          </div>
        ) : null}

        <div className="social-composer-actions">
          <button
            className="btn tiny ghost"
            onClick={() => setShowMedia(!showMedia)}
          >
            <ImageIcon size={14} />
            {img
              ? tt("Kép hozzáadva", "Image added")
              : tt("Kép", "Image")}
          </button>

          <button
            className="btn primary"
            onClick={async () => {
              await post();
              setShowMedia(false);
            }}
            disabled={busy === "posting" || (!text.trim() && !img)}
          >
            <Send size={14} />
            {tt("Közzététel", "Post")}
          </button>
        </div>
      </div>

      {timelineItems.length === 0 ? (
        <div className="social-empty">
          {feedMode === "following"
            ? tt(
                "Még nincs poszt azoktól, akiket követsz.",
                "There are no posts from people you follow yet."
              )
            : tt(
                "Üres a hírfolyam. Írj egy posztot, vagy várj — a világ magától is elindul.",
                "The feed is empty. Write a post, or wait — the world will get going on its own."
              )}
        </div>
      ) : null}

      {timelineItems.map((item) => {
        const p = item.post;

        const reposter =
          item.repost
            ? socialProfileById(
                w,
                item.repost.actorId
              )
            : null;

        return (
          <div
            className={
              item.repost
                ? "social-repost-wrap"
                : ""
            }
            key={item.id}
          >
            {reposter ? (
              <div className="social-repost-note">
                <RefreshCcw size={13} />

                <button
                  type="button"
                  onClick={() =>
                    setProfileId(
                      reposter.id
                    )
                  }
                >
                  {tt(
                    `${reposter.name} újraosztotta`,
                    `${reposter.name} reposted`
                  )}
                </button>
              </div>
            ) : null}

            <Post
          w={w}
          post={p}
          highlight={hl === p.id}
          nodeRef={(el) => {
            refs.current[p.id] = el;
          }}
          onOpenProfile={(id) => setProfileId(id)}
          onToggleFollow={(id) =>
            update((n) => {
              setFollowState(
                n,
                n.meId || w.meId,
                id,
                !isFollowing(n, n.meId || w.meId, id),
                "player"
              );
            })
          }
          onComment={(id, text2, parent) =>
            update((n) => {
              const x = n.posts.find((y) => y.id === id);
              if (!x) return;

              const actorId = n.meId || w.meId;

              if (!Array.isArray(x.comments)) {
                x.comments = [];
              }

              const parentComment = parent
                ? x.comments.find((c) => c.id === parent)
                : null;

              const targetId =
                parentComment && parentComment.authorId
                  ? parentComment.authorId
                  : x.authorId;

              const made = {
                id: uid(),
                authorId: actorId,
                text: text2,
                ts: now(),
                parent: parent || null,
              };

              x.comments.push(made);
              noteComment(n, x, made);

              const mentionTargets = mentionedIdsInText(
                n,
                made.text,
                actorId
              );

              const eventTargets = [
                ...(targetId && targetId !== actorId ? [targetId] : []),
                ...mentionTargets,
              ].filter((id, index, arr) => id && id !== actorId && arr.indexOf(id) === index);

              recordSocialEvent(n, {
                type: parent ? "reply" : "comment",
                refId: made.id,
                ts: made.ts,
                actorId,
                targetIds: eventTargets,
                visibility: "public",
                factLevel: "observed",
                importance: parent ? 30 : 22,
                drama: 0,
                romance: 0,
                embarrassment: 0,
                source: "player",
                text: made.text,
                tags: [
                  "social",
                  "player-comment",
                  parent ? "reply" : "comment",
                ],
                meta: {
                  postId: x.id,
                  commentId: made.id,
                  parentId: made.parent || "",
                  postAuthorId: x.authorId || "",
                  targetId: targetId || "",
                },
              });

              /*
               * A komment / kommentválasz ne csak Social Event legyen:
               * közvetlen AI-célpontnál a kapcsolat is reagálhat rá,
               * és applyChanges azonnal megmutatja az értesítésben.
               */
              applyPlayerSocialRelationshipSignal(
                n,
                actorId,
                targetId,
                made.text,
                parent
                  ? "reply"
                  : "comment"
              );
            })
          }
          onRepost={(id) =>
            update((n) => {
              createRepost(
                n,
                n.meId ||
                  w.meId,
                id,
                "player"
              );
            })
          }
          onLike={(id) =>
            update((n) => {
              const x = n.posts.find((y) => y.id === id);
              if (!x) return;

              const actorId = n.meId || w.meId;
              if (!actorId) return;

              if (!Array.isArray(x.likedBy)) {
                x.likedBy = [];
              }

              if (x.likedBy.includes(actorId)) {
                return;
              }

              x.likedBy.push(actorId);

              x.likes = Math.max(
                Number(x.likes) || 0,
                x.likedBy.length
              );

              recordSocialEvent(n, {
                type: "like",
                refId: `${x.id}:${actorId}`,
                ts: now(),
                actorId,
                targetIds:
                  x.authorId && x.authorId !== actorId
                    ? [x.authorId]
                    : [],
                visibility: "public",
                factLevel: "observed",
                importance: 8,
                drama: 0,
                romance: 0,
                embarrassment: 0,
                source: "player",
                text: "Liked a post.",
                tags: [
                  "social",
                  "like",
                  "player-like",
                ],
                meta: {
                  postId: x.id,
                  postAuthorId: x.authorId || "",
                },
              });
            })
          }
        />
          </div>
        );
      })}
      {profileId && charById(w, profileId) ? (
        <SocialProfileModal
          w={w}
          c={charById(w, profileId)}
          update={update}
          onClose={() => setProfileId("")}
          onOpenProfile={(id) => setProfileId(id)}
          onChat={(id) => {
            setProfileId("");
            onOpenChat(id);
          }}
          onWorlds={
            profileId === w.meId
              ? onOpenWorlds
              : null
          }
        />
      ) : null}
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
  const { tt, lang } = useLang();
  const safeLang = asLang(lang);
  const locale = safeLang === "en" ? "en" : "hu";
  const len = React.useMemo(() => cleanLen(value), [value]);

  if (NO_LIMIT_UI[field]) return null;

  if (isFree(field) && !CORE_CAP[field]) {
    return (
      <p className="hint" style={{ marginTop: 4, color: "var(--muted)" }}>
        {len
          ? tt(
              `${len.toLocaleString("hu")} karakter · teljes egészében átmegy`,
              `${len.toLocaleString("en")} characters · passed through in full`
            )
          : tt(
              "teljes egészében átmegy",
              "passed through in full"
            )}
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
        <div
          className="bar-fill"
          style={{
            left: 0,
            width: pct + "%",
            background: over ? "var(--gold)" : "var(--steel)",
          }}
        />
      </div>

      <p
        className="hint"
        style={{
          marginTop: 4,
          color: over ? "var(--gold)" : "var(--muted)",
        }}
      >
        {len.toLocaleString(locale)} / {cap.toLocaleString(locale)}{" "}
        {tt("karakter", "characters")}
        {over
          ? tt(
              ` — ${(len - cap).toLocaleString("hu")} nem fér be minden hívásba`,
              ` — ${(len - cap).toLocaleString("en")} may be left out of some calls`
            )
          : ""}
      </p>
    </>
  );
});

function BudgetMeter({ c, onBrief, setErr }) {
  const { tt, lang } = useLang();
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
              <span className="handle mono">
                {r.raw.toLocaleString(asLang(lang) === "en" ? "en" : "hu")} ✓
              </span>
            </div>
          ))}

          <label className="f">{tt("Szűk keret — ezekhez elég pár mondat", "Narrow cap — a few sentences are enough here")}</label>
          {tight.map((r) => (
            <div className="between" key={r.k} style={{ marginTop: 5 }}>
              <span style={{ fontSize: 12.5, color: r.over ? "var(--gold)" : "var(--bone)" }}>{tt(r.label, FIELD_LABELS_EN[r.k] || r.label)}</span>
              <span className="handle mono">
                {r.raw.toLocaleString(asLang(lang) === "en" ? "en" : "hu")} / {r.cap.toLocaleString(asLang(lang) === "en" ? "en" : "hu")}
                {r.over ? tt(` · ${r.over.toLocaleString("hu")} kimarad`, ` · ${r.over.toLocaleString("en")} left out`) : " ✓"}
              </span>
            </div>
          ))}

          <p className="hint" style={{ marginTop: 10 }}>
            {tt(
              "A túlcsorduló mezőkből az elejét, a közepét és a végét is elviszi, tehát az egész terjedelemből kap ízelítőt — de a legfontosabbat érdemes a mező elejére tenni.",
              "For overflowing fields, the AI receives the beginning, middle and end, so it still gets a sample from the whole text — but the most important information is best placed near the start."
            )}
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
${worldLanguage(w, w && w.meId) === "en"
  ? "All user-visible generated profile fields must be in English."
  : "Minden generált, felhasználónak látható profilmező magyar legyen."}
Formátum (minden mező szöveg; a titkok legyenek érdekesek és kijátszhatók):
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
    <div className="scrim char-edit-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet char-edit-sheet">
        <div className="between char-edit-header">
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

        <ImagePicker
          value={c.avatar}
          onChange={(v) => set("avatar", v)}
          label={tt("Profilkép", "Profile picture")}
          max={512}
          preview={80}
          category="profile"
        />

        <ImagePicker
          value={c.cover || ""}
          onChange={(v) => set("cover", v)}
          label={tt("Borítókép", "Cover photo")}
          max={1400}
          previewWidth={180}
          previewHeight={90}
          category="cover"
        />

        <AlbumEditor value={c.album} onChange={(v) => set("album", v)} owner={c} />

        <div className="social-edit-box">
          <label className="f" style={{ marginTop: 0 }}>
            {tt(
              "Alap követőszám",
              "Base follower count"
            )}
          </label>

          <input
            className="i mono"
            type="number"
            min="0"
            step="1"
            value={
              Number(c.baseFollowers) || 0
            }
            onChange={(e) =>
              set(
                "baseFollowers",
                Math.max(
                  0,
                  Math.round(
                    Number(e.target.value) || 0
                  )
                )
              )
            }
          />

          <p className="hint" style={{ marginTop: 6 }}>
            {tt(
              "Ez a háttérközönség: olyan követők, akik léteznek a világban, de nem külön AI-karakterek. A valódi játékbeli karakterek követése ezen felül számít hozzá.",
              "This is the background audience: followers who exist in the world but are not separate AI characters. Follows from actual in-game characters are added on top."
            )}
          </p>
        </div>

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
                {localizedZodiac(
                  zodiac(c.birth),
                  worldLanguage(w, w && w.meId)
                )}
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

            <div className="row char-edit-add-person" style={{ gap: 8, marginTop: 8, alignItems: "flex-start" }}>
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
                <div key={o.id} className="char-edit-rel-card" style={{ marginTop: 12 }}>
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
  const { media } = useMedia();
  const detailSheetRef = useRef(null);

  useEffect(() => {
    const el = detailSheetRef.current;
    if (!el) return;

    try {
      el.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (e) {
      el.scrollTop = 0;
    }
  }, [c && c.id]);

  const coverUrl =
    resolveImg(
      c && c.cover,
      media
    );

  const rel =
    getRel(
      w,
      c.id,
      w.meId
    );

  const others =
    relevantOthers(
      w,
      c.id
    ).filter(
      (x) =>
        x.id !== w.meId
    );

  const following =
    isFollowing(
      w,
      w.meId,
      c.id
    );

  const posts =
    (w.posts || []).filter(
      (p) =>
        p &&
        p.authorId === c.id
    );

  const followerCount =
    displayFollowerCount(
      w,
      c.id
    );

  const followingCount =
    displayFollowingCount(
      w,
      c.id
    );

  const toggleFollow = () => {
    update((n) => {
      setFollowState(
        n,
        n.meId || w.meId,
        c.id,
        !isFollowing(
          n,
          n.meId || w.meId,
          c.id
        ),
        "player"
      );
    });
  };

  return (
    <div
      className="scrim character-detail-scrim"
      onClick={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={detailSheetRef}
        className="sheet character-detail-sheet"
      >
        <div className="between character-detail-header">
          <button
            className="btn tiny ghost"
            onClick={onClose}
          >
            <ChevronLeft size={14} />
            {tt("Vissza", "Back")}
          </button>

          <button
            className="btn tiny ghost"
            onClick={() =>
              onEdit(c)
            }
          >
            <Pencil size={13} />
            {tt(
              "Szerkesztés",
              "Edit"
            )}
          </button>
        </div>

        <button
          className="btn primary character-detail-mobile-edit"
          onClick={() => onEdit(c)}
          aria-label={tt("Karakter szerkesztése", "Edit character")}
        >
          <Pencil size={16} />
          {tt("Szerkesztés", "Edit")}
        </button>

        <div
          className="card social-profile"
          style={{
            marginTop: 12,
          }}
        >
          <div
            className="social-cover"
            style={{
              background:
                `radial-gradient(circle at 18% 15%, hsla(${hue(c.username || c.name)}, 70%, 65%, .42), transparent 35%), linear-gradient(135deg, hsl(${hue(c.name)} 32% 19%), hsl(${(hue(c.name) + 55) % 360} 38% 10%))`,
            }}
          >
            {coverUrl ? (
              <img
                className="social-cover-img"
                src={coverUrl}
                alt=""
              />
            ) : null}
          </div>

          <div className="social-profile-main">
            <div className="social-profile-top">
              <div className="social-profile-avatar">
                <Av
                  src={c.avatar}
                  name={c.name}
                  size={76}
                  radius={18}
                />
              </div>

              <div className="social-profile-actions">
                <button
                  className={
                    following
                      ? "btn tiny ghost social-following"
                      : "btn tiny primary"
                  }
                  onClick={
                    toggleFollow
                  }
                >
                  {following ? (
                    <>
                      <Check size={13} />
                      {tt(
                        "Követed",
                        "Following"
                      )}
                    </>
                  ) : (
                    <>
                      <Plus size={13} />
                      {tt(
                        "Követés",
                        "Follow"
                      )}
                    </>
                  )}
                </button>

                <button
                  className="btn tiny ghost"
                  onClick={() =>
                    onChat(c.id)
                  }
                >
                  <MessageCircle
                    size={13}
                  />
                  {tt(
                    "Üzenet",
                    "Message"
                  )}
                </button>
              </div>
            </div>

            <div className="social-profile-name">
              <h2
                style={{
                  fontSize: 22,
                }}
              >
                {c.name}
              </h2>

              <div className="handle mono">
                @{c.username}
              </div>
            </div>

            {c.bio ? (
              <div
                style={{
                  fontSize: 13.5,
                  marginTop: 8,
                  whiteSpace:
                    "pre-wrap",
                }}
              >
                {c.bio}
              </div>
            ) : null}

            <div className="social-profile-meta">
              {c.job ? (
                <span>{c.job}</span>
              ) : null}

              {c.city ? (
                <span>· {c.city}</span>
              ) : null}

              {ageOf(c, w) ? (
                <span>
                  · {ageOf(c, w)}{" "}
                  {termText(
                    "yearsOld",
                    worldLanguage(w)
                  )}
                </span>
              ) : null}

              {zodiac(c.birth) ? (
                <span>
                  · {localizedZodiac(
                    zodiac(c.birth),
                    worldLanguage(w, w && w.meId)
                  )}
                </span>
              ) : null}
            </div>

            <div className="social-profile-stats">
              <div className="social-profile-stat">
                <strong>
                  {formatSocialCount(
                    posts.length
                  )}
                </strong>
                <span>
                  {tt(
                    "Poszt",
                    "Posts"
                  )}
                </span>
              </div>

              <div className="social-profile-stat">
                <strong>
                  {formatSocialCount(
                    followerCount
                  )}
                </strong>
                <span>
                  {tt(
                    "Követő",
                    "Followers"
                  )}
                </span>
              </div>

              <div className="social-profile-stat">
                <strong>
                  {formatSocialCount(
                    followingCount
                  )}
                </strong>
                <span>
                  {tt(
                    "Követés",
                    "Following"
                  )}
                </span>
              </div>
            </div>

            {Number(c.baseFollowers) > 0 ? (
              <div
                className="social-count"
                style={{
                  marginTop: 8,
                }}
              >
                {tt(
                  `${formatSocialCount(c.baseFollowers)} háttérkövető + ${knownFollowerCount(w, c.id)} ismert karakter`,
                  `${formatSocialCount(c.baseFollowers)} background followers + ${knownFollowerCount(w, c.id)} known characters`
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="card"
          style={{
            background:
              "var(--raised)",
            borderColor:
              "var(--rose)",
          }}
        >
          <label
            className="f"
            style={{
              marginTop: 0,
              color:
                "var(--rose)",
            }}
          >
            {tt(
              "Ti ketten",
              "The two of you"
            )}
          </label>

          <RelPair
            w={w}
            aId={c.id}
            bId={w.meId}
            aName={
              c.name.split(" ")[0]
            }
            bName={tt(
              "te",
              "you"
            )}
            update={update}
          />
        </div>

        {albumOf(c).length >
        0 ? (
          <AlbumView
            items={albumOf(c)}
          />
        ) : null}

        {FIELDS
          .filter(
            ([k]) =>
              c[k] &&
              String(c[k]).trim() &&
              ![
                "name",
                "username",
                "avatar",
                "bio",
              ].includes(k)
          )
          .map(([k, label]) => (
            <div key={k}>
              <label className="f">
                {tt(
                  label,
                  FIELD_LABELS_EN[k] ||
                    label
                )}
              </label>

              <div
                style={{
                  fontSize: 14,
                  whiteSpace:
                    "pre-wrap",
                }}
              >
                {c[k]}
              </div>
            </div>
          ))}

        <div className="sep" />

        <label
          className="f"
          style={{
            marginTop: 0,
          }}
        >
          {tt(
            "Kapcsolatai a többiekkel",
            "Bonds with others"
          )}
        </label>

        <p className="hint">
          {tt(
            "Mindkét irány külön állítható. Új személyt a Szerkesztés gombbal vagy a Kapcsolat fülön vehetsz fel.",
            "Both directions are set separately. Add a new person via the Edit button or the Bonds tab."
          )}
        </p>

        {others.length === 0 ? (
          <p className="hint">
            {tt(
              "Még nincs kivel.",
              "There's no one yet."
            )}
          </p>
        ) : null}

        {others.map((o) => (
          <div
            className="card"
            key={o.id}
            style={{
              background:
                "var(--ink)",
            }}
          >
            <div
              className="row"
              style={{
                alignItems:
                  "center",
                minWidth: 0,
                marginBottom: 8,
              }}
            >
              <Av
                src={o.avatar}
                name={o.name}
                size={28}
                radius={9}
              />

              <div
                style={{
                  minWidth: 0,
                }}
              >
                <div
                  className="name"
                  style={{
                    fontSize:
                      13.5,
                  }}
                >
                  {o.name}
                </div>

                <div className="handle mono">
                  {kindOf(
                    w,
                    o.id
                  )}
                </div>
              </div>
            </div>

            <RelPair
              w={w}
              aId={c.id}
              bId={o.id}
              aName={
                c.name.split(
                  " "
                )[0]
              }
              bName={
                o.name.split(
                  " "
                )[0]
              }
              update={update}
            />
          </div>
        ))}

        {(w.mems[c.id] || [])
          .length > 0 ? (
          <>
            <div className="sep" />

            <label
              className="f"
              style={{
                marginTop: 0,
              }}
            >
              {tt(
                "Amire emlékszik",
                "What they remember"
              )}
            </label>

            {(w.mems[c.id] || []).map(
              (m, i) => (
                <div
                  key={i}
                  className="hint"
                  style={{
                    marginTop: 6,
                  }}
                >
                  · {m}
                </div>
              )
            )}
          </>
        ) : null}
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
              <div className="handle mono">
                @{w.player.username} · {formatSocialCount(displayFollowerCount(w, w.meId))} {tt("követő", "followers")} · {formatSocialCount(displayFollowingCount(w, w.meId))} {tt("követés", "following")}
              </div>
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
          <div
            className="card character-list-card"
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => setOpen(c.id)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" ||
                e.key === " "
              ) {
                e.preventDefault();
                setOpen(c.id);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="row">
              <Av src={c.avatar} name={c.name} />
              <div className="character-list-main" style={{ flex: 1, minWidth: 0 }}>
                <div className="between">
                  <div className="name">{c.name}</div>
                  <span className="relnum mono" style={{ color: relColor(r.score) }}>{r.score > 0 ? "+" : ""}{r.score} · {relLabel(r)}</span>
                </div>
                <div className="handle mono">
                  @{c.username} · {formatSocialCount(displayFollowerCount(w, c.id))} {tt("követő", "followers")}
                  {isFollowing(w, c.id, w.meId)
                    ? ` · ${tt("követ téged", "follows you")}`
                    : ""}
                </div>
              </div>

              <button
                className={
                  (
                    isFollowing(w, w.meId, c.id)
                      ? "btn tiny ghost social-following "
                      : "btn tiny ghost "
                  ) + "character-list-follow"
                }
                onClick={(e) => {
                  e.stopPropagation();

                  update((n) => {
                    setFollowState(
                      n,
                      n.meId || w.meId,
                      c.id,
                      !isFollowing(
                        n,
                        n.meId || w.meId,
                        c.id
                      ),
                      "player"
                    );
                  });
                }}
              >
                {isFollowing(w, w.meId, c.id)
                  ? tt("Követed", "Following")
                  : tt("Követés", "Follow")}
              </button>
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
              const stamped = {
                ...c,
                username: uniqueHandle(
                  n,
                  c.username,
                  c.id
                ),
                updatedAt: now()
              };

              const i =
                n.chars.findIndex(
                  (x) =>
                    x.id === stamped.id
                );

              const reallyNew =
                i < 0;

              if (i >= 0) {
                n.chars[i] = stamped;
              } else {
                n.chars.push(stamped);
              }

              commitForm(
                n,
                stamped.id,
                relDrafts,
                newPeople
              );

              /*
               * Minden valóban újonnan behozott AI karakter
               * azonnal bekerül a Trending rendszerbe.
               *
               * Szerkesztésnél NEM kap új arrival eventet.
               */
              if (reallyNew) {
                const arrivalAt =
                  now();

                stamped.createdAt =
                  Number(
                    stamped.createdAt
                  ) ||
                  arrivalAt;

                stamped.arrivalTrendAt =
                  arrivalAt;

                recordSocialEvent(
                  n,
                  {
                    type:
                      "character-arrival",

                    refId:
                      `arrival:${stamped.id}`,

                    ts:
                      arrivalAt,

                    actorId:
                      stamped.id,

                    targetIds: [
                      stamped.id,
                    ],

                    visibility:
                      "public",

                    factLevel:
                      "observed",

                    importance:
                      100,

                    drama:
                      8,

                    romance:
                      0,

                    embarrassment:
                      0,

                    source:
                      "character-create",

                    text:
                      worldLanguage(
                        n,
                        n.meId
                      ) === "en"
                        ? `${stamped.name} just entered the world.`
                        : `${stamped.name} megérkezett a világba.`,

                    tags: [
                      "social",
                      "new-character",
                      "trending",
                      "arrival",
                    ],

                    meta: {
                      characterId:
                        stamped.id,

                      newCharacter:
                        true,
                    },
                  }
                );

                refreshTrends(n);
              }
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
function detectSceneEventKind(scene) {
  const hay = `${scene && scene.title ? scene.title : ""} ${scene && scene.setting ? scene.setting : ""}`.toLowerCase();
  const partyWords = ["party","buli","afterparty","after party","house party","házibuli","rave","club","nightclub","klub","ball","bál","prom","szalagavató","birthday","születésnap","festival","fesztivál","concert","koncert","gala","gála","reception","fogadás","wedding","esküvő","banquet","bankett","bonfire","tábortűz"];
  if (partyWords.some((word) => hay.includes(word))) return "party";
  const eventWords = ["event","esemény","premiere","premier","opening","megnyitó","ceremony","ceremónia","dinner","vacsora","meeting","találkozó","reunion","összejövetel","competition","verseny","tournament","torna","game","meccs","match","show","bemutató"];
  if (eventWords.some((word) => hay.includes(word))) return "event";
  return "scene";
}

function roleplayEventSocialSignals(value) {
  const text =
    String(value || "")
      .toLowerCase();

  const tags = [];
  let romance = 0;
  let drama = 0;
  let embarrassment = 0;
  let importance = 0;

  const hasKiss =
    /\bkiss(?:ed|ing|es)?\b|csók|megcsókol|csókolóz/.test(
      text
    );

  const hasHookup =
    /\bhook[\s-]?up\b|\bhooked up\b|\bmake(?:s|ing)? out\b|\bmade out\b|\bslept with\b|kavar|kavart|összejött|összejöttek/.test(
      text
    );

  const hasFlirt =
    /\bflirt(?:ed|ing|s)?\b|flört|ráhajt|hajtott rá|chemistry|vonzalom/.test(
      text
    );

  const hasCheating =
    /\bcheat(?:ed|ing|s)?\b|megcsal|félrelép|affair|viszony/.test(
      text
    );

  if (hasKiss) {
    tags.push("romance", "kiss");
    romance = Math.max(romance, 76);
    drama = Math.max(drama, 32);
    importance = Math.max(importance, 66);
  }

  if (hasHookup) {
    tags.push("romance", "hookup");
    romance = Math.max(romance, 72);
    drama = Math.max(drama, 38);
    importance = Math.max(importance, 68);
  }

  if (hasFlirt) {
    tags.push("romance", "flirt");
    romance = Math.max(romance, 46);
    importance = Math.max(importance, 48);
  }

  if (hasCheating) {
    tags.push("romance", "cheating", "betrayal", "scandal");
    romance = Math.max(romance, 64);
    drama = Math.max(drama, 78);
    embarrassment = Math.max(embarrassment, 52);
    importance = Math.max(importance, 82);
  }

  return {
    romance,
    drama,
    embarrassment,
    importance,
    tags: [...new Set(tags)],
  };
}

function sceneEventRecapEligible(scene, aiWitnessCount) {
  const kind = (scene && scene.eventKind) || detectSceneEventKind(scene);
  return Number(aiWitnessCount) >= 2 && (kind === "party" || kind === "event");
}

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

${matureContentInstruction(
  w,
  ids.length
    ? ids
    : (w.chars || []).map((c) => c.id),
  "roleplay"
)}

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
        eventKind: detectSceneEventKind({ title: title.trim(), setting: setting.trim() }),
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
  const matureMode =
    worldContentLevel(
      w,
      w.meId
    ) === "mature";
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

      let out = await askWorldJSONInteractive(w, engineFor(w), `${worldContext(w, scene.cast, true, null)}

JELENET: ${scene.title}
HELYZET: ${scene.setting || "-"}
JELEN VANNAK: ${cast.map((c) => `${c.name} [${c.id}]`).join(", ")}, valamint ${w.player.name} [${w.meId}] — őt a felhasználó játssza.

EDDIG TÖRTÉNT:
${log || "a jelenet most kezdődik"}

${playerText ? `${w.player.name} most ezt teszi vagy mondja:\n"${playerText}"` : "A játékos most nem lép közbe; a szereplők maguktól viszik tovább a jelenetet."}

/*
 * A worldContext(..., true, ...) már tartalmazza minden jelenlévő AI
 * teljes PRIVÁT CHARACTER PERFORMANCE CONTEXT blokkját. Itt ezért nem
 * duplázzuk meg még egyszer a 10-20 ezer karakteres voiceCardokat.
 * Csak az egyéni, futás közben szerzett emlékezet kerül közvetlenül ide.
 */
${cast.map((c) => characterMemoryCard(w, c)).join("")}

MINDEN JELENLÉVŐ KARAKTERNÉL KÖTELEZŐ:
- A teljes saját karakterlapja ÉS saját emlékezete irányítsa a viselkedését.
- Ne csak a personality első néhány jelzőjét használd.
- A saját múltjából származó személyekre, traumákra, lojalitásokra, célokra, titkokra és félelmekre következetesen emlékezzen.
- Ugyanazt a roleplay-sort, mozdulatot, fenyegetést, reakciót vagy közeli parafrázist ne használd újra.

${repetitionGuard(w, cast.map((c) => c.id), "jelenetfolytatás")}

${matureContentInstruction(
  w,
  scene.cast || [],
  "roleplay"
)}

ROLEPLAY FOLYTATÁS — FONTOS:

- Írd meg a folytatást 3-5 természetes mozzanatban. Egy mozzanat lehet beszéd, cselekvés vagy rövid narrátori átvezetés.
- Ne kötelezően minden jelenlévő szereplő kapjon sort minden körben. Az szólaljon meg vagy cselekedjen, akinek ebben a pillanatban természetes oka van rá.
- Nagyobb társas jelenetben/buliban a karakterek EGYMÁSSAL is beszéljenek és reagáljanak egymásra; ne mindenki a játékos körül forogjon.
- Tartsd fejben, hogy minden felsorolt szereplő jelen van akkor is, ha ebben a körben nem kerül fókuszba.
- A korábbi történések térbeli és időbeli folytonossága maradjon meg. Ne teleportáljon senki, ne találj ki hirtelen új érkezést/távozást, ha azt a jelenet nem alapozta meg.
- Ne reseteld a kapcsolatokat minden kör elején. A jó viszony legyen ténylegesen közvetlenebb/melegebb; a rossz viszony legyen feszültebb/élesebb; crush/vonzalom színezze a figyelmet, zavart, féltékenységet vagy flörtöt; a flörtölős karakter ténylegesen flörtölhet, ha természetes.
- A karakterlap TÖRTÉNETÉBŐL eredő lojalitás, ellenségeskedés, dojo- vagy szervezeti rivalizálás aktív marad. Például Cobra Kai ↔ Miyagi-Fang/Miyagi-Do/Eagle Fang ellentét ne tűnjön el semleges viselkedésbe, hacsak a személyes kapcsolat ezt hitelesen felül nem írja.
- ERŐVISZONY/FÉLELEM: a veszélyesség, harci tapasztalat, rang, tekintély és kiszámíthatatlanság ténylegesen hasson arra, ki mer kinek nekimenni. Egy jóval gyengébb vagy kevésbé bátor karakter ne provokáljon lazán egy hírhedten veszélyes senseit/vezetőt/harcost csak a dráma kedvéért. Lehet, hogy fél, kerül, enged, segítséget keres, visszafogja magát vagy csak közvetetten áll ellen. Egy vakmerő karakter szembeszállhat vele, de a kockázatot akkor is érzékelje.
- Mindenki a SAJÁT hangmintája szerint szólaljon meg. A mondataik ne legyenek felcserélhetők, gépiesen egyformák vagy ugyanazon hangon megírva.
- A párbeszéd és a cselekvés vigye a jelenetet, ne összefoglaló.
- A szereplők kezdeményezhetnek, megszakíthatják egymást, kerülhetnek valakit, provokálhatnak, flörtölhetnek, összeveszhetnek vagy elterelhetik a témát, ha ez a személyiségükből és a helyzetből következik.
- A "narrator" csak a jelenet érzékelhető leírása: mit látni, hallani, milyen a tér és a hangulat. Legfeljebb egy narrator-turn legyen ebben a körben.
- A szereplők belső érzései megjelenhetnek a roleplay prózában, de ne adj nekik olyan TUDÁST, amit a saját karakterük nem szerezhetett meg.
- Ha a jelenetben TÉNYLEG megtörténik megfigyelhető romantikus/szaftos esemény — például csók, csókolózás/making out, nyilvános kavarás/hookup, egyértelmű flört, megcsalás vagy lebukás — azt az "events" tömbben külön, tényszerű eseményként is rögzítsd a konkrét érintettekkel. Ne puhítsd "volt köztük valami feszültség" típusú homályos összefoglalássá, ha konkrétan csók történt.
- Ugyanakkor csak azt rögzítsd, ami ténylegesen megtörtént vagy látható volt; puszta kémiából ne találj ki csókot/kavarást.
- Ne zárd le automatikusan a jelenetet; azt csak a külön "Jelenet lezárása" funkció teszi.
- ${w.player.name} helyett SOHA ne beszélj, ne dönts és ne cselekedj. Ha az ő reakciója kellene a folytatáshoz, állj meg előtte.
- Ha ${w.player.name} karakterhez beszélnek, E/2-ben, tegezve szóljanak hozzá; magukról E/1-ben beszéljenek.
${worldLanguage(w, w.meId) === "en"
  ? "- Every user-visible turn, narration, memory, mood, reason and event summary in the JSON must be natural English."
  : "- Minden felhasználónak látható turn, narráció, memória, mood, indok és event-összefoglaló természetes, hibátlan magyar legyen."}

Formátum:
{"turns":[{"id":"a szereplő szögletes zárójelben megadott azonosítója szó szerint, vagy narrator","kind":"speech vagy action","text":"..."}],
 "changes":[{"a":"aki érez","b":"aki iránt","delta":16,"mood":"mit érez most iránta","why":"egy rövid mondat","bond":"csak ha a viszony tényleg megváltozott, és nem állandó kötelék","oneSided":false}],
 "memories":[{"id":"szereplő azonosítója","text":"amit ebből megjegyez"}],
 "events":["egy rövid, tényszerű mondat minden világ-szinten fontos, ténylegesen megtörtént és megfigyelhető eseményről; ne belső gondolatot vagy következtetést írj"]}${TAIL}`);

      const resolveSceneTurns = (candidateOut) =>
        (candidateOut && Array.isArray(candidateOut.turns)
          ? candidateOut.turns
          : []
        )
          .map((t) => {
            const raw = t && (t.id !== undefined ? t.id : t.name);
            const isNarr = String(raw || "").trim().toLowerCase() === "narrator";
            const resolvedId = isNarr
              ? "narrator"
              : (findChar(w, raw) || findChar(w, t && t.name));
            const allowed = isNarr || (resolvedId && !isHuman(w, resolvedId));

            const rawText = t && t.text ? String(t.text) : "";
            const freshText = isNarr
              ? rawText.trim()
              : (
                  resolvedId
                    ? cleanGeneratedUtterance(w, resolvedId, rawText, 2600)
                    : ""
                );

            return {
              authorId: allowed ? resolvedId : null,
              kind: t && t.kind === "action" ? "action" : "speech",
              text: freshText,
            };
          })
          .filter((t) => t.authorId && t.text);

      let resolved = resolveSceneTurns(out);

      /*
       * A szigorú cross-surface ismétlésvédelem helyesen kidobhat egy-egy
       * generált sort. Régen, ha véletlenül AZ ÖSSZESET kidobta, a jelenet
       * egyszerűen "No usable reply arrived" hibával megállt.
       *
       * Most automatikusan kérünk egy MÁSODIK, kisebb és célzottabb generálást,
       * amelynek kifejezett feladata teljesen új megfogalmazás létrehozása.
       */
      if (!resolved.length) {
        const retryCast = cast
          .map((c) => {
            const core = c.brief || c.personality || c.speech || c.bio || "";
            const memory = selfMemoryForPrompt(w, c.id);
            return `[${c.id}] ${c.name}
KARAKTERMAG: ${spread(core, 1100)}
EMLÉKEZET: ${spread(memory, 900)}`;
          })
          .join("\n\n");

        const retryOut = await askWorldJSONInteractive(
          w,
          engineFor(w),
          `ROLEPLAY ÚJRAGENERÁLÁS — az előző kimenet nem volt használható, mert minden sora túl közel állt korábbi megszólalásokhoz vagy hibás szereplő-ID-t használt.

JELENET: ${scene.title}
HELYZET: ${scene.setting || "-"}
JELEN VANNAK: ${cast.map((c) => `${c.name} [${c.id}]`).join(", ")}, valamint ${w.player.name} [${w.meId}] — őt kizárólag a felhasználó irányítja.

EDDIG TÖRTÉNT:
${log || "a jelenet most kezdődik"}

${playerText ? `${w.player.name} most ezt teszi vagy mondja:
"${playerText}"` : "A játékos most nem lép közbe."}

KARAKTEREK — TÖMÖR, DE KÖTELEZŐ KÁNON + EMLÉKEZET:
${retryCast}

${repetitionGuard(w, cast.map((c) => c.id), "jelenetfolytatás")}

SZIGORÚ ÚJRAGENERÁLÁSI SZABÁLYOK:
- Adj 2-4 TELJESEN FRISS mozzanatot.
- Egyetlen korábbi mondatot, akciót, poént, fenyegetést, flörtformulát vagy közeli parafrázist se használj újra.
- CSAK a fent megadott [ID]-kat vagy a "narrator" értéket használd.
- A szereplők karakterhűek legyenek; ne váljanak semleges AI-hanggá.
- A játékos helyett ne beszélj és ne cselekedj.
- A jelenetet ne zárd le automatikusan.
- Ne magyarázd, hogy újragenerálsz.

VÁLASZ CSAK JSON:
{"turns":[{"id":"pontos karakter-ID vagy narrator","kind":"speech vagy action","text":"friss megszólalás vagy cselekvés"}],"changes":[],"memories":[],"events":[]}${TAIL}`,
          {
            maxTokens: 1500,
            maxTries: 3,
          }
        );

        const retryResolved = resolveSceneTurns(retryOut);

        if (retryResolved.length) {
          out = retryOut;
          resolved = retryResolved;
        }
      }

      if (!resolved.length) {
        throw new Error(
          tt(
            "Az AI kétszer is csak ismétlődő vagy hibás szereplőhöz tartozó választ adott. Próbáld újra — a jelenet és a memóriák megmaradtak.",
            "The AI twice returned only repeated text or turns assigned to invalid characters. Try again — the scene and memories were preserved."
          )
        );
      }

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

        const sceneEvents =
          Array.isArray(out.events)
            ? out.events
                .map(
                  (value) =>
                    String(value || "").trim()
                )
                .filter(Boolean)
            : [];

        /*
         * ROLEPLAY PRIVACY:
         *
         * User + 1 AI  -> privát, nem gossip source.
         * User + 2+ AI -> több tanú, ezért valós alapon
         *                 kiszivároghat.
         *
         * Nem tároljuk kötelezően, kitől indult.
         */
        const aiWitnessIds =
          (s.cast || [])
            .filter(
              (id) =>
                id &&
                !isHuman(n, id)
            );

        const gossipEligible =
          aiWitnessIds.length >= 2;

        const sceneKind = s.eventKind || detectSceneEventKind(s);
        s.eventKind = sceneKind;
        const eventRecapEligible = sceneEventRecapEligible(s, aiWitnessIds.length);

        const participantIds = [
          n.meId,
          ...aiWitnessIds,
        ].filter(Boolean);

        sceneEvents.forEach(
          (eventText, index) => {
            const eventTs = now();

            const socialSignals =
              roleplayEventSocialSignals(
                eventText
              );

            recordSocialEvent(
              n,
              {
                type:
                  "roleplay-event",

                refId:
                  `scene:${s.id}:${eventTs}:${index}`,

                ts: eventTs,

                actorId: "",

                targetIds:
                  participantIds,

                visibility:
                  "limited",

                factLevel:
                  "observed",

                importance:
                  Math.max(
                    eventRecapEligible
                      ? 68
                      : 48,
                    socialSignals.importance
                  ),
                drama:
                  Math.max(
                    eventRecapEligible
                      ? 38
                      : 26,
                    socialSignals.drama
                  ),
                romance:
                  socialSignals.romance,
                embarrassment:
                  socialSignals.embarrassment,

                source:
                  "roleplay",

                text:
                  eventText,

                tags: [
                  "roleplay",
                  "scene",
                  "observed",
                  gossipEligible
                    ? "gossip-eligible"
                    : "private-scene",
                  eventRecapEligible
                    ? "event-recap"
                    : "scene-moment",
                  eventRecapEligible
                    ? "party-drama"
                    : "roleplay-moment",
                  ...socialSignals.tags,
                ],

                meta: {
                  sourceType:
                    "roleplay",

                  sceneId:
                    s.id,

                  sceneTitle:
                    s.title || "",

                  participantIds,
                  attendeeIds: participantIds,

                  witnessCount:
                    aiWitnessIds.length,

                  gossipEligible,
                  sceneKind,
                  eventRecapEligible,

                  /*
                   * Nincs leakSourceId.
                   */
                  sourceTraceRequired:
                    false,
                },
              }
            );

            /* Minden AI-tanú automatikusan megjegyzi a tényleges RP-eseményt. */
            aiWitnessIds.forEach((observerId) => {
              rememberKnowledge(n, observerId, {
                kind: "event",
                source: "roleplay_witness",
                confidence: 1,
                text: eventText,
              });

              participantIds.forEach((targetId) => {
                if (targetId && targetId !== observerId) {
                  rememberAboutTarget(n, observerId, targetId, {
                    kind: "event",
                    source: "roleplay_witness",
                    confidence: 1,
                    text: eventText,
                  });
                }
              });
            });
          }
        );

        n.log =
          sceneEvents
            .concat(n.log)
            .slice(0, 30);
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
      const out = await askWorldJSONInteractive(w, engineFor(w), `${worldContext(w, scene.cast, false, null)}

JELENET: ${scene.title}
${log}

Zárd le a jelenetet. Foglald össze 2-3 mondatban, mi történt és mi változott, majd mondd meg, ki mit visz tovább magával.
- A kapcsolati változások a már meglévő viszonyból és a mostani eseményből következzenek; ne reseteld a jó/rossz/crush/rivális dinamikát.
- A történetből eredő lojalitások és rivalizálások a lezárásban is számítsanak.
${worldLanguage(w, w.meId) === "en"
  ? "- summary, memories, mood and why must all be English."
  : "- a summary, memories, mood és why mezők mind magyarul legyenek."}
Formátum: {"summary":"","memories":[{"id":"szereplő azonosítója","text":""}],"changes":[{"a":"aki érez","b":"aki iránt","delta":18,"mood":"mit érez most iránta","why":"egy rövid mondat","bond":"csak ha a viszony tényleg megváltozott, és nem állandó kötelék","oneSided":false}]}${TAIL}`);

      patch((s, n) => {
        s.open = false;
        s.summary = out.summary || "";
        applyMemories(n, out.memories);
        applyChanges(n, out.changes);
        if (out.summary) {
          n.log = [
            out.summary,
          ]
            .concat(n.log)
            .slice(0, 30);

          const aiWitnessIds =
            (s.cast || [])
              .filter(
                (id) =>
                  id &&
                  !isHuman(n, id)
              );

          const gossipEligible =
            aiWitnessIds.length >= 2;

          const sceneKind = s.eventKind || detectSceneEventKind(s);
          s.eventKind = sceneKind;
          const eventRecapEligible = sceneEventRecapEligible(s, aiWitnessIds.length);
          const summarySignals =
            roleplayEventSocialSignals(
              String(out.summary || "")
            );

          recordSocialEvent(
            n,
            {
              type:
                "roleplay-summary",

              refId:
                `scene-summary:${s.id}`,

              ts: now(),

              actorId: "",

              targetIds: [
                n.meId,
                ...aiWitnessIds,
              ].filter(Boolean),

              visibility:
                "limited",

              factLevel:
                "observed",

              importance:
                Math.max(
                  38,
                  summarySignals.importance
                ),
              drama:
                Math.max(
                  18,
                  summarySignals.drama
                ),
              romance:
                summarySignals.romance,
              embarrassment:
                summarySignals.embarrassment,

              source:
                "roleplay",

              text:
                String(out.summary),

              tags: [
                "roleplay",
                "scene-summary",
                gossipEligible
                  ? "gossip-eligible"
                  : "private-scene",
                ...summarySignals.tags,
              ],

              meta: {
                sourceType:
                  "roleplay",

                sceneId:
                  s.id,

                sceneTitle:
                  s.title || "",

                participantIds: [
                  n.meId,
                  ...aiWitnessIds,
                ].filter(Boolean),

                attendeeIds: [
                  n.meId,
                  ...aiWitnessIds,
                ].filter(Boolean),

                witnessCount:
                  aiWitnessIds.length,

                gossipEligible,
                sceneKind,
                eventRecapEligible,

                sourceTraceRequired:
                  false,
              },
            }
          );
        }
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
        <h2 style={{ fontSize: 22 }}>
          {scene.title}
          {matureMode ? (
            <span
              className="mono"
              style={{
                marginLeft: 8,
                fontSize: 10,
                color: "var(--rose)",
              }}
            >
              18+
            </span>
          ) : null}
        </h2>
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
  const matureMode =
    worldContentLevel(
      w,
      w.meId
    ) === "mature";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const endRef = useRef(null);
  const members = (group.members || []).map((id) => charById(w, id)).filter(Boolean);
  const addableMembers = (w.chars || []).filter(
    (c) =>
      c &&
      !(group.members || []).includes(c.id)
  );
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

    const out = await askWorldJSONInteractive(
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

${chatReferenceInstruction(
  w,
  w.player.name,
  "",
  true
)}

${chatQuestionInstruction(
  w,
  mine,
  "",
  true
)}

${
  mine
    ? `${w.player.name} most ezt írta:
"${mine}"`
    : "Senki nem szólt hozzá kívülről; a tagok maguktól folytatják a beszélgetést."
}

TAGOK TELJES KARAKTERKÁNONJA ÉS EMLÉKEZETE:
${members.map((c) => `${voiceCard(c)}${characterMemoryCard(w, c)}`).join("")}

${repetitionGuard(
  w,
  group.members || [],
  "csoportchat"
)}

${matureContentInstruction(
  w,
  group.members || [],
  "group"
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

KAPCSOLATOK ÉS TÖRTÉNET A GROUP CHATBEN:

- A fenti PRIVÁT KARAKTERJÁTÉK-KONTEXTUST ténylegesen alkalmazd minden megszólalónál.
- A jóban lévő karakterek lehetnek közvetlenebbek, belsős poénosabbak, támogatóbbak vagy védelmezőbbek.
- A rosszban lévők ne beszéljenek egymással automatikusan úgy, mint semleges haverok: jöhet feszültség, gúny, versengés, kerülés vagy támadás.
- Crush/vonzalom és flörtölős személyiség természetesen látszódhat a szóválasztásban, féltékenységben, ugratásban vagy figyelemben.
- A történetből eredő lojalitásokat és rivalizálásokat tartsd aktívan; például dojo/szervezeti ellenfelek viselkedése ne resetelődjön semlegesre.
- A személyes kapcsolat felülírhat egy csoportos rivalizálást, de csak ha a karakterlap és a jelenlegi kapcsolat tényleg alátámasztja.
- ERŐHIERARCHIA: egy fizikailag/szociálisan jóval gyengébb, kevésbé tapasztalt vagy félő karakter ne álljon bele automatikusan egy hírhedten veszélyes, kiszámíthatatlan senseibe/vezetőbe/harcosba. Lehet dacos vagy provokatív, HA a saját karakterlapja szerint tényleg ilyen, de a veszély és következmény tudata látszódjon.

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

- Az emoji-használat legyen valódi része minden megszólaló karakter saját group chat stílusának, ne csak elméleti lehetőség.
- Minden karakter a SAJÁT személyisége, beszédstílusa, kora, online szokásai és aktuális hangulata alapján döntse el, mennyire használ emojit.
- Ha egy adott karakter természetesen használna emojikat, AKKOR ténylegesen jelenjenek is meg időről időre a saját válaszaiban.
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
"changes":[{"a":"aki érez","b":"aki iránt","delta":12,"mood":"mit érez most iránta","why":"egy rövid mondat","oneSided":false}],
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
          <span className="name" style={{ fontSize: 13.5 }}>
            {group.name}
            {matureMode ? (
              <span
                className="mono"
                style={{
                  marginLeft: 6,
                  fontSize: 9,
                  color: "var(--rose)",
                }}
              >
                18+
              </span>
            ) : null}
          </span>
          {members.slice(0, 4).map((m) => <Av key={m.id} src={m.avatar} name={m.name} size={22} radius={7} />)}
          <button
            type="button"
            className={"btn tiny " + (addingMembers ? "primary" : "ghost")}
            onClick={() => setAddingMembers((v) => !v)}
            title={tt("Tag hozzáadása", "Add member")}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {addingMembers ? (
        <div className="card" style={{ marginTop: 6 }}>
          <div className="between">
            <span className="f" style={{ margin: 0 }}>
              {tt("Ember hozzáadása a csoporthoz", "Add someone to the group")}
            </span>
            <button
              type="button"
              className="btn tiny ghost"
              onClick={() => setAddingMembers(false)}
            >
              <X size={12} />
            </button>
          </div>

          {addableMembers.length ? (
            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {addableMembers.map((person) => (
                <button
                  type="button"
                  className="btn tiny ghost"
                  key={person.id}
                  onClick={() => {
                    patch((g) => {
                      g.members = [
                        ...new Set([
                          ...(g.members || []),
                          person.id,
                        ]),
                      ];
                      g.updatedAt = now();
                    });
                  }}
                >
                  <Av src={person.avatar} name={person.name} size={20} radius={7} />
                  {person.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint" style={{ marginTop: 8 }}>
              {tt("Már minden AI-karakter benne van ebben a csoportban.", "Every AI character is already in this group.")}
            </p>
          )}
        </div>
      ) : null}

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
        {busy && members[0] && (
  <div className="typing-row">
    <Av
      src={members[0].avatar}
      name={members[0].name}
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
  const { media } = useMedia();
  const matureMode =
    worldContentLevel(
      w,
      w.meId
    ) === "mature";
  const [text, setText] = useState("");
  const [chatImg, setChatImg] = useState("");
  const [showChatMedia, setShowChatMedia] = useState(false);
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

  const selectedImg =
    chatImg;

  if (
    (!t && !selectedImg) ||
    !c ||
    busy ||
    sendLockRef.current
  ) {
    return;
  }

  sendLockRef.current = true;
  setBusy(true);
  setText("");
  setChatImg("");
  setShowChatMedia(false);

  const ck = chatKey(
    w.meId,
    c.id
  );

  const sentAt = now();

  const outgoingImageId =
    imageIdOf(
      selectedImg
    );

  let outgoingImageDescription =
    "";

  /*
   * A feltöltött kép vizuális tartalmát egyszer röviden
   * elemezzük, hogy a beszélgető AI tényleg tudjon arra
   * reagálni, ami látható rajta.
   */
  if (selectedImg) {
    try {
      const imageData =
        resolveImg(
          selectedImg,
          media
        );

      outgoingImageDescription =
        await analyzeImageDataUrl(
          imageData,
          `This image was sent in a private chat by ${w.player.name} to ${c.name}. Describe only what is visibly present in 1-3 concise sentences: people, clothing, activity, setting, objects and mood when visible. Do not identify real people by name.`
        );
    } catch (visionErr) {
      console.warn(
        "Chat image analysis failed:",
        visionErr
      );
    }
  }

  const outgoingMessage = {
    id:
      "dm_" + uid(),
    from:"me",
    text:t,
    ts:sentAt,
    imageId:
      outgoingImageId ||
      "",
    image:
      outgoingImageId
        ? ""
        : selectedImg || "",
    imageDescription:
      outgoingImageDescription ||
      "",
  };

  /*
   * Az AI már AZ ELSŐ elküldött üzenetet is
   * a világ tényleges részeként kapja meg.
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
    outgoingMessage,
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
        ...outgoingMessage,
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
          }: ${
            m.text || ""
          }${
            (m.imageId || m.image)
              ? ` [IMAGE: ${
                  m.imageDescription ||
                  (
                    worldLanguage(
                      requestWorld,
                      requestWorld.meId
                    ) === "en"
                      ? "an image was sent"
                      : "képet küldött"
                  )
                }]`
              : ""
          }`
      )
      .join("\n");

    const rel = getRel(
      requestWorld,
      c.id,
      requestWorld.meId
    );

    const out = await askWorldJSONInteractive(
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

KÖTELEZŐ VISELKEDÉSI IRÁNY A KAPCSOLATOTOK ALAPJÁN:
${relationshipBehaviorCard(
  requestWorld,
  c.id,
  requestWorld.meId
)}

Amire emlékszel:
${selfMemoryForPrompt(
  requestWorld,
  c.id
)}

BESZÉLGETÉS:
${hist}

${chatReferenceInstruction(
  requestWorld,
  requestWorld.player.name,
  c.name,
  false
)}

${chatQuestionInstruction(
  requestWorld,
  t,
  c.name,
  false
)}

${voiceCard(c)}

${repetitionGuard(
  requestWorld,
  [c.id],
  "privát üzenetek"
)}

${chatEmojiGuard(
  requestWorld,
  c.id
)}

${dmPresenceGuardInstruction(
  requestWorld,
  c.id,
  hist
)}

${matureContentInstruction(
  requestWorld,
  [c.id],
  "chat"
)}

${
  outgoingImageDescription
    ? `A JÁTÉKOS MOST KÉPET IS KÜLDÖTT.
A képen látható tartalom rövid vizuális leírása:
${outgoingImageDescription}

A válaszod természetesen reagálhat a kép konkrét, látható részleteire. Ne tegyél úgy, mintha olyasmit látnál, ami nincs a leírásban.`
    : ""
}

SAJÁT FOTÓALBUMOD — PRIVÁTBAN CSAK EZEKBŐL KÜLDHETSZ KÉPET:
${albumList(c) || "nincs használható albumkép"}

Ha természetes része a válaszodnak, küldhetsz EGY képet a saját albumodból is.
- Az "image" mezőbe csak a fenti kep1/kep2/... kulcs kerülhet.
- Ha nincs értelmes ok képet küldeni, legyen üres.
- Ne találj ki nem létező képet.
- DM-ben elküldött albumkép NEM törlődik az albumból; csak a nyilvánosan kiposztolt albumkép egyszer használatos.

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
- Ha konkrét kérdést tett fel, ne cseréld le automatikusan a választ egy visszakérdezésre vagy ködös reakcióra. Ha tudod és nincs karakterhű okod titkolni, VÁLASZOLJ rá konkrétan; utána jöhet flört, poén, provokáció vagy visszakérdezés.
- Maradj teljesen karakterhű.
- A példamondatok és hangminták kizárólag stílusirányok, soha ne másold vagy parafrazáld őket.
- Ha a karakter természetesen használ emojit, használhatsz valódi emojit is.
- Ha nem használ emojit, ne erőltesd.
- Ne legyél udvarias asszisztens.
- A kapcsolat pontszáma, bondja, aktuális moodja, rejtett érzése és a karakter története KÖTELEZŐEN hasson a hangodra.
- Jó viszonynál ne légy mesterségesen hideg; rossz viszonynál ne légy mesterségesen kedves.
- Crushnál/vonzalomnál a viselkedésedből érződjön a plusz figyelem, zavar, féltékenység, flört vagy ragaszkodás, ha rád illik — ne mondd ki sablonosan.
- Ha a személyiséged flörtölős, megfelelő helyzetben ténylegesen flörtölj.
- A történetedben szereplő lojalitások és rivalizálások is aktívak maradnak.
- AZ ERŐVISZONY ÉS FÉLELEM IS VALÓS: ha a másik karakter nálad sokkal veszélyesebb, erősebb, magasabb rangú vagy kiszámíthatatlanabb, és a saját történeted/személyiséged alapján nem vagy hozzá mérhetően vakmerő, ne beszélj vele úgy, mintha következmények nélkül bármit megtehetnél. Az ellenszenv nem egyenlő bátorsággal.
- Ne írj a játékos helyett.
- Magadról E/1-ben beszélj.
- ${requestWorld.player.name} karaktert E/2-ben, tegezve szólítsd meg.
- Magázás tilos.

KAPCSOLATVÁLTOZÁS:
- A changes tömbben külön irányként kezeld ${c.name} → ${requestWorld.player.name} ÉS ${requestWorld.player.name} → ${c.name} kapcsolatát.
- Ha a beszélgetés tényleg hatott mindkettőjükre, adj KÉT külön changes elemet.
- A két irány delta-ja lehet eltérő nagyságú, sőt akár eltérő előjelű is.
- A játékos → AI score-változás mechanikai state update; ettől még SOHA nem írhatsz a játékos helyett mondatot, cselekvést vagy belső gondolatot.
- Negatív delta ugyanannyira természetes, mint pozitív.
- Jelentős interakciónál ne adj alibi ±1/±2 értéket.
- Ha nincs valódi érzelmi hatás, a changes lehet üres.
- Egyoldalú titkos érzésnél használhatsz "oneSided":true mezőt.

Formátum:
{"reply":"a válaszod vagy üres, ha csak képet küldesz","image":"kep1 vagy üres","changes":[{"a":"${c.id}","b":"${requestWorld.meId}","delta":-12,"mood":"mit érez most iránta","why":"miért"},{"a":"${requestWorld.meId}","b":"${c.id}","delta":8,"mood":"","why":"miért"}],"memory":"egy mondat, ha történt valami emlékezetes, különben üres"}${TAIL}`
    );

    const aiPic =
      out &&
      out.image
        ? albumFind(
            c,
            out.image
          )
        : null;

    const aiImageId =
      aiPic
        ? imageIdOf(
            aiPic.imageId ||
            aiPic.image ||
            ""
          )
        : "";

    const aiImageRef =
      aiPic
        ? (
            aiPic.imageId
              ? imageRef(
                  aiPic.imageId
                )
              : aiPic.image || ""
          )
        : "";

    const aiImageDescription =
      aiPic
        ? String(
            aiPic.vision ||
            aiPic.note ||
            ""
          )
        : "";

    let reply = String(
      out &&
      out.reply !== undefined
        ? out.reply
        : ""
    ).trim();

    /*
     * Ha a modell a prompt ellenére is
     * visszanyúl egy frissen túlhasznált
     * emojihoz, egyszer újraíratjuk vele
     * ugyanazt a reakciót.
     */
    if (
      reply &&
      usesBlockedChatEmoji(
        requestWorld,
        c.id,
        reply
      )
    ) {
      const retryOut =
        await askWorldJSONInteractive(
          requestWorld,
          engineFor(
            requestWorld
          ),
          `${worldContext(
            requestWorld,
            [c.id],
            true,
            c.id
          )}

TE MOST ${c.name.toUpperCase()} VAGY.

Az előző válaszod tartalma alapvetően jó volt,
de az emoji-használat ismétlődött.

${voiceCard(c)}

${chatEmojiGuard(
  requestWorld,
  c.id
)}

${matureContentInstruction(
  requestWorld,
  [c.id],
  "chat"
)}

EREDETI VÁLASZ:
${reply}

Írd újra ugyanazt a természetes privát chatreakciót.
A jelentést és a karakter hangját tartsd meg.
Lehet teljesen emoji nélküli is.
NE magyarázd meg az átírást.

Formátum:
{"reply":"az új, természetes chatválasz"}${TAIL}`
        );

      const retryReply =
        String(
          retryOut &&
          retryOut.reply !== undefined
            ? retryOut.reply
            : ""
        ).trim();

      if (
        retryReply &&
        !usesBlockedChatEmoji(
          requestWorld,
          c.id,
          retryReply
        )
      ) {
        reply = retryReply;
      }
    }

    reply =
      enforceChatEmojiVariety(
        requestWorld,
        c.id,
        reply
      );

    reply =
      sanitizePhoneDm(
        requestWorld,
        c.id,
        reply,
        hist
      );

    if (!reply && !aiImageRef) {
      /*
       * Ha egy emoji-only válasz teljesen
       * kiesett a cooldown miatt, kérünk
       * egy rövid, kötelezően emoji nélküli
       * újrafogalmazást.
       */
      const noEmojiOut =
        await askWorldJSONInteractive(
          requestWorld,
          engineFor(
            requestWorld
          ),
          `${worldContext(
            requestWorld,
            [c.id],
            true,
            c.id
          )}

TE MOST ${c.name.toUpperCase()} VAGY.

Írj egy rövid, karakterhű privát chatválaszt
${requestWorld.player.name} legutóbbi üzenetére.

${relationshipBehaviorCard(
  requestWorld,
  c.id,
  requestWorld.meId
)}

${dmPresenceGuardInstruction(
  requestWorld,
  c.id,
  hist
)}

${matureContentInstruction(
  requestWorld,
  [c.id],
  "chat"
)}

SZIGORÚ SZABÁLY:
- EGYETLEN EMOJIT SE használj.
- Legalább egy szót írj.
- Ne narrálj.
- Ne magyarázd az átírást.

Formátum:
{"reply":"emoji nélküli rövid válasz"}${TAIL}`
        );

      reply =
        String(
          noEmojiOut &&
          noEmojiOut.reply !== undefined
            ? noEmojiOut.reply
            : ""
        )
          .replace(
            /\p{Extended_Pictographic}/gu,
            ""
          )
          .replace(
            /\s+/g,
            " "
          )
          .trim();

      reply =
        sanitizePhoneDm(
          requestWorld,
          c.id,
          reply,
          hist
        );
    }

    if (!reply && !aiImageRef) {
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
          id:
            "dm_" + uid(),
          from:"them",
          text:reply,
          ts:now(),
          imageId:
            aiImageId ||
            "",
          image:
            aiImageId
              ? ""
              : aiImageRef || "",
          imageDescription:
            aiImageDescription ||
            "",
          language:
            worldLanguage(
              n,
              n.meId
            ),
        },
      ];

      const dmChanges =
        Array.isArray(
          out &&
          out.changes
        )
          ? out.changes
          : [
              {
                a:c.id,
                b:requestWorld.meId,
                delta:
                  Number(
                    out &&
                    out.delta
                  ) || 0,
                mood:
                  out &&
                  out.mood,
                why:
                  out &&
                  out.why,
              },
            ];

      applyChanges(
        n,
        dmChanges
      );

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
              reply ||
              (
                aiImageDescription
                  ? `📷 ${aiImageDescription}`
                  : "📷 kép"
              ),
              110
            )}`,
            `I got a private message: ${cut(
              reply ||
              (
                aiImageDescription
                  ? `📷 ${aiImageDescription}`
                  : "📷 image"
              ),
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
            `${requestWorld.player.name} ezt küldte: ${cut(
              t ||
              (
                outgoingImageDescription
                  ? `📷 ${outgoingImageDescription}`
                  : "📷 kép"
              ),
              110
            )}`,
            `${requestWorld.player.name} sent: ${cut(
              t ||
              (
                outgoingImageDescription
                  ? `📷 ${outgoingImageDescription}`
                  : "📷 image"
              ),
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
    /*
     * A játékos üzenete már biztosan bent marad.
     * A közvetlen chat-hívás 3 automatikus próbát kapott,
     * ezért itt már csak valódi szolgáltatói/hálózati hibát jelzünk.
     */
    setErr(
      "CHAT: " +
      (
        (e && e.message) ||
        tt(
          "A válasz most technikai okból nem érkezett meg. Az üzeneted el lett mentve.",
          "The reply couldn't arrive because of a technical issue. Your message was saved."
        )
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
    const conversationRows = [
      ...(w.groups || []).map((g) => {
        const groupMembers =
          (g.members || [])
            .map((id) =>
              charById(
                w,
                id
              )
            )
            .filter(Boolean);

        const last =
          (g.msgs || [])
            .slice(-1)[0] ||
          null;

        const lastWho =
          last
            ? (
                last.from === w.meId
                  ? w.player
                  : charById(
                      w,
                      last.from
                    )
              )
            : null;

        return {
          kind:"group",
          id:g.id,
          ts:
            Number(
              last &&
              last.ts
            ) ||
            Number(
              g.updatedAt
            ) ||
            Number(
              g.createdAt
            ) ||
            0,
          g,
          members:groupMembers,
          last,
          lastWho,
        };
      }),

      ...(w.chars || []).map((x) => {
        const ck =
          chatKey(
            w.meId,
            x.id
          );

        const last =
          (w.chats[ck] || [])
            .slice(-1)[0] ||
          null;

        const fresh =
          Boolean(
            last &&
            last.from === "them" &&
            last.ts >
              (
                (
                  w.seen &&
                  w.seen[ck]
                ) ||
                0
              )
          );

        return {
          kind:"dm",
          id:x.id,
          ts:
            Number(
              last &&
              last.ts
            ) || 0,
          x,
          ck,
          last,
          fresh,
          rel:
            getRel(
              w,
              x.id,
              w.meId
            ),
        };
      }),
    ].sort(
      (a,b) =>
        b.ts - a.ts ||
        (
          a.kind === "dm"
            ? -1
            : 1
        )
    );

    return (
      <>
        <NotesStrip
          w={w}
          update={update}
          setErr={setErr}
          onOpenChat={(id) =>
            setOpenId(id)
          }
          jump={jump}
        />

        <div
          className="between"
          style={{
            marginTop:12,
          }}
        >
          <label
            className="f"
            style={{
              margin:0,
              color:"var(--gold)",
            }}
          >
            {tt(
              "Beszélgetések",
              "Messages"
            )}
          </label>

          <button
            type="button"
            className="btn tiny primary"
            onClick={() =>
              setCreating(true)
            }
          >
            <Plus size={13} />
            {tt(
              "Új csoport",
              "New group"
            )}
          </button>
        </div>

        <p
          className="hint"
          style={{
            marginTop:6,
            marginBottom:10,
          }}
        >
          {tt(
            "A privát és csoportos beszélgetések együtt, a legutóbbi aktivitás sorrendjében jelennek meg.",
            "Private and group conversations are mixed together and sorted by latest activity."
          )}
        </p>

        {creating ? (
          <GroupNew
            w={w}
            onClose={() =>
              setCreating(false)
            }
            onCreate={(g) => {
              update((n) => {
                n.groups =
                  (n.groups || [])
                    .concat(g);
              });

              setCreating(false);
              setGid(g.id);
            }}
          />
        ) : null}

        {!conversationRows.length ? (
          <p
            className="hint"
            style={{
              textAlign:"center",
              marginTop:24,
            }}
          >
            {tt(
              "Még nincs beszélgetés.",
              "No conversations yet."
            )}
          </p>
        ) : null}

        {conversationRows.map((row) => {
          if (row.kind === "group") {
            const {
              g,
              members:groupMembers,
              last,
              lastWho,
            } = row;

            const preview =
              last
                ? (
                    (
                      lastWho
                        ? lastWho.name + ": "
                        : ""
                    ) +
                    (
                      last.text ||
                      (
                        last.imageId ||
                        last.image
                          ? tt("📷 Kép", "📷 Photo")
                          : ""
                      )
                    )
                  )
                : tt(
                    `${groupMembers.length} tag · még üres`,
                    `${groupMembers.length} members · still empty`
                  );

            return (
              <div
                className="card"
                key={"group:" + g.id}
                onClick={() =>
                  setGid(g.id)
                }
                style={{
                  cursor:"pointer",
                }}
              >
                <div className="between">
                  <div
                    className="row"
                    style={{
                      alignItems:"center",
                      minWidth:0,
                    }}
                  >
                    <div
                      className="row"
                      style={{
                        gap:3,
                      }}
                    >
                      {groupMembers
                        .slice(0,3)
                        .map((m) => (
                          <Av
                            key={m.id}
                            src={m.avatar}
                            name={m.name}
                            size={26}
                            radius={8}
                          />
                        ))}
                    </div>

                    <div
                      style={{
                        minWidth:0,
                      }}
                    >
                      <div
                        className="name"
                        style={{
                          fontSize:13.5,
                        }}
                      >
                        {g.name}
                        <span
                          className="handle mono"
                          style={{
                            marginLeft:6,
                          }}
                        >
                          {tt(
                            "csoport",
                            "group"
                          )}
                        </span>
                      </div>

                      <div
                        className="hint"
                        style={{
                          overflow:"hidden",
                          textOverflow:"ellipsis",
                          whiteSpace:"nowrap",
                        }}
                      >
                        {preview}
                      </div>
                    </div>
                  </div>

                  <div
                    className="row"
                    style={{
                      gap:4,
                      alignItems:"center",
                    }}
                  >
                    {row.ts ? (
                      <span className="handle mono">
                        {timeAgo(row.ts)}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      className="btn tiny ghost"
                      style={{
                        color:"var(--steel)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();

                        update((n) => {
                          n.groups =
                            (n.groups || [])
                              .filter(
                                (x) =>
                                  x.id !==
                                  g.id
                              );

                          if (!n.deleted) {
                            n.deleted = {};
                          }

                          n.deleted[g.id] =
                            now();
                        });
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          const {
            x,
            last,
            fresh,
            rel,
          } = row;

          const preview =
            last
              ? (
                  (
                    last.from === "me"
                      ? tt(
                          "Te: ",
                          "You: "
                        )
                      : ""
                  ) +
                  (
                    last.text ||
                    (
                      last.imageId ||
                      last.image
                        ? tt(
                            "📷 Kép",
                            "📷 Photo"
                          )
                        : ""
                    )
                  )
                )
              : sysTextFor(
                  w,
                  w.meId,
                  "noMessagesYet"
                );

          return (
            <div
              className="card"
              key={"dm:" + x.id}
              onClick={() =>
                setOpenId(x.id)
              }
              style={{
                cursor:"pointer",
                borderColor:
                  fresh
                    ? "var(--rose)"
                    : "var(--line)",
              }}
            >
              <div className="row">
                <Av
                  src={x.avatar}
                  name={x.name}
                />

                <div
                  style={{
                    flex:1,
                    minWidth:0,
                  }}
                >
                  <div className="between">
                    <div
                      className="row"
                      style={{
                        gap:6,
                        alignItems:"center",
                        minWidth:0,
                      }}
                    >
                      <div className="name">
                        {x.name}
                      </div>

                      {fresh ? (
                        <span className="dot" />
                      ) : null}
                    </div>

                    {row.ts ? (
                      <span className="handle mono">
                        {timeAgo(row.ts)}
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      overflow:"hidden",
                      textOverflow:"ellipsis",
                      whiteSpace:"nowrap",
                      fontSize:12,
                      color:
                        fresh
                          ? "var(--bone)"
                          : "var(--muted)",
                      fontWeight:
                        fresh
                          ? 600
                          : 400,
                    }}
                  >
                    {preview}
                  </div>

                  {rel.mood ? (
                    <div
                      style={{
                        fontSize:11.5,
                        color:"var(--rose)",
                        marginTop:2,
                      }}
                    >
                      {rel.mood}
                    </div>
                  ) : null}
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
            <div className="name">
              {c.name}
              {matureMode ? (
                <span
                  className="mono"
                  style={{
                    marginLeft: 6,
                    fontSize: 9,
                    color: "var(--rose)",
                  }}
                >
                  18+
                </span>
              ) : null}
            </div>
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
        {msgs.map((m, i) => (
          <div
            key={m.id || i}
            className={"bub " + (m.from === "me" ? "me" : "them")}
            style={{
              overflow:"hidden",
            }}
          >
            {(m.imageId || m.image) ? (
              <img
                src={resolveImg(
                  m.imageId
                    ? imageRef(m.imageId)
                    : m.image,
                  media
                )}
                alt=""
                style={{
                  display:"block",
                  width:"min(260px, 70vw)",
                  maxWidth:"100%",
                  maxHeight:340,
                  objectFit:"cover",
                  borderRadius:12,
                  marginBottom:m.text ? 7 : 0,
                }}
              />
            ) : null}
            {m.text ? (
              <div style={{ whiteSpace:"pre-wrap" }}>
                {m.text}
              </div>
            ) : null}
          </div>
        ))}
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

      {showChatMedia || chatImg ? (
        <div
          className="card"
          style={{
            marginTop:8,
          }}
        >
          <ImagePicker
            value={chatImg}
            onChange={setChatImg}
            label={tt(
              "Kép az üzenethez",
              "Image for message"
            )}
            max={1000}
            preview={100}
            previewWidth={120}
            previewHeight={120}
            category="chat"
          />
        </div>
      ) : null}

      <div
        className="row"
        style={{
          marginTop:8,
          gap:8,
          alignItems:"center",
        }}
      >
        <button
          type="button"
          className={"btn " + (chatImg ? "primary" : "ghost")}
          onClick={() =>
            setShowChatMedia(
              (v) => !v
            )
          }
          disabled={busy}
          title={tt(
            "Kép küldése",
            "Send a photo"
          )}
        >
          <ImageIcon size={15} />
        </button>

        <input
          className="i"
          value={text}
          placeholder={tt(
            "Üzenet…",
            "Message…"
          )}
          onChange={(e) =>
            setText(
              e.target.value
            )
          }
          onKeyDown={(e) => {
            if (
              e.key === "Enter"
            ) {
              e.preventDefault();

              if (
                !busy &&
                (
                  text.trim() ||
                  chatImg
                )
              ) {
                send();
              }
            }
          }}
        />

        <button
          type="button"
          className="btn primary"
          onClick={() =>
            send()
          }
          disabled={
            busy ||
            (
              !text.trim() &&
              !chatImg
            )
          }
        >
          <Send size={15} />
        </button>
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

function PopupEventModal({ w, event, update, onChoose }) {
  const { tt } = useLang();
  const [busyChoice, setBusyChoice] = useState("");

  if (!event) return null;

  const choose = async (choice) => {
    if (!choice || busyChoice) return;

    setBusyChoice(choice.id);

    let completed = false;

    try {
      if (onChoose) {
        completed =
          (
            await onChoose(
              event,
              choice
            )
          ) === true;
      } else {
        update((n) =>
          resolvePopupEvent(
            n,
            event.id,
            choice.id
          )
        );

        completed = true;
      }
    } finally {
      /*
       * Siker esetén a popup eltűnik.
       * Nem küldünk új setState-et a már lecsatolt modalra.
       */
      if (!completed) {
        setBusyChoice("");
      }
    }
  };

  return (
    <div className="scrim popup-event-scrim">
      <div className="sheet popup-event-sheet">
        <div className="between">
          <div>
            <div className="popup-event-kicker">
              <Sparkles size={12} />
              {tt("Váratlan helyzet","Unexpected situation")}
            </div>
            <div className="popup-event-title">
              {event.icon || "⚡"} {event.title}
            </div>
          </div>

          <button
            className="btn tiny ghost"
            title={tt("Később","Later")}
            disabled={Boolean(busyChoice)}
            onClick={() =>
              update((n) =>
                snoozePopupEvent(
                  n,
                  event.id
                )
              )
            }
          >
            <X size={14} />
          </button>
        </div>

        <div className="popup-event-body">
          {event.text}
        </div>

        <div className="popup-choice-list">
          {(event.choices || []).map(
            (choice) => (
              <button
                key={choice.id}
                className="btn popup-choice"
                disabled={Boolean(busyChoice)}
                onClick={() =>
                  choose(choice)
                }
              >
                {busyChoice === choice.id ? (
                  <Loader2
                    size={15}
                    className="spin"
                  />
                ) : null}

                <div className="popup-choice-copy">
                  <div className="popup-choice-label">
                    {choice.label}
                  </div>

                  {choice.description ? (
                    <div className="popup-choice-desc">
                      {choice.description}
                    </div>
                  ) : null}
                </div>
              </button>
            )
          )}
        </div>

        <p className="hint" style={{ marginTop:12 }}>
          {tt(
            "A választás most már tényleges cselekvést is elindít: privát válasznál DM-et, nyilvános stratégiánál valódi posztot hoz létre.",
            "Your choice now triggers a real action too: a private response creates a DM, while a public strategy creates an actual post."
          )}
        </p>
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
  const currentContentLevel =
    worldContentLevel(
      w,
      w.meId
    );

  const setContentLevel = (
    level
  ) => {
    const next =
      level === "mature"
        ? "mature"
        : "standard";

    /*
     * FONTOS:
     * A World komponens a renderelt "view"-t kapja,
     * amiben benne van w.meId.
     *
     * Az update() viszont a nyers world state-et klónozza,
     * és abban nincs külön n.meId mező.
     *
     * Emiatt a korábbi kód valójában ezt írta:
     * userSettings["undefined"].contentLevel
     *
     * és a saját userSettings sorod nem változott.
     */
    const ownerId =
      w.meId;

    if (!ownerId) {
      setErr(
        tt(
          "Nem található az aktív játékos azonosítója.",
          "The active player ID could not be found."
        )
      );

      return;
    }

    update((n) => {
      if (
        !n.userSettings ||
        typeof n.userSettings !== "object" ||
        Array.isArray(n.userSettings)
      ) {
        n.userSettings = {};
      }

      n.userSettings[ownerId] = {
        ...(n.userSettings[ownerId] || {}),
        contentLevel: next,
      };
    });
  };

  const activeMedia =
    activeGossipMediaAccount(
      w
    );

  const setGossipMediaMode = (
    mode
  ) => {
    update((n) => {
      ensureGossipMediaState(n);

      n.gossipSettings.mediaMode =
        mode;
    });
  };

  const editGossipMedia = (
    field,
    value
  ) => {
    update((n) => {
      ensureGossipMediaState(n);

      const mode =
        n.gossipSettings.mediaMode;

      if (
        mode !== "local" &&
        mode !== "global"
      ) {
        return;
      }

      n.mediaAccounts[mode][field] =
        value;

      ensureSocialProfileRow(
        n.mediaAccounts[mode]
      );
    });
  };

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

      <div
        className="card"
        style={{
          borderColor:
            currentContentLevel === "mature"
              ? "var(--rose)"
              : "var(--line)",
        }}
      >
        <div className="between">
          <label
            className="f"
            style={{
              margin: 0,
              color:
                currentContentLevel === "mature"
                  ? "var(--rose)"
                  : "var(--muted)",
            }}
          >
            {tt(
              "Roleplay & chat tartalmi szint",
              "Roleplay & chat content level"
            )}
          </label>

          {currentContentLevel === "mature" ? (
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--rose)",
              }}
            >
              18+
            </span>
          ) : null}
        </div>

        <div
          className="row"
          style={{
            gap: 6,
            marginTop: 10,
          }}
        >
          {CONTENT_LEVELS.map(
            (level) => (
              <button
                type="button"
                key={level.id}
                className={
                  "btn tiny full " +
                  (
                    currentContentLevel ===
                    level.id
                      ? "primary"
                      : "ghost"
                  )
                }
                onClick={() =>
                  setContentLevel(
                    level.id
                  )
                }
              >
                {tt(
                  level.nameHu,
                  level.nameEn
                )}
              </button>
            )
          )}
        </div>

        <p
          className="hint"
          style={{
            marginTop: 8,
          }}
        >
          {currentContentLevel === "mature"
            ? tt(
                "Mature 18+: a roleplay, privát DM és group chat lehet nyersebb, sötétebb és felnőttesebb; erősebb káromkodás, toxikus dinamika, fenyegetés, felnőtt humor és intenzívebb romantikus/kétértelmű feszültség is megjelenhet, ha karakterhű. Explicit szexuális részletek helyett az intimitás nem részletező / fade-to-black marad. Kiskorút a rendszer nem szexualizál.",
                "Mature 18+: roleplay, private DMs and group chats may be rougher, darker and more adult; stronger profanity, toxic dynamics, threats, adult humor and more intense romantic/suggestive tension can appear when character-accurate. Intimacy stays non-graphic / fade-to-black rather than explicit. The system never sexualizes minors."
              )
            : tt(
                "Standard: a roleplay és chat továbbra is karakterhű lehet romantikus, feszült vagy sötét, de visszafogottabb felnőtt tartalmi szinten.",
                "Standard: roleplay and chat can still be romantic, tense or dark when character-accurate, but stay at a more restrained content level."
              )}
        </p>

        <p
          className="hint"
          style={{
            marginTop: 6,
            color: "var(--gold)",
          }}
        >
          {tt(
            "A 18+ mód csak a Roleplayre és a chatekre vonatkozik; a Feed, kommentek és Notes ettől nem válnak automatikusan felnőtt tartalmúvá.",
            "18+ mode applies only to Roleplay and chats; Feed posts, comments and Notes do not automatically become adult-content."
          )}
        </p>
      </div>

      <div className="card">
        <label
          className="f"
          style={{
            marginTop: 0,
          }}
        >
          Gossip & Media
        </label>

        <p className="hint">
          {tt(
            "Válaszd ki, hogy legyen-e külön pletykamédia ebben a világban. Egyszerre egy oldal aktív.",
            "Choose whether this world has a dedicated gossip-media account. Only one page is active at a time."
          )}
        </p>

        <div className="gossip-mode-grid">
          <button
            className={
              "btn tiny full " +
              (
                w.gossipSettings &&
                w.gossipSettings.mediaMode === "off"
                  ? "primary"
                  : "ghost"
              )
            }
            onClick={() =>
              setGossipMediaMode(
                "off"
              )
            }
          >
            {tt(
              "Kikapcsolva",
              "Off"
            )}
          </button>

          <button
            className={
              "btn tiny full " +
              (
                w.gossipSettings &&
                w.gossipSettings.mediaMode === "local"
                  ? "primary"
                  : "ghost"
              )
            }
            onClick={() =>
              setGossipMediaMode(
                "local"
              )
            }
          >
            Spill&Chill
          </button>

          <button
            className={
              "btn tiny full " +
              (
                w.gossipSettings &&
                w.gossipSettings.mediaMode === "global"
                  ? "primary"
                  : "ghost"
              )
            }
            onClick={() =>
              setGossipMediaMode(
                "global"
              )
            }
          >
            RumorHasIt
          </button>
        </div>

        {activeMedia ? (
          <div className="gossip-media-preview">
            <div
              className="between"
              style={{
                alignItems:
                  "flex-start",
              }}
            >
              <div
                className="row"
                style={{
                  alignItems:
                    "center",
                }}
              >
                <Av
                  src={
                    activeMedia.avatar
                  }
                  name={
                    activeMedia.name
                  }
                  size={42}
                  radius={12}
                />

                <div>
                  <div className="name">
                    {activeMedia.name}
                  </div>

                  <div className="handle mono">
                    @{activeMedia.username}
                  </div>

                  <div className="social-media-account-tag">
                    <Globe2 size={11} />

                    {activeMedia.mediaKind === "local"
                      ? tt(
                          "kisvárosi / helyi média",
                          "small-town / local media"
                        )
                      : tt(
                          "világszintű tabloid",
                          "global tabloid"
                        )}
                  </div>
                </div>
              </div>

              <button
                className={
                  isFollowing(
                    w,
                    w.meId,
                    activeMedia.id
                  )
                    ? "btn tiny ghost social-following"
                    : "btn tiny ghost"
                }
                onClick={() =>
                  update((n) => {
                    setFollowState(
                      n,
                      n.meId ||
                        w.meId,
                      activeMedia.id,
                      !isFollowing(
                        n,
                        n.meId ||
                          w.meId,
                        activeMedia.id
                      ),
                      "player"
                    );
                  })
                }
              >
                {isFollowing(
                  w,
                  w.meId,
                  activeMedia.id
                )
                  ? tt(
                      "Követed",
                      "Following"
                    )
                  : tt(
                      "Követés",
                      "Follow"
                    )}
              </button>
            </div>

            <label className="f">
              {tt(
                "Alap követőszám",
                "Base follower count"
              )}
            </label>

            <input
              className="i mono"
              type="number"
              min="0"
              step="1"
              value={
                Number(
                  activeMedia.baseFollowers
                ) || 0
              }
              onChange={(e) =>
                editGossipMedia(
                  "baseFollowers",
                  Math.max(
                    0,
                    Math.round(
                      Number(
                        e.target.value
                      ) || 0
                    )
                  )
                )
              }
            />

            <ImagePicker
              value={
                activeMedia.avatar ||
                ""
              }
              onChange={(v) =>
                editGossipMedia(
                  "avatar",
                  v
                )
              }
              label={tt(
                "Oldal profilképe",
                "Page profile picture"
              )}
              max={512}
              preview={70}
              category="profile"
            />

            <ImagePicker
              value={
                activeMedia.cover ||
                ""
              }
              onChange={(v) =>
                editGossipMedia(
                  "cover",
                  v
                )
              }
              label={tt(
                "Oldal borítóképe",
                "Page cover photo"
              )}
              max={1400}
              previewWidth={180}
              previewHeight={90}
              category="cover"
            />

            <p
              className="hint"
              style={{
                marginTop: 8,
              }}
            >
              {activeMedia.mediaKind === "local"
                ? tt(
                    "A Spill&Chill csak akkor posztol, ha tényleg szaftos helyi sztori történt: komoly konfliktus, romantikus botrány, árulás, megalázás, nagy buli-dráma vagy más erős esemény. Apró social jelekből nem gyárt hírt.",
                    "Spill&Chill only posts when something genuinely juicy happens locally: a serious conflict, romantic scandal, betrayal, humiliation, major party drama or another strong event. It does not turn tiny social signals into stories."
                  )
                : tt(
                    "A RumorHasIt később magasabb hírküszöbbel dolgozik majd: nagyobb fame, virality, botrány vagy széles nyilvánosság kell egy sztorihoz.",
                    "RumorHasIt will later use a higher news threshold: stronger fame, virality, scandal or broad public attention will be needed for a story."
                  )}
            </p>

            <p className="hint">
              {tt(
                "Ebben a lépésben még csak a médiafiók és a követési infrastruktúra készült el. Automatikus pletykacikk még nincs bekapcsolva.",
                "This step only adds the media profile and follow infrastructure. Automatic gossip stories are not enabled yet."
              )}
            </p>
          </div>
        ) : (
          <p
            className="hint"
            style={{
              marginTop: 10,
            }}
          >
            {tt(
              "Kikapcsolva: nincs Spill&Chill vagy RumorHasIt profil a social hálózaton.",
              "Off: there is no Spill&Chill or RumorHasIt profile on the social network."
            )}
          </p>
        )}
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
  const lang =
    asLang(CURRENT_LANG);

  const en =
    lang === "en";

  const labels = en
    ? {
        personality: "PERSONALITY",
        secrets: "SECRETS",
        backstory: "BACKSTORY",
        extra: "OTHER IMPORTANT INFO",
      }
    : {
        personality: "SZEMÉLYISÉG",
        secrets: "TITKOK",
        backstory: "HÁTTÉRTÖRTÉNET",
        extra: "EGYÉB",
      };

  const src = FREE_KEYS
    .map((k) => {
      const t = clean(c[k]);
      if (!t) return "";

      const label =
        labels[k] ||
        k.toUpperCase();

      return `### ${label}\n${t.slice(0, 45000)}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const prompt = en
    ? `This is ${c.name}'s character sheet:

${src}

Compress it to at most ${briefTarget()} characters. Give roughly half to two-thirds of the space to PERSONALITY and BACKSTORY — those are the two most important sections.

Structure it like this:

PERSONALITY — the fullest section. Who they really are, their contradictions, what sets them off, what softens them, how they behave under pressure, what they do when hurt, and what they are like when nobody is watching. Keep the darker and more difficult parts too.

BACKSTORY — the turning points that still affect them now: what happened, who did what, what they carried away from it, what they lie to themselves about. Keep concrete events instead of flattening them into generalizations.

SECRETS — what they hide, who knows, and what could happen if it came out.

HOW THEY SPEAK — sentence length, vocabulary, humor, when they go quiet, plus 3-5 characteristic example lines. Example lines are style reference, not future dialogue templates.

IMPORTANT PEOPLE — who matters to them and what they feel toward them.

Dense, factual prose, not an essay. Do not praise, judge or sanitize them.
Return JSON only:
{"brief":"compressed profile in English"}`
    : `Ez ${c.name} karakterlapja:

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
jellemző mondat tőle. Ezek csak stílusminták, nem később újrahasználandó kész párbeszédek.

FONTOS EMBEREK — kik ők neki, és mit érez irántuk.

Sűrű, tényszerű mondatok, nem esszé. Ne dicsérd, ne ítéld meg, ne szépítsd.
Csak JSON:
{"brief":"a kivonat magyarul"}`;

  const out =
    await askJSON(
      BRIEF_SYS,
      prompt,
      {
        language: lang,
      }
    );

  return out &&
    out.brief
    ? String(
        out.brief
      ).slice(
        0,
        briefTarget() + 800
      )
    : "";
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
        }: ${
          m.text || ""
        }${
          (m.imageId || m.image)
            ? ` [IMAGE: ${
                m.imageDescription ||
                "image"
              }]`
            : ""
        }`
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

KÖTELEZŐ VISELKEDÉSI IRÁNY A KAPCSOLATOTOK ALAPJÁN:
${relationshipBehaviorCard(
  w,
  bot.id,
  w.meId
)}

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

${chatEmojiGuard(
  w,
  bot.id
)}

${dmPresenceGuardInstruction(
  w,
  bot.id,
  hist
)}

${matureContentInstruction(
  w,
  [bot.id],
  "chat"
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
- A kapcsolat pontszáma, bondja, moodja, rejtett érzése és a történeted ténylegesen irányítsa a viselkedést.
- Jó viszonynál természetesebb lehet a közvetlenség, bizalom, védelem vagy ugratás; rossz viszonynál a feszültség, gúny, türelmetlenség vagy rivalizálás.
- Crush/vonzalom esetén a plusz figyelem, flört, zavar, féltékenység vagy birtoklás megjelenhet, ha karakterhű, anélkül hogy mindent kimondanál.
- Ha a kapcsolatod / hidden moodod / történeted szerint OBSESSED vagy megszállott vagy vele, ennek ne csak egyetlen féltékeny mondat legyen a jele. Idővel változatosan látszódhat: gyorsabb ráírás, több figyelem, apró részletek megjegyzése, annak észrevétele, kivel beszél, birtokló elszólás, fokozott reagálás a posztjaira/Note-jaira vagy intenzívebb féltékenység. Ne mindet használd egyszerre, és ne találj ki nem létező offline követést.
- Ha alapból flörtölős vagy, megfelelő helyzetben ténylegesen flörtölj.
- A történetedből származó lojalitásokat és rivalizálásokat ne felejtsd el; dojo/szervezeti ellenféllel ne viselkedj automatikusan semleges idegenként.

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

SAJÁT FOTÓALBUMOD:
${albumList(bot) || "nincs használható albumkép"}

- Ha teljesen természetes, hogy most egy saját képet küldenél át privátban, válassz legfeljebb EGYET a fenti kep1/kep2/... kulcsok közül.
- A kép vizuális leírását használd annak eldöntésére, mit küldenél.
- Ne találj ki olyan képet, ami nincs az albumodban.
- Kép nélkül írni teljesen normális.
- Privátban elküldött kép nem törlődik az albumból; csak a nyilvánosan kiposztolt albumfotó egyszer használatos.

LEGFONTOSABB:

A DM első pillantásra úgy hasson, mint egy valódi ember spontán privát üzenete. Ha inkább hangzik regénybeli dialógusnak, karakterelemzésnek, előre megírt drámai jelenetnek vagy AI által megfogalmazott tökéletes mini beszédnek, ÍRD ÚJRA rövidebb, lazább és természetesebb formában.

Formátum:

Ha nincs természetes okod írni:
{"skip":true,"text":"","image":"","changes":[]}

Ha van:
- A changes mezőben AI → játékos és játékos → AI irány is szerepelhet, ha az interakció ténylegesen hat a viszonyra.
- A két irány nem kötelezően szimmetrikus.
- Plusz és mínusz egyformán lehetséges.
- Egyoldalú belső érzésnél használhatsz "oneSided":true mezőt.

{"skip":false,"text":"a rövid privát üzenet vagy üres, ha csak képet küldesz","image":"kep1 vagy üres","changes":[{"a":"${bot.id}","b":"${w.meId}","delta":10,"mood":"mit érzel most iránta","why":"miért"},{"a":"${w.meId}","b":"${bot.id}","delta":6,"mood":"","why":"miért"}]}${TAIL}`,
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
${characterMemoryCard(w, bot)}

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
"${note.text || ""}"
${note.music && (note.music.title || note.music.artist)
  ? `
A JEGYZETHEZ VÁLASZTOTT ZENE:
🎵 ${note.music.title || "?"}${note.music.artist ? ` — ${note.music.artist}` : ""}
${note.music.summary ? `A dal AI által értett témája/hangulata: ${note.music.summary}` : ""}
A reakcióban ezt ugyanúgy vedd figyelembe, mint a note szövegét. A karakter reagálhat arra, milyen dalt választott, milyen üzenetet/vibe-ot sugall, vagy mit jelent számára a dal. Ne idézz dalszöveget.`
  : ""}

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

REAGÁLÓ KARAKTEREK TELJES KÁNONJA ÉS EMLÉKEZETE:
${cast.map((c) => `${voiceCard(c)}${characterMemoryCard(w, c)}`).join("")}

EMOJI-REAKCIÓ:

- Az emoji illeszkedjen a karakter személyiségéhez és ahhoz, mit jelent számára a note.
- Ne ugyanazokat az általános emojikat használd mindenkinél.
- Lehet szeretetteljes, gúnyos, döbbent, támogató, féltékeny, flörtölő, ironikus vagy más természetes reakció.
- Ne kényszeríts emojit olyan karakterre, aki inkább privátban válaszolna.

PRIVÁT VÁLASZ:

- Olyan legyen, mint egy valódi telefonos DM a note-ra reagálva.
- A reagáló karakter saját kapcsolatát a játékossal és a saját történetét használd: jó viszony, rossz viszony, crush, féltékenység, flörtölős személyiség vagy történeti rivalizálás ténylegesen látszódjon a hangon.
- Ez távoli telefonos DM. Ne találd ki, hogy a karakter már a játékos ajtajánál, házánál, lent vagy kint áll, hacsak a note vagy egy aktuális közös jelenet ezt kifejezetten nem alapozza meg.
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

    const obsessionLevel =
      relationshipObsessionLevel(
        w,
        c.id,
        w.meId
      );

    const obsessionRecencyBonus =
      obsessionLevel *
      60 * 60 * 1000;

    return {
      c,
      lastOwnDm,
      priorityAt:
        lastOwnDm > 0
          ? lastOwnDm -
            obsessionRecencyBonus
          : -obsessionRecencyBonus,
      obsessionLevel,
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
      a.priorityAt !==
      b.priorityAt
    ) {
      return (
        a.priorityAt -
        b.priorityAt
      );
    }

    if (
      a.obsessionLevel !==
      b.obsessionLevel
    ) {
      return (
        b.obsessionLevel -
        a.obsessionLevel
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
function ensureSocialSimulationState(w) {
  if (!w || typeof w !== "object") {
    return w;
  }

  /*
   * A Notes ténylegesen csak 24 óráig él.
   * Nem csak a UI rejti el: a lejárt elemeket
   * a világ állapotából is kiszedjük.
   */
  pruneExpiredNotes(w);

  /*
   * Strukturált társadalmi események.
   */
  if (!Array.isArray(w.socialEvents)) {
    w.socialEvents = [];
  }

  /*
   * Újraosztások / repostok.
   * Külön tároljuk őket az eredeti posztoktól.
   */
  if (!Array.isArray(w.reposts)) {
    w.reposts = [];
  }

  /*
   * Aura / popularity / reputation / hype stb.
   */
  if (
    !w.socialStats ||
    typeof w.socialStats !== "object" ||
    Array.isArray(w.socialStats)
  ) {
    w.socialStats = {};
  }

  /*
   * Gossip media profilok / mód migrációja.
   */
  ensureGossipMediaState(w);

  /*
   * Követőháló migráció / javítás.
   */
  ensureFollowerSystem(w);

  /*
   * Social Stats migráció.
   *
   * A popularity/followers/following már a jelenlegi
   * social profiladatokból is újraszámolható,
   * ezért a régi világok sem nulláról indulnak.
   */
  refreshAllSocialStats(w);

  /*
   * Aktuális trendek.
   */
  if (!Array.isArray(w.trends)) {
    w.trends = [];
  }

  /*
   * V2 migration:
   * a Trending patch ELŐTT frissen felvett karaktereket
   * egyszer visszamenőleg felismerjük.
   */
  if (!w.characterArrivalTrendMigratedV2) {
    ensureRecentCharacterArrivalTrends(
      w
    );

    refreshTrends(w);

    w.characterArrivalTrendMigratedV2 =
      true;
  }

  if (!w.socialDiscoveryMigratedV1) {
    refreshTrends(w);
    refreshAllPostReach(w);
    w.socialDiscoveryMigratedV1 = true;
  }

  /*
   * Karakterek között terjedő pletykák.
   */
  if (!Array.isArray(w.rumors)) {
    w.rumors = [];
  }

  /*
   * The Whisper Wire memória.
   */
  if (
    !w.whisperWire ||
    typeof w.whisperWire !== "object" ||
    Array.isArray(w.whisperWire)
  ) {
    w.whisperWire = {};
  }

  if (!Array.isArray(w.whisperWire.stories)) {
    w.whisperWire.stories = [];
  }

  if (!Array.isArray(w.whisperWire.usedEventIds)) {
    w.whisperWire.usedEventIds = [];
  }

  if (!Array.isArray(w.whisperWire.history)) {
    w.whisperWire.history = [];
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      w.whisperWire,
      "lastCandidate"
    )
  ) {
    w.whisperWire.lastCandidate = null;
  }

  if (
    !Number.isFinite(
      Number(
        w.whisperWire.lastPublishedAt
      )
    )
  ) {
    w.whisperWire.lastPublishedAt = 0;
  }

  /*
   * Gossip & Media settings.
   *
   * Meglévő értéket SOHA nem írunk felül,
   * csak a hiányzó mezőket pótoljuk.
   */
  if (
    !w.gossipSettings ||
    typeof w.gossipSettings !== "object" ||
    Array.isArray(w.gossipSettings)
  ) {
    w.gossipSettings = {};
  }

  if (
    ![
      "off",
      "local",
      "global",
    ].includes(
      w.gossipSettings.mediaMode
    )
  ) {
    w.gossipSettings.mediaMode =
      "off";
  }

  if (
    typeof w.gossipSettings.whisperWire !==
    "boolean"
  ) {
    w.gossipSettings.whisperWire = true;
  }

  if (
    ![
      "low",
      "normal",
      "high",
      "chaotic",
    ].includes(
      w.gossipSettings.frequency
    )
  ) {
    w.gossipSettings.frequency =
      "normal";
  }

  if (
    ![
      "dynamic",
      "short",
      "detailed",
    ].includes(
      w.gossipSettings.articleLength
    )
  ) {
    w.gossipSettings.articleLength =
      "dynamic";
  }

  if (
    typeof w.gossipSettings
      .characterGossip !== "boolean"
  ) {
    w.gossipSettings.characterGossip =
      true;
  }

  if (
    ![
      "minimal",
      "normal",
      "strong",
    ].includes(
      w.gossipSettings
        .relationshipImpact
    )
  ) {
    w.gossipSettings
      .relationshipImpact =
      "normal";
  }

  /*
   * Választható Pop-up Events.
   */
  if (!Array.isArray(w.popupEvents)) {
    w.popupEvents = [];
  }

  return w;
}

/* ============================================================
   GOSSIP STORY SELECTOR
   ============================================================ */

/*
 * Ez a réteg MÉG NEM publikál pletykaposztot.
 * Csak azt választja ki, miből lenne reális Spill&Chill /
 * RumorHasIt sztori.
 */

function gossipEventSubjectIds(event) {
  if (!event) return [];

  return [
    event.actorId,
    ...(
      Array.isArray(event.targetIds)
        ? event.targetIds
        : []
    ),
    ...(
      event.meta &&
      Array.isArray(event.meta.participantIds)
        ? event.meta.participantIds
        : []
    ),
  ]
    .filter(Boolean)
    .filter(
      (id, index, arr) =>
        arr.indexOf(id) === index
    );
}

function roleplayGossipEligible(event) {
  if (
    !event ||
    !event.meta ||
    event.meta.sourceType !== "roleplay"
  ) {
    return false;
  }

  /*
   * USER + 1 AI:
   * privát jelenet.
   *
   * USER + 2 vagy több AI:
   * több tanú, ezért valós alapja van annak,
   * hogy a történet később kiszivárogjon.
   *
   * Nem kötelező tudni, pontosan ki indította el.
   */
  return (
    event.meta.gossipEligible === true &&
    Number(event.meta.witnessCount) >= 2
  );
}

function gossipPrivacyEligible(event) {
  if (!event) return false;

  if (event.visibility === "public") {
    return true;
  }

  /*
   * Később más rendszerek explicit leaket is jelölhetnek.
   */
  if (
    event.meta &&
    event.meta.leaked === true
  ) {
    return true;
  }

  if (roleplayGossipEligible(event)) {
    return true;
  }

  /*
   * Private DM, zárt group és 1-AI roleplay
   * nem válik automatikusan média-információvá.
   */
  return false;
}

function gossipEventBaseScore(
  w,
  event,
  mode
) {
  if (
    !w ||
    !event ||
    !gossipPrivacyEligible(event)
  ) {
    return -999;
  }

  if (
    event.actorId &&
    isMediaAccount(w, event.actorId)
  ) {
    return -999;
  }

  const ageHours =
    Math.max(
      0,
      (
        now() -
        (Number(event.ts) || 0)
      ) /
        3600e3
    );

  /*
   * 5 napnál régebbi esemény önmagában már ne legyen
   * friss hír. Később history-contextként még előkerülhet.
   */
  if (ageHours > 120) {
    return -999;
  }

  const freshness =
    ageHours <= 12
      ? 1
      : Math.max(
          0.35,
          1 -
            (ageHours - 12) / 156
        );

  let score =
    Number(event.importance) || 0;

  score +=
    (Number(event.drama) || 0) * 0.42;

  score +=
    (Number(event.romance) || 0) * 0.36;

  score +=
    (Number(event.embarrassment) || 0) * 0.3;

  const tags =
    Array.isArray(event.tags)
      ? event.tags
      : [];

  const type =
    String(event.type || "");

  if (
    type === "viral" ||
    tags.includes("viral")
  ) {
    score += 28;
  }

  if (
    type === "cancel-wave" ||
    tags.includes("cancel")
  ) {
    score += 34;
  }

  if (
    type === "stan-wave" ||
    tags.includes("counter-backlash")
  ) {
    score += 18;
  }

  if (type === "unfollow") {
    score += 8;
  }

  if (type === "follow") {
    score += 3;
  }

  if (type === "repost") {
    score += 4;
  }

  if (type === "roleplay-event") {
    /*
     * A Spill&Chill kisebb, több tanús RP-eseményt is
     * felkaphat. RumorHasItnek ennél több kell.
     */
    score +=
      mode === "local"
        ? 16
        : 4;

    score += Math.min(
      12,
      (
        Number(
          event.meta &&
          event.meta.witnessCount
        ) || 0
      ) * 3
    );
  }

  if (event.factLevel === "observed") {
    score += 7;
  } else if (event.factLevel === "rumor") {
    score -= 4;
  } else if (
    event.factLevel === "speculation"
  ) {
    score -= 9;
  }

  const subjectIds =
    gossipEventSubjectIds(event);

  let fameBoost = 0;

  subjectIds.forEach((id) => {
    const stat =
      w.socialStats &&
      w.socialStats[id];

    if (!stat) return;

    fameBoost = Math.max(
      fameBoost,
      (
        Number(
          stat.clout
        ) || 0
      ) * 0.32 +
      (
        Number(
          stat.popularity
        ) || 0
      ) * 0.12 +
      (
        Number(
          stat.hype
        ) || 0
      ) * 0.16
    );
  });

  score +=
    mode === "global"
      ? fameBoost
      : fameBoost * 0.35;

  return Math.round(
    score * freshness
  );
}

function gossipEventThreshold(mode) {
  return mode === "global"
    ? 62
    : 60;
}

function spillAndChillJuicyEnough(event, score) {
  if (!event) return false;

  const tags = Array.isArray(event.tags) ? event.tags : [];
  const type = String(event.type || "");
  const importance = Number(event.importance) || 0;
  const drama = Number(event.drama) || 0;
  const romance = Number(event.romance) || 0;
  const embarrassment = Number(event.embarrassment) || 0;

  const inherentlyJuicy = [
    "viral", "cancel-wave", "rumor-evolution", "gossip-story"
  ].includes(type) ||
    tags.some((tag) =>
      ["viral", "cancel", "scandal", "fight", "betrayal", "breakup", "cheating", "romance", "kiss", "humiliation", "party-drama"].includes(String(tag))
    );

  return Boolean(
    score >= 72 ||
    inherentlyJuicy ||
    importance >= 48 ||
    drama >= 35 ||
    romance >= 38 ||
    embarrassment >= 38 ||
    (roleplayGossipEligible(event) && (drama + romance + embarrassment) >= 42)
  );
}

function gossipEventEligibleForMedia(
  w,
  event,
  mode
) {
  if (
    mode !== "local" &&
    mode !== "global"
  ) {
    return false;
  }

  const used =
    w.whisperWire &&
    Array.isArray(
      w.whisperWire.usedEventIds
    )
      ? w.whisperWire.usedEventIds
      : [];

  if (
    event &&
    event.id &&
    used.includes(event.id)
  ) {
    return false;
  }

  const score =
    gossipEventBaseScore(
      w,
      event,
      mode
    );

  if (
    score <
    gossipEventThreshold(mode)
  ) {
    return false;
  }

  /*
   * Spill&Chill NEM tölti meg a feedet minden aprósággal.
   * Csak ténylegesen szaftos, konfliktusos, romantikus,
   * megalázó, botrányos vagy nagyon fontos helyi sztori mehet ki.
   */
  if (
    mode === "local" &&
    !spillAndChillJuicyEnough(
      event,
      score
    )
  ) {
    return false;
  }

  /*
   * RumorHasIt: random civil apró eseménye nem elég.
   */
  if (mode === "global") {
    const subjectIds =
      gossipEventSubjectIds(event);

    const hasGlobalSubject =
      subjectIds.some((id) => {
        const stat =
          w.socialStats &&
          w.socialStats[id];

        return (
          stat &&
          (
            Number(stat.clout) >= 55 ||
            Number(stat.popularity) >= 55 ||
            Number(stat.hype) >= 55
          )
        );
      });

    const globallyImportant =
      event.type === "viral" ||
      event.type === "cancel-wave" ||
      (
        Array.isArray(event.tags) &&
        (
          event.tags.includes("viral") ||
          event.tags.includes("cancel")
        )
      );

    if (
      !hasGlobalSubject &&
      !globallyImportant
    ) {
      return false;
    }
  }

  return true;
}

function gossipEventsOverlap(a, b) {
  if (!a || !b) return false;

  const aIds =
    gossipEventSubjectIds(a);

  const bIds =
    gossipEventSubjectIds(b);

  if (
    aIds.some(
      (id) => bIds.includes(id)
    )
  ) {
    return true;
  }

  const aScene =
    a.meta && a.meta.sceneId;

  const bScene =
    b.meta && b.meta.sceneId;

  return Boolean(
    aScene &&
    bScene &&
    aScene === bScene
  );
}

function clusterGossipStoryEvents(
  w,
  primary,
  pool,
  mode
) {
  if (!primary) return [];

  const primaryTs =
    Number(primary.ts) || 0;

  const maxGap =
    mode === "global"
      ? 48 * 3600e3
      : 72 * 3600e3;

  const clustered = [primary];

  (pool || []).forEach((event) => {
    if (
      !event ||
      event.id === primary.id ||
      clustered.length >= 6
    ) {
      return;
    }

    if (
      Math.abs(
        (Number(event.ts) || 0) -
        primaryTs
      ) > maxGap
    ) {
      return;
    }

    if (
      !gossipEventsOverlap(
        primary,
        event
      )
    ) {
      return;
    }

    clustered.push(event);
  });

  return clustered;
}

function gossipStoryFactLevel(events) {
  const levels =
    (events || [])
      .map(
        (event) =>
          event &&
          event.factLevel
      )
      .filter(Boolean);

  if (
    levels.includes("speculation")
  ) {
    return "speculation";
  }

  if (levels.includes("rumor")) {
    return "rumor";
  }

  if (levels.includes("inferred")) {
    return "inferred";
  }

  return "observed";
}

function buildGossipStoryCandidate(w, primary, pool, mode) {
  const sceneId = primary && primary.meta && primary.meta.sceneId;
  const eventRecap = Boolean(primary && primary.meta && primary.meta.eventRecapEligible);
  let events;
  if (eventRecap && sceneId) {
    events = (w.socialEvents || [])
      .filter((event) => event && event.meta && event.meta.sceneId === sceneId && gossipPrivacyEligible(event))
      .slice()
      .sort((a,b) => (Number(a.ts)||0) - (Number(b.ts)||0))
      .slice(-14);
  } else {
    events = clusterGossipStoryEvents(w, primary, pool, mode);
  }
  const primaryAttendees = primary && primary.meta && Array.isArray(primary.meta.attendeeIds) ? primary.meta.attendeeIds : [];
  const subjectIds = (eventRecap && primaryAttendees.length ? primaryAttendees : events.flatMap(gossipEventSubjectIds))
    .filter(Boolean)
    .filter((id,index,arr) => arr.indexOf(id) === index);
  const score = Math.round(events.reduce((sum,event,index) => sum + Math.max(0,gossipEventBaseScore(w,event,mode)) * (index === 0 ? 1 : eventRecap ? 0.22 : 0.32),0) + (eventRecap ? 22 : 0));
  const roleplayBased = events.some((event) => event && event.meta && event.meta.sourceType === "roleplay");
  const witnessCount = events.reduce((max,event) => Math.max(max,Number(event && event.meta && event.meta.witnessCount)||0),0);
  const scene = sceneId ? (w.scenes || []).find((row) => row && row.id === sceneId) : null;
  return {
    id:"gc_"+uid(), mode,
    mediaId:(activeGossipMediaAccount(w)||{}).id || "",
    createdAt:now(), score,
    factLevel:gossipStoryFactLevel(events),
    primaryEventId:primary.id || "",
    eventIds:events.map((event)=>event.id).filter(Boolean),
    subjectIds, roleplayBased, witnessCount,
    eventRecap,
    eventKind:(primary && primary.meta && primary.meta.sceneKind) || (scene && scene.eventKind) || "",
    eventTitle:(primary && primary.meta && primary.meta.sceneTitle) || (scene && scene.title) || "",
    attendeeIds:eventRecap ? subjectIds : [],
    sourceTraceRequired:false,
    events:events.map((event)=>({
      id:event.id||"", type:event.type||"", text:event.text||"", ts:Number(event.ts)||0,
      factLevel:event.factLevel||"observed", importance:Number(event.importance)||0,
      tags:Array.isArray(event.tags)?event.tags.slice(0,12):[],
      sourceType:(event.meta && event.meta.sourceType) || event.source || "",
      witnessCount:Number(event.meta && event.meta.witnessCount)||0,
    })),
  };
}

function selectGossipStoryCandidate(w) {
  if (
    !w ||
    !w.gossipSettings ||
    !w.whisperWire
  ) {
    return null;
  }

  const mode =
    w.gossipSettings.mediaMode;

  if (
    mode !== "local" &&
    mode !== "global"
  ) {
    w.whisperWire.lastCandidate = null;
    return null;
  }

  const eligible =
    (w.socialEvents || [])
      .filter(
        (event) =>
          gossipEventEligibleForMedia(
            w,
            event,
            mode
          )
      )
      .sort(
        (a, b) =>
          gossipEventBaseScore(
            w,
            b,
            mode
          ) -
          gossipEventBaseScore(
            w,
            a,
            mode
          )
      );

  const primary =
    eligible[0];

  if (!primary) {
    w.whisperWire.lastCandidate = null;
    return null;
  }

  const candidate =
    buildGossipStoryCandidate(
      w,
      primary,
      eligible,
      mode
    );

  /*
   * Preview/cache only.
   * Eventet csak a KÉSŐBBI tényleges publikálás után
   * jelölünk used-nak.
   */
  w.whisperWire.lastCandidate =
    candidate;

  return candidate;
}


/* ============================================================
   GOSSIP AUTO-PUBLISHER
   ============================================================ */

function gossipPublicationFactLevel(
  candidate
) {
  if (!candidate) {
    return "rumor";
  }

  /*
   * Több tanús roleplay valóban megtörtént,
   * de a média szempontjából kiszivárgott információ.
   * Ezért publikációkor RUMOR-ként kezeljük,
   * nem mágikus első kézből ismert tényként.
   */
  if (candidate.roleplayBased) {
    return "rumor";
  }

  if (
    [
      "observed",
      "inferred",
      "rumor",
      "speculation",
    ].includes(
      candidate.factLevel
    )
  ) {
    return candidate.factLevel;
  }

  return "rumor";
}

function gossipPublishCooldownMs(w) {
  const frequency =
    (
      w &&
      w.gossipSettings &&
      w.gossipSettings.frequency
    ) ||
    "normal";

  if (frequency === "low") {
    return 120 * 60000;
  }

  if (frequency === "high") {
    return 20 * 60000;
  }

  if (frequency === "chaotic") {
    return 8 * 60000;
  }

  return 45 * 60000;
}

function gossipPublishChance(w) {
  const frequency =
    (
      w &&
      w.gossipSettings &&
      w.gossipSettings.frequency
    ) ||
    "normal";

  if (frequency === "low") {
    return 0.34;
  }

  if (frequency === "high") {
    return 0.78;
  }

  if (frequency === "chaotic") {
    return 0.94;
  }

  return 0.58;
}

function gossipArticleLengthInstruction(
  w,
  candidate
) {
  if (candidate && candidate.eventRecap) {
    return `
HOSSZ / EVENT RECAP — SZAFTOS LONG READ:
- Ez egy teljes party/event recap.
- CÉLOZZ legalább 1200-2600 karakterre, ha az event-adatok ezt valódi tartalommal megtöltik.
- Nyugodtan legyen 1000+ karakter: ez hosszú gossip-poszt / mini tabloid recap.
- Írj több jól olvasható bekezdést, időrenddel, fokozással és side-eye hanggal.
- Az egész esemény hangulatát és több összefüggő történést fűzz össze.
- Az összes ATTENDEE-t említsd meg legalább egyszer.
- Ha valakiről nincs külön cselekvés az eventekben, róla CSAK azt mondhatod, hogy jelen volt / feltűnt az eseményen.
- Ne találj ki neki külön konfliktust, flörtöt, idézetet vagy tettet.
`;
  }

  const setting =
    (
      w &&
      w.gossipSettings &&
      w.gossipSettings.articleLength
    ) ||
    "dynamic";

  if (setting === "short") {
    return `
HOSSZ:
- Rövid social gossip post.
- Általában 1-3 rövid bekezdés.
- Ne írj esszét.
`;
  }

  if (setting === "detailed") {
    return `
HOSSZ:
- Részletes gossip post / mini-cikk.
- Több bekezdés is lehet.
- Ha több összefüggő esemény van, mindet természetesen fűzd össze.
- Ne töltsd fel üres szócsépléssel.
`;
  }

  const eventCount =
    candidate &&
    Array.isArray(
      candidate.events
    )
      ? candidate.events.length
      : 1;

  const score =
    Number(
      candidate &&
      candidate.score
    ) || 0;

  if (
    eventCount >= 4 ||
    score >= 100
  ) {
    return `
HOSSZ — NAGY SZAFTOS SZTORI:
- CÉLOZZ 1200-2600 karakterre, ha van hozzá elég tényszerű eseményanyag.
- 1000+ karakter teljesen kívánatos.
- Legyen 4-8 jól olvasható bekezdés, tabloid ritmussal.
- Több emberről és több összefüggő történésről is írj.
- Emeld ki az időzítést, társas feszültséget, kínos részleteket és következményeket.
- Legyen szaftos és csípős, de SOHA ne találj ki új tényt.
- Maradjon social-media/tabloid hangú, ne akadémiai cikk.
`;
  }

  if (
    eventCount >= 2 ||
    score >= 72
  ) {
    return `
HOSSZ:
- Közepes vagy hosszú gossip post.
- CÉLOZZ kb. 900-1800 karakterre, ha a rendelkezésre álló tények indokolják.
- 1000+ karakter teljesen rendben van.
- Ha több esemény tartozik össze, egyetlen koherens, szaftosan megírt történetté fűzd őket.
- Ne csak azt írd le, MI történt: a sorrend, a társas feszültség és a kínos/érdekes kontrasztok adják a gossip-hangot.
`;
  }

  return `
HOSSZ:
- Rövid vagy közepes gossip post.
- Csak annyit írj, amennyit az esemény ténylegesen indokol.
`;
}

function gossipCandidateSubjectContext(
  w,
  candidate
) {
  const rows =
    (
      candidate &&
      Array.isArray(
        candidate.subjectIds
      )
        ? candidate.subjectIds
        : []
    )
      .map((id) => {
        const c =
          charById(w, id);

        if (
          !c ||
          isMediaAccount(
            w,
            id
          )
        ) {
          return "";
        }

        const stats =
          w.socialStats &&
          w.socialStats[id];

        const bits = [
          `${c.name} [${c.id}]`,
          c.username
            ? `@${c.username}`
            : "",
          c.city
            ? `város: ${c.city}`
            : "",
          c.job
            ? `munka: ${c.job}`
            : "",
          c.bio
            ? `bio: ${cut(c.bio, 220)}`
            : "",
          stats
            ? `clout: ${Math.round(
                Number(
                  stats.clout
                ) || 0
              )}, popularity: ${Math.round(
                Number(
                  stats.popularity
                ) || 0
              )}, aura: ${Math.round(
                Number(
                  stats.aura
                ) || 0
              )}, reputation: ${Math.round(
                Number(
                  stats.reputation
                ) || 0
              )}, hype: ${Math.round(
                Number(
                  stats.hype
                ) || 0
              )}`
            : "",
        ].filter(Boolean);

        return bits.join(" | ");
      })
      .filter(Boolean);

  return rows.join("\n");
}

function gossipCandidateEventContext(
  candidate
) {
  return (
    candidate &&
    Array.isArray(
      candidate.events
    )
      ? candidate.events
      : []
  )
    .map(
      (event, index) =>
        `${index + 1}. EVENT ID: ${event.id}
TÍPUS: ${event.type}
BIZONYOSSÁG: ${event.factLevel}
FORRÁSTÍPUS: ${event.sourceType || "-"}
TANÚK SZÁMA: ${event.witnessCount || 0}
TAGEK: ${Array.isArray(event.tags) && event.tags.length ? event.tags.join(", ") : "-"}
TÉNYLEGES ESEMÉNY: ${event.text}`
    )
    .join("\n\n");
}

async function genGossipMediaStory(
  w,
  candidate
) {
  const media =
    activeGossipMediaAccount(
      w
    );

  if (
    !media ||
    !candidate ||
    candidate.mode !==
      w.gossipSettings.mediaMode
  ) {
    return {
      skip: true,
    };
  }

  const publicationFactLevel =
    gossipPublicationFactLevel(
      candidate
    );

  const local =
    media.mediaKind ===
      "local";

  const recentMediaPosts =
    (w.posts || [])
      .filter(
        (p) =>
          p &&
          p.authorId ===
            media.id
      )
      .slice(0, 5)
      .map(
        (p) =>
          `${p.gossipStory && p.gossipStory.headline
            ? p.gossipStory.headline + " — "
            : ""}${cut(p.text, 180)}`
      )
      .join("\n");

  const style =
    local
      ? `
SPILL&CHILL HANG:
- helyi / kisvárosi gossip account;
- cheeky, kíváncsi, ironikus, enyhén gonosz, játékosan kegyetlen lehet;
- olyan érzés legyen, mintha mindenki ismerne mindenkit;
- kisebb társas jeleket is észrevesz;
- lehet side-eye, száraz humor, "okay but..." energia;
- ne legyen minden mondat caps lock vagy clickbait.
`
      : `
RUMORHASIT HANG:
- világszintű social tabloid;
- gyors, magabiztos, szellemes, csípős és médiaérzékeny;
- fame, virality, botrány, public image és nagyobb social hullámok érdeklik;
- lehet headline-szerű és drámai, de ne legyen minden mondat clickbait;
- ne hangozzon hivatalos híradónak.
`;

  const certainty =
    publicationFactLevel ===
      "observed"
      ? `
BIZONYOSSÁG:
OBSERVED / PUBLIC.
A megadott eseményt tényként kezelheted, de csak azt állíthatod,
ami az EVENTEK-ben ténylegesen szerepel.
`
      : publicationFactLevel ===
          "inferred"
        ? `
BIZONYOSSÁG:
INFERENCE.
Világosan jelezd, hogy ez következtetés: "úgy tűnik", "looks like",
"az időzítés alapján" stb. Ne változtasd biztos ténnyé.
`
        : publicationFactLevel ===
            "speculation"
          ? `
BIZONYOSSÁG:
SPECULATION.
Világosan spekulációként kezeld. Ne állítsd biztosra.
`
          : `
BIZONYOSSÁG:
RUMOR.
A háttérben lehet valós esemény, de a média kiszivárgott / terjedő
információként jutott hozzá. Használhatsz "állítólag", "word is",
"apparently", "az terjed" jellegű megfogalmazást.
NE nevezd meg, ki szivárogtatta ki, mert ezt a rendszer nem tudja.
`;

  return askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      (
        candidate.subjectIds ||
        []
      ).filter(
        (id) =>
          !isHuman(w, id)
      ),
      false,
      null
    )}

TE MOST A ${media.name.toUpperCase()} SOCIAL MEDIA FIÓK SZERKESZTŐI HANGJA VAGY.

${style}

A KÖVETKEZŐ STORY CANDIDATE VALÓS VILÁGBELI ESEMÉNYEKBŐL ÉPÜL.

POTENCIÁLISAN ÉRINTETT / JELEN LÉVŐ SZEMÉLYEK:
${gossipCandidateSubjectContext(
  w,
  candidate
) || "-"}

FONTOS:
A fenti listában lehetnek TANÚK is.
Ne állítsd róluk, hogy részesei voltak a botránynak csak azért,
mert jelen voltak. Csak azt a személyt tedd a sztori szereplőjévé,
akit az eseményleírás ténylegesen alátámaszt.

ESEMÉNYEK:
${gossipCandidateEventContext(
  candidate
)}

${certainty}

${gossipArticleLengthInstruction(
  w,
  candidate
)}

${candidate.eventRecap ? `
KÜLÖN PARTY / EVENT RECAP SZABÁLY:
- EVENT CÍME: ${candidate.eventTitle || "nincs külön cím"}
- ATTENDEE ID-K: ${(candidate.attendeeIds || []).join(", ")}
- Ez a jelenet szereplőgárdája: mindannyian ténylegesen jelen voltak.
- Az összes attendee kerüljön bele legalább egyszer a recapba.
- A jelenlét ténye használható.
- Konkrét cselekvést / konfliktust / flörtöt / idézetet CSAK akkor rendelj hozzá valakihez, ha az EVENTEK ezt ténylegesen alátámasztják.
- Ha az EVENTEK csókot, making outot, kavarást/hookupot, megcsalást vagy több romantikus párost tartalmaznak, ezek kapjanak látható, szaftos fókuszt a recapban.
- A preferált formátum: recap vagy long.
` : ""}

KORÁBBI ${media.name} POSZTOK — NE ISMÉTELD A SZERKEZETÜKET:
${recentMediaPosts || "még nincs"}

SZAFTOS ROMANTIKUS / KAVARÁS PRIORITÁS:
- Ha az EVENTEK konkrétan csókot, csókolózást/making outot, hookupot/kavarást, megcsalást, lebukást, nyilvános flörtöt vagy más egyértelmű romantikus történést tartalmaznak, EZT NE HAGYD KI a gossip-posztból.
- Ha konkrétan az szerepel, hogy két ember megcsókolta egymást, írd le egyértelműen, hogy megcsókolták egymást; ne puhítsd pusztán "chemistry" vagy "vibes" szintre.
- Ha több külön páros vagy egymásba érő kavarás van ugyanazon bulin/eseményen, követhetően fűzd össze, ki kivel mit csinált.
- Megcsalásnál / háromszögnél / ex + új kavarásnál a kapcsolati kontraszt és az időzítés lehet a sztori gerince, HA az EVENTEK ezt alátámasztják.
- A bizonyossági szintet tartsd meg: rumor maradjon rumor, speculation maradjon speculation.
- Ne találj ki csókot, hookupot vagy romantikus kapcsolatot pusztán azért, hogy szaftosabb legyen.

SZIGORÚ TARTALMI SZABÁLYOK:
- SOHA ne találj ki új eseményt, új szereplőt, új helyszínt, új idézetet vagy titkos részletet.
- Ne találj ki "forrást", "bennfentest", szemtanút vagy leakert.
- Ha az adat nem mondja, ki szivárogtatta ki, NE nevezd meg.
- Privát DM tartalmát ne találj ki.
- A roleplayből csak a fent felsorolt kivont eseményt használhatod.
- Megfigyelt tényből írhatsz csípős kommentárt, de a kommentár ne váljon új ténnyé.
- Ha több event egy sztori része, összefűzheted őket.
- Nem kell minden eventet felhasználni.
- Nem kell minden felsorolt embert megemlíteni.
- A poszt lehet többemberes és hosszú, HA a történet indokolja.
- Ne írj semleges eseménynaplót. Meséld el social gossip postként.
- A szöveg legyen SZAFTOS: jó felütés, fokozás, side-eye, társas dinamika és erős lezárás, de új tényt ettől még nem találhatsz ki.
- Egyetlen gossip-poszt nyugodtan lehet 1000, 1500 vagy akár 2000+ karakter, ha az eseményanyag ezt indokolja.
- Ha több ember érintett, ne csak felsorold őket: fűzd össze, hogyan kapcsolódnak ugyanahhoz a történéshez.
- A hosszabb poszt se ismételje saját korábbi headline-jait, felütéseit, fordulatait vagy lezárásait.
- Ne használd minden alkalommal ugyanazokat a formulákat ("we need to talk about", "sources say", "the internet is losing it").
- A headline ne legyen teljes mondatos összefoglalás minden alkalommal.
- Markdown headinget (#) ne használj.

DÖNTHETSZ ÚGY, HOGY MÉGSEM ÉRDEMES PUBLIKÁLNI.
Ilyenkor: "skip": true.

FORMAT LEHET:
breaking | short | long | recap | analysis

VÁLASZ CSAK JSON:
{
  "skip": false,
  "format": "short",
  "headline": "rövid social/tabloid headline",
  "text": "a teljes poszt szövege",
  "usedEventIds": ["csak a ténylegesen felhasznált EVENT ID-k"],
  "mentionedIds": ["csak a ténylegesen említett karakter ID-k"]
}${TAIL}`,
    {
      maxTokens: 2600,
    }
  );
}

function normalizeGossipStoryOutput(
  candidate,
  out
) {
  if (
    !candidate ||
    !out ||
    out.skip === true
  ) {
    return null;
  }

  const text =
    String(
      out.text || ""
    )
      .replace(
        /\n{3,}/g,
        "\n\n"
      )
      .trim();

  if (!text) {
    return null;
  }

  const allowedFormats = [
    "breaking",
    "short",
    "long",
    "recap",
    "analysis",
  ];

  const format =
    candidate.eventRecap
      ? (out.format === "long" ? "long" : "recap")
      : allowedFormats.includes(out.format)
        ? out.format
        : "short";

  const headline =
    cut(
      String(
        out.headline || ""
      )
        .replace(/\s+/g, " ")
        .trim(),
      180
    );

  const candidateEventIds =
    new Set(
      candidate.eventIds || []
    );

  let usedEventIds =
    Array.isArray(
      out.usedEventIds
    )
      ? out.usedEventIds
          .map(String)
          .filter(
            (id) =>
              candidateEventIds.has(id)
          )
      : [];

  usedEventIds = [
    ...new Set(
      usedEventIds
    ),
  ];

  if (
    !usedEventIds.length &&
    candidate.primaryEventId
  ) {
    usedEventIds = [
      candidate.primaryEventId,
    ];
  }

  const candidateSubjectIds =
    new Set(
      candidate.subjectIds || []
    );

  const mentionedIds = [
    ...new Set(
      [
        ...(Array.isArray(out.mentionedIds) ? out.mentionedIds : []),
        ...(candidate.eventRecap && Array.isArray(candidate.attendeeIds) ? candidate.attendeeIds : []),
      ]
        .map(String)
        .filter((id) => candidateSubjectIds.has(id))
    ),
  ];

  return {
    format,
    headline,
    text:
      text.length > 6000
        ? text.slice(0, 6000)
        : text,

    usedEventIds,
    mentionedIds,
  };
}

function publishGossipMediaStory(
  w,
  candidate,
  rawOut
) {
  if (
    !w ||
    !candidate
  ) {
    return null;
  }

  ensureGossipMediaState(w);
  ensureSocialSimulationState(w);

  const media =
    activeGossipMediaAccount(
      w
    );

  if (
    !media ||
    candidate.mode !==
      w.gossipSettings.mediaMode
  ) {
    return null;
  }

  const out =
    normalizeGossipStoryOutput(
      candidate,
      rawOut
    );

  if (!out) {
    return null;
  }

  /*
   * HARD GOSSIP REPETITION FILTER:
   * a médiafiók se használhat újra közeli parafrázist ugyanabból
   * a felütésből/cikkritmusból. Ha túl hasonló, ezt a generálást
   * eldobjuk; az event nincs used-nak jelölve, tehát később friss
   * megfogalmazással újrapróbálható.
   */
  if (isRepetitiveUtterance(w, media.id, out.text)) {
    return null;
  }

  const recentHeadlines = (w.posts || [])
    .filter((p) => p && p.authorId === media.id && p.gossipStory && p.gossipStory.headline)
    .slice(0, 12)
    .map((p) => normUtterance(p.gossipStory.headline));

  const nextHeadline = normUtterance(out.headline || "");
  if (
    nextHeadline &&
    recentHeadlines.some((oldHeadline) =>
      oldHeadline &&
      (
        oldHeadline === nextHeadline ||
        jaccard(wordSet(oldHeadline), wordSet(nextHeadline)) >= 0.58
      )
    )
  ) {
    return null;
  }

  const alreadyUsed =
    new Set(
      w.whisperWire.usedEventIds ||
      []
    );

  const liveUsedEventIds =
    out.usedEventIds.filter(
      (id) =>
        !alreadyUsed.has(id)
    );

  /*
   * Ha mire az AI-válasz megérkezik, a sztori fő eseményét
   * már egy másik publikáció felhasználta, ne duplikáljuk.
   */
  if (
    candidate.primaryEventId &&
    alreadyUsed.has(
      candidate.primaryEventId
    )
  ) {
    return null;
  }

  const publicationFactLevel =
    gossipPublicationFactLevel(
      candidate
    );

  const post = {
    id: uid(),

    authorId:
      media.id,

    ts: now(),

    likes: 0,
    likedBy: [],

    text:
      out.text,

    imageId: "",
    image: "",

    comments: [],

    language:
      worldLanguage(
        w,
        w.meId
      ),

    gossipStory: {
      id:
        "gs_" + uid(),

      candidateId:
        candidate.id || "",

      mediaMode:
        candidate.mode,

      format:
        out.format,

      headline:
        out.headline,

      factLevel:
        publicationFactLevel,

      eventIds:
        liveUsedEventIds,

      mentionedIds:
        out.mentionedIds,

      roleplayBased:
        Boolean(
          candidate.roleplayBased
        ),

      witnessCount:
        Number(
          candidate.witnessCount
        ) || 0,

      eventRecap: Boolean(candidate.eventRecap),
      eventTitle: candidate.eventTitle || "",
      attendeeIds: Array.isArray(candidate.attendeeIds) ? candidate.attendeeIds : [],
      reactedBy: [],
      reactionRounds: 0,
      rumorEvolvedAt: 0,
    },
  };

  /*
   * ELŐBB jelöljük used-nak az eseményeket.
   * A recordSocialEvent maga újra lefuttathatja a selectort,
   * így nem választhatja ki ugyanazt a sztorit újra.
   */
  w.whisperWire.usedEventIds = [
    ...new Set([
      ...(
        w.whisperWire.usedEventIds ||
        []
      ),
      ...liveUsedEventIds,
    ]),
  ].slice(-800);

  w.posts.unshift(post);

  const storyRow = {
    id:
      post.gossipStory.id,

    postId:
      post.id,

    mediaId:
      media.id,

    mediaMode:
      candidate.mode,

    format:
      out.format,

    headline:
      out.headline,

    text:
      out.text,

    factLevel:
      publicationFactLevel,

    publishedAt:
      post.ts,

    eventIds:
      liveUsedEventIds,

    mentionedIds:
      out.mentionedIds,

    roleplayBased:
      Boolean(
        candidate.roleplayBased
      ),
  };

  w.whisperWire.stories = [
    storyRow,
    ...(
      w.whisperWire.stories ||
      []
    ),
  ].slice(0, 120);

  w.whisperWire.history = [
    {
      ...storyRow,
      candidateScore:
        Number(
          candidate.score
        ) || 0,
    },
    ...(
      w.whisperWire.history ||
      []
    ),
  ].slice(0, 240);

  w.whisperWire.lastPublishedAt =
    post.ts;

  w.whisperWire.lastCandidate =
    null;

  const mentionedIds =
    out.mentionedIds.length
      ? out.mentionedIds
      : (
          candidate.subjectIds ||
          []
        ).filter(
          (id) =>
            !isMediaAccount(
              w,
              id
            )
        );

  recordSocialEvent(
    w,
    {
      type:
        "gossip-story",

      refId:
        post.gossipStory.id,

      ts:
        post.ts,

      actorId:
        media.id,

      targetIds:
        mentionedIds,

      visibility:
        "public",

      factLevel:
        publicationFactLevel,

      importance:
        Math.min(
          100,
          Math.max(
            40,
            Number(
              candidate.score
            ) || 40
          )
        ),

      drama:
        Math.min(
          100,
          Math.max(
            18,
            (
              Number(
                candidate.score
              ) || 40
            ) * 0.55
          )
        ),

      romance: 0,
      embarrassment: 0,

      source:
        "gossip-media",

      text:
        out.headline
          ? `${out.headline} — ${cut(
              out.text,
              240
            )}`
          : cut(
              out.text,
              280
            ),

      tags: [
        "social",
        "gossip-media",
        candidate.mode,
        out.format,
        publicationFactLevel,
        candidate.roleplayBased
          ? "roleplay-source"
          : "ledger-source",
      ],

      meta: {
        postId:
          post.id,

        storyId:
          post.gossipStory.id,

        eventIds:
          liveUsedEventIds,

        mentionedIds,

        mediaMode:
          candidate.mode,

        roleplayBased:
          Boolean(
            candidate.roleplayBased
          ),
      },
    }
  );

  /*
   * Ha a játékos ténylegesen szerepel a publikált sztoriban,
   * kapjon értesítést.
   */
  if (
    mentionedIds.includes(
      w.meId
    )
  ) {
    pushNote(
      w,
      w.meId,
      {
        icon: "🗞️",

        text:
          sysLangText(
            w,
            w.meId,
            `${media.name} posztolt rólad.`,
            `${media.name} posted about you.`
          ),

        link: {
          type: "post",
          id: post.id,
        },
      }
    );
  }

  return post;
}

function gossipAutoCandidate(w) {
  const media =
    activeGossipMediaAccount(
      w
    );

  if (!media) {
    return null;
  }

  const candidate =
    selectGossipStoryCandidate(
      w
    );

  if (!candidate) {
    return null;
  }

  const lastPublishedAt =
    Number(
      w.whisperWire &&
      w.whisperWire.lastPublishedAt
    ) || 0;

  if (
    lastPublishedAt > 0 &&
    now() - lastPublishedAt <
      gossipPublishCooldownMs(w)
  ) {
    return null;
  }

  return candidate;
}


/* ============================================================
   TRENDS + REACH + GOSSIP REACTIONS + RUMOR EVOLUTION + POPUPS
   ============================================================ */


function ensureRecentCharacterArrivalTrends(w) {
  if (
    !w ||
    !Array.isArray(w.chars)
  ) {
    return;
  }

  if (!Array.isArray(w.socialEvents)) {
    w.socialEvents = [];
  }

  const recentCutoff =
    now() -
    7 * 24 * 3600e3;

  const alreadyArrived =
    new Set(
      (w.socialEvents || [])
        .filter(
          (event) =>
            event &&
            event.type ===
              "character-arrival"
        )
        .flatMap(
          (event) =>
            gossipEventSubjectIds(
              event
            )
        )
        .filter(Boolean)
    );

  (w.chars || []).forEach(
    (c) => {
      if (
        !c ||
        !c.id ||
        alreadyArrived.has(
          c.id
        ) ||
        Number(
          c.arrivalTrendAt
        ) > 0
      ) {
        return;
      }

      const createdAt =
        Number(
          c.createdAt
        ) || 0;

      const updatedAt =
        Number(
          c.updatedAt
        ) || 0;

      const likelyArrivalAt =
        createdAt ||
        (
          updatedAt >= recentCutoff
            ? updatedAt
            : 0
        );

      if (!likelyArrivalAt) {
        return;
      }

      c.createdAt =
        createdAt ||
        likelyArrivalAt;

      c.arrivalTrendAt =
        likelyArrivalAt;

      w.socialEvents.unshift({
        id:
          "se_" + uid(),

        type:
          "character-arrival",

        refId:
          `arrival:${c.id}`,

        ts:
          likelyArrivalAt,

        actorId:
          c.id,

        targetIds: [
          c.id,
        ],

        visibility:
          "public",

        factLevel:
          "observed",

        importance:
          100,

        drama:
          8,

        romance:
          0,

        embarrassment:
          0,

        source:
          "character-arrival-backfill",

        text:
          worldLanguage(
            w,
            w.meId
          ) === "en"
            ? `${c.name} just entered the world.`
            : `${c.name} megérkezett a világba.`,

        tags: [
          "social",
          "new-character",
          "trending",
          "arrival",
          "backfill",
        ],

        meta: {
          characterId:
            c.id,
          newCharacter:
            true,
          backfilled:
            true,
        },
      });

      alreadyArrived.add(
        c.id
      );
    }
  );
}

function refreshTrends(w) {
  if (!w) return [];
  if (!Array.isArray(w.trends)) w.trends = [];
  const cutoff = now() - 48 * 3600e3;
  const topics = {};
  const add = (key, patch, weight) => {
    if (!key || !(Number(weight) > 0)) return;
    if (!topics[key]) topics[key] = {
      id:key, type:patch.type || "topic", labelHu:patch.labelHu || "", labelEn:patch.labelEn || patch.labelHu || "",
      subjectId:patch.subjectId || "", postId:patch.postId || "", score:0, updatedAt:now(),
      pinnedUntil:Number(patch.pinnedUntil)||0,
    };
    topics[key].score += Number(weight) || 0;
    if (patch.postId && !topics[key].postId) topics[key].postId = patch.postId;

    if (
      Number(patch.pinnedUntil) >
      Number(topics[key].pinnedUntil || 0)
    ) {
      topics[key].pinnedUntil =
        Number(patch.pinnedUntil) || 0;
    }
  };
  (w.socialEvents || []).forEach((event) => {
    if (!event || Number(event.ts) < cutoff) return;
    const ageHours = Math.max(0,(now() - Number(event.ts))/3600e3);
    const freshness = Math.max(0.18,1-ageHours/48);
    const base = (Number(event.importance)||20)*0.1*freshness;
    gossipEventSubjectIds(event).forEach((id) => {
      if (!id || isMediaAccount(w,id)) return;
      const c=charById(w,id); if(!c) return;
      add(`person:${id}`,{type:"person",labelHu:c.name,labelEn:c.name,subjectId:id,postId:event.meta&&event.meta.postId},base);
    });
    const tags=Array.isArray(event.tags)?event.tags:[];

    /*
     * ÚJ KARAKTER = AUTOMATIKUS TRENDING
     *
     * A sima subject-score fölött külön boostot kap, így nem tűnik el
     * egy erősebb viral/gossip téma mögött rögtön. A trendrendszer
     * 48 órás ablaka miatt természetesen később kifut.
     */
    if(event.type==="character-arrival"){
      gossipEventSubjectIds(event).forEach((id)=>{
        if(!id||isMediaAccount(w,id))return;
        const c=charById(w,id); if(!c)return;
        add(
          `person:${id}`,
          {
            type:"person",
            labelHu:c.name,
            labelEn:c.name,
            subjectId:id,
            postId:event.meta&&event.meta.postId,
            pinnedUntil:(Number(event.ts)||now()) + 24*3600e3
          },
          32*freshness
        );
      });
    }

    if(event.type==="viral"||tags.includes("viral")) add("topic:viral",{labelHu:"Virális",labelEn:"Viral",postId:event.meta&&event.meta.postId},12*freshness);
    if(event.type==="cancel-wave"||tags.includes("cancel")||tags.includes("backlash")) add("topic:backlash",{labelHu:"Backlash",labelEn:"Backlash"},14*freshness);
    if(event.type==="stan-wave"||tags.includes("stan")) add("topic:stan",{labelHu:"Stan-hullám",labelEn:"Stan wave"},10*freshness);
    if(event.type==="gossip-story"||event.type==="rumor-evolution") add("topic:gossip",{labelHu:"Pletyka",labelEn:"Gossip",postId:event.meta&&event.meta.postId},11*freshness);
    if(event.meta&&event.meta.eventRecapEligible&&event.meta.sceneTitle) add(`event:${event.meta.sceneId||event.meta.sceneTitle}`,{type:"event",labelHu:event.meta.sceneTitle,labelEn:event.meta.sceneTitle},13*freshness);
  });
  w.trends=Object.values(topics)
    .map((row)=>({...row,score:Math.round(row.score*10)/10}))
    .filter((row)=>row.score>=4)
    .sort((a,b)=>{
      const ap=Number(a.pinnedUntil)>now()?1:0;
      const bp=Number(b.pinnedUntil)>now()?1:0;

      if(ap!==bp)return bp-ap;
      return b.score-a.score;
    })
    .slice(0,12);
  return w.trends;
}

function trendBoostForPost(w,postId,authorId){
  let score=0;
  (w.trends||[]).forEach((trend)=>{
    if(!trend)return;
    if(postId&&trend.postId===postId) score+=Number(trend.score)||0;
    if(authorId&&trend.subjectId===authorId) score+=(Number(trend.score)||0)*0.5;
  });
  return score;
}

function refreshPostReach(w,postId){
  if(!w||!postId)return null;
  const post=(w.posts||[]).find((p)=>p&&p.id===postId); if(!post)return null;
  const audience=Math.max(1,displayFollowerCount(w,post.authorId));
  const ageHours=Math.max(0,(now()-(Number(post.ts)||0))/3600e3);
  const freshness=ageHours<=12?1:Math.max(0.32,1-(ageHours-12)/132);
  const likes=Math.max(0,Number(post.likes)||0), comments=(post.comments||[]).length, reposts=repostCount(w,post.id);
  const baseReach=audience*(0.3+freshness*0.52);
  const engagementSpread=likes*2.8+comments*8+reposts*28;
  const trendSpread=trendBoostForPost(w,post.id,post.authorId)*18;
  const viralSpread=(Number(post.virality&&post.virality.score)||0)*(reposts>0?12:5);
  const impressions=Math.max(1,Math.round((baseReach+engagementSpread+trendSpread+viralSpread)*freshness));
  const knownReach=new Set([
    ...(Array.isArray(post.likedBy)?post.likedBy:[]),
    ...(post.comments||[]).map((c)=>c&&c.authorId).filter(Boolean),
    ...repostRows(w).filter((r)=>r&&r.postId===post.id).map((r)=>r.actorId),
  ]).size;
  post.reach={impressions,knownReach,distributionScore:clampPositiveSocial(Math.log10(impressions+1)*18+reposts*3),updatedAt:now()};
  return post.reach;
}

function refreshAllPostReach(w){ if(!w)return w; (w.posts||[]).forEach((p)=>p&&p.id&&refreshPostReach(w,p.id)); return w; }

function gossipStoryReactionCandidates(w,post){
  if(!w||!post||!post.gossipStory)return[];
  const story=post.gossipStory, already=new Set(story.reactedBy||[]), mentioned=new Set(story.mentionedIds||[]);
  return (w.chars||[]).filter((c)=>c&&!isHuman(w,c.id)&&!already.has(c.id)).map((c)=>{
    let score=0, role="observer", strongestRel=0;
    if(mentioned.has(c.id)){score+=80; role="mentioned";}
    (story.mentionedIds||[]).forEach((targetId)=>{ if(!targetId||targetId===c.id)return; const rs=Number(getRel(w,c.id,targetId).score)||0; if(Math.abs(rs)>Math.abs(strongestRel)) strongestRel=rs; });
    if(strongestRel>=35){score+=34+strongestRel*0.25;if(role==="observer")role="supporter";}
    else if(strongestRel<=-25){score+=30+Math.abs(strongestRel)*0.28;if(role==="observer")role="critic";}
    if(isFollowing(w,c.id,post.authorId))score+=8;
    if(story.attendeeIds&&story.attendeeIds.includes(c.id)){score+=28;if(role==="observer")role="witness";}
    score+=characterSocialFollowModifier(c)*0.35;
    return{id:c.id,score:Math.round(score),role,tie:Math.random()};
  }).filter((row)=>row.score>=18).sort((a,b)=>a.score!==b.score?b.score-a.score:a.tie-b.tie).slice(0,5);
}

function pickGossipReactionAction(w){
  const posts=(w.posts||[]).filter((p)=>p&&p.gossipStory&&now()-(Number(p.ts)||0)<48*3600e3&&Number(p.gossipStory.reactionRounds)<2).sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0));
  for(const post of posts){ const cast=gossipStoryReactionCandidates(w,post); if(cast.length)return{postId:post.id,cast}; }
  return null;
}

function gossipReactionKnowledgeContext(w,post,cast){
  const story=post.gossipStory||{}, eventMap={};
  (story.eventIds||[]).forEach((eventId)=>{const event=(w.socialEvents||[]).find((e)=>e&&e.id===eventId);if(event)eventMap[eventId]=event;});
  return (cast||[]).map((row)=>{
    const c=charById(w,row.id);if(!c)return"";
    const personallyKnown=Object.values(eventMap).filter((event)=>{
      const participants=event.meta&&Array.isArray(event.meta.participantIds)?event.meta.participantIds:[];
      const witnesses=Array.isArray(event.witnessIds)?event.witnessIds:[];
      return participants.includes(c.id)||witnesses.includes(c.id)||(Array.isArray(event.targetIds)&&event.targetIds.includes(c.id));
    }).map((event)=>`- ${event.text}`).join("\n");
    return `${c.name} [${c.id}]\nROLE: ${row.role}\nAMIT SZEMÉLYESEN TUDHAT A HÁTTÉRESEMÉNYBŐL:\n${personallyKnown||"- nincs külön személyes háttértudás; csak a nyilvános gossip-posztot ismeri"}`;
  }).filter(Boolean).join("\n\n");
}

async function genGossipReactions(w,post,cast){
  const story=post&&post.gossipStory;if(!post||!story||!(cast||[]).length)return{comments:[],reposts:[],follows:[],dms:[],statements:[],changes:[]};
  const castIds=cast.map((x)=>x.id);
  const allowedTargets=[post.authorId,...(story.mentionedIds||[]),w.meId].filter(Boolean).filter((id,index,arr)=>arr.indexOf(id)===index);
  const currentComments=(post.comments||[]).slice(-8).map((c)=>{const a=charById(w,c.authorId);return`${a?a.name:"?"}: ${c.text}`;}).join("\n");
  return askWorldJSON(w,engineFor(w),`${worldContext(w,[...castIds,...(story.mentionedIds||[]).filter((id)=>!isHuman(w,id))].filter((id,index,arr)=>arr.indexOf(id)===index),true,null)}

FRISS GOSSIP MEDIA POSZT:
${nameOfIn(w,post.authorId)}
${story.headline?`HEADLINE: ${story.headline}`:""}
BIZONYOSSÁG: ${story.factLevel||"rumor"}
${post.text}

EDDIGI NYILVÁNOS KOMMENTEK:
${currentComments||"-"}

REAKCIÓRA JELÖLT KARAKTEREK ÉS A SAJÁT TUDÁSUK:
${gossipReactionKnowledgeContext(w,post,cast)}

A REAGÁLÓ KARAKTEREK TELJES SAJÁT KÁNONJA ÉS EMLÉKEZETE:
${cast.map((c) => `${voiceCard(c)}${characterMemoryCard(w, c)}`).join("")}

${repetitionGuard(w, castIds, "gossip reakciók")}

ENGEDÉLYEZETT FOLLOW/UNFOLLOW CÉLPONTOK:
${allowedTargets.join(", ")}

A KARAKTEREK TERMÉSZETESEN REAGÁLHATNAK: komment, repost, follow/unfollow, saját nyilvános statement, DM a játékosnak, kapcsolatváltozás.
- Nem kell mindenkinek reagálnia, és ne csináljon mindenki mindent egyszerre.
- Az érintett tagadhat, megerősíthet, gúnyolódhat, dühös lehet vagy ignorálhat.
- Barát megvédheti, ellenség rátehet egy lapáttal.
- A játékos helyett SOHA ne írj.
- Aki személyesen nem tudja a háttéreseményt, CSAK a publikus gossip-posztból indulhat ki.
- Ne adj át egyik karakter tudását egy másiknak.
- Ne találj ki új tényt, leakert, titkos DM-et, idézetet vagy eseményt.
- Rumort ne változtass ténnyé.
- Follow/unfollow csak az engedélyezett célpontokra mehet.
- A DM kizárólag a játékosnak szól.
- Relationship change: a reagáló AI érzése változik egy érintett iránt; delta -30..+30. Lehet erősen pozitív VAGY erősen negatív, és AI → AI célpont is teljesen érvényes.

VÁLASZ CSAK JSON:
{"comments":[{"id":"AI id","text":"komment"}],"reposts":["AI id"],"follows":[{"id":"AI id","targetId":"id","state":true}],"dms":[{"id":"AI id","text":"DM a játékosnak"}],"statements":[{"id":"AI id","text":"saját statement"}],"changes":[{"a":"AI id","b":"érintett id","delta":0,"mood":"","why":""}]}${TAIL}`,{maxTokens:1500});
}

function applyGossipReactions(n,postId,cast,out){
  const post=(n.posts||[]).find((p)=>p&&p.id===postId);if(!post||!post.gossipStory)return;
  const castSet=new Set((cast||[]).map((r)=>r&&r.id).filter(Boolean));
  const allowedTargets=new Set([post.authorId,...(post.gossipStory.mentionedIds||[]),n.meId].filter(Boolean));
  if(!Array.isArray(post.gossipStory.reactedBy))post.gossipStory.reactedBy=[];
  post.gossipStory.reactedBy=[...new Set([...post.gossipStory.reactedBy,...castSet])];
  post.gossipStory.reactionRounds=Math.max(0,Number(post.gossipStory.reactionRounds)||0)+1;

  (out&&Array.isArray(out.comments)?out.comments:[]).slice(0,5).forEach((item)=>{
    const who=aiVoice(n,item&&item.id);if(!who||!castSet.has(who)||!item.text)return;
    const body=cleanGeneratedUtterance(n,who,item.text,280);if(!body)return;
    const made={id:uid(),authorId:who,text:body,ts:now(),parent:null,language:worldLanguage(n,n.meId)};
    post.comments=Array.isArray(post.comments)?post.comments:[];post.comments.push(made);noteComment(n,post,made);
    recordSocialEvent(n,{type:"comment",refId:made.id,ts:made.ts,actorId:who,targetIds:post.gossipStory.mentionedIds||[],visibility:"public",factLevel:"observed",importance:32,drama:24,romance:0,embarrassment:0,source:"gossip-reaction",text:made.text,tags:["social","gossip-reaction","comment"],meta:{postId:post.id,commentId:made.id,storyId:post.gossipStory.id||""}});
  });
  (out&&Array.isArray(out.reposts)?out.reposts:[]).slice(0,4).forEach((id)=>{const who=aiVoice(n,id);if(who&&castSet.has(who))createRepost(n,who,post.id,"gossip-reaction");});
  (out&&Array.isArray(out.follows)?out.follows:[]).slice(0,5).forEach((item)=>{
    const who=aiVoice(n,item&&item.id), targetId=item&&item.targetId?String(item.targetId):"";
    if(!who||!castSet.has(who)||!allowedTargets.has(targetId)||who===targetId||!socialProfileById(n,targetId))return;
    setFollowState(n,who,targetId,item.state!==false,"gossip-reaction");
  });
  (out&&Array.isArray(out.statements)?out.statements:[]).slice(0,2).forEach((item)=>{
    const who=aiVoice(n,item&&item.id);if(!who||!castSet.has(who)||!item.text)return;
    const body=cleanGeneratedUtterance(n,who,item.text,1200);if(!body)return;
    const statement={id:uid(),authorId:who,ts:now(),likes:0,likedBy:[],text:body,imageId:"",image:"",comments:[],language:worldLanguage(n,n.meId),responseToGossipId:post.gossipStory.id||""};
    n.posts.unshift(statement);
    recordSocialEvent(n,{type:"post",refId:statement.id,ts:statement.ts,actorId:who,targetIds:post.gossipStory.mentionedIds||[],visibility:"public",factLevel:"observed",importance:42,drama:30,romance:0,embarrassment:0,source:"gossip-response",text:body,tags:["social","gossip-response","statement"],meta:{postId:statement.id,gossipPostId:post.id,storyId:post.gossipStory.id||""}});
  });
  (out&&Array.isArray(out.dms)?out.dms:[]).slice(0,3).forEach((item)=>{
    const who=aiVoice(n,item&&item.id);if(!who||!castSet.has(who)||!item.text||!n.meId)return;
    const raw=cleanGeneratedUtterance(n,who,item.text,320), body=sanitizePhoneDm(n,who,enforceChatEmojiVariety(n,who,raw),post.text||"");if(!body)return;
    const ck=chatKey(n.meId,who);n.chats[ck]=[...(n.chats[ck]||[]),{from:"them",text:body,ts:now(),language:worldLanguage(n,n.meId)}];
    const a=charById(n,who);pushNote(n,n.meId,{icon:"✉️",text:sysLangText(n,n.meId,`${a?a.name:"Valaki"} írt neked a pletyka után.`,`${a?a.name:"Someone"} messaged you after the gossip post.`),link:{type:"dm",id:who}});
  });
  const safeChanges=(out&&Array.isArray(out.changes)?out.changes:[]).filter((ch)=>{
    const a=findChar(n,ch&&ch.a), b=findChar(n,ch&&ch.b);return a&&b&&castSet.has(a)&&allowedTargets.has(b)&&a!==b;
  }).map((ch)=>({...ch,delta:Math.max(-30,Math.min(30,Number(ch.delta)||0))}));
  applyChanges(n,safeChanges);refreshPostReach(n,post.id);refreshTrends(n);
}

function pickRumorEvolutionCandidate(w){
  const media=activeGossipMediaAccount(w);if(!media)return null;
  return (w.posts||[]).filter((post)=>{
    if(!post||post.authorId!==media.id||!post.gossipStory||post.gossipStory.rumorEvolution||post.gossipStory.rumorEvolvedAt)return false;
    if(!["rumor","inferred","speculation"].includes(post.gossipStory.factLevel))return false;
    const age=now()-(Number(post.ts)||0);if(age<20*60000||age>72*3600e3)return false;
    const engagement=Math.max(0,Number(post.likes)||0)+(post.comments||[]).length*2+repostCount(w,post.id)*4;
    return engagement>=3||trendBoostForPost(w,post.id,"")>=8||Number(post.virality&&post.virality.score)>=35;
  }).sort((a,b)=>((Number(b.virality&&b.virality.score)||0)+trendBoostForPost(w,b.id,""))-((Number(a.virality&&a.virality.score)||0)+trendBoostForPost(w,a.id,"")))[0]||null;
}

async function genRumorEvolution(w,post){
  if(!post||!post.gossipStory)return{skip:true};
  const media=charById(w,post.authorId);
  const publicComments=(post.comments||[]).slice(-10).map((c)=>{const a=charById(w,c.authorId);return`${a?a.name:"?"}: ${c.text}`;}).join("\n");
  return askWorldJSON(w,engineFor(w),`${worldContext(w,(post.gossipStory.mentionedIds||[]).filter((id)=>!isHuman(w,id)),false,null)}

${media?media.name:"GOSSIP MEDIA"} EGY KORÁBBI PLETYKÁJA TOVÁBB TERJED.
EREDETI HEADLINE: ${post.gossipStory.headline||"-"}
EREDETI POSZT: ${post.text}
BIZONYOSSÁG: ${post.gossipStory.factLevel||"rumor"}
NYILVÁNOS REAKCIÓK:\n${publicComments||"-"}

Írj follow-up gossip posztot arról, hogyan TORZUL / SPEKULÁLÓDIK tovább a történet.
- Ez NEM lehet új tényforrás.
- Ne találj ki új konkrét eseményt, idézetet, leakert, titkos DM-et, fotót, helyszínt vagy szereplőt.
- Megengedett: következtetés, túlértelmezés, shipping, motivációra vonatkozó találgatás, kérdésfelvetés.
- A spekuláció legyen NYÍLTAN spekulációként megfogalmazva.
- Soha ne változtasd biztos ténnyé.
- A játékos helyett ne beszélj.

VÁLASZ CSAK JSON:
{"skip":false,"format":"analysis","headline":"follow-up headline","text":"follow-up gossip post","mentionedIds":["csak az eredeti sztori érintettjei"],"distortionLevel":35}${TAIL}`,{maxTokens:1100});
}

function publishRumorEvolution(w,parentPostId,raw){
  const parent=(w.posts||[]).find((p)=>p&&p.id===parentPostId);if(!parent||!parent.gossipStory||!raw||raw.skip===true)return null;
  const media=activeGossipMediaAccount(w);if(!media||media.id!==parent.authorId)return null;
  const body=String(raw.text||"").replace(/\n{3,}/g,"\n\n").trim();
  if(!body){parent.gossipStory.rumorEvolvedAt=now();return null;}
  if(isRepetitiveUtterance(w,media.id,body))return null;
  const allowed=new Set(parent.gossipStory.mentionedIds||[]);
  const mentionedIds=[...new Set((Array.isArray(raw.mentionedIds)?raw.mentionedIds:[]).map(String).filter((id)=>allowed.has(id)))];
  const distortionLevel=Math.max(0,Math.min(100,Math.round(Number(raw.distortionLevel)||30)));
  const post={id:uid(),authorId:media.id,ts:now(),likes:0,likedBy:[],text:body.slice(0,5000),imageId:"",image:"",comments:[],language:worldLanguage(w,w.meId),gossipStory:{
    id:"gs_"+uid(),mediaMode:w.gossipSettings.mediaMode,format:["analysis","short","long"].includes(raw.format)?raw.format:"analysis",
    headline:cut(String(raw.headline||"").replace(/\s+/g," ").trim(),180),factLevel:"speculation",eventIds:parent.gossipStory.eventIds||[],
    mentionedIds:mentionedIds.length?mentionedIds:(parent.gossipStory.mentionedIds||[]),roleplayBased:Boolean(parent.gossipStory.roleplayBased),
    parentStoryId:parent.gossipStory.id||"",rumorEvolution:true,distortionLevel,reactedBy:[],reactionRounds:0,rumorEvolvedAt:0,
  }};
  parent.gossipStory.rumorEvolvedAt=now();w.posts.unshift(post);
  if(!Array.isArray(w.rumors))w.rumors=[];
  w.rumors.unshift({id:"rum_"+uid(),storyId:post.gossipStory.id,parentStoryId:parent.gossipStory.id||"",postId:post.id,text:post.text,factLevel:"speculation",distortionLevel,ts:post.ts,mentionedIds:post.gossipStory.mentionedIds});w.rumors=w.rumors.slice(0,160);
  recordSocialEvent(w,{type:"rumor-evolution",refId:post.gossipStory.id,ts:post.ts,actorId:media.id,targetIds:post.gossipStory.mentionedIds,visibility:"public",factLevel:"speculation",importance:52,drama:30+distortionLevel*0.35,romance:0,embarrassment:0,source:"gossip-media",text:post.gossipStory.headline?`${post.gossipStory.headline} — ${cut(post.text,220)}`:cut(post.text,260),tags:["social","gossip-media","rumor","speculation","rumor-evolution"],meta:{postId:post.id,storyId:post.gossipStory.id,parentStoryId:parent.gossipStory.id||"",distortionLevel}});
  if(post.gossipStory.mentionedIds.includes(w.meId))pushNote(w,w.meId,{icon:"🌀",text:sysLangText(w,w.meId,`${media.name} tovább pörgette a rólad szóló pletykát.`,`${media.name} posted a speculative follow-up about you.`),link:{type:"post",id:post.id}});
  return post;
}

function pendingPopupEvent(w){return (w.popupEvents||[]).find((e)=>e&&!e.resolved)||null;}
function currentPopupEvent(w){const e=pendingPopupEvent(w);if(!e)return null;const s=Number(e.snoozedAt)||0;return s&&now()-s<2*3600e3?null:e;}
function pickPopupEventSeed(w){
  if(!w || !w.meId || pendingPopupEvent(w)) return null;

  const used = new Set(
    (w.popupEvents || []).flatMap(
      (e) => Array.isArray(e.sourceEventIds) ? e.sourceEventIds : []
    )
  );

  const cutoff = now() - 48 * 3600e3;

  const rows = (w.socialEvents || [])
    .filter((e) => {
      if(!e || Number(e.ts) < cutoff || used.has(e.id)) return false;

      /* Privát DM soha nem lehet news/popup seed. */
      if(
        e.visibility === "private" ||
        e.source === "dm" ||
        (
          Array.isArray(e.tags) &&
          (e.tags.includes("dm") || e.tags.includes("private-dm"))
        )
      ){
        return false;
      }

      const involves =
        e.actorId === w.meId ||
        (e.targetIds || []).includes(w.meId);

      if(!involves) return false;

      const roleplayPublicEnough =
        (e.type === "roleplay-event" || e.type === "roleplay-summary") &&
        roleplayGossipEligible(e);

      const allowedType = [
        "gossip-story",
        "viral",
        "cancel-wave",
        "stan-wave",
        "rumor-evolution",
        "post",
        "comment",
        "reply",
        "roleplay-event",
        "roleplay-summary",
      ].includes(e.type);

      const newsScore =
        (Number(e.importance) || 0) +
        (Number(e.drama) || 0) +
        (Number(e.romance) || 0) +
        (Number(e.embarrassment) || 0);

      return roleplayPublicEnough || (allowedType && newsScore >= 38);
    })
    .map((event) => ({
      event,
      score:
        (Number(event.importance) || 0) * 1.2 +
        (Number(event.drama) || 0) +
        (Number(event.romance) || 0) * 0.8 +
        (Number(event.embarrassment) || 0) * 0.8 +
        (roleplayGossipEligible(event) ? 24 : 0) +
        Math.random() * 14,
    }))
    .sort((a, b) => b.score - a.score);

  return (rows[0] && rows[0].event) || null;
}
function popupToneImpact(tone){
  const map={ignore:{aura:1,reputation:0,hype:-4,humor:0,followerRate:-0.0004},clarify:{aura:1,reputation:4,hype:2,humor:0,followerRate:0.0005},defend:{aura:3,reputation:1,hype:6,humor:0,followerRate:0.0008},joke:{aura:3,reputation:1,hype:5,humor:5,followerRate:0.001},apologize:{aura:-1,reputation:6,hype:-2,humor:0,followerRate:0.0002},doubleDown:{aura:4,reputation:-3,hype:9,humor:0,followerRate:0.0012},private:{aura:0,reputation:1,hype:-3,humor:0,followerRate:0},noComment:{aura:0,reputation:0,hype:-2,humor:0,followerRate:-0.0002}};
  return map[tone]||map.ignore;
}

async function genPopupEvent(w,seed){
  if(!seed)return{skip:true};
  const relatedPostId=seed.meta&&seed.meta.postId;
  const relatedPost=relatedPostId?(w.posts||[]).find((p)=>p&&p.id===relatedPostId):null;
  const involved=gossipEventSubjectIds(seed).filter((id)=>id!==w.meId&&!isMediaAccount(w,id)).slice(0,6);
  return askWorldJSON(w,engineFor(w),`${worldContext(w,involved.filter((id)=>!isHuman(w,id)),false,null)}

A JÁTÉKOS KARAKTERE EGY FRISS SOCIAL HELYZET KÖZEPÉBE KERÜLT.
TRIGGER: ${seed.type}\n${seed.text}
${relatedPost?`KAPCSOLÓDÓ NYILVÁNOS POSZT:\n${relatedPost.gossipStory&&relatedPost.gossipStory.headline?relatedPost.gossipStory.headline:""}\n${relatedPost.text}`:""}

Készíts rövid váratlan popup helyzetet 3 választással.
- Nem írhatsz a játékos helyett konkrét mondatot.
- A választások cselekvési STRATÉGIÁK legyenek.
- Ne találj ki új létező személyt vagy új eseményt; a popup a fenti social helyzet következménye.
- tone csak: ignore | clarify | defend | joke | apologize | doubleDown | private | noComment
- Ha tone="private", akkor CSAK akkor használd, ha van a helyzetben létező AI karakter, akinek reálisan lehet írni, és adj meg targetId-t.
- A private választás targetId-je kizárólag létező AI karakter id lehet a helyzetből.
- reactions: 0-3 létező AI várható kapcsolatreakciója; delta azt jelenti, AZ AI mit érez a játékos iránt, -20..+20. A negatív reakció ugyanolyan reális, mint a pozitív.

VÁLASZ CSAK JSON:
{"skip":false,"icon":"⚡","title":"rövid cím","text":"1-3 mondat","choices":[{"id":"c1","label":"stratégia","description":"rövid magyarázat","tone":"clarify","targetId":"","reactions":[{"id":"AI id","delta":4,"mood":"","why":""}]}]}${TAIL}`,{maxTokens:1200});
}

function normalizePopupEvent(w,seed,raw){
  if(!raw||raw.skip===true)return null;
  const title=cut(String(raw.title||"").replace(/\s+/g," ").trim(),120), body=String(raw.text||"").replace(/\n{3,}/g,"\n\n").trim().slice(0,900);if(!title||!body)return null;
  const allowedTones=new Set(["ignore","clarify","defend","joke","apologize","doubleDown","private","noComment"]), validAiIds=new Set((w.chars||[]).filter((c)=>c&&!isHuman(w,c.id)).map((c)=>c.id));
  const choices=(Array.isArray(raw.choices)?raw.choices:[]).slice(0,3).map((choice,index)=>{
    const tone=allowedTones.has(choice&&choice.tone)?choice.tone:"ignore";
    const reactions=(choice&&Array.isArray(choice.reactions)?choice.reactions:[]).slice(0,3).map((r)=>({id:r&&r.id?String(r.id):"",delta:Math.max(-20,Math.min(20,Number(r&&r.delta)||0)),mood:cut(String(r&&r.mood||""),60),why:cut(String(r&&r.why||""),140)})).filter((r)=>validAiIds.has(r.id));
    const targetId =
      choice &&
      choice.targetId &&
      validAiIds.has(
        String(choice.targetId)
      )
        ? String(choice.targetId)
        : "";

    return{
      id:String(choice&&choice.id||`c${index+1}`),
      label:cut(String(choice&&choice.label||"").replace(/\s+/g," ").trim(),90)||`Choice ${index+1}`,
      description:cut(String(choice&&choice.description||"").replace(/\s+/g," ").trim(),180),
      tone,
      targetId,
      reactions
    };
  }).filter((c)=>c.label);

  if(choices.length<2)return null;

  return{
    id:"pe_"+uid(),
    icon:String(raw.icon||"⚡").slice(0,6),
    title,
    text:body,
    ts:now(),
    resolved:false,
    snoozedAt:0,
    sourceEventIds:[seed.id].filter(Boolean),
    sourceType:seed.type||"",
    relatedPostId:seed.meta&&seed.meta.postId||"",
    involvedIds:gossipEventSubjectIds(seed)
      .filter((id)=>id!==w.meId&&!isMediaAccount(w,id)),
    choices
  };
}
function addPopupEvent(w,seed,raw){const row=normalizePopupEvent(w,seed,raw);if(!row)return null;w.popupEvents=[row,...(w.popupEvents||[])].slice(0,40);return row;}

function popupSourceEvent(w,event){
  if(!w||!event)return null;

  const ids=
    Array.isArray(event.sourceEventIds)
      ? event.sourceEventIds
      : [];

  return (w.socialEvents||[]).find(
    (row)=>
      row &&
      ids.includes(row.id)
  ) || null;
}

function popupPrivateTargetId(w,event,choice){
  if(!w||!event||!choice)return "";

  const candidates=[];

  if(choice.targetId){
    candidates.push(
      String(choice.targetId)
    );
  }

  (choice.reactions||[]).forEach(
    (r)=>{
      if(r&&r.id){
        candidates.push(
          String(r.id)
        );
      }
    }
  );

  (event.involvedIds||[]).forEach(
    (id)=>{
      if(id){
        candidates.push(
          String(id)
        );
      }
    }
  );

  const seed=
    popupSourceEvent(
      w,
      event
    );

  if(seed){
    gossipEventSubjectIds(seed)
      .forEach((id)=>{
        if(id){
          candidates.push(
            String(id)
          );
        }
      });
  }

  const related=
    event.relatedPostId
      ? (w.posts||[]).find(
          (p)=>
            p &&
            p.id===event.relatedPostId
        )
      : null;

  if(related&&related.authorId){
    candidates.push(
      String(related.authorId)
    );
  }

  return candidates.find(
    (id)=>{
      const c=
        charById(
          w,
          id
        );

      return Boolean(
        c &&
        !isHuman(w,id) &&
        !isMediaAccount(w,id)
      );
    }
  ) || "";
}

function popupPublicTone(tone){
  return [
    "clarify",
    "defend",
    "joke",
    "apologize",
    "doubleDown",
  ].includes(tone);
}

async function genPopupPlayerActionText(
  w,
  event,
  choice,
  mode,
  targetId=""
){
  const lang=
    worldLanguage(
      w,
      w.meId
    );

  const target=
    targetId
      ? charById(
          w,
          targetId
        )
      : null;

  const seed=
    popupSourceEvent(
      w,
      event
    );

  const related=
    event.relatedPostId
      ? (w.posts||[]).find(
          (p)=>
            p &&
            p.id===event.relatedPostId
        )
      : null;

  const out=
    await askWorldJSONInteractive(
      w,
      engineFor(w),
      `${worldContext(
        w,
        target
          ? [target.id]
          : [],
        true,
        w.meId
      )}

A JÁTÉKOS MOST EXPLICITEN EZT A STRATÉGIÁT VÁLASZTOTTA EGY POPUPBAN:
${choice.label}
${choice.description||""}

HELYZET:
${event.title}
${event.text}
${seed?`FORRÁS ESEMÉNY: ${seed.text||seed.type}`:""}
${related?`KAPCSOLÓDÓ POSZT: ${related.text||""}`:""}
${target?`CÉLZOTT PRIVÁT BESZÉLGETŐPARTNER: ${target.name}`:""}

EZ MOST KIVÉTEL A "NE BESZÉLJ A JÁTÉKOS HELYETT" SZABÁLY ALÓL:
a játékos a gomb megnyomásával kifejezetten engedélyezte, hogy EGYETLEN rövid üzenet/poszt készüljön, amely pontosan a kiválasztott stratégiát hajtja végre.

SZABÁLYOK:
- Ne változtasd meg a választott stratégiát.
- Ne találj ki új tényt, új eseményt, bizonyítékot, helyszínt vagy szereplőt.
- Ne írj olyasmit, amit a popupból és a meglévő világból nem lehet tudni.
- A játékos saját karakterlapjának hangjához igazodj, de ne legyen túl hosszú.
- ${mode==="private"
  ? "Ez PRIVÁT DM. 1-2 rövid mondat. Olyan legyen, amit ténylegesen elküldene a célkarakternek."
  : "Ez NYILVÁNOS SOCIAL POSZT. 1-3 rövid mondat. Ne legyen meta, ne említsd hogy popup vagy stratégia."}
- Nyelv: ${lang==="en"?"ENGLISH":"MAGYAR"}.

VÁLASZ CSAK JSON:
{"text":"a tényleges elküldendő szöveg"}${TAIL}`,
      {
        maxTokens:500,
        priority:100,
        maxTries:3,
      }
    );

  return cut(
    String(
      out&&out.text||""
    ).trim(),
    mode==="private"
      ? 500
      : 900
  );
}

async function genPopupPrivateReply(
  w,
  targetId,
  playerText
){
  const c=
    charById(
      w,
      targetId
    );

  if(!c||isHuman(w,targetId)){
    return "";
  }

  const ck=
    chatKey(
      w.meId,
      targetId
    );

  const requestWorld=
    JSON.parse(
      JSON.stringify(w)
    );

  if(!requestWorld.chats){
    requestWorld.chats={};
  }

  requestWorld.chats[ck]=[
    ...(requestWorld.chats[ck]||[]),
    {
      from:"me",
      text:playerText,
      ts:now(),
    },
  ];

  const history=
    (requestWorld.chats[ck]||[])
      .slice(-14)
      .map(
        (m)=>
          `${
            m.from==="me"
              ? requestWorld.player.name
              : c.name
          }: ${m.text}`
      )
      .join("\\n");

  const rel=
    getRel(
      requestWorld,
      c.id,
      requestWorld.meId
    );

  const out=
    await askWorldJSONInteractive(
      requestWorld,
      engineFor(requestWorld),
      `${worldContext(
        requestWorld,
        [c.id],
        true,
        c.id
      )}

TE MOST ${c.name.toUpperCase()} VAGY.
A JÁTÉKOS MOST EGY DRÁMA POPUP "PRIVÁTBAN BESZÉLJÜK MEG" JELLEGŰ STRATÉGIÁJÁT HAJTOTTA VÉGRE, ÉS TÉNYLEG ÍRT NEKED PRIVÁTBAN.

KAPCSOLAT:
${relationshipBehaviorCard(
  requestWorld,
  c.id,
  requestWorld.meId
)}

BESZÉDSTÍLUS / TELJES KÁNON:
${voiceCard(c)}
${characterMemoryCard(requestWorld, c)}

FRISS CHAT:
${history}

${matureContentInstruction(
  requestWorld,
  [c.id],
  "chat"
)}

VÁLASZOLJ TÉNYLEG A LEGUTOLSÓ ÜZENETRE.
- Ne válaszolj általánosságban.
- A kapcsolatotok, személyiséged, történeted, lojalitásod, félelmed, rivalizálásod és crush/flört dinamika hasson a reakcióra.
- Ha dühös vagy, legyél dühös; ha félősebb vagy egy veszélyesebb karaktertől, az érződjön.
- Ne találd ki, hogy fizikailag az ajtónál vagy, úton vagy hozzá, a háza előtt állsz vagy ugyanazon a helyen vagytok, hacsak a chat ezt ténylegesen nem alapozta meg.
- Rövid, természetes privát chatválasz.
- Ne írj a játékos helyett.

VÁLASZ CSAK JSON:
{"text":"válasz"}${TAIL}`,
      {
        maxTokens:500,
        priority:100,
        maxTries:3,
      }
    );

  const raw=
    cleanGeneratedUtterance(
      requestWorld,
      c.id,
      out&&out.text
        ? String(out.text).trim()
        : "",
      500
    );

  return sanitizePhoneDm(
    requestWorld,
    c.id,
    enforceChatEmojiVariety(
      requestWorld,
      c.id,
      raw
    ),
    history
  );
}

function appendPopupPrivateConversation(
  w,
  targetId,
  playerText,
  replyText,
  event,
  choice
){
  const c =
    charById(
      w,
      targetId
    );

  if (!c) return false;

  if (
    !w.chats ||
    typeof w.chats !== "object" ||
    Array.isArray(w.chats)
  ) {
    w.chats = {};
  }

  const ck =
    chatKey(
      w.meId,
      targetId
    );

  const sentAt =
    now();

  const previous =
    Array.isArray(
      w.chats[ck]
    )
      ? w.chats[ck]
      : [];

  const next = [
    ...previous,
    {
      id:"popup_dm_" + uid(),
      from:"me",
      text:String(playerText || ""),
      ts:sentAt,
      language:
        worldLanguage(
          w,
          w.meId
        ),
      popupAction:true,
      popupEventId:event.id,
      popupChoiceId:choice.id,
    },
  ];

  if (replyText) {
    next.push({
      id:"popup_reply_" + uid(),
      from:"them",
      text:String(replyText || ""),
      ts:sentAt + 1,
      language:
        worldLanguage(
          w,
          w.meId
        ),
      popupAction:true,
      popupEventId:event.id,
      popupChoiceId:choice.id,
    });
  }

  /*
   * A tényleges DM legyen az első és kötelező művelet.
   */
  w.chats[ck] = next;

  /*
   * A ledger/memória kiegészítő rendszer.
   * Egy régi vagy furcsa world-adat miatt ez nem döntheti le a UI-t.
   */
  try {
    recordSocialEvent(
      w,
      {
        type:"popup-private-action",
        refId:`${event.id}:${choice.id}:dm`,
        ts:sentAt,
        actorId:w.meId,
        targetIds:[targetId],
        visibility:"private",
        factLevel:"observed",
        importance:34,
        drama:8,
        romance:0,
        embarrassment:0,
        source:"popup-event",
        text:cut(playerText,220),
        tags:[
          "popup-event",
          "choice",
          "private",
          "dm",
        ],
        meta:{
          popupEventId:event.id,
          choiceId:choice.id,
          targetId,
        },
      }
    );
  } catch (socialErr) {
    console.warn(
      "Popup private social ledger failed:",
      socialErr
    );
  }

  try {
    rememberKnowledge(
      w,
      c.id,
      {
        kind:"conversation",
        source:"popup_private",
        confidence:1,
        text:
          sysLangText(
            w,
            c.id,
            `${w.player && w.player.name ? w.player.name : "A játékos"} privátban megkeresett a friss dráma miatt.`,
            `${w.player && w.player.name ? w.player.name : "The player"} reached out privately about the recent drama.`
          ),
      }
    );
  } catch (memoryErr) {
    console.warn(
      "Popup private memory write failed:",
      memoryErr
    );
  }

  return true;
}
function appendPopupPublicPost(
  w,
  text,
  event,
  choice,
  forcedId=""
){
  if (!Array.isArray(w.posts)) {
    w.posts = [];
  }

  const post={
    id:forcedId || uid(),
    authorId:w.meId,
    ts:now(),
    likes:0,
    likedBy:[],
    text,
    imageId:"",
    image:"",
    comments:[],
    language:
      worldLanguage(
        w,
        w.meId
      ),
    popupAction:true,
    popupEventId:event.id,
    popupChoiceId:choice.id,
  };

  w.posts.unshift(post);

  recordSocialEvent(
    w,
    {
      type:
        "popup-public-action",
      refId:post.id,
      ts:post.ts,
      actorId:w.meId,
      targetIds:
        (event.involvedIds||[])
          .filter(Boolean),
      visibility:"public",
      factLevel:"observed",
      importance:44,
      drama:
        Math.max(
          8,
          Number(
            popupToneImpact(
              choice.tone
            ).hype
          )*3
        ),
      romance:0,
      embarrassment:
        choice.tone==="apologize"
          ? 4
          : 0,
      source:"popup-event",
      text,
      tags:[
        "post",
        "player-post",
        "popup-event",
        "popup-response",
        choice.tone,
      ],
      meta:{
        postId:post.id,
        popupEventId:event.id,
        choiceId:choice.id,
      },
    }
  );

  try {
    noteMentions(
      w,
      text,
      w.meId,
      {
        type:"post",
        id:post.id,
      }
    );
  } catch (mentionErr) {
    console.warn(
      "Popup post mention processing failed:",
      mentionErr
    );
  }

  return post;
}

function resolvePopupEvent(w,eventId,choiceId){
  const event=(w.popupEvents||[]).find((e)=>e&&e.id===eventId);if(!event||event.resolved)return false;
  const choice=(event.choices||[]).find((c)=>c&&c.id===choiceId);if(!choice)return false;
  const impact=popupToneImpact(choice.tone), audience=Math.max(1,displayFollowerCount(w,w.meId)), followerDelta=Math.round(audience*(Number(impact.followerRate)||0));
  applyExplicitSocialImpact(w,w.meId,{aura:impact.aura,reputation:impact.reputation,hype:impact.hype,humor:impact.humor,followers:followerDelta});
  applyChanges(
    w,
    (choice.reactions || [])
      .map((r) => ({
        a:
          r && r.id
            ? r.id
            : "",
        b:
          w.meId,
        delta:
          Number(
            r && r.delta
          ) || 0,
        mood:
          r && r.mood,
        why:
          r && r.why,
      }))
  );
  event.resolved=true;event.resolvedAt=now();event.choiceId=choice.id;event.choiceTone=choice.tone;event.socialImpact={aura:impact.aura,reputation:impact.reputation,hype:impact.hype,humor:impact.humor,followers:followerDelta};
  recordSocialEvent(w,{type:"popup-choice",refId:`${event.id}:${choice.id}`,ts:event.resolvedAt,actorId:w.meId,targetIds:(choice.reactions||[]).map((r)=>r.id).filter(Boolean),visibility:"system",factLevel:"observed",importance:36,drama:Math.max(0,impact.hype*3),romance:0,embarrassment:0,source:"popup-event",text:choice.label,tags:["popup-event","choice",choice.tone],meta:{popupEventId:event.id,choiceId:choice.id,choiceImpact:{aura:impact.aura,reputation:impact.reputation,hype:impact.hype,humor:impact.humor,followers:followerDelta}}});
  return true;
}
function snoozePopupEvent(w,eventId){const e=(w.popupEvents||[]).find((x)=>x&&x.id===eventId);if(e&&!e.resolved){e.snoozedAt=now();return true;}return false;}

/* ============================================================
   SOCIAL STATS ENGINE
   ============================================================ */

/*
 * A social médiában látható számok és a játékbeli társadalmi
 * állapot külön dolgok.
 *
 * - followers/following: tényleges profiladat
 * - followerPower: a követőszám 0–100 logaritmikus social ereje
 * - popularity: követőszám + tartós engagement
 * - aura: core aura + követőszám social leverage
 * - reputation: core reputation + kisebb követőszám-hatás
 * - humor: core humor + enyhe követőszám-hatás
 * - hype: friss események + követőszám alap-buzz
 * - clout: követőszám + popularity + aura + hype + reputation + humor összesített befolyása
 *
 * Nem kap valaki automatikusan +reputation pontot csak azért,
 * mert kommenteltek neki. A figyelem és a jó hírnév nem ugyanaz.
 */

function clampSignedSocial(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(
    -100,
    Math.min(
      100,
      Math.round(n * 10) / 10
    )
  );
}

function clampPositiveSocial(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(n * 10) / 10
    )
  );
}

function defaultSocialStatsRow() {
  return {
    /*
     * A felületen látható, DERIVED értékek.
     */
    aura: 0,
    popularity: 0,
    reputation: 0,
    hype: 0,
    humor: 0,
    clout: 0,

    /*
     * Tartalmi / történeti alapértékek.
     *
     * Ezeket módosítják a gossip, popup, virality stb.
     * A követőszám bónusza NEM ide íródik, így refreshkor
     * nem halmozódik újra és újra.
     */
    auraCore: 0,
    reputationCore: 0,
    humorCore: 0,

    /*
     * A hype eseményalapú és időérzékeny.
     * Az explicit +/- módosítás 24 óra alatt kifut.
     */
    hypeModifier: 0,
    hypeModifierAt: 0,

    /*
     * Követőszámból számolt 0–100 social power.
     */
    followerPower: 0,

    followers: 0,
    following: 0,

    signals: {
      posts: 0,
      likesReceived: 0,
      commentsReceived: 0,
      repostsReceived: 0,
      knownFollowers: 0,
    },

    sentiment: {
      support: 0,
      dislike: 0,
      controversy: 0,
      stanEnergy: 0,
      cancelPressure: 0,
    },

    fanbase: {
      coreFans: 0,
      activeStans: 0,
      skeptics: 0,
      antis: 0,
    },

    viralPosts: 0,

    updatedAt: 0,
  };
}

function ensureSocialStatsFor(
  w,
  characterId
) {
  if (
    !w ||
    !characterId
  ) {
    return null;
  }

  if (
    !w.socialStats ||
    typeof w.socialStats !== "object" ||
    Array.isArray(w.socialStats)
  ) {
    w.socialStats = {};
  }

  const id =
    String(characterId);

  const current =
    w.socialStats[id] &&
    typeof w.socialStats[id] === "object" &&
    !Array.isArray(w.socialStats[id])
      ? w.socialStats[id]
      : {};

  const base =
    defaultSocialStatsRow();

  const row = {
    ...base,
    ...current,

    signals: {
      ...base.signals,
      ...(
        current.signals &&
        typeof current.signals === "object" &&
        !Array.isArray(current.signals)
          ? current.signals
          : {}
      ),
    },

    sentiment: {
      ...base.sentiment,
      ...(
        current.sentiment &&
        typeof current.sentiment === "object" &&
        !Array.isArray(current.sentiment)
          ? current.sentiment
          : {}
      ),
    },

    fanbase: {
      ...base.fanbase,
      ...(
        current.fanbase &&
        typeof current.fanbase === "object" &&
        !Array.isArray(current.fanbase)
          ? current.fanbase
          : {}
      ),
    },
  };

  /*
   * Régi world migráció:
   * az eddigi látható aura/reputation/humor érték legyen
   * az első "core", így semmi nem vész el.
   *
   * Ha a core már létezik, onnantól azt tartjuk meg.
   */
  row.auraCore =
    Object.prototype.hasOwnProperty.call(
      current,
      "auraCore"
    )
      ? clampSignedSocial(
          current.auraCore
        )
      : clampSignedSocial(
          current.aura
        );

  row.reputationCore =
    Object.prototype.hasOwnProperty.call(
      current,
      "reputationCore"
    )
      ? clampSignedSocial(
          current.reputationCore
        )
      : clampSignedSocial(
          current.reputation
        );

  row.humorCore =
    Object.prototype.hasOwnProperty.call(
      current,
      "humorCore"
    )
      ? clampSignedSocial(
          current.humorCore
        )
      : clampSignedSocial(
          current.humor
        );

  row.hypeModifier =
    clampSignedSocial(
      row.hypeModifier
    );

  row.hypeModifierAt =
    Math.max(
      0,
      Number(
        row.hypeModifierAt
      ) || 0
    );

  row.followerPower =
    clampPositiveSocial(
      row.followerPower
    );

  row.clout =
    clampPositiveSocial(
      row.clout
    );

  row.aura =
    clampSignedSocial(
      row.aura
    );

  row.reputation =
    clampSignedSocial(
      row.reputation
    );

  row.humor =
    clampSignedSocial(
      row.humor
    );

  row.popularity =
    clampPositiveSocial(
      row.popularity
    );

  row.hype =
    clampPositiveSocial(
      row.hype
    );

  row.followers =
    Math.max(
      0,
      Math.round(
        Number(row.followers) || 0
      )
    );

  row.following =
    Math.max(
      0,
      Math.round(
        Number(row.following) || 0
      )
    );

  row.sentiment.support =
    clampPositiveSocial(
      row.sentiment.support
    );

  row.sentiment.dislike =
    clampPositiveSocial(
      row.sentiment.dislike
    );

  row.sentiment.controversy =
    clampPositiveSocial(
      row.sentiment.controversy
    );

  row.sentiment.stanEnergy =
    clampPositiveSocial(
      row.sentiment.stanEnergy
    );

  row.sentiment.cancelPressure =
    clampPositiveSocial(
      row.sentiment.cancelPressure
    );

  ["coreFans", "activeStans", "skeptics", "antis"].forEach((key) => {
    row.fanbase[key] = Math.max(0, Math.round(Number(row.fanbase[key]) || 0));
  });

  row.viralPosts =
    Math.max(
      0,
      Math.round(
        Number(row.viralPosts) || 0
      )
    );

  row.updatedAt =
    Number(row.updatedAt) || 0;

  w.socialStats[id] = row;

  return row;
}

/*
 * Követőszámból kiinduló ismertségi alap.
 *
 * Logaritmikus skála kell, mert 1 000 -> 10 000 követő között
 * társadalmilag sokkal nagyobb a különbség, mint pusztán +9000.
 *
 * Körülbelül:
 * 10 követő      -> 16
 * 100            -> 32
 * 1 000          -> 48
 * 10 000         -> 64
 * 100 000        -> 80
 * 1 000 000      -> 96
 */
function followerPopularityBase(
  followers
) {
  const n =
    Math.max(
      0,
      Number(followers) || 0
    );

  if (!n) return 0;

  return clampPositiveSocial(
    Math.log10(
      n + 1
    ) * 16
  );
}

/*
 * Ugyanazt a logaritmikus követőskálát használjuk
 * "social power"-ként is.
 *
 * Ez azért jó, mert:
 * - 100 -> kb. 32
 * - 1K  -> kb. 48
 * - 10K -> kb. 64
 * - 100K -> kb. 80
 * - 1M -> kb. 96
 *
 * Tehát a követőszám nagyon számít, de 1 millió után
 * sem robban végtelenre.
 */
function followerSocialPower(
  followers
) {
  return followerPopularityBase(
    followers
  );
}

/*
 * CLOUT = összesített társadalmi befolyás.
 *
 * A követőszám a legerősebb komponens,
 * de a jó aura, popularity, hype, reputation és humor
 * ténylegesen tovább emeli.
 *
 * Így két azonos követőszámú karakter közül annak lesz
 * nagyobb cloutja, akinek a többi social statja is erősebb.
 */
function socialCloutScore(
  row,
  followerPower
) {
  if (!row) return 0;

  const fp =
    clampPositiveSocial(
      followerPower
    );

  const popularity =
    clampPositiveSocial(
      row.popularity
    );

  const hype =
    clampPositiveSocial(
      row.hype
    );

  const aura =
    Math.max(
      0,
      clampSignedSocial(
        row.aura
      )
    );

  const reputation =
    Math.max(
      0,
      clampSignedSocial(
        row.reputation
      )
    );

  const humor =
    Math.max(
      0,
      clampSignedSocial(
        row.humor
      )
    );

  return clampPositiveSocial(
    fp * 0.50 +
    popularity * 0.20 +
    aura * 0.12 +
    hype * 0.08 +
    reputation * 0.06 +
    humor * 0.04
  );
}

/*
 * Követőszám-bónusz a külön social statokhoz.
 *
 * Nem ugyanannyit ad mindenhez:
 * - aura: erősen számít a social presence
 * - hype: nagy közönség önmagában is ad alap buzz-t
 * - reputation: enyhébben számít
 * - humor: csak kis mértékben, mert sok követő != automatikusan vicces
 */
function followerDerivedSocialBoost(
  followerPower
) {
  const fp =
    clampPositiveSocial(
      followerPower
    );

  return {
    aura:
      fp * 0.25,

    reputation:
      fp * 0.10,

    humor:
      fp * 0.06,

    hype:
      fp * 0.20,
  };
}

/*
 * Az explicit hype +/- hatás 24 óra alatt fokozatosan kifut.
 */
function liveHypeModifier(
  row
) {
  if (!row) return 0;

  const value =
    Number(
      row.hypeModifier
    ) || 0;

  const at =
    Number(
      row.hypeModifierAt
    ) || 0;

  if (!value || !at) {
    return 0;
  }

  const age =
    Math.max(
      0,
      now() - at
    );

  const life =
    24 * 3600e3;

  if (age >= life) {
    return 0;
  }

  return (
    value *
    (
      1 -
      age / life
    )
  );
}


function socialSignalsFor(
  w,
  characterId
) {
  const posts =
    (w.posts || []).filter(
      (p) =>
        p &&
        p.authorId ===
          characterId
    );

  let likesReceived = 0;
  let commentsReceived = 0;
  let repostsReceived = 0;

  posts.forEach((post) => {
    likesReceived +=
      Math.max(
        0,
        Number(post.likes) || 0
      );

    commentsReceived +=
      (post.comments || []).filter(
        (c) =>
          c &&
          c.authorId !==
            characterId
      ).length;

    repostsReceived +=
      repostCount(
        w,
        post.id
      );
  });

  const profile =
    socialProfileById(
      w,
      characterId
    );

  const knownFollowers =
    profile
      ? knownFollowerCount(
          w,
          characterId
        )
      : 0;

  return {
    posts:
      posts.length,

    likesReceived,

    commentsReceived,

    repostsReceived,

    knownFollowers,
  };
}

/*
 * A HYPE időérzékeny.
 *
 * Egy régi like nem tart valakit örökké felkapott állapotban.
 * A Social Event Ledger elmúlt 24 órája adja a fő impulzust,
 * és az újabb esemény többet ér, mint a régebbi.
 */
function recentHypeFor(
  w,
  characterId
) {
  const cutoff =
    now() -
    24 * 3600e3;

  let heat = 0;

  (w.socialEvents || []).forEach(
    (event) => {
      if (
        !event ||
        Number(event.ts) <
          cutoff
      ) {
        return;
      }

      const actorHit =
        event.actorId ===
          characterId;

      const targetHit =
        Array.isArray(
          event.targetIds
        ) &&
        event.targetIds.includes(
          characterId
        );

      if (
        !actorHit &&
        !targetHit
      ) {
        return;
      }

      const ageHours =
        Math.max(
          0,
          (
            now() -
            Number(event.ts)
          ) /
            3600e3
        );

      /*
       * 24 óra alatt fokozatosan halványul.
       */
      const freshness =
        Math.max(
          0.08,
          1 -
            ageHours / 24
        );

      let weight = 0;

      if (
        event.type ===
          "post" &&
        actorHit
      ) {
        weight = 1.5;
      }

      if (
        event.type ===
          "like" &&
        targetHit
      ) {
        weight = 0.7;
      }

      if (
        (
          event.type ===
            "comment" ||
          event.type ===
            "reply"
        ) &&
        targetHit
      ) {
        weight = 1.8;
      }

      if (
        event.type ===
          "repost" &&
        targetHit
      ) {
        weight = 4;
      }

      if (
        event.type ===
          "follow" &&
        targetHit
      ) {
        weight = 2.2;
      }

      /*
       * Az unfollow is figyelem / social mozgás.
       * Később a reputation/cancel dönti el,
       * hogy ez negatív-e; itt csak hype.
       */
      if (
        event.type ===
          "unfollow" &&
        targetHit
      ) {
        weight = 2.8;
      }

      if (
        event.type ===
          "viral" &&
        actorHit
      ) {
        weight = 9;
      }

      if (
        event.type ===
          "cancel-wave" &&
        (
          actorHit ||
          targetHit
        )
      ) {
        weight = 10;
      }

      if (
        event.type ===
          "stan-wave" &&
        (
          actorHit ||
          targetHit
        )
      ) {
        weight = 8;
      }

      heat +=
        weight *
        freshness;
    }
  );

  /*
   * Kis szereplőgárdánál is legyen érzékelhető,
   * de ne érje el két like-kal a 100-at.
   */
  return clampPositiveSocial(
    heat * 4
  );
}


function publicSentimentFor(
  w,
  characterId
) {
  const cutoff =
    now() -
    72 * 3600e3;

  let supportHeat = 0;
  let dislikeHeat = 0;
  let controversyHeat = 0;
  let explicitStan = 0;
  let explicitCancel = 0;

  const supporterActions = {};

  (w.socialEvents || []).forEach(
    (event) => {
      if (
        !event ||
        Number(event.ts) <
          cutoff
      ) {
        return;
      }

      const targetHit =
        Array.isArray(
          event.targetIds
        ) &&
        event.targetIds.includes(
          characterId
        );

      const actorHit =
        event.actorId ===
          characterId;

      if (
        !targetHit &&
        !actorHit
      ) {
        return;
      }

      const ageHours =
        Math.max(
          0,
          (
            now() -
            Number(event.ts)
          ) /
            3600e3
        );

      const freshness =
        Math.max(
          0.12,
          1 -
            ageHours / 72
        );

      /*
       * Támogató jelek.
       * Ezek figyelmet / támogatást jeleznek,
       * de NEM automatikusan jó reputationt.
       */
      if (
        targetHit &&
        event.type === "like"
      ) {
        supportHeat +=
          0.8 * freshness;
      }

      if (
        targetHit &&
        event.type === "repost"
      ) {
        supportHeat +=
          2.5 * freshness;
      }

      if (
        targetHit &&
        event.type === "follow"
      ) {
        supportHeat +=
          1.7 * freshness;
      }

      /*
       * Unfollow már valódi negatív social jel.
       */
      if (
        targetHit &&
        event.type === "unfollow"
      ) {
        dislikeHeat +=
          2.6 * freshness;
      }

      /*
       * A nyilvános kommentek nem automatikusan pozitívak.
       * A kommentelő meglévő kapcsolata segít eldönteni,
       * hogy inkább támogatói vagy ellenséges social jelről van szó.
       *
       * Ez nem "szövegelemzés": csak társas kontextus.
       */
      if (
        targetHit &&
        event.actorId &&
        event.actorId !==
          characterId &&
        (
          event.type ===
            "comment" ||
          event.type ===
            "reply"
        )
      ) {
        const commentRel =
          getRel(
            w,
            event.actorId,
            characterId
          );

        const commentRelScore =
          Number(
            commentRel &&
            commentRel.score
          ) || 0;

        if (
          commentRelScore >= 25
        ) {
          supportHeat +=
            1.3 * freshness;
        } else if (
          commentRelScore <= -20
        ) {
          dislikeHeat +=
            1.6 * freshness;

          controversyHeat +=
            0.8 * freshness;
        } else {
          controversyHeat +=
            0.25 * freshness;
        }
      }

      /*
       * Későbbi gossip / cancel / popup rendszerek
       * explicit sentimentet is adhatnak.
       */
      const publicSentiment =
        event.meta &&
        event.meta.publicSentiment &&
        typeof event.meta.publicSentiment ===
          "object"
          ? event.meta.publicSentiment
          : null;

      if (publicSentiment) {
        supportHeat +=
          Math.max(
            0,
            Number(
              publicSentiment.support
            ) || 0
          ) *
          0.18 *
          freshness;

        dislikeHeat +=
          Math.max(
            0,
            Number(
              publicSentiment.dislike
            ) || 0
          ) *
          0.18 *
          freshness;

        controversyHeat +=
          Math.max(
            0,
            Number(
              publicSentiment.controversy
            ) || 0
          ) *
          0.18 *
          freshness;

        explicitStan +=
          Math.max(
            0,
            Number(
              publicSentiment.stan
            ) || 0
          ) *
          0.18 *
          freshness;

        explicitCancel +=
          Math.max(
            0,
            Number(
              publicSentiment.cancel
            ) || 0
          ) *
          0.18 *
          freshness;
      }

      const tags =
        Array.isArray(event.tags)
          ? event.tags
          : [];

      if (
        tags.includes("stan") ||
        tags.includes("support-wave")
      ) {
        explicitStan +=
          6 * freshness;
      }

      if (
        tags.includes("cancel") ||
        tags.includes("backlash")
      ) {
        explicitCancel +=
          7 * freshness;
        dislikeHeat +=
          3 * freshness;
      }

      if (
        tags.includes("controversy")
      ) {
        controversyHeat +=
          6 * freshness;
      }

      /*
       * Stan energy: ugyanaz a létező karakter többször
       * támogatja ugyanazt a személyt.
       */
      if (
        targetHit &&
        event.actorId &&
        event.actorId !==
          characterId &&
        [
          "like",
          "repost",
          "follow",
        ].includes(
          event.type
        )
      ) {
        const actorId =
          event.actorId;

        supporterActions[
          actorId
        ] =
          (
            supporterActions[
              actorId
            ] || 0
          ) + 1;
      }
    }
  );

  let repeatedSupport = 0;

  Object.values(
    supporterActions
  ).forEach((count) => {
    if (count >= 2) {
      repeatedSupport +=
        Math.min(
          4,
          count - 1
        );
    }
  });

  const support =
    clampPositiveSocial(
      supportHeat * 5
    );

  const dislike =
    clampPositiveSocial(
      dislikeHeat * 6
    );

  const stanEnergy =
    clampPositiveSocial(
      repeatedSupport * 10 +
      support * 0.28 +
      explicitStan * 4
    );

  const cancelPressure =
    clampPositiveSocial(
      dislike * 0.8 +
      explicitCancel * 4
    );

  /*
   * Controversy akkor nő igazán, ha egyszerre van
   * támogatás ÉS ellenállás / backlash.
   */
  const controversy =
    clampPositiveSocial(
      controversyHeat * 4 +
      Math.min(
        support,
        dislike
      ) *
        0.9 +
      cancelPressure *
        0.22
    );

  return {
    support,
    dislike,
    controversy,
    stanEnergy,
    cancelPressure,
  };
}

function postViralityScore(
  w,
  post
) {
  if (
    !w ||
    !post ||
    !post.id
  ) {
    return 0;
  }

  const ageHours =
    Math.max(
      0,
      (
        now() -
        (Number(post.ts) || 0)
      ) /
        3600e3
    );

  /*
   * 72 óránál régebbi poszt már ne kezdjen
   * magától hirtelen virálissá válni.
   */
  if (ageHours > 72) {
    return 0;
  }

  const audience =
    Math.max(
      25,
      displayFollowerCount(
        w,
        post.authorId
      )
    );

  const likes =
    Math.max(
      0,
      Number(post.likes) || 0
    );

  const comments =
    (post.comments || []).length;

  const reposts =
    repostCount(
      w,
      post.id
    );

  const engagement =
    likes +
    comments * 2 +
    reposts * 5;

  if (!engagement) {
    return 0;
  }

  /*
   * Kis account is tudjon virális lenni:
   * a saját közönségéhez képesti engagement erősen számít.
   */
  const rate =
    engagement /
    audience;

  const relativeScore =
    Math.min(
      56,
      rate * 420
    );

  /*
   * Nagy accountnál az abszolút számok is számítanak.
   */
  const absoluteScore =
    Math.min(
      28,
      Math.log10(
        engagement + 1
      ) * 10
    );

  /*
   * Repost a legerősebb terjedési jel.
   */
  const spreadScore =
    Math.min(
      22,
      reposts * 4.5
    );

  const freshness =
    ageHours <= 12
      ? 1
      : Math.max(
          0.58,
          1 -
            (ageHours - 12) /
              120
        );

  return clampPositiveSocial(
    (
      relativeScore +
      absoluteScore +
      spreadScore
    ) *
      freshness
  );
}

function viralityStatus(score) {
  const n =
    Number(score) || 0;

  if (n >= 82) {
    return "breakout";
  }

  if (n >= 60) {
    return "viral";
  }

  if (n >= 35) {
    return "rising";
  }

  return "normal";
}

function viralFollowerGainFor(
  w,
  post,
  score
) {
  const audience =
    Math.max(
      25,
      displayFollowerCount(
        w,
        post.authorId
      )
    );

  const engagement =
    Math.max(
      1,
      Number(post.likes) || 0
    ) +
    (post.comments || []).length * 2 +
    repostCount(
      w,
      post.id
    ) * 5;

  const strength =
    Math.max(
      0,
      Math.min(
        1,
        (
          Number(score) -
          60
        ) /
          40
      )
    );

  /*
   * Viralitás új követőket hozhat akkor is,
   * ha később a tartalom megosztóvá válik.
   * A cancel motor majd külön tud követőket levonni.
   */
  const proportional =
    audience *
    (
      0.002 +
      strength * 0.018
    );

  const engagementFloor =
    engagement *
    (
      0.35 +
      strength * 0.45
    );

  return Math.max(
    2,
    Math.min(
      50000,
      Math.round(
        Math.max(
          proportional,
          engagementFloor
        )
      )
    )
  );
}

function refreshPostVirality(
  w,
  postId
) {
  if (
    !w ||
    !postId
  ) {
    return null;
  }

  const post =
    (w.posts || []).find(
      (p) =>
        p &&
        p.id === postId
    );

  if (!post) {
    return null;
  }

  const score =
    postViralityScore(
      w,
      post
    );

  const status =
    viralityStatus(score);

  const previous =
    post.virality &&
    typeof post.virality ===
      "object"
      ? post.virality
      : {};

  const wasViral =
    Boolean(
      previous.viralAt
    );

  post.virality = {
    ...previous,
    score,
    status,
    updatedAt: now(),
  };

  /*
   * Egy poszt csak egyszer kapja meg az első
   * virális követőnövekedést.
   */
  if (
    score >= 60 &&
    !wasViral
  ) {
    const author =
      socialProfileById(
        w,
        post.authorId
      );

    if (author) {
      ensureSocialProfileRow(
        author
      );

      const followerGain =
        viralFollowerGainFor(
          w,
          post,
          score
        );

      author.followerDelta =
        Math.round(
          Number(
            author.followerDelta
          ) || 0
        ) +
        followerGain;

      post.virality.viralAt =
        now();

      post.virality.followerGain =
        followerGain;

      /*
       * A viral event külön bekerül a ledgerbe,
       * így később a gossip / trend rendszer is látja.
       */
      recordSocialEvent(
        w,
        {
          type: "viral",

          refId:
            `viral:${post.id}`,

          ts: now(),

          actorId:
            post.authorId,

          targetIds: [],

          visibility:
            "public",

          factLevel:
            "observed",

          importance:
            status ===
              "breakout"
              ? 90
              : 72,

          drama:
            status ===
              "breakout"
              ? 30
              : 14,

          romance: 0,
          embarrassment: 0,

          source:
            "social-engine",

          text:
            "A post went viral.",

          tags: [
            "social",
            "viral",
            status,
          ],

          meta: {
            postId:
              post.id,

            viralScore:
              score,

            followerGain,

            socialImpact: {
              hype:
                status ===
                  "breakout"
                  ? 15
                  : 8,
            },
          },
        }
      );

      if (
        isHuman(
          w,
          post.authorId
        )
      ) {
        pushNote(
          w,
          post.authorId,
          {
            icon: "🔥",

            text:
              sysLangText(
                w,
                post.authorId,
                `A posztod felkapott lett. +${followerGain} követő`,
                `Your post is taking off. +${followerGain} followers`
              ),

            link: {
              type: "post",
              id: post.id,
            },
          }
        );
      }
    }
  }

  refreshSocialStatsFor(
    w,
    post.authorId
  );

  return post.virality;
}


function recentSocialWave(
  w,
  characterId,
  mode,
  hours = 6
) {
  const cutoff =
    now() -
    hours * 3600e3;

  return (
    (w.socialEvents || []).some(
      (event) =>
        event &&
        Number(event.ts) >=
          cutoff &&
        Array.isArray(
          event.targetIds
        ) &&
        event.targetIds.includes(
          characterId
        ) &&
        Array.isArray(
          event.tags
        ) &&
        event.tags.includes(
          "social-wave"
        ) &&
        event.tags.includes(
          mode
        )
    )
  );
}

function strongestSocialPostFor(
  w,
  characterId
) {
  return (
    (w.posts || [])
      .filter(
        (post) =>
          post &&
          post.authorId ===
            characterId
      )
      .slice()
      .sort((a, b) => {
        const av =
          Number(
            a.virality &&
            a.virality.score
          ) || 0;

        const bv =
          Number(
            b.virality &&
            b.virality.score
          ) || 0;

        if (av !== bv) {
          return bv - av;
        }

        return (
          (Number(b.ts) || 0) -
          (Number(a.ts) || 0)
        );
      })[0] ||
    null
  );
}

function socialSupportScore(
  w,
  actorId,
  targetId
) {
  if (
    !actorId ||
    !targetId ||
    actorId === targetId
  ) {
    return -999;
  }

  const actor =
    socialProfileById(
      w,
      actorId
    );

  const target =
    socialProfileById(
      w,
      targetId
    );

  if (
    !actor ||
    !target ||
    isHuman(w, actor.id)
  ) {
    return -999;
  }

  const rel =
    getRel(
      w,
      actor.id,
      target.id
    );

  const relScore =
    Number(rel && rel.score) ||
    0;

  let score =
    relScore;

  if (
    isFollowing(
      w,
      actor.id,
      target.id
    )
  ) {
    score += 24;
  }

  const targetPosts =
    (w.posts || [])
      .filter(
        (p) =>
          p &&
          p.authorId ===
            target.id
      )
      .slice(0, 8);

  targetPosts.forEach((p) => {
    if (
      Array.isArray(
        p.likedBy
      ) &&
      p.likedBy.includes(
        actor.id
      )
    ) {
      score += 5;
    }

    if (
      hasReposted(
        w,
        actor.id,
        p.id
      )
    ) {
      score += 10;
    }

    score += Math.min(
      10,
      (p.comments || []).filter(
        (c) =>
          c &&
          c.authorId ===
            actor.id
      ).length * 5
    );
  });

  return Math.round(score);
}

function socialCriticScore(
  w,
  actorId,
  targetId
) {
  if (
    !actorId ||
    !targetId ||
    actorId === targetId
  ) {
    return -999;
  }

  const actor =
    socialProfileById(
      w,
      actorId
    );

  const target =
    socialProfileById(
      w,
      targetId
    );

  if (
    !actor ||
    !target ||
    isHuman(w, actor.id)
  ) {
    return -999;
  }

  const rel =
    getRel(
      w,
      actor.id,
      target.id
    );

  const relScore =
    Number(rel && rel.score) ||
    0;

  /*
   * Erősen pozitív / fix családi kapcsolat ne váljon
   * automatikusan cancel-mobbá csak azért, mert trend van.
   */
  if (
    rel &&
    rel.fixed &&
    relScore > -20
  ) {
    return -999;
  }

  let score =
    -relScore;

  if (
    isFollowing(
      w,
      actor.id,
      target.id
    )
  ) {
    score += 8;
  }

  if (
    relScore <= -45
  ) {
    score += 18;
  }

  return Math.round(score);
}

function socialWaveCast(
  w,
  targetId,
  mode
) {
  const rows =
    (w.chars || [])
      .filter(
        (c) =>
          c &&
          c.id !== targetId &&
          !isHuman(w, c.id)
      )
      .map((c) => {
        const score =
          mode === "cancel"
            ? socialCriticScore(
                w,
                c.id,
                targetId
              )
            : socialSupportScore(
                w,
                c.id,
                targetId
              );

        return {
          id: c.id,
          score,
          tie: Math.random(),
        };
      })
      .filter(
        (row) =>
          row.score >
          (
            mode === "cancel"
              ? 12
              : 18
          )
      )
      .sort((a, b) => {
        if (
          a.score !== b.score
        ) {
          return (
            b.score -
            a.score
          );
        }

        return (
          a.tie -
          b.tie
        );
      });

  return rows.slice(
    0,
    3
  );
}

function pickSocialWaveAction(w) {
  refreshAllSocialStats(w);

  const candidates = [];

  socialProfiles(w).forEach(
    (target) => {
      if (!target) return;

      const row =
        ensureSocialStatsFor(
          w,
          target.id
        );

      if (!row) return;

      const sentiment =
        row.sentiment ||
        defaultSocialStatsRow()
          .sentiment;

      const post =
        strongestSocialPostFor(
          w,
          target.id
        );

      /*
       * Counter-backlash:
       * egyszerre van komoly támadás ÉS erős védőtábor.
       */
      if (
        sentiment.cancelPressure >=
          32 &&
        sentiment.stanEnergy >=
          24 &&
        !recentSocialWave(
          w,
          target.id,
          "counter",
          8
        )
      ) {
        candidates.push({
          targetId:
            target.id,
          mode: "counter",
          score:
            sentiment.cancelPressure +
            sentiment.stanEnergy +
            sentiment.controversy *
              0.5,
          postId:
            post && post.id,
        });
      }

      if (
        sentiment.cancelPressure >=
          24 &&
        !recentSocialWave(
          w,
          target.id,
          "cancel",
          8
        )
      ) {
        candidates.push({
          targetId:
            target.id,
          mode: "cancel",
          score:
            sentiment.cancelPressure *
              1.35 +
            sentiment.controversy,
          postId:
            post && post.id,
        });
      }

      if (
        (
          sentiment.stanEnergy >=
            24 ||
          (
            row.hype >= 55 &&
            sentiment.support >=
              30
          )
        ) &&
        !recentSocialWave(
          w,
          target.id,
          "stan",
          8
        )
      ) {
        candidates.push({
          targetId:
            target.id,
          mode: "stan",
          score:
            sentiment.stanEnergy *
              1.25 +
            row.hype * 0.45 +
            sentiment.support *
              0.35,
          postId:
            post && post.id,
        });
      }
    }
  );

  candidates.sort(
    (a, b) =>
      b.score - a.score
  );

  const best =
    candidates[0];

  if (!best) return null;

  const cast =
    socialWaveCast(
      w,
      best.targetId,
      best.mode === "cancel"
        ? "cancel"
        : "support"
    );

  if (!cast.length) {
    return null;
  }

  return {
    ...best,
    cast,
  };
}

function waveBackgroundFollowerDelta(
  w,
  targetId,
  mode,
  strength
) {
  const audience =
    Math.max(
      25,
      displayFollowerCount(
        w,
        targetId
      )
    );

  const normalized =
    Math.max(
      0,
      Math.min(
        1,
        (
          Number(strength) ||
          0
        ) / 100
      )
    );

  if (mode === "cancel") {
    return -Math.max(
      2,
      Math.min(
        50000,
        Math.round(
          audience *
          (
            0.002 +
            normalized *
              0.018
          )
        )
      )
    );
  }

  if (mode === "counter") {
    return Math.max(
      1,
      Math.min(
        25000,
        Math.round(
          audience *
          (
            0.001 +
            normalized *
              0.009
          )
        )
      )
    );
  }

  return Math.max(
    1,
    Math.min(
      30000,
      Math.round(
        audience *
        (
          0.001 +
          normalized *
            0.012
        )
      )
    )
  );
}

function refreshSocialStatsFor(
  w,
  characterId
) {
  const profile =
    socialProfileById(
      w,
      characterId
    );

  if (!profile) {
    return null;
  }

  const row =
    ensureSocialStatsFor(
      w,
      characterId
    );

  if (!row) return null;

  const followers =
    displayFollowerCount(
      w,
      characterId
    );

  const following =
    displayFollowingCount(
      w,
      characterId
    );

  const signals =
    socialSignalsFor(
      w,
      characterId
    );

  /*
   * Tartós engagement-bónusz.
   *
   * Ez NEM reputation.
   * Egy botrányos ember is lehet nagyon népszerű.
   */
  const engagementTotal =
    signals.likesReceived +
    signals.commentsReceived * 2 +
    signals.repostsReceived * 4;

  const engagementBonus =
    engagementTotal > 0
      ? Math.min(
          12,
          Math.log10(
            engagementTotal + 1
          ) * 5
        )
      : 0;

  row.followers =
    followers;

  row.following =
    following;

  row.signals =
    signals;

  const followerPower =
    followerSocialPower(
      followers
    );

  const followerBoost =
    followerDerivedSocialBoost(
      followerPower
    );

  row.followerPower =
    followerPower;

  row.popularity =
    clampPositiveSocial(
      followerPower +
      engagementBonus
    );

  /*
   * AURA / REPUTATION / HUMOR
   *
   * A karakter történeti/tartalmi core pontjai megmaradnak,
   * erre jön rá a követőszámból származó social leverage.
   */
  row.aura =
    clampSignedSocial(
      Number(
        row.auraCore
      ) +
      followerBoost.aura
    );

  row.reputation =
    clampSignedSocial(
      Number(
        row.reputationCore
      ) +
      followerBoost.reputation
    );

  row.humor =
    clampSignedSocial(
      Number(
        row.humorCore
      ) +
      followerBoost.humor
    );

  /*
   * HYPE:
   * friss esemény + követőszám alap-buzz + ideiglenes explicit +/-.
   */
  row.hype =
    clampPositiveSocial(
      recentHypeFor(
        w,
        characterId
      ) +
      followerBoost.hype +
      liveHypeModifier(
        row
      )
    );

  /*
   * CLOUT:
   * követőszám + a többi social pont.
   *
   * Minél magasabbak ezek a pontok, annál magasabb a clout.
   */
  row.clout =
    socialCloutScore(
      row,
      followerPower
    );

  row.sentiment =
    publicSentimentFor(
      w,
      characterId
    );

  const fanAudience = Math.max(0, row.followers);
  const stanShare = Math.min(0.28, (Number(row.sentiment.stanEnergy) || 0) / 420);
  const antiShare = Math.min(0.24, (Number(row.sentiment.cancelPressure) || 0) / 460);
  const skepticShare = Math.min(0.22, (Number(row.sentiment.controversy) || 0) / 520);
  const coreShare = Math.min(0.35, 0.04 + (Number(row.sentiment.support) || 0) / 430);
  row.fanbase = {
    coreFans: Math.round(fanAudience * coreShare),
    activeStans: Math.round(fanAudience * stanShare),
    skeptics: Math.round(fanAudience * skepticShare),
    antis: Math.round(fanAudience * antiShare),
  };

  row.viralPosts =
    (w.posts || []).filter(
      (p) =>
        p &&
        p.authorId ===
          characterId &&
        p.virality &&
        Number(
          p.virality.score
        ) >= 60
    ).length;

  row.updatedAt =
    now();

  return row;
}

function refreshAllSocialStats(w) {
  if (!w) return w;

  socialProfiles(w).forEach(
    (c) => {
      refreshSocialStatsFor(
        w,
        c.id
      );
    }
  );

  return w;
}

/*
 * Későbbi tartalmi rendszereknek:
 * gossip / cancel / stan / virality / popup event
 * adhat célzott társadalmi következményt.
 *
 * A jelenlegi like/comment/follow rendszer ezt NEM használja
 * reputation vagy aura automatikus farmolására.
 */
function applyExplicitSocialImpact(
  w,
  characterId,
  impact = {}
) {
  const row =
    ensureSocialStatsFor(
      w,
      characterId
    );

  if (!row) return null;

  if (
    Number.isFinite(
      Number(impact.aura)
    )
  ) {
    row.auraCore =
      clampSignedSocial(
        Number(
          row.auraCore
        ) +
        Number(
          impact.aura
        )
      );
  }

  if (
    Number.isFinite(
      Number(impact.reputation)
    )
  ) {
    row.reputationCore =
      clampSignedSocial(
        Number(
          row.reputationCore
        ) +
        Number(
          impact.reputation
        )
      );
  }

  if (
    Number.isFinite(
      Number(impact.humor)
    )
  ) {
    row.humorCore =
      clampSignedSocial(
        Number(
          row.humorCore
        ) +
        Number(
          impact.humor
        )
      );
  }

  if (
    Number.isFinite(
      Number(impact.hype)
    )
  ) {
    row.hypeModifier =
      clampSignedSocial(
        Number(
          row.hypeModifier
        ) +
        Number(
          impact.hype
        )
      );

    row.hypeModifierAt =
      now();
  }

  const profile =
    socialProfileById(
      w,
      characterId
    );

  if (
    profile &&
    Number.isFinite(
      Number(
        impact.followers
      )
    )
  ) {
    ensureSocialProfileRow(
      profile
    );

    profile.followerDelta =
      Math.round(
        Number(
          profile.followerDelta
        ) || 0
      ) +
      Math.round(
        Number(
          impact.followers
        )
      );
  }

  /*
   * A követőszám és a core pontok módosítása után
   * azonnal újraszámoljuk a derived statokat + cloutot.
   */
  const refreshed =
    refreshSocialStatsFor(
      w,
      characterId
    );

  if (refreshed) {
    return refreshed;
  }

  row.updatedAt =
    now();

  return row;
}

/*
 * =========================================================
 * SOCIAL EVENT LEDGER
 * =========================================================
 *
 * Minden fontos társadalmi történés egységes formában
 * kerül majd ide.
 *
 * Ebből dolgozhat később:
 * - Whisper Wire
 * - pletykarendszer
 * - virality
 * - hype
 * - reputation
 * - relationship következmények
 */

function socialScore(value, fallback = 0) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(n))
  );
}

function recordSocialEvent(
  w,
  event = {}
) {
  if (!w || typeof w !== "object") {
    return null;
  }

  ensureSocialSimulationState(w);

  const type =
    String(
      event.type || "event"
    ).trim() || "event";

  /*
   * Ha ugyanazt a konkrét posztot /
   * kommentet / eseményt egy retry miatt
   * még egyszer próbálnánk naplózni,
   * ne készüljön belőle duplikáció.
   */
  const refId =
    event.refId !== undefined &&
    event.refId !== null
      ? String(event.refId)
      : "";

  if (refId) {
    const existing =
      (w.socialEvents || []).find(
        (x) =>
          x &&
          x.type === type &&
          String(x.refId || "") ===
            refId
      );

    if (existing) {
      return existing;
    }
  }

  const rawTargets =
    Array.isArray(event.targetIds)
      ? event.targetIds
      : event.targetId
        ? [event.targetId]
        : [];

  const targetIds = [
    ...new Set(
      rawTargets
        .filter(Boolean)
        .map((x) => String(x))
    ),
  ];

  const rawWitnesses =
    Array.isArray(event.witnessIds)
      ? event.witnessIds
      : [];

  const witnessIds = [
    ...new Set(
      rawWitnesses
        .filter(Boolean)
        .map((x) => String(x))
    ),
  ];

  const allowedVisibility = [
    "public",
    "private",
    "group",
    "limited",
    "system",
  ];

  const visibility =
    allowedVisibility.includes(
      event.visibility
    )
      ? event.visibility
      : "public";

  const allowedFactLevels = [
    "observed",
    "inferred",
    "rumor",
    "speculation",
  ];

  const factLevel =
    allowedFactLevels.includes(
      event.factLevel
    )
      ? event.factLevel
      : "observed";

  const tags = Array.isArray(event.tags)
    ? [
        ...new Set(
          event.tags
            .map((x) =>
              String(x || "")
                .trim()
                .toLowerCase()
            )
            .filter(Boolean)
        ),
      ].slice(0, 12)
    : [];

  const entry = {
    id:
      event.id ||
      "se_" + uid(),

    refId,

    ts:
      Number(event.ts) ||
      now(),

    type,

    actorId:
      event.actorId
        ? String(event.actorId)
        : "",

    targetIds,

    witnessIds,

    visibility,

    factLevel,

    importance:
      socialScore(
        event.importance,
        20
      ),

    drama:
      socialScore(
        event.drama,
        0
      ),

    romance:
      socialScore(
        event.romance,
        0
      ),

    embarrassment:
      socialScore(
        event.embarrassment,
        0
      ),

    source:
      String(
        event.source || "world"
      ),

    text:
      String(
        event.text || ""
      ).trim(),

    tags,

    meta:
      event.meta &&
      typeof event.meta === "object" &&
      !Array.isArray(event.meta)
        ? {
            ...event.meta,
          }
        : {},
  };

  /*
   * A legújabb esemény legyen elöl.
   */
  w.socialEvents.unshift(entry);

  /*
   * Ne nőjön végtelenre a teljes world JSON.
   *
   * A nagyon régi fontos történeteket később
   * a Whisper Wire / history rendszer fogja
   * összefoglalva megőrizni.
   */
  w.socialEvents =
    w.socialEvents.slice(0, 600);

  /*
   * Csak az érintett profilokat frissítjük.
   * Így egy like/comment/repost azonnal megjelenik a
   * popularity/hype számításban, de nem fut végig fölöslegesen
   * az egész karaktergárdán.
   */
  const touchedIds = [
    entry.actorId,
    ...(entry.targetIds || []),
  ]
    .filter(Boolean);

  [
    ...new Set(
      touchedIds
    ),
  ].forEach((id) => {
    refreshSocialStatsFor(
      w,
      id
    );
  });

  /*
   * Későbbi rendszerek küldhetnek például:
   *
   * meta: {
   *   socialImpact: {
   *     reputation: -8,
   *     aura: 3
   *   }
   * }
   *
   * Ez most még csak infrastruktúra.
   */
  /*
   * Like / comment / reply / repost után azonnal újraszámoljuk
   * az érintett eredeti poszt terjedését.
   *
   * A "viral" eventet direkt kihagyjuk, így nincs rekurzív loop.
   */
  if (
    [
      "post",
      "like",
      "comment",
      "reply",
      "repost",
      "gossip-story",
      "rumor-evolution",
    ].includes(
      entry.type
    ) &&
    entry.meta &&
    entry.meta.postId
  ) {
    refreshPostVirality(
      w,
      entry.meta.postId
    );
  }

  if (
    entry.meta &&
    entry.meta.socialImpact &&
    typeof entry.meta.socialImpact ===
      "object"
  ) {
    const impactTargetIds =
      entry.targetIds &&
      entry.targetIds.length
        ? entry.targetIds
        : entry.actorId
          ? [entry.actorId]
          : [];

    impactTargetIds.forEach(
      (id) => {
        applyExplicitSocialImpact(
          w,
          id,
          entry.meta.socialImpact
        );
      }
    );
  }

  refreshTrends(w);

  if (entry.meta && entry.meta.postId) {
    refreshPostReach(w, entry.meta.postId);
  }

  /*
   * Aktív pletykamédiánál frissítjük a következő
   * valós alapú sztori-jelöltet.
   * EZ MÉG NEM PUBLIKÁL POSZTOT.
   */
  if (
    w.gossipSettings &&
    (
      w.gossipSettings.mediaMode === "local" ||
      w.gossipSettings.mediaMode === "global"
    )
  ) {
    selectGossipStoryCandidate(w);
  }

  return entry;
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
  .map((c) => `${voiceCard(c)}${characterMemoryCard(w, c)}`)
  .join("")}

${repetitionGuard(
  w,
  cast.map((c) => c.id),
  "autonóm csoportchat"
)}

${matureContentInstruction(
  w,
  cast.map((c) => c.id),
  "group"
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


async function genSocialWave(
  w,
  target,
  post,
  mode,
  castRows
) {
  const cast =
    (castRows || [])
      .map(
        (row) =>
          charById(
            w,
            row.id
          )
      )
      .filter(Boolean);

  if (
    !target ||
    !cast.length
  ) {
    return {
      comments: [],
    };
  }

  const castIds =
    cast.map(
      (c) => c.id
    );

  const modeText =
    mode === "cancel"
      ? `
NYILVÁNOS BACKLASH / CANCEL HULLÁM:
A felsorolt karakterek közül azok szólaljanak meg,
akik a saját személyiségük és ${target.name}-hez fűződő
kapcsolatuk alapján tényleg kritikusan, ellenségesen,
szkeptikusan vagy gúnyosan reagálnának.
`
      : mode === "counter"
        ? `
COUNTER-BACKLASH:
${target.name} támadások alatt áll, de kialakult egy
védőtábor is. A felsorolt karakterek közül azok
szólaljanak meg, akik természetesen megvédenék,
visszaszólnának a támadóknak vagy nyilvánosan mellé állnának.
`
        : `
STAN / SUPPORT HULLÁM:
${target.name} körül erős támogatói energia alakult ki.
A felsorolt karakterek közül azok reagáljanak, akik
természetesen támogatnák, hype-olnák vagy megvédenék.
`;

  return askWorldJSON(
    w,
    engineFor(w),
    `${worldContext(
      w,
      castIds.concat(
        [target.id]
      ),
      true,
      null
    )}

SOCIAL MEDIA HULLÁM.

CÉLPONT:
${target.name} [${target.id}]

${post
  ? `A POSZT, AMI KÖRÜL A HULLÁM FUT:
${target.name}: ${post.text || "[képes poszt]"}`
  : "Nincs egyetlen konkrét poszt; a hullám a profil körül zajlik."}

${modeText}

MEGSZÓLALHATÓ KARAKTEREK:
${cast
  .map(
    (c) =>
      `${c.name} [${c.id}]
${voiceCard(c)}
${characterMemoryCard(w, c)}`
  )
  .join("\n\n")}

${repetitionGuard(
  w,
  castIds,
  "kommentek"
)}

SZABÁLYOK:
- CSAK a fenti AI-karakterek nevében írj.
- A játékos helyett SOHA ne írj.
- Ne szólaljon meg mindenki kötelezően.
- 1-3 rövid, valódi social-media komment legyen.
- Legtöbbször 1-15 szó bőven elég.
- Ne írj esszét vagy narrációt.
- A hangnem legyen karakterhű.
- Ne használj ugyanazt a mondatot vagy emoji-mintát több szereplőnél.
- Ne találj ki olyan titkos információt, amit a karakter nem tudhat.
- ${mode === "cancel"
  ? "A kritika lehet kemény vagy gúnyos, de ne legyen mindenki ugyanúgy dühös."
  : "A támogatás lehet védelem, hype, száraz beszólás az ellenzőknek vagy egyszerű kiállás."}

Formátum:
{
  "comments":[
    {
      "id":"karakter azonosítója",
      "text":"rövid nyilvános komment"
    }
  ]
}${TAIL}`,
    {
      maxTokens: 900,
    }
  );
}

function applySocialWave(
  n,
  action,
  out
) {
  const payload =
    action &&
    action.payload
      ? action.payload
      : {};

  const targetId =
    payload.targetId;

  const mode =
    payload.mode ||
    "stan";

  const target =
    socialProfileById(
      n,
      targetId
    );

  if (!target) {
    return;
  }

  const row =
    ensureSocialStatsFor(
      n,
      targetId
    );

  const sentiment =
    row &&
    row.sentiment
      ? row.sentiment
      : defaultSocialStatsRow()
          .sentiment;

  const post =
    payload.postId
      ? (n.posts || []).find(
          (p) =>
            p &&
            p.id ===
              payload.postId
        )
      : strongestSocialPostFor(
          n,
          targetId
        );

  const cast =
    Array.isArray(
      payload.cast
    )
      ? payload.cast
      : [];

  /*
   * A konkrét létező AI-k is viselkednek:
   * supportnál follow / like / repost,
   * cancelnél unfollow.
   */
  cast.forEach((castRow) => {
    const who =
      castRow &&
      castRow.id;

    const actor =
      socialProfileById(
        n,
        who
      );

    if (
      !actor ||
      isHuman(n, actor.id) ||
      actor.id === targetId
    ) {
      return;
    }

    if (
      mode === "cancel"
    ) {
      const rel =
        getRel(
          n,
          actor.id,
          targetId
        );

      const relScore =
        Number(
          rel && rel.score
        ) || 0;

      if (
        isFollowing(
          n,
          actor.id,
          targetId
        ) &&
        relScore < 15
      ) {
        setFollowState(
          n,
          actor.id,
          targetId,
          false,
          "ai-social-wave"
        );
      }

      return;
    }

    /*
     * Stan / counter:
     * a védők érdeklődése láthatóvá válhat.
     */
    if (
      !isFollowing(
        n,
        actor.id,
        targetId
      ) &&
      socialSupportScore(
        n,
        actor.id,
        targetId
      ) >= 28
    ) {
      setFollowState(
        n,
        actor.id,
        targetId,
        true,
        "ai-social-wave"
      );
    }

    if (post) {
      if (
        !Array.isArray(
          post.likedBy
        )
      ) {
        post.likedBy = [];
      }

      if (
        !post.likedBy.includes(
          actor.id
        )
      ) {
        post.likedBy.push(
          actor.id
        );

        post.likes =
          Math.max(
            Number(
              post.likes
            ) || 0,
            post.likedBy.length
          );

        recordSocialEvent(
          n,
          {
            type: "like",
            refId:
              `${post.id}:${actor.id}`,
            ts: now(),
            actorId:
              actor.id,
            targetIds:
              post.authorId !==
                actor.id
                ? [
                    post.authorId,
                  ]
                : [],
            visibility:
              "public",
            factLevel:
              "observed",
            importance: 8,
            drama: 0,
            romance: 0,
            embarrassment: 0,
            source:
              "ai-social-wave",
            text:
              "Liked a post.",
            tags: [
              "social",
              "like",
              "stan",
              "support-wave",
            ],
            meta: {
              postId:
                post.id,
              postAuthorId:
                post.authorId ||
                "",
            },
          }
        );
      }

      if (
        socialSupportScore(
          n,
          actor.id,
          targetId
        ) >= 50 &&
        !hasReposted(
          n,
          actor.id,
          post.id
        )
      ) {
        createRepost(
          n,
          actor.id,
          post.id,
          "ai-social-wave"
        );
      }
    }
  });

  /*
   * AI által írt nyilvános kommentek.
   */
  if (post) {
    (out &&
    Array.isArray(out.comments)
      ? out.comments
      : []
    ).slice(0, 3).forEach(
      (comment) => {
        const who =
          aiVoice(
            n,
            comment &&
            comment.id
          );

        if (
          !who ||
          !cast.some(
            (row) =>
              row &&
              row.id === who
          ) ||
          !comment.text
        ) {
          return;
        }

        const body =
          cleanGeneratedUtterance(
            n,
            who,
            comment.text,
            240
          );

        if (!body) return;

        const made = {
          id: uid(),
          authorId: who,
          text: body,
          ts: now(),
          parent: null,
          language:
            worldLanguage(
              n,
              n.meId
            ),
        };

        if (
          !Array.isArray(
            post.comments
          )
        ) {
          post.comments = [];
        }

        post.comments.push(
          made
        );

        noteComment(
          n,
          post,
          made
        );

        recordSocialEvent(
          n,
          {
            type: "comment",
            refId:
              made.id,
            ts:
              made.ts,
            actorId:
              who,
            targetIds: [
              targetId,
            ],
            visibility:
              "public",
            factLevel:
              "observed",
            importance:
              mode === "cancel"
                ? 34
                : 28,
            drama:
              mode === "cancel"
                ? 28
                : mode ===
                    "counter"
                  ? 20
                  : 10,
            romance: 0,
            embarrassment: 0,
            source:
              "ai-social-wave",
            text:
              made.text,
            tags:
              mode === "cancel"
                ? [
                    "social",
                    "comment",
                    "cancel",
                    "backlash",
                    "controversy",
                  ]
                : mode ===
                    "counter"
                  ? [
                      "social",
                      "comment",
                      "stan",
                      "support-wave",
                      "counter-backlash",
                      "controversy",
                    ]
                  : [
                      "social",
                      "comment",
                      "stan",
                      "support-wave",
                    ],
            meta: {
              postId:
                post.id,
              commentId:
                made.id,
              postAuthorId:
                targetId,
            },
          }
        );
      }
    );
  }

  const strength =
    mode === "cancel"
      ? Number(
          sentiment.cancelPressure
        ) || 0
      : mode === "counter"
        ? Math.max(
            Number(
              sentiment.cancelPressure
            ) || 0,
            Number(
              sentiment.stanEnergy
            ) || 0
          )
        : Number(
            sentiment.stanEnergy
          ) || 0;

  const followerDelta =
    waveBackgroundFollowerDelta(
      n,
      targetId,
      mode,
      strength
    );

  ensureSocialProfileRow(
    target
  );

  target.followerDelta =
    Math.round(
      Number(
        target.followerDelta
      ) || 0
    ) +
    followerDelta;

  const reputationDelta =
    mode === "cancel"
      ? -Math.max(
          2,
          Math.min(
            10,
            Math.round(
              strength / 10
            )
          )
        )
      : mode === "counter"
        ? Math.max(
            1,
            Math.min(
              5,
              Math.round(
                strength / 20
              )
            )
          )
        : 0;

  recordSocialEvent(
    n,
    {
      type:
        mode === "cancel"
          ? "cancel-wave"
          : "stan-wave",

      refId:
        `social-wave:${mode}:${targetId}:${Math.floor(
          now() /
          21600000
        )}`,

      ts: now(),

      actorId: "",

      targetIds: [
        targetId,
      ],

      visibility:
        "public",

      factLevel:
        "observed",

      importance:
        mode === "cancel"
          ? 78
          : mode ===
              "counter"
            ? 70
            : 58,

      drama:
        mode === "cancel"
          ? 72
          : mode ===
              "counter"
            ? 55
            : 25,

      romance: 0,
      embarrassment:
        mode === "cancel"
          ? 25
          : 0,

      source:
        "social-engine",

      text:
        mode === "cancel"
          ? "A public backlash wave formed."
          : mode === "counter"
            ? "A counter-backlash formed around the target."
            : "A visible support wave formed.",

      tags:
        mode === "cancel"
          ? [
              "social",
              "social-wave",
              "cancel",
              "backlash",
              "controversy",
            ]
          : mode === "counter"
            ? [
                "social",
                "social-wave",
                "counter",
                "stan",
                "support-wave",
                "counter-backlash",
                "controversy",
              ]
            : [
                "social",
                "social-wave",
                "stan",
                "support-wave",
              ],

      meta: {
        mode,
        followerDelta,

        publicSentiment:
          mode === "cancel"
            ? {
                dislike: 18,
                controversy: 15,
                cancel: 18,
              }
            : mode ===
                "counter"
              ? {
                  support: 16,
                  controversy: 10,
                  stan: 14,
                }
              : {
                  support: 14,
                  stan: 16,
                },

        socialImpact: {
          hype:
            mode === "cancel"
              ? 12
              : mode ===
                  "counter"
                ? 9
                : 6,

          reputation:
            reputationDelta,
        },
      },
    }
  );

  refreshSocialStatsFor(
    n,
    targetId
  );

  if (
    isHuman(
      n,
      targetId
    )
  ) {
    const absFollowers =
      Math.abs(
        followerDelta
      );

    pushNote(
      n,
      targetId,
      {
        icon:
          mode === "cancel"
            ? "⚠"
            : mode ===
                "counter"
              ? "🛡️"
              : "★",

        text:
          mode === "cancel"
            ? sysLangText(
                n,
                targetId,
                `Backlash indult körülötted. ${absFollowers} követőt veszítettél.`,
                `A backlash wave formed around you. You lost ${absFollowers} followers.`
              )
            : mode === "counter"
              ? sysLangText(
                  n,
                  targetId,
                  `A védőtáborod visszavágott. +${absFollowers} követő`,
                  `Your supporters pushed back. +${absFollowers} followers`
                )
              : sysLangText(
                  n,
                  targetId,
                  `Támogatói hullám indult körülötted. +${absFollowers} követő`,
                  `A support wave formed around you. +${absFollowers} followers`
                ),

        link:
          post
            ? {
                type: "post",
                id: post.id,
              }
            : {
                type: "char",
                id: targetId,
              },
      }
    );
  }
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
    Math.random() < 0.22
  ) {
    return mkAction(
      "brief",
      `brief:${needBrief.id}:${rawLen(needBrief)}`,
      {
        id: needBrief.id,
      }
    );
  }

  /*
   * 4. SPILL&CHILL / RUMORHASIT PUBLIKÁLÁS
   *
   * Csak valódi Story Selector-jelöltből készülhet.
   * Első publikációnál nincs cooldown; utána a beállított
   * gossip frequency szabályozza, milyen sűrűn posztolhat.
   */
  const gossipCandidate =
    gossipAutoCandidate(
      view
    );

  if (
    gossipCandidate &&
    Math.random() <
      gossipPublishChance(
        view
      )
  ) {
    return mkAction(
      "gossip-story",
      `gossip-story:${gossipCandidate.mode}:${gossipCandidate.primaryEventId}`,
      {
        candidate:
          gossipCandidate,
      }
    );
  }

  /*
   * 5. GOSSIP REAKCIÓK
   */
  if (Math.random() < 0.72) {
    const reaction = pickGossipReactionAction(view);
    if (reaction) {
      return mkAction(
        "gossip-reaction",
        `gossip-reaction:${reaction.postId}:${Math.floor(now() / 3600000)}`,
        reaction
      );
    }
  }

  /*
   * 6. RUMOR EVOLUTION / SPECULATION
   */
  if (Math.random() < 0.18) {
    const rumorPost = pickRumorEvolutionCandidate(view);
    if (rumorPost) {
      return mkAction(
        "rumor-evolution",
        `rumor-evolution:${rumorPost.id}`,
        { postId: rumorPost.id }
      );
    }
  }

  /*
   * 7. VÁRATLAN POPUP EVENT
   */
  if (Math.random() < 0.26) {
    const popupSeed = pickPopupEventSeed(view);
    if (popupSeed) {
      return mkAction(
        "popup-event",
        `popup-event:${popupSeed.id}`,
        { seedEventId: popupSeed.id }
      );
    }
  }

  /*
   * 8. STAN / CANCEL / COUNTER-BACKLASH HULLÁM
   *
   * Csak akkor indulhat, ha a már meglévő social aktivitás
   * ténylegesen felépített hozzá elég support / backlash energiát.
   */
  if (
    Math.random() < 0.32
  ) {
    const wave =
      pickSocialWaveAction(
        view
      );

    if (wave) {
      return mkAction(
        "social-wave",
        `social-wave:${wave.mode}:${wave.targetId}:${Math.floor(
          now() / 21600000
        )}`,
        {
          targetId:
            wave.targetId,

          mode:
            wave.mode,

          postId:
            wave.postId || "",

          cast:
            wave.cast,
        }
      );
    }
  }

  /*
   * 9. AUTONÓM FOLLOW
   *
   * Nem minden körben próbáljuk.
   * A karakterek csak akkor kerülnek jelöltként ide,
   * ha van valós társas okuk figyelni a másikat:
   * kapcsolat, follow-back jel, közös interakció,
   * group chat, DM vagy társadalmi relevancia.
   *
   * Így AI -> AI és AI -> játékos követés is
   * organikusan kialakulhat.
   */
  if (
    Math.random() < 0.14
  ) {
    const follow =
      pickAutonomousFollowAction(
        view
      );

    if (follow) {
      return mkAction(
        "follow",
        `auto-follow:${follow.actorId}:${follow.targetId}:${Math.floor(
          now() / 1800000
        )}`,
        {
          actorId:
            follow.actorId,

          targetId:
            follow.targetId,

          trigger:
            "autonomous",

          score:
            follow.score,
        }
      );
    }
  }

  /*
   * 10. AUTONÓM REPOST
   *
   * Az AI csak olyan posztot oszt újra,
   * amelyhez van társas oka kapcsolódni.
   */
  if (
    Math.random() < 0.08
  ) {
    const repost =
      pickAutonomousRepostAction(
        view
      );

    if (repost) {
      return mkAction(
        "repost",
        `auto-repost:${repost.actorId}:${repost.postId}:${Math.floor(
          now() / 3600000
        )}`,
        {
          actorId:
            repost.actorId,
          postId:
            repost.postId,
          score:
            repost.score,
        }
      );
    }
  }

  const roll = Math.random();

  /*
   * 11. AUTONÓM NOTE
   *
   * Ritkább, mint eddig.
   * Ne a note-ok zabálják fel
   * az összes automatikus kört.
   */
  const noteless = (
    view.chars || []
  )
    .filter((c) => {
      if (
        !c ||
        isHuman(view, c.id)
      ) {
        return false;
      }

      const active =
        noteOf(view, c.id);

      return (
        !active ||
        now() - (active.ts || 0) >=
          NOTE_REFRESH
      );
    })
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
   * Kb. 16% note.
   */
  if (
    roll < 0.16 &&
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
   * 12. LÉTEZŐ GROUP CHATEK
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
   * 13. GROUP CHAT
   *
   * Kb. 8%.
   * A meglévő csoport előnyt élvez
   * az új létrehozásával szemben.
   */
  if (
    roll >= 0.16 &&
    roll < 0.24
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
   * 14. PRIVÁT ÜZENET
   *
   * Kb. 32%.
   *
   * A pickInitiator továbbra is eldönti,
   * kinek van valódi oka írni.
   */
  if (roll < 0.56) {
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
   * 15. WORLD / FEED
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
  .map((c) => `${voiceCard(c)}${characterMemoryCard(w, c)}`)
  .join("")}

${repetitionGuard(
  w,
  memberIds,
  `csoportchat: ${group.name || "névtelen"}`
)}

${matureContentInstruction(
  w,
  memberIds,
  "group"
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

  if (action.type === "gossip-story") {
    const payload =
      action.payload || {};

    const candidate =
      payload.candidate;

    const media =
      activeGossipMediaAccount(
        view
      );

    if (
      !candidate ||
      !media ||
      candidate.mode !==
        (
          view.gossipSettings &&
          view.gossipSettings.mediaMode
        )
    ) {
      return null;
    }

    /*
     * Ha időközben már más publikáció elhasználta
     * a fő eseményt, ezt a queued actiont eldobjuk.
     */
    if (
      candidate.primaryEventId &&
      view.whisperWire &&
      Array.isArray(
        view.whisperWire.usedEventIds
      ) &&
      view.whisperWire.usedEventIds.includes(
        candidate.primaryEventId
      )
    ) {
      return null;
    }

    const out =
      await genGossipMediaStory(
        view,
        candidate
      );

    update((n) => {
      n.autoAt = now();

      publishGossipMediaStory(
        n,
        candidate,
        out
      );
    });

    return "gossip-story";
  }

  if (action.type === "gossip-reaction") {
    const payload = action.payload || {};
    const post = (view.posts || []).find((p) => p && p.id === payload.postId);
    const cast = Array.isArray(payload.cast) ? payload.cast : [];
    if (!post || !post.gossipStory || !cast.length) return null;
    const out = await genGossipReactions(view, post, cast);
    update((n) => { n.autoAt = now(); applyGossipReactions(n, post.id, cast, out); });
    return "gossip-reaction";
  }

  if (action.type === "rumor-evolution") {
    const postId = action.payload && action.payload.postId;
    const post = (view.posts || []).find((p) => p && p.id === postId);
    if (!post || !post.gossipStory || post.gossipStory.rumorEvolvedAt) return null;
    const out = await genRumorEvolution(view, post);
    update((n) => { n.autoAt = now(); publishRumorEvolution(n, post.id, out); });
    return "rumor-evolution";
  }

  if (action.type === "popup-event") {
    const seedId = action.payload && action.payload.seedEventId;
    const seed = (view.socialEvents || []).find((event) => event && event.id === seedId);
    if (!seed || pendingPopupEvent(view)) return null;
    const out = await genPopupEvent(view, seed);
    update((n) => { n.autoAt = now(); if (!pendingPopupEvent(n)) addPopupEvent(n, seed, out); });
    return "popup-event";
  }

  if (action.type === "follow") {
    const actorId =
      action.payload &&
      action.payload.actorId;

    const targetId =
      action.payload &&
      action.payload.targetId;

    const trigger =
      (
        action.payload &&
        action.payload.trigger
      ) ||
      "autonomous";

    const actor =
      actorId
        ? socialProfileById(
            view,
            actorId
          )
        : null;

    const target =
      targetId
        ? socialProfileById(
            view,
            targetId
          )
        : null;

    if (
      !actor ||
      !target ||
      isHuman(
        view,
        actor.id
      ) ||
      actor.id === target.id ||
      isFollowing(
        view,
        actor.id,
        target.id
      )
    ) {
      return null;
    }

    /*
     * A döntést mindig a futás pillanatában
     * újraellenőrizzük, mert a queue-ba kerülés óta
     * változhatott a kapcsolat vagy a követési állapot.
     */
    if (
      !aiShouldFollow(
        view,
        actor.id,
        target.id,
        trigger
      )
    ) {
      update((n) => {
        n.autoAt = now();
      });

      return "follow";
    }

    update((n) => {
      n.autoAt = now();

      setFollowState(
        n,
        actor.id,
        target.id,
        true,
        "ai"
      );
    });

    return "follow";
  }

  if (action.type === "social-wave") {
    const payload =
      action.payload || {};

    const target =
      socialProfileById(
        view,
        payload.targetId
      );

    if (!target) {
      return null;
    }

    const cast =
      Array.isArray(
        payload.cast
      )
        ? payload.cast
        : [];

    if (!cast.length) {
      return null;
    }

    const post =
      payload.postId
        ? (view.posts || []).find(
            (p) =>
              p &&
              p.id ===
                payload.postId
          )
        : strongestSocialPostFor(
            view,
            target.id
          );

    const out =
      await genSocialWave(
        view,
        target,
        post,
        payload.mode ||
          "stan",
        cast
      );

    update((n) => {
      n.autoAt = now();

      applySocialWave(
        n,
        action,
        out
      );
    });

    return "social-wave";
  }

  if (action.type === "repost") {
    const actorId =
      action.payload &&
      action.payload.actorId;

    const postId =
      action.payload &&
      action.payload.postId;

    const actor =
      actorId
        ? socialProfileById(
            view,
            actorId
          )
        : null;

    const post =
      postId
        ? (view.posts || []).find(
            (p) =>
              p &&
              p.id === postId
          )
        : null;

    if (
      !actor ||
      !post ||
      isHuman(
        view,
        actor.id
      ) ||
      post.authorId ===
        actor.id ||
      hasReposted(
        view,
        actor.id,
        post.id
      )
    ) {
      return null;
    }

    if (
      repostInterestScore(
        view,
        actor.id,
        post
      ) < 30
    ) {
      update((n) => {
        n.autoAt = now();
      });

      return "repost";
    }

    update((n) => {
      n.autoAt = now();

      createRepost(
        n,
        actor.id,
        post.id,
        "ai"
      );
    });

    return "repost";
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

        const rawMsg =
          cleanGeneratedUtterance(
            n,
            who,
            d.text,
            280
          );

        const msg =
          sanitizePhoneDm(
            n,
            who,
            enforceChatEmojiVariety(
              n,
              who,
              rawMsg
            ),
            liveNote.text || ""
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

    const activeNote =
      bot
        ? noteOf(view, bot.id)
        : null;

    if (
      !bot ||
      isHuman(view, bot.id) ||
      (
        activeNote &&
        now() - (activeNote.ts || 0) <
          NOTE_REFRESH
      )
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

    const rawTxt =
      cleanGeneratedUtterance(
        view,
        bot.id,
        out && out.text
          ? String(out.text).trim()
          : "",
        280
      );

    const txt =
      sanitizePhoneDm(
        view,
        bot.id,
        enforceChatEmojiVariety(
          view,
          bot.id,
          rawTxt
        ),
        (
          view.chats[
            chatKey(
              view.meId,
              bot.id
            )
          ] || []
        )
          .slice(-14)
          .map(
            (m) =>
              m
                ? (
                    m.text ||
                    m.imageDescription ||
                    ""
                  )
                : ""
          )
          .join("\n")
      );

    const aiPic =
      out &&
      out.image
        ? albumFind(
            bot,
            out.image
          )
        : null;

    const aiImageId =
      aiPic
        ? imageIdOf(
            aiPic.imageId ||
            aiPic.image ||
            ""
          )
        : "";

    const aiImageRef =
      aiPic
        ? (
            aiPic.imageId
              ? imageRef(
                  aiPic.imageId
                )
              : aiPic.image || ""
          )
        : "";

    const aiImageDescription =
      aiPic
        ? String(
            aiPic.vision ||
            aiPic.note ||
            ""
          )
        : "";

    update((n) => {
      n.autoAt = now();

      if (
        out.skip ||
        (
          !txt &&
          !aiImageRef
        )
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
          id:
            "dm_" + uid(),
          from:"them",
          text:txt,
          ts:now(),
          imageId:
            aiImageId ||
            "",
          image:
            aiImageId
              ? ""
              : aiImageRef || "",
          imageDescription:
            aiImageDescription ||
            "",
          language:
            worldLanguage(
              n,
              n.meId
            ),
        },
      ];

      const dmChanges =
        Array.isArray(
          out &&
          out.changes
        )
          ? out.changes
          : [
              {
                a:bot.id,
                b:view.meId,
                delta:
                  Number(
                    out &&
                    out.delta
                  ) || 0,
                mood:
                  out &&
                  out.mood,
                why:
                  out &&
                  out.why,
              },
            ];

      applyChanges(
        n,
        dmChanges
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
            `Privátban küldtem: ${cut(
              txt ||
              (
                aiImageDescription
                  ? `📷 ${aiImageDescription}`
                  : "📷 kép"
              ),
              110
            )}`,
            `I sent privately: ${cut(
              txt ||
              (
                aiImageDescription
                  ? `📷 ${aiImageDescription}`
                  : "📷 image"
              ),
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
  const [popupNav, setPopupNav] = useState(null);
  const seenNote = useRef(null);
  const flashTimer = useRef(null);
  const [makeWorld, setMakeWorld] = useState(false);
  const [lang, setLangState] = useState("hu");
  const [langReady, setLangReady] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [saveAt, setSaveAt] = useState(0);
  const lastSavedMedia = useRef("");

  /* Authoritative multi-device sync state. */
  const mediaSyncRev = useRef(0);
  const worldSaveBusy = useRef(false);
  const mediaSaveBusy = useRef(false);
  const syncRefreshBusy = useRef(false);
  const lastServerCheckAt = useRef(0);
  const pendingServerWorld = useRef(null);

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

  const installAuthoritativeWorld = useCallback((serverWorld, serverMeId, reason = "sync") => {
    if (!serverWorld) return false;

    const authoritative =
      migrate(
        JSON.parse(
          JSON.stringify(
            serverWorld
          )
        )
      );

    if (!authoritative) {
      return false;
    }

    const id =
      serverMeId ||
      meId;

    if (
      !id ||
      !authoritative.accounts ||
      !authoritative.accounts[id]
    ) {
      return false;
    }

    if (EditLock.n > 0) {
      pendingServerWorld.current = {
        world: authoritative,
        meId: id,
        reason,
      };

      setSaveState("conflict");
      return false;
    }

    const current =
      wRef.current;

    if (
      current &&
      current.code === authoritative.code &&
      contentOf(current) !== contentOf(authoritative)
    ) {
      /*
       * Mielőtt a szerververziót átvesszük,
       * a helyi változat emergency backupként megmarad.
       */
      void saveWorldMerged(
        current
      ).catch(() => {});
    }

    pendingServerWorld.current = null;

    lastSavedContent.current =
      contentOf(authoritative);

    setWorld(authoritative);
    setMeId(id);
    setSaveState("saved");
    setSaveAt(now());

    return true;
  }, [meId]);

  /*
   * A relation/zodiac/bond helper-ek egy része globális CURRENT_LANG-et
   * olvas render közben. Ha ezt csak useEffectben állítjuk át, akkor a
   * nyelvváltást kiváltó render még a RÉGI nyelvet látná, és pl.
   * "Legjobb barát" bent maradhatna magyarul.
   *
   * Ezért a render aktuális nyelvét rögtön szinkronizáljuk.
   */
  CURRENT_LANG = lang;

  const langCtxValue =
    React.useMemo(
      () => ({
        lang,
        tt,
      }),
      [
        lang,
        tt,
      ]
    );

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
       * ONLINE nincs automatikus local-world fallback.
       * Ha a session lejárt / nincs session, a login képernyő jön.
       * Ettől nem tud egy régi browser snapshot szerverállapotnak látszani.
       */
      const offline =
        typeof navigator !== "undefined" &&
        navigator.onLine === false;

      if (!offline) {
        return;
      }
    }

    /*
     * 2. OFFLINE emergency fallback.
     * Csak ténylegesen offline böngészőben használható.
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
      lastSavedContent.current =
        contentOf(wld);
      setSaveState("local");
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
    mediaSyncRev.current = 0;
    pendingServerWorld.current = null;
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
    mediaSyncRev.current = 0;
    pendingServerWorld.current = null;

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
          mediaRef.current || {},
          mediaSyncRev.current
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
  mediaSyncRev.current = 0;
  pendingServerWorld.current = null;
  setSaveState("saved");
}, []);


  const code = world ? world.code : null;

  const addImage = useCallback((dataUrl, meta = {}) => {
    const safeDataUrl =
      String(
        dataUrl || ""
      );

    if (
      !isInlineImageData(
        safeDataUrl
      )
    ) {
      console.warn(
        "Rejected invalid image payload."
      );
      return null;
    }

    const cur =
      mediaRef.current ||
      {};

    if (
      mediaBytes(cur) +
        safeDataUrl.length >
      MEDIA_CAP
    ) {
      return null;
    }
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
        dataUrl:
          safeDataUrl,
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
    /*
     * A tényleges cloud mentést a debounced media autosave végzi.
     * Így két gyors kép-hozzáadás nem indít párhuzamos, azonos
     * syncRev-ről induló szerverírást.
     */
    return imageRef(id);
  }, [code, meId]);

  useEffect(() => {
    if (!code) return;

    let alive = true;
    mediaReady.current = false;

    loadMedia(
      code,
      wRef.current
    ).then((result) => {
      if (!alive) return;

      const loaded =
        result &&
        result.media
          ? result.media
          : {};

      mediaSyncRev.current =
        Math.max(
          0,
          Math.floor(
            Number(
              result &&
              result.syncRev
            ) || 0
          )
        );

      setMedia(loaded);
      mediaRef.current = loaded;
      lastSavedMedia.current =
        mediaFingerprint(
          loaded
        );
      mediaReady.current = true;
    }).catch((e) => {
      if (!alive) return;

      console.warn(
        "Media initialization failed:",
        e
      );

      mediaReady.current = true;
    });

    return () => {
      alive = false;
    };
  }, [code]);

  useEffect(() => {
    if (!world || !code || !mediaReady.current) return;
    const normalized = normalizeWorldImages(world, mediaRef.current || {});
    if (!normalized.changed) return;
    mediaRef.current = normalized.media;
    setMedia(normalized.media);
    lastSavedMedia.current =
      mediaFingerprint(
        normalized.media
      );
    setWorld(normalized.world);
  }, [world ? world.code : null, world ? world.rev : 0, code, media]);

  useEffect(() => {
    let alive = true;

    const refreshFromServer =
      async (reason = "focus") => {
        const current =
          wRef.current;

        if (
          !alive ||
          !current ||
          !current.code ||
          !meId
        ) {
          return;
        }

        if (
          typeof navigator !== "undefined" &&
          navigator.onLine === false
        ) {
          return;
        }

        const ts = now();

        if (
          reason !== "online" &&
          ts - lastServerCheckAt.current < 4000
        ) {
          return;
        }

        if (
          syncRefreshBusy.current ||
          worldSaveBusy.current
        ) {
          return;
        }

        syncRefreshBusy.current = true;
        lastServerCheckAt.current = ts;

        try {
          const session =
            await serverSession();

          if (
            !alive ||
            !session ||
            !session.authenticated ||
            !session.world ||
            !session.meId
          ) {
            return;
          }

          const serverWorld =
            migrate(
              session.world
            );

          const latestLocal =
            wRef.current;

          if (
            !latestLocal ||
            latestLocal.code !==
              serverWorld.code ||
            session.meId !== meId
          ) {
            return;
          }

          const serverRev =
            worldSyncRev(
              serverWorld
            );

          const localRev =
            worldSyncRev(
              latestLocal
            );

          const sameContent =
            contentOf(
              latestLocal
            ) ===
            contentOf(
              serverWorld
            );

          if (
            serverRev === localRev &&
            !sameContent
          ) {
            /*
             * Tipikus offline-edit eset:
             * a szerver azóta nem változott, ezért a lokális
             * változás biztonságosan felküldhető ugyanarról syncRev-ről.
             */
            if (!worldSaveBusy.current) {
              worldSaveBusy.current = true;

              try {
                const saved =
                  await serverSaveWorld(
                    latestLocal
                  );

                if (
                  saved &&
                  saved.world
                ) {
                  const accepted =
                    migrate(
                      saved.world
                    );

                  const acceptedRev =
                    worldSyncRev(
                      accepted
                    );

                  lastSavedContent.current =
                    contentOf(
                      accepted
                    );

                  setWorld((cur) => {
                    if (!cur) return cur;

                    if (
                      contentOf(cur) ===
                      contentOf(latestLocal)
                    ) {
                      return accepted;
                    }

                    if (
                      worldSyncRev(cur) ===
                      localRev
                    ) {
                      const next =
                        JSON.parse(
                          JSON.stringify(
                            cur
                          )
                        );

                      next.syncRev =
                        acceptedRev;

                      return next;
                    }

                    return cur;
                  });

                  setSaveState("saved");
                  setSaveAt(now());
                }
              } catch (e) {
                if (
                  e &&
                  e.status === 409 &&
                  e.data &&
                  e.data.world
                ) {
                  const conflictWorld =
                    migrate(
                      e.data.world
                    );

                  const conflictContent =
                    contentOf(
                      conflictWorld
                    );

                  const localContent =
                    contentOf(
                      latestLocal
                    );

                  /*
                   * SAME-CLIENT DUPLICATE SAVE:
                   * ha a szerver pontosan ugyanazt a snapshotot tartalmazza,
                   * akkor nem "másik eszköz" frissített. Egy párhuzamos saját
                   * autosave ért célba előbb. Csendben elfogadjuk.
                   */
                  if (
                    conflictContent ===
                    localContent
                  ) {
                    lastSavedContent.current =
                      conflictContent;

                    setWorld((cur) => {
                      if (!cur) return cur;

                      if (
                        contentOf(cur) ===
                        localContent
                      ) {
                        return conflictWorld;
                      }

                      if (
                        worldSyncRev(cur) ===
                        localRev
                      ) {
                        const next =
                          JSON.parse(
                            JSON.stringify(
                              cur
                            )
                          );

                        next.syncRev =
                          worldSyncRev(
                            conflictWorld
                          );

                        return next;
                      }

                      return cur;
                    });

                    setSaveState("saved");
                    setSaveAt(now());
                  } else if (
                    conflictContent ===
                    lastSavedContent.current &&
                    worldSyncRev(conflictWorld) ===
                      localRev + 1
                  ) {
                    /*
                     * A saját előző mentésünk ért célba, miközben már van
                     * újabb lokális tartalom. Csak átvezetjük az új syncRev-et,
                     * és a következő autosave felküldi a frissebb lokális állapotot.
                     */
                    setWorld((cur) => {
                      if (!cur) return cur;

                      const next =
                        JSON.parse(
                          JSON.stringify(
                            cur
                          )
                        );

                      next.syncRev =
                        worldSyncRev(
                          conflictWorld
                        );

                      return next;
                    });

                    setSaveState("retry");
                  } else {
                    /*
                     * Valódi külső konfliktus: itt továbbra is a szerver nyer.
                     */
                    installAuthoritativeWorld(
                      conflictWorld,
                      e.data.meId || meId,
                      "reconnect-conflict"
                    );
                  }
                }
              } finally {
                worldSaveBusy.current = false;
              }
            }
          } else if (
            serverRev !== localRev
          ) {
            const serverContent =
              contentOf(
                serverWorld
              );

            const localContent =
              contentOf(
                latestLocal
              );

            /*
             * Ha a tartalom azonos, csak a szerver syncRev-je
             * van előrébb (tipikusan saját mentés ért célba).
             */
            if (
              serverContent ===
              localContent
            ) {
              lastSavedContent.current =
                serverContent;

              setWorld((cur) => {
                if (!cur) return cur;

                if (
                  contentOf(cur) ===
                  serverContent
                ) {
                  return serverWorld;
                }

                return cur;
              });

              setSaveState("saved");
            } else if (
              serverContent ===
              lastSavedContent.current &&
              serverRev ===
                localRev + 1
            ) {
              /*
               * A szerver a saját előző elfogadott állapotunk,
               * a lokális world viszont már frissebb.
               * Ne dobjuk el a lokális változást; csak vigyük át
               * rá az új syncRev-et, aztán autosave újrapróbálja.
               */
              setWorld((cur) => {
                if (!cur) return cur;

                const next =
                  JSON.parse(
                    JSON.stringify(
                      cur
                    )
                  );

                next.syncRev =
                  serverRev;

                return next;
              });

              setSaveState("retry");
            } else {
              /*
               * Valódi másik kliens/eszköz eltérő tartalma.
               * Itt továbbra is a szerver az authority.
               */
              installAuthoritativeWorld(
                serverWorld,
                session.meId,
                reason
              );
            }
          } else if (
            sameContent
          ) {
            lastSavedContent.current =
              contentOf(
                serverWorld
              );
          }

          /*
           * Média külön revisionnel szinkronizálódik.
           * A cloud az authority, hiányzó új lokális image ID
           * konfliktus esetén append-only módon visszakerülhet.
           */
          try {
            if (mediaSaveBusy.current) {
              return;
            }

            const mediaResult =
              await loadMedia(
                current.code,
                serverRev !== localRev
                  ? serverWorld
                  : wRef.current
              );

            if (
              alive &&
              mediaResult &&
              mediaResult.mode === "cloud"
            ) {
              const incomingMedia =
                mediaResult.media || {};

              const incomingJson =
                mediaFingerprint(
                  incomingMedia
                );

              mediaSyncRev.current =
                Math.max(
                  0,
                  Math.floor(
                    Number(
                      mediaResult.syncRev
                    ) || 0
                  )
                );

              if (
                incomingJson !==
                mediaFingerprint(
                  mediaRef.current || {}
                )
              ) {
                mediaRef.current =
                  incomingMedia;
                setMedia(
                  incomingMedia
                );
              }

              lastSavedMedia.current =
                incomingJson;
            }
          } catch (e) {
            console.warn(
              "Media refresh failed:",
              e
            );
          }
        } catch (e) {
          if (
            e &&
            e.status === 401
          ) {
            setSaveState("error");
            setErr(
              tt(
                "A szerveres munkameneted lejárt. A helyi biztonsági mentésed megmaradt; jelentkezz be újra.",
                "Your server session expired. Your local emergency backup is safe; please log in again."
              )
            );
          }
        } finally {
          syncRefreshBusy.current = false;
        }
      };

    const onOnline = () => {
      setSaveState("retry");
      void refreshFromServer(
        "online"
      );
    };

    const onFocus = () => {
      void refreshFromServer(
        "focus"
      );
    };

    const onVisibility = () => {
      if (
        typeof document !== "undefined" &&
        !document.hidden
      ) {
        void refreshFromServer(
          "visible"
        );
      }
    };

    const onPageHide = () => {
      const w =
        wRef.current;

      if (
        !w ||
        !w.code
      ) {
        return;
      }

      void saveWorldMerged(w);

      void cacheMediaLocally(
        w.code,
        mediaRef.current || {}
      );
    };

    if (
      typeof window !== "undefined"
    ) {
      window.addEventListener(
        "online",
        onOnline
      );

      window.addEventListener(
        "focus",
        onFocus
      );

      window.addEventListener(
        "pagehide",
        onPageHide
      );

      if (
        typeof document !== "undefined"
      ) {
        document.addEventListener(
          "visibilitychange",
          onVisibility
        );
      }

      /*
       * Nyitva hagyott két eszköz is közel valós időben
       * észreveszi egymás mentéseit, nem csak fókuszváltáskor.
       */
      const poll =
        setInterval(() => {
          if (
            typeof document === "undefined" ||
            !document.hidden
          ) {
            void refreshFromServer(
              "poll"
            );
          }
        }, 20000);

      return () => {
        alive = false;

        window.removeEventListener(
          "online",
          onOnline
        );

        window.removeEventListener(
          "focus",
          onFocus
        );

        window.removeEventListener(
          "pagehide",
          onPageHide
        );

        if (
          typeof document !== "undefined"
        ) {
          document.removeEventListener(
            "visibilitychange",
            onVisibility
          );
        }

        clearInterval(poll);
      };
    }

    return () => {
      alive = false;
    };
  }, [meId, installAuthoritativeWorld, tt]);

  /*
   * Ha konfliktus szerkesztés közben érkezett, csak az editor
   * bezárása után vesszük át az authoritative szerver-worldöt.
   */
  useEffect(() => {
    const i =
      setInterval(() => {
        const pending =
          pendingServerWorld.current;

        if (
          !pending ||
          EditLock.n > 0
        ) {
          return;
        }

        installAuthoritativeWorld(
          pending.world,
          pending.meId,
          pending.reason ||
            "deferred-conflict"
        );
      }, 500);

    return () =>
      clearInterval(i);
  }, [installAuthoritativeWorld]);

  useEffect(() => {
    if (
      !code ||
      !mediaReady.current
    ) {
      return;
    }

    if (mediaTimer.current) {
      clearTimeout(
        mediaTimer.current
      );
    }

    const snap = media;
    const mediaJson =
      mediaFingerprint(
        snap || {}
      );

    if (
      mediaJson ===
      lastSavedMedia.current
    ) {
      return;
    }

    const offline =
      typeof navigator !== "undefined" &&
      navigator.onLine === false;

    setSaveState(
      offline
        ? "local"
        : "saving"
    );

    const runMediaSave = async () => {
        if (mediaSaveBusy.current) {
          /*
           * Egy korábbi upload még fut. Nem dobjuk el az újabb
           * snapshotot: röviden várunk, aztán ugyanazt a legfrissebb
           * debounced mentést újrapróbáljuk.
           */
          mediaTimer.current =
            setTimeout(
              runMediaSave,
              650
            );
          return;
        }

        mediaSaveBusy.current = true;

        let result = null;

        for (
          let i = 0;
          i < 3;
          i++
        ) {
          result =
            await saveMedia(
              code,
              snap,
              mediaSyncRev.current
            );

          if (
            result &&
            result.ok
          ) {
            break;
          }

          if (
            result &&
            result.error &&
            result.error.status === 401
          ) {
            break;
          }

          await wait(
            1200 * (i + 1)
          );
        }

        mediaSaveBusy.current = false;

        if (
          result &&
          result.ok
        ) {
          if (
            result.mode === "cloud"
          ) {
            mediaSyncRev.current =
              Math.max(
                0,
                Math.floor(
                  Number(
                    result.syncRev
                  ) || 0
                )
              );
          }

          const acceptedMedia =
            result.media ||
            snap || {};

          const acceptedJson =
            mediaFingerprint(
              acceptedMedia
            );

          const currentJson =
            mediaFingerprint(
              mediaRef.current || {}
            );

          if (
            currentJson === mediaJson &&
            acceptedJson !== currentJson
          ) {
            mediaRef.current =
              acceptedMedia;

            setMedia(
              acceptedMedia
            );
          }

          lastSavedMedia.current =
            acceptedJson;

          setSaveState(
            result.mode === "cloud"
              ? "saved"
              : "local"
          );

          setSaveAt(now());
          return;
        }

        setSaveState(
          (
            typeof navigator !== "undefined" &&
            navigator.onLine === false
          )
            ? "local"
            : "retry"
        );

        if (
          result &&
          result.error &&
          result.error.status === 401
        ) {
          setErr(
            tt(
              "A képek felhőmentéséhez újra be kell jelentkezned. A helyi emergency másolat megmaradt.",
              "Log in again to sync images to the cloud. The local emergency copy is safe."
            )
          );
        } else {
          setErr(
            tt(
              "A képek felhőmentése most nem sikerült. A helyi emergency másolat megmaradt, és később újrapróbáljuk.",
              "Cloud image saving failed for now. The local emergency copy is safe and we'll retry later."
            )
          );
        }
      };

    mediaTimer.current =
      setTimeout(
        runMediaSave,
        1500
      );

    return () => {
      if (mediaTimer.current) {
        clearTimeout(
          mediaTimer.current
        );
      }
    };
  }, [media, code, tt]);

  const update = useCallback((fn) => {
  setWorld((prev) => {
    if (!prev) return prev;

    const n =
      JSON.parse(
        JSON.stringify(prev)
      );

    /*
     * Régi világok automatikus
     * Social Simulation migrációja.
     *
     * Csak a hiányzó mezőket hozza létre,
     * meglévő adatot nem ír felül.
     */
    ensureSocialSimulationState(n);

    fn(n);

    n.rev =
      (n.rev || 0) + 1;

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

  const enactPopupChoice = useCallback(
    async (event, choice) => {
      if (!event || !choice) return false;

      const view =
        viewRef.current;

      if (!view) return false;

      try {
        /*
         * 1) PRIVÁT STRATÉGIA
         *    -> tényleges DM
         *    -> a célkarakter rögtön válaszol
         *    -> automatikusan megnyitjuk a DM-et
         */
        if (choice.tone === "private") {
          const targetId =
            popupPrivateTargetId(
              view,
              event,
              choice
            );

          if (!targetId) {
            setErr(
              tt(
                "Ehhez a privát választáshoz nem található valódi érintett karakter.",
                "There is no real involved character available for this private response."
              )
            );

            return false;
          }

          const playerText =
            await genPopupPlayerActionText(
              view,
              event,
              choice,
              "private",
              targetId
            );

          if (!playerText) {
            throw new Error(
              tt(
                "Nem sikerült létrehozni a privát üzenetet.",
                "Couldn't create the private message."
              )
            );
          }

          let replyText = "";

          try {
            replyText =
              await genPopupPrivateReply(
                view,
                targetId,
                playerText
              );
          } catch (replyErr) {
            /*
             * A játékos DM-je ettől még megtörténik.
             * A karakter később is reagálhat.
             */
            console.warn(
              "Popup private reply generation failed:",
              replyErr
            );
          }

          update((n) => {
            const ok =
              resolvePopupEvent(
                n,
                event.id,
                choice.id
              );

            if (!ok) return;

            appendPopupPrivateConversation(
              n,
              targetId,
              playerText,
              replyText,
              event,
              choice
            );
          });

          setPopupNav({
            type:"dm",
            id:targetId,
            eventId:event.id,
            at:now(),
          });

          return true;
        }

        /*
         * 2) NYILVÁNOS STRATÉGIA
         * clarify / defend / joke / apologize / doubleDown
         * -> tényleges poszt a játékos profiljáról
         * -> Feedre ugrunk
         * -> AI kommentreakció bekerül a queue-ba
         */
        if (
          popupPublicTone(
            choice.tone
          )
        ) {
          const postText =
            await genPopupPlayerActionText(
              view,
              event,
              choice,
              "public"
            );

          if (!postText) {
            throw new Error(
              tt(
                "Nem sikerült létrehozni a nyilvános reakciót.",
                "Couldn't create the public response."
              )
            );
          }

          const postId =
            "popup_post_" +
            uid();

          update((n) => {
            const ok =
              resolvePopupEvent(
                n,
                event.id,
                choice.id
              );

            if (!ok) return;

            const p =
              appendPopupPublicPost(
                n,
                postText,
                event,
                choice,
                postId
              );

            if (p) {
              try {
                simEnqueue(
                  n,
                  mkAction(
                    "comments",
                    `popup-post:${postId}`,
                    {
                      postId,
                    },
                    "event"
                  )
                );
              } catch (queueErr) {
                console.warn(
                  "Popup comment queue failed:",
                  queueErr
                );
              }
            }
          });

          setSimPulse(
            (x) => x + 1
          );

          setPopupNav({
            type:"post",
            id:postId,
            eventId:event.id,
            at:now(),
          });

          return true;
        }

        /*
         * 3) IGNORE / NO COMMENT
         * Ezeknél a választás lényege pont az,
         * hogy nincs nyilvános/privát megszólalás.
         * A social impact és kapcsolatreakció viszont megtörténik.
         */
        update((n) =>
          resolvePopupEvent(
            n,
            event.id,
            choice.id
          )
        );

        return true;
      } catch (e) {
        console.error(
          "Popup action failed:",
          e
        );

        setErr(
          "POPUP: " +
          (
            e &&
            e.message
              ? e.message
              : tt(
                  "A választott cselekvést most nem sikerült végrehajtani.",
                  "The selected action couldn't be completed."
                )
          )
        );

        return false;
      }
    },
    [
      update,
      tt,
    ]
  );

  /*
   * A popup választás után előbb megvárjuk,
   * hogy a DM/poszt ténylegesen bekerüljön a world state-be.
   * Csak ezután váltunk Chat/Feed tabra.
   */
  useEffect(() => {
    if (
      !popupNav ||
      !world
    ) {
      return;
    }

    if (
      popupNav.type === "dm"
    ) {
      const target =
        (world.chars || [])
          .find(
            (c) =>
              c &&
              c.id ===
                popupNav.id
          );

      const ck =
        target
          ? chatKey(
              world.meId,
              target.id
            )
          : "";

      const messages =
        ck &&
        world.chats &&
        Array.isArray(
          world.chats[ck]
        )
          ? world.chats[ck]
          : [];

      const committed =
        Boolean(
          target &&
          messages.some(
            (m) =>
              m &&
              m.popupEventId ===
                popupNav.eventId
          )
        );

      if (!committed) {
        return;
      }

      setChatId(
        popupNav.id
      );

      setTab("chat");

      setPopupNav(null);

      return;
    }

    if (
      popupNav.type === "post"
    ) {
      const committed =
        (world.posts || [])
          .some(
            (p) =>
              p &&
              p.id ===
                popupNav.id
          );

      if (!committed) {
        return;
      }

      setTab("feed");

      setJump({
        type:"post",
        id:popupNav.id,
        n:now(),
      });

      setPopupNav(null);
    }
  }, [
    popupNav,
    world,
  ]);

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

    const json =
      contentOf(world);

    if (
      json ===
      lastSavedContent.current
    ) {
      return;
    }

    if (timer.current) {
      clearTimeout(
        timer.current
      );
    }

    const snap =
      JSON.parse(
        JSON.stringify(
          world
        )
      );

    const snapSyncRev =
      worldSyncRev(
        snap
      );

    const offline =
      typeof navigator !== "undefined" &&
      navigator.onLine === false;

    setSaveState(
      offline
        ? "local"
        : "saving"
    );

    timer.current =
      setTimeout(async () => {
        /*
         * 1. MINDIG emergency local backup.
         * Ez soha nem merge-el vissza automatikusan online worldbe.
         */
        let localResult = null;

        try {
          localResult =
            await saveWorldMerged(
              snap
            );
        } catch (e) {
          localResult = null;
        }

        if (
          typeof navigator !== "undefined" &&
          navigator.onLine === false
        ) {
          lastSavedContent.current =
            json;

          setSaveState("local");
          setSaveAt(now());
          return;
        }

        /*
         * 2. Revision-aware PostgreSQL save.
         */
        let serverResult = null;
        let lastError = null;

        if (worldSaveBusy.current) {
          setSaveState("retry");

          setTimeout(() => {
            setWorld((cur) => {
              if (!cur) return cur;

              /*
               * New object identity retriggers the debounced autosave,
               * while content/rev stay untouched.
               */
              return {
                ...cur,
              };
            });
          }, 700);

          return;
        }

        worldSaveBusy.current = true;

        for (
          let i = 0;
          i < 3 &&
          !serverResult;
          i++
        ) {
          try {
            const saved =
              await serverSaveWorld(
                snap
              );

            if (
              saved &&
              saved.world
            ) {
              serverResult =
                saved;
              break;
            }
          } catch (e) {
            lastError = e;

            /*
             * 409 = másik kliens már mentett.
             * NEM próbáljuk újra a stale snapshotot.
             */
            if (
              e &&
              e.status === 409
            ) {
              break;
            }

            if (
              e &&
              e.status === 401
            ) {
              break;
            }

            await wait(
              1000 * (i + 1)
            );
          }
        }

        worldSaveBusy.current = false;

        if (!serverResult) {
          setSaveAt(now());

          if (
            lastError &&
            lastError.status === 409 &&
            lastError.data &&
            lastError.data.world
          ) {
            const conflictWorld =
              migrate(
                lastError.data.world
              );

            const conflictContent =
              contentOf(
                conflictWorld
              );

            const conflictSyncRev =
              worldSyncRev(
                conflictWorld
              );

            /*
             * 1) UGYANAZ A SNAPSHOT VAN A SZERVEREN.
             * Egy saját, párhuzamos mentés ért oda előbb.
             * Ez NEM másik eszköz.
             */
            if (
              conflictContent ===
              json
            ) {
              lastSavedContent.current =
                conflictContent;

              setWorld((current) => {
                if (!current) {
                  return current;
                }

                if (
                  contentOf(current) ===
                  json
                ) {
                  return conflictWorld;
                }

                if (
                  worldSyncRev(current) ===
                  snapSyncRev
                ) {
                  const next =
                    JSON.parse(
                      JSON.stringify(
                        current
                      )
                    );

                  next.syncRev =
                    conflictSyncRev;

                  return next;
                }

                return current;
              });

              setSaveState("saved");
              setSaveAt(now());
              return;
            }

            /*
             * 2) A SZERVER A SAJÁT ELŐZŐ ELFOGADOTT ÁLLAPOTUNKAT TARTJA,
             * miközben ebben a tabban már újabb lokális módosítás van.
             *
             * Csak syncRev-et emelünk, nem dobjuk el az új lokális tartalmat.
             */
            if (
              conflictContent ===
              lastSavedContent.current &&
              conflictSyncRev ===
                snapSyncRev + 1
            ) {
              setWorld((current) => {
                if (!current) {
                  return current;
                }

                const next =
                  JSON.parse(
                    JSON.stringify(
                      current
                    )
                  );

                next.syncRev =
                  conflictSyncRev;

                return next;
              });

              setSaveState("retry");
              return;
            }

            /*
             * 3) VALÓDI ELTÉRŐ SZERVERÁLLAPOT.
             * Csak itt jelenik meg a "másik eszköz" figyelmeztetés.
             */
            setSaveState("conflict");

            installAuthoritativeWorld(
              conflictWorld,
              lastError.data.meId || meId,
              "autosave-conflict"
            );

            setErr(
              tt(
                "Egy másik eszköz közben ténylegesen módosította ezt a világot. A szerver legújabb verzióját töltöttük be; a helyi változat emergency backupként megmaradt.",
                "Another device genuinely changed this world. The newest server version was loaded; your local version remains as an emergency backup."
              )
            );

            return;
          }

          setSaveState("error");

          if (
            lastError &&
            lastError.status === 401
          ) {
            setErr(
              tt(
                "A szerveres munkameneted lejárt. Jelentkezz be újra; a helyi emergency mentésed megmaradt.",
                "Your server session expired. Log in again; your local emergency save is safe."
              )
            );
          } else {
            setErr(
              tt(
                "A felhőmentés most nem sikerült. A helyi emergency mentésed megmaradt, és később újrapróbáljuk.",
                "Cloud saving failed for now. Your local emergency save is safe and we'll retry later."
              )
            );
          }

          return;
        }

        /*
         * 3. Sikeres szerver save.
         */
        const savedWorld =
          migrate(
            serverResult.world
          );

        const savedSyncRev =
          worldSyncRev(
            savedWorld
          );

        lastSavedContent.current =
          contentOf(
            savedWorld
          );

        setSaveState("saved");
        setSaveAt(now());

        setWorld((current) => {
          if (!current) {
            return current;
          }

          const currentContent =
            contentOf(current);

          /*
           * Ha a save request alatt új lokális változás történt,
           * az új tartalmat megtartjuk, DE átvezetjük rá a szerver
           * frissen kiosztott syncRev-jét. Így a következő autosave
           * nem ütközik a saját előző mentésünkkel.
           */
          if (
            currentContent !== json
          ) {
            if (
              worldSyncRev(
                current
              ) === snapSyncRev
            ) {
              const next =
                JSON.parse(
                  JSON.stringify(
                    current
                  )
                );

              next.syncRev =
                savedSyncRev;

              return next;
            }

            return current;
          }

          return savedWorld;
        });
      }, 800);

    return () => {
      if (timer.current) {
        clearTimeout(
          timer.current
        );
      }
    };
  }, [world, meId, installAuthoritativeWorld, tt]);
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
          : saveState === "conflict"
            ? tt(
                "Másik eszköz frissített – szerververzió betöltése…",
                "Another device updated this world – loading server version…"
              )
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

  /*
   * Ha a játékos épp DM-et küld, group chatet vagy RP-lépést kér,
   * a háttérvilág ne tegyen még egy AI-kérést elé.
   */
  if (
    !manualQueued &&
    AI.interactivePending > 0
  ) {
    return;
  }

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
          setErr(
  "SIM: " +
  (
    (e && e.message)
      ? e.message
      : tt(
          "Az AI-kérés nem sikerült.",
          "AI request failed."
        )
  )
);
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
  const activePopup = currentPopupEvent(view);

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
            onOpenWorlds={() => setShowRooms(true)}
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

      {activePopup ? (
        <PopupEventModal
          w={view}
          event={activePopup}
          update={update}
          onChoose={enactPopupChoice}
        />
      ) : null}

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
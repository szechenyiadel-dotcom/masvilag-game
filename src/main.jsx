import React from "react";
import ReactDOM from "react-dom/client";
import "./socialWorldPolicy";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

/* New-version notice: an open tab (especially on a phone) keeps running the old
   code after a deploy. Every 2 minutes we compare the deployed bundle with the
   running one and offer a one-tap reload. */
(function watchForNewVersion() {
  const current = Array.from(document.querySelectorAll("script[type=module][src]"))
    .map((s) => (s.getAttribute("src") || "").split("/").pop())
    .find((name) => /^index-.*\.js$/.test(name));
  if (!current) return;
  let shown = false;
  const check = async () => {
    if (shown || document.hidden) return;
    try {
      const res = await fetch("/?v=" + Date.now(), { cache: "no-store" });
      const html = await res.text();
      const match = html.match(/assets\/(index-[^"']+\.js)/);
      if (!match || match[1] === current) return;
      shown = true;
      const en = (document.documentElement.lang || navigator.language || "").toLowerCase().startsWith("en") ||
        /Post|Feed|Messages/.test(document.body.innerText.slice(0, 4000));
      const bar = document.createElement("button");
      bar.type = "button";
      bar.textContent = en ? "A new version is available — tap to reload" : "Új verzió érhető el — koppints a frissítéshez";
      bar.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));z-index:99999;padding:10px 16px;border-radius:999px;border:0;background:linear-gradient(180deg,#12804C,#0A5232);color:#fff;font:600 13px 'Hanken Grotesk',system-ui,sans-serif;box-shadow:0 10px 28px rgba(43,224,122,.22);cursor:pointer";
      bar.onclick = () => window.location.reload();
      document.body.appendChild(bar);
    } catch (error) {
      /* offline or server restarting — try again later */
    }
  };
  setInterval(check, 120000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
})();

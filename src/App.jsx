--- /mnt/data/PROXY_BACKEND_CAPACITY_FRESH_RETRY_FIXED.txt	2026-09-27 17:48:15.644075049 +0000
+++ /mnt/data/PROXY_BACKEND_RUNTIME_SAFE_FIXED.txt	2026-09-27 17:49:25.378605186 +0000
@@ -6495,52 +6495,17 @@
     let finalLimited = first.limited.slice();
 
     /*
-     * Automatic interactive recovery: if the providers really returned 429,
-     * keep this one request pending until the earliest advertised/recorded slot
-     * (bounded). Then retry ONCE with the smaller interactive payload. This
-     * replaces the old visible 12/22/39 second client cooldown and manual retry.
+     * RUNTIME-SAFE INTERACTIVE FAILURE PATH
+     * -------------------------------------
+     * Do not keep Railway HTTP requests open in a long provider recovery loop.
+     * runPass() has already tried every currently available configured provider.
+     * Interactive requests also ignore stale cached provider cooldowns, so every
+     * send gets one fresh upstream probe. If all providers refuse that fresh pass,
+     * return promptly and let the existing client-side bounded retry handle the
+     * transient race without pinning a server worker.
      */
-    if (interactiveRequest && finalLimited.length) {
-      const recoveryStartedAt = Date.now();
-      const retryBody = compactInteractiveMessageBodyForRateLimit(incomingBody);
-      let recoveryPass = 0;
-
-      while (
-        recoveryPass < 3 &&
-        Date.now() - recoveryStartedAt < AI_INTERACTIVE_RATE_LIMIT_RECOVERY_MS
-      ) {
-        const waits = finalLimited
-          .map((x) => retryAfterMs(x?.retryAfter, 1800))
-          .filter((ms) => Number.isFinite(ms) && ms > 0);
-        const shortestWait = waits.length ? Math.min(...waits) : 1800;
-        const remaining = AI_INTERACTIVE_RATE_LIMIT_RECOVERY_MS -
-          (Date.now() - recoveryStartedAt);
-        if (remaining <= 250) break;
-
-        /* Never expose a cooldown to the browser. Keep this ONE HTTP request
-           pending asynchronously and retry only after a modest bounded delay. */
-        await sleepMs(Math.min(Math.max(350, shortestWait) + 90, remaining));
-        recoveryPass++;
-
-        const recovered = await runPass(retryBody);
-        finalLimited = finalLimited.concat(recovered.limited || []);
-
-        if (recovered.ok) {
-          const result = recovered.result;
-          res.setHeader(
-            "x-masvilag-ai-provider",
-            result.provider || requestedProvider
-          );
-          res.setHeader("x-masvilag-ai-auto-recovery", String(recoveryPass));
-          return res.json(result.payload);
-        }
-
-        /* Keep only the newest limited results so an old cached Retry-After does
-           not dominate the next recovery decision. */
-        if (Array.isArray(recovered.limited) && recovered.limited.length) {
-          finalLimited = recovered.limited.slice();
-        }
-      }
+    if (interactiveRequest && first.limited.length) {
+      res.setHeader("x-masvilag-ai-runtime-safe", "1");
     }
 
     const upstreamStatus = Number(last?.status) || 503;

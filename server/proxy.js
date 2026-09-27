--- /mnt/data/PROXY_BACKEND_CAPACITY_QUEUE_FIXED.txt	2026-09-27 17:44:36.956647092 +0000
+++ /mnt/data/PROXY_BACKEND_CAPACITY_FRESH_RETRY_FIXED.txt	2026-09-27 17:44:40.867111005 +0000
@@ -5101,7 +5101,7 @@
    the user never has to press Send again. */
 const AI_INTERACTIVE_RATE_LIMIT_RECOVERY_MS = Math.max(
   2500,
-  Math.min(15000, Number(process.env.AI_INTERACTIVE_RATE_LIMIT_RECOVERY_MS) || 12000)
+  Math.min(22000, Number(process.env.AI_INTERACTIVE_RATE_LIMIT_RECOVERY_MS) || 18000)
 );
 const AI_BACKGROUND_AFTER_INTERACTIVE_GRACE_MS = Math.max(
   1500,
@@ -6361,11 +6361,12 @@
 
       for (const provider of providers) {
         /*
-         * Do not reject a Scene/DM because of an OLD cached Retry-After.
-         * Interactive traffic gets one fresh probe; background traffic still
-         * honors the circuit-breaker.
+         * Cached provider cooldowns are ONLY a background circuit-breaker.
+         * A player-triggered Scene/DM must always get one fresh upstream probe
+         * per configured provider on each send; otherwise a stale cached 429
+         * can create a false capacity failure without contacting the provider.
          */
-        const throttled = providerCooldownResult(provider);
+        const throttled = interactive ? null : providerCooldownResult(provider);
         if (throttled) {
           last = throttled;
           limited.push(throttled);
@@ -6500,26 +6501,45 @@
      * replaces the old visible 12/22/39 second client cooldown and manual retry.
      */
     if (interactiveRequest && finalLimited.length) {
-      const waits = finalLimited
-        .map((x) => retryAfterMs(x?.retryAfter, 2200))
-        .filter((ms) => Number.isFinite(ms) && ms > 0);
-      const shortestWait = waits.length ? Math.min(...waits) : 2200;
-
-      if (shortestWait <= AI_INTERACTIVE_RATE_LIMIT_RECOVERY_MS) {
-        await sleepMs(Math.max(250, shortestWait) + 90);
-        const retryBody = compactInteractiveMessageBodyForRateLimit(incomingBody);
-        const second = await runPass(retryBody);
-        finalLimited = finalLimited.concat(second.limited || []);
+      const recoveryStartedAt = Date.now();
+      const retryBody = compactInteractiveMessageBodyForRateLimit(incomingBody);
+      let recoveryPass = 0;
+
+      while (
+        recoveryPass < 3 &&
+        Date.now() - recoveryStartedAt < AI_INTERACTIVE_RATE_LIMIT_RECOVERY_MS
+      ) {
+        const waits = finalLimited
+          .map((x) => retryAfterMs(x?.retryAfter, 1800))
+          .filter((ms) => Number.isFinite(ms) && ms > 0);
+        const shortestWait = waits.length ? Math.min(...waits) : 1800;
+        const remaining = AI_INTERACTIVE_RATE_LIMIT_RECOVERY_MS -
+          (Date.now() - recoveryStartedAt);
+        if (remaining <= 250) break;
+
+        /* Never expose a cooldown to the browser. Keep this ONE HTTP request
+           pending asynchronously and retry only after a modest bounded delay. */
+        await sleepMs(Math.min(Math.max(350, shortestWait) + 90, remaining));
+        recoveryPass++;
+
+        const recovered = await runPass(retryBody);
+        finalLimited = finalLimited.concat(recovered.limited || []);
 
-        if (second.ok) {
-          const result = second.result;
+        if (recovered.ok) {
+          const result = recovered.result;
           res.setHeader(
             "x-masvilag-ai-provider",
             result.provider || requestedProvider
           );
-          res.setHeader("x-masvilag-ai-auto-recovery", "1");
+          res.setHeader("x-masvilag-ai-auto-recovery", String(recoveryPass));
           return res.json(result.payload);
         }
+
+        /* Keep only the newest limited results so an old cached Retry-After does
+           not dominate the next recovery decision. */
+        if (Array.isArray(recovered.limited) && recovered.limited.length) {
+          finalLimited = recovered.limited.slice();
+        }
       }
     }
 

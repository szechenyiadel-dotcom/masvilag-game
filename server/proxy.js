--- /mnt/data/Beacon_Falls_gyorsabb_komment_DM_CURRENT.txt	2026-09-27 15:41:11.407823341 +0000
+++ /mnt/data/Beacon_Falls_CURRENT_scene_reply_fix.txt	2026-09-27 15:44:00.023628705 +0000
@@ -44828,7 +44828,10 @@
       {
         maxTokens: 420,
         maxTries: 2,
-        timeoutMs: 22000,
+        maxBusyWaits: 1,
+        timeoutMs: 9000,
+        maxSystemChars: 9000,
+        maxPromptChars: 12000,
       }
     );
 
@@ -45252,7 +45255,14 @@
  "relationshipUpdates":[
   {"id":"AI id","targetId":"a másik konkrét karakter id-ja","currentFeeling":"csak az adott ember felé MOST élő érzés vagy üres","currentIntent":"mit akar vele kapcsolatban következőnek vagy üres","lastTone":"az interakció tényleges hangneme röviden vagy üres","perceivedTargetMood":"amit az AI a látható jelekből a másik hangulatáról HISZ; lehet téves vagy üres","addOpenLoops":["új, ténylegesen félbemaradt kérdés/ügy"],"resolveOpenLoops":["az a korábbi nyitott ügy, ami MOST ténylegesen lezárult"],"addPromises":["csak explicit ígéret/vállalás"],"resolvePromises":["most teljesült/visszavont ígéret"],"addPlans":["konkrét közös jövőbeli terv"],"resolvePlans":["most teljesült/lemondott terv"]}
 ]
-}${TAIL}`));
+}${TAIL}`, {
+  maxTokens: 900,
+  maxTries: 2,
+  maxBusyWaits: 2,
+  timeoutMs: 18000,
+  maxSystemChars: 16000,
+  maxPromptChars: 24000,
+}));
 
       const resolveSceneTurns = (candidateOut) =>
         (candidateOut && Array.isArray(candidateOut.turns)
@@ -45407,8 +45417,12 @@
 VÁLASZ CSAK JSON:
 {"turns":[{"id":"pontos karakter-ID vagy narrator","kind":"speech vagy action","text":"friss megszólalás vagy cselekvés"}],"changes":[],"memories":[],"sceneMemory":{"summary":"","continuity":[],"resolvedContinuity":[],"openThreads":[],"resolvedOpenThreads":[],"participantStates":[],"sceneState":{"location":"","currentBeat":"","intimacyStage":"","boundaries":[]}},"longTermMemories":[],"events":[]}${TAIL}`,
           {
-            maxTokens: 1500,
-            maxTries: 3,
+            maxTokens: 850,
+            maxTries: 2,
+            maxBusyWaits: 2,
+            timeoutMs: 14000,
+            maxSystemChars: 12000,
+            maxPromptChars: 16000,
           }
         ));
 
@@ -45513,9 +45527,12 @@
 JSON ONLY:
 {"turns":[{"id":"one of the missing exact IDs","to":"present target ID or empty","kind":"speech or action","text":"one fresh natural beat"}]}${TAIL}`,
                 {
-                  maxTokens: Math.max(420, Math.min(1100, 260 * missingChars.length)),
+                  maxTokens: Math.max(320, Math.min(650, 180 * missingChars.length)),
                   maxTries: 2,
-                  timeoutMs: 26000,
+                  maxBusyWaits: 1,
+                  timeoutMs: 9000,
+                  maxSystemChars: 9000,
+                  maxPromptChars: 14000,
                 }
               )
             );

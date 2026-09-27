--- /mnt/data/App-fixed_social_fixes_v7_crashfix.txt	2026-09-27 15:22:57.462093906 +0000
+++ /mnt/data/App-fixed_social_fixes_v9_scene_safe_409fix.txt	2026-09-27 15:36:05.633282550 +0000
@@ -1543,7 +1543,10 @@
 
         const since = now() - AI.last;
         const minimumGap = task.priority >= 100 ? 500 : AI.gap;
-        const costGap = Math.max(0, Number(AI.lastCostGap) || 0);
+        const rawCostGap = Math.max(0, Number(AI.lastCostGap) || 0);
+        const costGap = Number.isFinite(Number(task.costGapCap))
+          ? Math.min(rawCostGap, Math.max(0, Number(task.costGapCap)))
+          : rawCostGap;
         const gap = Math.max(minimumGap, costGap);
         if (since < gap) await wait(gap - since);
 
@@ -1560,11 +1563,12 @@
 }
 
 /* Valódi prioritásos sor: priority >= 100 = közvetlen játékosi DM/Event. */
-function queued(fn, priority = 0) {
+function queued(fn, priority = 0, costGapCap = null) {
   return new Promise((resolve, reject) => {
     AI.queue.push({
       fn,
       priority: Number(priority) || 0,
+      costGapCap,
       seq: ++AI.queueSeq,
       resolve,
       reject,
@@ -1765,7 +1769,7 @@
         throw err;
       }
       throw last || new Error("Hibás válasz");
-    }, Number(options.priority || 0));
+    }, Number(options.priority || 0), options.costGapCap);
   } finally { AI.pending--; }
 }
 
@@ -2840,12 +2844,18 @@
   });
 }
 
-async function serverSaveWorld(world) {
+async function serverSaveWorld(world, expectedSyncRevOverride = null) {
+  const worldSyncRev = Math.max(0, Math.floor(Number(world && world.syncRev) || 0));
+  const overrideSyncRev = Number(expectedSyncRevOverride);
+  const expectedSyncRev = Number.isFinite(overrideSyncRev)
+    ? Math.max(worldSyncRev, Math.floor(overrideSyncRev))
+    : worldSyncRev;
+
   const saved = await apiJson("/world/save", {
     method: "POST",
     body: JSON.stringify({
       world,
-      syncRev: Math.max(0, Math.floor(Number(world && world.syncRev) || 0)),
+      syncRev: expectedSyncRev,
     }),
   });
 
@@ -6860,7 +6870,6 @@
     {tt("Mentés", "Save")}
   </button>
 </div>
-        )}
       </div>
     </div>
   );
@@ -7438,7 +7447,7 @@
 {"turns":[{"id":"a szereplő szögletes zárójelben megadott azonosítója szó szerint, vagy narrator","kind":"speech vagy action","text":"..."}],
  "changes":[{"a":"aki érez","b":"aki iránt","delta":10,"mood":"mit érez most iránta","why":"egy rövid mondat","bond":"csak ha a viszony tényleg megváltozott, és nem állandó kötelék"}],
  "memories":[{"id":"szereplő azonosítója","text":"amit ebből megjegyez"}],
- "events":["egy mondat, ha a világ szempontjából fontos történt"]}${TAIL}`, { maxTokens: 800, priority: 120 });
+ "events":["egy mondat, ha a világ szempontjából fontos történt"]}${TAIL}`, { maxTokens: 650, priority: 120, costGapCap: 5000 });
 
       const resolved = (out.turns || []).map((t) => {
         const raw = t && (t.id !== undefined ? t.id : t.name);
@@ -12108,6 +12117,7 @@
   const [media, setMedia] = useState({});
   const wRef = useRef(null);
   const timer = useRef(null);
+  const serverSyncRevRef = useRef(0);
   const mediaRef = useRef({});
   const mediaTimer = useRef(null);
   const mediaReady = useRef(false);
@@ -12130,6 +12140,12 @@
   const [saveAt, setSaveAt] = useState(0);
   const lastSavedMedia = useRef("");
   wRef.current = world;
+  if (world) {
+    serverSyncRevRef.current = Math.max(
+      Number(serverSyncRevRef.current) || 0,
+      Number(world.syncRev) || 0
+    );
+  }
   mediaRef.current = media;
 
   useEffect(() => {
@@ -12810,20 +12826,37 @@
       i++
     ) {
       try {
+        const expectedSyncRev = Math.max(
+          Number(snap && snap.syncRev) || 0,
+          Number(serverSyncRevRef.current) || 0
+        );
         const saved =
-          await serverSaveWorld(snap);
+          await serverSaveWorld(snap, expectedSyncRev);
 
         if (saved && saved.world) {
+          serverSyncRevRef.current = Math.max(
+            Number(serverSyncRevRef.current) || 0,
+            Number(saved.syncRev) || 0,
+            Number(saved.world.syncRev) || 0
+          );
           serverResult = saved;
           break;
         }
       } catch (e) {
         lastError = e;
 
-        /*
-          Lejárt / érvénytelen session esetén
-          nincs értelme háromszor ugyanazt próbálni.
-        */
+        /* 409-nél nem módosítjuk a React world state-et. Csak megjegyezzük
+           a szerver authoritative rev-jét, és ugyanazt a helyi snapshotot
+           egyszer újraküldjük már a friss expectedSyncRev-vel. */
+        if (e && e.status === 409 && e.data && Number.isFinite(Number(e.data.serverSyncRev))) {
+          serverSyncRevRef.current = Math.max(
+            Number(serverSyncRevRef.current) || 0,
+            Number(e.data.serverSyncRev) || 0
+          );
+          await wait(120);
+          continue;
+        }
+
         if (e && e.status === 401) {
           break;
         }

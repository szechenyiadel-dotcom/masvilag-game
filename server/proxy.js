--- /mnt/data/App-fixed_social_fixes_v7_crashfix.txt	2026-09-27 15:22:57.462093906 +0000
+++ /mnt/data/App-fixed_social_fixes_v8_scene_409fix.txt	2026-09-27 15:29:36.625984713 +0000
@@ -1543,7 +1543,9 @@
 
         const since = now() - AI.last;
         const minimumGap = task.priority >= 100 ? 500 : AI.gap;
-        const costGap = Math.max(0, Number(AI.lastCostGap) || 0);
+        const rawCostGap = Math.max(0, Number(AI.lastCostGap) || 0);
+        /* Interaktív DM/Scene ne örökölhessen akár 45 mp háttér-TPM várakozást. */
+        const costGap = task.priority >= 100 ? Math.min(5000, rawCostGap) : rawCostGap;
         const gap = Math.max(minimumGap, costGap);
         if (since < gap) await wait(gap - since);
 
@@ -7406,6 +7408,8 @@
   const patch = (fn) => update((n) => { const s = n.scenes.find((x) => x.id === scene.id); if (s) fn(s, n); });
 
   const advance = async (playerText) => {
+    if (sendLockRef.current) return;
+    sendLockRef.current = true;
     setBusy("turn");
     if (playerText) patch((s) => { s.turns.push({ authorId: w.meId, kind: "action", text: playerText, ts: now() }); });
     try {
@@ -7438,7 +7442,7 @@
 {"turns":[{"id":"a szereplő szögletes zárójelben megadott azonosítója szó szerint, vagy narrator","kind":"speech vagy action","text":"..."}],
  "changes":[{"a":"aki érez","b":"aki iránt","delta":10,"mood":"mit érez most iránta","why":"egy rövid mondat","bond":"csak ha a viszony tényleg megváltozott, és nem állandó kötelék"}],
  "memories":[{"id":"szereplő azonosítója","text":"amit ebből megjegyez"}],
- "events":["egy mondat, ha a világ szempontjából fontos történt"]}${TAIL}`, { maxTokens: 800, priority: 120 });
+ "events":["egy mondat, ha a világ szempontjából fontos történt"]}${TAIL}`, { maxTokens: 650, priority: 120 });
 
       const resolved = (out.turns || []).map((t) => {
         const raw = t && (t.id !== undefined ? t.id : t.name);
@@ -7473,6 +7477,7 @@
     } catch (e) {
       setErr(((e && e.message) ? e.message + " " : "") + tt("Nyomd meg még egyszer — ha újra elakad, rövidítsd a helyzet leírását vagy csökkentsd a szereplők számát.", "Press it again — if it gets stuck again, shorten the situation description or reduce the number of characters."));
     }
+    sendLockRef.current = false;
     setBusy("");
   };
 
@@ -12108,6 +12113,7 @@
   const [media, setMedia] = useState({});
   const wRef = useRef(null);
   const timer = useRef(null);
+  const worldSaveBusy = useRef(false);
   const mediaRef = useRef({});
   const mediaTimer = useRef(null);
   const mediaReady = useRef(false);
@@ -12799,11 +12805,19 @@
 
     /*
       2. PostgreSQL autosave.
-      Ezt legfeljebb háromszor próbáljuk meg.
+      Egyszerre csak egy world/save futhat. A 409 stale snapshotot NEM
+      küldjük el háromszor ugyanazzal a syncRev-vel.
     */
     let serverResult = null;
     let lastError = null;
 
+    if (worldSaveBusy.current) {
+      setSaveState("retry");
+      return;
+    }
+
+    worldSaveBusy.current = true;
+
     for (
       let i = 0;
       i < 3 && !serverResult;
@@ -12820,11 +12834,9 @@
       } catch (e) {
         lastError = e;
 
-        /*
-          Lejárt / érvénytelen session esetén
-          nincs értelme háromszor ugyanazt próbálni.
-        */
-        if (e && e.status === 401) {
+        /* 409-nél a szerver rev-je már előrébb jár: ugyanazt a stale
+           snapshotot újraküldeni csak újabb 409-et gyártana. */
+        if (e && (e.status === 409 || e.status === 401)) {
           break;
         }
 
@@ -12832,6 +12844,37 @@
       }
     }
 
+    worldSaveBusy.current = false;
+
+    /*
+      409: átvezetjük a szerver aktuális syncRev-jét a legfrissebb helyi
+      állapotra. A következő debounced autosave már friss rev-vel indul.
+      Tartalmat itt nem dobunk el és nem merge-elünk, ezért nincs crash-kockázat.
+    */
+    if (
+      !serverResult &&
+      lastError &&
+      lastError.status === 409 &&
+      lastError.data &&
+      Number.isFinite(Number(lastError.data.serverSyncRev))
+    ) {
+      const serverSyncRev = Math.max(0, Math.floor(Number(lastError.data.serverSyncRev) || 0));
+
+      setWorld((current) => {
+        if (!current) return current;
+        const currentSyncRev = Math.max(0, Math.floor(Number(current.syncRev) || 0));
+        if (currentSyncRev >= serverSyncRev) return current;
+        const next = JSON.parse(JSON.stringify(current));
+        next.syncRev = serverSyncRev;
+        return next;
+      });
+
+      setSaveState("retry");
+      setSaveAt(now());
+      setErr("");
+      return;
+    }
+
     /*
       A helyi backup megvan, de a szerveres mentés nem.
     */
@@ -12895,6 +12938,18 @@
       chatválasz — a régi szerverválasz SOHA ne írja felül.
     */
     if (contentOf(current) !== json) {
+      const currentSyncRev = Math.max(0, Math.floor(Number(current.syncRev) || 0));
+      const savedSyncRev = Math.max(0, Math.floor(Number(savedWorld.syncRev) || 0));
+
+      /* A save közben érkezett új Scene/chat változást megtartjuk, de a
+         szerver által kiosztott friss syncRev-et átvezetjük rá. Enélkül a
+         következő autosave saját magunk előző mentésével ütközik 409-re. */
+      if (savedSyncRev > currentSyncRev) {
+        const next = JSON.parse(JSON.stringify(current));
+        next.syncRev = savedSyncRev;
+        return next;
+      }
+
       return current;
     }
 

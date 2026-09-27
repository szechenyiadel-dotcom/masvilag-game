--- /mnt/data/App-fixed_social_fixes_v5_429_media409.jsx	2026-09-27 14:25:16.387687869 +0000
+++ /mnt/data/App-fixed_social_fixes_v6_scene_cloudfix.jsx	2026-09-27 15:00:08.069009239 +0000
@@ -2841,25 +2841,63 @@
 }
 
 async function serverSaveWorld(world) {
-  const saved = await apiJson("/world/save", {
-    method: "POST",
-    body: JSON.stringify({
-      world,
-      syncRev: Math.max(0, Math.floor(Number(world && world.syncRev) || 0)),
-    }),
-  });
+  /*
+   * WORLD_CONFLICT FIX:
+   * a szerver authoritative syncRev-et használ. Ha közben egy másik mentés
+   * előrébb vitte a világot, nem ugyanazt a stale snapshotot küldjük vissza
+   * újra és újra, hanem a 409-ben kapott szervervilággal összefésüljük,
+   * átveszük az aktuális syncRev-et, majd csak ezt az egy mentést próbáljuk újra.
+   */
+  let candidate = JSON.parse(JSON.stringify(world));
+
+  for (let attempt = 0; attempt < 3; attempt += 1) {
+    try {
+      const saved = await apiJson("/world/save", {
+        method: "POST",
+        body: JSON.stringify({
+          world: candidate,
+          syncRev: Math.max(0, Math.floor(Number(candidate && candidate.syncRev) || 0)),
+        }),
+      });
+
+      /* A jelenlegi backend sikeres hot save-nél csak {ok, syncRev, rev, meId}
+         metaadatot küld vissza. Ugyanazt az elfogadott snapshotot adjuk vissza
+         a szerver új rev-jeivel. */
+      if (saved && saved.ok === true && (!saved.world || typeof saved.world !== "object")) {
+        const accepted = JSON.parse(JSON.stringify(candidate));
+        if (Number.isFinite(Number(saved.syncRev))) accepted.syncRev = Number(saved.syncRev);
+        if (Number.isFinite(Number(saved.rev))) accepted.rev = Number(saved.rev);
+        return { ...saved, world: accepted };
+      }
 
-  /* A jelenlegi backend sikeres hot save-nél csak {ok, syncRev, rev, meId}
-     metaadatot küld vissza. A kliens régi mentési kódja viszont saved.world-öt
-     vár. Ugyanazt az elfogadott snapshotot adjuk vissza a szerver új rev-jeivel. */
-  if (saved && saved.ok === true && (!saved.world || typeof saved.world !== "object")) {
-    const accepted = JSON.parse(JSON.stringify(world));
-    if (Number.isFinite(Number(saved.syncRev))) accepted.syncRev = Number(saved.syncRev);
-    if (Number.isFinite(Number(saved.rev))) accepted.rev = Number(saved.rev);
-    return { ...saved, world: accepted };
+      return saved;
+    } catch (e) {
+      const conflict =
+        e &&
+        e.status === 409 &&
+        e.data &&
+        e.data.code === "WORLD_CONFLICT" &&
+        e.data.world &&
+        typeof e.data.world === "object";
+
+      if (!conflict || attempt >= 2) throw e;
+
+      const remote = migrate(e.data.world);
+      candidate = mergeWorlds(remote, candidate);
+      candidate.syncRev = Math.max(
+        0,
+        Math.floor(
+          Number(e.data.serverSyncRev) ||
+          Number(remote && remote.syncRev) ||
+          0
+        )
+      );
+
+      await wait(120 + attempt * 180);
+    }
   }
 
-  return saved;
+  throw new Error("World save conflict could not be resolved.");
 }
 function migrate(w) {
   if (!w || !w.universe) return w;
@@ -7415,7 +7453,7 @@
         return `${a ? a.name : "?"}: ${t.text}`;
       }).join("\n");
 
-      const out = await askWorldJSON(w, engineFor(w), `${worldContext(w, scene.cast, true, null)}
+      const out = await askWorldJSON(w, engineFor(w), `${worldContext(w, scene.cast, false, null)}
 
 JELENET: ${scene.title}
 HELYZET: ${scene.setting || "-"}
@@ -7426,10 +7464,10 @@
 
 ${playerText ? `${w.player.name} most ezt teszi vagy mondja:\n"${playerText}"` : "A játékos most nem lép közbe; a szereplők maguktól viszik tovább a jelenetet."}
 
-${cast.slice(0, 3).map(voiceCard).join("")}
+${cast.slice(0, 2).map(voiceCard).join("")}
 ${repetitionGuard(w, cast.map((c) => c.id), "jelenetfolytatás")}
 
-Írd meg a folytatást 3-5 mozzanatban, minden mozzanat 2-4 jól megírt mondatból. Ne legyenek rövid, lapos, sablonos sorok, és ne ismételd ugyanazt a ritmust vagy a szókincset.
+Írd meg a folytatást 2-4 mozzanatban, minden mozzanat 1-3 jól megírt mondatból. Ne legyenek rövid, lapos, sablonos sorok, és ne ismételd ugyanazt a ritmust vagy a szókincset.
 Mindenki a SAJÁT hangmintája szerint szólaljon meg — a mondataik ne legyenek felcserélhetők, ne legyenek gépiesen egyformák, és ne hangozzanak úgy, mintha egyetlen, közös beszédmód lenne.
 Ha ${w.player.name} karakterhez beszélnek, tegezzék, E/2-ben; magukról E/1-ben beszélnek. Feszes jelenet legyen: párbeszéd és cselekvés, nem összefoglaló. A párbeszédek legyenek természetesek, hosszabbak, színesek, irodalmibbak, magyarul hibátlanul megfogalmazva.
 A "narrator" a jelenet leírása (mit látni, mit hallani, milyen a hangulat) — legfeljebb egy ilyen legyen, és ne legyen semleges, hanem érzékletes, pontos, könyvesen megírt.
@@ -7438,7 +7476,7 @@
 {"turns":[{"id":"a szereplő szögletes zárójelben megadott azonosítója szó szerint, vagy narrator","kind":"speech vagy action","text":"..."}],
  "changes":[{"a":"aki érez","b":"aki iránt","delta":10,"mood":"mit érez most iránta","why":"egy rövid mondat","bond":"csak ha a viszony tényleg megváltozott, és nem állandó kötelék"}],
  "memories":[{"id":"szereplő azonosítója","text":"amit ebből megjegyez"}],
- "events":["egy mondat, ha a világ szempontjából fontos történt"]}${TAIL}`, { maxTokens: 1200, priority: 120 });
+ "events":["egy mondat, ha a világ szempontjából fontos történt"]}${TAIL}`, { maxTokens: 800, priority: 120 });
 
       const resolved = (out.turns || []).map((t) => {
         const raw = t && (t.id !== undefined ? t.id : t.name);

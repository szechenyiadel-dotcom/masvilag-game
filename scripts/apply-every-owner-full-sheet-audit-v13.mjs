import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const appPath=path.join(root,"src","App.jsx");
let next=fs.readFileSync(appPath,"utf8");
const MARKER="MÁSVILÁG EVERY OWNER FULL SHEET AUDIT v13";
function renameOne(name,replacement){const rx=new RegExp("function\\s+"+name+"\\s*\\(");const m=[...next.matchAll(new RegExp(rx.source,"g"))];if(m.length!==1)throw new Error("Relationship v13 aborted: "+name+" expected once, found "+m.length);next=next.replace(rx,"function "+replacement+"(");}
if(!next.includes("/* "+MARKER+" */")){
 renameOne("relationshipReadingDueTargets","legacyV13RelationshipReadingDueTargets");
 renameOne("runRelationshipReadingAction","legacyV13RunRelationshipReadingAction");
 renameOne("relationshipReadingHash","legacyV13RelationshipReadingHash");
 renameOne("relationshipReadingCacheKey","legacyV13RelationshipReadingCacheKey");
 const helper=`
/* ${MARKER} */
function relV13ActiveTargets(w,actor){
 return allSubjects(w).filter(t=>t&&t.id&&t.id!==actor.id&&!isMediaAccount(w,t.id));
}
function relV13OwnerAuditHash(actor){
 return simsSocialStableHash("v13-owner-full-sheet|"+relV8FullOwnSheet(actor));
}
function relV13OwnerComplete(w,actor){
 const st=relationshipReadingState(w);
 const meta=st&&st[actor.id];
 if(!meta||meta.ownerAuditHash!==relV13OwnerAuditHash(actor)) return false;
 const targets=meta.targets||{};
 return relV13ActiveTargets(w,actor).every(t=>{
   const snippet=relationshipReadingSnippet(w,actor,t);
   const row=targets[t.id];
   return Boolean(snippet&&row&&row.hash===relationshipReadingHash(snippet));
 });
}
function relationshipReadingDueTargets(w,actor){
 const state=relationshipReadingState(w);
 const meta=state&&state[actor.id];
 const ownerChanged=!meta||meta.ownerAuditHash!==relV13OwnerAuditHash(actor);
 const targets=relV13ActiveTargets(w,actor).map(target=>({target,snippet:relationshipReadingSnippet(w,actor,target)})).filter(r=>r.snippet);
 if(ownerChanged) return targets;
 const done=(meta&&meta.targets)||{};
 return targets.filter(r=>!done[r.target.id]||done[r.target.id].hash!==relationshipReadingHash(r.snippet));
}
async function runRelationshipReadingAction(view,update,action){
 const actorId=String(action&&action.payload&&action.payload.actorId||"");
 const actor=charById(view,actorId);
 update(n=>{ensureSimState(n).relationshipReadingLastAt=now();});
 if(!actor) return null;
 /* v13 HARD: when an owner is due, audit that owner's ENTIRE current sheet against EVERY active target.
    Never let a pair-level cache make Tandy or any other owner skip the full-sheet pass. */
 const due=relationshipReadingDueTargets(view,actor);
 if(!due.length){
   update(n=>{const st=relationshipReadingState(n);st[actor.id]={...(st[actor.id]||{}),ownerAuditHash:relV13OwnerAuditHash(charById(n,actor.id)||actor),ownerAuditComplete:true,ownerAuditAt:now()};});
   return "relationship-reading-nothing";
 }
 let out=null;
 try{out=await genRelationshipReading(view,actor,due);}
 catch(error){
   update(n=>{const st=relationshipReadingState(n);st[actor.id]={...(st[actor.id]||{}),failedAt:now(),ownerAuditComplete:false};groundedEventLog(n,"relationship-reading","failed",actor.name+": "+String(error&&error.message||error||"AI error"),"sheet:"+actor.id);});
   return null;
 }
 if(out&&out.skip===true) return "relationship-reading-skip";
 const rows=Array.isArray(out&&out.targets)?out.targets:[];
 /* Missing target rows are NOT success. They stay due, so the owner cannot be marked complete. */
 try{relationshipReadingCachePut(view,[{actor,due,out}]);}catch(_){}
 update(n=>{
   applyRelationshipReadingRows(n,actor.id,due,rows);
   const liveActor=charById(n,actor.id)||actor;
   const st=relationshipReadingState(n);
   const meta=st[actor.id]||(st[actor.id]={targets:{}});
   meta.ownerAuditHash=relV13OwnerAuditHash(liveActor);
   meta.ownerAuditComplete=relV13OwnerComplete(n,liveActor);
   meta.ownerAuditAt=now();
 });
 return "relationship-reading";
}
function relationshipReadingHash(snippet){return simsSocialStableHash("v13-every-owner-full-sheet|"+String(snippet||""));}
function relationshipReadingCacheKey(actor,target,snippet){return "rr13-every-owner:"+simsSocialStableHash(String(actor&&actor.name||"")+"|"+String(target&&target.name||"")+"|"+relationshipReadingHash(snippet));}
`;
 next+=helper;
 fs.writeFileSync(appPath,next,"utf8");
 console.log("[patch-status] every-owner-full-sheet-audit=v13 applied; no-owner-skip=on; all-active-targets=required; incomplete-rows-retry=on; rr13-reread=on");
}else console.log("[patch-status] every-owner-full-sheet-audit=v13 already applied");

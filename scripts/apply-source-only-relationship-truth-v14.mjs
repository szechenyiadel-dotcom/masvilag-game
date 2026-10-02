import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const appPath=path.join(root,"src","App.jsx");
let next=fs.readFileSync(appPath,"utf8");
const MARKER="MÁSVILÁG SOURCE-ONLY RELATIONSHIP TRUTH v14";
function renameOne(name,replacement){const rx=new RegExp("function\\s+"+name+"\\s*\\(");const m=[...next.matchAll(new RegExp(rx.source,"g"))];if(m.length!==1)throw new Error("Relationship v14 aborted: "+name+" expected once, found "+m.length);next=next.replace(rx,"function "+replacement+"(");}
if(!next.includes("/* "+MARKER+" */")){
 renameOne("relV9CanonicalBondParts","legacyV14RelV9CanonicalBondParts");
 renameOne("relV11DirectedParts","legacyV14RelV11DirectedParts");
 renameOne("relV8SanitizeRow","legacyV14RelV8SanitizeRow");
 renameOne("officialRelationshipStatusForPair","legacyV14OfficialRelationshipStatusForPair");
 renameOne("relationshipReadingHash","legacyV14RelationshipReadingHash");
 renameOne("relationshipReadingCacheKey","legacyV14RelationshipReadingCacheKey");
 const helper=`
/* ${MARKER} */
const REL_V14_FAMILY_ASSERTION_RE=/(?:\\b(?:is|are|was|were|my|his|her|their)\\s+(?:actual\\s+|biological\\s+|older\\s+|younger\\s+)?(?:sister|brother|sibling)\\b|\\b(?:sister|brother|sibling)\\s+(?:of|to)\\b|\\b(?:siblings|brothers|sisters)\\b|(?:a|az|ő|o)\\s+(?:testv[eé]re|n[oő]v[eé]re|h[uú]ga|b[aá]tyja|[oö]ccse)\\b|testv[eé]rek\\b)/i;
const REL_V14_FAMILY_NONLITERAL_RE=/(?:like|as|almost|basically|practically|chosen|found family|feels? like|treats? .* like|sister[- ]?like|brother[- ]?like|sibling[- ]?like|olyan mint|mintha|fogadott csal[aá]d)/i;
function relV14ExplicitSiblingSource(w,actor,target){
 const exact=String(relV9ExactPairConnectionText(w,actor,target)||"");
 if(!exact||REL_V14_FAMILY_NONLITERAL_RE.test(exact)) return false;
 return REL_V14_FAMILY_ASSERTION_RE.test(exact);
}
function relV9CanonicalBondParts(w,actor,target){
 const parts=legacyV14RelV9CanonicalBondParts(w,actor,target);
 return parts.filter(x=>x!=="Sibling"||relV14ExplicitSiblingSource(w,actor,target));
}
function relV14SourceEventState(w,actor,target,eventRe){
 const exact=String(relV9ExactPairConnectionText(w,actor,target)||"");
 const pair=String(relV9PairText(w,actor,target)||"");
 /* SOURCE ONLY. Generated AI rows are never evidence that an event happened. */
 return relV12EventState([exact,pair].filter(Boolean).join("\\n"),eventRe);
}
function relV11DirectedParts(w,actor,target,row){
 let parts=legacyV14RelV11DirectedParts(w,actor,target,row)
   .filter(x=>!["One-night stand","Hookup","Sibling"].includes(x));
 if(relV14ExplicitSiblingSource(w,actor,target)) relV11Add(parts,"Sibling");
 const one=relV14SourceEventState(w,actor,target,REL_V11_ONE_NIGHT_RE);
 const hook=relV14SourceEventState(w,actor,target,REL_V11_HOOKUP_RE);
 if(one==="occurred") relV11Add(parts,"One-night stand");
 else if(hook==="occurred") relV11Add(parts,"Hookup");
 return parts.slice(0,12);
}
function relV8SanitizeRow(w,actor,target,input){
 let row=legacyV14RelV8SanitizeRow(w,actor,target,input);
 if(!row||typeof row!=="object") return row;
 const lang=worldLanguage(w,w.meId);
 const parts=relV11DirectedParts(w,actor,target,row);
 const canon=parts.map(x=>relV11Localize(x,lang)).filter(Boolean);
 const one=relV14SourceEventState(w,actor,target,REL_V11_ONE_NIGHT_RE);
 const hook=relV14SourceEventState(w,actor,target,REL_V11_HOOKUP_RE);
 if(one!=="occurred"&&hook!=="occurred"){
   row.layers=(Array.isArray(row.layers)?row.layers:[]).filter(x=>!/one[- ]?night|hookup|egy[eé]jszak[aá]s|alkalmi viszony/i.test(String(x||"")));
   if(/one[- ]?night|hookup|egy[eé]jszak[aá]s|alkalmi viszony/i.test(String(row.bond||""))) row.bond=canon.join(" / ");
 }
 if(!relV14ExplicitSiblingSource(w,actor,target)){
   row.layers=(Array.isArray(row.layers)?row.layers:[]).filter(x=>!/\\bsibling\\b|\\bbrother\\b|\\bsister\\b|testv[eé]r/i.test(String(x||"")));
   if(/\\bsibling\\b|\\bbrother\\b|\\bsister\\b|testv[eé]r/i.test(String(row.bond||""))) row.bond=canon.join(" / ");
 }
 if(!String(row.bond||"").trim()&&canon.length) row.bond=canon.join(" / ");
 if(!String(row.label||"").trim()&&row.bond) row.label=row.bond;
 return row;
}
function officialRelationshipStatusForPair(w,ownerId,targetId,lang=CURRENT_LANG){
 const actor=charById(w,ownerId),target=charById(w,targetId);
 if(actor&&target){
   const live=getRel(w,ownerId,targetId)||null;
   const parts=relV11DirectedParts(w,actor,target,live);
   for(const x of ["Fake dating","One-night stand","Hookup","Sibling","Obsession","Mutual crush","Crush","Attraction","Best friend","Close friend","Friend","Enemy","Rival","Mentor","Student","Teammate","Classmate","Coworker","Acquaintance"]) if(parts.includes(x)) return relV11Localize(x,lang);
   /* Do NOT fall back to a stale semantic status when source validation rejected it. */
   if(live&&String(live.bond||live.type||"").trim()) return localizedBond(live.bond||live.type,lang);
 }
 return legacyV14OfficialRelationshipStatusForPair(w,ownerId,targetId,lang);
}
function relationshipReadingHash(snippet){return simsSocialStableHash("v14-source-only-truth|"+String(snippet||""));}
function relationshipReadingCacheKey(actor,target,snippet){return "rr14-source-only:"+simsSocialStableHash(String(actor&&actor.name||"")+"|"+String(target&&target.name||"")+"|"+relationshipReadingHash(snippet));}
`;
 next+=helper;
 fs.writeFileSync(appPath,next,"utf8");
 console.log("[patch-status] source-only-relationship-truth=v14 applied; ai-row-not-event-evidence; sibling-explicit-only; rr14-reread=on");
}else console.log("[patch-status] source-only-relationship-truth=v14 already applied");

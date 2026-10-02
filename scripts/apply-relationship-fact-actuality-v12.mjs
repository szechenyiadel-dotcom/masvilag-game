import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const appPath=path.join(root,"src","App.jsx");
let next=fs.readFileSync(appPath,"utf8");
const MARKER="MÁSVILÁG RELATIONSHIP FACT ACTUALITY v12";
function renameOne(name,replacement){
 const rx=new RegExp("function\\s+"+name+"\\s*\\(");
 const m=[...next.matchAll(new RegExp(rx.source,"g"))];
 if(m.length!==1) throw new Error("Relationship v12 aborted: "+name+" expected once, found "+m.length);
 next=next.replace(rx,"function "+replacement+"(");
}
if(!next.includes("/* "+MARKER+" */")){
 renameOne("relV11DirectedParts","legacyV12RelV11DirectedParts");
 renameOne("relV8TargetSynthesisCard","legacyV12RelV8TargetSynthesisCard");
 renameOne("relV8SanitizeRow","legacyV12RelV8SanitizeRow");
 renameOne("relationshipReadingHash","legacyV12RelationshipReadingHash");
 renameOne("relationshipReadingCacheKey","legacyV12RelationshipReadingCacheKey");
 const helper=`
/* ${MARKER} */
const REL_V12_DESIRE_RE=/(?:\\b(?:want|wants|wanted|wish|wishes|wished|would like|would love|would fuck|would sleep with|would hook up|hopes? to|fantasi[sz](?:e|es|ed|ing)|dreams? of|intends? to|plans? to|trying to|tries to|tempted to|wants? nothing more than)\\b|akar(?:ja|na|t)?|szeretne|v[aá]gyik|v[aá]gy[aá]lma|fant[aá]zi[aá]l|tervezi|sz[aá]nd[eé]kozik|megpr[oó]b[aá]lna)/i;
const REL_V12_NEGATED_RE=/(?:\\b(?:never|not|didn['’]?t|did not|hasn['’]?t|has not|haven['’]?t|have not|without actually|almost|nearly|could have|might have)\\b|soha|nem t[oö]rt[eé]nt|nem volt|nem fek[uü]dtek|nem j[oö]tt [oö]ssze|majdnem)/i;
const REL_V12_OCCURRED_RE=/(?:\\b(?:had|have had|hooked up|slept together|slept with|spent the night|ended up in bed|were intimate|sexual encounter|one[- ]night stand)\\b|volt egy[eé]jszak[aá]s|egy[eé]jszak[aá]s kalandjuk volt|lefek[uü]dtek|egy[uü]tt aludtak|egy [eé]jszak[aá]t t[oö]lt[oö]ttek|megt[oö]rt[eé]nt k[oö]zt[uü]k)/i;

function relV12Sentences(text){
 return String(text||"").split(/(?<=[.!?;\\n])\\s+|\\n+/).map(x=>x.trim()).filter(Boolean);
}
function relV12EventState(text,eventRe){
 const hits=relV12Sentences(text).filter(s=>eventRe.test(s));
 if(!hits.length) return "absent";
 let desire=false,negated=false,occurred=false;
 for(const s of hits){
   if(REL_V12_NEGATED_RE.test(s)){negated=true;continue;}
   if(REL_V12_DESIRE_RE.test(s) && !REL_V12_OCCURRED_RE.test(s)){desire=true;continue;}
   if(REL_V12_OCCURRED_RE.test(s)){occurred=true;continue;}
   /* Bare noun labels in Connections such as "One-night stand — ..." are canonical happened-history,
      but only when they are not modal/negated. */
   if(/^\\s*(?:[-*•]\\s*)?(?:one[- ]?night stand|hookup|egy[eé]jszak[aá]s(?: kaland)?|alkalmi viszony)\\b/i.test(s)) occurred=true;
 }
 if(occurred) return "occurred";
 if(desire) return "desire";
 if(negated) return "negated";
 return "uncertain";
}
function relV12Occurred(text,eventRe){return relV12EventState(text,eventRe)==="occurred";}

function relV11DirectedParts(w,actor,target,row){
 const parts=legacyV12RelV11DirectedParts(w,actor,target,row)
   .filter(x=>!["One-night stand","Hookup"].includes(x));
 const exact=String(relV9ExactPairConnectionText(w,actor,target)||"");
 const source=String(relV9PairText(w,actor,target)||"");
 const rowText=relV11RowText(row);
 const evidence=[exact,source,rowText].filter(Boolean).join("\\n");
 const one=relV12EventState(evidence,REL_V11_ONE_NIGHT_RE);
 const hook=relV12EventState(evidence,REL_V11_HOOKUP_RE);
 if(one==="occurred") relV11Add(parts,"One-night stand");
 else if(hook==="occurred") relV11Add(parts,"Hookup");
 return parts.slice(0,12);
}

function relV8TargetSynthesisCard(w,actor,target,facts){
 const base=legacyV12RelV8TargetSynthesisCard(w,actor,target,facts);
 const text=(Array.isArray(facts)?facts:[]).map(f=>String(f&&f.fact||"")).join("\\n");
 return base+"\\n"+
   "EVENT ACTUALITY v12 — HARD: distinguish happened facts from desire/intention/fantasy/possibility/negation. "+
   "A sentence saying someone WANTS/WISHES/HOPES/PLANS/WOULD LIKE to have a one-night stand or hookup means it HAS NOT HAPPENED. "+
   "Never label that One-night stand/Hookup and never rewrite desire as shared history. "+
   "Only explicit completed/past event evidence may become One-night stand/Hookup. "+
   "Current one-night state from extracted facts: "+relV12EventState(text,REL_V11_ONE_NIGHT_RE)+
   "; hookup state: "+relV12EventState(text,REL_V11_HOOKUP_RE)+".\\n"+
   "THREE-PART COMPLETENESS — HARD: when this character sheet contains detailed relationship material for this target, fill ALL THREE display payloads: "+
   "(1) bond/status with the supported relationship type(s), (2) layers with every distinct supported factor, and (3) description/mood with a detailed owner-perspective explanation. "+
   "Do not leave any of these blank merely because the relationship is complicated.";
}

function relV12DetailedPairSource(w,actor,target){
 let s="";
 try{s+=String(relV9PairText(w,actor,target)||"");}catch{}
 return s.trim();
}
function relV12SafeFallbackDescription(w,actor,target,parts,lang){
 const names=String(actor&&actor.name||"")+" / "+String(target&&target.name||"");
 const labels=parts.map(x=>relV11Localize(x,lang)).filter(Boolean).join(" / ");
 if(asLang(lang)==="en") return labels ? names+": "+labels+". Their character sheet contains documented relationship context; the detailed AI reading is retained as a multi-layer relationship rather than reducing them to strangers." : names+": documented relationship context exists on the character sheet.";
 return labels ? names+": "+labels+". A karakterlapon dokumentált, részletes kapcsolati kontextus szerepel; ezt a rendszer többrétegű kapcsolatként tartja meg, nem redukálja őket idegenekre." : names+": a karakterlapon dokumentált kapcsolati kontextus szerepel.";
}

function relV8SanitizeRow(w,actor,target,input){
 let row=legacyV12RelV8SanitizeRow(w,actor,target,input);
 if(!row||typeof row!=="object") return row;
 const lang=worldLanguage(w,w.meId);
 const source=relV12DetailedPairSource(w,actor,target);
 const detailed=source.length>=80;
 const parts=relV11DirectedParts(w,actor,target,row);
 const canon=parts.map(x=>relV11Localize(x,lang)).filter(Boolean);
 const oneState=relV12EventState(source+"\\n"+relV11RowText(row),REL_V11_ONE_NIGHT_RE);
 const hookState=relV12EventState(source+"\\n"+relV11RowText(row),REL_V11_HOOKUP_RE);
 if(oneState!=="occurred"&&hookState!=="occurred"){
   row.layers=(Array.isArray(row.layers)?row.layers:[]).filter(x=>!/one[- ]?night|hookup|egy[eé]jszak[aá]s|alkalmi viszony/i.test(String(x||"")));
   if(/one[- ]?night|hookup|egy[eé]jszak[aá]s|alkalmi viszony/i.test(String(row.bond||""))) row.bond=canon.join(" / ");
   for(const k of ["description","mood","why","label"]){
     if(/one[- ]?night|hookup|egy[eé]jszak[aá]s|alkalmi viszony/i.test(String(row[k]||"")) && (oneState==="desire"||oneState==="negated"||hookState==="desire"||hookState==="negated")) row[k]="";
   }
 }
 if(detailed){
   if(!String(row.bond||"").trim()) row.bond=(canon.join(" / ")||relV11Localize("Acquaintance",lang)).slice(0,220);
   if(!Array.isArray(row.layers)||!row.layers.length) row.layers=[...canon];
   if(!row.layers.length) row.layers=[row.bond];
   const desc=String(row.description||row.mood||"").trim();
   if(!desc) row.description=relV12SafeFallbackDescription(w,actor,target,parts,lang);
   if(!String(row.mood||"").trim()) row.mood=row.description;
   if(!String(row.label||"").trim()) row.label=row.bond;
 }
 return row;
}
function relationshipReadingHash(snippet){return simsSocialStableHash("v12-fact-actuality-three-part|"+String(snippet||""));}
function relationshipReadingCacheKey(actor,target,snippet){return "rr12-fact-actuality:"+simsSocialStableHash(String(actor&&actor.name||"")+"|"+String(target&&target.name||"")+"|"+relationshipReadingHash(snippet));}
`;
 next+=helper;
 fs.writeFileSync(appPath,next,"utf8");
 console.log("[patch-status] relationship-fact-actuality=v12 applied; happened-vs-desire=locked; negation=locked; three-part-completeness=on; rr12-reread=on");
}else console.log("[patch-status] relationship-fact-actuality=v12 already applied");

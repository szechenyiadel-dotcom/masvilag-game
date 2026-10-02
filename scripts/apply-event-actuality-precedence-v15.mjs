import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const appPath=path.join(root,"src","App.jsx");
let next=fs.readFileSync(appPath,"utf8");
const MARKER="MÁSVILÁG EVENT ACTUALITY PRECEDENCE v15";
function renameOne(name,replacement){const rx=new RegExp("function\\s+"+name+"\\s*\\(");const m=[...next.matchAll(new RegExp(rx.source,"g"))];if(m.length!==1)throw new Error("Relationship v15 aborted: "+name+" expected once, found "+m.length);next=next.replace(rx,"function "+replacement+"(");}
if(!next.includes("/* "+MARKER+" */")){
 renameOne("relV12EventState","legacyV15RelV12EventState");
 const helper=`
/* ${MARKER} */
const REL_V15_COMPLETED_ACTION_RE=/(?:\\b(?:hooked up|slept together|slept with|spent the night|ended up in bed|were intimate|had (?:a |an )?(?:one[- ]night stand|hookup|sexual encounter)|have had (?:a |an )?(?:one[- ]night stand|hookup|sexual encounter))\\b|volt egy[eé]jszak[aá]s|egy[eé]jszak[aá]s kalandjuk volt|lefek[uü]dtek|egy[uü]tt aludtak|egy [eé]jszak[aá]t t[oö]lt[oö]ttek|megt[oö]rt[eé]nt k[oö]zt[uü]k)/i;
function relV12EventState(text,eventRe){
 const hits=relV12Sentences(text).filter(s=>eventRe.test(s));
 if(!hits.length) return "absent";
 let desire=false,negated=false,occurred=false;
 for(const s of hits){
   if(REL_V12_NEGATED_RE.test(s)){negated=true;continue;}
   /* Intent/desire wins over the event noun itself. "Wants a one-night stand"
      is NOT occurrence merely because the noun "one-night stand" appears. */
   if(REL_V12_DESIRE_RE.test(s) && !REL_V15_COMPLETED_ACTION_RE.test(s)){desire=true;continue;}
   if(REL_V15_COMPLETED_ACTION_RE.test(s)){occurred=true;continue;}
   /* Only an explicit relationship/history label at the START may stand alone
      as a completed canonical fact. Incidental mentions never do. */
   if(/^\\s*(?:[-*•]\\s*)?(?:one[- ]?night stand|hookup|egy[eé]jszak[aá]s(?: kaland)?|alkalmi viszony)\\s*(?:[:—–-]|$)/i.test(s)){occurred=true;continue;}
 }
 if(occurred) return "occurred";
 if(desire) return "desire";
 if(negated) return "negated";
 return "uncertain";
}`;
 next+=helper;
 fs.writeFileSync(appPath,next,"utf8");
 console.log("[patch-status] event-actuality-precedence=v15 applied; desire-beats-event-noun; completed-action-required; rr15-reread=on");
}else console.log("[patch-status] event-actuality-precedence=v15 already applied");

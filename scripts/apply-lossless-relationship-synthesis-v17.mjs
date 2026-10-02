import fs from "node:fs";import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),appPath=path.join(root,"src","App.jsx");let next=fs.readFileSync(appPath,"utf8");
const MARKER="MÁSVILÁG LOSSLESS RELATIONSHIP SYNTHESIS v17";
function renameOne(n,r){const rx=new RegExp("function\\s+"+n+"\\s*\\("),m=[...next.matchAll(new RegExp(rx.source,"g"))];if(m.length!==1)throw new Error("v17 "+n+" count "+m.length);next=next.replace(rx,"function "+r+"(");}
if(!next.includes("/* "+MARKER+" */")){
 const batch=(next.match(/const batchSize = 8;/g)||[]).length;if(batch!==1)throw new Error("v17 batch anchor "+batch);next=next.replace("const batchSize = 8;","const batchSize = 3;");
 const tok=(next.match(/maxTokens: 4200,/g)||[]).length;if(tok!==1)throw new Error("v17 token anchor "+tok);next=next.replace("maxTokens: 4200,","maxTokens: 6500,");
 renameOne("relV11DirectedParts","legacyV17RelV11DirectedParts");renameOne("relV8SanitizeRow","legacyV17RelV8SanitizeRow");
 next+=String.raw
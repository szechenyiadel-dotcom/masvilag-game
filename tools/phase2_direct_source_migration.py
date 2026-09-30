from pathlib import Path
import json

p=Path('src/App.jsx')
s=p.read_text()
if 'A POSZT, AMIRE REAGÁLSZ:' in s:
    print('[phase2] direct source already migrated')
    raise SystemExit(0)

def rep(a,b,label):
    global s
    n=s.count(a)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 target, found {n}')
    s=s.replace(a,b,1)

rep('''  const imageDescription = String(\n    post && (\n      post.imageDescription ||\n      post.imagePrompt ||\n      post.imageAlt ||\n      post.alt ||\n      post.imageCaption ||\n      ""\n    ) || ""\n  ).trim();\n\n  return {''','''  const imageDescription = String(\n    post && (\n      post.imageDescription ||\n      post.imagePrompt ||\n      post.imageAlt ||\n      post.alt ||\n      post.imageCaption ||\n      ""\n    ) || ""\n  ).trim();\n  const hasImage = Boolean(post && (post.image || post.imageId || post.imageKey || post.mediaId || post.media || post.mediaUrl));\n\n  return {''','image flag')
rep('''    text: visibleText,\n    imageDescription,\n    mood:''','''    text: visibleText,\n    hasImage,\n    imageDescription,\n    imageDescriptionMissing: Boolean(hasImage && !imageDescription),\n    mood:''','image fields')

anchor='function playerPostCommentPrompt(w, post, postContext, cards, minComments, maxComments, retryProblems = [], rejectedRows = []) {'
helpers=r'''function playerPostCommentIntent(postContext) {
  const text = String(postContext && postContext.text || "").trim();
  const invitation = /\b(?:anyone\s+up\s+for|who\s+(?:wants|is\s+up)\s+for|come\s+(?:with|to|over)|join\s+me|want\s+to\s+(?:meet|come|go)|party|dinner|coffee|drinks?|hang\s*out|date|ki\s+jön|van\s+kedve|gyertek|gyere|találkozz|buli|vacsora|kávé|ital|randi|edzés|dojo)\b/iu.test(text);
  const question = invitation || /\?\s*$/.test(text) || /^(?:who|what|where|when|why|how|does|do|is|are|can|would|should|ki|mi|hol|mikor|miért|hogyan|van\s+valaki|szeretne)/iu.test(text);
  return { question, invitation };
}
function playerPostCommentAcceptance(text) {
  return /\b(?:i(?:'m| am)\s+in|count\s+me\s+in|i(?:'ll| will)\s+(?:come|go|be\s+there|join)|yes|yeah|yep|sure|sounds\s+good|see\s+you\s+there|jövök|benne\s+vagyok|ott\s+leszek|persze|igen|megyek|számíthatsz\s+rám)\b/iu.test(String(text || ""));
}
function playerPostCommentReactionRelevant(postContext, row) {
  const reaction = String(row && row.reagal_erre || "").trim();
  if (!reaction || PLAYER_POST_COMMENT_TECH_LEAK_RE.test(reaction) || playerPostCommentHasFollowLeak(postContext, reaction)) return false;
  const intent = playerPostCommentIntent(postContext);
  if (intent.invitation && !/\b(?:party|invite|invitation|come|join|where|when|who|buli|meghív|jöv|megy|hol|mikor|kivel)\b/iu.test(reaction)) return false;
  return true;
}
function playerPostCommentCreateSceneOffer(w, post, comment) {
  if (!w || !post || !comment || !isHuman(w, post.authorId)) return false;
  const context = playerPostCommentPostContext(w, post);
  if (!playerPostCommentIntent(context).invitation || !playerPostCommentAcceptance(comment.text)) return false;
  const actorId = String(comment.authorId || comment.id || "");
  if (!actorId || isHuman(w, actorId) || !charById(w, actorId)) return false;
  groundedRuntime(w);
  const sourceRef = "post:" + String(post.id || "") + ":comment:" + String(comment.id || actorId);
  if ((w.invitations || []).some((inv) => inv && inv.status === "pending" && inv.fromId === actorId && inv.sourceRef === sourceRef)) return false;
  w.invitations.unshift({ id:"inv_"+uid(), fromId:actorId, toId:post.authorId, createdAt:now(), when:"", where:"", context:nameOfIn(w,actorId)+" accepted the player's invitation: "+String(post.text||post.caption||"").slice(0,500), sourceRef, status:"pending", participantIds:[post.authorId,actorId] });
  groundedEventLog(w,"invitation","received",nameOfIn(w,actorId)+" accepted the player's post invitation; scene offer created.",sourceRef);
  return true;
}

'''+anchor
rep(anchor,helpers,'comment helpers')
rep('''  return [\n    en ? "[CHARACTER CONTENT — VISIBLE POST ONLY]" : "[CHARACTER CONTENT — CSAK A LÁTHATÓ POSZT]",''','''  const intent = playerPostCommentIntent(postContext);\n  const postAnchor = [postContext.text, postContext.imageDescription ? ("IMAGE: " + postContext.imageDescription) : (postContext.imageDescriptionMissing ? "IMAGE: attached, but no textual description is available; never invent visual details" : "")].filter(Boolean).join(" | ");\n  return [\n    en ? "[CHARACTER CONTENT — VISIBLE POST ONLY]" : "[CHARACTER CONTENT — CSAK A LÁTHATÓ POSZT]",''','prompt preface')
rep('''    JSON.stringify(postContext),\n    "",\n    en ? "[COMMENTER CARDS''','''    JSON.stringify(postContext),\n    "",\n    "[POST INTENT] question=" + String(intent.question) + " invitation=" + String(intent.invitation),\n    intent.invitation ? (en ? "This post is an invitation/question. Answer it directly: coming/not coming/where/when/who else, with tone shaped by character and relationship." : "Ez a poszt meghívás/kérdés. Közvetlenül erre válaszolj: jön/nem jön/hol/mikor/kivel, a karakter és kapcsolat szerinti hangnemben.") : "",\n    postContext.imageDescriptionMissing ? (en ? "An image is attached but no reliable text description exists. Do NOT guess what is in the image; react only to known text/metadata." : "Van csatolt kép, de nincs megbízható szöveges leírás. NE találd ki, mi van a képen; csak az ismert szövegre/metaadatra reagálj.") : "",\n    "",\n    en ? "[COMMENTER CARDS''','intent block')
rep('''      ? '{"comments":[{"id":"EXACT_CHARACTER_ID","text":"natural comment"}],"changes":[]}'\n      : '{"comments":[{"id":"PONTOS_KARAKTER_ID","text":"természetes komment"}],"changes":[]}',\n    retryBlock,''','''      ? '{"comments":[{"id":"EXACT_CHARACTER_ID","text":"natural comment","reagal_erre":"short summary of the exact part of the post this comment answers"}],"changes":[]}'\n      : '{"comments":[{"id":"PONTOS_KARAKTER_ID","text":"természetes komment","reagal_erre":"röviden: a poszt mely konkrét részére reagál"}],"changes":[]}',\n    retryBlock,\n    "",\n    "A POSZT, AMIRE REAGÁLSZ: " + (postAnchor || "[üres szövegű poszt]"),''','schema')
rep('''      if (playerPostCommentHasFollowLeak(postContext, text)) {\n        console.warn("[player-post-comments] rejected=follow-context-leak", "character=" + actorId, "text=" + text.slice(0, 180));\n        return;\n      }\n\n      seen.add(actorId);''','''      if (playerPostCommentHasFollowLeak(postContext, text)) {\n        console.warn("[player-post-comments] rejected=follow-context-leak", "character=" + actorId, "text=" + text.slice(0, 180));\n        return;\n      }\n      if (!playerPostCommentReactionRelevant(postContext, row)) {\n        console.warn("[player-post-comments] rejected=off-topic-reagal-erre", "character=" + actorId, "reagal_erre=" + String(row.reagal_erre || "").slice(0,180));\n        return;\n      }\n\n      seen.add(actorId);''','row validation')
rep('''    if (playerPostCommentHasFollowLeak(postContext, row.text)) {\n      problems.push("follow-event-leak");\n    }\n  });''','''    if (playerPostCommentHasFollowLeak(postContext, row.text)) problems.push("follow-event-leak");\n    if (!playerPostCommentReactionRelevant(postContext, row)) problems.push("off-topic-reagal-erre");\n  });''','batch validation')
rep('''  if (cards.length < 2) {\n    return legacyPlayerPostContentGenComments(w, post, options);\n  }''','''  if (!cards.length) return { out:{ comments:[], changes:[] }, label:"isolated-player-post-comments-no-cast" };''','no legacy fallback')
rep('''async function genComments(w, post, options = {}) {\n  if (\n    options &&\n    options.playerPostContentIsolation === true &&\n    post &&\n    isHuman(w, post.authorId)\n  ) {\n    return isolatedPlayerPostComments(w, post, options);\n  }\n  return legacyPlayerPostContentGenComments(w, post, options);\n}''','''async function genComments(w, post, options = {}) {\n  if (post && isHuman(w, post.authorId)) return isolatedPlayerPostComments(w, post, { ...options, playerPostContentIsolation:true });\n  return legacyPlayerPostContentGenComments(w, post, options);\n}''','single route')
rep(''').slice(0, 4);\n}\n\nasync function legacyFullSpecRunSimulationAction''',''').slice(0, 6);\n}\n\nasync function legacyFullSpecRunSimulationAction''','comment cap')
rep('''        if (actorId && !existingActors.has(actorId) && combinedRows.length < 4) {''','''        if (actorId && !existingActors.has(actorId) && combinedRows.length < 6) {''','combined cap')
rep('''    if (!authorId || isHuman(w, authorId) || isMediaAccount(w, authorId) || seen.has(authorId)) continue;\n    if (!Array.isArray(post && post.comments) || !post.comments.length) continue;\n    seen.add(authorId);''','''    if (!authorId || isHuman(w, authorId) || isMediaAccount(w, authorId) || seen.has(authorId)) continue;\n    seen.add(authorId);''','feed acceptance')
rep('''  playerPostCommentDiagnostic(view, post, "start", { exists: Boolean(post), trigger: "player-post" });\n\n  if (!post) {''','''  playerPostCommentDiagnostic(view, post, "start", { exists: Boolean(post), trigger: "player-post" });\n  update((n)=>groundedEventLog(n,"player-post-comments","started","Player-post isolated comment generation started.","post:"+postId));\n\n  if (!post) {''','comment start log')
rep('''    playerPostCommentDiagnostic(view, post, "failed", { calls, reason: String(finalError.message || finalError) });\n    return "player-post-comments-failed";''','''    playerPostCommentDiagnostic(view, post, "failed", { calls, reason: String(finalError.message || finalError) });\n    update((n)=>groundedEventLog(n,"player-post-comments","failed",String(finalError.message||finalError),"post:"+post.id));\n    return "player-post-comments-failed";''','comment fail log')
rep('''    playerPostCommentDiagnostic(n, afterPost || post, "saved", {\n      aiCalls: calls,\n      provider: label || "unknown",\n      applied: Math.max(0, after - before),\n      visibleComments: after,\n    });''','''    const appliedCount=Math.max(0,after-before);\n    playerPostCommentDiagnostic(n, afterPost || post, "saved", { aiCalls:calls, provider:label||"unknown", applied:appliedCount, visibleComments:after });\n    groundedEventLog(n,"player-post-comments",appliedCount>=3?"success":"partial","Player-post comments saved: "+appliedCount+".","post:"+post.id,{applied:appliedCount,aiCalls:calls});''','comment result log')
needle='''        const newAiComments = afterApplyPost\n          ? safePostComments(afterApplyPost)\n              .slice(before)\n              .filter((row) => row && row.id && row.authorId && !isHuman(n, row.authorId))\n          : [];\n        if (newAiComments.length >= 2'''
replacement='''        const newAiComments = afterApplyPost\n          ? safePostComments(afterApplyPost)\n              .slice(before)\n              .filter((row) => row && row.id && row.authorId && !isHuman(n, row.authorId))\n          : [];\n        newAiComments.forEach((comment) => {\n          try {\n            const tone=playerPostCommentGeneratedTone(comment.text);\n            const accepted=playerPostCommentIntent(playerPostCommentPostContext(n,afterApplyPost)).invitation && playerPostCommentAcceptance(comment.text);\n            const delta=(tone==="positive"||accepted)?1:(tone==="negative"?-1:0);\n            if(delta){ applyChannelRelationshipChanges(n,[{a:comment.authorId,b:afterApplyPost.authorId,delta,why:"grounded reaction to player post comment "+comment.id}],"public",{reason:"player-post-comment",text:comment.text}); groundedEventLog(n,"relationship-change","success",nameOfIn(n,comment.authorId)+" → "+nameOfIn(n,afterApplyPost.authorId)+" "+(delta>0?"+":"")+delta+" from a recorded player-post comment.","comment:"+comment.id,{fromId:comment.authorId,toId:afterApplyPost.authorId,delta}); }\n            playerPostCommentCreateSceneOffer(n,afterApplyPost,comment);\n          } catch(effectError){ console.warn("[player-post-comments] grounded consequence failed; comment preserved",effectError); }\n        });\n        if (newAiComments.length >= 2'''
rep(needle,replacement,'comment effects')
rep('''        playerPostCommentDiagnostic(n, p, "signal", { queued: true });\n        if (typeof channelPublicPostFollowerEffect === "function") channelPublicPostFollowerEffect(n, event.postId);''','''        playerPostCommentDiagnostic(n, p, "signal", { queued: true });\n        groundedEventLog(n,"player-post","started","Player post recorded; comment/feed/relationship consequences are being queued.","post:"+event.postId);\n        if (typeof channelPublicPostFollowerEffect === "function") channelPublicPostFollowerEffect(n, event.postId);''','player post event log')
p.write_text(s)

q=Path('server/proxy.js'); t=q.read_text()
a='''const AI_GATE = {\n  queue: [], active: false, seq: 0, lastStartAt: 0, wakeTimer: null,'''
b='''const AI_PROMPT_DEBUG = /^(?:1|true|yes|on)$/i.test(String(process.env.AI_PROMPT_DEBUG || "").trim());\nconsole.info("[patch-status] canonical-source mode; runtime apply-patches disabled; AI_PROMPT_DEBUG="+(AI_PROMPT_DEBUG?"1":"0"));\n\nconst AI_GATE = {\n  queue: [], active: false, seq: 0, lastStartAt: 0, wakeTimer: null,'''
if t.count(a)!=1: raise SystemExit('AI_GATE target mismatch')
t=t.replace(a,b,1)
a='''  console.info("[ai-trace]", stamp, `source=${source}`, eventId ? `event=${eventId}` : "event=none", `systemChars=${String(body.system || "").length}`, `promptChars=${prompt.length}`, `totalChars=${String(body.system || "").length + prompt.length}`);\n}'''
b='''  console.info("[ai-trace]", stamp, `source=${source}`, eventId ? `event=${eventId}` : "event=none", `systemChars=${String(body.system || "").length}`, `promptChars=${prompt.length}`, `totalChars=${String(body.system || "").length + prompt.length}`);\n  if (AI_PROMPT_DEBUG) {\n    console.info("[ai-prompt-debug] BEGIN",`source=${source}`,eventId?`event=${eventId}`:"event=none");\n    console.info("[ai-prompt-debug] SYSTEM\\n"+String(body.system||""));\n    (Array.isArray(body.messages)?body.messages:[]).forEach((m,i)=>console.info("[ai-prompt-debug] MESSAGE",`index=${i}`,`role=${String(m&&m.role||"unknown")}\\n`+extractText(m&&m.content||"")));\n    console.info("[ai-prompt-debug] END",`source=${source}`);\n  }\n}'''
if t.count(a)!=1: raise SystemExit('ai trace target mismatch')
q.write_text(t.replace(a,b,1))

pkg=Path('package.json'); o=json.loads(pkg.read_text())
o['scripts']['social-policy']='node -e "console.log(\\"[patch-status] canonical-source mode: 0 runtime patch scripts executed; src/App.jsx and server/proxy.js are authoritative.\\")"'
o['scripts']['dev']='vite'; o['scripts']['build']='vite build'; o['scripts']['start']='node server/proxy.js'
pkg.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
print('[phase2] direct source migration complete')

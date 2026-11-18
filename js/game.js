/* =====================================================================
   PSYCH CLINIC — simulation + UI
   Uses globals from main.js: state, flows, paintCortex, paintDeep,
   applyOpacity, syncChips, regionMeshes, hemis, REGIONS, openInfo, closeInfo
   ===================================================================== */

const GAME = {active:false, c:null, step:'home', dxPick:null, items:[], w2:null, w8:null, switched:false, maniaWorse:false, anxiogenicHit:false, benzoEarly:false};
const FX_COL = {hot:new THREE.Color('#ff4b3e'), low:new THREE.Color('#3d6bff'), calm:new THREE.Color('#2dd4bf'), up:new THREE.Color('#a3e635')};
const gameEl = document.getElementById('game');
let bestScores = {};
try{ bestScores = JSON.parse(localStorage.getItem('nv-clinic')||'{}') }catch(e){}

/* ---------------- simulation ---------------- */
function itemData(it){ return it.type==='therapy' ? THERAPIES[it.id] : MEDS[it.id] }
function itemEffect(it, cond, weeksOn){
  const d = itemData(it);
  let e = d.eff[cond] || 0;
  if(cond==='ocd' && d.ssri) e *= it.dose===2 ? 1 : 0.6;
  else if(it.dose===2 && e>0) e = Math.min(.95, e*1.1);
  const tau = (cond==='ocd' && d.tauOcd) ? d.tauOcd : (cond==='mania' && d.tauMania) ? d.tauMania : d.tau;
  const onset = weeksOn<=0 ? 0 : 1 - Math.exp(-weeksOn/tau);
  if(d.benzo && weeksOn>=5) e *= 0.55;               // tolerance
  return {e, onset, d};
}
function simulate(c, items, w, prevSwitched){
  const cond = c.dx;
  const active = items.filter(it => it.stop==null && it.start < w);
  let neg = 0, pm = 1; const effs = [];
  let sedating=false, activatingEarly=false, anxiogenic=false, hasAD=false, hasAM=false, benzo=false;
  const meds = [];
  for(const it of active){
    const wo = w - it.start, {e,onset,d} = itemEffect(it, cond, wo);
    if(e>=0) effs.push(e*onset); else neg += -e*onset;
    if(it.type==='med'){
      meds.push({it,d,wo,onset});
      if(d.sedating) sedating=true;
      if(d.activating && wo<=3) activatingEarly=true;
      if(d.anxiogenic) anxiogenic=true;
      if(d.ad) hasAD=true;
      if(d.antimanic){ hasAM=true; pm *= 1 - d.eff.mania*(1-Math.exp(-wo/(d.tauMania||d.tau))) }
      if(d.benzo) benzo=true;
    }
  }
  // diminishing returns when stacking treatments: strongest counts fully, extras partially
  effs.sort((a,b)=>b-a); const W=[1,.6,.45,.35];
  const pos = effs.reduce((p,e,i)=>p*(1-e*W[i]),1);
  let imp = Math.min(.85, 1-pos) - neg;
  const switched = prevSwitched || (cond==='bpdep' && hasAD && !hasAM);
  const manic = switched && !hasAM;
  const anxCond = ['gad','panic','ocd'].includes(cond);
  const anxPen = anxiogenic && anxCond ? .3 : 0;
  // meters
  const meters = c.meters.map(m=>{
    let v;
    if(m.k==='mania'){ v = !switched ? m.v : manic ? 9 : Math.max(1, 9*pm) }
    else if(manic && cond==='bpdep'){ v = m.k==='sleep' ? 9 : m.v*.35 }
    else if(m.k==='anx') v = m.v*(1-(imp-anxPen));
    else if(m.k==='sleep') v = m.v*(1-(Math.max(imp, sedating?.5:0) - (activatingEarly?.2:0)));
    else v = m.v*(1-imp);
    return {...m, base:m.v, now:Math.max(0,Math.min(10,v))};
  });
  if(manic && cond==='bpdep'){ const s = meters.find(m=>m.k==='sleep'); if(s){s.n='Sleep (now barely any)'} }
  // side effects
  const sides = [];
  meds.forEach(({d,wo})=>{
    const list = d.benzo ? (wo>=5 ? d.late : d.early) : (wo<=3 ? d.early : d.late.length ? d.late : d.early.slice(0,1));
    list.forEach(s=>sides.push({s, med:d.name}));
  });
  // events
  const ev = [];
  if(manic) ev.push({t:'bad',h:prevSwitched?'Still manic':'Switched into mania',
    p:prevSwitched?'Without a mood stabiliser or antipsychotic, the antidepressant is still driving the mania.'
      :`${c.name.split(' ')[0]} has swung into mania: sleeping 3 hours, talking fast, spending money. Antidepressants without a mood stabiliser can trigger mania in bipolar disorder.`});
  else if(switched) ev.push({t:'ok',h:'Mania coming under control',p:'The antimanic medication is bringing the switch back down. Antidepressants in bipolar disorder need a mood stabiliser alongside them, or are best avoided.'});
  if(cond==='mania' && hasAD) ev.push({t:'bad',h:'Mania getting worse',p:'Antidepressants can intensify mania. They are usually stopped during a manic episode.'});
  if(cond==='mania' && !hasAM && !hasAD) ev.push({t:'warn',h:'Not an antimanic',p:'Nothing in this regimen reliably treats acute mania. Lithium or an antipsychotic is usually needed.'});
  if(anxPen) ev.push({t:'warn',h:'More on edge',p:'Bupropion is activating and has little anti-anxiety effect, so it can make anxiety worse.'});
  meds.forEach(({d,wo})=>{
    if(d.benzo && wo>=5 && ['gad','panic'].includes(cond)) ev.push({t:'bad',h:'Tolerance & dependence building',p:'Benzodiazepines lose effect over weeks and cause physical dependence. They are best used as a short bridge while an SSRI kicks in, then tapered.'});
    if(d.benzo && wo<5 && ['gad','panic'].includes(cond)) ev.push({t:'info',h:'Fast relief',p:'Benzodiazepines work within an hour, which is great short-term. The risk is staying on them.'});
    if(d.name==='Lamotrigine') ev.push({t:'info',h:'Slow titration',p:'Lamotrigine has to be increased gradually over about 6 weeks to avoid a rare but serious rash, so it starts slowly.'});
    if(d.name==='Lithium') ev.push({t:'info',h:'Blood levels',p:'Lithium blood levels were checked: in range (0.6–1.0 mmol/L). The gap between a helpful and a toxic level is narrow.'});
  });
  if(cond==='ocd' && w>=8 && active.some(it=>it.type==='med'&&MEDS[it.id].ssri&&it.dose===1)) ev.push({t:'warn',h:'Dose may be too low for OCD',p:'OCD often needs higher SSRI doses than depression does.'});
  if(w<=2 && hasAD && imp<.35 && !manic) ev.push({t:'info',h:'Give it time',p:'Antidepressants usually take 4–8 weeks for a full effect (8–12 for OCD). Early side effects often fade.'});
  // quote
  const b = imp<.15?0:imp<.4?1:imp<.65?2:3;
  let quote = c.quotes[b];
  if(manic) quote = "I feel AMAZING. I haven't slept in days, I quit the bar, I booked a whole tour. Why is everyone looking at me like that?";
  else if(cond==='mania' && hasAD) quote = "Best week of my life. I've got seven new deals going. Whatever you gave me, I want more.";
  else if(anxPen && b<=1) quote = "Honestly I feel more on edge since starting it. My heart's racing more than before.";
  else if(benzo && w<=2 && ['gad','panic'].includes(cond)) quote = "These pills are incredible. Twenty minutes and the anxiety just melts away.";
  else if(benzo && w>=8 && ['gad','panic'].includes(cond)) quote = "Those pills are the only thing that helps. But I'm getting through them faster, and if I miss one I feel awful.";
  return {w, imp:Math.max(-1,imp), meters, sides, ev, quote, switched, manic, hasAD, hasAM, benzo, anxPen, active, meds};
}

/* ---------------- brain visuals ---------------- */
function brainFor(c, r){
  const cond = r && r.manic ? 'mania' : c.dx;
  const st = BRAIN_STATES[cond], imp = r && !r.manic ? Math.max(0, r.imp) : 0;
  const fx = {}, fl = {};
  for(const id in st.regions) fx[id] = {type:st.regions[id], s:Math.max(.12, 1-imp)};
  for(const ch in st.flows) fl[ch] = st.flows[ch] + (1-st.flows[ch])*imp;
  const mech = [];
  if(r) r.active.forEach(it=>{
    const d = itemData(it), wo = r.w - it.start, on = Math.min(1, wo/2);
    if(d.regions) for(const id in d.regions) if(!fx[id] || fx[id].s<.35) fx[id] = {type:d.regions[id], s:.35+.4*on};
    if(d.flows) for(const ch in d.flows){ const m = 1 + (d.flows[ch]-1)*on; fl[ch] = (fl[ch]||1)*m }
    mech.push({name:d.name||d.full, txt:d.mech, flows:d.flows||{}});
  });
  return {fx, fl, mech};
}
function applyBrain(b){
  state.fx = {};
  for(const id in b.fx) state.fx[id] = {col:FX_COL[b.fx[id].type], s:b.fx[id].s, type:b.fx[id].type};
  for(const id in flows){
    const v = b.fl[id];
    const on = v!=null && Math.abs(v-1)>.06;
    flows[id].on = on; flows[id].group.visible = on; flows[id].mul = on ? v : 1;
  }
  paintCortex(); paintDeep(); syncChips();
}
function clearBrain(){
  state.fx = null;
  for(const id in flows){ flows[id].on=false; flows[id].group.visible=false; flows[id].mul=1 }
  paintCortex(); paintDeep(); syncChips();
}

/* ---------------- UI helpers ---------------- */
const esc = s => String(s).replace(/[&<>]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
const initials = n => n.split(' ').map(x=>x[0]).join('');
function stepsBar(active){
  const S = ['Diagnose','Treat','Week 2','Week 8','Results'];
  return `<div class="gsteps">${S.map((s,i)=>`<span class="${i<active?'done':i===active?'cur':''}">${s}</span>`).join('<i></i>')}</div>`;
}
function patientHead(c){
  return `<div class="pt"><div class="av" style="--c:${c.color}">${initials(c.name)}</div><div><div class="pn">${c.name}</div><div class="pm">${c.age} · ${c.job}</div></div></div>`;
}
function meterHTML(ms, showDelta){
  return `<div class="meters">${ms.map(m=>{
    const v = m.now!=null ? m.now : m.v, base = m.base!=null ? m.base : m.v;
    const col = v>=6.5 ? '#ff6b5e' : v>=3.5 ? '#f5b84a' : '#4ade80';
    const d = v - base;
    const delta = showDelta && Math.abs(d)>=.4 ? `<em class="${d<0?'dn':'up'}">${d<0?'▼':'▲'} ${Math.abs(d).toFixed(0)}</em>` : '';
    return `<div class="mt"><div class="ml"><span>${m.n}</span>${delta}<b>${Math.round(v)}/10</b></div><div class="mb"><div class="mg" style="width:${base*10}%"></div><div class="mf" style="width:${v*10}%;background:${col}"></div></div></div>`;
  }).join('')}</div>`;
}
function legendHTML(b){
  const types = new Set(Object.values(b.fx).map(f=>f.type));
  const L = {hot:['#ff4b3e','Overactive'],low:['#3d6bff','Underactive'],calm:['#2dd4bf','Being calmed'],up:['#a3e635','Being boosted']};
  const chem = Object.entries(b.fl).filter(([k,v])=>Math.abs(v-1)>.06).map(([k,v])=>`<span class="lg"><i style="background:${CHEMS[k].color}"></i>${CHEMS[k].name} ${v>1?'↑':'↓'}</span>`).join('');
  return `<div class="legend">${[...types].map(t=>`<span class="lg"><i style="background:${L[t][0]}"></i>${L[t][1]}</span>`).join('')}${chem}</div>`;
}
function render(html){ gameEl.innerHTML = html; gameEl.scrollTop = 0 }

/* ---------------- screens ---------------- */
function screenHome(){
  GAME.step='home'; clearBrain();
  render(`<div class="ph"><span class="tag"><i style="background:#c9a2ff"></i>Game mode</span><button class="x" data-g="exit">×</button></div>
  <h2>Psych Clinic</h2>
  <p class="sum">Read the case, make a diagnosis, prescribe, then follow your patient at 2 and 8 weeks and watch their brain change.</p>
  <div class="disc">Educational simulation. Real treatment is individual and decided with a clinician. Nothing here is medical advice.</div>
  <h3>Choose a patient</h3>
  <div class="cases">${CASES.map(c=>`<button class="case" data-g="case" data-id="${c.id}">
     <div class="av sm" style="--c:${c.color}">${initials(c.name)}</div>
     <div class="cb"><div class="pn">${c.name}, ${c.age}</div><div class="pm">${c.hook}</div></div>
     <div class="st">${bestScores[c.id]!=null?'★'.repeat(stars(bestScores[c.id]))+'<span>'+bestScores[c.id]+'</span>':''}</div></button>`).join('')}</div>`);
}
function screenCase(){
  const c = GAME.c; GAME.step='case';
  applyBrain(brainFor(c, null));
  const dxOpts = Object.keys(DX).map(k=>`<button class="opt${GAME.dxPick===k?(k===c.dx?' right':' wrong'):''}${GAME.dxPick&&k===c.dx?' right':''}" data-g="dx" data-k="${k}" ${GAME.dxPick?'disabled':''}>${DX[k]}</button>`).join('');
  render(`<div class="ph">${stepsBar(0)}<button class="x" data-g="home">×</button></div>
  ${patientHead(c)}
  <blockquote>"${esc(c.quote)}"</blockquote>
  <h3>History</h3><ul>${c.history.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>
  <h3>Symptom severity</h3>${meterHTML(c.meters,false)}
  <h3>The brain right now</h3>${legendHTML(brainFor(c,null))}
  <h3>What's your working diagnosis?</h3><div class="opts">${dxOpts}</div>
  ${GAME.dxPick?`<div class="fb ${GAME.dxPick===c.dx?'good':'badf'}"><b>${GAME.dxPick===c.dx?'Correct':'Not quite: it\'s '+DX[c.dx]}</b>${c.clue}</div>
  <button class="cta" data-g="rx">Choose treatment →</button>`:''}`);
}
let rxSel = [];
function screenRx(){
  const c = GAME.c, week = GAME.w2 ? 2 : 0; GAME.step='rx';
  if(!rxSel.length && week===2) rxSel = GAME.items.filter(it=>it.stop==null).map(it=>({id:it.id,type:it.type,dose:it.dose}));
  const groups = {};
  for(const id in MEDS){ (groups[MEDS[id].group] = groups[MEDS[id].group]||[]).push(id) }
  const sel = id => rxSel.find(s=>s.id===id);
  const medRow = id => { const m = MEDS[id], s = sel(id);
    return `<div class="rx${s?' on':''}"><button class="rxm" data-g="tog" data-id="${id}" data-t="med"><span class="cbx"></span><span class="rn">${m.name}<small>${m.brand}</small></span><span class="rc">${m.cls}</span></button>
      ${s?`<div class="rxd"><span>Dose</span><button class="${s.dose===1?'on':''}" data-g="dose" data-id="${id}" data-d="1">Standard</button><button class="${s.dose===2?'on':''}" data-g="dose" data-id="${id}" data-d="2">Higher</button></div><p class="rxi">${m.mech}<br><em>Used for: ${m.uses}</em></p>`:''}</div>` };
  const thRow = id => { const t = THERAPIES[id], s = sel(id);
    return `<div class="rx${s?' on':''}"><button class="rxm" data-g="tog" data-id="${id}" data-t="therapy"><span class="cbx"></span><span class="rn">${t.full}<small>${t.name}</small></span><span class="rc">Therapy</span></button>${s?`<p class="rxi">${t.mech}</p>`:''}</div>` };
  const nMeds = rxSel.filter(s=>s.type==='med').length;
  render(`<div class="ph">${stepsBar(week?2:1)}<button class="x" data-g="home">×</button></div>
  ${patientHead(c)}
  <h2 class="h2s">${week?'Adjust treatment':'Write a prescription'}</h2>
  <p class="sum sm">Pick up to <b>2 medications</b>, plus therapy if you like. ${week?'Anything you untick is stopped; new picks start today (week 2).':''}</p>
  ${Object.keys(groups).map(g=>`<h3>${g}</h3>${groups[g].map(medRow).join('')}`).join('')}
  <h3>Psychotherapy</h3>${Object.keys(THERAPIES).map(thRow).join('')}
  <div class="rxfoot"><span>${nMeds}/2 meds · ${rxSel.length-nMeds} therapy</span><button class="cta" data-g="start" ${rxSel.length?'':'disabled'}>${week?'Apply & jump to week 8 →':'Start treatment → week 2'}</button></div>`);
}
function screenVisit(r){
  const c = GAME.c; GAME.step='visit';
  const b = brainFor(c, r); applyBrain(b);
  const cur = r.active.map(it=>{const d=itemData(it);return `<span class="pill">${d.name||d.full}${it.type==='med'?` · ${it.dose===2?'higher':'std'} dose`:''}</span>`}).join('');
  render(`<div class="ph">${stepsBar(r.w===2?2:3)}<button class="x" data-g="home">×</button></div>
  ${patientHead(c)}
  <div class="wk">Week ${r.w} follow-up</div>
  <div class="pills">${cur}</div>
  <blockquote>"${esc(r.quote)}"</blockquote>
  ${r.ev.filter(e=>e.t!=='info').map(e=>`<div class="ev ${e.t}"><b>${e.h}</b>${e.p}</div>`).join('')}
  <h3>Symptoms vs. week 0</h3>${meterHTML(r.meters,true)}
  ${r.sides.length?`<h3>Side effects reported</h3><div class="chips">${r.sides.map(s=>`<span class="se">${s.s}<small>${s.med}</small></span>`).join('')}</div>`:''}
  <h3>What's happening in the brain</h3>${legendHTML(b)}
  <ul class="mech">${b.mech.map(m=>`<li><b>${m.name}</b>: ${m.txt}</li>`).join('')}</ul>
  ${r.ev.filter(e=>e.t==='info').map(e=>`<div class="ev info"><b>${e.h}</b>${e.p}</div>`).join('')}
  ${r.w===2?`<div class="two"><button class="cta ghost" data-g="adjust">Adjust treatment</button><button class="cta" data-g="keep">Keep going → week 8</button></div>`
           :`<button class="cta" data-g="debrief">See results →</button>`}`);
}
function stars(s){ return s>=80?3:s>=55?2:1 }
function scoreGame(){
  const c = GAME.c, r = GAME.w8, rows = [];
  let sc = 0;
  const dxOk = GAME.dxPick===c.dx; rows.push(['Diagnosis', dxOk?20:0, 20, dxOk?'Correct':'Missed: '+DX[c.dx]]); sc += dxOk?20:0;
  const ms = r.meters.filter(m=>m.k!=='mania');
  let rel = ms.reduce((a,m)=>a+Math.max(0,(m.base-m.now)/m.base),0)/ms.length;
  if(r.manic) rel *= .3;
  const out = Math.round(rel*45); rows.push(['Symptom improvement', out, 45, Math.round(rel*100)+'% average reduction']); sc += out;
  const fm = r.active.filter(it=>it.type==='med');
  let rx = 0, rxNote = 'No first-line medication';
  if(fm.some(it=>c.firstLine.includes(it.id))){ rx = 20; rxNote = 'First-line choice';
    if(c.needsHighDose && !fm.some(it=>c.firstLine.includes(it.id)&&it.dose===2)){ rx = 12; rxNote = 'Right drug, dose too low for OCD' } }
  else if(fm.some(it=>c.secondLine.includes(it.id))){ rx = 10; rxNote = 'Reasonable second-line choice' }
  else if(!fm.length && c.therapy && r.active.some(it=>it.id===c.therapy)){ rx = 8; rxNote = 'Therapy alone: valid for some patients' }
  rows.push(['Medication choice', rx, 20, rxNote]); sc += rx;
  if(c.therapy){ const th = r.active.some(it=>it.id===c.therapy); rows.push(['Psychotherapy', th?15:0, 15, th?THERAPIES[c.therapy].full+' added':'Recommended: '+THERAPIES[c.therapy].full]); sc += th?15:0 }
  else { rows.push(['Psychotherapy', 15, 15, 'Not the priority in acute mania']); sc += 15 }
  const pen = [];
  if(GAME.switched) pen.push(['Triggered mania with an antidepressant', -20]);
  if(GAME.maniaWorse) pen.push(['Gave an antidepressant during mania', -20]);
  if(r.benzo && ['gad','panic'].includes(c.dx)) pen.push(['Still on a benzodiazepine at week 8', -10]);
  if(GAME.anxiogenicHit) pen.push(['Activating drug worsened anxiety', -5]);
  if(GAME.benzoEarly && !r.benzo && ['gad','panic'].includes(c.dx) && r.active.some(it=>c.firstLine.includes(it.id))) rows.push(['Benzo used as a short bridge', 0, 0, 'Nicely done: tapered once the SSRI kicked in']);
  pen.forEach(p=>{ sc += p[1] });
  return {score:Math.max(0,Math.min(100,sc)), rows, pen};
}
function screenDebrief(){
  const c = GAME.c, {score, rows, pen} = scoreGame(); GAME.step='debrief';
  bestScores[c.id] = Math.max(bestScores[c.id]||0, score);
  try{ localStorage.setItem('nv-clinic', JSON.stringify(bestScores)) }catch(e){}
  const idx = CASES.indexOf(c), next = CASES[(idx+1)%CASES.length];
  render(`<div class="ph">${stepsBar(4)}<button class="x" data-g="home">×</button></div>
  ${patientHead(c)}
  <div class="score"><div class="sn">${score}</div><div><div class="stars">${'★'.repeat(stars(score))}<span>${'★'.repeat(3-stars(score))}</span></div><div class="pm">out of 100</div></div></div>
  <div class="rows">${rows.map(r=>`<div class="row"><span>${r[0]}<small>${r[3]}</small></span><b>${r[2]?r[1]+'/'+r[2]:'✓'}</b></div>`).join('')}
  ${pen.map(p=>`<div class="row pen"><span>${p[0]}</span><b>${p[1]}</b></div>`).join('')}</div>
  <h3>Diagnosis</h3><p><b style="color:#fff">${DX[c.dx]}</b>. ${c.clue}</p>
  <h3>What clinicians typically do</h3><p>${c.answer}</p>
  <h3>Teaching points</h3><ul>${c.pearls.map(p=>`<li>${p}</li>`).join('')}</ul>
  <div class="two"><button class="cta ghost" data-g="retry">Try again</button><button class="cta" data-g="case" data-id="${next.id}">Next: ${next.name.split(' ')[0]} →</button></div>
  <button class="cta ghost wide" data-g="home">All patients</button>`);
}
function fastForward(weeks, then){
  gameEl.scrollTop = 0;
  gameEl.insertAdjacentHTML('beforeend', `<div class="ff"><div><div class="ffw">+${weeks} weeks</div><div class="pm">Fast-forwarding…</div></div></div>`);
  setTimeout(then, 1100);
}

/* ---------------- flow control ---------------- */
function startCase(id){
  GAME.c = CASES.find(c=>c.id===id); GAME.dxPick=null; GAME.items=[]; GAME.w2=null; GAME.w8=null;
  GAME.switched=false; GAME.maniaWorse=false; GAME.anxiogenicHit=false; GAME.benzoEarly=false; rxSel=[];
  screenCase();
}
function runVisit(w){
  const r = simulate(GAME.c, GAME.items, w, GAME.switched);
  if(r.manic || r.switched) GAME.switched = GAME.switched || r.manic;
  if(GAME.c.dx==='mania' && r.hasAD) GAME.maniaWorse = true;
  if(r.anxPen) GAME.anxiogenicHit = true;
  if(w===2 && r.benzo) GAME.benzoEarly = true;
  if(w===2) GAME.w2 = r; else GAME.w8 = r;
  screenVisit(r);
}
gameEl.addEventListener('click', e=>{
  const b = e.target.closest('[data-g]'); if(!b) return;
  const g = b.dataset.g;
  if(g==='exit') return exitGame();
  if(g==='home') return screenHome();
  if(g==='case') return startCase(b.dataset.id);
  if(g==='retry') return startCase(GAME.c.id);
  if(g==='dx'){ GAME.dxPick = b.dataset.k; return screenCase() }
  if(g==='rx'){ rxSel=[]; return screenRx() }
  if(g==='tog'){
    const id=b.dataset.id, t=b.dataset.t, i=rxSel.findIndex(s=>s.id===id);
    if(i>=0) rxSel.splice(i,1);
    else { if(t==='med' && rxSel.filter(s=>s.type==='med').length>=2){ b.closest('.rx').classList.add('shake'); setTimeout(()=>b.closest('.rx')&&b.closest('.rx').classList.remove('shake'),400); return }
      rxSel.push({id,type:t,dose:1}) }
    const y = gameEl.scrollTop; screenRx(); gameEl.scrollTop = y; return;
  }
  if(g==='dose'){ const s = rxSel.find(s=>s.id===b.dataset.id); s.dose = +b.dataset.d; const y = gameEl.scrollTop; screenRx(); gameEl.scrollTop = y; return }
  if(g==='start'){
    if(!GAME.w2){ GAME.items = rxSel.map(s=>({...s, start:0, stop:null})); fastForward(2, ()=>runVisit(2)) }
    else {
      GAME.items.forEach(it=>{ if(it.stop!=null) return; const s = rxSel.find(x=>x.id===it.id); if(!s) it.stop = 2; else it.dose = s.dose });
      rxSel.forEach(s=>{ if(!GAME.items.some(it=>it.id===s.id && it.stop==null)) GAME.items.push({...s, start:2, stop:null}) });
      fastForward(6, ()=>runVisit(8));
    }
    return;
  }
  if(g==='keep') return fastForward(6, ()=>runVisit(8));
  if(g==='adjust'){ rxSel=[]; return screenRx() }
  if(g==='debrief') return screenDebrief();
});

/* ---------------- enter / exit ---------------- */
function enterGame(){
  GAME.active = true; document.body.classList.add('gameOn'); gameEl.classList.add('open');
  closeInfo(); state.sel=null; paintCortex(); paintDeep();
  state.opacity = .2; applyOpacity();
  flyTo = {t:HOME_TGT.clone(), p:HOME_POS.clone().multiplyScalar(1.05)};
  screenHome(); hideHint();
}
function exitGame(){
  GAME.active = false; document.body.classList.remove('gameOn'); gameEl.classList.remove('open');
  clearBrain(); state.opacity = 1; applyOpacity();
}
document.getElementById('playBtn').onclick = () => GAME.active ? exitGame() : enterGame();

/* region panels opened during the game get a "back to patient" button */
const _openInfo = openInfo;
openInfo = function(html, acc){
  if(GAME.active) html = `<button class="back" data-close>← Back to patient</button>` + html;
  _openInfo(html, acc);
};

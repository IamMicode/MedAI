// ============================================================
// CURSOR
// ============================================================
const cur=document.getElementById('cursor'),ring=document.getElementById('cursor-ring');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;cur.style.left=mx+'px';cur.style.top=my+'px'});
(function ar(){rx+=(mx-rx)*.1;ry+=(my-ry)*.1;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(ar)})();
document.querySelectorAll('button,.btn,.sb-item,.settings-item,.faq-q,.history-row,.ach-card,.star,.mob-item').forEach(el=>{
  el.addEventListener('mouseenter',()=>{ring.style.width='52px';ring.style.height='52px';ring.style.borderColor='rgba(0,212,255,0.8)';cur.style.width='6px';cur.style.height='6px'});
  el.addEventListener('mouseleave',()=>{ring.style.width='36px';ring.style.height='36px';ring.style.borderColor='rgba(0,212,255,0.5)';cur.style.width='10px';cur.style.height='10px'});
});

// ============================================================
// PARTICLE CANVAS
// ============================================================
const pc=document.getElementById('particle-canvas'),px=pc.getContext('2d');
function rpc(){pc.width=window.innerWidth;pc.height=window.innerHeight}rpc();window.addEventListener('resize',rpc);
class MP{
  constructor(){this.reset(true)}
  reset(i){this.x=Math.random()*pc.width;this.y=i?Math.random()*pc.height:pc.height+20;this.vx=(Math.random()-.5)*.25;this.vy=-(Math.random()*.4+.15);this.sz=Math.random()*9+3;this.t=['c','x','h','r'][Math.floor(Math.random()*4)];this.col=Math.random()>.5?'0,212,255':'0,255,136';this.a=Math.random()*.5+.1;this.rot=Math.random()*Math.PI*2;this.rv=(Math.random()-.5)*.015;this.p=Math.random()*Math.PI*2;this.ps=Math.random()*.02+.008}
  update(){this.x+=this.vx;this.y+=this.vy;this.rot+=this.rv;this.p+=this.ps;if(this.y<-20)this.reset(false)}
  draw(){const a=this.a*(0.6+0.4*Math.sin(this.p));px.save();px.translate(this.x,this.y);px.rotate(this.rot);px.strokeStyle=`rgba(${this.col},${a})`;px.lineWidth=.7;px.beginPath();
    if(this.t==='c')px.arc(0,0,this.sz,0,Math.PI*2);
    else if(this.t==='r'){px.arc(0,0,this.sz,0,Math.PI*2);px.stroke();px.beginPath();px.arc(0,0,this.sz*.55,0,Math.PI*2)}
    else if(this.t==='x'){const s=this.sz;px.moveTo(-s,0);px.lineTo(s,0);px.moveTo(0,-s);px.lineTo(0,s)}
    else{for(let i=0;i<6;i++){const a2=(Math.PI/3)*i;i===0?px.moveTo(this.sz*Math.cos(a2),this.sz*Math.sin(a2)):px.lineTo(this.sz*Math.cos(a2),this.sz*Math.sin(a2))}px.closePath()}
    px.stroke();px.restore()}
}
const parts=Array.from({length:55},()=>new MP());
(function ap(){px.clearRect(0,0,pc.width,pc.height);parts.forEach(p=>{p.update();p.draw()});requestAnimationFrame(ap)})();

// ============================================================
// ECG CANVAS (bottom)
// ============================================================
const ec=document.getElementById('ecg-canvas'),ex=ec.getContext('2d');
function rec(){ec.width=window.innerWidth;ec.height=80}rec();window.addEventListener('resize',rec);
function ev(x){const c=200,p=x%c;if(p<20)return 0;if(p<35)return-8;if(p<45)return 70;if(p<55)return-8;if(p<62)return-25;if(p<67)return 100;if(p<75)return-35;if(p<85)return-12;if(p<110)return 22;if(p<130)return 6;return 0}
let ef=0;
function drawEcgOn(ctx,canvas,frame,spd,mid,scaleY,color){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.beginPath();ctx.strokeStyle=color||'rgba(0,255,136,1)';ctx.lineWidth=1.5;ctx.shadowColor='rgba(0,255,136,0.8)';ctx.shadowBlur=8;
  for(let x=0;x<canvas.width;x++){const v=ev(x+frame*spd);const y=mid-v*scaleY;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}
  ctx.stroke();ctx.shadowBlur=0;
  const er=(frame*spd)%canvas.width;const g=ctx.createLinearGradient(er-120,0,er,0);g.addColorStop(0,'rgba(3,11,20,0.95)');g.addColorStop(1,'rgba(3,11,20,0)');ctx.fillStyle=g;ctx.fillRect(Math.max(0,er-120),0,120,canvas.height);
}
(function ae(){drawEcgOn(ex,ec,ef,2.5,40,.22);ef++;requestAnimationFrame(ae)})();

// Mini ECG inside cards
function setupMiniEcg(canvasId){
  const c=document.getElementById(canvasId);if(!c)return null;
  c.width=c.parentElement?c.parentElement.offsetWidth||300:300;c.height=parseInt(c.style.height)||60;
  const ctx=c.getContext('2d');let f=0;
  (function am(){drawEcgOn(ctx,c,f,2,c.height/2,.16);f++;requestAnimationFrame(am)})();
}
setTimeout(()=>{setupMiniEcg('mini-ecg');setupMiniEcg('vitals-ecg')},300);

// ============================================================
// FLOATING DECO ICONS
// ============================================================
const dw=document.getElementById('deco-wrap'),ds=['✚','⚕','🧬','💊','🔬','🩻','❤','⚡','🧪','🩺'];
function spawnD(){const el=document.createElement('div');el.className='deco-icon';el.textContent=ds[Math.floor(Math.random()*ds.length)];const dur=12+Math.random()*10;el.style.cssText=`left:${Math.random()*100}%;bottom:-40px;font-size:${10+Math.random()*14}px;animation-duration:${dur}s;animation-delay:${Math.random()*3}s;`;dw.appendChild(el);setTimeout(()=>el.remove(),(dur+3)*1000)}
for(let i=0;i<16;i++)spawnD();setInterval(spawnD,2500);

// ============================================================
// VITALS SIMULATION (kept off so displayed vitals come from real manual/camera logs)
// ============================================================
function fluct(ids,base,range,suffix,decimals){
  setInterval(()=>{
    const v=base+(Math.random()-.5)*range;
    const display=decimals?v.toFixed(1):Math.round(v);
    ids.forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=display+(suffix||'')});
  },2000+Math.random()*1500);
}
const SIMULATE_VITALS = false;
if(SIMULATE_VITALS){
  fluct(['stat-hr','v-hr','vt-hr'],72,8);
  fluct(['stat-spo2','v-spo2','vt-spo2'],98,2);
  fluct(['stat-temp','v-temp','vt-temp'],37.1,.4,null,true);
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
function toggleSidebar(){const sb=document.getElementById('sidebar');sb.classList.toggle('collapsed');const btn=document.querySelector('.sb-toggle');const collapsed=sb.classList.contains('collapsed');btn.style.left=collapsed?'calc(var(--sidebar-w-collapsed) - 14px)':'calc(var(--sidebar-w) - 14px)';btn.textContent=collapsed?'›':'‹'}

// ============================================================
// TAB NAVIGATION
// ============================================================
const tabTitles={dashboard:'Dashboard',triage:'Quick Triage',chatbot:'AI Chatbot','medical-ai':'Medical Health AI','emotional-ai':'Emotional AI','mental-ai':'Mental Health AI','physical-ai':'Physical Health AI',history:'Symptom History',vitals:'Vitals Monitor',tools:'Health Tools',reports:'Reports & OCR',appointments:'Appointments',therapy:'Therapy Finder',achievements:'Achievements',profile:'My Profile',settings:'Settings',premium:'Unlock Premium'};
const tabBc={dashboard:'HOME / DASHBOARD',triage:'HOME / TRIAGE',chatbot:'AI / CHATBOT','medical-ai':'AI / MEDICAL','emotional-ai':'AI / EMOTIONAL','mental-ai':'AI / MENTAL','physical-ai':'AI / PHYSICAL',history:'HEALTH / HISTORY',vitals:'HEALTH / VITALS',tools:'HEALTH / TOOLS',reports:'HEALTH / REPORTS',appointments:'CARE / APPOINTMENTS',therapy:'CARE / THERAPY FINDER',achievements:'HEALTH / ACHIEVEMENTS',profile:'ACCOUNT / PROFILE',settings:'ACCOUNT / SETTINGS',premium:'ACCOUNT / PREMIUM'};

function showTab(id,el){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'));
  const panel=document.getElementById('tab-'+id);
  if(panel){panel.classList.add('active')}
  if(el)el.classList.add('active');
  document.getElementById('topbar-title').textContent=tabTitles[id]||id;
  document.getElementById('topbar-bc').textContent='// '+(tabBc[id]||id.toUpperCase());
  if(id === 'premium') renderPrices();
  if(id === 'therapy') renderTherapyFinder();
}

function setMobActive(el){document.querySelectorAll('.mob-item').forEach(i=>i.classList.remove('active'));el.classList.add('active')}

function openMobileMore(){
  const sheet = document.getElementById('mobile-more-sheet');
  if(sheet){
    sheet.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
}
function closeMobileMore(){
  const sheet = document.getElementById('mobile-more-sheet');
  if(sheet){
    sheet.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// ============================================================
// AI CONFIG
// Chatbot + Quick Triage → Gemini
// Emotional + Mental + Physical → OpenRouter
// ============================================================
const DEFAULT_GEMINI_KEY = 'AIzaSyDggjhL0RJiepeRd08mGWAiWytq5qPojoo'; // ← fallback key
function getGeminiKey() {
  return localStorage.getItem('medai_gemini_key') || DEFAULT_GEMINI_KEY;
}
function getGeminiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getGeminiKey()}`;
}
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

// Which AI uses which backend
const aiBackend = {
  chatbot:   'gemini',
  medical:   'gemini',
  emotional: 'openrouter',
  mental:    'openrouter',
  physical:  'openrouter'
};

window.systemPrompts = {
  general: `You are MedAI General Chatbot — a warm, knowledgeable health assistant. Answer general health questions clearly and concisely in 2-4 sentences. Explain medical terms in plain language. Always recommend consulting a licensed doctor for diagnosis or treatment. Be friendly but professional.`,

  medical: `You are MedAI Medical Health AI — a clinically-grounded health information assistant. Help users understand medical conditions, symptoms, medications (uses, common side effects, general interactions), procedures, and lab/clinical terminology in plain language. Be precise and evidence-based, citing well-established medical consensus rather than speculation. You do NOT diagnose, prescribe, or replace a licensed clinician — always frame information as educational. If the user describes symptoms that could be urgent or severe (e.g. chest pain, difficulty breathing, severe bleeding, signs of stroke, suicidal ideation), clearly and calmly tell them to seek immediate in-person or emergency care, and mention they can use MedAI's Quick Triage or Book Appointment features for next steps. Keep responses focused and clear — 3-6 sentences, using simple structure (short sentences, not walls of text). Never use the user's message as confirmation of a diagnosis.`,

  emotional: `You are MedAI Emotional Support AI — a compassionate, non-judgmental emotional companion. Your ONLY role is emotional support. Listen actively, validate feelings without minimizing them, reflect back what the user shares, and offer gentle comfort. NEVER give medical advice. NEVER push solutions. Ask open-ended questions to understand the user better. Respond with warmth, empathy and full presence. If the user expresses suicidal thoughts or extreme distress, gently encourage them to contact a professional or crisis line. Keep responses warm and human — 3-5 sentences.`,

  mental: `You are MedAI Mental Health AI — a supportive mental wellness guide. Help users with anxiety, depression, stress, sleep problems, burnout, low self-esteem, trauma, and general mental wellbeing. Use evidence-based techniques: CBT thought reframing, mindfulness exercises, breathing techniques, behavioural activation, journaling prompts, and grounding exercises. Give practical, actionable tools the user can try right now. Always clarify you are not a therapist and encourage professional help for serious conditions. Be compassionate but structured. Respond in 3-6 sentences with one practical tip.`,

  physical: `You are MedAI Physical Health AI — a knowledgeable fitness and nutrition coach. Help users with exercise planning, workout routines, nutrition advice, weight management, injury prevention, recovery, flexibility, sleep optimisation, and body performance. Tailor advice to the user's goals, fitness level, and any conditions they mention. Give specific, safe, practical recommendations. Never encourage dangerous practices. Be motivating and encouraging. Respond in 3-6 sentences with actionable advice.`
};

const chatHistories = { chatbot:[], medical:[], emotional:[], mental:[], physical:[] };
const chatKeys = { 'chatbot':'chatbot', 'medical-ai':'medical', 'emotional-ai':'emotional', 'mental-ai':'mental', 'physical-ai':'physical' };
const aiMeta = {
  chatbot:   { icon:'🤖', label:'MEDAI CHATBOT',      badge:'Gemini' },
  medical:   { icon:'🏥', label:'MEDICAL HEALTH AI',  badge:'Gemini' },
  emotional: { icon:'💭', label:'EMOTIONAL AI',        badge:'OpenRouter' },
  mental:    { icon:'🧠', label:'MENTAL HEALTH AI',    badge:'OpenRouter' },
  physical:  { icon:'💪', label:'PHYSICAL HEALTH AI',  badge:'OpenRouter' }
};

function chatStorageKey(){
  const u = getCurrentUser();
  return `medai_chat_history_${u.username || u.email || 'guest'}`;
}

function persistChatHistories(){
  localStorage.setItem(chatStorageKey(), JSON.stringify(chatHistories));
}

function restoreChatHistories(){
  let saved = {};
  try{ saved = JSON.parse(localStorage.getItem(chatStorageKey()) || '{}'); }catch(e){ saved = {}; }
  Object.keys(chatHistories).forEach(key=>{
    if(Array.isArray(saved[key])) chatHistories[key] = saved[key];
    const panelId = Object.keys(chatKeys).find(k => chatKeys[k] === key);
    const messagesEl = panelId ? document.getElementById('chat-' + panelId) : null;
    if(!messagesEl || !chatHistories[key].length) return;
    messagesEl.innerHTML = '';
    chatHistories[key].forEach(item=>{
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble ' + (item.role === 'user' ? 'user' : 'ai');
      if(item.role === 'user') bubble.textContent = item.content;
      else {
        const meta = aiMeta[key] || aiMeta.chatbot;
        bubble.innerHTML = `<div class="ai-label">${meta.icon} ${meta.label}</div>${item.content}`;
      }
      messagesEl.appendChild(bubble);
    });
  });
}

// ---- GEMINI with retry on quota/overload ----
async function callGemini(prompt, retries=3) {
  const activeKey = getGeminiKey();
  if (!activeKey || activeKey === 'YOUR_GEMINI_API_KEY_HERE') throw new Error('no_key');
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(getGeminiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
        })
      });
      if (res.status === 429 || res.status === 503) {
        const waitMs = (attempt + 1) * 3000;
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error?.message || 'API error ' + res.status;
        if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('quota_exceeded');
        }
        throw new Error(msg);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch(e) {
      if (e.message === 'no_key' || e.message === 'quota_exceeded') throw e;
      if (attempt === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('high_demand');
}

// ---- OPENROUTER ----
function getOpenRouterSettings(){
  return {
    key: localStorage.getItem('medai_openrouter_key') || '',
    model: localStorage.getItem('medai_openrouter_model') || DEFAULT_OPENROUTER_MODEL
  };
}

async function callOpenRouter(systemPrompt, userMessage) {
  const settings = getOpenRouterSettings();
  if(!settings.key) throw new Error('openrouter_no_key');
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.key}`,
      'HTTP-Referer': window.location.origin || 'http://localhost',
      'X-Title': 'MedAI Dashboard'
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role:'system', content: systemPrompt },
        { role:'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 650
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error?.message || `OpenRouter error ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

// ---- MAIN sendChat ----
async function sendChat(panelId, type) {
  const inputEl    = document.getElementById('input-' + panelId);
  const messagesEl = document.getElementById('chat-' + panelId);
  const msg        = inputEl.value.trim();
  if (!msg) return;
  inputEl.value = '';

  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user';
  userBubble.textContent = msg;
  messagesEl.appendChild(userBubble);

  const typing = document.createElement('div');
  typing.className = 'chat-bubble ai';
  typing.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const histKey   = chatKeys[panelId] || 'chatbot';
  const sysPrompt = window.systemPrompts[histKey] || window.systemPrompts.general;
  const meta      = aiMeta[histKey] || aiMeta.chatbot;
  const backend   = aiBackend[histKey] || 'gemini';

  chatHistories[histKey].push({ role: 'user', content: msg });
  persistChatHistories();
  const fullPrompt = sysPrompt + '\n\nUser: ' + msg;

  let reply = null;
  try {
    if (backend === 'openrouter') {
      reply = await callOpenRouter(sysPrompt, msg);
    } else {
      reply = await callGemini(fullPrompt);
    }
    if (!reply) reply = 'I had trouble generating a response. Please try again.';
    chatHistories[histKey].push({ role: 'assistant', content: reply });
    persistChatHistories();
    typing.remove();
    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble ai';
    aiBubble.innerHTML = `<div class="ai-label">${meta.icon} ${meta.label} <span style="font-size:8px;opacity:0.5;margin-left:6px">${meta.badge}</span></div>${reply}`;
    messagesEl.appendChild(aiBubble);

  } catch(e) {
    typing.remove();
    const errBubble = document.createElement('div');
    errBubble.className = 'chat-bubble ai';

    if (e.message === 'no_key') {
      errBubble.innerHTML = `<div class="ai-label">⚙️ SETUP</div>Open <strong>dashboard.html</strong> and set your <code>GEMINI_KEY</code>.`;
    } else if (e.message === 'quota_exceeded') {
      errBubble.innerHTML = `<div class="ai-label">⚠️ QUOTA</div>Your Gemini free quota is exhausted for today. It resets at midnight. Try again tomorrow or upgrade your Gemini plan at <strong>aistudio.google.com</strong>.`;
    } else if (e.message === 'high_demand' || (e.message && e.message.includes('429'))) {
      errBubble.innerHTML = `<div class="ai-label">⏳ HIGH DEMAND</div>Gemini is under high load right now. Please wait 30 seconds and try again — your message is not lost.`;
    } else if (e.message === 'openrouter_no_key') {
      errBubble.innerHTML = `<div class="ai-label">🔑 OPENROUTER SETUP</div>Go to <strong>Settings → OpenRouter API</strong>, paste your OpenRouter key, save it, then try again.`;
    } else {
      errBubble.innerHTML = `<div class="ai-label">⚠️ ERROR</div>${e.message || 'Something went wrong. Please try again.'}`;
    }
    messagesEl.appendChild(errBubble);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
// ============================================================
// QUICK TRIAGE
// ============================================================
async function startTriage() {
  const input  = document.getElementById('triage-input').value.trim();
  const result = document.getElementById('triage-result');
  if (!input) return;

  result.style.display = 'block';
  result.innerHTML = '<div style="display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:12px;color:var(--muted)"><div class="typing-dots"><span></span><span></span><span></span></div>Analyzing symptoms...</div>';

  const prompt = `You are a medical triage AI. Analyze these symptoms and respond ONLY with a raw JSON object — no markdown, no backticks, no extra text whatsoever:
{"triage_level":"home","triage_title":"short action phrase","summary":"2-3 sentence assessment","confidence":80}
triage_level must be exactly one of: "home", "doctor_soon", or "emergency".
Symptoms: ${input}`;

  try {
    const reply = await callGemini(prompt.replace('temperature: 0.7', 'temperature: 0.3'));

    const cleaned = (reply || '{}').replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}/);
    const r       = match ? JSON.parse(match[0]) : {};

    const cfg = {
      home:        { icon:'🏠', color:'var(--safe)',    label:'Stay Home' },
      doctor_soon: { icon:'🏥', color:'var(--warning)', label:'See Doctor' },
      emergency:   { icon:'🚨', color:'var(--danger)',  label:'Emergency' }
    };
    const c = cfg[r.triage_level] || cfg.home;

    result.innerHTML = `<div style="background:rgba(0,0,0,0.3);border:1px solid ${c.color}33;border-radius:12px;padding:1.25rem;display:flex;gap:14px;align-items:flex-start">
      <div style="font-size:32px">${c.icon}</div>
      <div style="flex:1">
        <div style="font-family:var(--head);font-size:16px;font-weight:700;color:${c.color};margin-bottom:4px">${r.triage_title || c.label}</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:8px">${r.summary || ''}</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--muted)">CONFIDENCE: ${r.confidence || 70}%</div>
      </div>
    </div>`;
    saveTriageResult({
      symptoms: input,
      level: r.triage_level || 'home',
      title: r.triage_title || c.label,
      summary: r.summary || '',
      confidence: r.confidence || 70,
      createdAt: new Date().toISOString()
    });

  } catch(e) {
    let msg = '';
    if (e.message === 'no_key') {
      msg = '⚙️ Set your <code>GEMINI_KEY</code> in dashboard.html to use Quick Triage.';
    } else if (e.message === 'quota_exceeded') {
      msg = '⚠️ Gemini quota exhausted for today. Resets at midnight.';
    } else if (e.message === 'high_demand') {
      msg = '⏳ Gemini is under high load. Wait 30 seconds and try again.';
    } else {
      msg = '⚠️ ' + (e.message || 'Analysis failed. Please try again.');
    }
    result.innerHTML = `<div style="font-size:13px;color:var(--muted);line-height:1.7">${msg}</div>`;
  }
}

// ============================================================
// FAQ TOGGLE
// ============================================================
function toggleFaq(el){const item=el.parentElement;const isOpen=item.classList.contains('open');document.querySelectorAll('.faq-item').forEach(i=>{i.classList.remove('open');i.querySelector('.faq-a').classList.remove('open')});if(!isOpen){item.classList.add('open');item.querySelector('.faq-a').classList.add('open')}}
function showFaq(){showTab('settings',null);setTimeout(()=>document.getElementById('faq-section').scrollIntoView({behavior:'smooth'}),300)}

// ============================================================
// STAR RATING
// ============================================================
function rateStar(n){
  const stars=document.querySelectorAll('.star');
  stars.forEach((s,i)=>{s.classList.toggle('active',i<n)});
  const msgs=['Ouch... we\'ll do better!','Thanks for the feedback.','Good to know, improving!','Great, glad you like it!','Amazing! You made our day! ⭐'];
  document.getElementById('rating-msg').textContent=msgs[n-1]||'';
  localStorage.setItem(userStoragePrefix()+'rating', String(n));
}

function renderSavedRating(){
  const saved = Number(localStorage.getItem(userStoragePrefix()+'rating') || 0);
  if(!saved) return;
  const stars=document.querySelectorAll('.star');
  stars.forEach((s,i)=>{s.classList.toggle('active',i<saved)});
  const msg=document.getElementById('rating-msg');
  if(msg) msg.textContent = `Saved rating: ${saved}/5.`;
}

// ============================================================
// DELETE ACCOUNT CONFIRM
// ============================================================
function confirmDelete(){
  const modal = document.getElementById('delete-modal');
  if(modal) modal.style.display = 'flex';
}
function closeDeleteModal(){
  const modal = document.getElementById('delete-modal');
  if(modal) modal.style.display = 'none';
  document.getElementById('delete-confirm-input').value = '';
  document.getElementById('delete-error').style.display = 'none';
}
function executeDelete(){
  const input = document.getElementById('delete-confirm-input').value.trim();
  const user  = JSON.parse(localStorage.getItem('medai_current_user') || '{}');
  const errEl = document.getElementById('delete-error');
  if(input !== 'DELETE'){
    errEl.textContent = 'Please type DELETE exactly to confirm.';
    errEl.style.display = 'block';
    return;
  }
  const users = JSON.parse(localStorage.getItem('medai_users') || '[]');
  const filtered = users.filter(u => u.username !== user.username);
  localStorage.setItem('medai_users', JSON.stringify(filtered));
  localStorage.removeItem('medai_current_user');
  closeDeleteModal();
  alert('Your account has been permanently deleted.');
  window.location.href = 'Login_page.html';
}

function logoutUser(){
  localStorage.removeItem('medai_current_user');
  if(window.medaiShowLoader) window.medaiShowLoader('Signing out');
  setTimeout(()=>{ window.location.href = 'Login_page.html'; }, 350);
}

// ============================================================
// GSAP STAGGER ON DASHBOARD LOAD
// ============================================================
setTimeout(()=>{
  if(window.gsap){
    gsap.from('.stat-card',{opacity:0,y:20,stagger:.08,duration:.6,ease:'power2.out'});
    gsap.from('.glass-card',{opacity:0,y:24,stagger:.06,duration:.7,ease:'power2.out',delay:.1});
  }else{
    document.querySelectorAll('.glass-card,.stat-card').forEach(el=>{el.style.opacity='1';el.style.transform='none'});
  }
},200);

setTimeout(()=>{
  document.querySelectorAll('.glass-card,.stat-card,.ach-card').forEach(el=>{el.style.opacity='1';el.style.visibility='visible'});
},1500);

// ============================================================
// LOAD USER (BACKEND FIRST, LOCALSTORAGE FALLBACK)
// ============================================================
const API_BASE_URL = localStorage.getItem('medai_api_base_url')
  || (['localhost','127.0.0.1'].includes(window.location.hostname)
        ? 'http://127.0.0.1:5500'
        : 'https://medai-backend-5r9o.onrender.com');

async function syncUserFromBackend(){
  const token = localStorage.getItem('medai_token');
  if(!token) return null;

  try{
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if(!res.ok){
      if(res.status === 401){
        localStorage.removeItem('medai_token');
      }
      return null;
    }
    const data = await res.json();
    if(data.user){
      localStorage.setItem('medai_current_user', JSON.stringify(data.user));
      return data.user;
    }
  }catch(e){
    console.warn('Could not reach backend, using local data instead.', e);
  }
  return null;
}

(async function loadUser(){
  await syncUserFromBackend();

  const raw=localStorage.getItem('medai_current_user');
  if(!raw){
    return;
  }
  const u=JSON.parse(raw);

  document.querySelectorAll('[id="greeting-name"]').forEach(el=>el.textContent=u.firstname||u.username||'User');
  renderProfileAvatar(u);

  const sbName=document.querySelector('.sb-user-name');
  if(sbName) sbName.textContent=u.username||u.firstname||'User';

  const sbPlan=document.querySelector('.sb-user-plan');
  if(sbPlan) sbPlan.textContent=(u.plan||'Free')+' Plan';

  const greeting=document.querySelector('#tab-dashboard .sec-title');
  if(greeting){
    greeting.innerHTML=`${getGreeting()}, <span class="grad">${u.firstname||u.username||'User'}</span> 👋`;
  }

  const greetSub=document.querySelector('#tab-dashboard .sec-sub');
  if(greetSub && u.bloodGroup){
    greetSub.textContent=`Blood Group: ${u.bloodGroup} · ${u.allergies&&u.allergies.length>0?'⚠️ Allergies: '+u.allergies.join(', '):'No known allergies'}`;
  }

  const healthContext=u?`
Patient Health Profile (use this to personalize responses):
- Name: ${u.firstname||''} ${u.lastname||''}
- Age/DOB: ${u.dob||'Unknown'}
- Gender: ${u.gender||'Not specified'}
- Blood Group: ${u.bloodGroup||'Unknown'}
- Height: ${u.height||'?'} cm, Weight: ${u.weight||'?'} kg
- Medical Conditions: ${(u.conditions&&u.conditions.length>0)?u.conditions.join(', '):'None reported'}
- Allergies: ${(u.allergies&&u.allergies.length>0)?'⚠️ '+u.allergies.join(', '):'None reported'}
- Current Medications: ${u.medications||'None'}
- Smokes: ${u.smokes?'Yes':'No'}, Alcohol: ${u.alcohol?'Yes':'No'}, Exercises: ${u.exercises?'Yes':'No'}
`:'';

  if(window.systemPrompts && healthContext){
    Object.keys(window.systemPrompts).forEach(k=>{
      window.systemPrompts[k] = window.systemPrompts[k] + healthContext;
    });
  }
  loadProfileForm();
  loadLocalFrontendData();
  renderTriageHistory();
  personalizeEmergencyContact(u);
  restoreChatHistories();
  renderNotifications();
  renderDailyTip();
  loadSettingsControls();
  maybeShowOnboarding();
  refreshDailyScore();
  syncTherapyCountryFromProfile(u);
})();

// ============================================================
// FRONTEND HEALTH TOOLS
// ============================================================
let calorieTotal = 1260;
var heartScan = { stream:null, raf:null, samples:[], startedAt:0, torchTrack:null };

function getUserMediaCompat(constraints){
  if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
    return navigator.mediaDevices.getUserMedia(constraints);
  }
  const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  if(legacy){
    return new Promise((resolve,reject)=>legacy.call(navigator,constraints,resolve,reject));
  }
  return Promise.reject(new Error('Camera API is not available on this page'));
}

async function requestHeartCamera(){
  const attempts = [
    { video:{ facingMode:{ideal:'environment'}, width:{ideal:640}, height:{ideal:480} }, audio:false },
    { video:{ facingMode:'environment' }, audio:false },
    { video:{ width:{ideal:640}, height:{ideal:480} }, audio:false },
    { video:true, audio:false }
  ];
  let lastError = null;
  for(const constraints of attempts){
    try{
      return await getUserMediaCompat(constraints);
    }catch(e){
      lastError = e;
    }
  }
  throw lastError || new Error('No camera stream available');
}

async function startHeartScan(){
  const preview = document.getElementById('heart-preview');
  const result = document.getElementById('heart-result');
  const wave = document.getElementById('heart-wave');
  if(!preview || !result) return;
  stopHeartScan(false);
  const hasCameraApi = !!(navigator.mediaDevices?.getUserMedia || navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
  if(!hasCameraApi){
    result.innerHTML = 'Camera access is not available here. Open this page in Chrome/Edge/Safari from HTTPS or http://localhost so the browser can show the camera permission prompt.';
    return;
  }
  const isLocalFile = location.protocol === 'file:';
  const isLocalHost = ['localhost','127.0.0.1','::1',''].includes(location.hostname);
  if(isLocalFile){
    result.innerHTML = `Camera requires a web server. Open this file via <strong>http://localhost</strong> (e.g. use VS Code Live Server, or run <code>python -m http.server</code>) instead of opening it directly as a file://... path. Browsers block camera access on file:// URLs.`;
    return;
  }
  if(window.isSecureContext === false && !isLocalHost){
    result.innerHTML = `Camera access needs HTTPS or localhost before the permission prompt can appear. Current page origin: ${escapeHtml(location.origin || location.protocol)}.`;
    return;
  }
  let activeStream = null;
  try{
    result.textContent = 'Requesting camera permission...';
    const stream = await requestHeartCamera();
    activeStream = stream;
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline','');
    video.setAttribute('muted','');
    video.srcObject = stream;
    preview.innerHTML = '';
    preview.appendChild(video);
    await new Promise(resolve=>{
      if(video.readyState >= 2) resolve();
      else video.onloadedmetadata = resolve;
      setTimeout(resolve, 1200);
    });
    await video.play();

    const track = stream.getVideoTracks()[0];
    heartScan = { stream, raf:null, samples:[], startedAt:performance.now(), torchTrack:track };
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    if(capabilities.torch){
      try{ await track.applyConstraints({ advanced:[{ torch:true }] }); }catch(e){}
    }
    result.innerHTML = 'Scanning pulse signal... cover the camera fully with one fingertip and stay still for 20 seconds. If your device asks for camera permission, allow it.';
    processHeartFrames(video, wave, result);
  }catch(e){
    if(activeStream) activeStream.getTracks().forEach(t=>t.stop());
    const errName = e.name || '';
    let errMsg = '';
    if(errName === 'NotAllowedError' || errName === 'PermissionDeniedError'){
      errMsg = 'Camera permission was denied. Click the camera icon in your browser address bar to allow access, then try again.';
    } else if(errName === 'NotFoundError' || errName === 'DevicesNotFoundError'){
      errMsg = 'No camera found on this device. Connect a camera and try again.';
    } else if(errName === 'NotReadableError' || errName === 'TrackStartError'){
      errMsg = 'Camera is already in use by another app. Close other apps using the camera (e.g. video calls, other tabs) and try again.';
    } else if(errName === 'OverconstrainedError'){
      errMsg = 'Camera constraints could not be satisfied. Trying again with basic settings...';
    } else {
      errMsg = `Camera could not start: ${escapeHtml(e.message || 'permission denied')}. Allow camera access, close other apps using the camera, and try again.`;
    }
    result.innerHTML = errMsg;
  }
}

function processHeartFrames(video, wave, result){
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  canvas.width = 96; canvas.height = 72;
  const waveCtx = wave ? wave.getContext('2d') : null;

  function tick(now){
    if(!heartScan.stream) return;
    if(video.readyState >= 2){
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let red=0, green=0, blue=0, count=0;
      for(let i=0;i<data.length;i+=16){
        red += data[i]; green += data[i+1]; blue += data[i+2]; count++;
      }
      red/=count; green/=count; blue/=count;
      heartScan.samples.push({ t:now, v:red, g:green, b:blue });
      heartScan.samples = heartScan.samples.filter(s => now - s.t < 22000);
      drawHeartWave(wave, waveCtx, heartScan.samples);
    }
    const elapsed = (now - heartScan.startedAt) / 1000;
    if(elapsed >= 20){
      finishHeartScan();
      return;
    }
    result.innerHTML = `Scanning... ${Math.max(0, Math.ceil(20-elapsed))}s left. Signal quality improves when the preview looks reddish and steady.`;
    heartScan.raf = requestAnimationFrame(tick);
  }
  heartScan.raf = requestAnimationFrame(tick);
}

function drawHeartWave(canvas, ctx, samples){
  if(!canvas || !ctx) return;
  const w = canvas.width = canvas.clientWidth || 300;
  const h = canvas.height = canvas.clientHeight || 42;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = 'rgba(0,255,136,.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if(samples.length < 2){ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();return}
  const vals = samples.map(s=>s.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  samples.forEach((s,i)=>{
    const x = (i/(samples.length-1))*w;
    const norm = (s.v-min)/Math.max(1,max-min);
    const y = h - (norm*h*.8 + h*.1);
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();
}

function finishHeartScan(){
  const result = document.getElementById('heart-result');
  const bpm = estimateBpm(heartScan.samples);
  const quality = estimateSignalQuality(heartScan.samples);
  stopHeartScan(false);
  if(!result) return;
  
  if(!bpm){
    const diagnostic = getDiagnosticInfo(heartScan.samples);
    result.innerHTML = `<span style="color:var(--warning)">Could not detect stable pulse.</span><br/><span style="font-size:12px;margin-top:6px;display:block">${diagnostic}</span>`;
    return;
  }
  result.innerHTML = `<strong style="color:var(--safe)">${bpm} BPM</strong> estimated heart rate. Signal quality: ${quality}. This is a wellness estimate, not a medical diagnosis.`;
  ['stat-hr','v-hr','vt-hr'].forEach(id=>{const el=document.getElementById(id); if(el) el.textContent=bpm;});
  saveVitalReading({heartRate:bpm, source:'camera', quality, createdAt:new Date().toISOString()});
}

function getDiagnosticInfo(samples){
  if(!samples || samples.length < 30) return "Not enough data. Try again.";
  const values = samples.map(s=>s.v);
  const mean = values.reduce((a,b)=>a+b,0)/values.length;
  const max = Math.max(...values), min = Math.min(...values);
  const amplitude = max - min;
  
  if(amplitude < 0.8) return "Signal too weak. Ensure fingertip fully covers camera and check lighting.";
  if(amplitude < 1.5) return "Weak signal detected. Try improving lighting or keeping finger more still.";
  return "Signal unstable. Keep fingertip steady and avoid finger movement during scan.";
}

function estimateBpm(samples){
  if(!samples || samples.length < 60) return null;
  const values = samples.map(s=>s.v);
  const times = samples.map(s=>s.t);
  const mean = values.reduce((a,b)=>a+b,0)/values.length;
  const centered = values.map(v=>v-mean);
  
  const smoothed = centered.map((_,i,arr)=>{
    const from=Math.max(0,i-3), to=Math.min(arr.length-1,i+3);
    let sum=0,c=0; for(let j=from;j<=to;j++){sum+=arr[j];c++}
    return sum/c;
  });
  
  const minInterval = 250;
  const peaks = [];
  const max = Math.max(...smoothed), min = Math.min(...smoothed);
  const amplitude = max - min;
  
  if(amplitude < 0.8) return null;
  
  const threshold = min + (amplitude * 0.55);
  for(let i=1;i<smoothed.length-1;i++){
    if(smoothed[i] > threshold && smoothed[i] > smoothed[i-1] && smoothed[i] >= smoothed[i+1]){
      if(!peaks.length || times[i] - peaks[peaks.length-1] > minInterval) peaks.push(times[i]);
    }
  }
  
  if(peaks.length < 4) return null;
  
  const intervals = [];
  for(let i=1;i<peaks.length;i++) intervals.push(peaks[i]-peaks[i-1]);
  intervals.sort((a,b)=>a-b);
  
  const trimmed = intervals.slice(Math.floor(intervals.length*0.15), Math.ceil(intervals.length*0.85));
  if(trimmed.length === 0) return null;
  
  const avg = trimmed.reduce((a,b)=>a+b,0)/trimmed.length;
  const bpm = Math.round(60000/avg);
  return bpm >= 40 && bpm <= 200 ? bpm : null;
}

function estimateSignalQuality(samples){
  if(!samples || samples.length < 30) return 'low';
  const reds = samples.map(s=>s.v), greens=samples.map(s=>s.g), blues=samples.map(s=>s.b);
  const redAvg = reds.reduce((a,b)=>a+b,0)/reds.length;
  const greenAvg = greens.reduce((a,b)=>a+b,0)/greens.length;
  const blueAvg = blues.reduce((a,b)=>a+b,0)/blues.length;
  const spread = Math.max(...reds)-Math.min(...reds);
  
  if(redAvg > greenAvg * 1.10 && redAvg > blueAvg * 1.15 && spread > 5) return 'excellent';
  if(redAvg > greenAvg * 1.08 && redAvg > blueAvg * 1.12 && spread > 3) return 'good';
  if(spread > 2) return 'fair';
  return 'low';
}

function stopHeartScan(clearPreview=true){
  if(heartScan.raf) cancelAnimationFrame(heartScan.raf);
  if(heartScan.stream) heartScan.stream.getTracks().forEach(t=>t.stop());
  heartScan = { stream:null, raf:null, samples:[], startedAt:0, torchTrack:null };
  if(clearPreview){
    const preview=document.getElementById('heart-preview');
    const result=document.getElementById('heart-result');
    if(preview) preview.textContent='Place your fingertip over the rear camera. On phones, allow camera access and turn on the flashlight if prompted.';
    if(result) result.textContent='Scanner stopped.';
  }
}

function addMedicineReminder(){
  const name = document.getElementById('med-name')?.value.trim();
  const time = document.getElementById('med-time')?.value || 'Now';
  const dose = document.getElementById('med-dose')?.value.trim() || 'Dose not set';
  const frequency = document.getElementById('med-frequency')?.value || 'Daily';
  const list = document.getElementById('medicine-list');
  if(!name || !list) return;
  const item = document.createElement('div');
  item.className = 'timeline-item';
  item.innerHTML = `<div class="timeline-time">${time}</div><div><div class="timeline-title">${escapeHtml(name)}</div><div class="timeline-meta">${escapeHtml(dose)} - ${escapeHtml(frequency)}</div></div><span class="badge badge-warn" onclick="this.textContent='Taken';this.className='badge badge-green'">Due</span>`;
  list.prepend(item);
  const reminders = getStored('reminders', []);
  reminders.unshift({name,time,dose,frequency,status:'Due',createdAt:new Date().toISOString()});
  setStored('reminders', reminders.slice(0,30));
  updateHistoryDashboard();
  renderNotifications();
  ['med-name','med-dose'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
}

function stepTracker(id,delta){
  const el=document.getElementById(id);
  if(!el) return;
  const next=Math.max(0,(parseFloat(el.textContent)||0)+delta);
  el.textContent=Number.isInteger(next)?next:next.toFixed(1);
  setStored('trackers', {water:document.getElementById('water-count')?.textContent, sleep:document.getElementById('sleep-count')?.textContent});
  refreshDailyScore();
  updateHistoryDashboard();
}

function calculateBmi(){
  const h=parseFloat(document.getElementById('bmi-height')?.value);
  const w=parseFloat(document.getElementById('bmi-weight')?.value);
  const out=document.getElementById('bmi-result');
  if(!out) return;
  if(!h || !w){out.textContent='Enter height in cm and weight in kg.';return}
  const bmi=w/Math.pow(h/100,2);
  const status=bmi<18.5?'Underweight':bmi<25?'Healthy range':bmi<30?'Overweight':'Obesity range';
  out.innerHTML=`BMI: <strong style="color:var(--accent)">${bmi.toFixed(1)}</strong> - ${status}. Use this as a screening tool, not a diagnosis.`;
}

function calculateStress(){
  const s=parseInt(document.getElementById('stress-level')?.value||0,10);
  const a=parseInt(document.getElementById('anxiety-level')?.value||0,10);
  const out=document.getElementById('stress-result');
  const avg=(s+a)/2;
  const label=avg<=3?'Low':avg<=6?'Moderate':'High';
  if(out) out.innerHTML=`Stress/anxiety score: <strong style="color:${avg>6?'var(--warning)':'var(--safe)'}">${avg.toFixed(1)}/10</strong> - ${label}. Try breathing support in Mental Health AI if it feels heavy.`;
  refreshDailyScore();
}

function addFoodLog(){
  const food=document.getElementById('food-name')?.value.trim();
  const cal=parseInt(document.getElementById('food-cal')?.value,10);
  const list=document.getElementById('food-list');
  if(!food || !cal || !list) return;
  calorieTotal += cal;
  const total=document.getElementById('calorie-total');
  if(total) total.textContent=calorieTotal;
  const item=document.createElement('div');
  item.className='timeline-item';
  item.innerHTML=`<div class="timeline-time">Now</div><div><div class="timeline-title">${escapeHtml(food)}</div><div class="timeline-meta">${cal} kcal</div></div><span class="badge badge-blue">Meal</span>`;
  list.prepend(item);
  const foods = getStored('foods', []);
  foods.unshift({food,cal,createdAt:new Date().toISOString()});
  setStored('foods', foods.slice(0,40));
  setStored('calorieTotal', calorieTotal);
  updateHistoryDashboard();
  renderNotifications();
  ['food-name','food-cal'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  refreshDailyScore();
}

function refreshDailyScore(){
  const score=document.getElementById('daily-score');
  if(!score) return;
  const u = getCurrentUser();
  const water=parseFloat(document.getElementById('water-count')?.textContent||0);
  const sleep=parseFloat(document.getElementById('sleep-count')?.textContent||0);
  const stress=parseInt(document.getElementById('stress-level')?.value||4,10);
  let profileScore = 20;
  if(u.bloodGroup) profileScore += 4;
  if(u.height && u.weight) profileScore += 4;
  if(u.emergName && u.emergPhone) profileScore += 4;
  if(u.exercises) profileScore += 5;
  if(u.smokes) profileScore -= 7;
  if(u.alcohol) profileScore -= 3;
  if(Array.isArray(u.conditions) && u.conditions.length) profileScore -= Math.min(8, u.conditions.length * 2);
  if(Array.isArray(u.allergies) && u.allergies.length) profileScore -= Math.min(5, u.allergies.length);
  const calculated=Math.round(Math.max(35, Math.min(100,profileScore+(water/8)*18+(sleep/8)*18+(10-stress)*2.5+28)));
  score.textContent=calculated;
  score.style.color=calculated>=80?'var(--safe)':calculated>=65?'var(--warning)':'var(--danger)';
  const profileScoreEl = document.getElementById('profile-health-score');
  if(profileScoreEl) profileScoreEl.textContent = `${calculated}/100`;
}

function fakeOcrFileName(){
  const input=document.getElementById('report-file');
  const status=document.getElementById('ocr-status');
  if(status) status.textContent=input?.files?.[0] ? `Selected: ${input.files[0].name}. OCR extraction will connect here later.` : 'No file selected yet.';
}

function fillSampleReport(){
  const text=document.getElementById('report-text');
  if(text) text.value='Hemoglobin: 13.8 g/dL\nWBC: 6.4 x10^9/L\nFasting blood glucose: 112 mg/dL\nLDL cholesterol: 142 mg/dL\nVitamin D: 18 ng/mL';
  const status=document.getElementById('ocr-status');
  if(status) status.textContent='Sample lab values loaded.';
}

function explainLabReport(){
  const text=document.getElementById('report-text')?.value.trim();
  const out=document.getElementById('lab-explanation');
  if(!out) return;
  if(!text){out.textContent='Paste report text or use the sample first.';return}
  const findings = analyzeLabReportText(text);
  if(!findings.length){
    out.innerHTML = `<strong style="color:var(--accent)">Plain-English summary</strong><br><br>
    I captured the report text, but I could not confidently detect common numeric labs yet. Check the lab reference ranges printed beside each result and ask a clinician to interpret anything marked high, low, or abnormal.<br><br>
    <span class="history-meta">Frontend parser: paste clearer text like "LDL 142 mg/dL" or "Vitamin D: 18 ng/mL" for a more specific summary.</span>`;
    return;
  }
  out.innerHTML = `<strong style="color:var(--accent)">Plain-English summary</strong><br><br>` +
    findings.map(f=>`<div class="privacy-row"><div><strong>${escapeHtml(f.name)}: ${escapeHtml(f.value)} ${escapeHtml(f.unit)}</strong><br><span>${escapeHtml(f.note)}</span></div><span class="badge ${f.badge}">${escapeHtml(f.status)}</span></div>`).join('') +
    `<br><span class="history-meta">Use this as a reading aid only. Lab interpretation depends on age, symptoms, medications, and the lab's own reference range.</span>`;
}

function analyzeLabReportText(text){
  const checks = [
    {
      name: 'Hemoglobin',
      unit: 'g/dL',
      rx: /hemoglobin\D{0,20}(\d+(?:\.\d+)?)/i,
      read: v => v < 12 ? ['Low','Ask about anemia, bleeding, iron/B12, or chronic illness.','badge-warn']
             : v > 17.5 ? ['High','May need clinical review, especially with dehydration or breathing conditions.','badge-warn']
             : ['Normal','Within a common adult reference range.','badge-green']
    },
    {
      name: 'WBC',
      unit: 'x10^9/L',
      rx: /\b(?:wbc|white blood cells?)\D{0,20}(\d+(?:\.\d+)?)/i,
      read: v => v < 4 ? ['Low','Can occur with some infections, medicines, or bone marrow issues.','badge-warn']
             : v > 11 ? ['High','Can rise with infection, inflammation, stress, or steroid use.','badge-warn']
             : ['Normal','Within a common adult reference range.','badge-green']
    },
    {
      name: 'Fasting glucose',
      unit: 'mg/dL',
      rx: /(?:fasting blood glucose|fasting glucose|glucose)\D{0,20}(\d+(?:\.\d+)?)/i,
      read: v => v >= 126 ? ['High','Diabetes-range if fasting and confirmed on repeat testing.','badge-danger']
             : v >= 100 ? ['Borderline','Prediabetes-range if fasting; discuss trend and lifestyle follow-up.','badge-warn']
             : v < 70 ? ['Low','Low glucose can cause sweating, shaking, confusion, or fainting.','badge-danger']
             : ['Normal','Within a common fasting range.','badge-green']
    },
    {
      name: 'LDL cholesterol',
      unit: 'mg/dL',
      rx: /\bldl\D{0,20}(\d+(?:\.\d+)?)/i,
      read: v => v >= 190 ? ['Very high','Usually needs prompt clinician review for cardiovascular risk.','badge-danger']
             : v >= 130 ? ['High','Above common targets; ask about heart-risk reduction.','badge-warn']
             : v >= 100 ? ['Borderline','May be acceptable or high depending on your risk profile.','badge-warn']
             : ['Good','Often considered near optimal for many adults.','badge-green']
    },
    {
      name: 'Vitamin D',
      unit: 'ng/mL',
      rx: /vitamin\s*d\D{0,20}(\d+(?:\.\d+)?)/i,
      read: v => v < 20 ? ['Low','Commonly treated with supplementation after clinician guidance.','badge-warn']
             : v < 30 ? ['Insufficient','May need diet, sunlight, or supplement follow-up.','badge-warn']
             : ['Adequate','Within a commonly accepted adequate range.','badge-green']
    }
  ];

  return checks.map(check => {
    const match = text.match(check.rx);
    if(!match) return null;
    const value = Number(match[1]);
    if(!Number.isFinite(value)) return null;
    const [status, note, badge] = check.read(value);
    return {name: check.name, value: String(value), unit: check.unit, status, note, badge};
  }).filter(Boolean);
}

function bookAppointment(){
  const doctor=document.getElementById('appt-doctor')?.value || 'Doctor';
  const urgency=document.getElementById('appt-urgency')?.value || 'Routine';
  const date=document.getElementById('appt-date')?.value || 'Next available';
  const time=document.getElementById('appt-time')?.value || 'TBD';
  const reason=document.getElementById('appt-reason')?.value.trim() || 'General consultation';
  const list=document.getElementById('appointment-list');
  if(!list) return;
  const item=document.createElement('div');
  item.className='timeline-item';
  item.innerHTML=`<div class="timeline-time">${escapeHtml(date)}</div><div><div class="timeline-title">${escapeHtml(doctor)}</div><div class="timeline-meta">${escapeHtml(reason)} - ${escapeHtml(time)}</div></div><span class="badge ${urgency==='Urgent'?'badge-danger':urgency==='Soon'?'badge-warn':'badge-blue'}">${escapeHtml(urgency)}</span>`;
  list.prepend(item);
  const appointments = getStored('appointments', []);
  appointments.unshift({doctor,urgency,date,time,reason,createdAt:new Date().toISOString()});
  setStored('appointments', appointments.slice(0,30));
  updateHistoryDashboard();
  renderNotifications();
  const reasonEl=document.getElementById('appt-reason');
  if(reasonEl) reasonEl.value='';
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[ch]));
}

function userStoragePrefix(){
  const u = getCurrentUser();
  return `medai_${u.username || u.email || 'guest'}_`;
}

function getStored(name, fallback){
  try{return JSON.parse(localStorage.getItem(userStoragePrefix()+name) || JSON.stringify(fallback))}
  catch(e){return fallback}
}

function setStored(name, value){
  localStorage.setItem(userStoragePrefix()+name, JSON.stringify(value));
}

function loadLocalFrontendData(){
  const trackers = getStored('trackers', null);
  if(trackers){
    const water=document.getElementById('water-count'), sleep=document.getElementById('sleep-count');
    if(water && trackers.water) water.textContent = trackers.water;
    if(sleep && trackers.sleep) sleep.textContent = trackers.sleep;
  }
  calorieTotal = Number(getStored('calorieTotal', calorieTotal)) || calorieTotal;
  const total=document.getElementById('calorie-total');
  if(total) total.textContent = calorieTotal;
  renderStoredReminders();
  renderStoredFoods();
  renderStoredAppointments();
  renderVitalsList();
  updateHistoryDashboard();
  renderSavedRating();
}

function renderStoredReminders(){
  const list=document.getElementById('medicine-list');
  if(!list) return;
  const reminders=getStored('reminders', []);
  if(!reminders.length) return;
  list.innerHTML = reminders.map(r=>`<div class="timeline-item"><div class="timeline-time">${escapeHtml(r.time||'Now')}</div><div><div class="timeline-title">${escapeHtml(r.name)}</div><div class="timeline-meta">${escapeHtml(r.dose||'Dose not set')} - ${escapeHtml(r.frequency||'Daily')}</div></div><span class="badge ${r.status==='Taken'?'badge-green':'badge-warn'}" onclick="markReminderTaken('${escapeHtml(r.createdAt)}')">${escapeHtml(r.status||'Due')}</span></div>`).join('');
}

function markReminderTaken(createdAt){
  const reminders=getStored('reminders', []);
  const next=reminders.map(r=>r.createdAt===createdAt?{...r,status:'Taken'}:r);
  setStored('reminders', next);
  renderStoredReminders();
  updateHistoryDashboard();
  renderNotifications();
}

function renderStoredFoods(){
  const list=document.getElementById('food-list');
  if(!list) return;
  const foods=getStored('foods', []);
  if(!foods.length) return;
  list.innerHTML = foods.map(f=>`<div class="timeline-item"><div class="timeline-time">${new Date(f.createdAt||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div><div><div class="timeline-title">${escapeHtml(f.food)}</div><div class="timeline-meta">${escapeHtml(f.cal)} kcal</div></div><span class="badge badge-blue">Meal</span></div>`).join('');
}

function renderStoredAppointments(){
  const list=document.getElementById('appointment-list');
  if(!list) return;
  const appointments=getStored('appointments', []);
  if(!appointments.length) return;
  list.innerHTML = appointments.map(a=>`<div class="timeline-item"><div class="timeline-time">${escapeHtml(a.date||'TBD')}</div><div><div class="timeline-title">${escapeHtml(a.doctor)}</div><div class="timeline-meta">${escapeHtml(a.reason||'Visit')} - ${escapeHtml(a.time||'TBD')}</div></div><span class="badge ${a.urgency==='Urgent'?'badge-danger':a.urgency==='Soon'?'badge-warn':'badge-blue'}">${escapeHtml(a.urgency||'Routine')}</span></div>`).join('');
}

function getGreeting(){
  const hour = new Date().getHours();
  if(hour < 12) return 'Good morning';
  if(hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getCurrentUser(){
  try{return JSON.parse(localStorage.getItem('medai_current_user') || '{}')}catch(e){return {}}
}

function setCurrentUser(user){
  localStorage.setItem('medai_current_user', JSON.stringify(user));
  const users = JSON.parse(localStorage.getItem('medai_users') || '[]');
  const idx = users.findIndex(u => (u.username && u.username === user.username) || (u.email && u.email === user.email));
  if(idx >= 0) users[idx] = {...users[idx], ...user};
  else users.push(user);
  localStorage.setItem('medai_users', JSON.stringify(users));
}

function getUserDisplayName(user){
  const full = `${user.firstname || ''} ${user.lastname || ''}`.trim();
  return full || user.username || user.email || 'MedAI User';
}

function calculateAge(dob){
  if(!dob) return '';
  const born = new Date(dob);
  if(Number.isNaN(born.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if(monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age--;
  return age > 0 && age < 130 ? `${age} years` : '';
}

function applyAvatarElement(el, user){
  if(!el) return;
  const initial = (user.firstname || user.username || user.email || 'U')[0].toUpperCase();
  if(user.profilePhoto){
    el.textContent = '';
    el.style.backgroundImage = `url("${String(user.profilePhoto).replace(/"/g,'%22')}")`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.classList.add('has-photo');
  }else{
    el.textContent = initial;
    el.style.backgroundImage = '';
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.classList.remove('has-photo');
  }
}

function renderProfileAvatar(user=getCurrentUser()){
  const u = user || {};
  applyAvatarElement(document.querySelector('.sb-avatar'), u);
  applyAvatarElement(document.getElementById('profile-avatar-preview'), u);

  const displayName = getUserDisplayName(u);
  const nameEl = document.getElementById('profile-display-name');
  if(nameEl) nameEl.textContent = displayName;

  const age = calculateAge(u.dob);
  const metaBits = [age, u.gender, u.phone ? `Phone: ${u.phone}` : '', u.email].filter(Boolean);
  const metaEl = document.getElementById('profile-display-meta');
  if(metaEl) metaEl.textContent = metaBits.length ? metaBits.join(' | ') : 'Complete your details so MedAI can personalize triage, reminders, emergency info, and daily score.';

  const chipPlan = document.getElementById('profile-chip-plan');
  const chipBlood = document.getElementById('profile-chip-blood');
  const chipCountry = document.getElementById('profile-chip-country');
  if(chipPlan) chipPlan.textContent = u.plan || 'Free';
  if(chipBlood) chipBlood.textContent = u.bloodGroup || 'Unknown';
  if(chipCountry) chipCountry.textContent = u.country || 'Not set';

  const scoreEl = document.getElementById('profile-health-score');
  const dailyScore = document.getElementById('daily-score')?.textContent;
  if(scoreEl) scoreEl.textContent = dailyScore ? `${dailyScore}/100` : '--';

  const bodyEl = document.getElementById('profile-height-weight');
  if(bodyEl) bodyEl.textContent = u.height && u.weight ? `${u.height}cm / ${u.weight}kg` : '--';

  const safetyEl = document.getElementById('profile-safety-count');
  const risks = (Array.isArray(u.conditions) ? u.conditions.length : 0) + (Array.isArray(u.allergies) ? u.allergies.length : 0) + (u.medications ? 1 : 0);
  if(safetyEl) safetyEl.textContent = risks ? `${risks} items` : 'Clear';
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

function resizeProfilePhoto(dataUrl){
  return new Promise(resolve=>{
    const img = new Image();
    img.onload = () => {
      const max = 520;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', .86));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function handleProfilePhoto(event){
  const file = event?.target?.files?.[0];
  const msg = document.getElementById('profile-save-msg');
  if(!file) return;
  if(!file.type || !file.type.startsWith('image/')){
    if(msg) msg.textContent = 'Please choose an image file for your profile photo.';
    return;
  }
  if(file.size > 5 * 1024 * 1024){
    if(msg) msg.textContent = 'Choose an image under 5 MB so it can be stored locally in this browser.';
    return;
  }
  try{
    if(msg) msg.textContent = 'Preparing profile photo...';
    const raw = await fileToDataUrl(file);
    const profilePhoto = await resizeProfilePhoto(raw);
    const updated = {...getCurrentUser(), profilePhoto};
    setCurrentUser(updated);
    renderProfileAvatar(updated);
    if(msg) msg.innerHTML = '<strong style="color:var(--safe)">Photo saved.</strong> Your profile picture is stored locally in this browser.';
  }catch(e){
    if(msg) msg.textContent = `Could not save photo: ${e.message || 'image read failed'}`;
  }finally{
    if(event?.target) event.target.value = '';
  }
}

function removeProfilePhoto(){
  const updated = {...getCurrentUser()};
  delete updated.profilePhoto;
  setCurrentUser(updated);
  renderProfileAvatar(updated);
  const msg = document.getElementById('profile-save-msg');
  if(msg) msg.textContent = 'Profile photo removed from local storage.';
}

function loadProfileForm(){
  const u = getCurrentUser();
  const map = {
    'profile-firstname': u.firstname,
    'profile-lastname': u.lastname,
    'profile-email': u.email,
    'profile-phone': u.phone,
    'profile-dob': u.dob,
    'profile-gender': u.gender,
    'profile-height': u.height,
    'profile-weight': u.weight,
    'profile-blood': u.bloodGroup,
    'profile-country': u.country,
    'profile-emerg-name': u.emergName,
    'profile-emerg-phone': u.emergPhone,
    'profile-conditions': Array.isArray(u.conditions) ? u.conditions.join(', ') : '',
    'profile-allergies': Array.isArray(u.allergies) ? u.allergies.join(', ') : '',
    'profile-medications': u.medications
  };
  Object.entries(map).forEach(([id,val])=>{const el=document.getElementById(id); if(el) el.value=val||'';});
  const checks = {'profile-smokes':u.smokes,'profile-alcohol':u.alcohol,'profile-exercises':u.exercises};
  Object.entries(checks).forEach(([id,val])=>{const el=document.getElementById(id); if(el) el.checked=!!val;});
  renderProfileAvatar(u);
}

function saveProfile(){
  const u = getCurrentUser();
  const updated = {
    ...u,
    firstname: document.getElementById('profile-firstname')?.value.trim() || u.firstname,
    lastname: document.getElementById('profile-lastname')?.value.trim() || u.lastname,
    email: document.getElementById('profile-email')?.value.trim() || u.email,
    phone: document.getElementById('profile-phone')?.value.trim() || '',
    dob: document.getElementById('profile-dob')?.value || '',
    gender: document.getElementById('profile-gender')?.value || '',
    height: document.getElementById('profile-height')?.value || '',
    weight: document.getElementById('profile-weight')?.value || '',
    bloodGroup: document.getElementById('profile-blood')?.value || '',
    country: document.getElementById('profile-country')?.value.trim() || '',
    emergName: document.getElementById('profile-emerg-name')?.value.trim() || '',
    emergPhone: document.getElementById('profile-emerg-phone')?.value.trim() || '',
    conditions: splitCsv(document.getElementById('profile-conditions')?.value),
    allergies: splitCsv(document.getElementById('profile-allergies')?.value),
    medications: document.getElementById('profile-medications')?.value.trim() || '',
    smokes: !!document.getElementById('profile-smokes')?.checked,
    alcohol: !!document.getElementById('profile-alcohol')?.checked,
    exercises: !!document.getElementById('profile-exercises')?.checked
  };
  setCurrentUser(updated);
  personalizeEmergencyContact(updated);
  refreshDailyScore();
  renderProfileAvatar(updated);
  syncTherapyCountryFromProfile(updated, true);
  const msg = document.getElementById('profile-save-msg');
  if(msg) msg.innerHTML = '<strong style="color:var(--safe)">Saved.</strong> Your health profile has been updated for this browser.';
}

function splitCsv(value){
  return (value || '').split(',').map(v=>v.trim()).filter(Boolean);
}

function triageKey(){
  const u=getCurrentUser();
  return `medai_triage_history_${u.username || u.email || 'guest'}`;
}

function getTriageHistory(){
  try{return JSON.parse(localStorage.getItem(triageKey()) || '[]')}catch(e){return []}
}

function saveTriageResult(entry){
  const history = getTriageHistory();
  history.unshift(entry);
  localStorage.setItem(triageKey(), JSON.stringify(history.slice(0,50)));
  renderTriageHistory();
}

function renderTriageHistory(){
  const list = document.getElementById('history-list');
  if(!list) return;
  const history = getTriageHistory();
  updateHistoryDashboard(history);
  if(!history.length){
    list.innerHTML = '<div class="mini-result" style="margin:1rem 1.25rem">No symptom history yet. Run Quick Triage and completed sessions will appear here.</div><div style="padding:0 1.25rem 1.25rem"><button class="btn btn-primary" onclick="showTab(\'triage\',null)">Start Quick Triage</button></div>';
    renderRecentTriage([]);
    return;
  }
  const rows = history.map(item => {
    const cfg = historyVisual(item.level);
    const date = new Date(item.createdAt || Date.now()).toLocaleString([], {month:'short', day:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
    return `<div class="history-row"><div class="history-triage-dot ${cfg.dot}"></div><div class="history-info"><div class="history-symptom">${escapeHtml(item.symptoms || item.title || 'Triage session')}</div><div class="history-meta">${date} - ${cfg.label.toUpperCase()} - ${item.confidence || 70}% confidence</div></div><span class="badge ${cfg.badge}">${cfg.short}</span></div>`;
  }).join('');
  list.innerHTML = rows;
  renderRecentTriage(history);
}

function renderRecentTriage(items){
  const card=document.getElementById('recent-triage-card');
  if(!card || !items) return;
  const header='<div style="padding:1.25rem;border-bottom:1px solid var(--border)"><div class="sec-label" style="margin-bottom:0">// Recent Triage</div></div>';
  if(!items.length){
    card.innerHTML = header + '<div class="mini-result" style="margin:1rem 1.25rem">No triage sessions yet. Your real Quick Triage results will appear here.</div><div style="padding:1rem 1.25rem"><div class="btn btn-outline" onclick="showTab(\'triage\',null)" style="width:100%;justify-content:center;font-size:10px">Start Triage -></div></div>';
    return;
  }
  const rows=items.slice(0,3).map(item=>{
    const cfg=historyVisual(item.level);
    const date=new Date(item.createdAt || Date.now()).toLocaleDateString();
    return `<div class="history-row"><div class="history-triage-dot ${cfg.dot}"></div><div class="history-info"><div class="history-symptom">${escapeHtml(item.symptoms || item.title || 'Triage session')}</div><div class="history-meta">${date} - ${cfg.label.toUpperCase()} - ${item.confidence || 70}% confidence</div></div><span class="badge ${cfg.badge}">${cfg.short}</span></div>`;
  }).join('');
  card.innerHTML=header+rows+`<div style="padding:1rem 1.25rem"><div class="btn btn-outline" onclick="showTab('history',null)" style="width:100%;justify-content:center;font-size:10px">View Full History -></div></div>`;
}

function updateHistoryDashboard(history=getTriageHistory()){
  const count = history.length;
  const now = Date.now();
  const weekCount = history.filter(h => now - new Date(h.createdAt || 0).getTime() <= 7*24*60*60*1000).length;
  const vitals = (()=>{try{return JSON.parse(localStorage.getItem(vitalsKey()) || '[]')}catch(e){return []}})();
  const reminders = getStored('reminders', []);
  const foods = getStored('foods', []);
  const appointments = getStored('appointments', []);
  const records = count + vitals.length + foods.length + reminders.length + appointments.length;
  const followups = appointments.length + history.filter(h => h.level === 'doctor_soon' || h.level === 'emergency').length;
  const dates = [...history, ...vitals, ...foods, ...reminders, ...appointments].map(item => new Date(item.createdAt || Date.now()).getTime()).filter(Boolean);
  const trendDays = dates.length ? Math.max(1, Math.ceil((Math.max(...dates) - Math.min(...dates)) / 86400000)) : 0;
  const setText = (id,value)=>{const el=document.getElementById(id); if(el) el.textContent=value;};
  setText('stat-triage-count', count);
  setText('stat-triage-change', count ? `${weekCount} this week` : 'No sessions yet');
  setText('history-records-count', records);
  setText('history-records-meta', `${vitals.length} vitals, ${count} triages`);
  setText('active-goals-count', ['trackers','reminders','foods'].reduce((total,key)=>total + (key === 'trackers' ? (getStored(key,null)?1:0) : getStored(key,[]).length ? 1 : 0), 0));
  setText('active-goals-meta', records ? 'Tracking from local activity' : 'Start tracking goals');
  setText('followups-count', followups);
  setText('followups-meta', followups ? 'Doctor/emergency items found' : 'No follow-ups yet');
  setText('trend-window', `${trendDays}d`);
  setText('trend-window-meta', trendDays ? 'Based on local records' : 'Needs real records');
}

function historyVisual(level){
  if(level === 'emergency') return {dot:'emergency', badge:'badge-danger', label:'Emergency', short:'Emergency'};
  if(level === 'doctor_soon') return {dot:'soon', badge:'badge-warn', label:'See Doctor', short:'Doctor'};
  return {dot:'home', badge:'badge-green', label:'Stay Home', short:'Home'};
}

function vitalsKey(){
  const u=getCurrentUser();
  return `medai_vitals_${u.username || u.email || 'guest'}`;
}

function saveVitalReading(reading){
  const vitals = JSON.parse(localStorage.getItem(vitalsKey()) || '[]');
  vitals.unshift(reading);
  localStorage.setItem(vitalsKey(), JSON.stringify(vitals.slice(0,100)));
  renderVitalsList();
  updateHistoryDashboard();
}

function setVitalText(ids, value, fallback='--'){
  ids.forEach(id=>{const el=document.getElementById(id); if(el) el.textContent=value || fallback;});
}

function updateVitalDisplays(reading){
  if(!reading){
    setVitalText(['stat-hr','v-hr','vt-hr'], '');
    setVitalText(['stat-spo2','v-spo2','vt-spo2'], '');
    setVitalText(['stat-temp','v-temp','vt-temp'], '');
    setVitalText(['vt-bp'], '');
    setVitalText(['vt-glucose'], '');
    const hrChange=document.getElementById('stat-hr-change');
    const spo2Change=document.getElementById('stat-spo2-change');
    const tempChange=document.getElementById('stat-temp-change');
    if(hrChange) hrChange.textContent='Log manually or scan';
    if(spo2Change) spo2Change.textContent='Log manually';
    if(tempChange) tempChange.textContent='Log manually';
    return;
  }
  setVitalText(['stat-hr','v-hr','vt-hr'], reading.heartRate);
  setVitalText(['stat-spo2','v-spo2','vt-spo2'], reading.spo2);
  setVitalText(['stat-temp','v-temp','vt-temp'], reading.temp);
  setVitalText(['vt-bp'], reading.bp);
  setVitalText(['vt-glucose'], reading.glucose);
  const label = `Latest ${new Date(reading.createdAt || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  const hrChange=document.getElementById('stat-hr-change');
  const spo2Change=document.getElementById('stat-spo2-change');
  const tempChange=document.getElementById('stat-temp-change');
  if(hrChange) hrChange.textContent=reading.heartRate ? label : 'Not logged yet';
  if(spo2Change) spo2Change.textContent=reading.spo2 ? label : 'Not logged yet';
  if(tempChange) tempChange.textContent=reading.temp ? label : 'Not logged yet';
}

function logManualVitals(){
  const reading = {
    heartRate: document.getElementById('manual-hr')?.value || '',
    spo2: document.getElementById('manual-spo2')?.value || '',
    temp: document.getElementById('manual-temp')?.value || '',
    bp: document.getElementById('manual-bp')?.value || '',
    glucose: document.getElementById('manual-glucose')?.value || '',
    weight: document.getElementById('manual-weight')?.value || '',
    source:'manual',
    createdAt:new Date().toISOString()
  };
  if(!reading.heartRate && !reading.spo2 && !reading.temp && !reading.bp && !reading.glucose && !reading.weight) return;
  saveVitalReading(reading);
  const msg=document.getElementById('manual-vitals-msg');
  if(msg) msg.innerHTML='<strong style="color:var(--safe)">Saved.</strong> Manual vitals were added to local history.';
  ['manual-hr','manual-spo2','manual-temp','manual-bp','manual-glucose','manual-weight'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
}

function renderVitalsList(){
  const msg=document.getElementById('manual-vitals-msg');
  const vitals = JSON.parse(localStorage.getItem(vitalsKey()) || '[]');
  updateVitalDisplays(vitals[0]);
  if(msg && vitals.length){
    const latest=vitals[0];
    msg.innerHTML = `Latest saved: ${new Date(latest.createdAt).toLocaleString()} - HR ${latest.heartRate||'-'} BPM, SpO2 ${latest.spo2||'-'}%, Temp ${latest.temp||'-'}C, BP ${latest.bp||'-'}.`;
  }else if(msg){
    msg.textContent = 'No real vitals saved yet. Use manual logging or the camera scanner.';
  }
}

function personalizeEmergencyContact(user){
  if(!user || !user.emergName || !user.emergPhone) return;
  const cards = document.querySelectorAll('#tab-dashboard .glass-card');
  const emergencyCard = Array.from(cards).find(card => card.textContent.includes('Emergency Contacts'));
  if(!emergencyCard) return;
  const rows = emergencyCard.querySelectorAll('div[style*="align-items:center"]');
  const row = rows[1];
  if(!row) return;
  const labels = row.querySelectorAll('div div');
  if(labels[0]) labels[0].textContent = user.emergName;
  if(labels[1]) labels[1].textContent = 'Saved emergency contact';
  const link = row.querySelector('a[href^="tel:"]');
  if(link) link.href = `tel:${user.emergPhone}`;
}

function exportHealthData(){
  const u = getCurrentUser();
  const payload = {
    exportedAt: new Date().toISOString(),
    profile: u,
    triageHistory: getTriageHistory(),
    vitals: JSON.parse(localStorage.getItem(vitalsKey()) || '[]'),
    chats: JSON.parse(localStorage.getItem(chatStorageKey()) || '{}')
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medai-health-data-${u.username || 'user'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearLocalHistory(){
  if(!confirm('Clear saved triage history for this user?')) return;
  localStorage.removeItem(triageKey());
  renderTriageHistory();
  renderNotifications();
}

function showSettingsPanel(id){
  document.querySelectorAll('.settings-panel').forEach(p=>p.classList.remove('open'));
  const panel=document.getElementById(id);
  if(panel){
    panel.classList.add('open');
    panel.scrollIntoView({behavior:'smooth',block:'center'});
  }
}

function saveOpenRouterSettings(){
  const key=document.getElementById('openrouter-key')?.value.trim();
  const model=document.getElementById('openrouter-model')?.value.trim() || DEFAULT_OPENROUTER_MODEL;
  if(key) localStorage.setItem('medai_openrouter_key', key);
  localStorage.setItem('medai_openrouter_model', model);
  const status=document.getElementById('openrouter-status');
  if(status) status.innerHTML=`<strong style="color:var(--safe)">Saved.</strong> Support AIs now use ${escapeHtml(model)} via OpenRouter.`;
}

function clearOpenRouterSettings(){
  localStorage.removeItem('medai_openrouter_key');
  const key=document.getElementById('openrouter-key');
  if(key) key.value='';
  const status=document.getElementById('openrouter-status');
  if(status) status.textContent='OpenRouter key removed from this browser.';
}

async function testOpenRouter(){
  saveOpenRouterSettings();
  const status=document.getElementById('openrouter-status');
  if(status) status.textContent='Testing OpenRouter...';
  try{
    const reply=await callOpenRouter('You are a connection test. Reply with one short sentence.', 'Say OpenRouter is connected for MedAI.');
    if(status) status.innerHTML=`<strong style="color:var(--safe)">Connected.</strong> ${escapeHtml(reply || 'OpenRouter responded.')}`;
  }catch(e){
    if(status) status.innerHTML=`<strong style="color:var(--danger)">Failed.</strong> ${escapeHtml(e.message || 'Check your key/model.')}`;
  }
}

function saveGeminiSettings(){
  const key = document.getElementById('gemini-key-input')?.value.trim();
  const status = document.getElementById('gemini-status');
  if(key) {
    localStorage.setItem('medai_gemini_key', key);
    if(status) status.innerHTML = `<strong style="color:var(--safe)">Saved.</strong> Using your custom Gemini API Key.`;
  } else {
    clearGeminiSettings();
  }
}

function clearGeminiSettings(){
  localStorage.removeItem('medai_gemini_key');
  const input = document.getElementById('gemini-key-input');
  if(input) input.value = '';
  const status = document.getElementById('gemini-status');
  if(status) status.textContent = 'Using default system key.';
}

async function testGeminiConnection(){
  saveGeminiSettings();
  const status = document.getElementById('gemini-status');
  if(status) status.textContent = 'Testing Gemini API connection...';
  try {
    const reply = await callGemini('Say Gemini connection test active for MedAI. Reply in one short sentence.');
    if(status) status.innerHTML = `<strong style="color:var(--safe)">Connected.</strong> ${escapeHtml(reply)}`;
  } catch(e) {
    let msg = e.message === 'quota_exceeded' ? 'Quota exceeded.' : e.message === 'no_key' ? 'API Key not configured.' : e.message;
    if(status) status.innerHTML = `<strong style="color:var(--danger)">Failed.</strong> ${escapeHtml(msg || 'Check your API Key.')}`;
  }
}

function loadSettingsControls(){
  const settings=getOpenRouterSettings();
  const key=document.getElementById('openrouter-key');
  const model=document.getElementById('openrouter-model');
  const status=document.getElementById('openrouter-status');
  if(key) key.value=settings.key;
  if(model) model.value=settings.model;
  if(status) status.textContent=settings.key ? `OpenRouter key saved. Current model: ${settings.model}` : 'No OpenRouter key saved yet.';
  
  const geminiKey = localStorage.getItem('medai_gemini_key') || '';
  const geminiInput = document.getElementById('gemini-key-input');
  const geminiStatus = document.getElementById('gemini-status');
  if(geminiInput) geminiInput.value = geminiKey;
  if(geminiStatus) geminiStatus.textContent = geminiKey ? 'Custom API key saved.' : 'Using default system key.';

  setToggleFromFlag('twofa_enabled','twofa-toggle');
  setToggleFromFlag('notifications_enabled','settings-notif-toggle',true);
  setToggleFromFlag('medicine_notifications','medicine-notif-toggle',true);
  setToggleFromFlag('appointment_notifications','appointment-notif-toggle',true);
  setToggleFromFlag('system_notifications','system-notif-toggle',true);
  const lang=localStorage.getItem('medai_language') || 'English (US)';
  const select=document.getElementById('language-select');
  const desc=document.getElementById('language-desc');
  if(select) select.value=lang;
  if(desc) desc.textContent=lang;
  const u=getCurrentUser();
  const en=document.getElementById('settings-emerg-name'), ep=document.getElementById('settings-emerg-phone');
  if(en) en.value=u.emergName||'';
  if(ep) ep.value=u.emergPhone||'';
}

function setToggleFromFlag(flag,id,defaultOn=false){
  const el=document.getElementById(id);
  if(!el) return;
  const raw=localStorage.getItem(flag);
  const on=raw===null ? defaultOn : raw==='true';
  el.classList.toggle('on', on);
}

function toggleTheme(el){
  const isDark = el.classList.toggle('on');
  const theme = isDark ? 'dark' : 'light';
  applyTheme(theme);
  localStorage.setItem('medai_theme', theme);
}

function applyTheme(theme){
  if(theme === 'light'){
    document.documentElement.setAttribute('data-theme','light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const desc = document.getElementById('theme-desc');
  if(desc) desc.textContent = theme === 'light' ? 'Off' : 'On';
}

(function initTheme(){
  const saved = localStorage.getItem('medai_theme') || 'dark';
  applyTheme(saved);
  const toggle = document.getElementById('theme-toggle');
  if(toggle){
    if(saved === 'light') toggle.classList.remove('on');
    else toggle.classList.add('on');
  }
})();

function toggleSettingFlag(flag,el){
  el.classList.toggle('on');
  localStorage.setItem(flag, el.classList.contains('on'));
  renderNotifications();
}

function changeLocalPassword(){
  const current=document.getElementById('current-password')?.value || '';
  const next=document.getElementById('new-password')?.value || '';
  const status=document.getElementById('password-status');
  const u=getCurrentUser();
  if(!u.username){
    if(status) status.textContent='No logged-in user found.';
    return;
  }
  if(current !== (u.password || '')){
    if(status) status.innerHTML='<strong style="color:var(--danger)">Wrong current password.</strong>';
    return;
  }
  if(next.length < 8){
    if(status) status.innerHTML='<strong style="color:var(--warning)">New password must be at least 8 characters.</strong>';
    return;
  }
  u.password=next;
  u.passwordChangedAt=new Date().toISOString();
  setCurrentUser(u);
  if(status) status.innerHTML='<strong style="color:var(--safe)">Password updated.</strong>';
  ['current-password','new-password'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
}

function saveEmergencySettings(){
  const u=getCurrentUser();
  u.emergName=document.getElementById('settings-emerg-name')?.value.trim() || '';
  u.emergPhone=document.getElementById('settings-emerg-phone')?.value.trim() || '';
  setCurrentUser(u);
  loadProfileForm();
  personalizeEmergencyContact(u);
  const status=document.getElementById('emergency-status');
  if(status) status.innerHTML='<strong style="color:var(--safe)">Saved.</strong> Dashboard quick-dial updated.';
}

// ============================================================
// I18N — LANGUAGE SYSTEM
// ============================================================
const PIDGIN = {
  'Overview':'Home Base','AI Support':'AI Helep','Quick Triage':'Check Yourself',
  'My Health':'My Body','Reports':'Reports','Care Access':'Get Care',
  'Mental Wellness':'Mind Wellness','Account':'My Account','Upgrade':'Go Premium',
  '// Overview':'// Home Base','// AI Support':'// AI Helep',
  '// Quick Triage':'// Check Yourself','// My Health':'// My Body',
  '// Care Access':'// Get Care','// Mental Wellness':'// Mind Wellness',
  '// Account':'// My Account','// Daily Health Tip':'// Tip For Today',
  '// Health Identity':'// Your Body Info','// BMI Calculator':'// BMI Calculator',
  '// Quick Actions':'// Do Am Quick','// Live Vitals':'// Body Readings',
  '// Manual Vitals Log':'// Add Body Reading','// Food & Calories':'// Food & Calorie',
  '// Water & Sleep':'// Water & Sleep','// Medicine Reminder':'// Medicine Reminder',
  '// Health Score':'// Health Score','// Daily Health Score':'// Today Score',
  '// Weekly Summary':'// Week Summary','// Stress Check':'// Stress Check',
  '// Recent Triage':'// Last Check','// Book Visit':'// Book Doctor',
  '// Referral Letter':'// Referral Letter','// Emergency Contacts':'// Emergency Contacts',
  '// Camera Heart Rate':'// Camera Heart Rate','// Live ECG':'// Live ECG',
  '// AI Explanation':'// AI Explanation','// OCR Intake':'// Scan Medicine',
  '// Health History Dashboard':'// Health History','// Upcoming':'// Coming Up',
  '// Preview':'// Preview','// Language':'// Language','// Rate MedAI':'// Rate MedAI',
  'Language':'Language','Notifications':'Notification','Dark Mode':'Dark Mode',
  'Change Password':'Change Password','Two-Factor Auth':'2-Factor Auth',
  'Emergency Contacts':'Emergency Contacts','FAQs':'FAQs','Rate the App':'Rate the App',
  'Data & Privacy':'Data & Privacy','Export Health Data':'Export Health Data',
  'Gemini API':'Gemini API','OpenRouter API':'OpenRouter API','Clear History':'Clear History',
  'Save Language':'Save Language','Save Profile':'Save Profile','Save Vitals':'Save Vitals',
  'Save Contact':'Save Contact','Save Gemini Key':'Save Gemini Key',
  'Save OpenRouter':'Save OpenRouter','Update Password':'Update Password',
  'Generate Referral':'Generate Referral','Start Calm Sound':'Start Calm Sound',
  'Reset Checklist':'Reset Checklist','Test Connection':'Test Connection',
  'Clear User Data':'Clear User Data','Clear':'Clear','Cancel':'Cancel',
  'Edit':'Edit','Remove':'Remove','Copy':'Copy','Search':'Search',
  'Show Tour':'Show Tour','SOS \u2014 Panic Mode':'SOS \u2014 Emergency',
  '\uD83D\uDC9A I\'m Feeling Better':'\uD83D\uDC9A I Don Better',
  '\uD83D\uDDD1\uFE0F Delete Forever':'\uD83D\uDDD1\uFE0F Delete Am',
  'How are you feeling today?':'How your body dey today?',
  'Health Score':'Health Score','Log Food':'Add Food','Log Water':'Add Water',
  'Log Sleep':'Add Sleep','Add Vitals':'Add Body Reading',
  'Book Appointment':'Book Doctor','Panic Mode':'Emergency Mode',
  'Breathe with me':'Breathe with me','Inhale':'Breathe In',
  'Hold':'Hold Am','Exhale':'Breathe Out',
  'Grounding Checklist':'Grounding Checklist','Emergency Helplines':'Emergency Numbers',
};

function applyPidgin(){
  const targets = document.querySelectorAll(
    '.nav-label,.sec-label,.settings-label,.tab-label,.settings-panel-title,button,.card-title'
  );
  targets.forEach(el => {
    if(el.children.length === 0){
      const t = el.textContent.trim();
      if(PIDGIN[t]) el.textContent = PIDGIN[t];
    } else {
      el.childNodes.forEach(node => {
        if(node.nodeType === 3){
          const t = node.textContent.trim();
          if(PIDGIN[t]) node.textContent = node.textContent.replace(t, PIDGIN[t]);
        }
      });
    }
  });
  document.documentElement.lang = 'pcm';
}

function applyGoogleTranslate(langCode){
  if(!document.getElementById('gt-script')){
    const div = document.createElement('div');
    div.id = 'google_translate_element';
    div.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:-1;opacity:0;pointer-events:none';
    document.body.appendChild(div);
    window.googleTranslateElementInit = function(){
      new google.translate.TranslateElement(
        {pageLanguage:'en', autoDisplay:false},
        'google_translate_element'
      );
    };
    const s = document.createElement('script');
    s.id = 'gt-script';
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(s);
  }
  function triggerLang(){
    const sel = document.querySelector('.goog-te-combo');
    if(sel){ sel.value = langCode; sel.dispatchEvent(new Event('change')); }
    else { setTimeout(triggerLang, 300); }
  }
  setTimeout(triggerLang, 900);
}

function removePreviousLangStyles(){
  const e = document.getElementById('medai-lang-style');
  if(e) e.remove();
}

function saveLanguage(){
  const lang = document.getElementById('language-select')?.value || 'English (US)';
  localStorage.setItem('medai_language', lang);
  const desc = document.getElementById('language-desc');
  if(desc) desc.textContent = lang;
  applyLanguage(lang);
}

function applyLanguage(lang){
  removePreviousLangStyles();
  if(lang === 'Pidgin English'){
    const c = document.querySelector('.goog-te-combo');
    if(c){ c.value='en'; c.dispatchEvent(new Event('change')); }
    applyPidgin();
  } else if(lang === 'Français'){
    applyGoogleTranslate('fr');
  } else if(lang === 'العربية'){
    applyGoogleTranslate('ar');
    const s = document.createElement('style');
    s.id = 'medai-lang-style';
    s.textContent = 'body{direction:rtl;text-align:right}.sidebar{right:0;left:auto}.main-content{margin-right:240px;margin-left:0}';
    document.head.appendChild(s);
  } else {
    const c = document.querySelector('.goog-te-combo');
    if(c){ c.value='en'; c.dispatchEvent(new Event('change')); }
    document.documentElement.lang = 'en';
  }
}

(function initLanguage(){
  const saved = localStorage.getItem('medai_language');
  if(saved && saved !== 'English (US)'){
    const sel = document.getElementById('language-select');
    if(sel) sel.value = saved;
    const desc = document.getElementById('language-desc');
    if(desc) desc.textContent = saved;
    setTimeout(() => applyLanguage(saved), 600);
  }
})();

function clearChatHistory(){
  if(!confirm('Clear saved chat history for this user?')) return;
  localStorage.removeItem(chatStorageKey());
  Object.keys(chatHistories).forEach(k=>chatHistories[k]=[]);
  ['chatbot','emotional-ai','mental-ai','physical-ai'].forEach(panelId=>{
    const el=document.getElementById('chat-'+panelId);
    if(el) el.innerHTML='<div class="chat-bubble ai"><div class="ai-label">MEDAI</div>Chat history cleared. Start a new conversation.</div>';
  });
}

function clearVitalsHistory(){
  if(!confirm('Clear saved vitals for this user?')) return;
  localStorage.removeItem(vitalsKey());
  renderVitalsList();
}

function clearAllLocalUserData(){
  if(!confirm('Clear all local data for this user except login account?')) return;
  ['reminders','foods','appointments','trackers','calorieTotal'].forEach(name=>localStorage.removeItem(userStoragePrefix()+name));
  localStorage.removeItem(triageKey());
  localStorage.removeItem(vitalsKey());
  localStorage.removeItem(chatStorageKey());
  loadLocalFrontendData();
  renderTriageHistory();
  renderNotifications();
}

function renderNotifications(){
  const list=document.getElementById('notif-list');
  const dot=document.getElementById('notif-dot');
  if(!list) return;
  if(localStorage.getItem('notifications_enabled') === 'false'){
    list.innerHTML='<div class="notif-item">Notifications are turned off.<div class="notif-time">Settings</div></div>';
    if(dot) dot.style.display='none';
    return;
  }
  const reminders=localStorage.getItem('medicine_notifications') === 'false' ? [] : getStored('reminders', []).filter(r=>r.status!=='Taken').slice(0,3);
  const appointments=localStorage.getItem('appointment_notifications') === 'false' ? [] : getStored('appointments', []).slice(0,2);
  const system=localStorage.getItem('system_notifications') === 'false' ? [] : [
    {text:'Your health data is saved locally until backend sync is added.',time:'System'},
    {text:'Tip: complete your profile to improve health score personalization.',time:'Profile'}
  ];
  const items=[
    ...reminders.map(r=>({text:`Medicine reminder due: ${r.name} at ${r.time || 'now'}`,time:'Reminder'})),
    ...appointments.map(a=>({text:`Appointment booked: ${a.doctor} on ${a.date || 'next available'}`,time:'Appointment'})),
    ...system
  ];
  list.innerHTML = items.map(i=>`<div class="notif-item">${escapeHtml(i.text)}<div class="notif-time">${escapeHtml(i.time)}</div></div>`).join('');
  if(dot) dot.style.display = items.length ? 'block' : 'none';
}

function toggleNotifications(){
  const panel=document.getElementById('notif-panel');
  if(panel) panel.classList.toggle('open');
}

function searchHealthData(query){
  const pop=document.getElementById('search-results');
  if(!pop) return;
  const q=(query||'').trim().toLowerCase();
  if(!q){pop.classList.remove('open');pop.innerHTML='';return}
  const results=[
    ...getTriageHistory().map(h=>({type:'Triage',title:h.symptoms||h.title,meta:`${h.level} - ${h.confidence||70}%`,tab:'history'})),
    ...getStored('appointments',[]).map(a=>({type:'Appointment',title:a.doctor,meta:`${a.date||'TBD'} ${a.reason||''}`,tab:'appointments'})),
    ...getStored('reminders',[]).map(r=>({type:'Reminder',title:r.name,meta:`${r.time||''} ${r.dose||''}`,tab:'tools'})),
    ...getStored('foods',[]).map(f=>({type:'Food',title:f.food,meta:`${f.cal} kcal`,tab:'tools'}))
  ].filter(r=>JSON.stringify(r).toLowerCase().includes(q)).slice(0,8);
  pop.innerHTML = results.length ? results.map(r=>`<div class="search-row" onclick="showTab('${r.tab}',null);document.getElementById('search-results').classList.remove('open')"><div class="search-title">${escapeHtml(r.title||r.type)}</div><div class="search-meta">${escapeHtml(r.type)} - ${escapeHtml(r.meta||'')}</div></div>`).join('') : '<div class="search-row"><div class="search-title">No local results found</div><div class="search-meta">Try a symptom, medicine, food, or doctor name</div></div>';
  pop.classList.add('open');
}

function renderDailyTip(){
  const tips=[
    'Drink water early today. Small sips through the day beat one large catch-up at night.',
    'Aim for 7-9 hours of sleep and keep your last screen-heavy activity away from bedtime.',
    'A 10-minute walk after a meal can support digestion and blood sugar control.',
    'If you take medicine daily, pair it with a fixed habit like brushing your teeth.',
    'Log symptoms when they start. Timing helps triage become more useful.'
  ];
  const el=document.getElementById('daily-tip');
  if(el) el.textContent=tips[new Date().getDate()%tips.length];
}

const tourSteps=[
  ['Start with triage','Use Quick Triage when symptoms appear. Results now save into your Symptom History automatically.'],
  ['Complete your profile','My Profile controls the data used for personalization, emergency contacts, and health score.'],
  ['Use health tools','Camera heart rate, reminders, water, sleep, calories, BMI, and stress checks all work locally.'],
  ['Export your data','Settings can export your local health profile, triage history, vitals, and tracker data.']
];
let tourIndex=0;
function maybeShowOnboarding(){
  if(localStorage.getItem('medai_seen_tour')) return;
  setTimeout(startOnboardingTour,600);
}
function startOnboardingTour(){
  tourIndex=0;
  renderTour();
}
function renderTour(){
  let overlay=document.getElementById('tour-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='tour-overlay';
    overlay.className='tour-overlay';
    overlay.innerHTML='<div class="tour-card"><div class="tour-step" id="tour-step"></div><h3 id="tour-title"></h3><p id="tour-copy"></p><div style="display:flex;gap:.75rem;justify-content:flex-end;margin-top:1rem"><button class="btn btn-outline" onclick="endTour()">Skip</button><button class="btn btn-primary" onclick="nextTour()">Next</button></div></div>';
    document.body.appendChild(overlay);
  }
  const step=tourSteps[tourIndex];
  document.getElementById('tour-step').textContent=`Step ${tourIndex+1} of ${tourSteps.length}`;
  document.getElementById('tour-title').textContent=step[0];
  document.getElementById('tour-copy').textContent=step[1];
  overlay.classList.add('open');
}
function nextTour(){
  tourIndex++;
  if(tourIndex>=tourSteps.length){endTour();return}
  renderTour();
}
function endTour(){
  localStorage.setItem('medai_seen_tour','1');
  const overlay=document.getElementById('tour-overlay');
  if(overlay) overlay.classList.remove('open');
}

// ============================================================
// PREMIUM PRICING — Currency & Billing Toggle
// ============================================================
const prices = {
  NG: { symbol:'₦',  name:'NGN',  monthly:3500,   yearly:29400  },
  US: { symbol:'$',  name:'USD',  monthly:4.99,   yearly:41.90  },
  GB: { symbol:'£',  name:'GBP',  monthly:3.99,   yearly:33.50  },
  EU: { symbol:'€',  name:'EUR',  monthly:4.49,   yearly:37.70  },
  GH: { symbol:'₵',  name:'GHS',  monthly:65,     yearly:546    },
  KE: { symbol:'KSh',name:'KES',  monthly:649,    yearly:5452   },
  ZA: { symbol:'R',  name:'ZAR',  monthly:89,     yearly:748    },
  CA: { symbol:'CA$',name:'CAD',  monthly:6.99,   yearly:58.70  },
  AU: { symbol:'A$', name:'AUD',  monthly:7.49,   yearly:62.90  },
  IN: { symbol:'₹',  name:'INR',  monthly:399,    yearly:3350   },
  BR: { symbol:'R$', name:'BRL',  monthly:24.90,  yearly:209    },
  AE: { symbol:'د.إ',name:'AED',  monthly:18.99,  yearly:159    },
};

let currentBilling  = 'monthly';
let currentCountry  = 'NG';

function setBilling(type) {
  currentBilling = type === 'yearly' ? 'yearly' : 'monthly';
  localStorage.setItem('medai_billing', currentBilling);
  const mBtn = document.getElementById('toggle-monthly');
  const yBtn = document.getElementById('toggle-yearly');
  const saveBadge   = document.getElementById('save-badge');
  const yearlyCallout = document.getElementById('yearly-callout');

  if (currentBilling === 'monthly') {
    if(mBtn){mBtn.style.background = 'rgba(0,212,255,0.15)'; mBtn.style.color = 'var(--accent)';}
    if(yBtn){yBtn.style.background = 'transparent';          yBtn.style.color = 'var(--muted)';}
    if(saveBadge) saveBadge.style.display = 'none';
    if (yearlyCallout) yearlyCallout.style.display = 'none';
  } else {
    if(yBtn){yBtn.style.background = 'rgba(0,212,255,0.15)'; yBtn.style.color = 'var(--accent)';}
    if(mBtn){mBtn.style.background = 'transparent';          mBtn.style.color = 'var(--muted)';}
    if(saveBadge) saveBadge.style.display = 'block';
    if (yearlyCallout) yearlyCallout.style.display = 'flex';
  }
  renderPrices();
}

function updatePricing() {
  const select = document.getElementById('country-select');
  const selected = select?.value || currentCountry || 'NG';
  currentCountry = prices[selected] ? selected : 'NG';
  localStorage.setItem('medai_country', currentCountry);
  renderPrices();
}

function formatPriceNumber(n) {
  if (Number.isInteger(n) || n >= 100) return Math.round(n).toLocaleString();
  return parseFloat(n).toFixed(2);
}

function renderPrices() {
  const select = document.getElementById('country-select');
  if(select && prices[select.value]) currentCountry = select.value;
  if(!prices[currentCountry]) currentCountry = 'NG';
  const p = prices[currentCountry] || prices.NG;
  const isYearly = currentBilling === 'yearly';

  const premiumMonthlyEq = isYearly ? (p.yearly / 12).toFixed(2) : p.monthly;
  const premiumDisplay   = isYearly ? p.yearly : p.monthly;

  const freeEl = document.getElementById('free-price');
  const freePeriodEl = document.getElementById('free-period');
  const premiumEl = document.getElementById('premium-price');
  const periodEl  = document.getElementById('premium-period');
  const subEl     = document.getElementById('premium-subtext');
  const noteEl    = document.getElementById('yearly-saving-note');
  const saveText  = document.getElementById('yearly-savings-text');

  if (freeEl) freeEl.textContent = p.symbol + '0';
  if (freePeriodEl) freePeriodEl.textContent = isYearly ? '/year' : '/month';
  if (premiumEl) premiumEl.textContent = p.symbol + formatPriceNumber(premiumDisplay);

  if (periodEl) {
    periodEl.textContent = isYearly ? '/year' : '/month';
  }

  if (subEl) {
    subEl.textContent = isYearly
      ? `Billed yearly (${p.symbol}${formatPriceNumber(premiumMonthlyEq)}/mo). Cancel anytime.`
      : 'Billed monthly. Cancel anytime.';
  }

  if (noteEl) {
    noteEl.textContent = isYearly
      ? `Equivalent to ${p.symbol}${formatPriceNumber(premiumMonthlyEq)}/month`
      : '';
  }

  if (saveText) {
    const yearlySaving = (p.monthly * 12) - p.yearly;
    saveText.textContent = `You save ${p.symbol}${formatPriceNumber(yearlySaving)} per year compared to monthly billing.`;
  }
}

function upgradePremium() {
  const u = getCurrentUser();
  if(!u || !u.username){
    alert('No logged-in user detected. Please sign in and try again.');
    return;
  }
  const isYearly = currentBilling === 'yearly';
  const price = isYearly ? prices[currentCountry].yearly : prices[currentCountry].monthly;
  const period = isYearly ? 'year' : 'month';

  if(u.plan === 'Premium'){
    alert('You already have Premium. Enjoy the benefits!');
    return;
  }

  u.plan = 'Premium';
  u.premiumActivatedAt = new Date().toISOString();
  setCurrentUser(u);
  updatePremiumDisplay(u);

  alert(`Premium upgraded successfully!\n\nPlan: ${isYearly ? 'Yearly' : 'Monthly'}\nPrice: ${prices[currentCountry].symbol}${formatPriceNumber(price)} / ${period}\n\nYour account is now on the Premium plan.`);
}

function updatePremiumDisplay(user){
  const u = user || getCurrentUser();
  const sbPlan = document.querySelector('.sb-user-plan');
  const planChip = document.getElementById('profile-chip-plan');
  if(sbPlan) sbPlan.textContent = (u.plan || 'Free') + ' Plan';
  if(planChip) planChip.textContent = u.plan || 'Free';
}

function initPricing(){
  const select = document.getElementById('country-select');
  const savedCountry = localStorage.getItem('medai_country');
  if(savedCountry && prices[savedCountry]){
    currentCountry = savedCountry;
    if(select) select.value = savedCountry;
  }else if(select && prices[select.value]){
    currentCountry = select.value;
  }
  const savedBilling = localStorage.getItem('medai_billing');
  setBilling(savedBilling === 'yearly' ? 'yearly' : 'monthly');
  renderPrices();
  if(select && !select._pricingListenerAttached){
    select.addEventListener('change', updatePricing);
    select._pricingListenerAttached = true;
  }
}

// ============================================================
// THERAPY FINDER + REFERRAL LETTER
// ============================================================
const therapyDirectory = {
  NG: [
    {name:'Mentally Aware Nigeria Initiative', city:'Lagos / Abuja', address:'Community and virtual support across Nigeria', phone:'+234 806 000 6464', rating:4.8, specialties:['anxiety','depression','youth','crisis'], notes:'Mental health advocacy, referrals, support groups, and crisis education.'},
    {name:'Lagos Mind Clinic', city:'Lekki, Lagos', address:'Admiralty Way, Lekki Phase 1, Lagos', phone:'+234 908 000 1122', rating:4.7, specialties:['cbt','anxiety','depression','trauma'], notes:'Private therapy sessions, CBT planning, stress and burnout support.'},
    {name:'The Olive Prime Psychological Services', city:'Abuja', address:'Wuse 2, Abuja', phone:'+234 809 000 7788', rating:4.6, specialties:['family','trauma','depression','cbt'], notes:'Psychological assessment, psychotherapy, couples and family support.'}
  ],
  US: [
    {name:'National Alliance on Mental Illness', city:'United States', address:'Local chapters and virtual support', phone:'+1 800 950 6264', rating:4.9, specialties:['depression','family','anxiety','youth'], notes:'Education, peer support, family resources, and local chapter referrals.'},
    {name:'Open Path Collective', city:'United States', address:'Online therapist network', phone:'+1 800 268 2833', rating:4.7, specialties:['cbt','anxiety','depression','trauma'], notes:'Affordable therapist directory with in-person and telehealth options.'},
    {name:'Crisis Text Line', city:'United States', address:'Text HOME to 741741', phone:'741741', rating:4.8, specialties:['crisis','youth','anxiety'], notes:'Free crisis text support for acute distress.'}
  ],
  GB: [
    {name:'Mind UK', city:'United Kingdom', address:'Local Mind branches and online resources', phone:'+44 300 123 3393', rating:4.8, specialties:['anxiety','depression','family','crisis'], notes:'Mental health information, advocacy, local services, and support lines.'},
    {name:'BACP Therapist Directory', city:'United Kingdom', address:'UK-wide counsellor directory', phone:'+44 1455 883300', rating:4.7, specialties:['cbt','trauma','family','depression'], notes:'Find registered counsellors and psychotherapists by location and specialty.'},
    {name:'Samaritans', city:'United Kingdom', address:'24/7 listening service', phone:'116123', rating:4.9, specialties:['crisis','depression','anxiety'], notes:'Confidential emotional support for anyone in distress.'}
  ],
  ZA: [
    {name:'South African Depression and Anxiety Group', city:'South Africa', address:'National helplines and referral network', phone:'+27 800 567 567', rating:4.8, specialties:['anxiety','depression','crisis','trauma'], notes:'Helplines, therapist referrals, support groups, and mental health education.'},
    {name:'Lifeline South Africa', city:'South Africa', address:'Community counselling network', phone:'+27 861 322 322', rating:4.6, specialties:['family','trauma','crisis','youth'], notes:'Counselling, crisis support, and community-based referrals.'},
    {name:'Cape Town Therapy Hub', city:'Cape Town', address:'Claremont, Cape Town', phone:'+27 21 000 3344', rating:4.5, specialties:['cbt','anxiety','depression','family'], notes:'Private counselling, CBT, relationship support, and stress recovery.'}
  ]
};

function normalizeCountryCode(value){
  const v = String(value || '').trim().toLowerCase();
  if(['ng','nigeria'].includes(v)) return 'NG';
  if(['us','usa','united states','united states of america','america'].includes(v)) return 'US';
  if(['gb','uk','united kingdom','england','britain'].includes(v)) return 'GB';
  if(['za','south africa'].includes(v)) return 'ZA';
  return therapyDirectory[v.toUpperCase()] ? v.toUpperCase() : 'NG';
}

function syncTherapyCountryFromProfile(user=getCurrentUser(), force=false){
  const select = document.getElementById('therapy-country');
  if(!select) return;
  const saved = localStorage.getItem('medai_therapy_country');
  const code = force ? normalizeCountryCode(user.country || saved) : normalizeCountryCode(saved || user.country || 'NG');
  select.value = code;
  localStorage.setItem('medai_therapy_country', code);
}

function renderTherapyFinder(){
  const list = document.getElementById('therapy-list');
  if(!list) return;
  const countryEl = document.getElementById('therapy-country');
  const specEl = document.getElementById('therapy-specialty');
  const searchEl = document.getElementById('therapy-search');
  if(!countryEl.value) syncTherapyCountryFromProfile();
  const country = countryEl.value || 'NG';
  localStorage.setItem('medai_therapy_country', country);
  const specialty = (specEl?.value || '').toLowerCase();
  const query = (searchEl?.value || '').trim().toLowerCase();
  const all = therapyDirectory[country] || therapyDirectory.NG;
  const filtered = all.filter(item=>{
    const haystack = [item.name,item.city,item.address,item.notes,...item.specialties].join(' ').toLowerCase();
    const specOk = !specialty || item.specialties.includes(specialty);
    const queryOk = !query || haystack.includes(query);
    return specOk && queryOk;
  });
  const summary = document.getElementById('therapy-summary');
  if(summary) summary.innerHTML = `<strong style="color:var(--accent)">${filtered.length}</strong> option${filtered.length===1?'':'s'} found for ${escapeHtml(countryEl.options[countryEl.selectedIndex]?.text || country)}. Always verify availability, cost, and licensing before booking.`;
  if(!filtered.length){
    list.innerHTML = '<div class="glass-card therapy-card"><div class="therapy-name">No matches yet</div><div class="therapy-meta">Try a different specialty, country, or search term.</div></div>';
    return;
  }
  list.innerHTML = filtered.map(item=>{
    const tags = item.specialties.map(s=>`<span class="badge badge-blue">${escapeHtml(s.toUpperCase())}</span>`).join('');
    return `<div class="glass-card therapy-card">
      <div class="therapy-card-head">
        <div><div class="therapy-name">${escapeHtml(item.name)}</div><div class="therapy-meta">${escapeHtml(item.city)} · ${escapeHtml(item.address)}</div></div>
        <span class="badge badge-green">${'★'.repeat(Math.round(item.rating))} ${item.rating}</span>
      </div>
      <div class="therapy-tags">${tags}</div>
      <div class="therapy-meta">${escapeHtml(item.notes)}</div>
      <div class="therapy-map">MAP PREVIEW · ${escapeHtml(item.city)}</div>
      <div style="display:flex;gap:.65rem;flex-wrap:wrap;margin-top:auto">
        <a class="btn btn-outline" href="tel:${escapeHtml(item.phone)}" style="text-decoration:none">Call</a>
        <button class="btn btn-primary" onclick="selectTherapyProvider('${escapeHtml(item.name)}')">Use in Referral</button>
      </div>
    </div>`;
  }).join('');
}

function selectTherapyProvider(name){
  localStorage.setItem('medai_selected_therapy_provider', name);
  generateTherapyReferral();
}

function generateTherapyReferral(){
  const u = getCurrentUser();
  const history = getTriageHistory().slice(0,5);
  const selected = localStorage.getItem('medai_selected_therapy_provider') || 'Therapy Provider';
  const fullName = getUserDisplayName ? getUserDisplayName(u) : (u.firstname || u.username || 'MedAI user');
  const concerns = history.length
    ? history.map((h,i)=>`${i+1}. ${h.symptoms || h.title || 'Triage session'} (${historyVisual(h.level).label}, ${h.confidence || 70}% confidence, ${new Date(h.createdAt || Date.now()).toLocaleDateString()})`).join('\n')
    : 'No saved triage sessions yet. The user is requesting support based on current emotional or mental wellbeing needs.';
  const letter = `To: ${selected}
From: ${fullName}
Date: ${new Date().toLocaleDateString()}

Hello,

I am requesting an introductory mental health consultation or referral. My MedAI profile information is below:

Name: ${fullName}
Country: ${u.country || 'Not provided'}
Age/DOB: ${u.dob || 'Not provided'}
Medical conditions: ${Array.isArray(u.conditions) && u.conditions.length ? u.conditions.join(', ') : 'None reported'}
Allergies: ${Array.isArray(u.allergies) && u.allergies.length ? u.allergies.join(', ') : 'None reported'}
Current medications: ${u.medications || 'None reported'}

Recent relevant MedAI notes:
${concerns}

I understand this is not a formal diagnosis. I would like professional assessment, therapy options, and guidance on next steps.

Thank you.`;
  const box = document.getElementById('therapy-referral');
  const status = document.getElementById('therapy-referral-status');
  if(box) box.value = letter;
  if(status) status.innerHTML = `<strong style="color:var(--safe)">Generated.</strong> Referral draft prepared for ${escapeHtml(selected)}.`;
}

function copyTherapyReferral(){
  const box = document.getElementById('therapy-referral');
  const status = document.getElementById('therapy-referral-status');
  if(!box || !box.value.trim()){
    if(status) status.textContent = 'Generate a referral first.';
    return;
  }
  navigator.clipboard?.writeText(box.value).then(()=>{
    if(status) status.innerHTML = '<strong style="color:var(--safe)">Copied.</strong> Referral text copied to clipboard.';
  }).catch(()=>{
    box.select();
    document.execCommand('copy');
    if(status) status.innerHTML = '<strong style="color:var(--safe)">Copied.</strong> Referral text copied.';
  });
}

function exportTherapyReferral(){
  const box = document.getElementById('therapy-referral');
  const status = document.getElementById('therapy-referral-status');
  if(!box || !box.value.trim()){
    if(status) status.textContent = 'Generate a referral first.';
    return;
  }
  const blob = new Blob([box.value], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medai-therapy-referral-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  if(status) status.innerHTML = '<strong style="color:var(--safe)">Exported.</strong> Referral TXT downloaded.';
}

// ============================================================
// PANIC MODE SOS
// ============================================================
let panicTimer = null;
let panicSessionStartedAt = null;
let panicUsedCalmingSound = false;
let panicPhaseIndex = 0;
let panicPhaseStarted = 0;
let panicAudio = null;
let panicOscillator = null;
let panicGain = null;
const panicPhases = [
  {label:'Inhale', detail:'Breathe in slowly through your nose', size:138, duration:4},
  {label:'Hold', detail:'Hold gently. Keep your shoulders soft', size:138, duration:7},
  {label:'Exhale', detail:'Exhale slowly through your mouth. Let your jaw unclench', size:72, duration:8}
];

function openPanicMode(){
  const overlay = document.getElementById('panic-overlay');
  if(!overlay) return;
  panicSessionStartedAt = new Date();
  panicUsedCalmingSound = false;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderPanicDials();
  testGroundingReset();
  startBreathingCoach();
}

function closePanicMode(){
  const overlay = document.getElementById('panic-overlay');
  if(overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  stopBreathingCoach();
  stopCalmingSound();
  logPanicSession();
}

async function logPanicSession(){
  if(!panicSessionStartedAt) return;

  const checks = document.querySelectorAll('#panic-overlay input[type="checkbox"]');
  const groundingComplete = checks.length > 0 && Array.from(checks).every(c => c.checked);
  const durationSeconds = Math.max(0, Math.round((Date.now() - panicSessionStartedAt.getTime()) / 1000));

  const token = localStorage.getItem('medai_token');
  if(token){
    try{
      await fetch(`${API_BASE_URL}/api/panic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          started_at: panicSessionStartedAt.toISOString(),
          duration_seconds: durationSeconds,
          grounding_complete: groundingComplete,
          used_calming_sound: panicUsedCalmingSound
        })
      });
    }catch(e){
      console.warn('Could not log panic session to backend.', e);
    }
  }

  panicSessionStartedAt = null;
}

function startBreathingCoach(){
  stopBreathingCoach();
  panicPhaseIndex = 0;
  panicPhaseStarted = Date.now();
  applyBreathingPhase();
  panicTimer = setInterval(updateBreathingTimer, 250);
}

function stopBreathingCoach(){
  if(panicTimer) clearInterval(panicTimer);
  panicTimer = null;
}

function applyBreathingPhase(){
  const phase = panicPhases[panicPhaseIndex];
  const circle = document.getElementById('breathing-circle');
  const state = document.getElementById('breathing-state');
  const timer = document.getElementById('breathing-timer');
  if(circle){
    circle.style.transitionDuration = phase.duration + 's';
    circle.style.width = phase.size + 'px';
    circle.style.height = phase.size + 'px';
  }
  if(state) state.textContent = phase.label;
  if(timer) timer.textContent = phase.detail;
}

function updateBreathingTimer(){
  const phase = panicPhases[panicPhaseIndex];
  const elapsed = Date.now() - panicPhaseStarted;
  const remaining = Math.max(0, phase.duration - Math.floor(elapsed / 1000));
  const timer = document.getElementById('breathing-timer');
  if(timer) timer.textContent = `${phase.detail} · ${remaining}s`;
  if(elapsed >= phase.duration * 1000){
    panicPhaseIndex = (panicPhaseIndex + 1) % panicPhases.length;
    panicPhaseStarted = Date.now();
    applyBreathingPhase();
  }
}

function toggleGrounding(input){
  const row = input.closest('.tracker-row');
  if(row){
    row.style.borderColor = input.checked ? 'rgba(0,255,136,.35)' : 'var(--border)';
    row.style.background = input.checked ? 'rgba(0,255,136,.06)' : 'rgba(0,0,0,0.15)';
  }
  const checks = document.querySelectorAll('#panic-overlay input[type="checkbox"]');
  const done = Array.from(checks).filter(c=>c.checked).length;
  const status = document.getElementById('grounding-status');
  if(status) status.textContent = done === checks.length ? 'Grounding complete. Stay with your breath.' : `${done} of ${checks.length} completed`;
}

function testGroundingReset(){
  document.querySelectorAll('#panic-overlay input[type="checkbox"]').forEach(input=>{
    input.checked = false;
    toggleGrounding(input);
  });
}

function renderPanicDials(){
  const box = document.getElementById('panic-dials');
  if(!box) return;
  const u = getCurrentUser();
  const country = normalizeCountryCode(u.country || localStorage.getItem('medai_country') || 'NG');
  const hotlines = {
    NG: [{label:'Emergency 112', phone:'112'}, {label:'Nigeria 199', phone:'199'}],
    US: [{label:'Emergency 911', phone:'911'}, {label:'988 Lifeline', phone:'988'}],
    GB: [{label:'Emergency 999', phone:'999'}, {label:'Samaritans 116123', phone:'116123'}],
    ZA: [{label:'Emergency 112', phone:'112'}, {label:'SADAG 0800567567', phone:'0800567567'}]
  };
  const entries = [...(hotlines[country] || hotlines.NG)];
  if(u.emergPhone) entries.unshift({label:u.emergName ? `Call ${u.emergName}` : 'Emergency Contact', phone:u.emergPhone});
  box.innerHTML = entries.slice(0,4).map(item=>`<a href="tel:${escapeHtml(item.phone)}" class="btn ${item.label.includes('Emergency')?'btn-danger':'btn-outline'}" style="justify-content:center;padding:12px;font-size:10px;text-decoration:none">${escapeHtml(item.label)}</a>`).join('');
}

function toggleCalmingSound(){
  if(panicOscillator) stopCalmingSound();
  else startCalmingSound();
}

function startCalmingSound(){
  panicUsedCalmingSound = true;
  const status = document.getElementById('panic-sound-status');
  const wave = document.getElementById('panic-wave');
  const btn = document.getElementById('panic-sound-btn');
  try{
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if(!AudioContext) throw new Error('AudioContext not supported');
    panicAudio = panicAudio || new AudioContext();

    const startTone = () => {
      panicOscillator = panicAudio.createOscillator();
      panicGain = panicAudio.createGain();
      panicOscillator.type = 'sine';
      panicOscillator.frequency.value = 174;
      panicGain.gain.setValueAtTime(0, panicAudio.currentTime);
      panicGain.gain.linearRampToValueAtTime(0.12, panicAudio.currentTime + 0.6);
      panicOscillator.connect(panicGain).connect(panicAudio.destination);
      panicOscillator.start();
      if(wave) wave.classList.add('on');
      if(btn) btn.textContent = 'Stop Calm Sound';
      if(status) status.textContent = 'Low calming tone playing. Use device volume controls.';
    };

    if(panicAudio.state === 'suspended'){
      panicAudio.resume().then(startTone);
    }else{
      startTone();
    }
  }catch(e){
    if(wave) wave.classList.add('on');
    if(status) status.textContent = 'Audio is blocked here, but the calming visual wave is running.';
  }
}

function stopCalmingSound(){
  if(panicOscillator){
    try{panicOscillator.stop();}catch(e){}
    panicOscillator.disconnect();
  }
  panicOscillator = null;
  panicGain = null;
  const wave = document.getElementById('panic-wave');
  const btn = document.getElementById('panic-sound-btn');
  const status = document.getElementById('panic-sound-status');
  if(wave) wave.classList.remove('on');
  if(btn) btn.textContent = 'Start Calm Sound';
  if(status) status.textContent = 'Visual wave ready. Audio starts only after you tap.';
}

setTimeout(()=>{
  syncTherapyCountryFromProfile();
  renderTherapyFinder();
}, 200);

setTimeout(initPricing, 100);

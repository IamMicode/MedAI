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
const tabTitles={dashboard:'Dashboard',triage:'Quick Triage','emergency-contacts':'Emergency Contacts',chatbot:'AI Chatbot','medical-ai':'Medical Health AI','emotional-ai':'Safe Space AI','mental-ai':'Mental Health AI','physical-ai':'Physical Health AI',history:'Symptom History',vitals:'Vitals Monitor',tools:'Health Tools',reports:'Reports & OCR',appointments:'Appointments',therapy:'Therapy Finder',achievements:'Achievements',profile:'My Profile',settings:'Settings',premium:'Unlock Premium'};
const tabBc={dashboard:'HOME / DASHBOARD',triage:'HOME / TRIAGE','emergency-contacts':'HOME / EMERGENCY CONTACTS',chatbot:'AI / CHATBOT','medical-ai':'AI / MEDICAL','emotional-ai':'AI / SAFE SPACE','mental-ai':'AI / MENTAL','physical-ai':'AI / PHYSICAL',history:'HEALTH / HISTORY',vitals:'HEALTH / VITALS',tools:'HEALTH / TOOLS',reports:'HEALTH / REPORTS',appointments:'CARE / APPOINTMENTS',therapy:'CARE / THERAPY FINDER',achievements:'HEALTH / ACHIEVEMENTS',profile:'ACCOUNT / PROFILE',settings:'ACCOUNT / SETTINGS',premium:'ACCOUNT / PREMIUM'};

function showTab(id,el){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'));
  const panel=document.getElementById('tab-'+id);
  if(panel){panel.classList.add('active')}
  if(el)el.classList.add('active');
  document.getElementById('topbar-title').textContent=tabTitles[id]||id;
  document.getElementById('topbar-bc').textContent='// '+(tabBc[id]||id.toUpperCase());
  if(id === 'premium') renderPrices();
  if(id === 'therapy'){ renderTherapyDirectory(); loadDoctorDirectoryMap(); }
  if(id === 'emergency-contacts') renderEmergencyDirectory();
  if(id === 'appointments'){ loadAppointmentDoctors(); loadPatientAppointments(); }
  if(id === 'messages') loadPatientConversations();
  if(id === 'achievements') renderAchievements();
  if(id === 'settings') loadTwoFactorStatus();
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
// Which AI uses which backend
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini'; // legacy Settings display only — not used by callOpenRouter
function getOpenRouterSettings(){
  return {
    key: localStorage.getItem('medai_openrouter_key') || '',
    model: localStorage.getItem('medai_openrouter_model') || DEFAULT_OPENROUTER_MODEL
  };
}
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

  emotional: `You are MedAI Safe Space AI — a compassionate, non-judgmental emotional companion. Your ONLY role is emotional support. Listen actively, validate feelings without minimizing them, reflect back what the user shares, and offer gentle comfort. NEVER give medical advice. NEVER push solutions. Ask open-ended questions to understand the user better. Respond with warmth, empathy and full presence. If the user expresses suicidal thoughts or extreme distress, gently encourage them to contact a professional or crisis line. Keep responses warm and human — 3-5 sentences.`,

  mental: `You are MedAI Mental Health AI — a supportive mental wellness guide. Help users with anxiety, depression, stress, sleep problems, burnout, low self-esteem, trauma, and general mental wellbeing. Use evidence-based techniques: CBT thought reframing, mindfulness exercises, breathing techniques, behavioural activation, journaling prompts, and grounding exercises. Give practical, actionable tools the user can try right now. Always clarify you are not a therapist and encourage professional help for serious conditions. Be compassionate but structured. Respond in 3-6 sentences with one practical tip.`,

  physical: `You are MedAI Physical Health AI — a knowledgeable fitness and nutrition coach. Help users with exercise planning, workout routines, nutrition advice, weight management, injury prevention, recovery, flexibility, sleep optimisation, and body performance. Tailor advice to the user's goals, fitness level, and any conditions they mention. Give specific, safe, practical recommendations. Never encourage dangerous practices. Be motivating and encouraging. Respond in 3-6 sentences with actionable advice.`
};

const chatHistories = { chatbot:[], medical:[], emotional:[], mental:[], physical:[] };
const chatKeys = { 'chatbot':'chatbot', 'medical-ai':'medical', 'emotional-ai':'emotional', 'mental-ai':'mental', 'physical-ai':'physical' };
const aiMeta = {
  chatbot:   { icon:'🤖', label:'MEDAI CHATBOT',      badge:'Gemini' },
  medical:   { icon:'🏥', label:'MEDICAL HEALTH AI',  badge:'Gemini' },
  emotional: { icon:'💭', label:'SAFE SPACE AI',        badge:'OpenRouter' },
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
  const token = localStorage.getItem('medai_token');
  const messages = [{ role: 'user', content: prompt }];
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(API_BASE_URL + '/api/ai/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ messages })
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        if (data.upgradeRequired) throw new Error('daily_limit');
        await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }
      if (!res.ok) throw new Error('api_error_' + res.status);
      const data = await res.json();
      if (data.usage && typeof updateUsageIndicator === 'function') updateUsageIndicator(data.usage);
      return data.text || null;
    } catch(e) {
      if (e.message === 'daily_limit') throw e;
      if (attempt === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('high_demand');
}

// ---- OPENROUTER (backend proxy) ----
async function callOpenRouter(systemPrompt, userMessage) {
  const token = localStorage.getItem('medai_token');
  const messages = [{ role: 'user', content: userMessage }];
  const res = await fetch(API_BASE_URL + '/api/ai/openrouter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    },
    body: JSON.stringify({ messages, systemPrompt })
  });
  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    if (data.upgradeRequired) throw new Error('daily_limit');
    throw new Error('rate_limited');
  }
  if (!res.ok) throw new Error('openrouter_error_' + res.status);
  const data = await res.json();
  if (data.usage && typeof updateUsageIndicator === 'function') updateUsageIndicator(data.usage);
  return data.text || null;
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

    if (e.message === 'daily_limit') {
      errBubble.innerHTML = `<div class="ai-label">⚡ DAILY LIMIT</div>You've used all <strong>10 free AI messages</strong> for today. Your limit resets at midnight. <a href="#" onclick="showTab('premium',null);return false;" style="color:var(--accent)">Upgrade to Premium</a> for unlimited access.`;
    } else if (e.message === 'high_demand' || (e.message && e.message.includes('429'))) {
      errBubble.innerHTML = `<div class="ai-label">⏳ HIGH DEMAND</div>The AI is under high load right now. Please wait 30 seconds and try again — your message is not lost.`;
    } else {
      errBubble.innerHTML = `<div class="ai-label">⚠️ ERROR</div>${e.message || 'Something went wrong. Please try again.'}`;
    }
    messagesEl.appendChild(errBubble);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
// ============================================================
// QUICK TRIAGE — acts as a receptionist: routes emotional complaints to Mental Health AI,
// serious complaints to a matching available registered doctor (or Medical AI as fallback).
// ============================================================
const TRIAGE_SPECIALTIES = ['General Practice','Pediatrics','Psychiatry','Cardiology','Dermatology','Internal Medicine','Emergency Medicine','Gynecology','Neurology','Orthopedics','Other'];

async function startTriage() {
  const input  = document.getElementById('triage-input').value.trim();
  const result = document.getElementById('triage-result');
  if (!input) return;

  result.style.display = 'block';
  result.innerHTML = '<div style="display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:12px;color:var(--muted)"><div class="typing-dots"><span></span><span></span><span></span></div>Analyzing symptoms...</div>';

  const prompt = `You are a medical triage receptionist AI. Read the complaint below and respond ONLY with a raw JSON object — no markdown, no backticks, no extra text whatsoever:
{"triage_level":"home","triage_title":"short action phrase","summary":"2-3 sentence assessment","confidence":80,"category":"home","specialty":null}

Field rules:
- triage_level must be exactly one of: "home", "doctor_soon", or "emergency".
- category must be exactly one of:
  "emotional" — the complaint is primarily about mood, stress, anxiety, grief, relationships, sleep from worry, burnout, or other mental/emotional wellbeing concerns, with no urgent physical symptoms.
  "serious" — the complaint describes a physical symptom or condition that warrants a real doctor's attention (pain, injury, infection, chronic symptoms, anything doctor_soon or emergency level).
  "home" — mild, self-limiting physical symptoms manageable at home with no doctor needed right now.
- specialty: if and only if category is "serious", pick the single best-fit specialty from exactly this list: ${TRIAGE_SPECIALTIES.join(', ')}. Otherwise set specialty to null.

Complaint: ${input}`;

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
    </div>
    <div id="triage-routing" style="margin-top:1rem"></div>`;

    saveTriageResult({
      id: 'triage_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
      symptoms: input,
      level: r.triage_level || 'home',
      title: r.triage_title || c.label,
      summary: r.summary || '',
      confidence: r.confidence || 70,
      createdAt: new Date().toISOString()
    });

    _lastTriageContext = {
      complaint: input,
      title: r.triage_title || c.label,
      summary: r.summary || '',
      confidence: r.confidence || 70
    };

    routeTriageReceptionist(r.category || 'home', r.specialty || null);

  } catch(e) {
    let msg = '';
    if (e.message === 'daily_limit') {
      msg = '⚡ You\'ve used all 10 free AI messages for today. Resets at midnight, or <a href="#" onclick="showTab(\'premium\',null);return false;" style="color:var(--accent)">upgrade to Premium</a> for unlimited access.';
    } else if (e.message === 'high_demand') {
      msg = '⏳ The AI is under high load. Wait 30 seconds and try again.';
    } else {
      msg = '⚠️ ' + (e.message || 'Analysis failed. Please try again.');
    }
    result.innerHTML = `<div style="font-size:13px;color:var(--muted);line-height:1.7">${msg}</div>`;
  }
}

function triageRoutingButton(label, icon, onclick){
  return `<div class="btn btn-primary" style="justify-content:center;margin-top:.5rem" onclick="${onclick}">${icon} ${label}</div>`;
}

let _lastTriageContext = null;

function buildHandoffPrompt(targetAI){
  const ctx = _lastTriageContext;
  if(!ctx) return '';
  if(targetAI === 'mental'){
    return `Hi — I just used the Quick Triage tool and described this: "${ctx.complaint}". The triage assessment suggested this may be more of an emotional or mental health concern (${ctx.title}: ${ctx.summary}). Can you help me talk through what I'm feeling and figure out next steps?`;
  }
  return `Hi — I just used the Quick Triage tool and described this: "${ctx.complaint}". The triage result was "${ctx.title}" — ${ctx.summary} (confidence: ${ctx.confidence}%). No specialist doctor is available right now — can you help me understand this better and what I should do next?`;
}

function renderHandoffPromptBox(targetAI, boxId){
  const promptText = buildHandoffPrompt(targetAI);
  return `
    <div style="font-size:11px;color:var(--muted);margin-bottom:.35rem">Copy this and paste it in as your first message, so it already has your context:</div>
    <div style="position:relative;background:rgba(0,0,0,0.25);border:1px solid var(--border2);border-radius:10px;padding:10px 12px;margin-bottom:.5rem">
      <div id="${boxId}" style="font-size:12px;color:var(--text);line-height:1.5;white-space:pre-wrap">${escapeHtmlChat(promptText)}</div>
    </div>
    <div class="btn" style="justify-content:center;margin-bottom:.5rem" onclick="copyHandoffPrompt('${boxId}', this)">📋 Copy Prompt</div>`;
}

function copyHandoffPrompt(boxId, btnEl){
  const el = document.getElementById(boxId);
  if(!el) return;
  const text = el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const original = btnEl.innerHTML;
    btnEl.innerHTML = '✅ Copied!';
    setTimeout(() => { btnEl.innerHTML = original; }, 1800);
  }).catch(() => {
    alert('Could not copy automatically — please select and copy the text manually.');
  });
}

async function routeTriageReceptionist(category, specialty){
  const box = document.getElementById('triage-routing');
  if(!box) return;

  if(category === 'emotional'){
    box.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:.4rem">This sounds like it's more about how you're feeling than a physical illness. Our Mental Health AI can help right now:</div>
      ${renderHandoffPromptBox('mental', 'handoff-prompt-mental')}
      ${triageRoutingButton('Talk to Mental Health AI', '🧠', "showTab('mental-ai',null)")}`;
    return;
  }

  if(category === 'serious'){
    box.innerHTML = `<div style="font-size:12px;color:var(--muted)">Looking for an available ${escapeHtmlChat(specialty || 'doctor')}...</div>`;
    let doctors = [];
    try{
      const url = `${API_BASE_URL}/api/doctors/directory?availableOnly=true` + (specialty ? `&specialty=${encodeURIComponent(specialty)}` : '');
      const res = await fetch(url, { headers: patientAuthHeaders() });
      if(res.ok){
        const data = await res.json();
        doctors = data.doctors || [];
      }
    }catch(e){ /* fall through to Medical AI fallback below */ }

    if(doctors.length){
      const d = doctors[0];
      box.innerHTML = `
        <div style="background:rgba(0,212,255,0.05);border:1px solid var(--border2);border-radius:12px;padding:1rem;margin-bottom:.5rem">
          <div style="font-family:var(--head);font-weight:700;font-size:14px">Dr. ${escapeHtmlChat(d.fullName)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${escapeHtmlChat(d.specialty)}${d.hospital ? ' · ' + escapeHtmlChat(d.hospital) : ''}</div>
          ${d.avgRating ? `<div style="font-size:11px;color:var(--warning);margin-top:4px">${'★'.repeat(Math.round(d.avgRating))}${'☆'.repeat(5-Math.round(d.avgRating))} ${d.avgRating} (${d.reviewCount})</div>` : ''}
          <div style="font-size:11px;color:var(--safe);font-family:var(--mono);margin-top:6px">● AVAILABLE NOW</div>
        </div>
        ${triageRoutingButton('Message Dr. ' + escapeHtmlChat(d.fullName), '💬', `startTriageDoctorChat('${d.userId}','${escapeHtmlChat(d.fullName)}','${escapeHtmlChat(d.specialty)}')`)}`;
    } else {
      box.innerHTML = `
        <div style="font-size:12px;color:var(--muted);margin-bottom:.4rem">No ${escapeHtmlChat(specialty || 'matching')} doctor is available right now. Our Medical Health AI can help in the meantime:</div>
        ${renderHandoffPromptBox('medical', 'handoff-prompt-medical')}
        ${triageRoutingButton('Ask Medical Health AI', '🏥', "showTab('medical-ai',null)")}`;
    }
    return;
  }

  box.innerHTML = '';
}

async function startTriageDoctorChat(doctorId, doctorName, specialty){
  try{
    const res = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
      method: 'POST',
      headers: { ...patientAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId })
    });
    if(!res.ok) throw new Error('failed');
    const data = await res.json();
    showTab('messages', null);
    await loadPatientConversations();
    openPatientConversation(data.conversation.id, doctorName, specialty);
  }catch(e){
    alert('Could not start a conversation with this doctor. Please try again from the Messages tab.');
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

// ============================================================
// REGISTERED DOCTORS DIRECTORY + MAPS (Therapy Finder / Appointments)
// Leaflet + OpenStreetMap — no API key needed.
// ============================================================
let _leafletLoadPromise = null;
let _doctorDirectory = null;
let _directoryMap = null;
let _apptDoctorMap = null;
let _apptDoctorMarker = null;

function loadLeaflet(){
  if(_leafletLoadPromise) return _leafletLoadPromise;
  _leafletLoadPromise = new Promise((resolve, reject) => {
    if(window.L){ resolve(); return; }

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    cssLink.crossOrigin = '';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('leaflet_load_failed'));
    document.head.appendChild(script);
  });
  return _leafletLoadPromise;
}

function addOsmTileLayer(map){
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);
}

async function fetchDoctorDirectory(){
  if(_doctorDirectory) return _doctorDirectory;
  try{
    const token = localStorage.getItem('medai_token');
    const res = await fetch(`${API_BASE_URL}/api/doctors/directory`, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
    if(!res.ok) throw new Error('fetch_failed');
    const data = await res.json();
    _doctorDirectory = data.doctors || [];
  }catch(e){
    _doctorDirectory = [];
  }
  return _doctorDirectory;
}

// ---------- Therapy Finder: live map of registered doctors ----------
async function loadDoctorDirectoryMap(){
  const mapEl = document.getElementById('doctor-directory-map');
  const listEl = document.getElementById('doctor-directory-list');
  if(!mapEl || !listEl) return;

  const doctors = await fetchDoctorDirectory();

  if(!doctors.length){
    mapEl.innerHTML = 'No registered doctors yet.';
    listEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = doctors.map(d => `
    <div class="glass-card therapy-card">
      <div class="therapy-card-head">
        <div><div class="therapy-name">Dr. ${escapeHtml(d.fullName)}</div><div class="therapy-meta">${escapeHtml(d.specialty)}${d.hospital ? ' · ' + escapeHtml(d.hospital) : ''}</div></div>
      </div>
      ${d.avgRating ? `<div class="therapy-meta" style="color:var(--warning)">${'★'.repeat(Math.round(d.avgRating))}${'☆'.repeat(5-Math.round(d.avgRating))} ${d.avgRating} (${d.reviewCount} review${d.reviewCount===1?'':'s'})</div>` : `<div class="therapy-meta">No reviews yet</div>`}
      <div class="therapy-meta">${escapeHtml(d.formattedAddress || 'Location not shared yet')}</div>
      <div class="therapy-meta">${d.yearsExperience} years experience</div>
    </div>
  `).join('');

  const withLocation = doctors.filter(d => typeof d.latitude === 'number' && typeof d.longitude === 'number');
  if(!withLocation.length){
    mapEl.innerHTML = 'None of these doctors have shared a map location yet.';
    return;
  }

  try{
    await loadLeaflet();
  }catch(e){
    mapEl.innerHTML = 'Map could not be loaded — check your connection and try again.';
    return;
  }

  mapEl.innerHTML = '';
  const first = withLocation[0];
  if(_directoryMap){ _directoryMap.remove(); _directoryMap = null; }
  _directoryMap = L.map(mapEl).setView([first.latitude, first.longitude], 11);
  addOsmTileLayer(_directoryMap);

  const bounds = [];
  withLocation.forEach(d => {
    const marker = L.marker([d.latitude, d.longitude]).addTo(_directoryMap);
    marker.bindPopup(`<strong>Dr. ${escapeHtml(d.fullName)}</strong><br>${escapeHtml(d.specialty)}${d.hospital ? '<br>' + escapeHtml(d.hospital) : ''}`);
    bounds.push([d.latitude, d.longitude]);
  });
  if(withLocation.length > 1) _directoryMap.fitBounds(bounds, { padding: [30,30] });
}

// ---------- Appointments: real doctor selector + location preview ----------
async function loadAppointmentDoctors(){
  const select = document.getElementById('appt-doctor');
  if(!select) return;
  const doctors = await fetchDoctorDirectory();

  if(!doctors.length){
    select.innerHTML = '<option value="">No registered doctors available yet</option>';
    return;
  }

  select.innerHTML = doctors.map(d => {
    const ratingLabel = d.avgRating ? ` (★${d.avgRating} · ${d.reviewCount})` : '';
    return `<option value="${d.userId}" data-lat="${d.latitude}" data-lng="${d.longitude}" data-hospital="${escapeHtml(d.hospital || d.formattedAddress || '')}" data-name="${escapeHtml(d.fullName)}" data-specialty="${escapeHtml(d.specialty)}">Dr. ${escapeHtml(d.fullName)} - ${escapeHtml(d.specialty)}${ratingLabel}</option>`;
  }).join('');

  onApptDoctorChange();
}

async function onApptDoctorChange(){
  const select = document.getElementById('appt-doctor');
  const mapEl = document.getElementById('appt-doctor-map');
  if(!select || !mapEl) return;
  const opt = select.options[select.selectedIndex];
  const lat = parseFloat(opt?.dataset?.lat);
  const lng = parseFloat(opt?.dataset?.lng);

  if(!opt || isNaN(lat) || isNaN(lng)){
    mapEl.style.display = 'none';
    return;
  }

  mapEl.style.display = 'block';
  try{
    await loadLeaflet();
  }catch(e){
    mapEl.style.display = 'flex';
    mapEl.style.alignItems = 'center';
    mapEl.style.justifyContent = 'center';
    mapEl.style.fontSize = '12px';
    mapEl.style.color = 'var(--muted)';
    mapEl.textContent = 'Map could not be loaded — check your connection and try again.';
    return;
  }

  if(!_apptDoctorMap){
    mapEl.textContent = '';
    _apptDoctorMap = L.map(mapEl, { zoomControl: true }).setView([lat, lng], 14);
    addOsmTileLayer(_apptDoctorMap);
    _apptDoctorMarker = L.marker([lat, lng]).addTo(_apptDoctorMap);
  }else{
    _apptDoctorMap.setView([lat, lng], 14);
    _apptDoctorMarker.setLatLng([lat, lng]);
  }
  setTimeout(() => _apptDoctorMap.invalidateSize(), 50);
}

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

async function bookAppointment(){
  const select = document.getElementById('appt-doctor');
  const doctorId = select?.value || '';
  const opt = select?.options[select.selectedIndex];
  const doctorName = opt?.dataset?.name || 'Doctor';
  const urgency = document.getElementById('appt-urgency')?.value || 'Routine';
  const date = document.getElementById('appt-date')?.value || '';
  const time = document.getElementById('appt-time')?.value || '';
  const reason = document.getElementById('appt-reason')?.value.trim() || 'General consultation';

  if(!doctorId){
    alert('Please select a doctor.');
    return;
  }
  if(!date || !time){
    alert('Please choose a date and time.');
    return;
  }

  const btn = event?.target;
  if(btn) btn.style.opacity = '.6';

  try{
    const res = await fetch(`${API_BASE_URL}/api/chat/appointments`, {
      method: 'POST',
      headers: { ...patientAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId, scheduledDate: date, scheduledTime: time, reason, urgency })
    });
    if(!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Could not book appointment.');
    }
    document.getElementById('appt-reason').value = '';
    await loadPatientAppointments();
  }catch(e){
    alert(e.message || 'Could not book appointment. Please try again.');
  }finally{
    if(btn) btn.style.opacity = '1';
  }
}

const APPT_STATUS_BADGE = {
  PENDING:   { label: 'Pending doctor response', cls: 'badge-warn' },
  ACCEPTED:  { label: 'Accepted', cls: 'badge-green' },
  DECLINED:  { label: 'Declined', cls: 'badge-danger' },
  CANCELLED: { label: 'Cancelled', cls: 'badge-blue' }
};

async function loadPatientAppointments(){
  const list = document.getElementById('appointment-list');
  if(!list) return;
  list.innerHTML = '<div style="padding:1rem;color:var(--muted);font-size:12px">Loading appointments...</div>';
  try{
    const res = await fetch(`${API_BASE_URL}/api/chat/appointments`, { headers: patientAuthHeaders() });
    if(!res.ok) throw new Error('failed');
    const data = await res.json();
    const appointments = data.appointments || [];

    if(!appointments.length){
      list.innerHTML = '<div style="padding:1rem;color:var(--muted);font-size:12px">No appointments booked yet.</div>';
      return;
    }

    list.innerHTML = appointments.map(a => {
      const badge = APPT_STATUS_BADGE[a.status] || APPT_STATUS_BADGE.PENDING;
      const declineNote = (a.status === 'DECLINED' && a.declineReason)
        ? `<div class="timeline-meta" style="color:var(--danger)">Doctor's note: ${escapeHtmlChat(a.declineReason)}</div>` : '';
      return `<div class="timeline-item">
        <div class="timeline-time">${escapeHtml(a.scheduledDate)}</div>
        <div>
          <div class="timeline-title">Dr. ${escapeHtml(a.doctorName)}${a.specialty ? ' — ' + escapeHtml(a.specialty) : ''}</div>
          <div class="timeline-meta">${escapeHtml(a.reason || 'General consultation')} - ${escapeHtml(a.scheduledTime)}</div>
          ${declineNote}
        </div>
        <span class="badge ${badge.cls}">${badge.label}</span>
      </div>`;
    }).join('');
  }catch(e){
    list.innerHTML = '<div style="padding:1rem;color:var(--muted);font-size:12px">Could not load appointments. Check your connection and try again.</div>';
  }
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

async function saveProfile(){
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
  if(msg) msg.innerHTML = '<strong style="color:var(--accent)">Saving...</strong>';

  const token = localStorage.getItem('medai_token');
  if(!token){
    if(msg) msg.innerHTML = '<strong style="color:var(--warning)">Saved locally only</strong> — log in to sync this to your doctors.';
    return;
  }

  try{
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        firstname: updated.firstname,
        lastname: updated.lastname,
        dob: updated.dob,
        gender: updated.gender,
        height: updated.height,
        weight: updated.weight,
        bloodGroup: updated.bloodGroup,
        country: updated.country,
        phone: updated.phone,
        conditions: updated.conditions,
        allergies: updated.allergies,
        medications: updated.medications,
        smokes: updated.smokes,
        alcohol: updated.alcohol,
        exercises: updated.exercises,
        emergName: updated.emergName,
        emergPhone: updated.emergPhone
      })
    });
    if(!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Could not sync to server.');
    }
    const data = await res.json();
    if(data.user) localStorage.setItem('medai_current_user', JSON.stringify(data.user));
    if(msg) msg.innerHTML = '<strong style="color:var(--safe)">Saved.</strong> Your doctors will see this the next time they open your profile.';
  }catch(e){
    if(msg) msg.innerHTML = `<strong style="color:var(--danger)">Saved locally, but couldn't sync:</strong> ${escapeHtmlChat(e.message)}`;
  }
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
  syncTriageResultToBackend(entry);
}

async function syncTriageResultToBackend(entry){
  const token = localStorage.getItem('medai_token');
  if(!token) return;
  const levelMap = { home: 'LOW', doctor_soon: 'HIGH', emergency: 'EMERGENCY' };
  try{
    const res = await fetch(`${API_BASE_URL}/api/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        symptoms: entry.symptoms,
        triage_level: levelMap[entry.level] || 'LOW',
        triage_title: entry.title,
        summary: entry.summary,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : undefined
      })
    });
    if(!res.ok){
      const err = await res.json().catch(() => ({}));
      console.warn('Triage sync to backend failed:', err.message || res.status);
    }
  }catch(e){ /* non-critical — triage still saved locally, doctor visibility just delayed */ }
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
  const rows = history.map((item, idx) => {
    const cfg = historyVisual(item.level);
    const date = new Date(item.createdAt || Date.now()).toLocaleString([], {month:'short', day:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
    return `<div class="history-row" onclick="openTriageDetail(${idx})" style="cursor:pointer"><div class="history-triage-dot ${cfg.dot}"></div><div class="history-info"><div class="history-symptom">${escapeHtml(item.symptoms || item.title || 'Triage session')}</div><div class="history-meta">${date} - ${cfg.label.toUpperCase()} - ${item.confidence || 70}% confidence</div></div><span class="badge ${cfg.badge}">${cfg.short}</span></div>`;
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
  const rows=items.slice(0,3).map((item, idx)=>{
    const cfg=historyVisual(item.level);
    const date=new Date(item.createdAt || Date.now()).toLocaleDateString();
    return `<div class="history-row" onclick="openTriageDetail(${idx})" style="cursor:pointer"><div class="history-triage-dot ${cfg.dot}"></div><div class="history-info"><div class="history-symptom">${escapeHtml(item.symptoms || item.title || 'Triage session')}</div><div class="history-meta">${date} - ${cfg.label.toUpperCase()} - ${item.confidence || 70}% confidence</div></div><span class="badge ${cfg.badge}">${cfg.short}</span></div>`;
  }).join('');
  card.innerHTML=header+rows+`<div style="padding:1rem 1.25rem"><div class="btn btn-outline" onclick="showTab('history',null)" style="width:100%;justify-content:center;font-size:10px">View Full History -></div></div>`;
}

function openTriageDetail(index){
  const history = getTriageHistory();
  const item = history[index];
  if(!item) return;
  const cfg = historyVisual(item.level);
  const date = new Date(item.createdAt || Date.now()).toLocaleString([], {weekday:'long', month:'long', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'});

  document.getElementById('triage-detail-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="history-triage-dot ${cfg.dot}" style="width:14px;height:14px"></div>
        <div>
          <div style="font-family:var(--head);font-size:18px;font-weight:800;color:${cfg.color}">${escapeHtml(item.title || cfg.label)}</div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:2px">${date}</div>
        </div>
      </div>
      <button class="btn-ghost" style="padding:4px 10px" onclick="closeTriageDetail()">✕</button>
    </div>

    <div style="margin-bottom:1.25rem">
      <div style="font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:6px">WHAT YOU DESCRIBED</div>
      <div style="background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:14px;line-height:1.7">${escapeHtml(item.symptoms || 'No description recorded.')}</div>
    </div>

    <div style="margin-bottom:1.25rem">
      <div style="font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:6px">AI ASSESSMENT</div>
      <div style="background:${cfg.color}11;border:1px solid ${cfg.color}33;border-radius:10px;padding:14px">
        <div style="font-family:var(--head);font-size:14px;font-weight:700;color:${cfg.color};margin-bottom:6px">${escapeHtml(item.title || cfg.label)}</div>
        <div style="font-size:13px;line-height:1.7;color:var(--text)">${escapeHtml(item.summary || 'No summary recorded.')}</div>
      </div>
    </div>

    <div style="display:flex;gap:14px;align-items:center">
      <span class="badge ${cfg.badge}">${cfg.short}</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--muted)">CONFIDENCE: ${item.confidence || 70}%</span>
    </div>

    <div style="display:flex;gap:10px;margin-top:1.5rem">
      <button class="btn btn-outline" style="flex:1;justify-content:center" onclick="closeTriageDetail();showTab('triage',null)">Run New Triage</button>
      <button class="btn btn-outline" style="flex:1;justify-content:center" onclick="closeTriageDetail();showTab('medical-ai',null)">Ask Medical AI</button>
    </div>
  `;
  document.getElementById('triage-detail-overlay').style.display = 'flex';
}

function closeTriageDetail(){
  const overlay = document.getElementById('triage-detail-overlay');
  if(overlay) overlay.style.display = 'none';
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
  syncVitalReadingToBackend(reading);
}

async function syncVitalReadingToBackend(reading){
  const token = localStorage.getItem('medai_token');
  if(!token) return;
  try{
    await fetch(`${API_BASE_URL}/api/profile/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        heartRate: reading.heartRate || undefined,
        spo2: reading.spo2 || undefined,
        temp: reading.temp || undefined,
        bp: reading.bp || undefined,
        glucose: reading.glucose || undefined,
        weight: reading.weight || undefined,
        source: reading.source === 'camera' ? 'camera' : 'manual'
      })
    });
  }catch(e){ /* non-critical — vitals still saved locally, doctor sync just delayed */ }
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
  if(msg) msg.innerHTML='<strong style="color:var(--safe)">Saved.</strong> Your doctors will see this the next time they open your profile.';
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
    if(id === 'twofa-panel') loadTwoFactorStatus();
  }
}

// ============================================================
// TWO-FACTOR AUTHENTICATION
// ============================================================
async function loadTwoFactorStatus(){
  const token = localStorage.getItem('medai_token');
  const descEl = document.getElementById('twofa-status-desc');
  if(!token) return;
  try{
    const res = await fetch(`${API_BASE_URL}/api/2fa/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if(descEl) descEl.textContent = data.enabled ? 'Enabled' : 'Not enabled';

    document.getElementById('twofa-disabled-view').style.display = data.enabled ? 'none' : 'block';
    document.getElementById('twofa-enabled-view').style.display = data.enabled ? 'block' : 'none';
    document.getElementById('twofa-setup-view').style.display = 'none';
  }catch(e){
    if(descEl) descEl.textContent = 'Could not load status';
  }
}

async function start2FASetup(){
  const token = localStorage.getItem('medai_token');
  if(!token) return;
  try{
    const res = await fetch(`${API_BASE_URL}/api/2fa/setup`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    });
    if(!res.ok) throw new Error('Could not start 2FA setup.');
    const data = await res.json();
    document.getElementById('twofa-qr-code').src = data.qrCodeDataUrl;
    document.getElementById('twofa-manual-key').textContent = data.manualEntryKey;
    document.getElementById('twofa-disabled-view').style.display = 'none';
    document.getElementById('twofa-setup-view').style.display = 'block';
  }catch(e){
    alert(e.message || 'Could not start 2FA setup. Please try again.');
  }
}

function cancel2FASetup(){
  document.getElementById('twofa-setup-view').style.display = 'none';
  document.getElementById('twofa-disabled-view').style.display = 'block';
  document.getElementById('twofa-setup-code').value = '';
  document.getElementById('twofa-setup-status').textContent = '';
}

async function confirm2FASetup(){
  const token = localStorage.getItem('medai_token');
  const code = document.getElementById('twofa-setup-code').value.trim();
  const status = document.getElementById('twofa-setup-status');
  if(!code){
    status.innerHTML = '<strong style="color:var(--danger)">Please enter the 6-digit code.</strong>';
    return;
  }
  try{
    const res = await fetch(`${API_BASE_URL}/api/2fa/verify-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if(!res.ok){
      status.innerHTML = `<strong style="color:var(--danger)">${escapeHtml(data.message || 'Incorrect code.')}</strong>`;
      return;
    }
    document.getElementById('twofa-setup-view').style.display = 'none';
    document.getElementById('twofa-backup-codes-list').innerHTML = data.backupCodes.map(c => escapeHtml(c)).join('<br>');
    document.getElementById('twofa-backup-codes-view').style.display = 'block';
    document.getElementById('twofa-setup-code').value = '';
    status.textContent = '';
  }catch(e){
    status.innerHTML = '<strong style="color:var(--danger)">Could not verify code. Check your connection and try again.</strong>';
  }
}

async function disable2FA(){
  const token = localStorage.getItem('medai_token');
  const password = document.getElementById('twofa-disable-password').value;
  const status = document.getElementById('twofa-disable-status');
  if(!password){
    status.innerHTML = '<strong style="color:var(--danger)">Please enter your password.</strong>';
    return;
  }
  if(!confirm('Are you sure you want to disable Two-Factor Auth? This will make your account less secure.')) return;
  try{
    const res = await fetch(`${API_BASE_URL}/api/2fa/disable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if(!res.ok){
      status.innerHTML = `<strong style="color:var(--danger)">${escapeHtml(data.message || 'Could not disable 2FA.')}</strong>`;
      return;
    }
    document.getElementById('twofa-disable-password').value = '';
    status.innerHTML = '<strong style="color:var(--safe)">2FA disabled.</strong>';
    await loadTwoFactorStatus();
  }catch(e){
    status.innerHTML = '<strong style="color:var(--danger)">Could not reach server. Please try again.</strong>';
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
    let msg = e.message === 'daily_limit' ? 'Daily message limit reached.' : e.message;
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

async function saveEmergencySettings(){
  const u=getCurrentUser();
  u.emergName=document.getElementById('settings-emerg-name')?.value.trim() || '';
  u.emergPhone=document.getElementById('settings-emerg-phone')?.value.trim() || '';
  setCurrentUser(u);
  loadProfileForm();
  personalizeEmergencyContact(u);
  const status=document.getElementById('emergency-status');
  if(status) status.innerHTML='<strong style="color:var(--accent)">Saving...</strong>';

  const token = localStorage.getItem('medai_token');
  if(!token){
    if(status) status.innerHTML='<strong style="color:var(--warning)">Saved locally only</strong> — log in to sync this to your doctors.';
    return;
  }
  try{
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emergName: u.emergName, emergPhone: u.emergPhone })
    });
    if(!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Could not sync to server.');
    }
    const data = await res.json();
    if(data.user) localStorage.setItem('medai_current_user', JSON.stringify(data.user));
    if(status) status.innerHTML='<strong style="color:var(--safe)">Emergency contact updated.</strong>';
  }catch(e){
    if(status) status.innerHTML=`<strong style="color:var(--danger)">Saved locally, but couldn't sync:</strong> ${escapeHtmlChat(e.message)}`;
  }
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


// ============================================================
// MESSAGES — PATIENT-DOCTOR REAL-TIME CHAT
// ============================================================
let _patientConversations = [];
let _activePatientConversation = null;
let _patientChatPollInterval = null;

function patientAuthHeaders(){
  const token = localStorage.getItem('medai_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function escapeHtmlChat(v){
  return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

// ---------- image attachment (resize/compress client-side before sending) ----------
let _pendingChatImage = null;

function handlePatientImageSelect(event){
  const file = event.target.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){
    alert('Please choose an image file.');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1280;
      let { width, height } = img;
      if(width > maxDim || height > maxDim){
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      _pendingChatImage = canvas.toDataURL('image/jpeg', 0.75);

      document.getElementById('patient-chat-image-preview-img').src = _pendingChatImage;
      document.getElementById('patient-chat-image-preview').style.display = 'flex';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function clearPatientImageAttachment(){
  _pendingChatImage = null;
  document.getElementById('patient-chat-image-preview').style.display = 'none';
  document.getElementById('patient-chat-image-preview-img').src = '';
}

async function loadPatientConversations(){
  const list = document.getElementById('patient-conv-list');
  if(!list) return;
  try{
    const res = await fetch(API_BASE_URL + '/api/chat/conversations', { headers: patientAuthHeaders() });
    if(!res.ok) throw new Error('fetch_failed');
    const data = await res.json();
    _patientConversations = data.conversations || [];

    const badge = document.getElementById('patient-msg-badge');
    if(badge) badge.style.display = _patientConversations.length ? 'inline-block' : 'none';

    if(!_patientConversations.length){
      list.innerHTML = '<div style="padding:1.25rem;color:var(--muted);font-size:13px;line-height:1.6">No conversations yet. When a doctor starts a chat with you, it will appear here.</div>';
      return;
    }

    list.innerHTML = _patientConversations.map(c => `
      <div class="history-row" style="cursor:pointer;border-radius:0" onclick="openPatientConversation('${c.id}','${escapeHtmlChat(c.doctorName)}','${escapeHtmlChat(c.doctorSpecialty||'')}','${c.doctorId}')" id="pconv-${c.id}">
        <div class="history-triage-dot home"></div>
        <div class="history-info">
          <div class="history-symptom">Dr. ${escapeHtmlChat(c.doctorName)}</div>
          <div class="history-meta">${escapeHtmlChat(c.doctorSpecialty || '')}${c.lastMessage ? ' — ' + escapeHtmlChat(c.lastMessage.slice(0,40)) : ' — No messages yet'}</div>
        </div>
      </div>`).join('');
  }catch(e){
    list.innerHTML = '<div style="padding:1.25rem;color:var(--muted);font-size:13px">Could not load conversations. Check your connection and try again.</div>';
  }
}

let _activePatientDoctorId = null;
let _activePatientDoctorName = null;

function openPatientConversation(convId, doctorName, specialty, doctorId){
  _activePatientConversation = convId;
  _activePatientDoctorId = doctorId || _activePatientDoctorId;
  _activePatientDoctorName = doctorName;
  document.querySelectorAll('#patient-conv-list .history-row').forEach(el => el.style.background = '');
  const active = document.getElementById('pconv-' + convId);
  if(active) active.style.background = 'rgba(0,212,255,0.06)';

  document.getElementById('patient-chat-header').innerHTML =
    `<span>Dr. ${escapeHtmlChat(doctorName)}${specialty ? ' — ' + escapeHtmlChat(specialty) : ''}</span>
     <span onclick="openRateDoctorModal()" style="float:right;cursor:pointer;font-family:var(--mono);font-size:10px;letter-spacing:1px;color:var(--accent);border:1px solid var(--border2);border-radius:20px;padding:4px 10px">⭐ RATE DOCTOR</span>`;
  document.getElementById('patient-chat-input-row').style.display = 'flex';

  loadPatientMessages();
  if(_patientChatPollInterval) clearInterval(_patientChatPollInterval);
  _patientChatPollInterval = setInterval(loadPatientMessages, 4000);
}

// ---------- Rate Doctor modal ----------
function openRateDoctorModal(){
  if(!_activePatientDoctorId){
    alert('Select a conversation first.');
    return;
  }
  const existing = document.getElementById('rate-doctor-modal');
  if(existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'rate-doctor-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:900;display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML = `
    <div class="glass-card" style="max-width:380px;width:100%;padding:1.5rem" onclick="event.stopPropagation()">
      <div style="font-family:var(--head);font-weight:700;font-size:16px;margin-bottom:4px">Rate Dr. ${escapeHtmlChat(_activePatientDoctorName || '')}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:1rem">Your review helps other patients choose the right doctor.</div>
      <div id="star-picker" style="display:flex;gap:6px;font-size:28px;margin-bottom:1rem;cursor:pointer;justify-content:center">
        ${[1,2,3,4,5].map(n => `<span data-star="${n}" onclick="setStarRating(${n})" style="opacity:.3;transition:opacity .15s">⭐</span>`).join('')}
      </div>
      <textarea class="tool-textarea" id="review-comment" placeholder="Optional: share more about your experience..." style="width:100%;min-height:80px"></textarea>
      <div style="display:flex;gap:10px;margin-top:1rem">
        <div class="btn" style="flex:1;justify-content:center" onclick="document.getElementById('rate-doctor-modal').remove()">Cancel</div>
        <div class="btn btn-primary" style="flex:1;justify-content:center" onclick="submitDoctorReview()">Submit</div>
      </div>
      <div id="review-submit-status" style="font-size:11px;color:var(--muted);margin-top:.5rem;text-align:center"></div>
    </div>`;
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
  window._selectedStarRating = 0;
}

function setStarRating(n){
  window._selectedStarRating = n;
  document.querySelectorAll('#star-picker span').forEach(el => {
    el.style.opacity = Number(el.dataset.star) <= n ? '1' : '.3';
  });
}

async function submitDoctorReview(){
  const status = document.getElementById('review-submit-status');
  const rating = window._selectedStarRating || 0;
  if(rating < 1){
    status.textContent = 'Please select a star rating.';
    status.style.color = 'var(--danger)';
    return;
  }
  const comment = document.getElementById('review-comment').value.trim();
  status.textContent = 'Submitting...';
  status.style.color = 'var(--muted)';
  try{
    const res = await fetch(`${API_BASE_URL}/api/doctors/${_activePatientDoctorId}/reviews`, {
      method: 'POST',
      headers: { ...patientAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment })
    });
    if(!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Could not submit review.');
    }
    status.textContent = 'Thank you for your feedback!';
    status.style.color = 'var(--safe)';
    setTimeout(() => { const m = document.getElementById('rate-doctor-modal'); if(m) m.remove(); }, 1200);
  }catch(e){
    status.textContent = e.message || 'Could not submit review. Please try again.';
    status.style.color = 'var(--danger)';
  }
}

async function loadPatientMessages(){
  if(!_activePatientConversation) return;
  try{
    const res = await fetch(API_BASE_URL + '/api/chat/conversations/' + _activePatientConversation + '/messages', { headers: patientAuthHeaders() });
    if(!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('patient-chat-messages');
    const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 60;

    container.innerHTML = data.messages.map(m => {
      const isMe = m.senderRole === 'USER';
      const imageHtml = m.imageData
        ? `<img src="${m.imageData}" style="max-width:100%;max-height:260px;border-radius:8px;display:block;cursor:pointer;${m.content ? 'margin-bottom:6px' : ''}" onclick="window.open(this.src,'_blank')"/>`
        : '';
      return `<div style="max-width:70%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5;${isMe ? 'background:var(--accent);color:#04121c;margin-left:auto;border-bottom-right-radius:3px' : 'background:var(--surface2);border:1px solid var(--border);margin-right:auto;border-bottom-left-radius:3px'}">
        ${imageHtml}${m.content ? escapeHtmlChat(m.content) : ''}
        <div style="font-family:var(--mono);font-size:9px;opacity:.65;margin-top:4px">${new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
      </div>`;
    }).join('') || '<div style="text-align:center;color:var(--muted);font-size:13px;padding:2rem 0">No messages yet. Say hello 👋</div>';

    if(wasAtBottom) container.scrollTop = container.scrollHeight;
  }catch(e){}
}

async function sendPatientMessage(){
  const input = document.getElementById('patient-chat-input');
  const content = input.value.trim();
  const imageData = _pendingChatImage;
  if(!content && !imageData) return;
  if(!_activePatientConversation) return;
  input.value = '';
  clearPatientImageAttachment();
  try{
    await fetch(API_BASE_URL + '/api/chat/conversations/' + _activePatientConversation + '/messages', {
      method: 'POST',
      headers: { ...patientAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, imageData })
    });
    await loadPatientMessages();
  }catch(e){
    alert('Could not send message. Please try again.');
  }
}


let _achievementsLoading = false;

async function renderAchievements(){
  const container = document.getElementById('achievements-grid');
  const statsEl = document.getElementById('achievements-stats');
  if(!container) return;
  if(_achievementsLoading) return;
  _achievementsLoading = true;

  container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);font-family:var(--mono);font-size:12px;letter-spacing:1px">LOADING ACHIEVEMENTS...</div>';

  const token = localStorage.getItem('medai_token');
  try{
    const res = await fetch(API_BASE_URL + '/api/achievements', {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    if(!res.ok) throw new Error('fetch_failed');
    const data = await res.json();
    _achievementsCache = data;
    renderAchievementsUI(data);
  }catch(e){
    console.warn('Achievements fetch failed, using local fallback:', e);
    renderAchievementsLocal();
  }finally{
    _achievementsLoading = false;
  }
}

function renderAchievementsUI(data){
  const container = document.getElementById('achievements-grid');
  const statsEl = document.getElementById('achievements-stats');
  if(!container) return;

  if(statsEl){
    const pct = Math.round((data.stats.unlocked / data.stats.total) * 100);
    statsEl.innerHTML = `
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin-bottom:24px">
        <div style="flex:1;min-width:200px">
          <div style="font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:1px;margin-bottom:6px">PROGRESS</div>
          <div style="font-family:var(--head);font-size:28px;font-weight:800;color:var(--accent)">${data.stats.unlocked}<span style="font-size:16px;color:var(--muted)">/${data.stats.total}</span></div>
          <div style="height:6px;background:rgba(0,212,255,0.1);border-radius:99px;margin-top:8px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:99px;transition:width 1s ease"></div>
          </div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="text-align:center"><div style="font-family:var(--head);font-size:20px;font-weight:700;color:var(--safe)">${data.stats.triageCount}</div><div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:1px">TRIAGES</div></div>
          <div style="text-align:center"><div style="font-family:var(--head);font-size:20px;font-weight:700;color:var(--danger)">${data.stats.panicCount}</div><div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:1px">PANIC EVENTS</div></div>
          <div style="text-align:center"><div style="font-family:var(--head);font-size:20px;font-weight:700;color:var(--accent)">${data.stats.accountAgeDays}</div><div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:1px">DAYS</div></div>
          <div style="text-align:center"><div style="font-family:var(--head);font-size:20px;font-weight:700;color:var(--purple)">${data.stats.totalAIMessages}</div><div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:1px">AI MSGS</div></div>
        </div>
      </div>`;
  }

  // sort: unlocked first, then by progress
  const sorted = [...data.achievements].sort((a,b) => {
    if(a.unlocked && !b.unlocked) return -1;
    if(!a.unlocked && b.unlocked) return 1;
    return (b.progress/b.total) - (a.progress/a.total);
  });

  container.innerHTML = sorted.map(ach => {
    const pct = Math.round((ach.progress / ach.total) * 100);
    const isPercent = ach.total > 1;
    const badgeHtml = ach.unlocked
      ? '<span class="badge badge-green" style="margin-top:6px">✓ Unlocked</span>'
      : isPercent
        ? `<span style="display:inline-block;margin-top:6px;font-family:var(--mono);font-size:10px;color:var(--muted)">${ach.progress}/${ach.total}</span>`
        : '<span style="display:inline-block;margin-top:6px;font-family:var(--mono);font-size:10px;color:var(--muted)">Locked</span>';

    const progressBar = (!ach.unlocked && isPercent) ? `
      <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:99px;margin-top:8px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:99px;transition:width 1s ease"></div>
      </div>` : '';

    return `<div class="glass-card ach-card" style="opacity:${ach.unlocked?'1':'0.65'};transition:all .2s" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='${ach.unlocked?'1':'0.65'}'">
      <div class="ach-icon ${ach.unlocked?'unlocked':'locked'}" style="background:${ach.color};border:1px solid ${ach.border}">${ach.icon}</div>
      <div>
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc">${ach.desc}</div>
        ${badgeHtml}
        ${progressBar}
      </div>
    </div>`;
  }).join('');
}

function renderAchievementsLocal(){
  // fallback — just show locked state for all
  const container = document.getElementById('achievements-grid');
  if(container) container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);font-size:14px">Could not load achievements. Please check your connection and try again.</div>';
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

let _latestNotifications = [];

function timeAgoShort(dateStr){
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if(hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function fetchAndRenderNotifications(){
  const token = localStorage.getItem('medai_token');
  if(!token) return;
  try{
    const res = await fetch(`${API_BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if(!res.ok) return;
    const data = await res.json();
    _latestNotifications = data.notifications || [];
    renderNotifications(data.unreadCount || 0);
  }catch(e){ /* non-critical, retry on next interval */ }
}

function notificationIcon(type){
  return {
    message: '💬', appointment_request: '📅', appointment_accepted: '✅',
    appointment_declined: '❌', review_received: '⭐', doctor_approved: '🎉',
    doctor_rejected: 'ℹ️', payment_success: '👑'
  }[type] || '🔔';
}

function renderNotifications(unreadCount){
  const list=document.getElementById('notif-list');
  const dot=document.getElementById('notif-dot');
  const head=document.getElementById('notif-head-label');
  if(!list) return;

  if(localStorage.getItem('notifications_enabled') === 'false'){
    list.innerHTML='<div class="notif-item">Notifications are turned off.<div class="notif-time">Settings</div></div>';
    if(dot) dot.style.display='none';
    return;
  }

  const reminders=localStorage.getItem('medicine_notifications') === 'false' ? [] : getStored('reminders', []).filter(r=>r.status!=='Taken').slice(0,3);
  const reminderItems = reminders.map(r=>({text:`Medicine reminder due: ${r.name} at ${r.time || 'now'}`,time:'Reminder', isRead:true}));

  const realItems = _latestNotifications.map(n => ({
    id: n.id,
    text: `${notificationIcon(n.type)} ${n.title}${n.body ? ' — ' + n.body : ''}`,
    time: timeAgoShort(n.createdAt),
    link: n.link,
    isRead: n.isRead
  }));

  const items = [...realItems, ...reminderItems];

  if(head) head.textContent = unreadCount > 0 ? `Notifications (${unreadCount} new)` : 'Notifications';
  if(dot) dot.style.display = unreadCount > 0 ? 'block' : 'none';

  if(!items.length){
    list.innerHTML = '<div class="notif-item" style="color:var(--muted)">No notifications yet.</div>';
    return;
  }

  list.innerHTML = items.map(i => `
    <div class="notif-item" style="${i.isRead ? '' : 'background:rgba(0,212,255,0.06)'};cursor:${i.id ? 'pointer' : 'default'}" ${i.id ? `onclick="handleNotificationClick('${i.id}', ${JSON.stringify(i.link || '')})"` : ''}>
      ${escapeHtml(i.text)}
      <div class="notif-time">${escapeHtml(i.time)}</div>
    </div>
  `).join('');
}

async function handleNotificationClick(id, link){
  const token = localStorage.getItem('medai_token');
  if(token){
    fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
    }).then(() => fetchAndRenderNotifications()).catch(() => {});
  }

  if(!link) return;
  if(link.startsWith('messages:')){
    showTab('messages', null);
    await loadPatientConversations();
  } else if(['appointments','premium','profile','dashboard'].includes(link)){
    showTab(link, null);
  }
  toggleNotifications();
}

async function markAllNotificationsRead(){
  const token = localStorage.getItem('medai_token');
  if(!token) return;
  try{
    await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
    });
    await fetchAndRenderNotifications();
  }catch(e){ /* non-critical */ }
}

setInterval(fetchAndRenderNotifications, 20000);
fetchAndRenderNotifications();

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

async function upgradePremium() {
  const u = getCurrentUser();
  if(!u || !u.username){
    alert('No logged-in user detected. Please sign in and try again.');
    return;
  }
  if(u.plan === 'Premium'){
    alert('You already have Premium. Enjoy the benefits!');
    return;
  }
  const token = localStorage.getItem('medai_token');
  if(!token){
    alert('Please log in again to upgrade — your session may have expired.');
    return;
  }

  const planType = currentBilling === 'yearly' ? 'yearly' : 'monthly';
  // TEMP DIAGNOSTIC: run `localStorage.setItem('medai_force_usd_test','true')` in the console
  // to force USD (no currency conversion needed) — isolates whether the Bachs "get-quote"
  // DNS failure is specific to cross-currency checkouts or a broader sandbox issue.
  const testCountry = localStorage.getItem('medai_force_usd_test') === 'true' ? 'US' : currentCountry;
  const statusBox = document.getElementById('premium-status-msg');
  if(statusBox) statusBox.textContent = 'Starting checkout...';

  try{
    const initRes = await fetch(`${API_BASE_URL}/api/payments/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ country: testCountry, planType })
    });
    if(!initRes.ok){
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err.message || 'Could not start checkout.');
    }
    const initData = await initRes.json();

    if (initData.status === 'FAILED') {
      // A genuine failure (charge_status === 'failed') — show Bachs' real reason if given.
      if(statusBox) statusBox.innerHTML = `<strong style="color:var(--danger)">Payment failed.</strong> ${escapeHtmlChat(initData.message || '')}`;
      alert(initData.message || 'Payment failed. Please try again.');
      return;
    }

    if (initData.redirectUrl) {
      // Bachs uses a hosted checkout page — send the whole browser there, then
      // it redirects back to our success_url/cancel_url once the customer is done.
      window.location.href = initData.redirectUrl;
      return;
    }

    // status is PENDING (or SUCCESSFUL without a redirect) with no redirect URL yet —
    // this is not a failure, the checkout session just hasn't produced a redirect target
    // yet. Poll for the outcome instead of showing an error.
    if(statusBox) statusBox.textContent = 'Preparing your checkout...';
    pollPaymentStatus(initData.txRef);
  }catch(e){
    alert(e.message || 'Could not start checkout. Please try again.');
  }
}

// Handle returning from Bachs' hosted checkout (?payment=success&txRef=... or ?payment=cancelled)
(function handlePaymentReturn(){
  const params = new URLSearchParams(window.location.search);
  const paymentResult = params.get('payment');
  const txRef = params.get('txRef');

  if(paymentResult === 'success' && txRef){
    params.delete('payment');
    params.delete('txRef');
    const cleanUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, document.title, cleanUrl);
    document.addEventListener('DOMContentLoaded', () => {
      showTab('premium', null);
      pollPaymentStatus(txRef);
    });
  } else if(paymentResult === 'cancelled'){
    params.delete('payment');
    const cleanUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, document.title, cleanUrl);
    document.addEventListener('DOMContentLoaded', () => showTab('premium', null));
  }
})();

async function pollPaymentStatus(txRef, attempt = 0){
  const token = localStorage.getItem('medai_token');
  if(!token) return;

  const statusBox = document.getElementById('premium-status-msg');
  if(statusBox) statusBox.textContent = 'Confirming your payment...';

  try{
    const res = await fetch(`${API_BASE_URL}/api/payments/status/${txRef}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if(data.status === 'SUCCESSFUL'){
      const u = getCurrentUser();
      u.plan = data.plan;
      u.premiumExpiresAt = data.premiumExpiresAt;
      setCurrentUser(u);
      updatePremiumDisplay(u);
      if(statusBox) statusBox.innerHTML = '<strong style="color:var(--safe)">Premium activated! 🎉</strong>';
      alert('Payment confirmed — your account is now on Premium!');
      return;
    }
    if(data.status === 'FAILED'){
      if(statusBox) statusBox.innerHTML = '<strong style="color:var(--danger)">Payment failed.</strong> Please try again.';
      return;
    }
  }catch(e){ /* keep polling below on transient errors */ }

  if(attempt < 10){
    setTimeout(() => pollPaymentStatus(txRef, attempt + 1), 3000);
  }else if(statusBox){
    statusBox.innerHTML = '<strong style="color:var(--warning)">Still confirming...</strong> If this takes more than a couple minutes, contact support with your reference: ' + txRef;
  }
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
  const known = {
    ng:'NG', nigeria:'NG',
    us:'US', usa:'US', 'united states':'US', 'united states of america':'US', america:'US',
    gb:'GB', uk:'GB', 'united kingdom':'GB', england:'GB', britain:'GB',
    za:'ZA', 'south africa':'ZA',
    ca:'CA', canada:'CA',
    au:'AU', australia:'AU',
    ie:'IE', ireland:'IE',
    gh:'GH', ghana:'GH',
    ke:'KE', kenya:'KE',
    in:'IN', india:'IN',
    de:'DE', germany:'DE',
    fr:'FR', france:'FR'
  };
  if(known[v]) return known[v];
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

function renderTherapyDirectory(){
  const list = document.getElementById('therapy-directory-list');
  if(!list) return;
  const countryEl = document.getElementById('therapy-country');
  if(!countryEl.value) syncTherapyCountryFromProfile();
  const country = countryEl.value || 'NG';
  localStorage.setItem('medai_therapy_country', country);
  const all = therapyDirectory[country] || therapyDirectory.NG;

  list.innerHTML = all.map(item=>{
    const tags = item.specialties.map(s=>`<span class="badge badge-blue">${escapeHtml(s.toUpperCase())}</span>`).join('');
    return `<div class="glass-card therapy-card">
      <div class="therapy-card-head">
        <div><div class="therapy-name">${escapeHtml(item.name)}</div><div class="therapy-meta">${escapeHtml(item.city)} · ${escapeHtml(item.address)}</div></div>
        <span class="badge badge-green">${'★'.repeat(Math.round(item.rating))} ${item.rating}</span>
      </div>
      <div class="therapy-tags">${tags}</div>
      <div class="therapy-meta">${escapeHtml(item.notes)}</div>
      <div style="display:flex;gap:.65rem;flex-wrap:wrap;margin-top:auto">
        <a class="btn btn-outline" href="tel:${escapeHtml(item.phone)}" style="text-decoration:none">Call</a>
        <button class="btn btn-primary" onclick="selectTherapyProvider('${escapeHtml(item.name)}')">Use in Referral</button>
      </div>
    </div>`;
  }).join('');
}

// ---------- Real nearby search (OpenStreetMap Overpass API, via backend) ----------
let _therapyMap = null;

async function useMyLocationForTherapy(){
  const summary = document.getElementById('therapy-summary');
  if(!navigator.geolocation){
    if(summary) summary.textContent = 'Your browser does not support location access. Try searching a city instead.';
    return;
  }
  if(summary) summary.textContent = 'Requesting your location...';
  navigator.geolocation.getCurrentPosition(
    (pos) => searchNearbyTherapists(pos.coords.latitude, pos.coords.longitude, 'your location'),
    () => { if(summary) summary.textContent = 'Location access denied. Try searching a city instead.'; }
  );
}

async function geocodeAndSearchTherapy(){
  const query = document.getElementById('therapy-location-input')?.value.trim();
  const summary = document.getElementById('therapy-summary');
  if(!query){
    if(summary) summary.textContent = 'Please enter a city or address to search.';
    return;
  }
  if(summary) summary.textContent = `Locating "${query}"...`;
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    const results = await res.json();
    if(!results.length){
      if(summary) summary.textContent = `Could not find "${query}". Try a more specific search.`;
      return;
    }
    searchNearbyTherapists(parseFloat(results[0].lat), parseFloat(results[0].lon), results[0].display_name);
  }catch(e){
    if(summary) summary.textContent = 'Could not search that location. Check your connection and try again.';
  }
}

async function searchNearbyTherapists(lat, lng, label){
  const summary = document.getElementById('therapy-summary');
  const listEl = document.getElementById('therapy-list');
  const mapEl = document.getElementById('therapy-map');
  if(summary) summary.textContent = `Searching near ${label}...`;
  if(listEl) listEl.innerHTML = '';

  const token = localStorage.getItem('medai_token');
  try{
    const res = await fetch(`${API_BASE_URL}/api/therapy/search?lat=${lat}&lng=${lng}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await res.json();
    const results = data.results || [];

    if(data.degraded){
      if(summary) summary.textContent = 'The live search is temporarily unavailable — try again shortly, or check the trusted organizations list below.';
      return;
    }
    if(!results.length){
      if(summary) summary.textContent = `No listed therapists found near ${label}. Try a wider search or check the trusted organizations list below.`;
      if(mapEl) mapEl.style.display = 'none';
      return;
    }

    if(summary) summary.innerHTML = `<strong style="color:var(--accent)">${results.length}</strong> result${results.length===1?'':'s'} found near ${escapeHtml(label)}. This is live OpenStreetMap data — always verify details before visiting or calling.`;

    listEl.innerHTML = results.map(item => `
      <div class="glass-card therapy-card">
        <div class="therapy-card-head">
          <div><div class="therapy-name">${escapeHtml(item.name)}</div><div class="therapy-meta">${escapeHtml(item.address || 'Address not listed')}</div></div>
        </div>
        <div class="therapy-tags"><span class="badge badge-blue">${escapeHtml((item.type||'therapist').toUpperCase())}</span></div>
        <div style="display:flex;gap:.65rem;flex-wrap:wrap;margin-top:auto">
          ${item.phone ? `<a class="btn btn-outline" href="tel:${escapeHtml(item.phone)}" style="text-decoration:none">Call</a>` : ''}
          ${item.website ? `<a class="btn btn-outline" href="${escapeHtml(item.website)}" target="_blank" rel="noopener" style="text-decoration:none">Website</a>` : ''}
          <button class="btn btn-primary" onclick="selectTherapyProvider('${escapeHtml(item.name)}')">Use in Referral</button>
        </div>
      </div>
    `).join('');

    await renderTherapyResultsMap(results, lat, lng);
  }catch(e){
    if(summary) summary.textContent = 'Could not complete the search. Check your connection and try again.';
  }
}

async function renderTherapyResultsMap(results, centerLat, centerLng){
  const mapEl = document.getElementById('therapy-map');
  if(!mapEl) return;
  mapEl.style.display = 'flex';
  mapEl.style.alignItems = 'center';
  mapEl.style.justifyContent = 'center';

  try{
    await loadLeaflet();
  }catch(e){
    mapEl.textContent = 'Map could not be loaded — check your connection and try again.';
    return;
  }

  mapEl.innerHTML = '';
  mapEl.style.display = 'block';
  if(_therapyMap){ _therapyMap.remove(); _therapyMap = null; }
  _therapyMap = L.map(mapEl).setView([centerLat, centerLng], 12);
  addOsmTileLayer(_therapyMap);

  const bounds = [[centerLat, centerLng]];
  L.circleMarker([centerLat, centerLng], { radius: 7, color: '#00d4ff', fillColor: '#00d4ff', fillOpacity: 0.8 })
    .addTo(_therapyMap).bindPopup('Your search location');

  results.forEach(item => {
    const marker = L.marker([item.lat, item.lng]).addTo(_therapyMap);
    marker.bindPopup(`<strong>${escapeHtml(item.name)}</strong>${item.address ? '<br>' + escapeHtml(item.address) : ''}`);
    bounds.push([item.lat, item.lng]);
  });
  _therapyMap.fitBounds(bounds, { padding: [30,30] });
  setTimeout(() => _therapyMap.invalidateSize(), 50);
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

// ============================================================
// GLOBAL EMERGENCY CONTACTS DIRECTORY (standalone tab)
// General emergency numbers are highly stable/well-documented for every entry.
// A specific crisis line is only included where independently verified —
// otherwise the general number is the single, safe recommendation.
// ============================================================
const GLOBAL_EMERGENCY_DIRECTORY = [
  { code:'NG', flag:'🇳🇬', name:'Nigeria', general:'112', crisis:{ label:'SURPIN Crisis Line', phone:'09080217555' } },
  { code:'US', flag:'🇺🇸', name:'United States', general:'911', crisis:{ label:'988 Lifeline', phone:'988' } },
  { code:'GB', flag:'🇬🇧', name:'United Kingdom', general:'999', crisis:{ label:'Samaritans', phone:'116123' } },
  { code:'ZA', flag:'🇿🇦', name:'South Africa', general:'112', crisis:{ label:'SADAG Crisis Line', phone:'0800567567' } },
  { code:'CA', flag:'🇨🇦', name:'Canada', general:'911', crisis:{ label:'988 Lifeline', phone:'988' } },
  { code:'AU', flag:'🇦🇺', name:'Australia', general:'000', crisis:{ label:'Lifeline', phone:'131114' } },
  { code:'IE', flag:'🇮🇪', name:'Ireland', general:'112', crisis:{ label:'Samaritans', phone:'116123' } },
  { code:'GH', flag:'🇬🇭', name:'Ghana', general:'999', crisis:{ label:'Mental Health Lifeline', phone:'233244471279' } },
  { code:'KE', flag:'🇰🇪', name:'Kenya', general:'999', crisis:{ label:'Befrienders Kenya', phone:'254722178177' } },
  { code:'IN', flag:'🇮🇳', name:'India', general:'112', crisis:{ label:'KIRAN Helpline', phone:'18005990019' } },
  { code:'DE', flag:'🇩🇪', name:'Germany', general:'112', crisis:{ label:'Telefonseelsorge', phone:'08001110111' } },
  { code:'FR', flag:'🇫🇷', name:'France', general:'112', crisis:{ label:'3114 (national line)', phone:'3114' } },
  { code:'AR', flag:'🇦🇷', name:'Argentina', general:'911' },
  { code:'AM', flag:'🇦🇲', name:'Armenia', general:'112' },
  { code:'BH', flag:'🇧🇭', name:'Bahrain', general:'999' },
  { code:'BD', flag:'🇧🇩', name:'Bangladesh', general:'999' },
  { code:'BE', flag:'🇧🇪', name:'Belgium', general:'112' },
  { code:'BR', flag:'🇧🇷', name:'Brazil', general:'192' },
  { code:'CL', flag:'🇨🇱', name:'Chile', general:'131' },
  { code:'CN', flag:'🇨🇳', name:'China', general:'120' },
  { code:'CO', flag:'🇨🇴', name:'Colombia', general:'123' },
  { code:'EG', flag:'🇪🇬', name:'Egypt', general:'123' },
  { code:'ID', flag:'🇮🇩', name:'Indonesia', general:'112' },
  { code:'IL', flag:'🇮🇱', name:'Israel', general:'101' },
  { code:'IT', flag:'🇮🇹', name:'Italy', general:'112' },
  { code:'JP', flag:'🇯🇵', name:'Japan', general:'119' },
  { code:'MY', flag:'🇲🇾', name:'Malaysia', general:'999' },
  { code:'MX', flag:'🇲🇽', name:'Mexico', general:'911' },
  { code:'NL', flag:'🇳🇱', name:'Netherlands', general:'112' },
  { code:'NZ', flag:'🇳🇿', name:'New Zealand', general:'111' },
  { code:'PK', flag:'🇵🇰', name:'Pakistan', general:'1122' },
  { code:'PH', flag:'🇵🇭', name:'Philippines', general:'911' },
  { code:'PL', flag:'🇵🇱', name:'Poland', general:'112' },
  { code:'PT', flag:'🇵🇹', name:'Portugal', general:'112' },
  { code:'QA', flag:'🇶🇦', name:'Qatar', general:'999' },
  { code:'RU', flag:'🇷🇺', name:'Russia', general:'112' },
  { code:'RW', flag:'🇷🇼', name:'Rwanda', general:'112' },
  { code:'SA', flag:'🇸🇦', name:'Saudi Arabia', general:'997' },
  { code:'SG', flag:'🇸🇬', name:'Singapore', general:'995' },
  { code:'KR', flag:'🇰🇷', name:'South Korea', general:'119' },
  { code:'ES', flag:'🇪🇸', name:'Spain', general:'112' },
  { code:'SE', flag:'🇸🇪', name:'Sweden', general:'112' },
  { code:'CH', flag:'🇨🇭', name:'Switzerland', general:'144' },
  { code:'TZ', flag:'🇹🇿', name:'Tanzania', general:'112' },
  { code:'TH', flag:'🇹🇭', name:'Thailand', general:'1669' },
  { code:'TR', flag:'🇹🇷', name:'Turkey', general:'112' },
  { code:'UG', flag:'🇺🇬', name:'Uganda', general:'999' },
  { code:'AE', flag:'🇦🇪', name:'United Arab Emirates', general:'998' },
  { code:'VN', flag:'🇻🇳', name:'Vietnam', general:'115' },
  { code:'ZW', flag:'🇿🇼', name:'Zimbabwe', general:'999' }
];

function renderEmergencyDirectory(){
  const grid = document.getElementById('emergency-directory-grid');
  if(!grid) return;
  const query = (document.getElementById('emergency-directory-search')?.value || '').trim().toLowerCase();
  const list = query
    ? GLOBAL_EMERGENCY_DIRECTORY.filter(c => c.name.toLowerCase().includes(query))
    : GLOBAL_EMERGENCY_DIRECTORY;

  if(!list.length){
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:2rem 0;font-size:13px">No country matches your search.</div>';
    return;
  }

  grid.innerHTML = list.map(c => `
    <div class="glass-card" style="padding:1.1rem">
      <div style="font-size:14px;font-weight:700;margin-bottom:.6rem">${c.flag} ${escapeHtml(c.name)}</div>
      <a href="tel:${c.general}" class="btn btn-danger" style="justify-content:center;padding:10px;font-size:11px;text-decoration:none;margin-bottom:${c.crisis ? '8px' : '0'}">🚑 Emergency: ${c.general}</a>
      ${c.crisis ? `<a href="tel:${c.crisis.phone}" class="btn btn-outline" style="justify-content:center;padding:10px;font-size:11px;text-decoration:none;color:var(--warning);border-color:rgba(255,170,51,0.3)">🧠 ${escapeHtml(c.crisis.label)}</a>` : ''}
    </div>
  `).join('');
}

const PANIC_HOTLINES = {
  NG: [{label:'Emergency 112', phone:'112'}, {label:'SURPIN Crisis Line', phone:'09080217555'}],
  US: [{label:'Emergency 911', phone:'911'}, {label:'988 Lifeline', phone:'988'}],
  GB: [{label:'Emergency 999', phone:'999'}, {label:'Samaritans', phone:'116123'}],
  ZA: [{label:'Emergency 112', phone:'112'}, {label:'SADAG Crisis Line', phone:'0800567567'}],
  CA: [{label:'Emergency 911', phone:'911'}, {label:'988 Lifeline', phone:'988'}],
  AU: [{label:'Emergency 000', phone:'000'}, {label:'Lifeline', phone:'131114'}],
  IE: [{label:'Emergency 112', phone:'112'}, {label:'Samaritans', phone:'116123'}],
  GH: [{label:'Emergency 999', phone:'999'}, {label:'Mental Health Lifeline', phone:'233244471279'}],
  KE: [{label:'Emergency 999', phone:'999'}, {label:'Befrienders Kenya', phone:'254722178177'}],
  IN: [{label:'Emergency 112', phone:'112'}, {label:'KIRAN Helpline', phone:'18005990019'}],
  DE: [{label:'Emergency 112', phone:'112'}, {label:'Telefonseelsorge', phone:'08001110111'}],
  FR: [{label:'Emergency 112', phone:'112'}, {label:'Numéro National (3114)', phone:'3114'}]
};

function updatePanicHotlines(){
  const select = document.getElementById('panic-country');
  if(select) localStorage.setItem('medai_panic_country', select.value);
  renderPanicDials();
}

function renderPanicDials(){
  const box = document.getElementById('panic-dials');
  if(!box) return;
  const u = getCurrentUser();
  const select = document.getElementById('panic-country');
  const country = normalizeCountryCode(
    localStorage.getItem('medai_panic_country') || u.country || localStorage.getItem('medai_country') || 'NG'
  );
  if(select && PANIC_HOTLINES[country]) select.value = country;

  const entries = [...(PANIC_HOTLINES[country] || PANIC_HOTLINES.NG)];
  if(u.emergPhone) entries.unshift({label:u.emergName ? `Call ${u.emergName}` : 'Emergency Contact', phone:u.emergPhone});
  box.innerHTML = entries.slice(0,4).map(item=>`<a href="tel:${escapeHtml(item.phone)}" class="btn ${item.label.includes('Emergency') || item.label.includes('Call')?'btn-danger':'btn-outline'}" style="justify-content:center;padding:12px;font-size:10px;text-decoration:none">${escapeHtml(item.label)}</a>`).join('');
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
  renderTherapyDirectory();
}, 200);

setTimeout(initPricing, 100);

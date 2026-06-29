(function(){
  if (window.__medaiTransitionReady) return;
  window.__medaiTransitionReady = true;

  const css = `
    .medai-page-loader{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(3,11,20,.92);backdrop-filter:blur(18px);opacity:0;pointer-events:none;transition:opacity .28s ease}
    .medai-page-loader.show{opacity:1;pointer-events:auto}
    .medai-loader-card{width:min(320px,calc(100vw - 40px));border:1px solid rgba(0,212,255,.2);border-radius:18px;background:rgba(10,24,40,.82);box-shadow:0 30px 80px rgba(0,0,0,.45),0 0 40px rgba(0,212,255,.12);padding:26px;text-align:center;overflow:hidden;position:relative}
    .medai-loader-card:before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent,rgba(0,212,255,.08),transparent);transform:translateX(-100%);animation:medaiSweep 1.4s infinite}
    .medai-pulse-ring{width:92px;height:92px;margin:0 auto 18px;border-radius:50%;border:1px solid rgba(0,212,255,.18);display:flex;align-items:center;justify-content:center;position:relative}
    .medai-pulse-ring:before,.medai-pulse-ring:after{content:"";position:absolute;inset:8px;border-radius:50%;border:1px solid rgba(0,255,136,.22);animation:medaiPulse 1.6s infinite}
    .medai-pulse-ring:after{inset:-8px;border-color:rgba(0,212,255,.18);animation-delay:.35s}
    .medai-loader-dot{width:18px;height:18px;border-radius:50%;background:#00d4ff;box-shadow:0 0 28px #00d4ff,0 0 60px rgba(0,255,136,.5);animation:medaiBeat .9s infinite}
    .medai-loader-title{font-family:Syne,Arial,sans-serif;font-weight:800;color:#e2f4ff;font-size:17px;letter-spacing:.5px;margin-bottom:6px}
    .medai-loader-sub{font-family:"Share Tech Mono",monospace;color:rgba(180,220,255,.55);font-size:10px;letter-spacing:2px;text-transform:uppercase}
    @keyframes medaiBeat{0%,100%{transform:scale(1)}35%{transform:scale(1.45)}55%{transform:scale(.9)}}
    @keyframes medaiPulse{0%{transform:scale(.75);opacity:.9}100%{transform:scale(1.45);opacity:0}}
    @keyframes medaiSweep{to{transform:translateX(100%)}}
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const loader = document.createElement('div');
  loader.className = 'medai-page-loader';
  loader.innerHTML = '<div class="medai-loader-card"><div class="medai-pulse-ring"><div class="medai-loader-dot"></div></div><div class="medai-loader-title">MedAI is loading</div><div class="medai-loader-sub">Preparing your health workspace</div></div>';
  document.addEventListener('DOMContentLoaded', function(){
    document.body.appendChild(loader);
    requestAnimationFrame(function(){ loader.classList.remove('show'); });
  });

  window.medaiShowLoader = function(text){
    const title = loader.querySelector('.medai-loader-title');
    if (title && text) title.textContent = text;
    loader.classList.add('show');
  };

  document.addEventListener('click', function(e){
    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:') || link.target === '_blank') return;
    if (link.download) return;
    e.preventDefault();
    window.medaiShowLoader('Opening page');
    setTimeout(function(){ window.location.href = href; }, 420);
  }, true);

  window.addEventListener('pagehide', function(){ loader.classList.add('show'); });
})();

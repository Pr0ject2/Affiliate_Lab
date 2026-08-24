
/* TrafficLab core UI.
   Critical navigation lives here so a failure in optional modules does not disable the site. */
(function(){
  'use strict';

  function safeStorageGet(key){
    try { return localStorage.getItem(key); } catch(e) { return null; }
  }
  function safeStorageSet(key,value){
    try { localStorage.setItem(key,value); } catch(e) {}
  }

  /* Audience mode is a site-wide preference and must work independently. */
  const MODE_KEY='al-user-mode-v1';
  function applyMode(mode,emit){
    mode = mode === 'pro' ? 'pro' : 'beginner';
    document.body.classList.toggle('mode-pro',mode==='pro');
    document.body.classList.toggle('mode-beginner',mode!=='pro');
    document.body.dataset.audienceMode=mode;
    document.querySelectorAll('[data-user-mode]').forEach(function(btn){
      btn.setAttribute('aria-pressed',btn.dataset.userMode===mode?'true':'false');
    });
    document.querySelectorAll('[data-mode-summary]').forEach(function(label){
      label.textContent=mode==='pro'?'Аналитика и рабочие задачи':'Пошагово с нуля';
    });
    if(emit){
      document.dispatchEvent(new CustomEvent('al:modechange',{detail:{mode:mode}}));
      if(window.alTrack) window.alTrack('audience_mode_change',{mode:mode});
    }
  }
  const initialMode=safeStorageGet(MODE_KEY)==='pro'?'pro':'beginner';
  applyMode(initialMode,false);
  document.addEventListener('click',function(e){
    const btn=e.target.closest('[data-user-mode]');
    if(!btn)return;
    const mode=btn.dataset.userMode==='pro'?'pro':'beginner';
    safeStorageSet(MODE_KEY,mode);
    applyMode(mode,true);
  });

  /* Term hints are independent from the audience mode. */
  const HINTS_KEY='al-term-hints-v1';
  function applyHints(enabled,emit){
    document.body.classList.toggle('hints-off',!enabled);
    document.body.dataset.termHints=enabled?'on':'off';
    document.querySelectorAll('[data-hints-toggle]').forEach(function(btn){
      btn.setAttribute('aria-pressed',enabled?'true':'false');
      btn.setAttribute('aria-label',enabled?'Отключить подсказки к терминам':'Включить подсказки к терминам');
      const state=btn.querySelector('[data-hints-state]');
      if(state)state.textContent=enabled?'Вкл.':'Выкл.';
    });
    document.querySelectorAll('.term-help').forEach(function(btn){
      btn.disabled=!enabled;
      btn.setAttribute('aria-disabled',enabled?'false':'true');
      btn.tabIndex=enabled?0:-1;
    });
    if(emit)document.dispatchEvent(new CustomEvent('al:hintschange',{detail:{enabled:enabled}}));
  }
  const initialHints=safeStorageGet(HINTS_KEY)!=='off';
  applyHints(initialHints,false);
  document.addEventListener('click',function(e){
    const btn=e.target.closest('[data-hints-toggle]');
    if(!btn)return;
    const enabled=btn.getAttribute('aria-pressed')!=='true';
    safeStorageSet(HINTS_KEY,enabled?'on':'off');
    applyHints(enabled,true);
  });

  /* First-visit entry links also set the global mode before navigation. */
  document.addEventListener('click',function(e){
    const entry=e.target.closest('[data-entry-mode]');
    if(!entry)return;
    const mode=entry.dataset.entryMode==='pro'?'pro':'beginner';
    safeStorageSet(MODE_KEY,mode);
    applyMode(mode,true);
    if(window.alTrack) window.alTrack('entry_mode',{mode:mode,href:entry.getAttribute('href')||''});
  });

  /* Mobile menu is critical navigation, so it does not depend on the knowledge-base script. */
  function initMobileNav(){
    const header=document.querySelector('.site-header .header-inner, .site-header .ref-topbar') || document.querySelector('.site-header');
    const sidebar=document.querySelector('.global-sidebar');
    if(!header||!sidebar)return;
    let btn=header.querySelector('.mobile-nav-toggle');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='mobile-nav-toggle';
      btn.innerHTML='<span class="mobile-nav-icon" aria-hidden="true"><i></i><i></i><i></i></span><span>Меню</span>';
      header.appendChild(btn);
    }
    if(btn.dataset.mobileNavReady==='true')return;
    btn.dataset.mobileNavReady='true';
    btn.setAttribute('aria-expanded','false');
    sidebar.id=sidebar.id||'library-navigation';
    btn.setAttribute('aria-controls',sidebar.id);
    btn.setAttribute('aria-label','Открыть меню библиотеки');

    let overlay=document.querySelector('.mobile-nav-overlay');
    if(!overlay){
      overlay=document.createElement('button');
      overlay.type='button';
      overlay.className='mobile-nav-overlay';
      overlay.setAttribute('aria-label','Закрыть меню');
      document.body.appendChild(overlay);
    }

    function syncButtons(expanded){
      document.querySelectorAll('.site-header .mobile-nav-toggle').forEach(function(button){
        button.setAttribute('aria-expanded',expanded?'true':'false');
        button.setAttribute('aria-label',expanded?'Закрыть меню библиотеки':'Открыть меню библиотеки');
      });
    }
    function close(returnFocus){
      document.body.classList.remove('mobile-nav-open');
      syncButtons(false);
      const currentBtn=document.querySelector('.site-header .mobile-nav-toggle')||btn;
      if(returnFocus && currentBtn && currentBtn.isConnected)currentBtn.focus();
    }
    function open(){
      document.body.classList.add('mobile-nav-open');
      syncButtons(true);
      const firstLink=sidebar.querySelector('a,input,button');
      if(firstLink)firstLink.focus();
    }
    btn.addEventListener('click',function(){
      document.body.classList.contains('mobile-nav-open')?close(true):open();
    });
    overlay.addEventListener('click',function(){close(true)});
    sidebar.addEventListener('click',function(e){
      if(e.target.closest('a'))close(false);
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&document.body.classList.contains('mobile-nav-open'))close(true);
    });
    const mobileQuery=window.matchMedia('(max-width:900px)');
    function closeOnDesktop(e){if(!e.matches)close(false)}
    if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',closeOnDesktop);
    else if(mobileQuery.addListener)mobileQuery.addListener(closeOnDesktop);
  }
  window.ITAInitMobileNav=initMobileNav;
  window.ITASetAudienceMode=function(mode,emit){
    mode=mode==='pro'?'pro':'beginner';
    safeStorageSet(MODE_KEY,mode);
    applyMode(mode,emit!==false);
  };
  initMobileNav();

  /* Homepage search has a native fallback form after v38, this handles old markup too. */
  const siteSearch=document.getElementById('siteSearch');
  const searchButton=document.getElementById('searchButton');
  if(siteSearch&&searchButton){
    function go(event){
      if(event)event.preventDefault();
      const q=siteSearch.value.trim();
      location.href='/Affiliate_Lab/guides/'+(q?'?q='+encodeURIComponent(q):'');
    }
    const form=siteSearch.closest('form');
    if(form)form.addEventListener('submit',go);
    else searchButton.addEventListener('click',go);
  }
})();


/* Launch analytics adapter. It only writes to dataLayer; no external service is connected here. */
window.dataLayer=window.dataLayer||[];
window.alTrack=function(name,data){
  try{window.dataLayer.push(Object.assign({event:'al_'+name,path:location.pathname},data||{}));}catch(e){}
};

/* Whole-card mouse navigation; the visible HTML link remains the keyboard/fallback path. */
(function(){
  'use strict';
  const interactive='a,button,input,select,textarea,label,summary,[contenteditable="true"]';
  document.addEventListener('click',function(e){
    const card=e.target.closest('[data-card-link]');
    if(!card || e.target.closest(interactive)) return;
    const url=card.dataset.cardLink;
    if(url) location.href=url;
  });
})();


/* v83: keyboard support for clickable service cards */
(function(){
  'use strict';
  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter' && e.key!==' ') return;
    const card=e.target.closest('.service-tool[data-card-link]');
    if(!card || e.target.closest('a,button,input,select,textarea')) return;
    e.preventDefault();
    const url=card.dataset.cardLink;
    if(url) location.href=url;
  });
})();

/* v244 — mobile navigation recovery layer.
   The top bar is rebuilt by app.js after core.js has already loaded. Rebind
   navigation when that happens and provide a click fallback in case a cached
   shell replaced the original button without its listener. */
(()=>{
  const isMobile=()=>window.matchMedia('(max-width:900px)').matches;
  const sync=(open)=>{
    document.body.classList.toggle('mobile-nav-open',open);
    document.querySelectorAll('.site-header .mobile-nav-toggle').forEach(btn=>{
      btn.setAttribute('aria-expanded',open?'true':'false');
      btn.setAttribute('aria-label',open?'Закрыть меню библиотеки':'Открыть меню библиотеки');
    });
  };

  /* Capture the state before the button's own handler runs. If nothing has
     changed by the end of the click, the fallback performs the toggle. */
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.site-header .mobile-nav-toggle');
    if(!btn || !isMobile()) return;
    const before=document.body.classList.contains('mobile-nav-open');
    setTimeout(()=>{
      const after=document.body.classList.contains('mobile-nav-open');
      if(after===before) sync(!before);
    },0);
  },true);

  document.addEventListener('click',e=>{
    if(!e.target.closest('.mobile-nav-overlay') || !isMobile()) return;
    setTimeout(()=>{
      if(document.body.classList.contains('mobile-nav-open')) sync(false);
    },0);
  },true);

  const rebind=()=>{
    if(typeof window.ITAInitMobileNav==='function') window.ITAInitMobileNav();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',rebind,{once:true});
  else rebind();
  window.addEventListener('load',rebind,{once:true});

  const header=document.querySelector('.site-header');
  if(header && 'MutationObserver' in window){
    new MutationObserver(()=>rebind()).observe(header,{childList:true,subtree:true});
  }
})();


/* v272 — independent adaptive site-progress engine.
   Runs in core.js so optional article UI errors cannot stop progress tracking. */
(function(){
  'use strict';
  const KEY='ita-site-progress-v3';
  const LEGACY=['ita-site-progress-v2','ita-site-progress-v1'];
  const FALLBACK=["/Affiliate_Lab/guides/1win-rules/", "/Affiliate_Lab/guides/adsbridge-campaign/", "/Affiliate_Lab/guides/affiliate-manager/", "/Affiliate_Lab/guides/affiliate-marketing/", "/Affiliate_Lab/guides/choose-program/", "/Affiliate_Lab/guides/choose-traffic-source/", "/Affiliate_Lab/guides/clicks-no-registrations/", "/Affiliate_Lab/guides/community-traffic/", "/Affiliate_Lab/guides/content-sites/", "/Affiliate_Lab/guides/cpa-vs-revshare/", "/Affiliate_Lab/guides/first-ftd/", "/Affiliate_Lab/guides/free-traffic/", "/Affiliate_Lab/guides/ftd/", "/Affiliate_Lab/guides/geo/", "/Affiliate_Lab/guides/ggr-ngr/", "/Affiliate_Lab/guides/landing-page/", "/Affiliate_Lab/guides/launch-checklist/", "/Affiliate_Lab/guides/metrics/", "/Affiliate_Lab/guides/nigeria-ad-guidelines/", "/Affiliate_Lab/guides/offer/", "/Affiliate_Lab/guides/paid-traffic/", "/Affiliate_Lab/guides/partner-dashboard/", "/Affiliate_Lab/guides/registrations-no-ftd/", "/Affiliate_Lab/guides/revshare/", "/Affiliate_Lab/guides/search-traffic/", "/Affiliate_Lab/guides/social-traffic/", "/Affiliate_Lab/guides/statistics-mismatch/", "/Affiliate_Lab/guides/statistics/", "/Affiliate_Lab/guides/stream-traffic/", "/Affiliate_Lab/guides/tracker-for-beginner/", "/Affiliate_Lab/guides/tracking/", "/Affiliate_Lab/guides/traffic-quality/", "/Affiliate_Lab/guides/video-traffic/", "/Affiliate_Lab/traffic/sources/alt-video/", "/Affiliate_Lab/traffic/sources/communities/", "/Affiliate_Lab/traffic/sources/content-site/", "/Affiliate_Lab/traffic/sources/dzen/", "/Affiliate_Lab/traffic/sources/mailing/", "/Affiliate_Lab/traffic/sources/paid/", "/Affiliate_Lab/traffic/sources/reddit/", "/Affiliate_Lab/traffic/sources/search/", "/Affiliate_Lab/traffic/sources/short-video/", "/Affiliate_Lab/traffic/sources/social/", "/Affiliate_Lab/traffic/sources/streams/", "/Affiliate_Lab/traffic/sources/telegram/", "/Affiliate_Lab/traffic/sources/vk-video/", "/Affiliate_Lab/traffic/sources/x-twitter/", "/Affiliate_Lab/traffic/sources/youtube/"];
  let catalog=FALLBACK.slice();
  const visited=new Set();

  function normalize(value){
    try{
      const u=new URL(value||location.pathname,location.href);
      let p=u.pathname.replace(/index\.html$/,'');
      if(!p.endsWith('/'))p+='/';
      return p;
    }catch(e){return String(value||'')}
  }
  function isArticle(value){
    const p=normalize(value);
    return (p.startsWith('/Affiliate_Lab/guides/')&&p!=='/Affiliate_Lab/guides/') ||
           p.startsWith('/Affiliate_Lab/traffic/sources/');
  }
  function parseArray(key){
    try{
      const value=JSON.parse(localStorage.getItem(key)||'[]');
      return Array.isArray(value)?value:[];
    }catch(e){return []}
  }
  function absorb(){
    [KEY].concat(LEGACY).forEach(function(key){
      parseArray(key).forEach(function(value){const p=normalize(value);if(isArticle(p))visited.add(p)});
    });
    try{
      const states=JSON.parse(localStorage.getItem('al-reading-state-v1')||'{}')||{};
      Object.keys(states).forEach(function(value){const p=normalize(value);if(isArticle(p))visited.add(p)});
    }catch(e){}
    try{
      const recent=JSON.parse(localStorage.getItem('al-recent-v1')||'[]')||[];
      recent.forEach(function(item){if(item&&item.url){const p=normalize(item.url);if(isArticle(p))visited.add(p)}});
    }catch(e){}
    const current=normalize(location.pathname);
    if(isArticle(current))visited.add(current);
    try{localStorage.setItem(KEY,JSON.stringify(Array.from(visited)))}catch(e){}
  }
  function validVisited(){
    const set=new Set(catalog.map(normalize));
    return Array.from(visited).filter(function(p){return set.has(normalize(p))});
  }
  function render(){
    absorb();
    const total=Math.max(1,catalog.length);
    const opened=validVisited().length;
    const pct=Math.max(0,Math.min(100,Math.round(opened/total*100)));
    document.querySelectorAll('[data-ref-progress-value]').forEach(function(el){el.textContent=pct+'%'});
    document.querySelectorAll('[data-ref-progress-bar]').forEach(function(el){
      el.style.width=pct+'%';
      el.setAttribute('aria-valuemin','0');
      el.setAttribute('aria-valuemax','100');
      el.setAttribute('aria-valuenow',String(pct));
    });
    document.querySelectorAll('.ref-top-progress').forEach(function(el){
      const label='Открыто '+opened+' из '+total+' материалов TrafficLab';
      el.title=label; el.setAttribute('aria-label',label);
    });
    return {opened:opened,total:total,pct:pct};
  }
  function basePath(){
    const link=document.querySelector('link[href*="/assets/site.css"]');
    if(link){
      try{const p=new URL(link.href,location.href).pathname;return p.replace(/assets\/site\.css.*$/,'')}catch(e){}
    }
    return '/Affiliate_Lab/';
  }
  async function discover(){
    try{
      const response=await fetch(basePath()+'sitemap.xml',{cache:'no-store'});
      if(!response.ok)throw new Error('sitemap '+response.status);
      const text=await response.text();
      const xml=new DOMParser().parseFromString(text,'application/xml');
      const fresh=Array.from(xml.querySelectorAll('url > loc')).map(function(n){return normalize(n.textContent||'')}).filter(isArticle);
      if(fresh.length)catalog=Array.from(new Set(fresh));
    }catch(e){
      catalog=FALLBACK.slice();
    }
    render();
  }

  window.ITARefreshSiteProgress=render;
  window.ITASiteProgress={refresh:render,discover:discover,get:function(){return render()}};

  absorb();
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){render();discover()},{once:true});
  }else{render();discover()}
  window.addEventListener('pageshow',render);
  window.addEventListener('storage',function(e){
    if([KEY].concat(LEGACY,['al-reading-state-v1','al-recent-v1']).includes(e.key))render();
  });

  // app.js rebuilds the topbar after core.js. Repaint as soon as progress nodes appear.
  if('MutationObserver' in window){
    const observer=new MutationObserver(function(mutations){
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType===1 && (node.matches?.('.ref-top-progress,[data-ref-progress-value],[data-ref-progress-bar]') || node.querySelector?.('.ref-top-progress,[data-ref-progress-value],[data-ref-progress-bar]'))){
            render(); return;
          }
        }
      }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
})();

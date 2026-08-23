
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
      label.textContent=mode==='pro'?'Рабочие задачи и аналитика':'Маршрут с нуля';
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

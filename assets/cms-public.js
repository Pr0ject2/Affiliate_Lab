(function(){
'use strict';
const BASE='/';
const j=(u)=>fetch(u,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeInternalHref(value,fallback=BASE){try{const raw=String(value||'').trim();if(raw.startsWith('#'))return raw;const u=new URL(raw,location.origin);if(u.origin!==location.origin||!u.pathname.startsWith(BASE))return fallback;return u.pathname+u.search+u.hash}catch{return fallback}}
function currentPath(){let p=location.pathname;return p.endsWith('/')?p:p+'/'}
function renderNav(data){
  const sidebar=document.querySelector('.global-sidebar'); if(!sidebar||!data?.groups)return;
  const path=currentPath();
  const refHost=sidebar.querySelector(':scope > .ref-sidebar-groups');

  /* Reference UI already owns the sidebar shell. Update that existing menu
     from the CMS data instead of appending a second legacy navigation below it. */
  if(refHost){
    const iconMap={
      start:'compass',traffic:'route',compare:'scaling',practice:'book-open',
      services:'package-2',analytics:'line-chart',diagnostics:'circle-alert',tools:'calculator',
      library:'layout-template',basics:'map',glossary:'whole-word',notes:'pen-square',history:'history'
    };
    const iconMarkup=(id)=>`<svg class="ref-nav-icon-img" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true" focusable="false"><use href="${BASE}assets/icons/nav.svg?v=20260826-3821#${iconMap[id]||'layout-template'}"></use></svg>`;
    const items=[];
    (data.groups||[]).forEach(g=>(g.items||[]).forEach(it=>items.push(it)));
    const activeHref=items.map(it=>it.href||'#').filter(h=>{
      const hp=currentPathFromHref(h); return path===hp || (hp!==BASE && path.startsWith(hp));
    }).sort((a,b)=>String(b).length-String(a).length)[0]||'';

    refHost.innerHTML=(data.groups||[]).map((g,gi)=>{
      const links=(g.items||[]).map(it=>{
        const href=safeInternalHref(it.href||'#','#'); const isActive=href===activeHref;
        const cleanTitle=String(it.title||'Пункт').replace(/^↺\s*/,'');
        return `<a href="${esc(href)}" class="${isActive?'is-active':''}"${isActive?' aria-current="page"':''}><span class="ref-nav-icon">${iconMarkup(it.id||'custom')}</span><span>${esc(cleanTitle)}</span></a>`;
      }).join('');
      const hasActive=(g.items||[]).some(it=>(it.href||'#')===activeHref);
      return `<section class="ref-nav-group is-open${hasActive?' has-active':''}" data-ref-group="${esc(g.id||String(gi))}"><button class="ref-nav-heading" type="button" aria-expanded="true"><span>${esc(String(g.title||'Раздел').toUpperCase())}</span><i>⌄</i></button><nav>${links}</nav></section>`;
    }).join('');

    refHost.querySelectorAll('.ref-nav-heading').forEach(btn=>btn.addEventListener('click',()=>{
      const group=btn.closest('.ref-nav-group'); const next=!group.classList.contains('is-open');
      group.classList.toggle('is-open',next); btn.setAttribute('aria-expanded',next?'true':'false');
    }));
    return;
  }

  /* Legacy fallback for pages where the reference shell is not present. */
  sidebar.querySelectorAll(':scope > .sidebar-group').forEach(x=>x.remove());
  const anchor=sidebar.querySelector(':scope > .sidebar-mode-compact, :scope > .sidebar-partner-cta, :scope > .sidebar-bottom');
  data.groups.forEach((g,gi)=>{
    const box=document.createElement('div'); box.className='sidebar-group'; box.dataset.sidebarGroup=g.id||String(gi);
    const title=document.createElement('p'); title.className='sidebar-group-title'; title.textContent=g.title||'Раздел'; box.appendChild(title);
    const nav=document.createElement('nav'); nav.className='sidebar-menu'; nav.setAttribute('aria-label',g.title||'Раздел');
    (g.items||[]).forEach(it=>{
      const a=document.createElement('a'); a.href=safeInternalHref(it.href||'#','#'); a.dataset.nav=it.id||'custom'; a.dataset.cmsIcon=it.icon||'•'; a.classList.add('cms-nav-item');
      if(currentPathFromHref(a.href)===path){a.classList.add('active');a.setAttribute('aria-current','page')}
      const span=document.createElement('span');span.textContent=String(it.title||'Пункт').replace(/^↺\s*/,'');a.appendChild(span);nav.appendChild(a);
    });
    box.appendChild(nav); sidebar.insertBefore(box,anchor||null); decorateGroup(box,gi);
  });
}
function currentPathFromHref(href){const safe=safeInternalHref(href,'');if(!safe)return '';try{let p=new URL(safe,location.href).pathname;return p.endsWith('/')?p:p+'/'}catch{return ''}}
function decorateGroup(group,index){
 const title=group.querySelector(':scope > .sidebar-group-title'),menu=group.querySelector(':scope > .sidebar-menu');if(!title||!menu)return;
 const b=document.createElement('button');b.type='button';b.className='sidebar-group-toggle';b.textContent=title.textContent.trim();
 const key='ita-sidebar-cms-'+(group.dataset.sidebarGroup||index);const current=!!menu.querySelector('.active,[aria-current="page"]');let saved=null;try{saved=localStorage.getItem(key)}catch{}
 const collapsed=current?false:saved!=='0';group.classList.toggle('is-collapsed',collapsed);b.setAttribute('aria-expanded',collapsed?'false':'true');title.insertAdjacentElement('afterend',b);
 b.addEventListener('click',()=>{const next=!group.classList.contains('is-collapsed');if(!next&&innerWidth<=900)document.querySelectorAll('.global-sidebar .sidebar-group').forEach(o=>{if(o!==group){o.classList.add('is-collapsed');o.querySelector(':scope > .sidebar-group-toggle')?.setAttribute('aria-expanded','false')}});group.classList.toggle('is-collapsed',next);b.setAttribute('aria-expanded',next?'false':'true');try{localStorage.setItem(key,next?'1':'0')}catch{}})
}
function libraryRow(a){
 const topic=(a.section||'материалы').toLowerCase(); const level=a.level==='advanced'?'advanced':'beginner'; const url=safeInternalHref(a.url,''); if(!url)return '';
 return `<article class="library-row" data-card-link="${esc(url)}" data-level="${level}" data-search="${esc([a.title,a.description,a.aliases,a.section].join(' '))}" data-topic="${esc(topic)}"><div class="library-type">${esc(a.label||'Статья')}</div><div><a href="${esc(url)}"><h2>${esc(a.title)}</h2></a><p>${esc(a.description||a.lead||'')}</p></div><div class="library-meta"><span class="level-badge level-${level}">${level==='advanced'?'После базы':'С нуля'}</span><span>${esc(a.section||'Материалы')}</span><span>${esc(a.readTime||'5 мин')}</span><span>${esc(a.date||'')}</span></div></article>`;
}
function setupLibrary(data){
 const host=document.getElementById('libraryRows'); if(!host||!data?.articles)return;
 const list=data.articles.filter(a=>a.libraryVisible!==false).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 host.innerHTML=list.map(libraryRow).join('');
 const input=document.getElementById('librarySearch'),empty=document.getElementById('libraryEmpty'),hint=document.getElementById('librarySearchHint'),topicLabel=document.getElementById('activeTopicLabel');
 const params=new URLSearchParams(location.search),rawTopic=(params.get('topic')||'all').toLowerCase();
 const labels={all:'Все материалы','основы':'Основы','экономика':'Экономика','аналитика':'Аналитика','практика':'Практика','трафик':'Трафик'}; if(topicLabel)topicLabel.textContent=labels[rawTopic]||'Все материалы';
 const apply=()=>{const q=(input?.value||'').trim().toLowerCase();let visible=0;host.querySelectorAll('.library-row').forEach(r=>{const topicOk=rawTopic==='all'||(r.dataset.topic||'').toLowerCase()===rawTopic;const queryOk=!q||(r.dataset.search||'').toLowerCase().includes(q);const ok=topicOk&&queryOk;r.classList.toggle('is-filtered-out',!ok);if(ok)visible++});if(empty)empty.hidden=visible>0;if(hint)hint.textContent=q?`Найдено: ${visible}`:'Введите тему или термин'};
 input?.addEventListener('input',apply); const q=params.get('q');if(input&&q)input.value=q;apply();
 host.addEventListener('click',e=>{const row=e.target.closest('.library-row[data-card-link]');if(row&&!e.target.closest('a,button,input,select,textarea'))location.href=row.dataset.cardLink});
 document.dispatchEvent(new CustomEvent('al:modechange',{detail:{source:'cms'}}));
}
function installStyle(){const st=document.createElement('style');st.textContent='.global-sidebar .sidebar-menu a.cms-nav-item[data-cms-icon]::before{content:attr(data-cms-icon)!important}.cms-runtime-error{display:none!important}';document.head.appendChild(st)}
function setupPartnerRedirect(){if(!document.body?.hasAttribute('data-partner-redirect'))return;const p=new URLSearchParams(location.search);try{localStorage.setItem('al-last-affiliate-click',JSON.stringify({from:(p.get('from')||'unknown').slice(0,160),ts:Date.now()}))}catch{}setTimeout(()=>location.replace('https://1w.run/?p=4o8v'),350)}
async function init(){setupPartnerRedirect();installStyle();const [nav,articles]=await Promise.allSettled([j(BASE+'content/navigation.json?v='+Date.now()),j(BASE+'content/articles.json?v='+Date.now())]);if(nav.status==='fulfilled')renderNav(nav.value);if(articles.status==='fulfilled')setupLibrary(articles.value)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(()=>{}));else init().catch(()=>{});
})();

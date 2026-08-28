(function(){
'use strict';
const BASE='/Affiliate_Lab/';
const j=(u)=>fetch(u,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function currentPath(){let p=location.pathname;return p.endsWith('/')?p:p+'/'}
function renderNav(data){
  const sidebar=document.querySelector('.global-sidebar'); if(!sidebar||!data?.groups)return;
  sidebar.querySelectorAll(':scope > .sidebar-group').forEach(x=>x.remove());
  const anchor=sidebar.querySelector(':scope > .sidebar-mode-compact, :scope > .sidebar-partner-cta, :scope > .sidebar-bottom');
  const path=currentPath();
  data.groups.forEach((g,gi)=>{
    const box=document.createElement('div'); box.className='sidebar-group'; box.dataset.sidebarGroup=g.id||String(gi);
    const title=document.createElement('p'); title.className='sidebar-group-title'; title.textContent=g.title||'Раздел'; box.appendChild(title);
    const nav=document.createElement('nav'); nav.className='sidebar-menu'; nav.setAttribute('aria-label',g.title||'Раздел');
    (g.items||[]).forEach(it=>{
      const a=document.createElement('a'); a.href=it.href||'#'; a.dataset.nav=it.id||'custom'; a.dataset.cmsIcon=it.icon||'•'; a.classList.add('cms-nav-item');
      if(currentPathFromHref(a.href)===path){a.classList.add('active');a.setAttribute('aria-current','page')}
      const span=document.createElement('span');span.textContent=it.title||'Пункт';a.appendChild(span);nav.appendChild(a);
    });
    box.appendChild(nav); sidebar.insertBefore(box,anchor||null); decorateGroup(box,gi);
  });
}
function currentPathFromHref(href){try{let p=new URL(href,location.href).pathname;return p.endsWith('/')?p:p+'/'}catch{return href}}
function decorateGroup(group,index){
 const title=group.querySelector(':scope > .sidebar-group-title'),menu=group.querySelector(':scope > .sidebar-menu');if(!title||!menu)return;
 const b=document.createElement('button');b.type='button';b.className='sidebar-group-toggle';b.textContent=title.textContent.trim();
 const key='ita-sidebar-cms-'+(group.dataset.sidebarGroup||index);const current=!!menu.querySelector('.active,[aria-current="page"]');let saved=null;try{saved=localStorage.getItem(key)}catch{}
 const collapsed=current?false:saved!=='0';group.classList.toggle('is-collapsed',collapsed);b.setAttribute('aria-expanded',collapsed?'false':'true');title.insertAdjacentElement('afterend',b);
 b.addEventListener('click',()=>{const next=!group.classList.contains('is-collapsed');if(!next&&innerWidth<=900)document.querySelectorAll('.global-sidebar .sidebar-group').forEach(o=>{if(o!==group){o.classList.add('is-collapsed');o.querySelector(':scope > .sidebar-group-toggle')?.setAttribute('aria-expanded','false')}});group.classList.toggle('is-collapsed',next);b.setAttribute('aria-expanded',next?'false':'true');try{localStorage.setItem(key,next?'1':'0')}catch{}})
}
function libraryRow(a){
 const topic=(a.section||'материалы').toLowerCase(); const level=a.level==='advanced'?'advanced':'beginner';
 return `<article class="library-row" data-card-link="${esc(a.url)}" data-level="${level}" data-search="${esc([a.title,a.description,a.aliases,a.section].join(' '))}" data-topic="${esc(topic)}"><div class="library-type">${esc(a.label||'Статья')}</div><div><a href="${esc(a.url)}"><h2>${esc(a.title)}</h2></a><p>${esc(a.description||a.lead||'')}</p></div><div class="library-meta"><span class="level-badge level-${level}">${level==='advanced'?'После базы':'С нуля'}</span><span>${esc(a.section||'Материалы')}</span><span>${esc(a.readTime||'5 мин')}</span><span>${esc(a.date||'')}</span></div></article>`;
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
async function init(){installStyle();const [nav,articles]=await Promise.allSettled([j(BASE+'content/navigation.json?v='+Date.now()),j(BASE+'content/articles.json?v='+Date.now())]);if(nav.status==='fulfilled')renderNav(nav.value);if(articles.status==='fulfilled')setupLibrary(articles.value)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(()=>{}));else init().catch(()=>{});
})();

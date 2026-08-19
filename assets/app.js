(function(){try{
 const keyboardMap={
   'q':'й','w':'ц','e':'у','r':'к','t':'е','y':'н','u':'г','i':'ш','o':'щ','p':'з','[':'х',']':'ъ',
   'a':'ф','s':'ы','d':'в','f':'а','g':'п','h':'р','j':'о','k':'л','l':'д',';':'ж',"'":'э',
   'z':'я','x':'ч','c':'с','v':'м','b':'и','n':'т','m':'ь',',':'б','.':'ю','`':'ё'
 };
 const ruToEn={}; Object.keys(keyboardMap).forEach(k=>{ruToEn[keyboardMap[k]]=k});
 const translitMap={
   'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
 };
 const synonymGroups=[
   ['партнерка','партнерки','партнерский','партнерская','affiliate','affiliates','affiliate marketing','affiliate program','partner program'],
   ['revshare','rev share','revenue share','ревшара','ревшар','ревшаре','ревшаре'],
   ['ftd','first time deposit','FTD','первое пополнение','first deposit'],
   ['трафик','traffic','source','source of traffic','источник','источники'],
   ['поиск','seo','search','organic','органика','поисковый'],
   ['видео','video','youtube','shorts','ролики','short'],
   ['стрим','stream','streaming','эфир','прямой эфир'],
   ['лендинг','landing','landing page','посадочная','Landing page'],
   ['прелендинг','prelanding','pre-landing','Pre-landing'],
   ['метка','метки','subid','sub id','utm','трекинг','tracking','clickid','click id'],
   ['статистика','analytics','аналитика','кабинет','dashboard','report','отчет','отчёт'],
   ['регистрация','registration','signup','sign up'],
   ['клик','click','clicks'],
   ['Offer','offer','offers'],
   ['гемблинг','gambling','casino','казино']
 ];
 const topicMap={basics:'основы',economics:'экономика',analytics:'аналитика',traffic:'трафик',practice:'практика',all:'all'};
 const labelMap={basics:'Основы',economics:'Экономика',analytics:'Аналитика',traffic:'Источники трафика',practice:'Практика',all:'Все материалы'};
 const commonStems=['ами','ями','ого','ему','ому','ией','ией','ией','ыми','ими','ать','ять','ить','еть','ти','ый','ий','ой','ая','ое','ые','ие','ых','их','ам','ям','ом','ем','ах','ях','ы','и','а','я','е','у','о'];

 function normalizeText(s){
   return (s||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"'`]/g,' ').replace(/[^\p{L}\p{N}\s\-]/gu,' ').replace(/\s+/g,' ').trim();
 }
 function swapLayout(text){
   return (text||'').split('').map(ch=>{
     const low=ch.toLowerCase();
     if(keyboardMap[low]) return keyboardMap[low];
     if(ruToEn[low]) return ruToEn[low];
     return low;
   }).join('');
 }
 function translit(text){
   return normalizeText(text).split('').map(ch=>translitMap[ch]!==undefined?translitMap[ch]:ch).join('');
 }
 function stemToken(token){
   let t=token;
   for(const end of commonStems){
     if(t.length>=5 && t.endsWith(end)){ t=t.slice(0,-end.length); break; }
   }
   return t;
 }
 function levenshtein(a,b){
   if(a===b) return 0;
   if(!a||!b) return Math.max(a.length,b.length);
   if(Math.abs(a.length-b.length)>2) return 3;
   const dp=new Array(b.length+1);
   for(let j=0;j<=b.length;j++) dp[j]=j;
   for(let i=1;i<=a.length;i++){
     let prev=dp[0]; dp[0]=i;
     for(let j=1;j<=b.length;j++){
       const temp=dp[j];
       dp[j]=Math.min(dp[j]+1, dp[j-1]+1, prev + (a[i-1]===b[j-1]?0:1));
       prev=temp;
     }
   }
   return dp[b.length];
 }
 function tokensFrom(text){
   return normalizeText(text).split(' ').map(stemToken).filter(Boolean);
 }
 function expandQuery(query){
   const raw=normalizeText(query);
   const variants=new Set([raw]);
   const swapped=normalizeText(swapLayout(query));
   if(swapped) variants.add(swapped);
   const rawTranslit=translit(query); if(rawTranslit) variants.add(rawTranslit);
   const swappedTranslit=translit(swapped); if(swappedTranslit) variants.add(swappedTranslit);
   const tokens=new Set();
   variants.forEach(v=>tokensFrom(v).forEach(t=>tokens.add(t)));
   const expanded=new Set(tokens);
   synonymGroups.forEach(group=>{
     const groupTokens=group.flatMap(item=>tokensFrom(item));
     if(groupTokens.some(t=>tokens.has(t))){
       groupTokens.forEach(t=>expanded.add(t));
     }
   });
   return {raw, variants:[...variants].filter(Boolean), tokens:[...expanded].filter(Boolean)};
 }
 function buildSearchable(row){
   const title=row.querySelector('h2')?.textContent||'';
   const desc=row.querySelector('p')?.textContent||'';
   const meta=[...row.querySelectorAll('.library-meta span')].map(s=>s.textContent).join(' ');
   const search=row.dataset.search||'';
   const topic=row.dataset.topic||'';
   const text=normalizeText([title,desc,meta,search,topic].join(' '));
   const transliterated=translit(text);
   const tokens=[...new Set(tokensFrom(text).concat(tokensFrom(transliterated)))];
   return {text,transliterated,tokens,title};
 }
 function scoreItem(queryData, item){
   if(!queryData.raw) return 1;
   let score=0;
   queryData.variants.forEach(v=>{
     if(v && (item.text.includes(v) || item.transliterated.includes(v))) score+=8;
   });
   queryData.tokens.forEach(token=>{
     if(!token) return;
     if(item.tokens.includes(token)) { score+=3; return; }
     if(item.tokens.some(t=>t.startsWith(token) || token.startsWith(t))) { score+=1.8; return; }
     if(token.length>=4 && item.tokens.some(t=>Math.abs(t.length-token.length)<=1 && levenshtein(t,token)<=1)) { score+=1.25; return; }
     if(token.length>=6 && item.tokens.some(t=>Math.abs(t.length-token.length)<=2 && levenshtein(t,token)<=2)) { score+=0.8; }
   });
   return score;
 }
 const glossarySuggestions=[
  ['FTD','Первый депозит нового игрока и условия его зачёта.','ftd FTD'],
  ['RevShare','Процент от расчётного дохода оператора.','revshare revenue share ревшара'],
  ['CPA','Фиксированная выплата за квалифицированное действие.','cpa выплата действие'],
  ['GGR и NGR','Расчётные показатели игрового дохода.','ggr ngr игровой доход'],
  ['SubID','Метка для разделения источников, страниц и публикаций.','subid метка источник'],
  ['Click ID','Идентификатор конкретного перехода.','click id Click ID'],
  ['Postback','Серверное уведомление о конверсии.','postback Postback конверсия'],
  ['Холд','Период проверки конверсии перед выплатой.','холд hold проверка'],
  ['Фрод','Недействительные или искусственно созданные действия.','фрод fraud'],
  ['Квалифицированный FTD','Первый депозит, выполнивший дополнительные условия программы.','квалифицированный ftd квалификация'],
  ['Конверсия','Переход человека на следующий этап воронки.','конверсия conversion cr'],
  ['Воронка','Путь от показа и клика до регистрации и FTD.','воронка funnel'],
  ['CTR','Доля кликов от числа показов.','ctr click through rate'],
  ['ROI','Окупаемость относительно расходов.','roi окупаемость'],
  ['GEO','Страна или рынок, на который направлен трафик.','geo гео страна'],
  ['Offer','Условия конкретного предложения партнёрской программы.','offer Offer предложение'],
  ['Landing page','Страница после рекламного перехода.','landing page лендинг'],
  ['Tracker','Система учёта кликов, меток и конверсий.','tracker Tracker tracking'],
  ['Куки','Данные браузера, которые могут участвовать в Attribution.','куки cookie cookies'],
  ['Органический трафик','Переходы без оплаты за каждый показ или клик.','органический трафик органика']
 ].map(([title,desc,aliases])=>({title,url:'/Affiliate_Lab/glossary/?q='+encodeURIComponent(title),section:'Словарь',desc,aliases}));


 const suggestionIndex=[{"title":"1win Partners: правила, выплаты и актуальные GEO","url":"/Affiliate_Lab/guides/1win-rules/","section":"Практика","desc":"RS и CPA, условия выплат, запрещённые методы, проверка трафика и актуальные GEO 1win.","aliases":"1win partners правила geo гео страны revshare rs cpa выплаты запрещенный трафик"},{"title":"YouTube: от серии роликов до первого депозита","url":"/Affiliate_Lab/traffic/sources/youtube/","section":"Источники трафика","desc":"3–5 длинных видео или 10–20 Shorts: отдельные метки, клики на 1000 просмотров, регистрации и первые депозиты.","aliases":"youtube ютуб shorts видео ролики запуск план"},{"title":"VK Видео и Клипы: пошаговый запуск","url":"/Affiliate_Lab/traffic/sources/vk-video/","section":"Источники трафика","desc":"3–5 видео или 10–20 Клипов: отдельно считаются ролик, сообщество, внешний клик, регистрация и первый депозит.","aliases":"vk вк видео клипы сообщество запуск план"},{"title":"Telegram-канал: от первого читателя до FTD","url":"/Affiliate_Lab/traffic/sources/telegram/","section":"Источники трафика","desc":"8–12 стартовых постов, отдельные пригласительные ссылки, чтение следующих публикаций, клики и первые депозиты.","aliases":"telegram телеграм канал размещения посевы запуск план"},{"title":"Контентный сайт: пошаговый запуск SEO-источника","url":"/Affiliate_Lab/traffic/sources/content-site/","section":"Источники трафика","desc":"Один кластер из 3–5 страниц: запросы, показы, поисковые и партнёрские клики, регистрации и первые депозиты.","aliases":"контентный сайт seo поиск блог search console запуск план"},{"title":"Социальные сети: посты, карусели и обычная лента","url":"/Affiliate_Lab/traffic/sources/social/","section":"Источники трафика","desc":"10–20 публикаций одного формата: отдельные метки, клики на 1000 просмотров, регистрации и первые депозиты.","aliases":"соцсети social tiktok reels клипы короткие видео лента"},{"title":"Тематические сообщества и форумы: органический трафик без спама","url":"/Affiliate_Lab/traffic/sources/communities/","section":"Источники трафика","desc":"3–5 релевантных площадок: отдельные метки, клики, регистрации и первые депозиты.","aliases":"сообщества форумы группы чаты community forum"},{"title":"Поисковый трафик: от запроса до партнёрского клика","url":"/Affiliate_Lab/traffic/sources/search/","section":"Источники трафика","desc":"5–10 запросов, 3–5 страниц: показы, кликабельность, партнёрские клики, регистрации и первые депозиты.","aliases":"поиск seo google yandex запросы search"},{"title":"Стримы и прямые эфиры: пошаговый тест источника","url":"/Affiliate_Lab/traffic/sources/streams/","section":"Источники трафика","desc":"3–5 эфиров: отдельно считаются прямой эфир и запись, клики, регистрации и первые депозиты.","aliases":"стрим stream live эфир запись"},{"title":"Платный трафик: пошаговый тест без бесконтрольного расхода","url":"/Affiliate_Lab/traffic/sources/paid/","section":"Источники трафика","desc":"Одна гипотеза, фиксированный лимит и раздельный трекинг до первого расхода.","aliases":"платный трафик реклама paid ads cpc budget"},{"title":"TikTok, Reels, Spotlight и Likee: вертикальные видео","url":"/Affiliate_Lab/traffic/sources/short-video/","section":"Источники трафика","desc":"10–20 вертикальных роликов на одной площадке: отдельные метки, клики, регистрации и первые депозиты.","aliases":"tiktok тикток reels рилс spotlight likee лайки вертикальные видео"},{"title":"Rutube, OK Видео и другие видеохостинги: дополнительный источник","url":"/Affiliate_Lab/traffic/sources/alt-video/","section":"Источники трафика","desc":"3–5 сопоставимых роликов на дополнительную площадку: просмотры, клики и действия ниже по воронке.","aliases":"rutube рутуб dailymotion ok видео одноклассники видеохостинг"},{"title":"Дзен: статьи, посты и рекомендательная лента","url":"/Affiliate_Lab/traffic/sources/dzen/","section":"Источники трафика","desc":"8–12 материалов одного формата: дочитывания, внешние клики, регистрации и первые депозиты.","aliases":"дзен dzen статьи лента рекомендации контент"},{"title":"Reddit: как работать с тематическими сообществами без спама","url":"/Affiliate_Lab/traffic/sources/reddit/","section":"Источники трафика","desc":"5–10 полезных публикаций или ответов: отдельные метки по сообществам и веткам.","aliases":"reddit реддит сабреддит форум ветка обсуждение"},{"title":"X: короткие посты, треды и переходы через профиль","url":"/Affiliate_Lab/traffic/sources/x-twitter/","section":"Источники трафика","desc":"15–30 постов одной темы: показы, профиль, внешние клики, регистрации и первые депозиты.","aliases":"x twitter твиттер тред короткие посты"},{"title":"Email и web push: работа с собственной базой","url":"/Affiliate_Lab/traffic/sources/mailing/","section":"Источники трафика","desc":"3–5 рассылок одной темы по собственной базе: клики, регистрации и первые депозиты.","aliases":"email почта рассылка web push пуш подписчики база"},{"title":"Основы партнёрского маркетинга","url":"/Affiliate_Lab/basics/","section":"Раздел","desc":"Offer, FTD, GEO, воронка и базовая механика.","aliases":"основы база beginner basics affiliate beginner партнерка Offer ftd"},{"title":"Экономика партнёрских программ","url":"/Affiliate_Lab/economics/","section":"Раздел","desc":"RevShare, CPA, GGR, NGR и логика выплат.","aliases":"экономика деньги выплаты revshare cpa ggr ngr revenue share"},{"title":"Аналитика и трекинг","url":"/Affiliate_Lab/analytics/","section":"Раздел","desc":"Метки, статистика, Tracker, Cohort и сравнение источников.","aliases":"аналитика statistics tracking трекинг dashboard кабинет метрики tracker"},{"title":"Источники трафика","url":"/Affiliate_Lab/traffic/","section":"Раздел","desc":"15 направлений: YouTube, VK, Telegram, короткие видео, Дзен, Reddit, X, поиск, сообщества, рассылки, реклама и собственные площадки.","aliases":"traffic трафик seo search youtube video telegram vk social ads stream источники"},{"title":"Практика вебмастера","url":"/Affiliate_Lab/practice/","section":"Раздел","desc":"Подготовка запуска, первый тест, менеджер и разбор результата.","aliases":"практика запуск тест checklist менеджер first ftd"},{"title":"Словарь","url":"/Affiliate_Lab/glossary/","section":"Справочник","desc":"Короткие определения терминов и английские эквиваленты.","aliases":"словарь glossary термины definitions термин"},{"title":"Инструменты","url":"/Affiliate_Lab/tools/","section":"Справочник","desc":"Калькуляторы для воронки, теста и RevShare.","aliases":"tools инструменты калькуляторы calculator расчеты расчёт"},{"title":"Сервисы","url":"/Affiliate_Lab/services/","section":"Справочник","desc":"Основной набор: Proxys.io, Multilogin, DarkStore, OnlineSim, RUVDS, Spy.House, AdsBridge и ProfitAds.","aliases":"сервисы proxy прокси proxys antidetect антидетект multilogin onlinesim darkstore ruvds spyhouse adsbridge profitads трекер аккаунты vds sms"},{"title":"Рабочий журнал","url":"/Affiliate_Lab/notes/","section":"Для работы","desc":"Запуски, метки, показатели и выводы по тестам.","aliases":"тесты записи журнал результаты запуск"},{"title":"Мессенджеры и сообщества: как приводить игроков из каналов и групп","url":"/Affiliate_Lab/guides/community-traffic/","section":"Трафик","desc":"Как выбрать подходящее сообщество, подать предложение и довести заинтересованного пользователя до регистрации и первого депозита.","aliases":"сообщества мессенджеры telegram телеграм канал чат community messenger доверие аудитория форум форумы forum discord дискорд vk группы размещения"},{"title":"Социальные сети: как приводить игроков из ленты","url":"/Affiliate_Lab/guides/social-traffic/","section":"Трафик","desc":"Как через контент в ленте довести заинтересованного пользователя до перехода, регистрации и первого депозита.","aliases":"соцсети social media vk instagram tiktok reels shorts clips клипы рилс лента органика реклама"},{"title":"Платный трафик: как задать тест до покупки кликов","url":"/Affiliate_Lab/guides/paid-traffic/","section":"Трафик","desc":"Лимит расходов, учёт, структура теста и критерий остановки до первого потраченного рубля.","aliases":"платный трафик paid ads cpc cpl реклама google meta tiktok бюджет"},{"title":"Стримы и прямые эфиры: как считать трафик от живой аудитории","url":"/Affiliate_Lab/guides/stream-traffic/","section":"Трафик","desc":"Онлайн, переходы, отдельные метки по эфирам и влияние доверия к ведущему.","aliases":"стрим stream streaming twitch youtube live эфир зрители онлайн"},{"title":"Сайты и контентные проекты: как строить источник на своей площадке","url":"/Affiliate_Lab/guides/content-sites/","section":"Трафик","desc":"Как собрать первую тему, связать материалы и измерять собственный сайт как долгосрочный актив.","aliases":"сайт website content seo блог контент проект own media"},{"title":"Как выбрать партнёрскую программу","url":"/Affiliate_Lab/guides/choose-program/","section":"Практика","desc":"Программа выбирается не по одной ставке: важны правила трафика, трекинг, выплаты, продукт и поддержка.","aliases":"выбор партнерской программы ставка условия трекинг выплаты менеджер качество"},{"title":"Партнёрский кабинет: как читать отчёт по кликам, регистрациям и FTD","url":"/Affiliate_Lab/guides/partner-dashboard/","section":"Аналитика","desc":"Как найти в кабинете период, клики, регистрации, FTD, статусы и разбивки.","aliases":"партнерский кабинет статистика клики регистрации FTD доход отчет"},{"title":"Когда нужна Landing page","url":"/Affiliate_Lab/guides/landing-page/","section":"Практика","desc":"Когда собственная страница помогает воронке, а когда только добавляет лишний шаг.","aliases":"Landing page лендинг прелендинг переход конверсия сайт"},{"title":"Нужен ли Tracker новичку","url":"/Affiliate_Lab/guides/tracker-for-beginner/","section":"Аналитика","desc":"Когда отдельный Tracker действительно нужен и в каких случаях на старте можно обойтись без него.","aliases":"Tracker Postback серверный трекинг метки конверсия новичок"},{"title":"AdsBridge: как создать первую кампанию","url":"/Affiliate_Lab/guides/adsbridge-campaign/","section":"Аналитика","desc":"Пошаговая настройка кампании: домен, источник, SubID, оффер, лендинг, postback и тестовая ссылка.","aliases":"adsbridge адсбридж кампания tracker трекер subid click id postback offer оффер лендинг"},{"title":"Как работать с менеджером партнёрской программы","url":"/Affiliate_Lab/guides/affiliate-manager/","section":"Практика","desc":"Какие вопросы задавать до запуска и какую информацию давать, если статистика выглядит странно.","aliases":"менеджер партнерской программы вопросы ставка правила трафика спор статистика"},{"title":"Что значит качество трафика","url":"/Affiliate_Lab/guides/traffic-quality/","section":"Аналитика","desc":"Качество трафика видно по прохождению воронки и дальнейшей активности аудитории.","aliases":"качество трафика конверсия Cohort отклонения повторные депозиты"},{"title":"Что проверить перед первым запуском","url":"/Affiliate_Lab/guides/launch-checklist/","section":"Практика","desc":"Короткая проверка ссылки, учёта кликов, мобильной версии и лимита теста до первого реального трафика.","aliases":"первый запуск чеклист ссылка мобильная версия метки тест бюджет"},{"title":"Поисковый трафик: как начать и что считать","url":"/Affiliate_Lab/guides/search-traffic/","section":"Трафик","desc":"Почему поиск не даёт быстрый результат, как выбрать тему, получить первые результаты и считать страницы отдельно.","aliases":"поисковый трафик запрос намерение страница органика поиск"},{"title":"Видео и короткие ролики: как измерять трафик, а не просмотры","url":"/Affiliate_Lab/guides/video-traffic/","section":"Трафик","desc":"Как отделить просмотры от переходов и сравнивать ролики по реальной воронке.","aliases":"видео трафик просмотры переходы регистрации FTD канал"},{"title":"Как устроен Affiliate Marketing","url":"/Affiliate_Lab/guides/affiliate-marketing/","section":"Основы","desc":"Кто участвует в партнёрской схеме, где появляется трекинг и в какой момент возникает выплата.","aliases":"Affiliate Marketing партнерский маркетинг рекламодатель вебмастер publisher advertiser партнерская программа комиссия"},{"title":"Что такое Offer и что проверять до запуска","url":"/Affiliate_Lab/guides/offer/","section":"Основы","desc":"До запуска Offer проверь действие, страну, ограничения и правила учёта конверсий.","aliases":"Offer offer geo ставка cpa revshare ограничения источники трафика условия Attribution"},{"title":"Метки, Click ID и Postback: как не путать трекинг","url":"/Affiliate_Lab/guides/tracking/","section":"Аналитика","desc":"Метки источника, Click ID и Postback решают разные задачи. Здесь они собраны в одну схему.","aliases":"tracking трекинг subid click id postback s2s utm метки Attribution источник кампания"},{"title":"GGR и NGR: откуда берётся расчётная база","url":"/Affiliate_Lab/guides/ggr-ngr/","section":"Экономика","desc":"GGR и NGR часто стоят рядом с RevShare, но означают разные уровни расчёта дохода.","aliases":"ggr ngr gross gaming revenue net gaming revenue ставки выигрыши бонусы комиссии revshare экономика"},{"title":"Метрики трафика: как считать конверсии, стоимость FTD и доход","url":"/Affiliate_Lab/guides/metrics/","section":"Аналитика","desc":"Формулы для конверсий, стоимости FTD и сравнения сопоставимых источников.","aliases":"метрики kpi ctr cr conversion rate epc clicks регистрации ftd cpa стоимость привлечения Cohort"},{"title":"GEO Offer: почему одна связка по-разному работает в разных странах","url":"/Affiliate_Lab/guides/geo/","section":"Основы","desc":"GEO определяет язык, платежи, правила рекламы и доступность продукта.","aliases":"geo гео страна локализация язык валюта платежи регулирование мобильный трафик affiliate igaming"},{"title":"FTD: что считается FTD","url":"/Affiliate_Lab/guides/ftd/","section":"Основы","desc":"Разница между регистрацией и FTD, плюс две конверсии для первого разбора.","aliases":"ftd FTD регистрация конверсия основы"},{"title":"Как устроен RevShare в гемблинге","url":"/Affiliate_Lab/guides/revshare/","section":"Экономика","desc":"От GGR и NGR до отрицательного баланса и длинной жизни игрока.","aliases":"revshare ggr ngr negative carry доход экономика"},{"title":"CPA или RevShare: как сравнивать модели выплат","url":"/Affiliate_Lab/guides/cpa-vs-revshare/","section":"Экономика","desc":"Какие цифры нужны, чтобы сравнение не сводилось к ставке в рекламном баннере.","aliases":"cpa revshare сравнение выплаты экономика"},{"title":"Статистика партнёрской программы: 5 показателей для первого разбора","url":"/Affiliate_Lab/guides/statistics/","section":"Аналитика","desc":"Пять исходных цифр, с которых достаточно начать разбор партнёрской статистики.","aliases":"статистика клики регистрации ftd Cohort доход аналитика"},{"title":"Органический и условно бесплатный трафик","url":"/Affiliate_Lab/guides/free-traffic/","section":"Трафик","desc":"Поисковый трафик, видео, сообщества и собственные инструменты: плюсы, минусы и цена времени.","aliases":"трафик seo youtube видео сообщества органика убт"},{"title":"Первый FTD: как провести тест и не запутаться в данных","url":"/Affiliate_Lab/guides/first-ftd/","section":"Практика","desc":"Простой порядок действий от выбора источника до разбора первой конверсии.","aliases":"первый ftd тест источник Offer subid практика"},{"title":"Как выбрать источник трафика: от бюджета и времени к первому тесту","url":"/Affiliate_Lab/guides/choose-traffic-source/","section":"Трафик","desc":"Выбор канала по бюджету, контенту, своей аудитории и скорости обратной связи.","aliases":"как выбрать источник трафика выбор канала бюджет время контент аудитория быстрый результат seo video social paid"},{"title":"Клики есть, регистраций нет: что проверить по порядку","url":"/Affiliate_Lab/guides/clicks-no-registrations/","section":"Аналитика","desc":"Пошаговая проверка участка между кликом и регистрацией.","aliases":"клики есть регистраций нет нет регистраций clicks no registrations лендинг гео воронка"},{"title":"Регистрации есть, FTD нет: где искать причину","url":"/Affiliate_Lab/guides/registrations-no-ftd/","section":"Аналитика","desc":"FTD, путь после регистрации, платежи, задержка и качество аудитории.","aliases":"регистрации есть депозитов нет нет ftd registration no deposit FTD"},{"title":"Статистика не сходится: как сверить клики и конверсии между системами","url":"/Affiliate_Lab/guides/statistics-mismatch/","section":"Аналитика","desc":"Период, часовой пояс, Click ID, SubID и postback.","aliases":"статистика не сходится расхождение Tracker кабинет click id subid postback mismatch"}];
 suggestionIndex.unshift(...glossarySuggestions);
 function scoreSuggestion(query,item){
   const q=expandQuery(query);
   const text=normalizeText([item.title,item.section,item.desc,item.aliases].join(' '));
   const searchable={
     text:text,
     transliterated:translit(text),
     tokens:[...new Set(tokensFrom(text).concat(tokensFrom(translit(text))))],
     title:item.title||''
   };
   return scoreItem(q,searchable);
 }
 function attachAutocomplete(input,opts={}){
   if(!input || input.dataset.autocompleteReady) return;
   input.dataset.autocompleteReady='1';
   const host=opts.host || input.parentElement;
   if(!host) return;
   host.classList.add('autocomplete-host');
   const box=document.createElement('div');
   box.className='autocomplete-box'; box.hidden=true; box.setAttribute('role','listbox'); const boxId='al-autocomplete-'+Math.random().toString(36).slice(2,9); box.id=boxId; host.appendChild(box);
   let active=-1, visible=[];
   const close=()=>{box.hidden=true;active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant')};
   const open=()=>{if(visible.length){box.hidden=false;input.setAttribute('aria-expanded','true')}};
   const render=()=>{
     const q=input.value.trim();
     if(q.length<1){close();box.innerHTML='';return}
     visible=suggestionIndex.map((item,i)=>({...item,_score:scoreSuggestion(q,item),_i:i})).filter(x=>x._score>0.9).sort((a,b)=>b._score-a._score||a._i-b._i).slice(0,6);
     if(!visible.length){box.innerHTML='<div class="autocomplete-empty">Ничего похожего. Нажмите Enter, чтобы искать по всей библиотеке.</div>';box.hidden=false;input.setAttribute('aria-expanded','true');return}
     box.innerHTML=visible.map((item,i)=>`<a href="${item.url}" role="option" id="${boxId}-opt-${i}" aria-selected="false" data-suggest-index="${i}"><span>${item.section}</span><b>${item.title}</b><small>${item.desc}</small></a>`).join('');
     active=-1; open();
   };
   input.setAttribute('autocomplete','off'); input.setAttribute('role','combobox'); input.setAttribute('aria-autocomplete','list'); input.setAttribute('aria-controls',boxId); input.setAttribute('aria-haspopup','listbox'); input.setAttribute('aria-expanded','false');
   input.addEventListener('input',render);
   input.addEventListener('focus',()=>{if(input.value.trim())render()});
   input.addEventListener('keydown',e=>{
     if(box.hidden) return;
     const links=[...box.querySelectorAll('a')]; if(!links.length) return;
     if(e.key==='ArrowDown'){e.preventDefault();active=(active+1)%links.length}
     else if(e.key==='ArrowUp'){e.preventDefault();active=(active-1+links.length)%links.length}
     else if(e.key==='Escape'){close();return}
     else if(e.key==='Enter' && active>=0){e.preventDefault();location.href=links[active].href;return}
     else return;
     links.forEach((a,i)=>{const on=i===active;a.classList.toggle('active',on);a.setAttribute('aria-selected',on?'true':'false')}); if(active>=0){input.setAttribute('aria-activedescendant',links[active].id);links[active].scrollIntoView({block:'nearest'})}
   });
   document.addEventListener('click',e=>{if(!host.contains(e.target))close()});
 }
 document.querySelectorAll('.sidebar-search input').forEach(input=>attachAutocomplete(input,{host:input.closest('.sidebar-search')}));
 attachAutocomplete(document.getElementById('siteSearch'),{host:document.getElementById('siteSearch')?.closest('.searchbox>div')});
 const libSearch=document.getElementById('librarySearch');if(libSearch&&!libSearch.getAttribute('aria-label'))libSearch.setAttribute('aria-label','Поиск по материалам');attachAutocomplete(libSearch,{host:libSearch?.closest('.library-search')});
 const glossSearch=document.getElementById('glossarySearch');if(glossSearch){if(!glossSearch.getAttribute('aria-label'))glossSearch.setAttribute('aria-label','Поиск по словарю');attachAutocomplete(glossSearch,{host:glossSearch.closest('.glossary-search')||glossSearch.parentElement});}

 document.querySelectorAll('[data-affiliate]').forEach(a=>a.addEventListener('click',()=>{try{localStorage.setItem('al-last-affiliate-click',JSON.stringify({from:a.dataset.from||location.pathname,ts:Date.now()}))}catch(e){}}));
 /* v38: homepage search navigation moved to core module; autocomplete remains here. */

 const ls=document.getElementById('librarySearch'), rows=[...document.querySelectorAll('.library-row')], topicLabel=document.getElementById('activeTopicLabel');
 if(ls&&rows.length){
   const params=new URLSearchParams(location.search), q=params.get('q')||'', rawTopic=params.get('topic')||'all';
   const topic=topicMap[rawTopic]||'all';
   const emptyBox=document.getElementById('libraryEmpty');
   const hint=document.getElementById('librarySearchHint');
   const rowData=rows.map((row,index)=>({row,index,searchable:buildSearchable(row)}));
   ls.value=q;
   if(topicLabel) topicLabel.textContent=labelMap[rawTopic]||'Все материалы';
   const apply=()=>{
     const queryData=expandQuery(ls.value);
     const scored=[];
     rowData.forEach(item=>{
       const rowTopic=normalizeText(item.row.dataset.topic||'');
       const topicOk=topic==='all'||rowTopic===topic;
       const score=scoreItem(queryData,item.searchable);
       if(topicOk && (!queryData.raw || score>0.9)) scored.push({...item,score});
     });
     scored.sort((a,b)=> b.score===a.score ? a.index-b.index : b.score-a.score);
     rowData.forEach(item=> item.row.classList.add('is-filtered-out'));
     const parent=rows[0].parentNode;
     scored.forEach(item=>{ item.row.classList.remove('is-filtered-out'); parent.appendChild(item.row); });
     if(emptyBox) emptyBox.hidden = scored.length>0;
     if(hint){
       if(queryData.raw){
         hint.textContent = scored.length ? 'Показаны подходящие материалы' : 'Совпадений нет. Попробуйте более общее слово.';
       }else{
         hint.textContent = 'Введите тему или термин';
       }
     }
   };
   ls.addEventListener('input',apply); apply();
 }

 const gs=document.getElementById('glossarySearch'), entries=[...document.querySelectorAll('.glossary-entry')];
 if(gs&&entries.length){
   const glossaryQuery=new URLSearchParams(location.search).get('q');
   if(glossaryQuery) gs.value=glossaryQuery;
   const entryData=entries.map((entry,index)=>({entry,index,searchable:buildSearchable(entry)}));
   const applyGlossary=()=>{
     const queryData=expandQuery(gs.value);
     const scored=[];
     entryData.forEach(item=>{
       const score=scoreItem(queryData,item.searchable);
       if(!queryData.raw || score>0.9) scored.push({...item,score});
     });
     scored.sort((a,b)=> b.score===a.score ? a.index-b.index : b.score-a.score);
     entryData.forEach(item=> item.entry.style.display='none');
     const parent=entries[0].parentNode;
     scored.forEach(item=>{ item.entry.style.display='grid'; parent.appendChild(item.entry); });
   };
   gs.addEventListener('input',applyGlossary); applyGlossary();
 }

 const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
 function val(id){return parseFloat(document.getElementById(id)?.value||0)}
 function pct(id){return val(id)/100}
 function word(n,one,few,many){
   n=Math.abs(Math.round(n))%100;
   const n1=n%10;
   if(n>10&&n<20)return many;
   if(n1>1&&n1<5)return few;
   if(n1===1)return one;
   return many;
 }
 const presets={
   search:{
     label:'Поисковый трафик',
     hint:'Для поискового трафика чаще всего выше намерение пользователя, поэтому регистрация обычно конвертируется лучше, чем у холодного трафика.',
     clicks:1000,crReg:11,crFtd:18,planCrReg:11,planCrFtd:18,planCpc:12,maxCrReg:11,maxCrFtd:18,ftdValue:4500
   },
   video:{
     label:'Видео и короткие ролики',
     hint:'Видео часто даёт большой охват, но аудитория холоднее. Поэтому регистраций и FTD на том же объёме кликов обычно меньше, чем в поиске.',
     clicks:1000,crReg:6.5,crFtd:11,planCrReg:6.5,planCrFtd:11,planCpc:9,maxCrReg:6.5,maxCrFtd:11,ftdValue:3600
   },
   community:{
     label:'Сообщества и мессенджеры',
     hint:'В сообществах и мессенджерах многое зависит от доверия к площадке. При хорошей прогретой аудитории цифры часто ближе к поиску, чем к холодной рекламе.',
     clicks:1000,crReg:8.5,crFtd:15,planCrReg:8.5,planCrFtd:15,planCpc:4,maxCrReg:8.5,maxCrFtd:15,ftdValue:4000
   },
   ads:{
     label:'Платная реклама',
     hint:'У платной рекламы цифры чаще всего сильнее плавают от креатива и сегмента. Даже небольшой сдвиг в аудитории может резко изменить воронку.',
     clicks:1000,crReg:7.5,crFtd:12,planCrReg:7.5,planCrFtd:12,planCpc:22,maxCrReg:7.5,maxCrFtd:12,ftdValue:4200
   },
   stream:{
     label:'Стримы и прямые эфиры',
     hint:'У стримов многое решает доверие к ведущему и точка входа зрителя. При слабом прогреве регистрация и FTD обычно ниже, чем в поиске и сообществах.',
     clicks:1000,crReg:4.8,crFtd:9,planCrReg:4.8,planCrFtd:9,planCpc:0,maxCrReg:4.8,maxCrFtd:9,ftdValue:3200
   }
 };
 function applyPreset(key){
   const p=presets[key];
   if(!p) return;
   ['clicks','crReg','crFtd','planCrReg','planCrFtd','planCpc','maxCrReg','maxCrFtd','ftdValue'].forEach(id=>{
     const el=document.getElementById(id);
     if(el && p[id]!==undefined) el.value=p[id];
   });
   const hint=document.getElementById('presetHint');
   if(hint) hint.textContent=p.hint;
   calc();
 }
 function calc(){
   const funnel=document.getElementById('funnelOut');
   if(funnel){
     const clicks=Math.max(0,Math.round(val('clicks')));
     const regs=Math.round(clicks*pct('crReg'));
     const ftd=Math.round(regs*pct('crFtd'));
     funnel.textContent=
       fmt(regs)+' '+word(regs,'регистрация','регистрации','регистраций')+
       ', '+fmt(ftd)+' '+word(ftd,'FTD','первых депозита','FTD');
   }
   const plan=document.getElementById('testPlanOut');
   if(plan){
     const target=Math.max(1,Math.round(val('targetFtd')));
     const regRate=Math.max(.0001,pct('planCrFtd'));
     const clickRate=Math.max(.0001,pct('planCrReg'));
     const regs=Math.ceil(target/regRate);
     const clicks=Math.ceil(regs/clickRate);
     const budget=clicks*Math.max(0,val('planCpc'));
     plan.textContent=
       fmt(regs)+' '+word(regs,'регистрация','регистрации','регистраций')+
       ', '+fmt(clicks)+' '+word(clicks,'клик','клика','кликов')+
       ', '+fmt(budget)+' ₽';
   }
   const breakeven=document.getElementById('breakEvenOut');
   if(breakeven){
     const maxCpl=val('ftdValue')*pct('maxCrFtd');
     const maxCpc=maxCpl*pct('maxCrReg');
     breakeven.textContent=fmt(maxCpc)+' ₽ / клик, '+fmt(maxCpl)+' ₽ / регистрация';
   }
   const rev=document.getElementById('revOut');
   if(rev) rev.textContent=fmt(val('ggr')*pct('rs'))+' ₽';
 }
 document.querySelectorAll('.calc input').forEach(i=>i.addEventListener('input',calc));
 const presetSelect=document.getElementById('trafficPreset');
 if(presetSelect){
   presetSelect.addEventListener('change',()=>applyPreset(presetSelect.value));
   applyPreset(presetSelect.value||'search');
 }else{calc();}
}catch(e){console.error('iGaming Traffic Academy module 1 error',e);}})();
;

(function(){try{
 var path=location.pathname, key='home';
 if(path.indexOf('/Affiliate_Lab/services/')===0) key='services';
 else if(path.indexOf('/Affiliate_Lab/traffic/compare/')===0) key='compare';
 else if(path.indexOf('/Affiliate_Lab/traffic/')===0) key='traffic';
 else if(path.indexOf('/Affiliate_Lab/start/')===0) key='start';
 else if(path.indexOf('/Affiliate_Lab/practice/')===0) key='practice';
 else if(path.indexOf('/Affiliate_Lab/diagnostics/')===0) key='diagnostics';
 else if(path.indexOf('/Affiliate_Lab/analytics/')===0) key='analytics';
 else if(path.indexOf('/Affiliate_Lab/tools/')===0) key='tools';
 else if(path.indexOf('/Affiliate_Lab/notes/')===0 || path.indexOf('/Affiliate_Lab/path/')===0) key='notes';
 else if(path.indexOf('/Affiliate_Lab/basics/')===0) key='basics';
 else if(path.indexOf('/Affiliate_Lab/economics/')===0) key='economics';
 else if(path.indexOf('/Affiliate_Lab/glossary/')===0) key='glossary';
 else if(path.indexOf('/Affiliate_Lab/about/')===0) key='about';
 else if(path.indexOf('/Affiliate_Lab/guides/')===0) key='library';
 document.querySelectorAll('[data-nav]').forEach(function(a){const on=a.getAttribute('data-nav')===key;a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
}catch(e){console.error('iGaming Traffic Academy navigation error',e);}})();

/* v18 - interactive terminology */
(function(){try{
  const dictionary = [
    {
      key:'affiliate-marketing',
      variants:['Affiliate Marketing','Affiliate Marketing'],
      en:'Affiliate marketing',
      title:'Affiliate Marketing',
      text:'Модель продвижения, при которой партнёр приводит пользователей рекламодателю и получает вознаграждение за оговорённый результат.'
    },
    {
      key:'offer',
      variants:['Offer','Offer','Offer','Offer','Offer','Offer'],
      en:'Offer',
      title:'Offer',
      text:'Конкретное предложение партнёрской программы: продукт, GEO, модель оплаты, допустимые источники трафика и условия зачёта конверсии.'
    },
    {
      key:'ftd',
      variants:['FTD'],
      en:'First-Time Deposit',
      title:'FTD',
      text:'Первый депозит нового игрока. В разных партнёрских программах могут действовать дополнительные условия по минимальной сумме и квалификации.'
    },
    {
      key:'revshare',
      variants:['RevShare'],
      en:'Revenue Share',
      title:'RevShare',
      text:'Модель, при которой партнёр получает процент от расчётного дохода оператора с привлечённой аудитории.'
    },
    {
      key:'cpa',
      variants:['CPA'],
      en:'Cost Per Acquisition',
      title:'CPA',
      text:'Фиксированная выплата за пользователя, который выполнил условия квалификации. Конкретные требования определяет партнёрская программа.'
    },
    {
      key:'ggr',
      variants:['GGR'],
      en:'Gross Gaming Revenue',
      title:'GGR',
      text:'Валовой игровой доход: сумма ставок за вычетом выплаченных выигрышей до последующих вычетов и корректировок.'
    },
    {
      key:'ngr',
      variants:['NGR'],
      en:'Net Gaming Revenue',
      title:'NGR',
      text:'Чистая расчётная база после предусмотренных оператором вычетов. Единой формулы для всех партнёрских программ нет.'
    },
    {
      key:'epc',
      variants:['EPC'],
      en:'Earnings Per Click',
      title:'EPC',
      text:'Средний доход на один клик. Показатель зависит от выбранного периода, источника трафика и способа расчёта дохода.'
    },
    {
      key:'utm',
      variants:['UTM'],
      en:'UTM parameters',
      title:'UTM',
      text:'Параметры в ссылке, которые помогают аналитике различать источник, канал, кампанию и другие характеристики перехода.'
    },
    {
      key:'subid',
      variants:['SubID','SubId','subid'],
      en:'Sub ID',
      title:'SubID',
      text:'Дополнительная метка в партнёрской ссылке для разделения источников, площадок, кампаний или отдельных публикаций.'
    },
    {
      key:'clickid',
      variants:['Click ID','Click ID','Click ID','идентификатором клика'],
      en:'Click ID / Click Identifier',
      title:'Click ID',
      text:'Уникальное значение, которое связывает конкретный переход с последующей конверсией в системе отслеживания.'
    },
    {
      key:'postback',
      variants:['Postback','Postbackа','Postbackом','postback','Postback'],
      en:'Postback / Server-to-server callback',
      title:'Postback',
      text:'Серверное уведомление о конверсии. Оно позволяет передавать событие между партнёрской программой и системой отслеживания без браузерного пикселя.'
    },
    {
      key:'landing',
      variants:['Landing page','Landing page','Landing page','Landing page','посадочной странице'],
      en:'Landing page',
      title:'Landing page',
      text:'Страница, на которую пользователь попадает после рекламного перехода и где получает основную информацию перед целевым действием.'
    },
    {
      key:'prelanding',
      variants:['Pre-landing','Prelanding','Pre-landing','промежуточной страницы','промежуточную страницу','прелендинг','прелендинга'],
      en:'Pre-landing page',
      title:'Pre-landing',
      text:'Страница между источником трафика и основной посадочной страницей. Используется для дополнительного объяснения предложения или предварительного отбора аудитории.'
    },
    {
      key:'attribution',
      variants:['Attribution','Attribution','Attribution','Attribution','Attribution'],
      en:'Attribution',
      title:'Attribution',
      text:'Правило, по которому система определяет, какому источнику или партнёру засчитать конверсию.'
    },
    {
      key:'cohort',
      variants:['Cohort','Cohort','Cohort','когортой','когорте','когорт'],
      en:'Cohort',
      title:'Cohort',
      text:'Группа пользователей, объединённая общим признаком, например датой привлечения. Когортный анализ помогает смотреть результат на дистанции.'
    },
    {
      key:'ctr',
      variants:['CTR'],
      en:'Click-Through Rate',
      title:'CTR',
      text:'Доля кликов от числа показов. Сильно зависит от источника трафика, формата и аудитории.'
    },
    {
      key:'cta',
      variants:['CTA'],
      en:'Call to Action',
      title:'CTA',
      text:'Понятное действие, которое предлагается человеку после контента: открыть разбор, перейти на страницу или зарегистрироваться.'
    },
    {
      key:'retention',
      variants:['Retention'],
      en:'Audience Retention',
      title:'Retention',
      text:'Удержание аудитории: какая часть ролика или серии остаётся просмотренной и где зрители чаще всего уходят.'
    },
    {
      key:'reach',
      variants:['Reach'],
      en:'Reach',
      title:'Reach',
      text:'Число уникальных людей, которым площадка показала публикацию или ролик за выбранный период.'
    },
    {
      key:'tracking-term',
      variants:['Tracking'],
      en:'Tracking',
      title:'Tracking',
      text:'Система учёта пути от источника и конкретной публикации до регистрации, FTD и дохода.'
    },
    {
      key:'metrics-term',
      variants:['метрики','Метрики'],
      en:'Показатели',
      title:'Метрики',
      text:'Числовые показатели теста. Для первого разбора обычно достаточно кликов, регистраций, FTD, расходов и дохода.'
    },
    {
      key:'invite-link',
      variants:['invite links','invite link'],
      en:'Invite link',
      title:'Invite link',
      text:'Отдельная ссылка-приглашение в Telegram. Она помогает определить, из какого источника пришли новые подписчики.'
    },
    {
      key:'impressions',
      variants:['Impressions'],
      en:'Impressions',
      title:'Impressions',
      text:'Количество показов публикации, thumbnail или страницы в выдаче. Один человек может создать больше одного показа.'
    },
    {
      key:'content-cluster',
      variants:['Content cluster'],
      en:'Content cluster',
      title:'Content cluster',
      text:'Группа связанных страниц вокруг одной темы: опорная страница и отдельные ответы на соседние вопросы.'
    },
    {
      key:'query',
      variants:['Queries','Query'],
      en:'Search query',
      title:'Query',
      text:'Запрос, который пользователь ввёл в поиск. В Search Console запросы можно сравнивать по Impressions, clicks и CTR.'
    },
    {
      key:'cpc',
      variants:['CPC'],
      en:'Cost Per Click',
      title:'CPC',
      text:'Средняя стоимость одного оплаченного клика.'
    },
    {
      key:'cr-term',
      variants:['CR'],
      en:'Conversion Rate',
      title:'CR',
      text:'Доля пользователей, которые перешли с одного этапа воронки на следующий.'
    },
    {
      key:'cpm-term',
      variants:['CPM'],
      en:'Cost Per Mille',
      title:'CPM',
      text:'Стоимость тысячи рекламных показов.'
    },
    {
      key:'cpl-term',
      variants:['CPL'],
      en:'Cost Per Lead',
      title:'CPL',
      text:'Стоимость одного лида или регистрации, если это действие используется как промежуточная цель.'
    },
    {
      key:'ltv-term',
      variants:['LTV'],
      en:'Lifetime Value',
      title:'LTV',
      text:'Суммарная ценность пользователя или группы пользователей за весь период активности.'
    },
    {
      key:'roi',
      variants:['ROI'],
      en:'Return on Investment',
      title:'ROI',
      text:'Показатель окупаемости: результат относительно затрат за выбранный период.'
    },
    {
      key:'attribution-window',
      variants:['окно Attribution','окна Attribution','окном Attribution'],
      en:'Attribution window',
      title:'Окно Attribution',
      text:'Период, в течение которого конверсия после клика может быть засчитана источнику или партнёру.'
    },
    {
      key:'tracker',
      variants:['Tracker','Tracker','Tracker','Tracker','Tracker'],
      en:'Tracking platform / Tracker',
      title:'Tracker',
      text:'Система для учёта переходов, источников, меток и конверсий, а также для сопоставления данных между рекламой и партнёрской программой.'
    },
    {
      key:'geo',
      variants:['GEO','GEO','GEO','GEO'],
      en:'GEO',
      title:'GEO',
      text:'Страна или рынок, на который направлен трафик. Условия Offer, доступность продукта и правила продвижения могут заметно различаться по GEO.'
    },
    {
      key:'url-term',
      variants:['URL'],
      en:'Uniform Resource Locator',
      title:'URL',
      text:'Адрес страницы или другого ресурса в интернете.'
    },
    {
      key:'sitemap-term',
      variants:['sitemap.xml'],
      en:'XML sitemap',
      title:'sitemap.xml',
      text:'Файл со списком важных URL сайта, который помогает поисковой системе обнаруживать страницы.'
    },
    {
      key:'seo-term',
      variants:['SEO'],
      en:'Search Engine Optimization',
      title:'SEO',
      text:'Работа со структурой, содержанием и техническим состоянием сайта для получения трафика из поиска.'
    },
    {
      key:'ggy-term',
      variants:['GGY','Gross Gambling Yield'],
      en:'Gross Gambling Yield',
      title:'GGY',
      text:'Показатель валового игрового дохода в отчётности некоторых регуляторов. Определение нужно сверять с конкретным источником.'
    },
    {
      key:'conversion-term',
      variants:['конверсия','конверсии','конверсию','конверсий'],
      en:'Conversion',
      title:'Конверсия',
      text:'Переход человека на следующий этап воронки. Например, из клика в регистрацию или из регистрации в FTD.'
    },
    {
      key:'funnel-term',
      variants:['воронка','воронки','воронку','воронке'],
      en:'Funnel',
      title:'Воронка',
      text:'Последовательность измеримых этапов: показ, клик, регистрация, FTD и дальнейшая активность игрока.'
    },
    {
      key:'creative-term',
      variants:['креатив','креатива','креативы','креативов'],
      en:'Creative',
      title:'Креатив',
      text:'Объявление, ролик, изображение или текст, с которого человек начинает знакомство с предложением.'
    },
    {
      key:'hold-term',
      variants:['холд','холда','холдом'],
      en:'Hold',
      title:'Холд',
      text:'Период проверки конверсии перед подтверждением и выплатой.'
    },
    {
      key:'qualified-ftd-term',
      variants:['квалифицированный FTD','квалифицированного FTD','квалификация FTD','квалификации FTD'],
      en:'Qualified FTD',
      title:'Квалифицированный FTD',
      text:'Первый депозит, который выполнил дополнительные условия партнёрской программы и может быть засчитан к выплате.'
    },
    {
      key:'fraud-term',
      variants:['фрод','фрода'],
      en:'Fraud',
      title:'Фрод',
      text:'Недействительные или искусственно созданные действия, которые партнёрская программа может отклонить.'
    },
    {
      key:'cookie-term',
      variants:['куки'],
      en:'Cookie',
      title:'Куки',
      text:'Данные в браузере, которые могут использоваться для сохранения информации о переходе и Attribution.'
    },
    {
      key:'pixel-term',
      variants:['пиксель','пикселя','пикселем'],
      en:'Tracking pixel',
      title:'Пиксель',
      text:'Код на странице, который передаёт системе аналитики просмотр или другое событие.'
    },
    {
      key:'server-tracking-term',
      variants:['серверный трекинг','серверного трекинга','серверным трекингом'],
      en:'Server-to-server tracking',
      title:'Серверный трекинг',
      text:'Передача событий напрямую между серверами, без зависимости от браузерного пикселя.'
    },
    {
      key:'redirect-term',
      variants:['редирект','редиректа','редиректом'],
      en:'Redirect',
      title:'Редирект',
      text:'Автоматическое перенаправление пользователя с одного URL на другой.'
    },
    {
      key:'organic-traffic-term',
      variants:['органический трафик','органического трафика','органическим трафиком'],
      en:'Organic traffic',
      title:'Органический трафик',
      text:'Переходы из поиска, рекомендаций и собственных материалов без оплаты за каждый показ или клик.'
    },
    {
      key:'paid-traffic-term',
      variants:['платный трафик','платного трафика','платным трафиком'],
      en:'Paid traffic',
      title:'Платный трафик',
      text:'Трафик, который покупают через рекламный кабинет, сеть или другой оплачиваемый канал.'
    },
    {
      key:'motivated-traffic-term',
      variants:['мотивированный трафик','мотивированного трафика'],
      en:'Incentivized traffic',
      title:'Мотивированный трафик',
      text:'Пользователи получают отдельное вознаграждение за регистрацию или другое действие. Такой источник часто ограничен правилами Offer.'
    },
    {
      key:'negative-carry-term',
      variants:['перенос отрицательного баланса','переноса отрицательного баланса'],
      en:'Negative carryover',
      title:'Перенос отрицательного баланса',
      text:'Условие RevShare, при котором минус одного расчётного периода переходит в следующий.'
    }
  ];

  const root = document.querySelector('main');
  if(!root) return;

  const excluded = new Set(['SCRIPT','STYLE','A','BUTTON','INPUT','TEXTAREA','SELECT','OPTION','CODE','PRE','H1','H2','H3','H4','H5','H6','DT','DD']);
  const marked = new Set();

  function escapeRx(s){
    return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }

  function findTerm(text){
    for(const item of dictionary){
      if(marked.has(item.key)) continue;
      const variants=[...item.variants].sort((a,b)=>b.length-a.length);
      for(const variant of variants){
        const rx=new RegExp('(^|[^A-Za-zА-Яа-яЁё0-9])('+escapeRx(variant)+')(?=$|[^A-Za-zА-Яа-яЁё0-9])','i');
        const m=text.match(rx);
        if(m) return {item, index:m.index+m[1].length, value:m[2]};
      }
    }
    return null;
  }

  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      if(!node.nodeValue || node.nodeValue.trim().length<3) return NodeFilter.FILTER_REJECT;
      let p=node.parentElement;
      if(!p) return NodeFilter.FILTER_REJECT;
      if(excluded.has(p.tagName) || p.closest('.breadcrumbs,.article-meta,.library-meta,.library-type,.site-footer,.global-sidebar,.term-tooltip,.glossary,.article-aside,.source-note')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes=[];
  let node;
  while(node=walker.nextNode()) nodes.push(node);

  for(const textNode of nodes){
    const hit=findTerm(textNode.nodeValue);
    if(!hit) continue;

    const before=textNode.nodeValue.slice(0,hit.index);
    const after=textNode.nodeValue.slice(hit.index+hit.value.length);
    const frag=document.createDocumentFragment();

    if(before) frag.appendChild(document.createTextNode(before));

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='term-help';
    btn.textContent=hit.value;
    btn.dataset.term=hit.item.key;
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-label',hit.item.title+': открыть объяснение');
    frag.appendChild(btn);

    if(after) frag.appendChild(document.createTextNode(after));
    textNode.replaceWith(frag);
    marked.add(hit.item.key);
  }

  const tooltip=document.createElement('div');
  tooltip.className='term-tooltip';
  tooltip.setAttribute('role','tooltip');
  tooltip.setAttribute('aria-hidden','true');
  document.body.appendChild(tooltip);

  let active=null;

  function hintsEnabled(){
    return !document.body.classList.contains('hints-off');
  }

  function syncHintState(){
    const enabled=hintsEnabled();
    document.querySelectorAll('.term-help').forEach(btn=>{
      btn.disabled=!enabled;
      btn.setAttribute('aria-disabled',enabled?'false':'true');
      btn.tabIndex=enabled?0:-1;
    });
    if(!enabled)close();
  }

  function dataFor(btn){
    return dictionary.find(x=>x.key===btn.dataset.term);
  }

  function position(btn){
    const r=btn.getBoundingClientRect();
    const tt=tooltip.getBoundingClientRect();
    const gap=9;
    let top=r.bottom+gap;
    let left=r.left;
    let side='bottom';

    if(top+tt.height>window.innerHeight-10 && r.top-tt.height-gap>10){
      top=r.top-tt.height-gap;
      side='top';
    }
    if(left+tt.width>window.innerWidth-10) left=window.innerWidth-tt.width-10;
    if(left<10) left=10;

    tooltip.style.top=Math.round(top)+'px';
    tooltip.style.left=Math.round(left)+'px';
    tooltip.dataset.side=side;

    const arrow=Math.max(14,Math.min(tt.width-20,r.left+r.width/2-left-5));
    tooltip.style.setProperty('--arrow-left',arrow+'px');
  }

  function open(btn){
    const item=dataFor(btn);
    if(!item) return;
    if(active && active!==btn) active.setAttribute('aria-expanded','false');

    tooltip.innerHTML=
      '<span class="term-en">англ. '+item.en+'</span>'+
      '<strong>'+item.title+'</strong>'+
      '<p>'+item.text+'</p>'+
      '<span class="term-hint">Нажмите вне подсказки, чтобы закрыть.</span>';

    tooltip.classList.add('open');
    tooltip.setAttribute('aria-hidden','false');
    btn.setAttribute('aria-expanded','true');
    active=btn;

    requestAnimationFrame(()=>position(btn));
  }

  function close(){
    if(active) active.setAttribute('aria-expanded','false');
    active=null;
    tooltip.classList.remove('open');
    tooltip.setAttribute('aria-hidden','true');
  }

  document.addEventListener('click',function(e){
    const btn=e.target.closest('.term-help');
    if(btn){
      if(!hintsEnabled())return;
      e.preventDefault();
      e.stopPropagation();
      if(active===btn && tooltip.classList.contains('open')) close();
      else open(btn);
      return;
    }
    if(!e.target.closest('.term-tooltip')) close();
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape') close();
  });

  window.addEventListener('resize',()=>{if(active) position(active)});
  window.addEventListener('scroll',()=>{if(active) position(active)},{passive:true});
  document.addEventListener('al:hintschange',syncHintState);
  syncHintState();
}catch(e){console.error('iGaming Traffic Academy module 3 error',e);}})();


/* v38: card navigation is semantic HTML and does not require JavaScript. */

/* v38: mobile navigation moved to core.js */

/* v32 - source chooser: explain, remember, continue */
(function(){try{
 const root=document.getElementById('sourceWizard');
 const STORAGE='al-selected-source-v1';
 const names={search:'Поисковый трафик',video:'Видео и короткие ролики',community:'Сообщества и мессенджеры',social:'Социальные сети',ads:'Платная реклама',stream:'Стримы и прямые эфиры',site:'Свой сайт и контентный проект'};
 function saved(){try{return JSON.parse(localStorage.getItem(STORAGE)||'null')}catch(e){return null}}
 function save(key){try{localStorage.setItem(STORAGE,JSON.stringify({key,name:names[key]||key,ts:Date.now()}))}catch(e){}}
 if(!root) return;
 const questions=[
  {q:'Есть бюджет на закупку трафика?',opts:[['noBudget','Нет, хочу начать без закупки'],['budget','Да, могу покупать трафик']]},
  {q:'Готов регулярно делать контент?',opts:[['content','Да'],['noContent','Скорее нет']]},
  {q:'Уже есть своя аудитория или сообщество?',opts:[['audience','Да'],['noAudience','Нет']]},
  {q:'Что сейчас важнее?',opts:[['fast','Быстрее получить первые измеримые данные'],['long','Строить источник надолго']]}
 ];
 const sources={
  search:{name:names.search,url:'/Affiliate_Lab/traffic/sources/search/',pace:'Медленный старт',desc:'Подходит, если готов отвечать на уже существующие вопросы и ждать, пока страницы начнут получать показы.',first:'Выбрать одну узкую тему и собрать 5–10 реальных вопросов пользователей.'},
  video:{name:names.video,url:'/Affiliate_Lab/guides/video-traffic/',pace:'Нужна серия попыток',desc:'Первые результаты обычно появляются быстрее, чем в поиске, но один ролик ничего не доказывает.',first:'Сделать 5–10 роликов одного формата и дать каждому отдельную метку.'},
  community:{name:names.community,url:'/Affiliate_Lab/traffic/sources/communities/',pace:'Работает через доверие',desc:'Подходит, когда тематика сообщества совпадает с интересом взрослой аудитории к игровому предложению.',first:'Выбрать подходящее сообщество, дать один понятный повод перейти и считать путь от клика до FTD.'},
  social:{name:names.social,url:'/Affiliate_Lab/traffic/sources/social/',pace:'Нужна регулярность',desc:'Подходит для привлечения игроков через короткие публикации и ролики в холодной ленте.',first:'Выбрать один формат, выпустить 10–20 сопоставимых публикаций и считать переходы, регистрации и FTD.'},
  ads:{name:names.ads,url:'/Affiliate_Lab/traffic/sources/paid/',pace:'Быстрые данные, платный риск',desc:'Даёт быструю обратную связь, если площадка разрешает такой трафик и расход ограничен заранее.',first:'Задать бюджет, ожидаемый объём кликов и точку остановки до запуска.'},
  stream:{name:names.stream,url:'/Affiliate_Lab/traffic/sources/streams/',pace:'Сильно зависит от ведущего',desc:'Подходит тем, кто готов работать вживую и может удерживать внимание, а не просто вывести ссылку на экран.',first:'Провести 3–5 эфиров и отдельно записать онлайн, клики и дальнейшие действия.'},
  site:{name:names.site,url:'/Affiliate_Lab/guides/content-sites/',pace:'Проект на месяцы',desc:'Даёт контроль над материалами, ссылками и аналитикой, но не приносит быстрый поток сам по себе.',first:'Собрать один связанный раздел из 3–5 материалов вокруг одной задачи.'}
 };
 const memory=root.querySelector('#wizardMemory'),prev=saved();
 let state={},step=0;
 const qEl=root.querySelector('#wizardQuestion'),opts=root.querySelector('#wizardOptions'),results=root.querySelector('#wizardResults'),label=root.querySelector('#wizardStepLabel'),bar=root.querySelector('#wizardProgressBar'),progress=root.querySelector('#wizardProgress'),gate=root.querySelector('#wizardGate'),startButton=root.querySelector('#wizardStartButton');
 if(memory&&prev&&sources[prev.key]){memory.hidden=false;memory.innerHTML=`Последний выбор: <b>${sources[prev.key].name}</b>, <a href="/Affiliate_Lab/tools/">использовать в инструментах</a>`;if(startButton)startButton.textContent='Подобрать другой источник'}
 function render(){if(gate)gate.hidden=true;if(progress)progress.hidden=false;results.hidden=true;qEl.hidden=false;opts.hidden=false;const item=questions[step];label.textContent=`Вопрос ${step+1} из ${questions.length}`;bar.style.width=((step+1)/questions.length*100)+'%';qEl.textContent=item.q;opts.innerHTML=item.opts.map(([k,t])=>`<button type="button" class="wizard-option" data-answer="${k}">${t}</button>`).join('')}
 function scoreSources(){
  const score={search:0,video:0,community:0,social:0,ads:0,stream:0,site:0};
  if(state.budget==='noBudget'){score.ads=-100;score.search+=2;score.video+=2;score.social+=2;score.community+=1;score.site+=2;score.stream+=1}else score.ads+=6;
  if(state.content==='content'){score.search+=3;score.video+=6;score.social+=5;score.stream+=3;score.site+=5;score.community+=2}else{score.ads+=3;score.community+=3;score.search-=4;score.video-=6;score.social-=5;score.stream-=5;score.site-=6}
  if(state.audience==='audience'){score.community+=7;score.stream+=5;score.social+=4;score.video+=2;score.ads+=1}else{score.search+=2;score.video+=2;score.social+=2;score.site+=2;score.community-=4;score.stream-=2}
  if(state.goal==='fast'){score.ads+=7;score.video+=3;score.social+=2;score.community+=3;score.stream+=2;score.search-=8;score.site-=8}else{score.search+=7;score.site+=7;score.video+=2;score.social+=2;score.community+=1}
  return score;
 }
 function reasons(key){
  const r=[];
  if(key==='ads'&&state.budget==='budget')r.push('есть бюджет на закупку');
  if(['video','social','stream','search','site'].includes(key)&&state.content==='content')r.push('готов регулярно делать контент');
  if(['community','stream','social'].includes(key)&&state.audience==='audience')r.push('уже есть своя аудитория');
  if(['ads','video','social','community','stream'].includes(key)&&state.goal==='fast')r.push('важна более быстрая обратная связь');
  if(['search','site'].includes(key)&&state.goal==='long')r.push('важнее строить долгий источник');
  if(['search','video','social','site'].includes(key)&&state.audience==='noAudience')r.push('можно начинать без готовой аудитории');
  if(key!=='ads'&&state.budget==='noBudget')r.push('не требует обязательной закупки трафика');
  return r.slice(0,3);
 }
 function finish(){
  const conflict=state.budget==='noBudget'&&state.content==='noContent'&&state.audience==='noAudience';qEl.hidden=true;opts.hidden=true;results.hidden=false;label.textContent='Результат';bar.style.width='100%';
  if(conflict){results.innerHTML='<span class="wizard-result-label">Сначала стоит изменить одно условие</span><div class="wizard-conflict"><b>Сейчас не хватает точки входа</b><p>Без бюджета, готовности регулярно делать контент или уже существующей аудитории нельзя выбрать рабочий источник только настройками. Сначала реши, что готов добавить: время на контент, бюджет на закупку или работу над собственной аудиторией.</p><a href="/Affiliate_Lab/traffic/compare/">Сравнить источники</a></div><button type="button" class="wizard-restart">Пройти ещё раз</button>'}
  else{
   const score=scoreSources();const top=Object.entries(score).filter(([,v])=>v>-20).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([key])=>({key,...sources[key]}));
   if(top[0])save(top[0].key);
   results.innerHTML='<span class="wizard-result-label">Сначала посмотри эти направления</span><div class="wizard-results-grid">'+top.map(s=>`<a class="wizard-result" href="${s.url}"><small>${s.pace}</small><b>${s.name}</b><p>${s.desc}</p><div class="wizard-why"><strong>Почему:</strong>${reasons(s.key).map(x=>`<span>${x}</span>`).join('')}</div><div class="wizard-plan"><strong>Первый рабочий шаг</strong><span>${s.first}</span></div><em>Открыть разбор</em></a>`).join('')+'</div><div class="wizard-continuation"><span>Выбор сохранён в этом браузере.</span><a href="/Affiliate_Lab/tools/">Посчитать первый тест</a><a href="/Affiliate_Lab/traffic/compare/">Сравнить его с другим</a></div><button type="button" class="wizard-restart">Пройти ещё раз</button>';
  }
  results.querySelector('.wizard-restart')?.addEventListener('click',()=>{state={};step=0;render()});
 }
 opts.addEventListener('click',e=>{const b=e.target.closest('[data-answer]');if(!b)return;if(step===0)state.budget=b.dataset.answer;if(step===1)state.content=b.dataset.answer;if(step===2)state.audience=b.dataset.answer;if(step===3)state.goal=b.dataset.answer;step++;if(step>=questions.length)finish();else render()});
 if(startButton){startButton.addEventListener('click',()=>{state={};step=0;render();if(window.alTrack)window.alTrack('source_wizard_start',{})});}
 else render();
}catch(e){console.error('iGaming Traffic Academy module 4 error',e);}})();

/* v32 - remembered source helper */
(function(){try{
 const KEY='al-selected-source-v1';
 const names={search:'Поисковый трафик',video:'Видео и короткие ролики',community:'Сообщества и мессенджеры',social:'Социальные сети',ads:'Платная реклама',stream:'Стримы и прямые эфиры',site:'Свой сайт и контентный проект'};
 function saved(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}}
 const data=saved();if(!data||!names[data.key])return;
 const bar=document.getElementById('toolMemory');
 if(bar){bar.hidden=false;bar.innerHTML=`<span>Источник из мастера</span><b>${names[data.key]}</b><p>Он выбран как исходный вариант. Любой список ниже можно изменить вручную.</p>`}
 ['planSource','diagSource','cmpSourceA'].forEach(id=>{const el=document.getElementById(id);if(el&&[...el.options].some(o=>o.value===data.key))el.value=data.key});
 const cmp=document.getElementById('sourceCompareA');if(cmp&&[...cmp.options].some(o=>o.value===data.key))cmp.value=data.key;
 const problem=document.getElementById('problemSource');if(problem&&[...problem.options].some(o=>o.value===data.key))problem.value=data.key;
 const compareMemory=document.getElementById('sourceCompareMemory');if(compareMemory){compareMemory.hidden=false;compareMemory.innerHTML=`Источник из мастера: <b>${names[data.key]}</b>. Он автоматически поставлен в колонку A.`}
 const problemSaved=document.getElementById('problemSavedSource');if(problemSaved)problemSaved.textContent=`Из мастера: ${names[data.key]}`;
}catch(e){console.error('iGaming Traffic Academy module 5 error',e);}})();

/* v33 - bookmarks, reading history and stable continuation */
(function(){try{
 const BOOK='al-bookmarks-v1', RECENT='al-recent-v1', STATE='al-reading-state-v1';
 const get=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback))}catch(e){return fallback}};
 const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
 const getStates=()=>get(STATE,{});
 const setState=(url,data)=>{const states=getStates();states[url]={...(states[url]||{}),...data};set(STATE,states)};
 const article=document.querySelector('article.article');

 function stateFor(url){return getStates()[url]||null}
 function pctLabel(progress){
   const p=Math.max(0,Math.min(100,Math.round((progress||0)*100/5)*5));
   return p>0?`Прочитано около ${p}%`:'Начато';
 }

 if(article && location.pathname.startsWith('/Affiliate_Lab/guides/')){
  const title=article.querySelector('h1')?.textContent.trim()||document.title;
  const section=article.querySelector('.article-meta b')?.textContent.trim()||'Материал';
  const nextCard=article.querySelector('.related-reading .related-primary');
  const item={url:location.pathname,title,section,ts:Date.now()};
  const recent=get(RECENT,[]).filter(x=>x.url!==item.url); recent.unshift(item); set(RECENT,recent.slice(0,10));

  const nextUrl=nextCard?.getAttribute('href')||'';
  const nextTitle=nextCard?.querySelector('b')?.textContent.trim()||'';
  const nextSection=nextCard?.querySelector('span')?.textContent.trim()||'';
  setState(item.url,{...item,nextUrl,nextTitle,nextSection,visited:true,ts:Date.now()});

  let ticking=false;
  function saveProgress(){
    const doc=document.documentElement;
    const max=Math.max(1,doc.scrollHeight-window.innerHeight);
    const progress=Math.max(0,Math.min(1,window.scrollY/max));
    setState(item.url,{...item,progress,scrollY:window.scrollY,nextUrl,nextTitle,nextSection,ts:Date.now()});
    ticking=false;
  }
  window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(saveProgress)}},{passive:true});
  window.addEventListener('pagehide',saveProgress);

  const params=new URLSearchParams(location.search);
  if(params.get('continue')==='1'){
    const saved=stateFor(item.url);
    if(saved&&saved.scrollY>120){
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:saved.scrollY,behavior:'auto'})));
    }
  }

  const btn=article.querySelector('[data-bookmark-button]');
  if(btn){
   const refresh=()=>{const saved=get(BOOK,[]).some(x=>x.url===item.url);btn.classList.toggle('saved',saved);btn.setAttribute('aria-pressed',saved?'true':'false');btn.textContent=saved?'В закладках':'Сохранить в закладки'};
   btn.addEventListener('click',()=>{let list=get(BOOK,[]); if(list.some(x=>x.url===item.url))list=list.filter(x=>x.url!==item.url);else list.unshift(item);set(BOOK,list.slice(0,50));refresh()}); refresh();
  }
 }

 function card(item,removable){
   const st=stateFor(item.url);
   const progress=st?.progress||0;
   const resume=progress>0.05&&progress<0.82?item.url+'?continue=1':item.url;
   const progressText=progress>0.05?pctLabel(progress):'';
   return `<article class="saved-card"><a class="saved-card-main" href="${resume}"><span>${item.section||'Материал'}</span><b>${item.title}</b>${progressText?`<small>${progressText}</small>`:`<small>${item.ts?new Date(item.ts).toLocaleDateString('ru-RU'):''}</small>`}</a>${removable?`<button type="button" class="saved-card-remove" data-remove-url="${item.url}" aria-label="Удалить из закладок">×</button>`:''}</article>`;
 }
 function renderSaved(){
  const bList=document.querySelector('[data-bookmark-list]'),rList=document.querySelector('[data-recent-list]');
  if(bList){const data=get(BOOK,[]);bList.innerHTML=data.map(x=>card(x,true)).join('');document.querySelector('[data-bookmark-empty]').hidden=data.length>0}
  if(rList){const data=get(RECENT,[]);rList.innerHTML=data.map(x=>card(x,false)).join('');document.querySelector('[data-recent-empty]').hidden=data.length>0}
 }
 document.addEventListener('click',e=>{const rm=e.target.closest('[data-remove-url]');if(rm){e.preventDefault();e.stopPropagation();set(BOOK,get(BOOK,[]).filter(x=>x.url!==rm.dataset.removeUrl));renderSaved()}});
 document.querySelector('[data-clear-bookmarks]')?.addEventListener('click',()=>{set(BOOK,[]);renderSaved()});
 document.querySelector('[data-clear-recent]')?.addEventListener('click',()=>{set(RECENT,[]);renderSaved()});
 renderSaved();

 // Stable home slot: always appears in the same place, never reorders the page.
 const home=document.querySelector('[data-continue-home]'),box=document.querySelector('[data-continue-card]');
 if(home&&box){
   const recent=get(RECENT,[]);
   const last=recent[0];
   if(last){
     const st=stateFor(last.url)||{};
     const progress=st.progress||0;
     home.hidden=false;
     if(progress>=0.78 && st.nextUrl && st.nextTitle){
       box.innerHTML=`<div class="continue-copy"><span>Продолжить путь</span><h2>${st.nextTitle}</h2><p>Предыдущий материал почти дочитан. Продолжение связано с ним по смыслу.</p></div><div class="continue-actions"><a class="continue-primary" href="${st.nextUrl}">Открыть следующий материал</a><a class="continue-secondary" href="${last.url}">Вернуться к предыдущему</a></div>`;
     }else{
       const label=progress>0.05?pctLabel(progress):'Недавно открывали';
       box.innerHTML=`<div class="continue-copy"><span>Продолжить чтение</span><h2>${last.title}</h2><p>${label}. Можно вернуться к месту, где остановились, или открыть материал сначала.</p></div><div class="continue-actions"><a class="continue-primary" href="${last.url}?continue=1">Продолжить</a><a class="continue-secondary" href="${last.url}">Начать сначала</a></div>`;
     }
   }
 }
}catch(e){console.error('iGaming Traffic Academy module 6 error',e);}})();

/* v50 - structured test notes stored on this device */
(function(){try{
 const KEY='al-notes-v1',RECENT='al-recent-v1',BOOK='al-bookmarks-v1';
 const get=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch(e){return f}};
 const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
 const article=document.querySelector('article.article');
 if(article){
  const notesLink=article.querySelector('.saved-link');
  if(notesLink){notesLink.href='/Affiliate_Lab/notes/?from='+encodeURIComponent(location.pathname);notesLink.textContent='В рабочий журнал'}
 }
 const form=document.querySelector('[data-note-form]');
 if(!form)return;
 const titleInput=form.querySelector('[data-note-title]');
 const bodyInput=form.querySelector('[data-note-body]');
 const templateButton=form.querySelector('[data-note-template]');
 const contextBox=form.querySelector('[data-note-context]');
 const list=document.querySelector('[data-note-list]');
 const empty=document.querySelector('[data-note-empty]');
 const from=new URLSearchParams(location.search).get('from')||'';
 const known=[...get(RECENT,[]),...get(BOOK,[])].find(x=>x.url===from);
 const context=from.startsWith('/Affiliate_Lab/')?{url:from,title:known?.title||'Материал iGaming Traffic Academy'}:null;
 if(context&&contextBox){contextBox.textContent='К материалу: ';const link=document.createElement('a');link.href=context.url;link.textContent=context.title;contextBox.appendChild(link)}
 else if(contextBox)contextBox.textContent='Одна запись описывает один тест и одно проверяемое изменение.';
 const TEST_TEMPLATE='Источник трафика:\nПлощадка или формат:\nСтрана / GEO:\nПартнёрская программа или предложение:\nМетка ссылки:\nПериод или лимит теста:\nЧто проверяю:\n\nПоказы / просмотры:\nКлики:\nРегистрации:\nПервые депозиты (FTD):\nРасход:\n\nВывод:\nЧто изменяю в следующем тесте:';
 templateButton?.addEventListener('click',()=>{
  if(bodyInput.value.trim()&&!confirm('Заменить текущий текст шаблоном?'))return;
  bodyInput.value=TEST_TEMPLATE;
  bodyInput.focus();
 });
 function render(){
  const data=get(KEY,[]);
  list.innerHTML='';
  data.forEach(item=>{
   const card=document.createElement('article');card.className='note-card';
   const label=document.createElement('span');label.textContent='Тест';card.appendChild(label);
   const h=document.createElement('h3');h.textContent=item.title;card.appendChild(h);
   const p=document.createElement('p');p.textContent=item.body;card.appendChild(p);
   if(item.url){const a=document.createElement('a');a.href=item.url;a.textContent=item.sourceTitle||'Открыть связанный материал';card.appendChild(a)}
   const date=document.createElement('small');date.textContent=new Date(item.ts).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});card.appendChild(date);
   const remove=document.createElement('button');remove.type='button';remove.className='note-card-remove';remove.dataset.removeNote=item.id;remove.setAttribute('aria-label','Удалить запись');remove.textContent='×';card.appendChild(remove);
   list.appendChild(card);
  });
  if(empty)empty.hidden=data.length>0;
 }
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const title=titleInput.value.trim(),body=bodyInput.value.trim();if(!title||!body)return;
  const notes=get(KEY,[]);notes.unshift({id:String(Date.now())+'-'+Math.random().toString(36).slice(2,7),title,body,url:context?.url||'',sourceTitle:context?.title||'',ts:Date.now()});set(KEY,notes.slice(0,100));
  form.reset();render();titleInput.focus();
 });
 document.addEventListener('click',e=>{const btn=e.target.closest('[data-remove-note]');if(!btn)return;set(KEY,get(KEY,[]).filter(x=>x.id!==btn.dataset.removeNote));render()});
 document.querySelector('[data-clear-notes]')?.addEventListener('click',()=>{set(KEY,[]);render()});
 render();
}catch(e){console.error('iGaming Traffic Academy notes error',e);}})();

/* v32 - three core tools + remembered source */
(function(){try{
 const KEY='al-selected-source-v1';
 const presets={
  search:{name:'Поисковый трафик',reg:null,ftd:null,cpc:0,hint:'Внеси конверсию своей страницы: поисковый клик → регистрация и регистрация → первый депозит. Стоимость клика для органического поиска оставь 0 ₽.'},
  video:{name:'Видео и короткие ролики',reg:null,ftd:null,cpc:0,hint:'Внеси цифры своей серии роликов. Длинные видео и короткие ролики считай отдельно, иначе расчёт потеряет смысл.'},
  community:{name:'Сообщества и мессенджеры',reg:null,ftd:null,cpc:0,hint:'Внеси данные конкретного сообщества или канала. Не объединяй несколько площадок в одну среднюю конверсию.'},
  ads:{name:'Платная реклама',reg:null,ftd:null,cpc:0,hint:'Внеси фактическую цену клика и свои конверсии из рекламного и партнёрского кабинетов. Сайт не подставляет рыночные ориентиры.'},
  stream:{name:'Стримы и прямые эфиры',reg:null,ftd:null,cpc:0,hint:'Внеси данные серии сопоставимых эфиров. Один удачный стрим не подходит как исходная конверсия для расчёта.'},
  social:{name:'Социальные сети',reg:null,ftd:null,cpc:0,hint:'Внеси цифры одной площадки и одного формата. Не смешивай холодную ленту, подписчиков и другие источники.'},
  site:{name:'Свой сайт и контентный проект',reg:null,ftd:null,cpc:0,hint:'Внеси данные конкретной страницы или кластера: партнёрские клики, регистрации и первые депозиты.'}
 };
 const n=id=>parseFloat(document.getElementById(id)?.value||0),fmt=x=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(x),pct=x=>x/100;
 function selected(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&presets[x.key]?x.key:null}catch(e){return null}}
 function setValue(id,v){const el=document.getElementById(id);if(el)el.value=v===null?'':v}
 function calcPlan(){const out=document.getElementById('planResultV30');if(!out)return;const target=Math.max(1,Math.round(n('planTarget'))),rv=n('planRegRateV30'),fv=n('planFtdRateV30');if(!rv||!fv){out.innerHTML='<p>Укажи две конверсии из своей статистики или тестового сценария, чтобы посчитать объём.</p>';return}const r=Math.max(.001,pct(rv)),f=Math.max(.001,pct(fv)),regs=Math.ceil(target/f),clicks=Math.ceil(regs/r),budget=clicks*Math.max(0,n('planCpcV30'));out.innerHTML=`<div class="tool-result-main"><div class="tool-result-stat"><b>${fmt(clicks)}</b><span>кликов</span></div><div class="tool-result-stat"><b>${fmt(regs)}</b><span>регистраций</span></div><div class="tool-result-stat"><b>${fmt(target)}</b><span>FTD</span></div><div class="tool-result-stat"><b>${fmt(budget)} ₽</b><span>примерный бюджет</span></div></div>`}
 function initPlan(){const source=document.getElementById('planSource');if(!source)return;const apply=()=>{const p=presets[source.value];setValue('planRegRateV30',p.reg);setValue('planFtdRateV30',p.ftd);setValue('planCpcV30',p.cpc);document.getElementById('planSourceHint').textContent=p.hint;calcPlan()};source.addEventListener('change',apply);['planTarget','planRegRateV30','planFtdRateV30','planCpcV30'].forEach(id=>document.getElementById(id)?.addEventListener('input',calcPlan));const param=new URLSearchParams(location.search).get('source'),mem=selected();if(param&&presets[param])source.value=param;else if(mem&&[...source.options].some(o=>o.value===mem))source.value=mem;apply()}
 function calcDiag(){const out=document.getElementById('diagResult');if(!out)return;const src=document.getElementById('diagSource').value,p=presets[src],c=Math.max(0,Math.round(n('diagClicks'))),r=Math.max(0,Math.round(n('diagRegs'))),f=Math.max(0,Math.round(n('diagFtd'))),sp=Math.max(0,n('diagSpend')),cr1=c?r/c*100:0,cr2=r?f/r*100:0,cost=f&&sp?sp/f:0;let message='';if(c<100)message='Данных пока мало. На таком объёме один пользователь сильно меняет итоговые проценты.';else if(p.reg&&p.ftd){const d1=cr1/p.reg,d2=cr2/p.ftd;if(d1<.7&&d1<d2)message='Слабее выглядит переход от клика к регистрации. Сначала проверь соответствие аудитории, страницы и обещания в источнике.';else if(d2<.7)message='Слабее выглядит переход от регистрации к первому депозиту. Проверь качество аудитории, условия предложения и путь после регистрации.';else message='По двум основным этапам явного провала относительно демонстрационного сценария не видно. Дальше смотри качество FTD и результат на дистанции.'}else{if(r===0&&c>0)message='Клики есть, а регистраций нет. Сначала проверь соответствие аудитории странице и сам путь до регистрации.';else if(f===0&&r>0)message='Регистрации есть, а FTD нет. Проверь качество аудитории, условия продукта и путь после регистрации.';else message='Для этого источника сайт не использует универсальный эталон. Смотри динамику своей воронки и сравнивай только сопоставимые периоды.'}out.innerHTML=`<h3>${p.name}</h3><p>${message}</p><div class="diagnostic-flags"><div class="diagnostic-flag"><b>${fmt(cr1)}%</b><span>клик, регистрация</span></div><div class="diagnostic-flag"><b>${fmt(cr2)}%</b><span>регистрация, депозит</span></div><div class="diagnostic-flag"><b>${cost?fmt(cost)+' ₽':'-'}</b><span>расход на FTD</span></div></div><p><small>${p.reg&&p.ftd?'Сравнение идёт с демонстрационным сценарием выбранного источника, а не с «нормой рынка».':'Универсальная конверсия для этого источника не подставляется.'}</small></p>`}
 function initDiag(){const source=document.getElementById('diagSource');if(!source)return;const mem=selected();if(mem&&[...source.options].some(o=>o.value===mem))source.value=mem;['diagSource','diagClicks','diagRegs','diagFtd','diagSpend'].forEach(id=>document.getElementById(id)?.addEventListener('input',calcDiag));calcDiag()}
 function metrics(prefix){const c=Math.max(0,Math.round(n('cmpClicks'+prefix))),r=Math.max(0,Math.round(n('cmpRegs'+prefix))),f=Math.max(0,Math.round(n('cmpFtd'+prefix))),s=Math.max(0,n('cmpSpend'+prefix));return{c,r,f,s,cr1:c?r/c*100:0,cr2:r?f/r*100:0,per100:c?f/c*100:0,cost:f&&s?s/f:0}}
 function calcCmp(){const out=document.getElementById('cmpResult');if(!out)return;const a=metrics('A'),b=metrics('B'),nameA=document.getElementById('cmpSourceA').selectedOptions[0].textContent,nameB=document.getElementById('cmpSourceB').selectedOptions[0].textContent;let summary='';if(a.c<50||b.c<50)summary='Хотя бы в одном источнике пока слишком мало кликов для уверенного сравнения.';else if(Math.abs(a.per100-b.per100)<.3)summary='По первым депозитам на 100 кликов источники сейчас близки. Смотри дальше на стоимость и качество игроков.';else summary=(a.per100>b.per100?nameA:nameB)+' сейчас даёт больше FTD на 100 кликов. Это вывод только по введённой выборке.';out.innerHTML=`<h3>Сравнение по введённым данным</h3><p>${summary}</p><div class="compare-table"><div>Показатель</div><div>${nameA}</div><div>${nameB}</div><div>Клик, регистрация</div><div>${fmt(a.cr1)}%</div><div>${fmt(b.cr1)}%</div><div>Регистрация, депозит</div><div>${fmt(a.cr2)}%</div><div>${fmt(b.cr2)}%</div><div>Депозитов на 100 кликов</div><div>${fmt(a.per100)}</div><div>${fmt(b.per100)}</div><div>Расход на FTD</div><div>${a.cost?fmt(a.cost)+' ₽':'-'}</div><div>${b.cost?fmt(b.cost)+' ₽':'-'}</div></div>`}
 function initCmp(){const a=document.getElementById('cmpSourceA'),b=document.getElementById('cmpSourceB');if(!a||!b)return;const mem=selected();if(mem&&[...a.options].some(o=>o.value===mem))a.value=mem;if(a.value===b.value){const alt=[...b.options].find(o=>o.value!==a.value);if(alt)b.value=alt.value}['cmpSourceA','cmpClicksA','cmpRegsA','cmpFtdA','cmpSpendA','cmpSourceB','cmpClicksB','cmpRegsB','cmpFtdB','cmpSpendB'].forEach(id=>document.getElementById(id)?.addEventListener('input',calcCmp));calcCmp()}
 initPlan();initDiag();initCmp();
}catch(e){console.error('iGaming Traffic Academy module 7 error',e);}})();


/* v32 - diagnostic wizard */
(function(){try{
 const root=document.getElementById('problemWizard');if(!root)return;
 const source=root.querySelector('#problemSource'),stepOne=root.querySelector('#problemStepOne'),follow=root.querySelector('#problemFollow'),result=root.querySelector('#problemResult');let problem=null;
 const sourceNames={search:'поискового трафика',video:'видео',community:'сообществ',social:'социальных сетей',ads:'платной рекламы',stream:'стримов',site:'собственного сайта'};
 const configs={
  clicks:{q:'Переход ведёт сначала на твою страницу?',opts:[['own','Да, на свою страницу'],['direct','Нет, сразу на продукт']]},
  regs:{q:'Пользователь может нормально пройти путь до пополнения?',opts:[['unknown','Не проверял сам'],['works','Да, путь проверен']]},
  income:{q:'Основная модель выплаты - процент от дохода?',opts:[['rev','Да, процент от дохода'],['fixed','Нет, фиксированная выплата / другая модель']]},
  tracking:{q:'Расхождение связано с конкретными кликами или со всей статистикой?',opts:[['single','С отдельными кликами / конверсиями'],['all','С отчётом в целом']]},
  unknown:{q:'На каком этапе заметнее всего теряются люди?',opts:[['clicks','После клика'],['regs','После регистрации'],['later','После FTD'],['cant','Пока не понимаю']]}
 };
 function showFollow(p){problem=p;const c=configs[p];follow.hidden=false;result.hidden=true;follow.innerHTML=`<span>Уточнение</span><h2>${c.q}</h2><div class="problem-options">${c.opts.map(([k,t])=>`<button type="button" data-follow="${k}">${t}</button>`).join('')}</div><button type="button" class="problem-back"> Назад</button>`;stepOne.hidden=true;follow.querySelector('.problem-back').onclick=()=>{follow.hidden=true;stepOne.hidden=false}}
 function article(url,label){return `<a href="${url}">${label}</a>`}
 function renderResult(answer){const s=source.value,name=sourceNames[s]||'этого источника';let title='',checks=[],links=[];
  if(problem==='clicks'){title='Сначала проверь участок между кликом и регистрацией';checks=answer==='own'?['Совпадает ли обещание в источнике с тем, что человек видит на странице.','Понятно ли с первого экрана, куда пользователь попал и что делать дальше.','Не ломается ли страница или форма на мобильном устройстве.']:['Совпадает ли аудитория источника с продуктом и страной.','Не обещает ли креатив одно, а продукт показывает другое.','Проверь переход самостоятельно с телефона и компьютера.'];links=[article('/Affiliate_Lab/guides/clicks-no-registrations/','Полный разбор: клики без регистраций'),article('/Affiliate_Lab/guides/landing-page/','Когда нужна Landing page')];}
  if(problem==='regs'){title='Проверь путь после регистрации и качество аудитории';checks=answer==='unknown'?['Пройди регистрацию и путь до пополнения сам, на нужном устройстве и в нужной стране.','Проверь доступные способы оплаты и очевидные технические препятствия.','Только после этого делай вывод о качестве трафика.']:['Сравни регистрацию, FTD отдельно по '+name+'.','Проверь, не слишком ли широкая или случайная аудитория.','Уточни у менеджера условия квалификации FTD.'];links=[article('/Affiliate_Lab/guides/registrations-no-ftd/','Полный разбор: регистрации без депозитов'),article('/Affiliate_Lab/guides/ftd/','Что считается FTD')];}
  if(problem==='income'){title=answer==='rev'?'Не оценивай RevShare только по числу депозитов':'Проверь правила зачёта и выплаты';checks=answer==='rev'?['Уточни, от какой базы считается процент и какие вычеты применяются.','Смотри одну и ту же группу игроков на одинаковом временном горизонте.','Проверь, не искажает ли результат один крупный игрок.']:['Проверь, какие действия считаются квалифицированными.','Уточни холд, отклонения и условия выплаты.','Сравни фактически подтверждённые действия, а не только регистрации.'];links=[article('/Affiliate_Lab/guides/revshare/','Как устроен процент от дохода'),article('/Affiliate_Lab/guides/ggr-ngr/','Откуда берётся расчётная база')];}
  if(problem==='tracking'){title='Начни не с конверсии, а с маршрута данных';checks=answer==='single'?['Найди идентификатор конкретного клика или метку источника.','Сверь, прошла ли эта метка до партнёрской программы.','Проверь серверное уведомление о конверсии, если оно используется.']:['Сверь период и часовой пояс в двух системах.','Проверь, одинаково ли считаются уникальные и повторные события.','Раздели источники отдельными метками, чтобы не смешивать данные.'];links=[article('/Affiliate_Lab/guides/statistics-mismatch/','Полный разбор расхождений'),article('/Affiliate_Lab/guides/tracking/','Как устроен трекинг')];}
  if(problem==='unknown'){if(answer==='clicks'){problem='clicks';return renderResult('direct')}if(answer==='regs'){problem='regs';return renderResult('works')}if(answer==='later'){problem='income';return renderResult('rev')}title='Сначала собери четыре числа';checks=['Клики.','Регистрации.','Первые депозиты.','Доход или подтверждённые действия за тот же период.'];links=[article('/Affiliate_Lab/tools/#diagnose-result','Ввести эти данные в инструмент'),article('/Affiliate_Lab/guides/statistics/','Какие цифры смотреть')];}
  follow.hidden=true;result.hidden=false;result.innerHTML=`<span>С чего начать</span><h2>${title}</h2><ol>${checks.map(x=>`<li>${x}</li>`).join('')}</ol><div class="problem-result-links">${links.join('')}</div><button type="button" class="problem-restart">Разобрать другую проблему</button>`;result.querySelector('.problem-restart').onclick=()=>{problem=null;result.hidden=true;stepOne.hidden=false};
 }
 stepOne.addEventListener('click',e=>{const b=e.target.closest('[data-problem]');if(b)showFollow(b.dataset.problem)});follow.addEventListener('click',e=>{const b=e.target.closest('[data-follow]');if(b)renderResult(b.dataset.follow)});
}catch(e){console.error('iGaming Traffic Academy module 8 error',e);}})();

/* v32 - qualitative source comparison */
(function(){try{
 const root=document.getElementById('sourceComparePage');if(!root)return;
 const a=root.querySelector('#sourceCompareA'),b=root.querySelector('#sourceCompareB'),table=root.querySelector('#sourceCompareTable'),linkA=root.querySelector('#sourceCompareLinkA'),linkB=root.querySelector('#sourceCompareLinkB');
 const data={
  search:{name:'Поисковый трафик',url:'/Affiliate_Lab/traffic/sources/search/',start:'Полезные страницы под существующие запросы и технически доступный сайт.',audience:'Люди сами формулируют запрос и приходят из поиска.',feedback:'Индексация может занять дни или недели; заметный результат не имеет гарантированного быстрого срока.',after:'Опубликованные страницы остаются и могут продолжать получать переходы.',measure:'Запрос, страница, клик, регистрация, FTD.',trap:'Не путать индексацию страницы с появлением стабильного поискового трафика.'},
  video:{name:'Видео и короткие ролики',url:'/Affiliate_Lab/guides/video-traffic/',start:'Сценарии, ролики и возможность выпускать несколько сопоставимых материалов.',audience:'Зритель сначала встречает контент, а потом решает, переходить ли дальше.',feedback:'Первые результаты можно увидеть после публикаций, но вывод лучше делать по серии роликов.',after:'Отдельные ролики могут продолжать набирать просмотры, но это зависит от площадки и темы.',measure:'Просмотр, переход, регистрация, FTD.',trap:'Не принимать просмотры за коммерческий результат.'},
  community:{name:'Сообщества и мессенджеры',url:'/Affiliate_Lab/traffic/sources/communities/',start:'Собственная аудитория или доступ к релевантным размещениям.',audience:'Люди приходят из конкретного канала, группы или рекомендации.',feedback:'При существующей аудитории отклик можно увидеть сразу после размещения.',after:'Эффект конкретного поста обычно снижается, если публикацию перестают видеть.',measure:'Каждый канал и размещение отдельно, переход, регистрация, депозит.',trap:'Не смешивать собственную прогретую аудиторию с чужими размещениями.'},
  social:{name:'Социальные сети',url:'/Affiliate_Lab/traffic/sources/social/',start:'Регулярный контент и формат, который работает внутри конкретной ленты.',audience:'Чаще холодная лента: пользователь изначально ничего не искал.',feedback:'Сигналы появляются после публикации, но один пост редко даёт надёжный вывод.',after:'Жизнь публикации зависит от алгоритма и того, продолжает ли она получать охват.',measure:'Охват, переход, регистрация, FTD.',trap:'Не переносить результаты одного формата или аккаунта на всю социальную сеть.'},
  shortvideo:{name:'TikTok, Reels, Spotlight и Likee',url:'/Affiliate_Lab/traffic/sources/short-video/',start:'Серия из 10–20 коротких роликов на одной площадке и одна точка перехода.',audience:'Холодная вертикальная лента, где решение о просмотре принимается за первые секунды.',feedback:'Показы и переходы появляются быстро, но вывод нужен по серии, а не по одному ролику.',after:'Жизнь ролика зависит от алгоритма конкретной площадки.',measure:'Просмотры, переходы в профиль, клики, регистрации, FTD.',trap:'Не объединять одинаковый ролик на разных платформах в один источник.'},
  altvideo:{name:'Rutube, Dailymotion и OK Видео',url:'/Affiliate_Lab/traffic/sources/alt-video/',start:'3–5 готовых сопоставимых роликов и отдельные ссылки для каждой платформы.',audience:'Зрители конкретного видеохостинга, которые могут отличаться от аудитории YouTube.',feedback:'Результат виден после накопления просмотров и внешних переходов.',after:'Ролики могут продолжать получать просмотры после публикации.',measure:'Просмотры, клики на 1000, регистрации, FTD.',trap:'Не считать дополнительный охват полезным, если он не даёт переходов.'},
  dzen:{name:'Дзен',url:'/Affiliate_Lab/traffic/sources/dzen/',start:'8–12 статей, постов или видео одного формата и одной темы.',audience:'Пользователи рекомендательной ленты и подписчики канала.',feedback:'Первые показы могут появиться быстро, но сравнивать материалы нужно по одинаковому возрасту.',after:'Отдельные публикации могут продолжать получать рекомендации и переходы.',measure:'Показы, дочитывания, внешние клики, регистрации, FTD.',trap:'Не принимать дочитывания за коммерческий результат.'},
  reddit:{name:'Reddit и тематические ветки',url:'/Affiliate_Lab/traffic/sources/reddit/',start:'5–10 полезных публикаций или ответов в сообществах, где тема и ссылки разрешены.',audience:'Люди уже обсуждают конкретную тему внутри сообщества.',feedback:'Клики могут появиться сразу после публикации, но многое зависит от конкретной ветки.',after:'Старые обсуждения иногда продолжают давать переходы.',measure:'Ветка, публикация, внешний клик, регистрация, FTD.',trap:'Не путать активное обсуждение с коммерческим трафиком.'},
  x:{name:'X и короткие посты',url:'/Affiliate_Lab/traffic/sources/x-twitter/',start:'15–30 коротких постов или тредов одной темы.',audience:'Лента, подписчики и пользователи, которые видят репосты и обсуждения.',feedback:'Показы и переходы в профиль видны быстро, но внешний клик нужно считать отдельно.',after:'Посты обычно быстро теряют охват, отдельные треды могут жить дольше.',measure:'Показы, профиль, внешний клик, регистрация, FTD.',trap:'Не считать переход в профиль равным партнёрскому клику.'},
  mailing:{name:'Email и web push',url:'/Affiliate_Lab/traffic/sources/mailing/',start:'Собственная база подписчиков и 3–5 сопоставимых выпусков.',audience:'Люди, которые уже согласились получать сообщения от проекта.',feedback:'Клики появляются после отправки, поэтому серии удобно сравнивать по одинаковому окну.',after:'Поток прекращается после остановки рассылок, но база остаётся собственным активом.',measure:'Доставка, клики, регистрации, FTD.',trap:'Не использовать покупные базы и не оценивать рассылку только по открытиям.'},
  ads:{name:'Платная реклама',url:'/Affiliate_Lab/traffic/sources/paid/',start:'Бюджет, разрешённая площадка, креатив и заранее заданный лимит теста.',audience:'Сегмент задаётся настройками рекламы и самим креативом.',feedback:'После запуска можно быстрее накапливать измеримые клики, если реклама допущена и получает показы.',after:'Когда закупка останавливается, поток оплачиваемого трафика тоже прекращается.',measure:'Расход, показы, клики, регистрации, FTD.',trap:'Дешёвый клик сам по себе ничего не говорит о качестве трафика.'},
  stream:{name:'Стримы и прямые эфиры',url:'/Affiliate_Lab/traffic/sources/streams/',start:'Ведущий, эфирный формат и аудитория, которая готова смотреть вживую.',audience:'Зрители вовлекаются через ведущего и контекст прямого эфира.',feedback:'Отклик можно видеть во время или после эфира, но отдельный эфир сильно зависит от аудитории дня.',after:'Основной эффект привязан к эфиру; запись может жить дольше, если площадка её рекомендует.',measure:'Зрители эфира, переходы, регистрации, FTD.',trap:'Не отделять качество источника от доверия к самому ведущему.'},
  site:{name:'Свой сайт и контентный проект',url:'/Affiliate_Lab/guides/content-sites/',start:'Сайт, материалы, аналитика и время на накопление страниц и аудитории.',audience:'Может приходить из поиска, прямых заходов, ссылок и других каналов - их нужно разделять.',feedback:'Первые посещения возможны быстро из внешних источников, но органическое накопление обычно требует времени.',after:'Материалы остаются под твоим контролем и могут работать после публикации.',measure:'Источник посещения, страница, партнёрский переход, результат.',trap:'Не называть сайт отдельным источником, если внутри смешаны поиск, соцсети и прямые переходы.'}
 };
 const rows=[['Что нужно до старта','start'],['Откуда приходит аудитория','audience'],['Когда появляется обратная связь','feedback'],['Что остаётся после остановки','after'],['Что измерять','measure'],['Главная ошибка','trap']];
 function render(){if(a.value===b.value){const alt=[...b.options].find(o=>o.value!==a.value);if(alt)b.value=alt.value}const A=data[a.value],B=data[b.value];table.innerHTML=`<div class="source-compare-row source-compare-head"><div>Параметр</div><div>${A.name}</div><div>${B.name}</div></div>`+rows.map(([label,key])=>`<div class="source-compare-row"><div>${label}</div><div>${A[key]}</div><div>${B[key]}</div></div>`).join('');linkA.href=A.url;linkA.textContent='Открыть: '+A.name+'';linkB.href=B.url;linkB.textContent='Открыть: '+B.name+''}
 a.addEventListener('change',render);b.addEventListener('change',render);render();
}catch(e){console.error('iGaming Traffic Academy module 9 error',e);}})();


/* v34 - stable audience mode */
(function(){try{
 const KEY='al-user-mode-v1';
 const BOOK='al-bookmarks-v1',RECENT='al-recent-v1',STATE='al-reading-state-v1',SOURCE='al-selected-source-v1';
 const get=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch(e){return f}};
 const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
 const current=()=>{try{return localStorage.getItem(KEY)==='pro'?'pro':'beginner'}catch(e){return 'beginner'}};
 const pathConfig={
  beginner:{
   head:['Если ты здесь впервые','Четыре задачи по порядку','Каждая карточка продолжает предыдущую. Если часть уже понятна, начинай с нужного шага.'],
   cards:[
    ['/Affiliate_Lab/guides/affiliate-marketing/','Как устроена вся цепочка?','Кто приводит пользователей, что фиксирует партнёрская программа и за какое действие появляется выплата.'],
    ['/Affiliate_Lab/guides/choose-traffic-source/','Как выбрать один источник?','Отсеять неподходящие варианты по бюджету, контенту, аудитории и скорости обратной связи.'],
    ['/Affiliate_Lab/guides/launch-checklist/','Что проверить до запуска?','Ссылка, GEO, мобильный путь, метки, лимит теста и точка остановки.'],
    ['/Affiliate_Lab/guides/statistics/','Как разобрать первые цифры?','Сравнить клики, регистрации, FTD и доход за один период.']
   ]
  },
  pro:{
   head:['Если трафик уже есть','Четыре задачи, к которым чаще всего возвращаются','Базу можно не перечитывать. Выбери рабочую задачу, которую нужно решить сейчас.'],
   cards:[
    ['/Affiliate_Lab/diagnostics/','Понять, где проседает трафик','Клики есть, но дальше люди теряются? Начни с конкретного участка воронки.'],
    ['/Affiliate_Lab/traffic/compare/','Сравнить два источника','Сопоставь требования, обратную связь, аналитику и то, что остаётся после остановки работы.'],
    ['/Affiliate_Lab/guides/revshare/','Разобрать экономику RevShare','Понять расчётную базу, отрицательный баланс и почему количество депозитов ещё не равно доходу.'],
    ['/Affiliate_Lab/guides/tracking/','Проверить учёт результата','Разобрать метки, Click ID и передачу конверсий между системами.']
   ]
  }
 };
 const proNext={
  '/Affiliate_Lab/guides/affiliate-marketing/':['/Affiliate_Lab/guides/offer/','Проверить условия конкретного предложения'],
  '/Affiliate_Lab/guides/ftd/':['/Affiliate_Lab/guides/statistics/','Разобрать статистику по этапам'],
  '/Affiliate_Lab/guides/statistics/':['/Affiliate_Lab/diagnostics/','Диагностировать свой трафик'],
  '/Affiliate_Lab/guides/first-ftd/':['/Affiliate_Lab/guides/partner-dashboard/','Сверить первый тест с кабинетом'],
  '/Affiliate_Lab/guides/revshare/':['/Affiliate_Lab/guides/ggr-ngr/','Разобрать GGR и NGR'],
  '/Affiliate_Lab/guides/tracking/':['/Affiliate_Lab/guides/partner-dashboard/','Сверить это с партнёрским кабинетом'],
  '/Affiliate_Lab/guides/search-traffic/':['/Affiliate_Lab/guides/landing-page/','Проверить путь после поискового клика'],
  '/Affiliate_Lab/guides/video-traffic/':['/Affiliate_Lab/guides/tracking/','Разметить ролики и ссылки'],
  '/Affiliate_Lab/guides/paid-traffic/':['/Affiliate_Lab/guides/launch-checklist/','Зафиксировать лимит и проверку запуска'],
  '/Affiliate_Lab/guides/launch-checklist/':['/Affiliate_Lab/guides/first-ftd/','Провести первый измеримый тест'],
  '/Affiliate_Lab/guides/metrics/':['/Affiliate_Lab/guides/traffic-quality/','Оценить качество трафика, а не только объём']
 };
 function renderPath(mode){
  const section=document.getElementById('homeModePath');if(!section)return;
  const cfg=pathConfig[mode];const head=section.querySelector('[data-home-path-head]');const cards=[...section.querySelectorAll('.beginner-step')];
  if(head){const span=head.querySelector('span'),h=head.querySelector('h2'),p=head.querySelector('p');if(span)span.textContent=cfg.head[0];if(h)h.textContent=cfg.head[1];if(p)p.textContent=cfg.head[2]}
  cards.forEach((card,i)=>{const c=cfg.cards[i];if(!c)return;card.dataset.cardLink=c[0];const b=card.querySelector('b'),p=card.querySelector('p'),a=card.querySelector('a');if(b)b.textContent=c[1];if(p)p.textContent=c[2];if(a)a.href=c[0]});
 }
 function renderWizardCopy(mode){
  const root=document.getElementById('sourceWizard');if(!root)return;const intro=root.querySelector('.source-wizard-intro');if(!intro)return;
  const span=intro.querySelector(':scope > span'),h=intro.querySelector('h2'),p=intro.querySelector('p');
  if(mode==='pro'){if(span)span.textContent='Новый источник';if(h)h.textContent='Хочешь добавить ещё один источник трафика?';if(p)p.textContent='Ответь на четыре вопроса. Мастер отсеет явно неподходящие варианты и предложит направления для сравнения с тем, что уже используешь.'}
  else{if(span)span.textContent='Подбор источника';if(h)h.textContent='Не знаешь, откуда начинать с трафиком?';if(p)p.textContent='Ответь на четыре коротких вопроса. В конце сайт покажет два направления и объяснит, почему они подходят именно под твои ответы.'}
 }
 function renderHomeMode(mode){
  const title=document.querySelector('[data-mode-home-title]'),copy=document.querySelector('[data-mode-home-copy]');
  if(title)title.textContent=mode==='pro'?'Есть опыт':'Я только начинаю';
  if(copy)copy.textContent=mode==='pro'?'Базовые разделы остаются на месте, но подсказки чаще ведут к диагностике, сравнению, экономике и трекингу.':'Сайт будет чаще вести к базовым материалам и объяснениям терминов. Структура страниц при этом не меняется.';
 }
 function renderProContinuation(mode){
  if(mode!=='pro')return;const box=document.querySelector('[data-continue-card]'),home=document.querySelector('[data-continue-home]');if(!box||!home)return;
  const recent=get(RECENT,[]),last=recent[0];if(!last)return;const st=get(STATE,{})[last.url]||{},progress=st.progress||0,next=proNext[last.url];
  if(progress>=.72&&next){home.hidden=false;box.innerHTML=`<div class="continue-copy"><span>Можно продолжить отсюда</span><h2>${next[1]}</h2><p>Продолжение раскрывает тему подробнее.</p></div><div class="continue-actions"><a class="continue-primary" href="${next[0]}">Открыть продолжение</a><a class="continue-secondary" href="${last.url}">Вернуться к материалу</a></div>`}
 }
 function renderMode(mode){
  document.body.classList.toggle('mode-pro',mode==='pro');document.body.classList.toggle('mode-beginner',mode!=='pro');
  document.querySelectorAll('[data-user-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.userMode===mode?'true':'false'));
  renderPath(mode);renderWizardCopy(mode);renderHomeMode(mode);renderProContinuation(mode);
  const pm=document.getElementById('pathModeTitle'),pc=document.getElementById('pathModeCopy');if(pm)pm.textContent=mode==='pro'?'Есть опыт':'Я только начинаю';if(pc)pc.textContent=mode==='pro'?'Выше показываются диагностика, сравнение источников, экономика и Tracking.':'Выше показываются базовые объяснения и подготовка первого теста.';
 }
 /* v38: mode switching is owned by core.js */
 document.addEventListener('al:modechange',e=>renderMode(e.detail?.mode||current()));
 renderMode(current());
 window.ALAudienceMode={get:current,set:(m)=>{try{localStorage.setItem(KEY,m==='pro'?'pro':'beginner')}catch(e){}renderMode(current())}};
}catch(e){console.error('iGaming Traffic Academy module 10 error',e);}})();

/* v34 - reading marks in the catalog */
(function(){try{
 const STATE='al-reading-state-v1';let states={};try{states=JSON.parse(localStorage.getItem(STATE)||'{}')}catch(e){}
 document.querySelectorAll('.library-row[data-card-link]').forEach(row=>{const url=row.dataset.cardLink,st=states[url];if(!st||!st.visited)return;const meta=row.querySelector('.library-meta');if(!meta)return;const old=meta.querySelector('.reading-state-badge');if(old)old.remove();const progress=st.progress||0,b=document.createElement('span');b.className='reading-state-badge '+(progress>=.78?'done':'started');b.textContent=progress>=.78?'прочитано':'начато';meta.prepend(b)});
}catch(e){console.error('iGaming Traffic Academy module 11 error',e);}})();

/* v34 - problem-oriented search shortcut */
(function(){try{
 const input=document.getElementById('librarySearch'),box=document.getElementById('problemQuerySuggestion');if(!input||!box)return;
 function n(s){return (s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9 ]/gi,' ').replace(/\s+/g,' ').trim()}
 function detect(q){q=n(q);if(!q)return null;
  if((q.includes('нет регистрац')||q.includes('без регистрац')||(q.includes('клик')&&q.includes('регистрац')&&q.includes('нет'))))return ['clicks','Есть клики, но почти нет регистраций','Проверить участок между кликом и регистрацией'];
  if((q.includes('нет депозит')||q.includes('нет ftd')||q.includes('без депозит')||(q.includes('регистрац')&&q.includes('депозит')&&q.includes('нет'))))return ['regs','Регистрации есть, но почти нет FTD','Проверить путь после регистрации'];
  if((q.includes('слабый доход')||q.includes('мало доход')||q.includes('низкий доход')||(q.includes('депозит')&&q.includes('доход'))))return ['income','Первые депозиты есть, но доход слабый','Проверить экономику и качество результата'];
  if(q.includes('не сход')||q.includes('расхожд')||q.includes('статистик не')||q.includes('трекинг не'))return ['tracking','Цифры в системах не сходятся','Проверить маршрут данных и трекинг'];
  return null}
 function render(){const hit=detect(input.value);box.hidden=!hit;if(!hit)return;box.innerHTML=`<span>Нашёл разбор по этому запросу</span><b>${hit[1]}</b><p>Можно сразу открыть пошаговую диагностику вместо просмотра общего списка статей.</p><a href="/Affiliate_Lab/diagnostics/?problem=${hit[0]}">${hit[2]}</a>`}
 input.addEventListener('input',render);render();
}catch(e){console.error('iGaming Traffic Academy module 12 error',e);}})();

/* v34 - diagnostics accepts a problem from search */
(function(){try{
 const root=document.getElementById('problemWizard');if(!root)return;const p=new URLSearchParams(location.search).get('problem');if(!p)return;const b=root.querySelector(`[data-problem="${p}"]`);if(b)setTimeout(()=>b.click(),0);
}catch(e){console.error('iGaming Traffic Academy module 13 error',e);}})();

/* v34 - My Path dashboard */
(function(){try{
 const root=document.getElementById('pathDashboard');if(!root)return;
 const get=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch(e){return f}};
 const sourceNames={search:'Поисковый трафик',video:'Видео и короткие ролики',community:'Сообщества и мессенджеры',social:'Социальные сети',ads:'Платная реклама',stream:'Стримы и прямые эфиры',site:'Свой сайт и контентный проект'};
 const source=get('al-selected-source-v1',null),recent=get('al-recent-v1',[]),states=get('al-reading-state-v1',{}),book=get('al-bookmarks-v1',[]);
 const sbox=document.getElementById('pathSourceState');if(sbox){if(source&&source.key){sbox.innerHTML=`<b class="path-source-name">${sourceNames[source.key]||source.name||source.key}</b><p>Этот источник сохранён для расчётов и заметок.</p><div class="path-source-actions"><a href="/Affiliate_Lab/tools/?source=${source.key}">Открыть инструменты</a><a href="/Affiliate_Lab/traffic/">Выбрать другой</a></div>`}else{sbox.innerHTML='<p>Источник пока не выбран. Библиотека работает и без этого.</p><div class="path-source-actions"><a href="/Affiliate_Lab/traffic/">Выбрать источник</a><a href="/Affiliate_Lab/traffic/compare/">Сравнить варианты</a></div>'}}
 const cbox=document.getElementById('pathContinueState');if(cbox){const last=recent[0];if(last){const st=states[last.url]||{},pr=st.progress||0,pct=Math.max(0,Math.min(100,Math.round(pr*100)));const href=pr>.05&&pr<.82?last.url+'?continue=1':last.url;cbox.innerHTML=`<h2>${last.title}</h2><p>${pr>=.78?'Материал почти дочитан. Можно вернуться к нему или продолжить по рекомендациям в конце.':pr>.05?'Вернуться к месту, где остановились.':'Недавно открытый материал.'}</p><div class="path-progress"><i style="width:${pct}%"></i></div><small>Прогресс: около ${pct}%</small><div class="path-continue-actions"><a href="${href}">${pr>.05&&pr<.82?'Продолжить чтение':'Открыть материал'}</a><a href="/Affiliate_Lab/notes/">История чтения</a></div>`}else{cbox.innerHTML='<p>История чтения пока пустая. Начни с любого раздела - здесь появится удобное продолжение.</p><div class="path-continue-actions"><a href="/Affiliate_Lab/guides/">Открыть материалы</a></div>'}}
 const bbox=document.getElementById('pathSavedState');if(bbox){bbox.innerHTML=`<b class="path-source-name">${book.length}</b><p>${book.length===1?'материал сохранён в закладках':'материалов сохранено в закладках'}.</p><div class="path-source-actions"><a href="/Affiliate_Lab/notes/">Открыть закладки</a></div>`}
}catch(e){console.error('iGaming Traffic Academy module 14 error',e);}})();


/* v35 - audience mode works across the whole site without changing page structure */
(function(){try{
 const KEY='al-user-mode-v1';
 const current=()=>{try{return localStorage.getItem(KEY)==='pro'?'pro':'beginner'}catch(e){return 'beginner'}};
 const configs={
  '/Affiliate_Lab/basics/':{
   beginner:['С чего начать в этом разделе','Сначала разберись в общей схеме партнёрской программы.','/Affiliate_Lab/guides/affiliate-marketing/','Открыть общую схему'],
   pro:['Если база уже знакома','Быстрее всего полезно проверить условия конкретной программы и правила учёта результата.','/Affiliate_Lab/guides/offer/','Проверить условия программы']
  },
  '/Affiliate_Lab/economics/':{
   beginner:['С чего начать в этом разделе','Сначала пойми, откуда вообще берётся выплата по процентной модели.','/Affiliate_Lab/guides/revshare/','Разобрать RevShare'],
   pro:['Рабочая задача','Сравнивай не процент в рекламе, а реальную расчётную базу и качество трафика.','/Affiliate_Lab/guides/ggr-ngr/','Разобрать GGR и NGR']
  },
  '/Affiliate_Lab/analytics/':{
   beginner:['С чего начать в этом разделе','Начни с кабинета: клики, регистрации, FTD и доход.','/Affiliate_Lab/guides/partner-dashboard/','Как читать кабинет'],
   pro:['Рабочая задача','Если трафик уже идёт, проверь разметку источников и качество данных до выводов по цифрам.','/Affiliate_Lab/guides/tracking/','Проверить трекинг']
  },
  '/Affiliate_Lab/practice/':{
   beginner:['Перед первым запуском','Пройди короткую проверку ссылки, источника и лимита теста.','/Affiliate_Lab/guides/launch-checklist/','Открыть проверку'],
   pro:['Если трафик уже запущен','Не перечитывай базу: начни с конкретного участка, где просел результат.','/Affiliate_Lab/diagnostics/','Открыть диагностику']
  },
  '/Affiliate_Lab/traffic/':{
   beginner:['Если источник ещё не выбран','Сначала подбери 1–2 направления под бюджет, контент и доступную аудиторию.','/Affiliate_Lab/traffic/compare/','Подобрать источник'],
   pro:['Если уже есть рабочий источник','Сравни его с альтернативой по обратной связи, аналитике и ресурсу на запуск.','/Affiliate_Lab/traffic/compare/','Сравнить источники']
  },
  '/Affiliate_Lab/tools/':{
   beginner:['Рекомендуем сейчас','Начни с планирования теста. Фактические цифры пригодятся уже после запуска.','#plan-test','План первого теста'],
   pro:['Рекомендуем сейчас','Если трафик уже идёт, сначала введи реальные клики, регистрации и FTD.','#diagnose-result','Разобрать результат']
  },
  '/Affiliate_Lab/diagnostics/':{
   beginner:['Как пользоваться','Выбери место, где путь пользователя ломается. Дальше сайт сузит список проверок.','#problemWizard','Начать диагностику'],
   pro:['Если цифры уже есть','После быстрой диагностики можно сразу проверить фактические конверсии в инструментах.','/Affiliate_Lab/tools/#diagnose-result','Разобрать цифры']
  },
  '/Affiliate_Lab/guides/':{
   beginner:['Порядок материалов','В режиме «Начинаю» базовые материалы показываются выше, но поиск видит всю библиотеку.','/Affiliate_Lab/start/','Маршрут с нуля'],
   pro:['Порядок материалов','В режиме «Есть опыт» выше показываются диагностика, Tracking и разбор экономики. Поиск по-прежнему видит всё.','/Affiliate_Lab/diagnostics/','К рабочим задачам']
  },
  '/Affiliate_Lab/start/':{
   beginner:['Этот раздел для тебя','Пройди пять шагов по порядку, если пока сложно понять, с чего начинать.','#starterRoute','Начать маршрут'],
   pro:['Базу можно пропустить','Если трафик уже идёт, полезнее сразу перейти к диагностике, сравнению или аналитике.','/Affiliate_Lab/diagnostics/','Перейти к диагностике']
  },
  '/Affiliate_Lab/help/':{
   beginner:['Помочь выбрать следующий шаг','Выберите ситуацию, а не раздел: так проще найти нужную страницу.','#','Остаться здесь'],
   pro:['Быстрый переход к задаче','Выберите текущую проблему или рабочую цель вместо просмотра всей структуры.','#','Остаться здесь']
  },
  '/Affiliate_Lab/notes/':{
   beginner:['Как использовать','Одна запись хранит условия теста, метку, цифры и один вывод для следующего запуска.','#','Остаться в журнале'],
   pro:['Как использовать','Разделяй связки и изменения по записям, чтобы не смешивать выводы из разных тестов.','#','Остаться в журнале']
  }
 };
 function makeBar(cfg){
  let bar=document.querySelector('.global-mode-guidance');
  if(!bar){
   bar=document.createElement('div');bar.className='global-mode-guidance wrap';bar.setAttribute('data-global-mode-guidance','');
   const head=document.querySelector('main > .page-head, main > .section-landing-head');
   if(head) head.insertAdjacentElement('afterend',bar);
  }
  if(!bar)return;
  bar.innerHTML=`<div><span>${cfg[0]}</span><p>${cfg[1]}</p></div><a href="${cfg[2]}">${cfg[3]}</a>`;
 }
 function sortCatalog(mode){
  const parent=document.getElementById('libraryRows'),input=document.getElementById('librarySearch');if(!parent||!input||input.value.trim())return;
  const rows=[...parent.querySelectorAll('.library-row')];
  rows.forEach((r,i)=>{if(!r.dataset.modeOriginal)r.dataset.modeOriginal=String(i)});
  rows.sort((a,b)=>{
   const score=r=>{const level=r.dataset.level||'beginner';return mode==='pro'?(level==='advanced'?0:1):(level==='beginner'?0:1)};
   const d=score(a)-score(b);return d||(+a.dataset.modeOriginal)-(+b.dataset.modeOriginal);
  }).forEach(r=>parent.appendChild(r));
 }
 function markTools(mode){
  document.querySelectorAll('.big-tool').forEach(x=>x.classList.remove('mode-recommended-tool'));
  const id=mode==='pro'?'diagnose-result':'plan-test';document.getElementById(id)?.classList.add('mode-recommended-tool');
 }
 function render(){
  const mode=current(),path=location.pathname;
  document.body.dataset.audienceMode=mode;
  const cfg=configs[path]?.[mode];if(cfg)makeBar(cfg);
  else document.querySelector('.global-mode-guidance')?.remove();
  document.querySelector('.article-mode-guidance')?.remove();sortCatalog(mode);markTools(mode);
 }
 document.addEventListener('al:modechange',render);
 document.getElementById('librarySearch')?.addEventListener('input',()=>{if(!document.getElementById('librarySearch').value.trim())setTimeout(render,0)});
 render();
}catch(e){console.error('iGaming Traffic Academy module 15 error',e);}})();


/* v40 - provider-agnostic behavioral events for launch analytics */
(function(){try{
 const track=(name,data)=>window.alTrack&&window.alTrack(name,data);
 document.addEventListener('click',function(e){
   const bookmark=e.target.closest('[data-bookmark-button]');
   if(bookmark){setTimeout(()=>track('bookmark',{state:bookmark.getAttribute('aria-pressed')==='true'?'saved':'removed'}),0);return;}
   const affiliate=e.target.closest('.partner-next-step a,[href^="/Affiliate_Lab/go/partner/"]');
   if(affiliate){track('affiliate_cta_click',{from:new URL(affiliate.href,location.href).searchParams.get('from')||'unknown'});return;}
   const wizardStart=e.target.closest('#wizardStartButton');
   if(wizardStart){track('source_wizard_open',{});return;}
   const wizard=e.target.closest('.wizard-option');
   if(wizard){track('source_wizard_answer',{answer:wizard.dataset.answer||''});return;}
   const result=e.target.closest('.wizard-result');
   if(result){track('source_wizard_result_open',{href:result.getAttribute('href')||''});return;}
   const problem=e.target.closest('[data-problem]');
   if(problem){track('diagnostic_problem',{problem:problem.dataset.problem||''});return;}
   const follow=e.target.closest('[data-follow]');
   if(follow){track('diagnostic_answer',{answer:follow.dataset.follow||''});return;}
   const tool=e.target.closest('.big-tool button');
   if(tool){track('tool_action',{tool:tool.closest('.big-tool')?.id||'',label:(tool.textContent||'').trim().slice(0,60)});return;}
   const nav=e.target.closest('.sidebar-menu a,.sidebar-secondary a,.article-exit-nav a,.related-primary,.related-secondary a');
   if(nav)track('navigation',{href:nav.getAttribute('href')||'',label:(nav.textContent||'').trim().replace(/\\s+/g,' ').slice(0,80)});
 });
 ['librarySearch','siteSearch'].forEach(function(id){
   const input=document.getElementById(id);if(!input)return;let timer;
   input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(function(){const q=input.value.trim();if(q.length>=2)track('search',{surface:id,query:q.slice(0,80)});},700);});
 });
 const article=document.querySelector('article.article');
 const end=document.querySelector('.related-reading');
 if(article&&end&&'IntersectionObserver' in window){
   let sent=false;const io=new IntersectionObserver(function(entries){if(!sent&&entries.some(x=>x.isIntersecting)){sent=true;track('article_reached_end',{title:(document.querySelector('h1')?.textContent||'').trim().slice(0,100)});io.disconnect();}},{threshold:.15});io.observe(end);
 }
}catch(e){console.error('iGaming Traffic Academy analytics error',e);}})();


/* v41 - first-visit orientation measurement. No external analytics provider is attached here. */
(function(){try{
 const KEY='al-first-action-v1';
 if(sessionStorage.getItem(KEY))return;
 const started=performance.now();
 function classify(target){
   const entry=target.closest('[data-entry-mode]');if(entry)return 'entry_'+(entry.dataset.entryMode||'unknown');
   if(target.closest('#siteSearch,#searchButton,.sidebar-search'))return 'search';
   if(target.closest('.beginner-step'))return 'guided_path';
   if(target.closest('#wizardStartButton,.wizard-option'))return 'source_wizard';
   if(target.closest('.section-card'))return 'section_map';
   if(target.closest('[href^="/Affiliate_Lab/go/partner/"],.partner-next-step'))return 'affiliate';
   if(target.closest('.sidebar-menu,.sidebar-secondary,.mobile-nav-toggle'))return 'navigation';
   if(target.closest('a,button,input,select'))return 'other_interaction';
   return '';
 }
 document.addEventListener('click',function(e){
   if(sessionStorage.getItem(KEY))return;
   const kind=classify(e.target);if(!kind)return;
   sessionStorage.setItem(KEY,'1');
   if(window.alTrack)window.alTrack('first_meaningful_action',{kind:kind,elapsed_ms:Math.round(performance.now()-started)});
 },{capture:true});
}catch(e){console.error('iGaming Traffic Academy first-action analytics error',e);}})();

/* v86 — enlarge article images in an in-page viewer */
(function(){try{
 const images=[...document.querySelectorAll('.article-figure img')];
 if(!images.length)return;

 const viewer=document.createElement('div');
 viewer.className='image-lightbox';
 viewer.setAttribute('role','dialog');
 viewer.setAttribute('aria-modal','true');
 viewer.setAttribute('aria-label','Просмотр изображения');
 viewer.innerHTML=`<div class="image-lightbox-toolbar">
   <button type="button" data-image-zoom-out aria-label="Уменьшить">−</button>
   <button type="button" class="image-lightbox-reset" data-image-zoom-reset aria-label="Сбросить масштаб">100%</button>
   <button type="button" data-image-zoom-in aria-label="Увеличить">+</button>
   <button type="button" class="image-lightbox-close" data-image-close aria-label="Закрыть">×</button>
  </div>
  <div class="image-lightbox-stage">
   <img class="image-lightbox-image" alt="" draggable="false"/>
   <span class="image-lightbox-hint">Колесо, кнопки или жест двумя пальцами</span>
  </div>`;
 document.body.appendChild(viewer);

 const stage=viewer.querySelector('.image-lightbox-stage');
 const photo=viewer.querySelector('.image-lightbox-image');
 const resetButton=viewer.querySelector('[data-image-zoom-reset]');
 const pointers=new Map();
 let scale=1,tx=0,ty=0,lastFocus=null,dragMoved=false,pinchStartDistance=0,pinchStartScale=1;

 function clampScale(value){return Math.min(5,Math.max(1,value));}
 function render(){
   if(scale===1){tx=0;ty=0;}
   photo.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
   resetButton.textContent=Math.round(scale*100)+'%';
   stage.classList.toggle('is-zoomed',scale>1.001);
 }
 function setScale(next,anchorX,anchorY){
   const old=scale;
   next=clampScale(next);
   if(next===old)return;
   if(anchorX!==undefined&&anchorY!==undefined&&old>0){
     const rect=stage.getBoundingClientRect();
     const dx=anchorX-(rect.left+rect.width/2);
     const dy=anchorY-(rect.top+rect.height/2);
     const ratio=next/old;
     tx=dx-(dx-tx)*ratio;
     ty=dy-(dy-ty)*ratio;
   }
   scale=next;render();
 }
 function reset(){scale=1;tx=0;ty=0;render();}
 function open(img){
   lastFocus=document.activeElement;
   photo.src=img.dataset.fullSrc||img.currentSrc||img.src;
   photo.alt=img.alt||'Увеличенное изображение';
   reset();
   viewer.classList.add('is-open');
   document.body.classList.add('image-lightbox-open');
   viewer.querySelector('[data-image-close]').focus();
 }
 function close(){
   viewer.classList.remove('is-open');
   document.body.classList.remove('image-lightbox-open');
   pointers.clear();
   stage.classList.remove('is-dragging','is-pinching');
   photo.removeAttribute('src');
   if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus();
 }

 images.forEach(img=>{
   img.setAttribute('tabindex','0');
   img.setAttribute('role','button');
   img.setAttribute('aria-label',(img.alt?img.alt+'. ':'')+'Открыть увеличенное изображение');
   img.title='Нажмите, чтобы увеличить';
   img.addEventListener('click',()=>open(img));
   img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(img);}});
 });

 viewer.querySelector('[data-image-close]').addEventListener('click',close);
 viewer.querySelector('[data-image-zoom-in]').addEventListener('click',()=>setScale(scale+.5));
 viewer.querySelector('[data-image-zoom-out]').addEventListener('click',()=>setScale(scale-.5));
 resetButton.addEventListener('click',reset);
 viewer.addEventListener('click',e=>{if(e.target===viewer)close();});
 stage.addEventListener('dblclick',e=>{e.preventDefault();setScale(scale>1?1:2,e.clientX,e.clientY);});
 stage.addEventListener('wheel',e=>{
   e.preventDefault();
   setScale(scale*(e.deltaY<0?1.16:.86),e.clientX,e.clientY);
 },{passive:false});

 function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
 stage.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY});
   try{stage.setPointerCapture(e.pointerId);}catch(_e){}
   dragMoved=false;
   if(pointers.size===1&&scale>1)stage.classList.add('is-dragging');
   if(pointers.size===2){
     const pts=[...pointers.values()];
     pinchStartDistance=distance(pts[0],pts[1]);
     pinchStartScale=scale;
     stage.classList.remove('is-dragging');
     stage.classList.add('is-pinching');
   }
 });
 stage.addEventListener('pointermove',e=>{
   const p=pointers.get(e.pointerId);if(!p)return;
   const oldX=p.x,oldY=p.y;p.x=e.clientX;p.y=e.clientY;
   if(pointers.size>=2){
     const pts=[...pointers.values()].slice(0,2);
     const d=distance(pts[0],pts[1]);
     if(pinchStartDistance>0)setScale(pinchStartScale*(d/pinchStartDistance));
     return;
   }
   if(scale>1){
     const dx=e.clientX-oldX,dy=e.clientY-oldY;
     if(Math.abs(dx)+Math.abs(dy)>1)dragMoved=true;
     tx+=dx;ty+=dy;render();
   }
 });
 function endPointer(e){
   pointers.delete(e.pointerId);
   if(pointers.size<2)stage.classList.remove('is-pinching');
   if(!pointers.size)stage.classList.remove('is-dragging');
   else if(pointers.size===1&&scale>1)stage.classList.add('is-dragging');
 }
 stage.addEventListener('pointerup',endPointer);
 stage.addEventListener('pointercancel',endPointer);
 stage.addEventListener('click',e=>{if(e.target===stage&&!dragMoved)close();dragMoved=false;});

 document.addEventListener('keydown',e=>{
   if(!viewer.classList.contains('is-open'))return;
   if(e.key==='Escape')close();
   else if(e.key==='+'||e.key==='=')setScale(scale+.5);
   else if(e.key==='-')setScale(scale-.5);
   else if(e.key==='0')reset();
 });
}catch(e){console.error('iGaming Traffic Academy image viewer error',e);}})();

;(()=>{const academyV90Progress=()=>{const article=document.querySelector('.source-playbook-article');if(!article)return;const bar=document.querySelector('.rail-progress span');const toc=[...document.querySelectorAll('.playbook-aside a[href^="#"]')];const tabs=[...document.querySelectorAll('.source-section-tabs a[href^="#"]')];const links=[...toc,...tabs];const sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);const update=()=>{if(bar){const start=article.getBoundingClientRect().top+scrollY;const end=Math.max(start+1,start+article.offsetHeight-innerHeight*.72);const pct=Math.max(0,Math.min(1,(scrollY-start+80)/(end-start)));bar.style.width=(pct*100).toFixed(1)+'%';}let current=sections[0];for(const s of sections){if(s.getBoundingClientRect().top<=150)current=s;}links.forEach(a=>a.classList.toggle('is-current',current&&a.getAttribute('href')==='#'+current.id));};addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',academyV90Progress);else academyV90Progress();})();

'use strict';

/* ---- State ---- */
let chaptersManifest = [];
let loadedChapters = [];
let currentChapterIndex = 0;
const FS_KEY = 'tibb_fontSize';
let currentFontSize = Math.min(28, Math.max(14, parseInt(localStorage.getItem(FS_KEY), 10) || 18));
let activeKeyboardIndex = -1;
let searchDebounce = null;

/* ---- DOM ---- */
const $ = (id) => document.getElementById(id);
const sidebar = $('sidebar');
const sidebarToggle = $('sidebarToggle');
const sidebarClose = $('sidebarClose');
const sidebarBackdrop = $('sidebarBackdrop');
const chapterList = $('chapterList');
const chapterContent = $('chapterContent');
const prevBtn = $('prevBtn');
const nextBtn = $('nextBtn');
const pageIndicator = $('pageIndicator');
const searchInput = $('searchInput');
const searchStats = $('searchStats');
const quickJumpResults = $('quickJumpResults');
const fontIncrease = $('fontIncrease');
const fontDecrease = $('fontDecrease');
const fontSizeIndicator = $('fontSizeIndicator');
const themeToggle = $('themeToggle');

/* ---- Helpers ---- */
function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function terms(q) { return String(q || '').trim().split(/\s+/).filter(Boolean); }
function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || d.innerText || '');
}
function normalizeArabic(s) {
  if (!s) return '';
  return String(s)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();
}
const DIAC = '[\\u064B-\\u0652\\u0670\\u0640]*';
function arabicCharClass(ch) {
  switch (ch) {
    case 'ا': return '[اأإآٱ]';
    case 'ه': return '[هة]';
    case 'ي': return '[يىئ]';
    case 'و': return '[وؤ]';
    default: return escapeRegExp(ch);
  }
}
function termToPattern(term) {
  const norm = normalizeArabic(term);
  if (!norm) return '';
  return DIAC + Array.from(norm).map(arabicCharClass).join(DIAC) + DIAC;
}

const SYNONYM_GROUPS = [
  ['الحبة السوداء', 'حبة السوداء', 'حبة البركة', 'الحبة البركة', 'الشونيز', 'شونيز', 'الكمون الأسود'],
  ['العسل', 'عسل النحل', 'الشهد', 'شهد'],
  ['الحلبة', 'حلبة'],
  ['القسط', 'قسط', 'القسط الهندي', 'قسط هندي', 'القسط البحري', 'قسط بحري', 'الكست', 'كست'],
  ['السنا', 'سنا', 'السنامكي', 'سنامكي', 'عشبة السنا', 'سنامكة'],
  ['الشيح', 'شيح', 'الأفسنتين', 'أفسنتين'],
  ['السعد', 'سعد'],
  ['الزنجبيل', 'زنجبيل'],
  ['الكافور', 'كافور'],
  ['الحناء', 'حناء'],
  ['الآس', 'آس', 'المرسين', 'مرسين'],
  ['الريحان', 'ريحان', 'الحبق', 'حبق'],
  ['اليانسون', 'يانسون', 'الأنيسون', 'أنيسون'],
  ['الكمون', 'كمون'],
  ['الكزبرة', 'كزبرة', 'الكزبر', 'كزبر'],
  ['الدباء', 'دباء', 'القرع', 'قرع', 'اليقطين', 'يقطين'],
  ['الرمان', 'رمان'],
  ['التين', 'تين'],
  ['الزيتون', 'زيتون'],
  ['التمر', 'تمر', 'البلح', 'بلح', 'الرطب', 'رطب'],
  ['العنب', 'عنب', 'الزبيب', 'زبيب'],
  ['الخل', 'خل'],
  ['السذاب', 'سذاب', 'الفيجل', 'فيجل'],
  ['الحرمل', 'حرمل'],
  ['الهيل', 'هيل', 'الحبهان', 'حبهان'],
  ['بذر الكتان', 'الكتان', 'كتان', 'بزر الكتان'],
  ['الصبر', 'صبر', 'الألوة', 'ألوة'],
  ['الزعفران', 'زعفران'],
  ['الورس', 'ورس'],
  ['الثوم', 'ثوم'],
  ['البصل', 'بصل'],
  ['الكراث', 'كراث'],
  ['الخردل', 'خردل'],
  ['الشعير', 'شعير', 'التلبينة', 'تلبينة'],
  ['الزعتر', 'زعتر', 'السعتر', 'سعتر', 'العتر', 'عتر'],
  ['اللبن', 'لبن', 'الحليب', 'حليب'],
  ['السمن', 'سمن'],
  ['الكحل', 'كحل', 'الإثمد', 'إثمد'],
  ['الحجامة', 'حجامة'],
  ['الفصد', 'فصد'],
  ['الزيت', 'زيت', 'الدهن', 'دهن'],
  ['المر', 'مر', 'اللبان', 'لبان'],
  ['القلب', 'قلب', 'الفؤاد', 'فؤاد'],
  ['الكبد', 'كبد'],
  ['المعدة', 'معدة'],
  ['الكلى', 'كلى', 'الكلية', 'كلية', 'الكليتين'],
  ['الأمعاء', 'أمعاء', 'المصارين', 'مصارين', 'المعي', 'معي'],
  ['الرئة', 'رئة', 'الرئتين', 'رئتين'],
  ['الطحال', 'طحال'],
  ['المرارة', 'مرارة'],
  ['البنكرياس', 'بنكرياس', 'المعثكلة', 'معثكلة'],
  ['المثانة', 'مثانة'],
  ['الرحم', 'رحم'],
  ['الجلد', 'جلد', 'البشرة', 'بشرة'],
  ['العظم', 'عظم', 'العظام', 'عظام'],
  ['العصب', 'عصب', 'الأعصاب', 'أعصاب'],
  ['الدم', 'دم'],
  ['الشرايين', 'شرايين', 'الشريان', 'شريان', 'الأوردة', 'أوردة', 'الوريد', 'وريد', 'العروق', 'عروق'],
  ['الرأس', 'رأس', 'الهامة', 'هامة'],
  ['الكتف', 'كتف', 'الكتفين', 'المنكب', 'منكب', 'المنكبين'],
  ['الركبة', 'ركبة', 'الركبتين', 'الركبتان'],
  ['الظهر', 'ظهر', 'العمود الفقري', 'عمود فقري'],
  ['الصدر', 'صدر', 'القفص الصدري'],
  ['اللسان', 'لسان'],
  ['الحلق', 'حلق', 'الحلقوم', 'حلقوم', 'البلعوم', 'بلعوم'],
  ['المريء', 'مريء'],
  ['اليد', 'يد', 'اليدين', 'الكف', 'كف', 'الكفين'],
  ['القدم', 'قدم', 'القدمان', 'الساق', 'ساق'],
  ['الأنف', 'أنف', 'المنخر', 'منخر', 'المنخرين'],
  ['الأذن', 'أذن', 'الأذنين'],
  ['العين', 'عين', 'العينين'],
  ['المفاصل', 'مفاصل', 'المفصل', 'مفصل'],
  ['الغدد', 'غدد', 'الغدة', 'غدة'],
  ['الحبل الشوكي', 'النخاع', 'نخاع']
];

const SYN_INDEX = (() => {
  const idx = new Map();
  SYNONYM_GROUPS.forEach((group, gi) => {
    group.forEach((name) => {
      const n = normalizeArabic(name);
      if (!n) return;
      if (!idx.has(n)) idx.set(n, new Set());
      idx.get(n).add(gi);
    });
  });
  return idx;
})();

function expandArabicTerms(ts) {
  const out = new Set();
  ts.forEach((t) => {
    out.add(t);
    const groups = SYN_INDEX.get(t);
    if (groups) {
      groups.forEach((gi) => SYNONYM_GROUPS[gi].forEach((name) => {
        const n = normalizeArabic(name);
        if (n) out.add(n);
      }));
    }
  });
  return Array.from(out);
}

function isArabicLetter(ch) { return /[\u0621-\u064A]/.test(ch || ''); }
function atWordBoundary(s, ix, len) {
  const before = ix > 0 ? s[ix - 1] : '';
  const after = ix + len < s.length ? s[ix + len] : '';
  return !isArabicLetter(before) && !isArabicLetter(after);
}
function countTerm(body, term, whole) {
  let c = 0, p = 0, ix;
  while ((ix = body.indexOf(term, p)) >= 0) {
    if (!whole || atWordBoundary(body, ix, term.length)) c++;
    p = ix + term.length;
  }
  return c;
}
function isWholeTerm(t, primarySet) { return !primarySet.has(t) || SYN_INDEX.has(t); }
function queryTerms(query) {
  const qNorm = normalizeArabic(query);
  if (!qNorm) return [];
  if (SYN_INDEX.has(qNorm)) return [qNorm];
  return terms(qNorm);
}
function titleMatches(title, term, whole) {
  if (!whole) return title.indexOf(term) >= 0;
  let p = 0, ix;
  while ((ix = title.indexOf(term, p)) >= 0) {
    if (atWordBoundary(title, ix, term.length)) return true;
    p = ix + term.length;
  }
  return false;
}

function chapterText(ch) {
  if (ch._text == null) ch._text = normalizeArabic(stripHtml(ch.content));
  return ch._text;
}
function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms || 12000);
  return fetch(url, { signal: controller.signal, cache: 'no-cache' }).finally(() => clearTimeout(id));
}

/* ---- 1. Dark/Light ---- */
function initTheme() {
  const t = localStorage.getItem('theme') || 'light';
  document.documentElement.classList.toggle('dark', t === 'dark');
}
themeToggle.addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
});
initTheme();

/* ---- 2. Sidebar drawer (click + touch swipe) ---- */
function toggleSidebar(open) {
  sidebar.classList.toggle('translate-x-full', !open);
  sidebarBackdrop.classList.toggle('hidden', !open);
}
sidebarToggle.addEventListener('click', () => toggleSidebar(true));
sidebarClose.addEventListener('click', () => toggleSidebar(false));
sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));
(function swipe() {
  let x0 = null;
  document.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (x0 > window.innerWidth - 40 && dx < -50) toggleSidebar(true);
    else if (dx > 60 && sidebar.classList.contains('translate-x-full') === false) toggleSidebar(false);
    x0 = null;
  }, { passive: true });
})();

/* ---- 3. Highlight (multi-term, safe) ---- */
function highlightSearchTerm(root, query) {
  const primary = queryTerms(query);
  if (!primary.length) return;
  const primarySet = new Set(primary);
  const ts = expandArabicTerms(primary);
  const patterns = ts.map((t) => {
    const p = termToPattern(t);
    if (!p) return '';
    return isWholeTerm(t, primarySet) ? '(?<![\\u0621-\\u064A])' + p + '(?![\\u0621-\\u064A])' : p;
  }).filter(Boolean);
  if (!patterns.length) return;
  let re;
  try { re = new RegExp('(' + patterns.join('|') + ')', 'gi'); }
  catch (e) { re = new RegExp('(' + ts.map(termToPattern).filter(Boolean).join('|') + ')', 'gi'); }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach((tn) => {
    const txt = tn.nodeValue;
    if (!txt) return;
    re.lastIndex = 0;
    const parts = txt.split(re);
    if (parts.length === 1) return;
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (!part) return;
      if (ts.indexOf(normalizeArabic(part)) >= 0) {
        const span = document.createElement('span');
        span.className = 'bg-green-200 dark:bg-green-900/60 text-green-900 dark:text-green-200 px-1 rounded font-semibold transition-colors';
        span.textContent = part;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    });
    tn.parentNode.replaceChild(frag, tn);
  });
}

/* ---- 4. Search across all chapters ---- */
function doSearch(query) {
  const primary = queryTerms(query);
  if (!primary.length) return null;
  const primarySet = new Set(primary);
  const all = expandArabicTerms(primary);
  const whole = new Map();
  all.forEach((t) => whole.set(t, isWholeTerm(t, primarySet)));
  const matches = [];
  let total = 0;
  loadedChapters.forEach((ch, idx) => {
    const title = normalizeArabic(ch.title || '');
    const body = chapterText(ch);
    let count = 0;
    all.forEach((t) => { count += countTerm(body, t, whole.get(t)); });
    const tmatch = all.some((t) => titleMatches(title, t, whole.get(t)));
    if (count > 0 || tmatch) { matches.push({ idx, ch, count }); total += count; }
  });
  return { matches, total };
}

/* ---- 5. Render chapter list / content ---- */
function applyFontSize() {
  chapterContent.querySelectorAll('.text-reading').forEach((el) => {
    el.style.fontSize = currentFontSize + 'px';
  });
  fontSizeIndicator.innerText = currentFontSize + 'px';
  try { localStorage.setItem(FS_KEY, currentFontSize); } catch (e) {}
}

function renderChapters(filter) {
  chapterList.innerHTML = '';
  const q = (filter || '').trim();
  let items;
  if (q) {
    const r = doSearch(q);
    items = r ? r.matches : [];
  } else {
    items = loadedChapters.map((ch, idx) => ({ idx, ch, count: 0 }));
  }
  if (!items.length) {
    chapterList.innerHTML = '<div class="px-3 py-2 text-xs text-slate-400">لا نتائج</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach(({ idx, ch, count }) => {
    const btn = document.createElement('button');
    const active = idx === currentChapterIndex;
    btn.className = 'w-full text-right px-3 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-between ' +
      (active
        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold border border-amber-200 dark:border-amber-800'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800');
    const badge = (q && count > 0) ? '<span class="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded shrink-0 mr-2">' + count + '</span>' : '';
    const span = document.createElement('span');
    span.className = 'flex-1 text-right whitespace-normal break-words leading-snug';
    span.textContent = (idx + 1) + '. ' + (ch.title || '');
    btn.appendChild(span);
    if (badge) btn.insertAdjacentHTML('beforeend', badge);
    btn.addEventListener('click', () => { loadChapter(idx); if (window.innerWidth < 1024) toggleSidebar(false); });
    frag.appendChild(btn);
  });
  chapterList.appendChild(frag);
}

function renderContent() {
  const ch = loadedChapters[currentChapterIndex];
  if (!ch) return;
  chapterContent.innerHTML = ch.content;
  const q = searchInput.value.trim();
  if (q) highlightSearchTerm(chapterContent, q);
  applyFontSize();
}

function loadChapter(index, scroll) {
  if (index < 0 || index >= loadedChapters.length) return;
  currentChapterIndex = index;
  renderContent();
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === loadedChapters.length - 1;
  pageIndicator.innerText = 'فصل ' + (index + 1) + ' من ' + loadedChapters.length;
  renderChapters(searchInput.value);
  if (scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---- 6. Search stats + quick jump ---- */
function updateGlobalSearchStats(query) {
  activeKeyboardIndex = -1;
  if (!terms(query).length) {
    searchStats.innerHTML = '';
    quickJumpResults.innerHTML = '';
    quickJumpResults.classList.add('hidden');
    return;
  }
  const r = doSearch(query);
  if (r && r.total > 0) {
    searchStats.innerHTML = 'وجدنا <strong class="text-amber-700 dark:text-amber-400">' + r.total + '</strong> نتيجة في <strong class="text-amber-700 dark:text-amber-400">' + r.matches.length + '</strong> فصل';
    const cap = r.matches.slice(0, 50);
    quickJumpResults.innerHTML = cap.map((m, i) =>
      '<button type="button" data-i="' + i + '" class="jump-item w-full text-right px-3 py-2 text-xs hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg transition border-b border-slate-100 dark:border-slate-700 last:border-none flex items-center justify-between">' +
      '<span class="flex-1 text-right font-semibold text-slate-700 dark:text-slate-300 whitespace-normal break-words leading-snug">' + (m.ch.title || '') + '</span>' +
      (m.count > 0 ? '<span class="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded shrink-0 mr-2">' + m.count + '</span>' : '') +
      '</button>').join('');
    quickJumpResults.querySelectorAll('.jump-item').forEach((el) => {
      el.addEventListener('click', () => jumpToChapter(cap[parseInt(el.dataset.i, 10)].idx));
    });
    quickJumpResults.classList.remove('hidden');
  } else {
    searchStats.innerHTML = '<span class="text-red-500 font-medium">لا توجد نتائج مطابقة</span>';
    quickJumpResults.innerHTML = '';
    quickJumpResults.classList.add('hidden');
  }
}

function jumpToChapter(index) {
  loadChapter(index);
  quickJumpResults.classList.add('hidden');
  if (window.innerWidth < 1024) toggleSidebar(false);
}

function updateKeyboardSelection(items) {
  items.forEach((item, idx) => {
    if (idx === activeKeyboardIndex) {
      item.classList.add('bg-amber-100', 'dark:bg-amber-900', 'text-amber-900', 'dark:text-amber-100');
      item.classList.remove('hover:bg-amber-50', 'dark:hover:bg-slate-700');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('bg-amber-100', 'dark:bg-amber-900', 'text-amber-900', 'dark:text-amber-100');
      item.classList.add('hover:bg-amber-50', 'dark:hover:bg-slate-700');
    }
  });
}

searchInput.addEventListener('keydown', (e) => {
  if (quickJumpResults.classList.contains('hidden')) return;
  const items = quickJumpResults.querySelectorAll('.jump-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); activeKeyboardIndex = (activeKeyboardIndex + 1) % items.length; updateKeyboardSelection(items); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); activeKeyboardIndex = (activeKeyboardIndex - 1 + items.length) % items.length; updateKeyboardSelection(items); }
  else if (e.key === 'Enter') { e.preventDefault(); (activeKeyboardIndex >= 0 ? items[activeKeyboardIndex] : items[0]).click(); }
  else if (e.key === 'Escape') { quickJumpResults.classList.add('hidden'); }
});

/* ---- 7. Search input ---- */
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const q = searchInput.value.trim();
    renderContent();
    renderChapters(q);
    updateGlobalSearchStats(q);
  }, 150);
});

/* ---- 8. Font size ---- */
fontIncrease.addEventListener('click', () => { if (currentFontSize < 28) { currentFontSize += 2; applyFontSize(); } });
fontDecrease.addEventListener('click', () => { if (currentFontSize > 14) { currentFontSize -= 2; applyFontSize(); } });

/* ---- 9. Pagination ---- */
prevBtn.addEventListener('click', () => { if (currentChapterIndex > 0) loadChapter(currentChapterIndex - 1); });
nextBtn.addEventListener('click', () => { if (currentChapterIndex < loadedChapters.length - 1) loadChapter(currentChapterIndex + 1); });

/* ---- 10. Boot ---- */
async function initReader() {
  try {
    const res = await fetchWithTimeout('manifest.json', 12000);
    if (!res.ok) throw new Error('manifest');
    chaptersManifest = await res.json();
    loadedChapters = await Promise.all(chaptersManifest.map(async (meta) => {
      try {
        const r = await fetchWithTimeout(meta.file, 12000);
        const data = await r.json();
        return { id: meta.id, title: meta.title, file: meta.file, content: data.content || '' };
      } catch (e) {
        return { id: meta.id, title: meta.title, file: meta.file, content: '<p class="text-reading text-lg text-red-500">تعذر تحميل هذا الفصل.</p>' };
      }
    }));
    if (!loadedChapters.length) {
      chapterContent.innerHTML = '<p class="text-center text-slate-400 py-16">لا توجد فصول.</p>';
      return;
    }
    renderChapters('');
    loadChapter(0);
  } catch (error) {
    chapterContent.innerHTML = '<div class="text-center py-16"><p class="text-slate-400 mb-4">تعذّر تحميل الفهرس — تحقّق من الاتصال بالإنترنت.</p><button id="retryBtn" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition">إعادة المحاولة</button></div>';
    const rb = document.getElementById('retryBtn');
    if (rb) rb.addEventListener('click', initReader);
  }
}
initReader();

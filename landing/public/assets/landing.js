// InboxFly 官网：深浅色 + PWA
function siteMode() {
  const m = localStorage.getItem('site-mode');
  if (m === 'dark' || m === 'light') return m;
  try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}
function applySiteMode() {
  document.documentElement.dataset.mode = siteMode();
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.innerHTML = siteMode() === 'dark'
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>';
  });
}
document.querySelectorAll('.mode-btn').forEach(b => b.onclick = () => {
  const next = siteMode() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('site-mode', next); } catch {}
  document.documentElement.dataset.mode = next;
  applySiteMode();
});
applySiteMode();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ---------- 语言切换：lucide languages 图标 + 下拉 ----------
(function () {
  const LANG_CODES = ['en', 'zh', 'ja', 'ko', 'de', 'fr', 'it', 'ru', 'vi'];
  const LANG_NAMES = { en: 'English', zh: '简体中文', ja: '日本語', ko: '한국어', de: 'Deutsch',
    fr: 'Français', it: 'Italiano', ru: 'Русский', vi: 'Tiếng Việt' };
  // 生成当前语言页面的目标链接：9 语言全部保留同路径（页面均存在）；仅 en/zh 才有的路径
  // （如 /articles、/zh/articles）切到其他语言时回落到对应语言 product 页
  const KEEP_PATH = ['/about', '/terms', '/privacy', '/docs', '/self-hosted'];
  function langHref(lang) {
    const path = location.pathname;
    const noLang = path.replace(/^\/(zh|ja|ko|de|fr|it|ru|vi)\//, '/');
    if (lang === 'en') return noLang === '/' ? '/self-hosted' : noLang;
    if (lang === 'zh') return noLang === '/' ? '/zh/self-hosted' : '/zh' + noLang;
    return KEEP_PATH.includes(noLang) ? '/' + lang + noLang : '/' + lang + '/self-hosted';
  }
  // 当前语言：从路径识别
  function currentLang() {
    const m = location.pathname.match(/^\/(zh|ja|ko|de|fr|it|ru|vi)\//);
    return m ? m[1] : 'en';
  }
  document.querySelectorAll('.lang-drop').forEach(drop => {
    const btn = drop.querySelector('.lang-btn');
    const menu = drop.querySelector('.lang-menu');
    if (!btn || !menu) return;
    // 高亮当前语言
    const cur = currentLang();
    menu.querySelectorAll('a').forEach(a => {
      a.classList.toggle('on', a.dataset.l === cur);
      a.querySelector('.tick')?.remove();
      if (a.dataset.l === cur) {
        const t = document.createElement('span');
        t.className = 'tick'; t.textContent = '✓';
        a.appendChild(t);
      }
    });
    btn.onclick = e => {
      e.stopPropagation();
      menu.classList.toggle('open');
    };
    menu.querySelectorAll('a').forEach(a => {
      a.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        try { localStorage.setItem('site-lang', a.dataset.l); } catch (err) {}
        location.href = langHref(a.dataset.l);
      };
    });
  });
  document.addEventListener('click', () => document.querySelectorAll('.lang-menu.open').forEach(m => m.classList.remove('open')));
})();

// ---------- 移动端汉堡菜单 ----------
(function () {
  const burger = document.getElementById('nav-burger');
  const menu = document.getElementById('mobile-menu');
  if (!burger || !menu) return;
  burger.onclick = () => menu.classList.toggle('open');
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
})();

// ---------- FAQ 默认全部展开（兼容旧缓存 HTML） ----------
(function () {
  document.querySelectorAll('.faq details').forEach(d => { d.open = true; });
})();

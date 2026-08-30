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

// ---------- 语言持久化：点击记忆 + 跨页自动跟随 ----------
(function () {
  const root = document.documentElement;
  const pageLang = root.dataset.lang;           // 'en' | 'zh'（404 页无此属性则跳过）
  const alt = root.dataset.alt;                 // 对应语言的备用路径
  // 记录语言切换点击
  document.querySelectorAll('.lang-sw a').forEach(a => {
    a.addEventListener('click', () => {
      const toZh = a.getAttribute('href').startsWith('/zh');
      try { localStorage.setItem('site-lang', toZh ? 'zh' : 'en'); } catch (e) {}
    });
  });
  // 已有偏好且与当前页语言不同 → 自动跳到备用路径
  let stored = null;
  try { stored = localStorage.getItem('site-lang'); } catch (e) {}
  if (pageLang && alt && stored && stored !== pageLang) {
    location.replace(alt);
  }
})();

// ---------- 移动端汉堡菜单 ----------
(function () {
  const burger = document.getElementById('nav-burger');
  const menu = document.getElementById('mobile-menu');
  if (!burger || !menu) return;
  burger.onclick = () => menu.classList.toggle('open');
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
})();

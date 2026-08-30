// 邮件 HTML 服务端消毒（InboxFly-Open.md §6.2 第 1/3 层：标签白名单剥离 + 远程图片默认不加载 + cid 重写）
// 渲染端另有 iframe sandbox + CSP 双保险（app.js）
const BLOCKED_IMG = 'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="26"><rect x="1" y="1" width="138" height="24" rx="5" fill="#f2f2f5"/><text x="70" y="17" font-size="12" fill="#8a8a94" text-anchor="middle">远程图片已屏蔽 · 点击后可加载</text></svg>');

export function sanitizeHtml(html, opts = {}) {
  try {
    let s = String(html || '');
    // 危险块整体移除
    s = s.replace(/<\s*(script|style|iframe|object|embed|form|meta|link|base)\b[\s\S]*?<\/\s*\1\s*>/gi, '');
    s = s.replace(/<\s*(script|style|iframe|object|embed|form|meta|link|base)\b[^>]*>/gi, '');
    // 事件属性与 javascript: URL
    s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(/(href|src|background)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1="#"');
    // cid: 内嵌图 → 鉴权附件接口
    const cidMap = opts.cidMap || {};
    s = s.replace(/(src|background)\s*=\s*(["'])\s*cid:([^"'\s>]+)\2/gi, (m, attr, q, cid) => {
      const attId = cidMap[String(cid).toLowerCase()];
      return attId ? `${attr}="/api/emails/${opts.emailId}/attachments/${attId}"` : `${attr}=""`;
    });
    // 远程图片默认不加载（防追踪像素 / IP 泄露）
    s = s.replace(/(<img[^>]*?)\ssrc\s*=\s*(["'])(https?:)?\/\/[^"']*\2/gi, (m, pre) => `${pre} src="${BLOCKED_IMG}"`);
    s = s.replace(/(<img[^>]*?)\ssrcset\s*=\s*(["'])[^"']*\2/gi, '$1');
    return s;
  } catch {
    return '<p>(正文解析失败)</p>';
  }
}

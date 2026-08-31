// 邮件处理管道核心（InboxFly-Open.md §2.3 / §2.4 / §4 / §7 / §8）
// 被 Email Worker（生产真实收信）与 dev simulate（本地模拟）共用
import PostalMime from 'postal-mime';
import { SCHEMA_SQL } from './schema.js';
import { randomHex } from './auth.js';

const enc = new TextEncoder();
let schemaReady = false;

export async function ensureSchema(env) {
  if (schemaReady) return;
  const t = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_config'").first();
  if (!t) {
    // D1 的 exec() 对多语句/尾随换行有兼容问题，这里手动拆分逐条执行
    const stmts = SCHEMA_SQL.split(';').map(s => s.trim()).filter(s => s.length);
    for (const s of stmts) await env.DB.prepare(s).run();
  }
  // 幂等迁移：emails 增加 is_read（未读徽章）；存量邮件视为已读
  const cols = await env.DB.prepare("PRAGMA table_info(emails)").all();
  if (!cols.results.some(c => c.name === 'is_read')) {
    await env.DB.prepare("ALTER TABLE emails ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0").run();
    await env.DB.prepare("UPDATE emails SET is_read = 1").run();
  }
  // 未读轮询索引（v0.6.1）
  const idx = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_emails_read'").first();
  if (!idx) await env.DB.prepare("CREATE INDEX idx_emails_read ON emails(is_read)").run();
  schemaReady = true;
}

export async function getConfig(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM app_config').all();
  const cfg = {};
  for (const r of results) cfg[r.key] = r.value;
  return cfg;
}

export async function setConfig(env, key, value) {
  await env.DB.prepare(
    'INSERT INTO app_config(key, value) VALUES(?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2',
  ).bind(key, String(value)).run();
}

const now = () => new Date().toISOString();
const uid = p => `${p}_${randomHex(8)}`;

// ---------- 规则引擎（§4.2 先匹配先停：exact 优先于 catchall，组内按 sort_key） ----------
export async function listEnabledRules(db) {
  const { results } = await db.prepare(`
    SELECT * FROM forwarding_rules WHERE enabled = 1
    ORDER BY CASE pattern_type WHEN 'exact' THEN 0 ELSE 1 END, sort_key ASC
  `).all();
  return results.map(r => ({
    ...r,
    destinations: safeParse(r.destinations_json, []),
    filters: safeParse(r.filters_json, {}),
  }));
}

function safeParse(s, dflt) {
  try { const v = JSON.parse(s); return v ?? dflt; } catch { return dflt; }
}

// 筛选器语法（§4.4）：完整地址=精确 / @domain=域名后缀 / /…/=正则
export function matchEntry(entry, addr) {
  if (!entry || !addr) return false;
  const e = String(entry).trim().toLowerCase();
  const a = String(addr).toLowerCase();
  if (e.startsWith('/') && e.lastIndexOf('/') > 0) {
    try { return new RegExp(e.slice(1, -1), 'i').test(a); } catch { return false; }
  }
  if (e.startsWith('@')) return a.endsWith(e) || a.endsWith(e.slice(1));
  return a === e;
}

export function evaluateFilters(rule, ctx) {
  const f = rule.filters || {};
  for (const entry of (f.from_blacklist || [])) {
    if (matchEntry(entry, ctx.from)) return { pass: false, reason: `from_blacklist: ${entry}` };
  }
  if (f.max_size_mb && ctx.sizeBytes > Number(f.max_size_mb) * 1024 * 1024) {
    return { pass: false, reason: `max_size_mb: ${f.max_size_mb}` };
  }
  if (f.subject_regex) {
    try {
      if (!new RegExp(f.subject_regex).test(ctx.subject || '')) return { pass: false, reason: 'subject_regex' };
    } catch { /* 非法正则忽略（保存时已校验） */ }
  }
  if (Array.isArray(f.to_whitelist) && f.to_whitelist.length) {
    const ok = (f.to_whitelist || []).some(e => matchEntry(e, ctx.to));
    if (!ok) return { pass: false, reason: 'to_whitelist' };
  }
  if (f.has_attachment === true && !ctx.hasAtt) return { pass: false, reason: 'has_attachment' };
  if (f.has_attachment === false && ctx.hasAtt) return { pass: false, reason: 'has_attachment' };
  return { pass: true };
}

export function pickRule(rules, ctx) {
  const to = String(ctx.to || '').toLowerCase();
  const domain = to.split('@')[1] || '';
  for (const r of rules) {
    if (r.pattern_type === 'exact') {
      if (to === r.pattern.toLowerCase()) return r;
    } else if (domain && domain === r.pattern.replace(/^\*\@/, '').toLowerCase()) {
      return r;
    }
  }
  return null;
}

// 决策：返回 { status, ruleId, blockedReason, dests, behavior }（status ∈ forwarded/blocked/dropped/rejected/error）
export function decideStatus(rules, cfg, ctx) {
  const hit = pickRule(rules, ctx);
  let dests = [];
  if (hit) {
    const f = evaluateFilters(hit, ctx);
    if (!f.pass) {
      return { status: 'blocked', ruleId: hit.id, blockedReason: f.reason, dests: [], behavior: cfg.blocked_mail_action === 'reject' ? 'reject' : 'drop' };
    }
    if (hit.action === 'block') return { status: 'rejected', ruleId: hit.id, blockedReason: 'rule action: block', dests: [], behavior: 'reject' };
    if (hit.action === 'blackhole') return { status: 'dropped', ruleId: hit.id, blockedReason: 'rule action: blackhole', dests: [], behavior: 'drop' };
    return { status: 'forwarded', ruleId: hit.id, blockedReason: null, dests: hit.destinations, behavior: 'forward' };
  }
  const da = cfg.default_action || 'forward_default';
  if (da === 'reject') return { status: 'rejected', ruleId: null, blockedReason: 'default_action: reject', dests: [], behavior: 'reject' };
  if (da === 'drop') return { status: 'dropped', ruleId: null, blockedReason: 'default_action: drop', dests: [], behavior: 'drop' };
  if (cfg.default_forward) return { status: 'forwarded', ruleId: null, blockedReason: null, dests: [cfg.default_forward], behavior: 'forward' };
  return { status: 'dropped', ruleId: null, blockedReason: 'default_action: no default_forward', dests: [], behavior: 'drop' };
}

// ---------- 统计（§7 处理状态口径） ----------
export async function recordStats(db, domain, status, bytes, when = new Date()) {
  const date = when.toISOString().slice(0, 10);
  const col = { forwarded: 1, blocked: 1, dropped: 1, rejected: 1, error: 1 }[status] ? `${status}_count` : null;
  await db.prepare(`
    INSERT INTO forwarding_stats (date, domain, forwarded_count, blocked_count, dropped_count, rejected_count, error_count, bytes_total)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON CONFLICT(date, domain) DO UPDATE SET
      forwarded_count = forwarded_count + ?3,
      blocked_count = blocked_count + ?4,
      dropped_count = dropped_count + ?5,
      rejected_count = rejected_count + ?6,
      error_count = error_count + ?7,
      bytes_total = bytes_total + ?8
  `).bind(
    date, domain,
    status === 'forwarded' ? 1 : 0,
    status === 'blocked' ? 1 : 0,
    status === 'dropped' ? 1 : 0,
    status === 'rejected' ? 1 : 0,
    status === 'error' ? 1 : 0,
    bytes || 0,
  ).run();
}

// ---------- 存储（§2.3 步骤 5：与转发互相独立；§8 R2 键布局） ----------
function sanitizeFilename(name) {
  return String(name || 'attachment').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_').slice(0, 120) || 'attachment';
}

export function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ');
}

export async function storeParsedEmail(env, parsed, ctx, opts) {
  const { status, ruleId, blockedReason, perDest, rawBuf } = opts;
  const metaOnly = !!opts.metaOnly;
  const id = uid('eml');
  const d = opts.receivedAt ? new Date(opts.receivedAt) : new Date();
  const ym = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const keys = { raw: `raw/${ym}/${id}.eml`, html: `body/${id}.html`, txt: `body/${id}.txt` };
  const attRows = [];

  if (!metaOnly) {
    try {
      await env.R2.put(keys.raw, rawBuf);
      if (parsed.html) await env.R2.put(keys.html, parsed.html);
      if (parsed.text) await env.R2.put(keys.txt, parsed.text);
      for (const a of (parsed.attachments || [])) {
        const attId = uid('att');
        const key = `att/${id}/${attId}/${sanitizeFilename(a.filename)}`;
        await env.R2.put(key, a.content);
        attRows.push({
          id: attId, email_id: id, filename: a.filename || 'attachment',
          content_type: a.mimeType || 'application/octet-stream',
          size_bytes: a.content ? a.content.byteLength : 0, r2_key: key, cid: (a.cid || '').toLowerCase(),
        });
      }
    } catch (e) {
      // 存储失败不阻断转发结果（§5.4）：仅标记错误元数据
      console.error('R2 store failed:', e);
    }
  }

  const preview = (parsed.text || stripTags(parsed.html) || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  await env.DB.prepare(`
    INSERT INTO emails (id, user_id, rule_id, domain, message_id, in_reply_to, references_json,
      from_addr, from_name, to_addrs_json, subject, body_preview,
      raw_r2_key, body_html_r2_key, body_text_r2_key, size_bytes, has_attachments,
      status, blocked_reason, per_destination_json, received_at)
    VALUES (?1, 'local', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
  `).bind(
    id, ruleId || null, ctx.domain || (ctx.to || '').split('@')[1] || '',
    parsed.messageId ? String(parsed.messageId).replace(/[<>]/g, '') : null,
    parsed.inReplyTo ? String(parsed.inReplyTo).replace(/[<>]/g, '') : null,
    JSON.stringify(parsed.references || []),
    ctx.from || null, parsed.from?.name || null,
    JSON.stringify(ctx.toAddrs || [ctx.to]), parsed.subject || '', preview,
    opts.metaOnly ? null : keys.raw,
    opts.metaOnly || !parsed.html ? null : keys.html,
    opts.metaOnly || !parsed.text ? null : keys.txt,
    ctx.sizeBytes || 0, attRows.length ? 1 : 0,
    status, blockedReason, JSON.stringify(perDest || []),
    d.toISOString(),
  ).run();

  for (const a of attRows) {
    await env.DB.prepare(
      'INSERT INTO attachments (id, email_id, filename, content_type, size_bytes, r2_key, cid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    ).bind(a.id, a.email_id, a.filename, a.content_type, a.size_bytes, a.r2_key, a.cid).run();
  }
  return id;
}

// ---------- 本地模拟收信（生产环境真实收信经由 email.js；本地无 Email Routing，用同一条管道注入） ----------
const SIM_TEMPLATES = [
  {
    kind: 'ok', fromName: 'GitHub', from: 'noreply@github.com', toLocal: 'you',
    subject: '[InBoxFly] Deploy to Cloudflare 成功',
    html: '<h2 style="color:#24292f">部署成功 🎉</h2><p>您的 Worker 已部署至 <b>myblog.com</b>，catch-all 路由已生效，首次转发测试通过。</p><p style="color:#57606a">构建编号 #128 · 耗时 42s</p>',
    text: '部署成功：您的 Worker 已部署至 myblog.com，catch-all 路由已生效。',
  },
  {
    kind: 'ok', fromName: 'Stripe', from: 'billing@stripe.com', toLocal: 'billing',
    subject: '您的新进账：$79.00 — InboxFly Pro 年度订阅',
    html: '<p>收款已结算。</p><p>金额：<b>$79.00</b><br>发票编号：INV-2026-0828</p><p>附件为 PDF 发票。</p>',
    text: '收款已结算：$79.00，发票 INV-2026-0828。',
    attach: { filename: 'invoice-INV-2026-0828.pdf', type: 'application/pdf', content: '%PDF-1.4 InboxFly simulated invoice\n' },
  },
  {
    kind: 'newsletter', fromName: 'Weekly Dev Digest', from: 'digest@weeklydev.io', toLocal: 'newsletter',
    subject: '每周精选：Edge Runtime 的 10 个新玩法',
    html: '<h3>本周精选</h3><ul><li>Workers TCP Sockets 实战</li><li>D1 迁移最佳实践</li><li>R2 分片上传技巧</li></ul><p><a href="https://example.com/unsubscribe">退订</a></p>',
    text: '本周精选：Workers TCP Sockets、D1 迁移、R2 分片上传。',
  },
  {
    kind: 'spam', fromName: 'Mega Deals', from: 'noreply@mkting-deal.net', toLocal: 'you',
    subject: '⚡️限时 90% OFF，最后 3 小时！！',
    html: '<p><b>错过再等一年！</b>全场清仓大甩卖，点击立即抢购！</p>',
    text: '限时 90% OFF！全场清仓大甩卖！',
  },
  {
    kind: 'error', fromName: 'Mail Delivery Subsystem', from: 'postmaster@bounce.cloudflare.net', toLocal: 'you',
    subject: 'Undelivered Mail Returned to Sender',
    html: '<p>目标地址 <code>mail-old@example.com</code> 拒收，重试 3 次失败。</p><p>诊断：550 mailbox unavailable</p>',
    text: '目标地址拒收：550 mailbox unavailable',
    attach: { filename: 'bounce-log.txt', type: 'text/plain', content: 'diagnostic: 550 mailbox unavailable\n' },
  },
  {
    kind: 'ok', fromName: 'Vercel', from: 'notifications@vercel.com', toLocal: 'dev',
    subject: 'Deployment ready: inboxfly-web',
    html: '<p>构建耗时 <b>42s</b>，预览链接已生成。</p><p>附件为构建日志。</p>',
    text: 'Deployment ready. Build 42s.',
    attach: { filename: 'build-log.txt', type: 'text/plain', content: 'building...\ndone in 42s\n' },
  },
];

function buildRawEml(t, to, receivedAt) {
  const boundary = 'ifb_' + randomHex(8);
  const msgId = `<${randomHex(12)}@${to.split('@')[1] || 'local'}>`;
  const headers = [
    `From: ${t.fromName} <${t.from}>`,
    `To: <${to}>`,
    `Subject: ${t.subject}`,
    `Date: ${receivedAt.toUTCString()}`,
    `Message-ID: ${msgId}`,
    'MIME-Version: 1.0',
  ];
  const altBoundary = 'ifa_' + randomHex(8);
  const textPart = [
    `--${altBoundary}`, 'Content-Type: text/plain; charset=utf-8', '', t.text || t.subject, '',
    `--${altBoundary}`, 'Content-Type: text/html; charset=utf-8', '', t.html, '', `--${altBoundary}--`, '',
  ];
  if (t.attach) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, '');
    headers.push(`--${boundary}`, `Content-Type: multipart/alternative; boundary="${altBoundary}"`, '', ...textPart,
      `--${boundary}`, `Content-Type: ${t.attach.type}; name="${t.attach.filename}"`,
      'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${t.attach.filename}"`, '',
      btoa(t.attach.content), '', `--${boundary}--`, '');
  } else {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`, '', ...textPart);
  }
  return headers.join('\r\n');
}

export async function simGenerate(env, count = 5) {
  await ensureSchema(env);
  const cfg = await getConfig(env);
  const rules = await listEnabledRules(env.DB);
  const domains = [...new Set(rules.filter(r => r.pattern_type === 'catchall').map(r => r.pattern.replace(/^\*\@/, '')))];
  if (!domains.length) domains.push('myblog.com');
  const created = [];
  for (let i = 0; i < count; i++) {
    const t = SIM_TEMPLATES[Math.floor(Math.random() * SIM_TEMPLATES.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const to = `${t.toLocal}@${domain}`;
    const receivedAt = new Date(Date.now() - Math.floor(Math.random() * 8 + 1) * 60000);
    const raw = buildRawEml(t, to, receivedAt);
    const buf = enc.encode(raw);
    const parsed = await PostalMime.parse(buf);
    const ctx = {
      to, from: t.from, subject: t.subject, domain,
      toAddrs: [to], sizeBytes: buf.byteLength,
      hasAtt: !!(parsed.attachments && parsed.attachments.length),
    };
    const dec = decideStatus(rules, cfg, ctx);
    const perDest = dec.dests.map(d => ({ to: d, ok: true, simulated: true }));
    await storeParsedEmail(env, parsed, ctx, {
      status: dec.status, ruleId: dec.ruleId, blockedReason: dec.blockedReason,
      perDest, rawBuf: buf, receivedAt: receivedAt.toISOString(),
    });
    await recordStats(env.DB, domain, dec.status, ctx.sizeBytes, receivedAt);
    created.push(t.subject);
  }
  return created;
}

export async function resetData(env) {
  await ensureSchema(env);
  await env.DB.exec('DELETE FROM attachments; DELETE FROM emails; DELETE FROM forwarding_stats;');
  // 清理 R2 全部对象
  let done = false;
  while (!done) {
    const list = await env.R2.list({ limit: 500 });
    if (!list.objects.length) break;
    await env.R2.delete(list.objects.map(o => o.key));
    done = list.truncated === false;
  }
  return true;
}

// ---------- R2 过期清理（§8/§11：OSS 保留期固定 30 天，可用 cfg.retention_days 覆盖） ----------
export async function cleanupExpired(env, daysOverride) {
  await ensureSchema(env);
  const cfg = await getConfig(env);
  // 注意：daysOverride=0 表示"全部过期"，不能用 || 短路
  const days = Number(daysOverride !== undefined && daysOverride !== null ? daysOverride : (cfg.retention_days || 30));
  const cutoff = Date.now() - days * 86400000;
  let cursor;
  let deleted = 0;
  do {
    const list = await env.R2.list({ cursor, limit: 500 });
    const expired = list.objects.filter(o => o.uploaded && o.uploaded.getTime() < cutoff).map(o => o.key);
    if (expired.length) {
      await env.R2.delete(expired);
      deleted += expired.length;
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  return deleted;
}

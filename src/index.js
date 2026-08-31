// InboxFly Worker 主入口：管理 API（Hono）+ Email Worker 导出
// API 契约见 InboxFly-Open.md §10；鉴权见 §9
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { ensureSchema, getConfig, setConfig, listEnabledRules, simGenerate, resetData, cleanupExpired } from './pipeline.js';
import { hashPassword, verifyPassword, randomHex, createSessionToken, verifySessionToken, safeEqual } from './auth.js';
import { sanitizeHtml } from './sanitize.js';
import { handleEmail } from './email.js';
import { cfClient, cfErr, findZone, routingStatus, enableRouting, recommendedDns, listDns, createDns, setCatchAllWorker, listNativeRules, deleteNativeRule, listDestinationAddresses, createDestinationAddress } from './cfapi.js';

const app = new Hono();

// 从 Cloudflare 同步账号下全部 zone 列表与 Email Routing 状态（§3.4.1 域名自动发现）
// 手动同步接口与 Cron 定时刷新共用；未配置 token 时静默返回 null
async function syncZonesFromCF(env) {
  const cfg = await getConfig(env);
  const token = cfg.cf_api_token;
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };
  const zones = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones?per_page=50&page=${page}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!data.success) return { error: 'cf_api_error', detail: (data.errors || []).map(e => e.message).join('; ') || String(res.status) };
    zones.push(...(data.result || []).map(z => ({ id: z.id, name: String(z.name).toLowerCase(), account_id: z.account?.id })));
    const total = data.result_info?.total_count || zones.length;
    if (page >= Math.ceil(total / 50)) break;
  }
  const registry = getRegistry(cfg);
  const manual = registry.filter(e => e.source === 'manual');
  const cfEntries = [];
  for (const z of zones) {
    let er = false;
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${z.id}/email/routing`, { headers });
      const d = await r.json();
      er = !!(d.result && d.result.enabled);
    } catch { er = false; }
    cfEntries.push({ domain: z.name, source: 'cf', email_routing: er, zone_id: z.id, ...(z.account_id ? { account_id: z.account_id } : {}) });
  }
  if (cfEntries[0]?.account_id) await setConfig(env, 'cf_account_id', cfEntries[0].account_id);
  const merged = [...cfEntries, ...manual.filter(m => !cfEntries.some(x => x.domain === m.domain))];
  await setRegistry(env, merged);
  await setConfig(env, 'last_zone_sync_at', new Date().toISOString());
  return { ok: true, zones: cfEntries.length, email_routing_on: cfEntries.filter(e => e.email_routing).length };
}

// 全局安全响应头（防点击劫持 / 防 referrer 泄露）
app.use('*', async (c, next) => {
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  await next();
});
const now = () => new Date().toISOString();
const uid = p => `${p}_${randomHex(8)}`;
const j = (c, obj, status = 200) => c.json(obj, status);

const PUBLIC_CONFIG_KEYS = ['default_action', 'default_forward', 'blocked_mail_action', 'store_blocked_mail', 'storage_mode', 'retention_days', 'setup_completed'];
const TURNSTILE_SECRET_TEST_OK = '1x0000000000000000000000000000000AA'; // Cloudflare 官方测试密钥：总是通过（本地调试用）

// Turnstile 服务端校验（§12.2.2 机器人防护）
async function verifyTurnstile(env, token, ip) {
  if (!token) return false;
  try {
    const cfg = await getConfig(env);
    const body = new URLSearchParams({
      secret: cfg.turnstile_secret_key || TURNSTILE_SECRET_TEST_OK,
      response: token,
      remoteip: ip || '',
    });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

// ---------- 会话 ----------
async function issueSession(c, username, secret, ttlSec = 7 * 86400) {
  const token = await createSessionToken(username, secret, ttlSec);
  const csrf = randomHex(16);
  const secure = c.req.url.startsWith('https');
  setCookie(c, 'if_session', token, { httpOnly: true, path: '/', sameSite: 'Lax', maxAge: ttlSec, secure });
  setCookie(c, 'if_csrf', csrf, { path: '/', sameSite: 'Lax', maxAge: ttlSec, secure });
  return csrf;
}

// ---------- 中间件：自动建表 + 认证 + CSRF ----------
app.use('/api/*', async (c, next) => {
  try { await ensureSchema(c.env); } catch (e) {
    return j(c, { error: 'db_init_failed', detail: String(e) }, 500);
  }
  const open = ['/api/health', '/api/setup/status', '/api/setup', '/api/setup/verify', '/api/auth/login', '/api/auth/challenge'];
  if (open.includes(c.req.path)) return next();

  const cfg = await getConfig(c.env);
  if (!cfg.setup_completed) return j(c, { error: 'setup_required' }, 401);
  // 调试端点仅限本地开发（DEV_TOOLS=true），生产返回 404
  if (c.req.path.startsWith('/api/dev/') && c.env.DEV_TOOLS !== 'true') {
    return j(c, { error: 'not_found' }, 404);
  }
  const sess = getCookie(c, 'if_session') || '';
  const payload = await verifySessionToken(sess, cfg.session_secret);
  if (!payload) return j(c, { error: 'unauthorized' }, 401);
  c.set('user', payload.u);

  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const tok = c.req.header('X-CSRF-Token') || '';
    const ck = getCookie(c, 'if_csrf') || '';
    if (!tok || !ck || !safeEqual(tok, ck)) return j(c, { error: 'csrf' }, 403);
  }
  await next();
});

// ---------- 健康检查 ----------
app.get('/api/health', c => j(c, { ok: true, app: 'inboxfly', time: now() }));

// ---------- 首次运行向导（§3.2） ----------
app.get('/api/setup/status', async c => {
  const cfg = await getConfig(c.env);
  return j(c, { setupRequired: !cfg.setup_completed });
});

app.post('/api/setup/verify', async c => {
  const cfg = await getConfig(c.env);
  if (cfg.setup_completed) return j(c, { error: 'already_setup' }, 400);
  const { token } = await c.req.json().catch(() => ({}));
  if (!token || token !== c.env.SETUP_TOKEN) return j(c, { error: 'invalid_token' }, 403);
  return j(c, { ok: true });
});

app.post('/api/setup', async c => {
  const cfg = await getConfig(c.env);
  if (cfg.setup_completed) return j(c, { error: 'already_setup' }, 400);
  const { token, username, password } = await c.req.json().catch(() => ({}));
  if (!token || token !== c.env.SETUP_TOKEN) return j(c, { error: 'invalid_token' }, 403);
  if (!username || String(username).length < 3) return j(c, { error: 'bad_username' }, 400);
  if (!password || String(password).length < 8) return j(c, { error: 'bad_password' }, 400);
  const secret = randomHex(48);
  const rows = [
    ['admin_username', String(username)],
    ['admin_pass', await hashPassword(String(password))],
    ['session_secret', secret],
    ['setup_completed', 'true'],
    ['default_action', 'forward_default'],
    ['blocked_mail_action', 'drop'],
    ['store_blocked_mail', 'false'],
    ['storage_mode', 'full'],
    ['retention_days', '30'],
  ];
  for (const [k, v] of rows) await setConfig(c.env, k, v);
  const csrf = await issueSession(c, String(username), secret);
  return j(c, { ok: true, csrf });
});

// ---------- 认证 ----------
// 登录页公共挑战配置（是否启用 Turnstile + 站点密钥）
app.get('/api/auth/challenge', async c => {
  const cfg = await getConfig(c.env);
  const enabled = cfg.turnstile_enabled === 'true';
  return j(c, { enabled, siteKey: enabled ? (cfg.turnstile_site_key || '') : null });
});

app.post('/api/auth/login', async c => {
  const cfg = await getConfig(c.env);
  if (!cfg.setup_completed) return j(c, { error: 'setup_required' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const ip = c.req.header('CF-Connecting-IP') || 'local';

  // Turnstile 机器人防护（§12.2.2）：后台开启后登录必须携带有效 token
  if (cfg.turnstile_enabled === 'true') {
    const ok = await verifyTurnstile(c.env, body.turnstile_token, ip);
    if (!ok) return j(c, { error: 'turnstile_failed' }, 403);
  }

  // 登录限流（§9.2）：同 IP 每分钟 10 次，KV 计数
  const bucket = Math.floor(Date.now() / 60000);
  const key = `rl:${ip}:${bucket}`;
  const n = parseInt((await c.env.KV.get(key)) || '0', 10) + 1;
  await c.env.KV.put(key, String(n), { expirationTtl: 120 });
  if (n > 10) return j(c, { error: 'rate_limited' }, 429);

  const { username, password, remember } = body;
  const okUser = username && safeEqual(username, cfg.admin_username || '');
  const okPass = okUser && await verifyPassword(password || '', cfg.admin_pass || '');
  if (!okUser || !okPass) return j(c, { error: 'bad_credentials' }, 401);
  const csrf = await issueSession(c, username, cfg.session_secret, remember === true ? 30 * 86400 : 24 * 3600);
  return j(c, { ok: true, csrf });
});

app.post('/api/auth/logout', c => {
  deleteCookie(c, 'if_session', { path: '/' });
  deleteCookie(c, 'if_csrf', { path: '/' });
  return j(c, { ok: true });
});

app.get('/api/auth/me', c => j(c, { username: c.get('user') }));

// ---------- 全局配置 ----------
app.get('/api/config', async c => {
  const cfg = await getConfig(c.env);
  const out = {};
  for (const k of PUBLIC_CONFIG_KEYS) out[k] = cfg[k] ?? (k === 'retention_days' ? '30' : null);
  out.cf_api_token_set = !!cfg.cf_api_token; // token 本身不回传，只回传是否已设置
  out.turnstile_enabled = cfg.turnstile_enabled === 'true';
  out.turnstile_site_key = cfg.turnstile_site_key || '';
  out.turnstile_secret_set = !!cfg.turnstile_secret_key; // 密钥不回传
  return j(c, out);
});

app.patch('/api/config', async c => {
  const body = await c.req.json().catch(() => ({}));
  const allowed = PUBLIC_CONFIG_KEYS.filter(k => k !== 'setup_completed')
    .concat(['cf_api_token', 'turnstile_enabled', 'turnstile_site_key', 'turnstile_secret_key', 'retention_days']);
  const checks = {
    default_action: v => ['forward_default', 'reject', 'drop'].includes(v),
    blocked_mail_action: v => ['drop', 'reject'].includes(v),
    storage_mode: v => ['full', 'metadata_only'].includes(v),
    store_blocked_mail: v => ['true', 'false'].includes(v),
    default_forward: v => v === '' || typeof v === 'string',
    cf_api_token: v => typeof v === 'string',
    turnstile_enabled: v => ['true', 'false'].includes(v),
    turnstile_site_key: v => typeof v === 'string',
    turnstile_secret_key: v => typeof v === 'string',
    retention_days: v => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 365,
  };
  for (const [k, v] of Object.entries(body)) {
    if (!allowed.includes(k)) continue;
    if (checks[k] && !checks[k](v)) return j(c, { error: `bad_value:${k}` }, 400);
    if (k === 'default_forward' && v) {
      const d = await c.env.DB.prepare('SELECT status FROM destinations WHERE email = ?1').bind(String(v).toLowerCase()).first();
      if (!d || d.status !== 'verified') return j(c, { error: 'default_forward_not_verified' }, 422);
    }
    await setConfig(c.env, k, v);
  }
  // 开启 Turnstile 前置校验：必须已配置站点密钥 + 服务端密钥
  if (body.turnstile_enabled === 'true') {
    const cfg = await getConfig(c.env);
    if (!cfg.turnstile_site_key || !cfg.turnstile_secret_key) {
      return j(c, { error: 'turnstile_keys_required' }, 422);
    }
  }
  return j(c, { ok: true });
});

// ---------- 管理员账户设置（修改用户名/密码，改后轮换会话密钥） ----------
app.post('/api/auth/change-admin', async c => {
  const cfg = await getConfig(c.env);
  const { current_password, username, new_password } = await c.req.json().catch(() => ({}));
  if (!(await verifyPassword(current_password || '', cfg.admin_pass || ''))) {
    return j(c, { error: 'bad_credentials' }, 403);
  }
  let uname = cfg.admin_username || 'admin';
  let changed = false;
  if (username && username !== uname) {
    if (String(username).length < 3) return j(c, { error: 'bad_username' }, 400);
    uname = String(username);
    await setConfig(c.env, 'admin_username', uname);
    changed = true;
  }
  if (new_password) {
    if (String(new_password).length < 8) return j(c, { error: 'bad_password' }, 400);
    await setConfig(c.env, 'admin_pass', await hashPassword(String(new_password)));
    changed = true;
  }
  let csrf;
  if (changed) {
    const secret = randomHex(48);
    await setConfig(c.env, 'session_secret', secret);
    csrf = await issueSession(c, uname, secret);
  }
  return j(c, { ok: true, username: uname, changed, ...(csrf ? { csrf } : {}) });
});

// ---------- 转发目标地址（§3.3） ----------
app.get('/api/destinations', async c => {
  // CF API 模式：自动回同步验证状态（用户在 CF 点击确认后面板自动变为已验证，§3.3）
  const cfg = await getConfig(c.env);
  if (cfg.cf_api_token && cfg.cf_account_id) {
    try {
      const cf = cfClient(cfg.cf_api_token);
      const addrs = await listDestinationAddresses(cf, cfg.cf_account_id);
      const verified = new Set(addrs.filter(a => a.verified).map(a => String(a.email).toLowerCase()));
      for (const email of verified) {
        await c.env.DB.prepare(
          "UPDATE destinations SET status = 'verified', verified_at = COALESCE(verified_at, ?1), source = 'api' WHERE email = ?2 AND status != 'verified'",
        ).bind(now(), email).run();
      }
    } catch { /* CF 不可达时不阻塞本地列表 */ }
  }
  const { results } = await c.env.DB.prepare('SELECT id, email, status, source, verified_at, created_at FROM destinations ORDER BY created_at ASC').all();
  return j(c, { items: results });
});

app.post('/api/destinations', async c => {
  const { email } = await c.req.json().catch(() => ({}));
  const addr = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return j(c, { error: 'bad_email' }, 400);
  const exists = await c.env.DB.prepare('SELECT id FROM destinations WHERE email = ?1').bind(addr).first();
  if (exists) return j(c, { error: 'duplicate' }, 409);
  const id = uid('dst');
  await c.env.DB.prepare(
    "INSERT INTO destinations (id, email, status, source, created_at) VALUES (?1, ?2, 'pending', 'manual', ?3)",
  ).bind(id, addr, now()).run();
  return j(c, { ok: true, id }, 201);
});

app.post('/api/destinations/:id/verify', async c => {
  // 手动模式：用户在 CF Dashboard 确认后在面板自申报（开源版无 CF 凭证，§3.3）
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT email FROM destinations WHERE id = ?1').bind(id).first();
  if (!row) return j(c, { error: 'not_found' }, 404);
  await c.env.DB.prepare("UPDATE destinations SET status = 'verified', verified_at = ?1 WHERE id = ?2").bind(now(), id).run();
  const cfg = await getConfig(c.env);
  if (!cfg.default_forward) await setConfig(c.env, 'default_forward', row.email);
  return j(c, { ok: true });
});

app.delete('/api/destinations/:id', async c => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT email FROM destinations WHERE id = ?1').bind(id).first();
  if (!row) return j(c, { error: 'not_found' }, 404);
  const { results } = await c.env.DB.prepare('SELECT destinations_json FROM forwarding_rules').all();
  const used = results.some(r => (safeParseJ(r.destinations_json) || []).includes(row.email));
  if (used) return j(c, { error: 'referenced_by_rule' }, 409);
  await c.env.DB.prepare('DELETE FROM destinations WHERE id = ?1').bind(id).run();
  return j(c, { ok: true });
});

// ---------- 转发规则（§4） ----------
function parseFiltersInput(f) {
  if (!f || typeof f !== 'object') return null;
  const out = {};
  if (Array.isArray(f.from_blacklist)) {
    const arr = f.from_blacklist.map(x => String(x).trim()).filter(Boolean);
    if (arr.some(x => x.length > 100)) return { error: 'regex_too_long' };
    if (arr.length) out.from_blacklist = arr;
  }
  if (f.subject_regex !== undefined && f.subject_regex !== null && String(f.subject_regex) !== '') {
    const re = String(f.subject_regex);
    if (re.length > 100) return { error: 'regex_too_long' };
    if (/(\([^)]*[+*][^)]*\)\s*[+*{])/.test(re)) return { error: 'regex_too_complex' }; // 拒绝嵌套量词（ReDoS）
    try { new RegExp(re); } catch { return { error: 'bad_subject_regex' }; }
    out.subject_regex = re;
  }
  if (f.max_size_mb !== undefined && f.max_size_mb !== null && f.max_size_mb !== '') {
    const n = Number(f.max_size_mb);
    if (!Number.isFinite(n) || n <= 0 || n > 25) return { error: 'bad_max_size' };
    out.max_size_mb = n;
  }
  if (f.has_attachment === true || f.has_attachment === false) out.has_attachment = f.has_attachment;
  if (Array.isArray(f.to_whitelist)) {
    const arr = f.to_whitelist.map(x => String(x).trim()).filter(Boolean);
    if (arr.some(x => x.length > 100)) return { error: 'regex_too_long' };
    if (arr.length) out.to_whitelist = arr;
  }
  return out;
}

async function validateRuleInput(c, body) {
  const pattern = String(body.pattern || '').trim().toLowerCase();
  const pattern_type = body.pattern_type === 'exact' ? 'exact' : 'catchall';
  const action = ['forward', 'block', 'blackhole'].includes(body.action) ? body.action : null;
  if (!pattern) return { error: 'bad_pattern' };
  let norm = pattern;
  if (pattern_type === 'exact') {
    if (pattern.includes('*') || !pattern.includes('@')) return { error: 'bad_pattern' };
  } else {
    norm = pattern.startsWith('*@') ? pattern : '*@' + pattern.replace(/^\*\@/, '');
    if (!/^\*\@[a-z0-9.-]+\.[a-z]{2,}$/.test(norm)) return { error: 'bad_pattern' };
  }
  if (!action) return { error: 'bad_action' };
  let destinations = [];
  if (action === 'forward') {
    destinations = [...new Set((body.destinations || []).map(x => String(x).trim().toLowerCase()).filter(Boolean))];
    if (!destinations.length) return { error: 'no_destinations' };
    const { results } = await c.env.DB.prepare('SELECT email FROM destinations WHERE status = ?1').bind('verified').all();
    const verified = new Set(results.map(r => r.email));
    if (!destinations.every(d => verified.has(d))) return { respond: j(c, { error: 'destinations_unverified' }, 422) };
  }
  const filters = body.filters ? parseFiltersInput(body.filters) : {};
  if (filters && filters.error) return { error: filters.error };
  return { pattern: norm, pattern_type, action, destinations, filters };
}

app.get('/api/rules', async c => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, pattern, pattern_type, action, destinations_json, filters_json, enabled, sort_key, created_at, updated_at
    FROM forwarding_rules
    ORDER BY CASE pattern_type WHEN 'exact' THEN 0 ELSE 1 END, sort_key ASC
  `).all();
  // 按规则统计（对齐 CF 规则表的可见性：每条规则处理了多少邮件）
  const { results: ruleStats } = await c.env.DB.prepare(`
    SELECT rule_id, COUNT(*) AS total,
      SUM(CASE WHEN date(received_at) = date('now') THEN 1 ELSE 0 END) AS today
    FROM emails WHERE rule_id IS NOT NULL GROUP BY rule_id
  `).all();
  const stats = Object.fromEntries(ruleStats.map(x => [x.rule_id, { total: x.total, today: x.today || 0 }]));
  const defRow = await c.env.DB.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN date(received_at) = date('now') THEN 1 ELSE 0 END) AS today
    FROM emails WHERE rule_id IS NULL
  `).first();
  return j(c, {
    items: results.map(r => ({
      ...r,
      destinations: safeParseJ(r.destinations_json, []),
      filters: safeParseJ(r.filters_json, {}),
    })),
    stats,
    defaultStats: { total: defRow.total || 0, today: defRow.today || 0 },
  });
});

app.post('/api/rules', async c => {
  const body = await c.req.json().catch(() => ({}));
  const v = await validateRuleInput(c, body);
  if (v.respond) return v.respond;
  if (v.error) return j(c, { error: v.error }, 422);
  const id = uid('rule');
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_key), 0) AS m FROM forwarding_rules').first();
  await c.env.DB.prepare(`
    INSERT INTO forwarding_rules (id, pattern, pattern_type, action, destinations_json, filters_json, enabled, sort_key, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
  `).bind(id, v.pattern, v.pattern_type, v.action, JSON.stringify(v.destinations), JSON.stringify(v.filters || {}), body.enabled === false ? 0 : 1, (max.m || 0) + 10, now()).run();
  return j(c, { ok: true, id }, 201);
});

app.patch('/api/rules/:id', async c => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM forwarding_rules WHERE id = ?1').bind(id).first();
  if (!row) return j(c, { error: 'not_found' }, 404);
  const body = await c.req.json().catch(() => ({}));

  // 仅排序/启停的轻量更新
  if (body.sort_key !== undefined && body.pattern === undefined) {
    await c.env.DB.prepare('UPDATE forwarding_rules SET sort_key = ?1, updated_at = ?2 WHERE id = ?3').bind(Number(body.sort_key) || 0, now(), id).run();
    return j(c, { ok: true });
  }
  if (body.enabled !== undefined && body.pattern === undefined) {
    await c.env.DB.prepare('UPDATE forwarding_rules SET enabled = ?1, updated_at = ?2 WHERE id = ?3').bind(body.enabled ? 1 : 0, now(), id).run();
    return j(c, { ok: true });
  }

  const merged = {
    pattern: body.pattern ?? row.pattern,
    pattern_type: body.pattern_type ?? row.pattern_type,
    action: body.action ?? row.action,
    destinations: body.destinations ?? safeParseJ(row.destinations_json, []),
    filters: body.filters ?? safeParseJ(row.filters_json, {}),
    enabled: body.enabled ?? !!row.enabled,
  };
  const v = await validateRuleInput(c, merged);
  if (v.respond) return v.respond;
  if (v.error) return j(c, { error: v.error }, 422);
  await c.env.DB.prepare(`
    UPDATE forwarding_rules SET pattern = ?1, pattern_type = ?2, action = ?3, destinations_json = ?4,
      filters_json = ?5, enabled = ?6, updated_at = ?7 WHERE id = ?8
  `).bind(v.pattern, v.pattern_type, v.action, JSON.stringify(v.destinations), JSON.stringify(v.filters || {}), merged.enabled ? 1 : 0, now(), id).run();
  return j(c, { ok: true });
});

app.delete('/api/rules/:id', async c => {
  const r = await c.env.DB.prepare('DELETE FROM forwarding_rules WHERE id = ?1').bind(c.req.param('id')).run();
  if (!r.meta.changes) return j(c, { error: 'not_found' }, 404);
  return j(c, { ok: true });
});

// ---------- 邮件（§6） ----------
app.get('/api/emails', async c => {
  const q = c.req.query();
  const page = Math.max(1, Number(q.page) || 1);
  const size = Math.min(100, Math.max(1, Number(q.size) || 20));
  const where = [];
  const binds = [];
  if (q.domain && q.domain !== 'all') { where.push('domain = ?' + (binds.push(q.domain))); }
  if (q.status && q.status !== 'all') { where.push('status = ?' + (binds.push(q.status))); }
  if (q.q) { binds.push(`%${q.q}%`); const i = binds.length; where.push(`(from_addr LIKE ?${i} OR subject LIKE ?${i} OR body_preview LIKE ?${i})`); }
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM emails ${W}`).bind(...binds).first()).n;
  const { results } = await c.env.DB.prepare(`
    SELECT id, domain, from_addr, from_name, to_addrs_json, subject, body_preview, size_bytes, has_attachments,
           status, is_read, blocked_reason, per_destination_json, received_at
    FROM emails ${W} ORDER BY received_at DESC LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}
  `).bind(...binds, size, (page - 1) * size).all();
  return j(c, {
    items: results.map(r => ({
      ...r,
      has_attachments: !!r.has_attachments,
      per_destination: safeParseJ(r.per_destination_json, []),
    })),
    total, page, size,
  });
});

async function getEmailOr404(c) {
  return await c.env.DB.prepare('SELECT * FROM emails WHERE id = ?1').bind(c.req.param('id')).first() || null;
}

// 未读计数（导航徽章轮询）
app.get('/api/emails/unread-count', async c => {
  const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM emails WHERE is_read = 0").first();
  return j(c, { unread: row.n });
});

app.get('/api/emails/:id', async c => {
  const row = await getEmailOr404(c);
  if (!row) return j(c, { error: 'not_found' }, 404);
  const { results: atts } = await c.env.DB.prepare(
    'SELECT id, filename, content_type, size_bytes FROM attachments WHERE email_id = ?1 ORDER BY id',
  ).bind(row.id).all();
  delete row.user_id;
  return j(c, { ...row, has_attachments: !!row.has_attachments, attachments: atts });
});

app.get('/api/emails/:id/html', async c => {
  const row = await getEmailOr404(c);
  if (!row) return j(c, { error: 'not_found' }, 404);
  if (!row.body_html_r2_key) return j(c, { html: null });
  const obj = await c.env.R2.get(row.body_html_r2_key);
  if (!obj) return j(c, { html: null });
  const raw = await obj.text();
  const { results: atts } = await c.env.DB.prepare('SELECT id, cid FROM attachments WHERE email_id = ?1').bind(row.id).all();
  const cidMap = {};
  for (const a of atts) if (a.cid) cidMap[a.cid] = a.id;
  return j(c, { html: sanitizeHtml(raw, { emailId: row.id, cidMap }) });
});

app.get('/api/emails/:id/raw', async c => {
  const row = await getEmailOr404(c);
  if (!row) return j(c, { error: 'not_found' }, 404);
  if (!row.raw_r2_key) return j(c, { error: 'metadata_only' }, 404);
  const obj = await c.env.R2.get(row.raw_r2_key);
  if (!obj) return j(c, { error: 'not_found' }, 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'message/rfc822',
      'Content-Disposition': `attachment; filename="inboxfly-${row.id}.eml"`,
    },
  });
});

app.get('/api/emails/:id/attachments/:attId', async c => {
  const att = await c.env.DB.prepare('SELECT * FROM attachments WHERE id = ?1 AND email_id = ?2')
    .bind(c.req.param('attId'), c.req.param('id')).first();
  if (!att) return j(c, { error: 'not_found' }, 404);
  const obj = await c.env.R2.get(att.r2_key);
  if (!obj) return j(c, { error: 'not_found' }, 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': att.content_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${att.filename}"`,
    },
  });
});

async function deleteEmailById(env, row) {
  const { results: atts } = await env.DB.prepare('SELECT r2_key FROM attachments WHERE email_id = ?1').bind(row.id).all();
  const keys = [row.raw_r2_key, row.body_html_r2_key, row.body_text_r2_key, ...atts.map(a => a.r2_key)].filter(Boolean);
  for (const k of keys) { try { await env.R2.delete(k); } catch { /* ignore */ } }
  await env.DB.prepare('DELETE FROM attachments WHERE email_id = ?1').bind(row.id).run();
  await env.DB.prepare('DELETE FROM emails WHERE id = ?1').bind(row.id).run();
}

app.delete('/api/emails/:id', async c => {
  const row = await getEmailOr404(c);
  if (!row) return j(c, { error: 'not_found' }, 404);
  await deleteEmailById(c.env, row);
  return j(c, { ok: true });
});

// 标记已读（打开详情时调用）
app.post('/api/emails/:id/read', async c => {
  const r = await c.env.DB.prepare("UPDATE emails SET is_read = 1 WHERE id = ?1 AND is_read = 0")
    .bind(c.req.param('id')).run();
  return j(c, { ok: true, changed: r.meta.changes });
});

// 批量删除（多选操作）
app.post('/api/emails/batch-delete', async c => {
  const { ids } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(ids) || !ids.length) return j(c, { error: 'bad_ids' }, 400);
  let deleted = 0;
  for (const id of ids.slice(0, 200)) {
    const row = await c.env.DB.prepare('SELECT * FROM emails WHERE id = ?1').bind(String(id)).first();
    if (row) { await deleteEmailById(c.env, row); deleted++; }
  }
  return j(c, { ok: true, deleted });
});

// 纯文本正文（无 HTML 部分的邮件直接展示，不必下载 .eml）
app.get('/api/emails/:id/text', async c => {
  const row = await getEmailOr404(c);
  if (!row) return j(c, { error: 'not_found' }, 404);
  if (!row.body_text_r2_key) return j(c, { text: null });
  const obj = await c.env.R2.get(row.body_text_r2_key);
  if (!obj) return j(c, { text: null });
  return j(c, { text: await obj.text() });
});

// ---------- 统计（§7 处理状态口径） ----------
app.get('/api/stats/summary', async c => {
  const totals = (await c.env.DB.prepare(`
    SELECT COALESCE(SUM(forwarded_count),0) f, COALESCE(SUM(blocked_count),0) b, COALESCE(SUM(dropped_count),0) d,
           COALESCE(SUM(rejected_count),0) r, COALESCE(SUM(error_count),0) e, COALESCE(SUM(bytes_total),0) bytes
    FROM forwarding_stats
  `).first());
  const { results: byDomain } = await c.env.DB.prepare(`
    SELECT domain,
      SUM(forwarded_count) forwarded, SUM(blocked_count) blocked, SUM(dropped_count) dropped,
      SUM(rejected_count) rejected, SUM(error_count) error, SUM(bytes_total) bytes
    FROM forwarding_stats GROUP BY domain ORDER BY 2 DESC
  `).all();
  const rules = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM forwarding_rules').first()).n;
  const r2Estimate = (await c.env.DB.prepare(
    "SELECT COALESCE(SUM(bytes_total),0) AS b FROM forwarding_stats WHERE date >= date('now', '-29 days')",
  ).first()).b;
  return j(c, {
    totals: { forwarded: totals.f, blocked: totals.b, dropped: totals.d, rejected: totals.r, error: totals.e, bytes: totals.bytes },
    byDomain, rules,
    r2_estimate_30d: r2Estimate,
    r2_cap: 10 * 1024 * 1024 * 1024,
  });
});

app.get('/api/stats/daily', async c => {
  const days = Math.min(90, Math.max(1, Number(c.req.query('days')) || 14));
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const { results } = await c.env.DB.prepare(`
    SELECT date,
      SUM(forwarded_count) forwarded, SUM(blocked_count) blocked, SUM(dropped_count) dropped,
      SUM(rejected_count) rejected, SUM(error_count) error
    FROM forwarding_stats WHERE date >= ?1 GROUP BY date ORDER BY date ASC
  `).bind(since).all();
  // 补齐空日期
  const map = Object.fromEntries(results.map(r => [r.date, r]));
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    const r = map[date] || {};
    out.push({
      date,
      forwarded: r.forwarded || 0, blocked: r.blocked || 0, dropped: r.dropped || 0,
      rejected: r.rejected || 0, error: r.error || 0,
    });
  }
  return j(c, { items: out });
});

// ---------- 域名（§3.4：注册表 + 规则/邮件推导 + CF API 同步） ----------
const getRegistry = cfg => safeParseJ(cfg.domain_registry, []);
const setRegistry = (env, arr) => setConfig(env, 'domain_registry', JSON.stringify(arr));

app.get('/api/domains', async c => {
  const cfg = await getConfig(c.env);
  const registry = getRegistry(cfg);
  const { results: mailDomains } = await c.env.DB.prepare(
    'SELECT domain, COUNT(*) AS emails, MAX(received_at) AS last_at FROM emails GROUP BY domain',
  ).all();
  const { results: ruleRows } = await c.env.DB.prepare('SELECT pattern, pattern_type FROM forwarding_rules').all();
  const ruleDomains = new Set(ruleRows.map(r => (r.pattern_type === 'catchall' ? r.pattern.replace(/^\*\@/, '') : r.pattern.split('@')[1] || '')));
  const map = new Map();
  for (const e of registry) {
    if (!e.domain) continue;
    map.set(e.domain, { domain: e.domain, emails: 0, last_at: null, has_rule: false, email_routing: !!e.email_routing, source: e.source || 'manual' });
  }
  for (const d of ruleDomains) {
    if (!d) continue;
    const e = map.get(d) || { domain: d, emails: 0, last_at: null, has_rule: false, email_routing: null, source: 'derived' };
    e.has_rule = true;
    map.set(d, e);
  }
  for (const m of mailDomains) {
    const e = map.get(m.domain) || { domain: m.domain, emails: 0, last_at: null, has_rule: false, email_routing: null, source: 'derived' };
    e.emails = m.emails; e.last_at = m.last_at;
    map.set(m.domain, e);
  }
  const items = [...map.values()].sort((a, b) =>
    ((b.email_routing === true) - (a.email_routing === true)) || (b.emails - a.emails) || a.domain.localeCompare(b.domain));
  return j(c, { items, erCount: items.filter(x => x.email_routing === true).length });
});

// 手动登记域名（生产环境推荐用 sync 从 CF 自动同步）
app.post('/api/domains', async c => {
  const { domain, email_routing } = await c.req.json().catch(() => ({}));
  const d = String(domain || '').trim().toLowerCase().replace(/^\*\@/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return j(c, { error: 'bad_domain' }, 400);
  const cfg = await getConfig(c.env);
  const registry = getRegistry(cfg);
  const existing = registry.find(e => e.domain === d);

  // 自动验证：若配置了 CF API Token，查询该域名是否托管在 CF 及其 Email Routing 状态（§3.4）
  let er = email_routing === true;
  let zoneId = null;
  let source = 'manual';
  if (cfg.cf_api_token) {
    try {
      const z = await findZone(cfClient(cfg.cf_api_token), d);
      if (z) {
        zoneId = z.id;
        source = 'cf';
        try {
          const st = await routingStatus(cfClient(cfg.cf_api_token), z.id);
          er = st.enabled === true;
        } catch { er = !!email_routing; }
      }
    } catch { /* 查询失败按手动登记处理 */ }
  }

  if (existing) {
    existing.email_routing = er;
    if (zoneId) existing.zone_id = zoneId;
    if (source === 'cf') existing.source = 'cf';
  } else {
    registry.push({ domain: d, source, email_routing: er, ...(zoneId ? { zone_id: zoneId } : {}) });
  }
  await setRegistry(c.env, registry);
  return j(c, { ok: true, domain: d, hosted_cf: zoneId !== null, email_routing: er });
});

app.delete('/api/domains/:domain', async c => {
  const d = decodeURIComponent(c.req.param('domain')).toLowerCase();
  const cfg = await getConfig(c.env);
  const registry = getRegistry(cfg).filter(e => e.domain !== d);
  await setRegistry(c.env, registry);
  return j(c, { ok: true });
});

// 从 Cloudflare 同步托管域名列表与 Email Routing 状态（需在设置中配置 CF API Token）
app.post('/api/domains/sync', async c => {
  const r = await syncZonesFromCF(c.env);
  if (r === null) return j(c, { error: 'cf_token_missing' }, 400);
  if (r.error) return j(c, { error: r.error, detail: r.detail }, 502);
  return j(c, { ok: true, zones: r.zones, email_routing_on: r.email_routing_on });
});

// 一键开启转发（§3.4.2 六步流程）：MX 冲突确认 → 启用 → DNS → catch-all → Worker
app.post('/api/domains/:domain/enable', async c => {
  const cfg = await getConfig(c.env);
  if (!cfg.cf_api_token) return j(c, { error: 'cf_token_missing' }, 400);
  const domain = decodeURIComponent(c.req.param('domain')).toLowerCase();
  const { confirm } = await c.req.json().catch(() => ({}));
  const cf = cfClient(cfg.cf_api_token);

  const zone = await findZone(cf, domain);
  if (!zone) return j(c, { error: 'zone_not_found' }, 404);
  await setConfig(c.env, 'cf_account_id', zone.account?.id || '');

  // ② MX 冲突检测（CF Email Routing 自身的 MX 除外）——破坏性操作需显式确认
  const mxRows = await listDns(cf, zone.id, 'MX');
  const conflicts = mxRows.filter(r => !/\.mx\.cloudflare\.net\.?$/i.test(r.content)).map(r => `${r.name} → ${r.content}`);
  if (conflicts.length && confirm !== true) {
    return j(c, { error: 'mx_conflicts', conflicts }, 409);
  }

  // ③ 启用 Email Routing + 补齐官方推荐 DNS（MX/SPF TXT）
  const st = await routingStatus(cf, zone.id);
  if (st.enabled !== true) await enableRouting(cf, zone.id);
  const rec = await recommendedDns(cf, zone.id);
  const added = [];
  if (rec) {
    const existingMx = await listDns(cf, zone.id, 'MX');
    for (const m of (rec.mx_records || [])) {
      if (!existingMx.some(x => x.content === m)) {
        await createDns(cf, zone.id, { type: 'MX', name: rec.txt_name || domain, content: m, priority: 10, ttl: 3600 });
        added.push(`MX ${m}`);
      }
    }
    if (rec.txt_value) {
      const txts = await listDns(cf, zone.id, 'TXT');
      const zoneTxts = await cf.get(`/zones/${zone.id}/dns_records?type=TXT&per_page=100`);
      const allTxt = (txts.length ? txts : (zoneTxts.result || []));
      if (!allTxt.some(x => (x.content || '').includes('spf'))) {
        await createDns(cf, zone.id, { type: 'TXT', name: rec.txt_name || domain, content: rec.txt_value, ttl: 3600 });
        added.push('TXT SPF');
      }
    }
  }

  // ④ catch-all → InboxFly Worker
  const worker = c.env.APP_WORKER_NAME || 'inboxfly';
  const ca = await setCatchAllWorker(cf, zone.id, worker);
  if (!ca.success) return j(c, { error: 'cf_api_error', detail: cfErr(ca) }, 502);

  // 更新注册表
  const registry = getRegistry(cfg);
  const e = registry.find(x => x.domain === domain);
  if (e) { e.email_routing = true; e.zone_id = zone.id; e.source = e.source || 'cf'; }
  else registry.push({ domain, source: 'cf', email_routing: true, zone_id: zone.id });
  await setRegistry(c.env, registry);

  return j(c, { ok: true, domain, worker, replaced_mx: conflicts.length, dns_added: added });
});

// 原生规则检测（§3.4.4 防绕过必查）
app.get('/api/domains/:domain/native-rules', async c => {
  const cfg = await getConfig(c.env);
  if (!cfg.cf_api_token) return j(c, { error: 'cf_token_missing' }, 400);
  const domain = decodeURIComponent(c.req.param('domain')).toLowerCase();
  const cf = cfClient(cfg.cf_api_token);
  const zone = await findZone(cf, domain);
  if (!zone) return j(c, { error: 'zone_not_found' }, 404);
  const rules = await listNativeRules(cf, zone.id);
  return j(c, {
    items: rules.map(r => ({
      id: r.id, name: r.name || '', enabled: r.enabled !== false,
      matchers: r.matchers || [], actions: r.actions || [],
    })),
  });
});

// 原生规则一键导入为 InboxFly 规则（forward/drop 可导入；tag/worker 跳过）
app.post('/api/domains/:domain/native-rules/import', async c => {
  const cfg = await getConfig(c.env);
  if (!cfg.cf_api_token) return j(c, { error: 'cf_token_missing' }, 400);
  const domain = decodeURIComponent(c.req.param('domain')).toLowerCase();
  const { disable_native } = await c.req.json().catch(() => ({}));
  const cf = cfClient(cfg.cf_api_token);
  const zone = await findZone(cf, domain);
  if (!zone) return j(c, { error: 'zone_not_found' }, 404);
  const rules = await listNativeRules(cf, zone.id);

  let imported = 0, skipped = 0, disabled = 0;
  const createdDests = new Set();
  for (const r of rules) {
    const acts = r.actions || [];
    if (!acts.length || acts.some(a => a.type === 'tag' || a.type === 'worker')) { skipped++; continue; }
    const matchers = r.matchers || [];
    const literals = matchers.filter(m => m.type === 'literal').map(m => String(m.value).toLowerCase());
    const isAll = matchers.some(m => m.type === 'all');
    const forwardDests = acts.filter(a => a.type === 'forward').flatMap(a => a.value || []);
    for (const d of forwardDests) {
      if (!createdDests.has(d)) {
        await c.env.DB.prepare(
          "INSERT INTO destinations (id, email, status, source, verified_at, created_at) VALUES (?1, ?2, 'verified', 'api', ?3, ?3) ON CONFLICT(email) DO NOTHING",
        ).bind(uid('dst'), d.toLowerCase(), now()).run();
        createdDests.add(d);
      }
    }
    const sortKey = Date.now() + imported * 10;
    const mk = async (pattern, patternType) => {
      await c.env.DB.prepare(`
        INSERT INTO forwarding_rules (id, pattern, pattern_type, action, destinations_json, filters_json, enabled, sort_key, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
      `).bind(
        uid('rule'), pattern, patternType,
        forwardDests.length ? 'forward' : 'blackhole',
        JSON.stringify(forwardDests), '{}',
        r.enabled === false ? 0 : 1, sortKey, now(),
      ).run();
      imported++;
    };
    if (isAll) await mk(`*@${domain}`, 'catchall');
    else if (literals.length) for (const l of literals) await mk(l, 'exact');
    else skipped++;
    if (disable_native === true) {
      try { await deleteNativeRule(cf, zone.id, r.id); disabled++; } catch { /* 保留失败不阻塞 */ }
    }
  }
  return j(c, { ok: true, imported, skipped, disabled });
});

// 目标地址：CF API 模式（添加 + 验证状态自动回同步，§3.3）
app.get('/api/destinations/cf', async c => {
  const cfg = await getConfig(c.env);
  if (!cfg.cf_api_token) return j(c, { error: 'cf_token_missing' }, 400);
  if (!cfg.cf_account_id) return j(c, { error: 'cf_account_missing' }, 400);
  const cf = cfClient(cfg.cf_api_token);
  const addrs = await listDestinationAddresses(cf, cfg.cf_account_id);
  return j(c, { items: addrs.map(a => ({ email: String(a.email).toLowerCase(), verified: !!a.verified, created: a.created || null })) });
});

app.post('/api/destinations/cf', async c => {
  const cfg = await getConfig(c.env);
  if (!cfg.cf_api_token) return j(c, { error: 'cf_token_missing' }, 400);
  if (!cfg.cf_account_id) return j(c, { error: 'cf_account_missing' }, 400);
  const { email } = await c.req.json().catch(() => ({}));
  const addr = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return j(c, { error: 'bad_email' }, 400);
  const cf = cfClient(cfg.cf_api_token);
  const cfAddr = await createDestinationAddress(cf, cfg.cf_account_id, addr); // CF 向该地址发送确认邮件
  const exists = await c.env.DB.prepare('SELECT id FROM destinations WHERE email = ?1').bind(addr).first();
  if (!exists) {
    await c.env.DB.prepare(
      "INSERT INTO destinations (id, email, status, source, created_at) VALUES (?1, ?2, 'pending', 'api', ?3)",
    ).bind(uid('dst'), addr, now()).run();
  }
  return j(c, { ok: true, id: cfAddr?.id || null });
});

// 手动触发 R2 过期清理（Cron 之外的测试/运维入口）
app.post('/api/dev/cleanup', async c => {
  const { days } = await c.req.json().catch(() => ({}));
  const deleted = await cleanupExpired(c.env, days === undefined ? undefined : Number(days));
  return j(c, { ok: true, deleted });
});

// 邮件处理管道注入测试：构造伪 message 对象直接调用 Email Worker 处理链路
// （用于在无法接收真实邮件的环境验证 parse → match → decide → store 全程）
app.post('/api/dev/email-test', async c => {
  const { raw } = await c.req.json().catch(() => ({}));
  const eml = raw || [
    'From: Inject Test <inject@test.local>',
    'To: <you@inboxfly.email>',
    'Subject: [InBoxFly] pipeline inject test',
    'Date: ' + new Date().toUTCString(),
    'Message-ID: <inject-' + Date.now() + '@test.local>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'This message was injected via /api/dev/email-test.',
    '',
  ].join('\r\n');
  const buf = new TextEncoder().encode(eml);
  const events = [];
  const fakeMessage = {
    raw: new Response(buf).body,
    rawSize: buf.byteLength,
    to: 'you@inboxfly.email',
    from: 'inject@test.local',
    forward: async addr => { events.push({ op: 'forward', to: addr, ok: true }); },
    setReject: reason => { events.push({ op: 'reject', reason }); },
  };
  await handleEmail(fakeMessage, c.env);
  return j(c, { ok: true, events });
});

// ---------- 本地开发工具（生产环境无副作用，可保留） ----------
app.post('/api/dev/simulate', async c => {
  const { count } = await c.req.json().catch(() => ({}));
  const created = await simGenerate(c.env, Math.min(50, Math.max(1, Number(count) || 5)));
  return j(c, { ok: true, created: created.length, subjects: created });
});

app.post('/api/dev/reset', async c => {
  await resetData(c.env);
  return j(c, { ok: true });
});

app.onError((err, c) => {
  console.error('[inboxfly] error:', err);
  if (c.req.path.startsWith('/api/')) {
    // 仅 CF API 类错误带 detail 透出；内部异常一律脱敏
    const status = err.detail ? 502 : 500;
    const body = err.detail ? { error: 'cf_api_error', detail: err.detail } : { error: 'internal_error' };
    return j(c, body, status);
  }
  return c.text('Internal Server Error', 500);
});

app.notFound(c => c.req.path.startsWith('/api/') ? j(c, { error: 'not_found' }, 404) : c.notFound());

function safeParseJ(s, dflt) {
  try { const v = JSON.parse(s); return v ?? dflt; } catch { return dflt; }
}

export default {
  fetch: app.fetch,
  email: handleEmail,
  // Cron Trigger：每日清理超过保留期的 R2 对象（§8/§11）+ 定时同步 CF 域名（§3.4.1）
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.allSettled([
      cleanupExpired(env).catch(e => console.error('[inboxfly] cleanup failed:', e)),
      syncZonesFromCF(env).then(r => {
        if (r && r.error) console.error('[inboxfly] zone sync failed:', r.error, r.detail || '');
      }).catch(e => console.error('[inboxfly] zone sync error:', e)),
    ]));
  },
};

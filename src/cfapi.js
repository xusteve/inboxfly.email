// Cloudflare API 客户端（§3.4 自动模式：开启 Email Routing / 目标地址 / 原生规则迁移）
export function cfClient(token) {
  const base = 'https://api.cloudflare.com/client/v4';
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    return res.json();
  };
  return {
    get: p => call('GET', p),
    post: (p, b) => call('POST', p, b),
    put: (p, b) => call('PUT', p, b),
    del: p => call('DELETE', p),
  };
}

export const cfErr = data => (data.errors || []).map(e => e.message).join('; ') || 'unknown';

// 按域名查 zone（返回 id / account.id / name）
export async function findZone(cf, domain) {
  const r = await cf.get(`/zones?name=${encodeURIComponent(domain)}&per_page=5`);
  if (!r.success) throw Object.assign(new Error('cf_api_error'), { detail: cfErr(r) });
  return r.result?.[0] || null;
}

// Email Routing 状态
export async function routingStatus(cf, zoneId) {
  const r = await cf.get(`/zones/${zoneId}/email/routing`);
  if (!r.success) throw Object.assign(new Error('cf_api_error'), { detail: cfErr(r) });
  return r.result || {};
}

// 启用 Email Routing
export async function enableRouting(cf, zoneId) {
  const r = await cf.post(`/zones/${zoneId}/email/routing/enable`);
  if (!r.success) throw Object.assign(new Error('cf_api_error'), { detail: cfErr(r) });
  return r.result;
}

// 官方推荐 DNS 记录（MX / TXT SPF）
export async function recommendedDns(cf, zoneId) {
  const r = await cf.get(`/zones/${zoneId}/email/routing/dns`);
  if (!r.success) return null;
  return r.result || null;
}

export async function listDns(cf, zoneId, type) {
  const r = await cf.get(`/zones/${zoneId}/dns_records?type=${type}&per_page=100`);
  return r.success ? (r.result || []) : [];
}

export async function createDns(cf, zoneId, rec) {
  return cf.post(`/zones/${zoneId}/dns_records`, rec);
}

// catch-all → Worker
export async function setCatchAllWorker(cf, zoneId, workerName) {
  return cf.put(`/zones/${zoneId}/email/routing/rules/catch_all`, {
    matchers: [{ type: 'all' }],
    actions: [{ type: 'worker', value: [workerName] }],
    enabled: true,
  });
}

// 原生自定义规则（不含 catch-all）
export async function listNativeRules(cf, zoneId) {
  const r = await cf.get(`/zones/${zoneId}/email/routing/rules`);
  if (!r.success) throw Object.assign(new Error('cf_api_error'), { detail: cfErr(r) });
  return r.result || [];
}

export async function deleteNativeRule(cf, zoneId, ruleId) {
  return cf.del(`/zones/${zoneId}/email/routing/rules/${ruleId}`);
}

// 目标地址（账号级）
export async function listDestinationAddresses(cf, accountId) {
  const r = await cf.get(`/accounts/${accountId}/email/routing/addresses?per_page=100`);
  if (!r.success) throw Object.assign(new Error('cf_api_error'), { detail: cfErr(r) });
  return r.result || [];
}

export async function createDestinationAddress(cf, accountId, email) {
  const r = await cf.post(`/accounts/${accountId}/email/routing/addresses`, { email });
  if (!r.success) throw Object.assign(new Error('cf_api_error'), { detail: cfErr(r) });
  return r.result;
}

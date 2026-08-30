// Email Worker：生产环境真实收信入口（Email Routing catch-all → 本 Worker）
// 管道顺序与失败降级见 InboxFly-Open.md §2.3 / §2.4 / §5：
//   转发优先且与存储互相独立 · 解析/匹配失败 fail-open · 未捕获异常绝不静默丢弃
import PostalMime from 'postal-mime';
import { ensureSchema, getConfig, listEnabledRules, decideStatus, storeParsedEmail, recordStats } from './pipeline.js';

export async function handleEmail(message, env) {
  console.log('[inboxfly] email event received');
  let cfg = null;
  const failOpen = async reason => {
    // §2.4 兜底：优先按默认地址转发，否则临时拒绝（451，发件方 SMTP 重试），绝不静默丢弃
    try {
      cfg = cfg || await getConfig(env);
      if (cfg.default_forward && typeof message.forward === 'function') {
        await message.forward(cfg.default_forward);
        console.error(`[inboxfly] fail-open forwarded (${reason})`);
      } else if (typeof message.setReject === 'function') {
        message.setReject('451 temporary local error, please retry');
      }
    } catch (e) {
      try { if (typeof message.setReject === 'function') message.setReject('451 temporary error'); } catch { /* ignore */ }
    }
  };

  try {
    await ensureSchema(env);
    cfg = await getConfig(env);

    const rawBuf = await new Response(message.raw).arrayBuffer();
    let parsed = null;
    try {
      parsed = await PostalMime.parse(rawBuf);
    } catch { parsed = null; }
    if (!parsed) return failOpen('parse_error');

    const to = (parsed.to && parsed.to[0] && parsed.to[0].address) || message.to || '';
    const from = (parsed.from && parsed.from.address) || '';

    let rules = null;
    try {
      rules = await listEnabledRules(env.DB);
    } catch { rules = null; }
    if (!rules) return failOpen('rules_unavailable');

    const ctx = {
      to, from, subject: parsed.subject || '', domain: to.split('@')[1] || '',
      toAddrs: (parsed.to || []).map(a => a.address).filter(Boolean),
      sizeBytes: rawBuf.byteLength, hasAtt: !!(parsed.attachments && parsed.attachments.length),
    };

    const dec = decideStatus(rules, cfg, ctx);
    let status = dec.status;
    const perDest = [];

    if (dec.behavior === 'reject' && typeof message.setReject === 'function') {
      message.setReject('Blocked by InboxFly: ' + (dec.blockedReason || 'policy'));
    }
    if (dec.dests.length) {
      // 转发在邮件事件内同步完成（§5.1），逐目标 try/catch
      for (const d of dec.dests) {
        try {
          await message.forward(d);
          perDest.push({ to: d, ok: true });
        } catch (e) {
          perDest.push({ to: d, ok: false, error: String(e && e.message || e) });
        }
      }
      if (!perDest.some(p => p.ok)) {
        status = 'error';
        return failOpen('all_forwards_failed');
      }
    }

    // 存储：与转发互相独立；被拦截邮件默认仅存元数据（§4.3）
    const metaOnly = status === 'blocked' && cfg.store_blocked_mail !== 'true';
    await storeParsedEmail(env, parsed, ctx, {
      status, ruleId: dec.ruleId, blockedReason: dec.blockedReason, perDest, rawBuf,
    });
    await recordStats(env.DB, ctx.domain, status, ctx.sizeBytes);
    console.log(`[inboxfly] processed: ${status} from=${ctx.from} to=${ctx.to} rule=${dec.ruleId || 'default'}`);
  } catch (e) {
    console.error('[inboxfly] unhandled email error:', e);
    return failOpen('unhandled_exception');
  }
}

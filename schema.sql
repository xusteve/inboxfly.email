-- InboxFly D1 Schema（InboxFly-Open.md §8）
-- 单用户部署：emails.user_id 恒为 'local'，与 Cloud 多租户 schema 同构

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 转发目标地址（一等资源，验证状态入库）
CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | verified | failed
  source TEXT NOT NULL DEFAULT 'manual',    -- manual | api
  verified_at TEXT,
  created_at TEXT NOT NULL
);

-- 转发规则
CREATE TABLE IF NOT EXISTS forwarding_rules (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL,               -- exact | catchall
  action TEXT NOT NULL,                     -- forward | block | blackhole
  destinations_json TEXT NOT NULL DEFAULT '[]',
  filters_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_key INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rules_eval ON forwarding_rules (pattern_type, sort_key);

-- 邮件元数据（含线程字段）
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local',
  rule_id TEXT,
  domain TEXT NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  references_json TEXT,
  from_addr TEXT,
  from_name TEXT,
  to_addrs_json TEXT,
  subject TEXT,
  body_preview TEXT,
  raw_r2_key TEXT,
  body_html_r2_key TEXT,
  body_text_r2_key TEXT,
  size_bytes INTEGER DEFAULT 0,
  has_attachments INTEGER DEFAULT 0,
  status TEXT NOT NULL,                     -- forwarded | blocked | dropped | rejected | error
  is_read INTEGER NOT NULL DEFAULT 0,        -- 未读徽章（v0.6）
  blocked_reason TEXT,
  per_destination_json TEXT,
  received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emails_time ON emails (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_domain_time ON emails (domain, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_status_time ON emails (status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_msgid ON emails (message_id);

-- 附件
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  r2_key TEXT NOT NULL,
  cid TEXT
);
CREATE INDEX IF NOT EXISTS idx_att_email ON attachments (email_id);

-- 处理统计（处理状态口径）
CREATE TABLE IF NOT EXISTS forwarding_stats (
  date TEXT NOT NULL,
  domain TEXT NOT NULL,
  forwarded_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  dropped_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  bytes_total INTEGER DEFAULT 0,
  PRIMARY KEY (date, domain)
);

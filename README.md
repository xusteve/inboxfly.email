# InboxFly 开源版

> 开源的 Cloudflare 邮件转发统一管理工具（自部署版）——规则管理 · 邮件查看（HTML + 附件）· 高级筛选 · 转发统计
>
> 设计文档：`../InboxFly-Open.md`（v1.2）· 问题清单：`../inboxfly-design-issues.md`

## 一键部署（开源发布后可用）

在 GitHub 仓库就绪后，将下方按钮中的仓库地址替换为实际地址即可放进 README：

```md
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/<org>/inboxfly)
```

部署后仍需（见下文「部署到 Cloudflare」）：`SETUP_TOKEN` Secret、每个域名的 Email Routing 激活与目标地址验证（或使用面板内 CF API Token 自动化，见 v0.3）。

> ⚠️ **CF API Token 权限提示（实测踩坑）**：Email Routing 的「启用/状态查询」API 端点要求的权限组是 **区域 → 区域设置（Zone Settings）→ 编辑**，而不是「电子邮件路由规则」——后者只覆盖规则列表管理。创建 Token 时两者都要勾，缺一则面板「一键开启转发」报 `Authentication error`。

## 本地开发 / 测试（3 分钟）

```bash
cd inboxfly
npm install
npm run dev          # 启动 wrangler dev（本地 D1/R2/KV 模拟）
```

打开 **http://localhost:8787**，按首次运行向导走完 5 步：

1. **SETUP_TOKEN**：本地开发环境为 `inboxfly-local-setup`（定义在 `.dev.vars`，可自行修改）
2. **创建管理员凭证**：设置用户名 + ≥8 位密码
3. **激活 Email Routing**：本地无法接收真实邮件，直接跳过
4. **添加转发目标地址**：填一个邮箱 → 点「我已在 CF 确认」标记为已验证
5. **创建首条规则**：默认模板 `*@<域名> → forward → 已验证目标`

进入面板后点 **「模拟收信」**：会用与生产完全相同的规则管道（匹配 → 筛选 → 决策 → R2/D1 存储 → 统计）注入 5 封测试邮件，仅跳过真实投递（本地没有 Email Routing）。然后即可测试邮件列表 / 详情 / HTML 沙箱渲染 / 附件下载 / 统计 / 规则增删改排序 / 目标地址管理 / 设置项 / 三主题切换（默认液态玻璃）。

> 重置数据：设置 → 清空邮件数据（规则与配置保留）。

## 部署到 Cloudflare（生产）

```bash
npx wrangler login
npx wrangler deploy
```

部署后一次性手工配置（自动化的 Deploy-to-Cloudflare 按钮与 Email Routing API 自动配置在路线图中）：

1. **设置 SETUP_TOKEN**：`npx wrangler secret put SETUP_TOKEN`（首次运行向导要用，设置完成后即作废）
2. **建 D1 表**：`npx wrangler d1 execute inboxfly --remote --file schema.sql`（首访也会自动建表，此步为保险）
3. **绑定邮箱域名**：对每个域名：Dashboard → Email → Email Routing → 启用（确认 MX 切换）→ Catch-all → Send to a Worker → 选 `inboxfly`
4. **验证转发目标地址**：Dashboard → Email Routing → Destination addresses → 添加并点击确认邮件（`forward()` 只能投递到已验证地址）
5. 打开 Worker URL → 向导 → 使用

## 架构（与设计文档对应）

| 模块 | 位置 | 说明 |
|---|---|---|
| Email Worker | `src/email.js` | 真实收信管道：解析 → 规则匹配 → 筛选 → 转发（事件内同步）→ 存储（独立不阻断）→ 统计；fail-open 兜底，绝不静默丢信 |
| 管道核心 | `src/pipeline.js` | 规则引擎（exact > catchall、先匹配先停）、筛选器（黑名单/正则/大小/白名单/附件）、R2 键布局、统计 upsert、本地模拟 |
| 管理 API | `src/index.js` | Hono：向导 / 会话（PBKDF2 + HMAC cookie + CSRF + KV 登录限流）/ 目标地址 / 规则 / 邮件 / 统计 / 配置 |
| HTML 消毒 | `src/sanitize.js` | 服务端消毒（危险标签/事件属性/javascript: 剥离、远程图片默认不加载、cid 重写）；渲染端另有 iframe sandbox + CSP 双保险 |
| 管理面板 | `public/` | 无构建 SPA：三主题令牌化（默认液态玻璃，§9.4）、五步向导（每步原因+风险）、邮件/规则/目标地址/统计/设置 |

## v0.5 增量功能

- **规则页对齐 CF 邮件路由页**（实测 dash.cloudflare.com 邮件路由页后重构）：概览摘要卡（Email Routing 状态 / DNS / 目标地址 / 规则数 / 今日处理）· 统一路由规则表（自定义规则在上、**📌 全收（Catch-all）兜底行固定表尾**，兜底动作/兜底地址/拦截处理从设置页移入此处编辑）· 操作芯片命名对齐 CF（Forward / Drop；「退信」标注为 InboxFly 增强）· 每条规则内联「累计/今日」处理量
- **创建/编辑规则弹窗对齐 CF 原生表单**：「电子邮件匹配模式 = 名称 @ 域名下拉」（留空 = 整个域名）· 操作下拉使用 CF 原文选项与说明（发送到电子邮件 / 丢弃 / 退信-增强）· 高级筛选（黑名单/正则/大小/附件）折叠为 InboxFly 增强区
- **目标地址添加流对齐 CF 默认操作**：单一「添加」入口——配置 CF 凭据后自动发送确认邮件，收件人点击链接后状态自动变为已验证；未配置凭据时回落到 Dashboard 手动路径指引。移除「CF API 模式」等内部术语
- 已知行为：Service Worker 对静态资源是 stale-while-revalidate——部署新版本后**刷新两次**即可拿到最新面板

## v0.3 增量功能

- **R2 30 天自动清理**：Cron Trigger（每日 03:00 UTC）按对象上传时间删除超过保留期的副本/附件；保留天数可在设置中调整（默认 30），设置页提供手动「清理过期对象」入口（`POST /api/dev/cleanup`）
- **配额预警**：邮件页在 R2 估算用量（近 30 天累计）超过 9GB 时显示横幅，一键切换「仅元数据」模式
- **§3.4 写路径（CF API 自动化）**：配置 CF API Token 后——
  - 域名列表一键「开启转发」：MX 冲突检测与显式确认 → 启用 Email Routing → 自动补齐官方推荐 MX/SPF DNS → catch-all 指向 InboxFly Worker
  - 目标地址：通过 CF API 添加（CF 发确认邮件），收件人点击后面板**自动变为已验证**（状态回同步）
  - 原生规则：检测 + 一键导入为 InboxFly 规则并删除原生规则（防邮件绕过，§3.4.4）
- **其他**：纯文本正文直显（不再强制下载 .eml）、邮件批量多选删除、发送日志估算口径修正

## v0.2 增量功能

- **侧栏域名列表**：显示 Cloudflare 托管域名，Email Routing 已启用的域名带绿点标记（侧栏分区头部有 `ER ×n` 汇总徽章），点击域名直接过滤邮件页
- **域名数据源**：规则/邮件推导 + 手动登记（`POST /api/domains`）+ **CF API 一键同步**（设置中配置 CF API Token 后，`POST /api/domains/sync` 拉取全部 zone 及其 Email Routing 状态，§3.4 自动模式）
- **侧栏折叠**：一键折叠为 64px 图标栏（记忆状态）；**页眉布局**：设置 → 布局 可把导航切到顶部页眉（含域名快速筛选下拉）
- **管理员设置**：设置 → 管理员账户，验证当前密码后修改用户名/密码（修改后轮换会话密钥，全端重新登录）
- **多语言**：10 种语言 —— 简体中文 / 繁體中文 / English / 日本語 / 한국어 / Deutsch / Français / Italiano / Русский / Tiếng Việt；跟随浏览器语言初始化，侧栏底部与设置页均可切换（`if-lang` 持久化），语言包独立于 `public/i18n.js` 便于社区贡献新翻译
- **深浅色模式**：三主题 × 浅色/深色/跟随系统，月亮/太阳一键切换（`if-mode` 持久化，无闪烁初始化）
- **PWA**：manifest + Service Worker（静态外壳缓存，`/api/*` 永不缓存）+ 192/512 PNG 图标 + 移动端抽屉导航（≤900px 汉堡菜单）
- **登录页重构 + Cloudflare Turnstile 机器人防护**：登录页对标 astermail（居中窄栏、大 logo、密码可见切换、保持登录 30 天），后台可在「设置 → 机器人防护」开启 Turnstile（服务端 siteverify 校验，密钥仅存用户自己的 D1；本地调试可用官方测试密钥，见设置页提示）
- **品牌**：采用 MailBoxFly 信封+飞机 logo（`public/icons/logo*.png`，favicon / PWA / 全部品牌位）
| D1 Schema | `schema.sql` + `src/schema.js` | 首次访问自动建表，无需手工步骤 |

## 实现说明与已知边界

- **本地测试**：Email Routing 仅存在于 Cloudflare 生产环境，本地用 `/api/dev/simulate` 走同一管道注入数据（UI 中「模拟收信」按钮）。
- **目标地址验证**：CF 的确认邮件无法代点，任何部署方式都需要收件人手动点击一次；面板内「我已在 CF 确认」为开源版手动模式的自申报（§3.3）。
- **统计口径**：`已转发` = Cloudflare 受理转发；最终投递结果（含对方垃圾箱）对系统不可观测（§7.1）。
- **KV 规则缓存**：MVP 直读 D1（拦截类规则的正确性优先，D1 免费额度足够）；热点缓存按规格预留后续优化。
- **Session secret** 存于 D1 `app_config`（部署期 Secret 无法运行时生成）；生产可后续迁移至 Secrets + 轮换。
- **生产待接入**（设计已定、代码未含）：CF API Token 代管自动激活 Email Routing / 域名自动发现（§3.4）、原生规则一键迁移、Deploy to Cloudflare 按钮一键部署、暗色主题令牌集。

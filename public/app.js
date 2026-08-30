// InboxFly 管理面板 SPA v0.2（hash 路由 · i18n · 三主题 · 双布局 · PWA）
// 依照 InboxFly-Open.md §3.2 / §3.4 / §4 / §6 / §7 / §9
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let CFG = null;

// =====================================================================
// 多语言（zh-CN 默认 / English）
// =====================================================================
const STR = {
  zh: {
    'nav.mail': '邮件', 'nav.rules': '规则', 'nav.dest': '目标地址', 'nav.domains': '域名',
    'nav.stats': '统计', 'nav.settings': '设置',
    'title.mail': '邮件', 'title.rules': '转发规则', 'title.dest': '转发目标地址',
    'title.stats': '转发统计', 'title.settings': '设置',
    'cf.connected': 'Cloudflare 已连接',
    'theme.label': '主题', 'theme.glass': '液态玻璃', 'theme.min': '极简克制', 'theme.play': '明快活力',
    'lang.label': '语言', 'layout.label': '布局', 'layout.sidebar': '侧边栏', 'layout.top': '页眉',
    'mode.label': '深浅色', 'mode.light': '浅色', 'mode.dark': '深色', 'mode.auto': '跟随系统', 'mode.toggle': '切换深浅色',
    'st.forwarded': '已转发', 'st.blocked': '已拦截', 'st.dropped': '已丢弃', 'st.rejected': '退信', 'st.error': '异常',
    'common.save': '保存', 'common.cancel': '取消', 'common.delete': '删除', 'common.edit': '编辑',
    'common.add': '添加', 'common.loading': '加载中…', 'common.logout': '退出登录',
    'login.title': 'InboxFly', 'login.sub': '登录管理面板', 'login.user': '用户名', 'login.pass': '密码', 'login.go': '登录',
    'err.bad_credentials': '用户名或密码不正确', 'err.rate_limited': '尝试过于频繁，请稍后再试',
    'wiz.welcome': '欢迎使用 InboxFly', 'wiz.sub': '开源 Cloudflare 邮件转发统一管理 · 首次运行向导',
    'wiz.step': '步骤', 'wiz.s1': '验证部署者身份', 'wiz.s2': '创建管理员凭证', 'wiz.s3': '激活 Email Routing',
    'wiz.s4': '添加转发目标地址', 'wiz.s5': '创建首条规则',
    'wiz.token': 'SETUP_TOKEN', 'wiz.tokenHint': '本地开发环境见 inboxfly/.dev.vars（默认 inboxfly-local-setup）',
    'wiz.tokenPh': '部署时生成的初始化令牌', 'wiz.verifyNext': '验证并继续', 'wiz.user': '管理员用户名',
    'wiz.pass': '管理员密码（≥8 位）', 'wiz.createCred': '创建凭证', 'wiz.back': '上一步',
    'wiz.why': '为什么需要这一步', 'wiz.risk': '风险与后果',
    'wiz.why1': '证明「你是部署者本人」，防止他人拿到面板网址后抢先接管面板。',
    'wiz.risk1': 'Token 只在部署输出（或 .dev.vars）中出现，设置完成后即作废。',
    'wiz.why2': '面板能查看你的全部邮件副本，必须使用强凭证保护。',
    'wiz.risk2': '密码只存哈希不可找回；请牢记或使用密码管理器。',
    'wiz.why3': '邮件必须经 Cloudflare Email Routing（MX → catch-all → Worker）才能进入转发链路。',
    'wiz.risk3': '若域名已在用其他邮箱服务，切换 MX 会使原服务停止收信——请逐条确认。',
    'wiz.why4': 'CF 要求转发目标必须本人验证，防止被配置转发到陌生邮箱。目标地址为账号级资源，验证一次全域名通用。',
    'wiz.risk4': '确认邮件可能进垃圾箱；未验证的地址不能用于转发规则。',
    'wiz.why5': '创建一条立即可用的默认转发规则，并将首个已验证地址设为 fail-open 兜底地址。',
    'wiz.risk5': '规则随时可改可停；先匹配先停，精确地址优先于域名通配。',
    'wiz.prodPath': '在生产环境的操作路径：',
    'wiz.prodSteps': 'Cloudflare Dashboard → 你的域名 → Email → Email Routing → 启用 → Catch-all address → 动作选「Send to a Worker」→ 选择 InboxFly Worker。若存在冲突 MX 记录（域名正在用其他邮箱服务），请逐条确认后替换。',
    'wiz.localSkip': '本地开发环境：本地无法接收真实邮件，此步可跳过；稍后可用「设置 → 模拟收信」注入测试邮件验证完整链路。',
    'wiz.skipLocal': '跳过（本地）', 'wiz.doneProd': '我已完成配置',
    'wiz.destPh': '转发目标邮箱，如 me@gmail.com', 'wiz.markVerified': '我已在 CF 确认', 'wiz.pending': '待验证', 'wiz.verified': '已验证',
    'wiz.needVerified': '继续（需至少 1 个已验证）', 'wiz.destFlow': '流程：添加 → CF 会向该地址发确认邮件（生产环境）→ 收件人点击确认 → 回到这里点「已验证」',
    'wiz.rulePattern': '匹配模式（catchall）', 'wiz.ruleAction': '动作', 'wiz.ruleTo': '转发到（已验证目标）',
    'wiz.finish': '完成并进入面板', 'wiz.done': '初始化完成',
    'mail.search': '搜索发件人 / 主题 / 正文…', 'mail.sim': '模拟收信', 'mail.allDomains': '全部域名',
    'mail.allStatus': '全部状态', 'mail.empty': '暂无邮件', 'mail.emptyHint': '本地开发环境可点击上方「模拟收信」生成测试数据，生产环境等待第一封来信即可。',
    'mail.pick': '选择一封邮件查看详情', 'mail.more': '加载更多', 'mail.raw': '原始 MIME (.eml)',
    'mail.bodySandbox': '邮件正文（iframe 沙箱渲染 · 远程图片默认不加载）', 'mail.noHtml': '(空正文)',
    'mail.textOnly': '该邮件仅存纯文本正文，请查看原始 MIME（.eml）',
    'mail.metaOnly': '该邮件为拦截状态，仅存元数据（可在设置中开启「存储被拦截邮件正文」）',
    'mail.deleted': '已删除', 'mail.deleteConfirm': '删除这封邮件（含存储副本与附件）？',
    'mail.simDone': '已生成 {n} 封测试邮件', 'mail.layoutToggle': '切换侧边栏 / 页眉模式',
    'domains.autoVerify': '已配置 CF 凭据：提交后将自动查询该域名的托管与 Email Routing 状态。', 'domains.manualHint': '未配置 CF 凭据：登记后需自行在 Cloudflare 启用 Email Routing（可在设置中配置凭据以启用自动验证）。', 'set.pwaInstall': '安装到本机（PWA）', 'set.pwaHint': '将面板作为独立应用安装到桌面或主屏幕；若按钮未出现，请使用浏览器菜单中的「安装/添加到主屏幕」。',
    'mail.unread': '未读', 'mail.refresh': '刷新', 'mail.refreshed': '已刷新',
    'mail.defaultFwd': '默认转发',
    'rules.evalOrder': '评估顺序：精确地址 → 域名通配，组内按排序，先匹配先停',
    'rules.exactGroup': '精确地址规则', 'rules.catchGroup': '域名通配规则', 'rules.none': '暂无', 'rules.new': '新建规则',
    'rules.exact': '精确地址', 'rules.catchall': '域名通配', 'rules.blacklist': '黑名单 {n}',
    'rules.regex': '主题正则', 'rules.size': '≤{n}MB', 'rules.forward': '转发', 'rules.block': '退信', 'rules.blackhole': '丢弃',
    'rules.type': '匹配类型', 'rules.pattern': '匹配模式', 'rules.action': '动作',
    'rules.actionFwd': '转发（forward）', 'rules.actionBlock': '退信（block · 发件方收到退信）', 'rules.actionHole': '丢弃（blackhole · 发件方无感知）',
    'rules.destField': '转发目标（仅已验证地址）', 'rules.noVerified': '暂无已验证目标地址，请先到「目标地址」页添加并验证',
    'rules.blacklistLabel': '发件人黑名单（每行一条：完整地址 / @域名 / /正则/）',
    'rules.blacklistPh': 'spam@scam.com\n@mkting-deal.net\n/@marketing.*\\.io$/', 'rules.regexLabel': '主题正则（通过条件，可留空）',
    'rules.regexPh': '^(订单|Invoice)', 'rules.sizeLabel': '大小上限（MB，可留空，≤25）',
    'rules.attLabel': '附件条件', 'rules.attAny': '不限', 'rules.attYes': '必须带附件', 'rules.attNo': '必须不带附件',
    'rules.created': '规则已创建', 'rules.saved': '规则已保存', 'rules.deleteConfirm': '删除该规则？', 'rules.deleted': '已删除',
    'rules.enabled': '已启用', 'rules.disabled': '已停用', 'rules.noDest': '(无目标)',
    'rules.tblTitle': '路由规则', 'rules.tblRule': '路由规则', 'rules.tblAction': '操作', 'rules.tblStats': '处理量', 'rules.tblStatus': '状态',
    'rules.catchallRow': '全收（Catch-all）', 'rules.catchallDesc': '所有未被上方规则命中的邮件都由它兜底处理', 'rules.alwaysOn': '始终活跃',
    'rules.statLine': '累计 {total} · 今日 {today}', 'rules.todayHandled': '今日处理',
    'rules.ovEmailRouting': 'Email Routing', 'rules.ovDns': 'DNS 记录', 'rules.ovDnsOk': '已配置',
    'rules.layerNote': 'Cloudflare 侧只保留一条 Catch-all 规则把所有邮件交给 InboxFly Worker；下方规则由 InboxFly 引擎逐条匹配执行。请勿在 Cloudflare 后台手动创建路由规则（会导致邮件绕过面板），已有原生规则可在「设置 → 域名」中导入。',
    'rules.enhanced': 'InboxFly 增强', 'set.forwardMoved': '「默认动作 / 兜底地址」已移至「规则」页的全收（Catch-all）行编辑。',
    'dest.flowAuto': '添加后 Cloudflare 会自动向该地址发送确认邮件；收件人点击邮件中的链接后，此处将自动变为「已验证」。',
    'dest.flowManual': '尚未配置 CF 凭据（设置 → 域名）：请在 Cloudflare Dashboard → 电子邮件 → 目标地址 中添加同一邮箱并完成验证，然后刷新本页。',
    'dest.manualAdded': '已添加，请到 Cloudflare 完成验证后刷新本页',
    'rules.createTitle': '创建路由规则', 'rules.editTitle': '编辑路由规则',
    'rules.createSub': '创建路由规则并设置对收到电子邮件要执行的操作。', 'rules.matchLabel': '电子邮件匹配模式',
    'rules.matchHint': '左侧填写名称（如 info、support），留空表示整个域名。', 'rules.actionLabel': '操作',
    'rules.actFwdShort': '发送到电子邮件', 'rules.actDropShort': '丢弃', 'rules.actBlockShort': '退信（拒绝接收）',
    'rules.actFwdDesc': '发送到电子邮件：将与此规则匹配的电子邮件路由到目标地址。',
    'rules.actDropDesc': '丢弃：删除与此规则匹配的电子邮件而不进行路由。',
    'rules.actBlockDesc': '退信（InboxFly 增强）：以 SMTP 拒绝并通知发件人（Cloudflare 原生不支持）。',
    'rules.advFilters': '高级筛选（可选 · InboxFly 增强）', 'rules.matchHint2': '', 'dest.pickDest': '目标地址（已验证）',
    'dest.addPh': '添加转发目标邮箱，如 me@gmail.com', 'dest.flow': '流程：添加 → CF 向该地址发确认邮件（生产环境）→ 收件人点击 → 回到这里点「已验证」。目标地址为账号级资源，验证一次全域名通用。',
    'dest.verifiedAt': '添加于 {a} · 验证于 {b} · 来源：{s}', 'dest.createdAt': '添加于 {a}', 'dest.manual': '手动', 'dest.api': 'CF API',
    'dest.fallback': '默认兜底', 'dest.deleteConfirm': '删除该目标地址？', 'dest.usedByRule': '有规则正在使用该地址，请先修改规则',
    'dest.dup': '地址已存在', 'dest.badEmail': '邮箱格式不正确', 'dest.markedVerified': '已标记为验证', 'dest.empty': '暂无目标地址，先添加一个吧',
    'stats.bytes': '累计处理流量', 'stats.chart': '近 14 日处理量（按状态堆叠）',
    'stats.note': '「已转发」指 Cloudflare 已受理转发；最终投递结果（含对方垃圾箱）对系统不可观测。',
    'stats.byDomain': '按域名', 'stats.noData': '暂无数据，先去模拟收信或等待真实来信',
    'set.forwardCard': '转发行为', 'set.defaultAction': '无规则命中时的默认动作',
    'set.fa_fwd': '转发到默认地址（forward_default）', 'set.fa_rej': '退信（reject）', 'set.fa_drop': '静默丢弃（drop）',
    'set.defaultForward': '默认转发地址（fail-open 兜底）', 'set.none': '（未设置）',
    'set.fallbackHint': '规则匹配与筛选之外的兜底地址；Worker 异常时优先尝试它，避免静默丢信',
    'set.blockedAction': '被筛选拦截邮件的处理方式', 'set.drop': '静默丢弃（drop · 默认）', 'set.reject': '退信（reject）',
    'set.saved': '配置已保存', 'set.storageCard': '存储', 'set.storageMode': '存储模式',
    'set.storageFull': '完整（副本 + 正文 + 附件）', 'set.storageMeta': '仅元数据（不占 R2，转发不受影响）',
    'set.storageHint': 'R2 估算用量接近上限时建议切换「仅元数据」',
    'set.storeBlocked': '存储被拦截邮件的正文', 'set.sbOff': '仅元数据（默认，防垃圾风暴）', 'set.sbOn': '存储完整正文',
    'set.appearance': '外观（主题 / 语言 / 布局）',
    'set.adminCard': '管理员账户', 'set.adminUser': '用户名', 'set.adminCur': '当前密码（必填）',
    'set.adminNew': '新密码（≥8 位，留空则不修改）', 'set.changeAdmin': '更新管理员', 'set.adminChanged': '管理员已更新',
    'set.domainsCard': '域名（Cloudflare 托管）', 'set.cfToken': 'CF API Token（Zone.Read + Email Routing Read）',
    'set.cfTokenHint': '用于自动同步账号下全部域名及 Email Routing 状态；Token 仅存于你自己的 Worker 数据库中',
    'set.cfTokenSet': '已设置', 'set.cfTokenNotSet': '未设置', 'set.cfSave': '保存 Token', 'set.cfSync': '从 Cloudflare 同步',
    'set.manualAdd': '手动登记', 'set.syncDone': '同步完成：{z} 个域名，{er} 个已启用 Email Routing', 'set.cfTokenMissing': '请先保存 CF API Token',
    'set.devCard': '本地开发工具', 'set.devHint': '本地无法接收真实邮件：模拟收信会用与生产完全相同的规则管道（匹配 → 筛选 → 决策 → 存储 → 统计）注入测试数据，仅跳过真实投递。',
    'set.resetConfirm': '清空全部邮件/附件/统计数据？（规则与配置保留）', 'set.resetDone': '已清空',
    'domains.title': '域名', 'domains.empty': '暂无域名，可手动登记或配置 CF API Token 后同步',
    'domains.addTitle': '登记域名', 'domains.addPh': 'example.com', 'domains.erToggle': '该域名已启用 Email Routing',
    'domains.added': '域名已登记', 'domains.deleted': '已移除', 'domains.deleteConfirm': '从列表移除该域名？（不影响 CF 上的实际配置）',
    'err.invalid_token': 'SETUP_TOKEN 不正确', 'err.bad_username': '用户名至少 3 位', 'err.bad_password': '密码至少 8 位',
    'err.already_setup': '已完成初始化', 'err.referenced_by_rule': '有规则正在使用该地址，请先修改规则',
    'err.destinations_unverified': '目标地址未全部验证', 'err.bad_subject_regex': '主题正则语法错误',
    'err.bad_max_size': '大小上限需在 1-25 之间', 'err.bad_pattern': '匹配模式格式不正确',
    'err.no_destinations': '转发动作需要至少一个目标地址', 'err.default_forward_not_verified': '默认转发地址未验证',
    'err.bad_domain': '域名格式不正确', 'err.cf_api_error': 'CF API 返回错误',
    'login.subtitle': '输入凭证以访问你的邮件转发面板', 'login.remember': '保持登录（30 天）',
    'login.foot': 'InboxFly · 开源 Cloudflare 邮件转发管理',
    'set.turnstileCard': '机器人防护（Cloudflare Turnstile）', 'set.turnstileEnable': '在登录页启用 Turnstile 人机验证',
    'set.tsSite': 'Site Key（站点密钥，可公开）', 'set.tsSecret': 'Secret Key（服务端密钥，不回显）',
    'set.tsHint': '在 Cloudflare Dashboard → Turnstile 创建站点后获取密钥。本地调试可用官方测试密钥：Site 1x00000000000000000000AA / Secret 1x0000000000000000000000000000000AA（总是通过）。',
    'set.tsSaved': '防护设置已保存',
    'err.turnstile_failed': '人机验证未通过，请重试', 'err.turnstile_keys_required': '开启前请先填写 Site Key 与 Secret Key',
    'err.cf_token_missing': '请先在设置中配置 CF API Token', 'err.cf_account_missing': '账号信息缺失，请先在设置中点击「从 Cloudflare 同步」',
    'mail.deleteSelected': '删除所选 ({n})', 'mail.batchConfirm': '删除选中的 {n} 封邮件（含副本与附件）？',
    'mail.batchDone': '已删除 {n} 封', 'mail.textBody': '纯文本正文',
    'set.r2Warn': 'R2 存储估算 {size}（近 30 天），接近 10GB 免费上限，建议切换「仅元数据」模式',
    'set.switchMeta': '切换仅元数据', 'set.storageNowMeta': '已切换为仅元数据', 'set.retentionLabel': 'R2 保留天数（Cron 每日清理）',
    'domains.enableBtn': '开启转发', 'domains.importBtn': '导入原生规则',
    'domains.importConfirm': '将原生规则导入为 InboxFly 规则并删除原生规则？（导入是复制；catch-all 保持指向 Worker）',
    'domains.importDone': '导入 {n} 条 · 跳过 {s} 条 · 移除原生 {d} 条',
    'domains.mxConfirm': '检测到冲突 MX 记录（替换后原邮箱服务将停止收信）：\n{list}\n\n确认替换？',
    'domains.enableDone': '已开启转发', 'domains.none': '暂无域名',
    'dest.cfAddBtn': '通过 CF API 添加', 'dest.cfAdded': '已提交，CF 已发送确认邮件；收件人点击后此处自动变为已验证',
  },
  en: {
    'nav.mail': 'Mail', 'nav.rules': 'Rules', 'nav.dest': 'Destinations', 'nav.domains': 'Domains',
    'nav.stats': 'Stats', 'nav.settings': 'Settings',
    'title.mail': 'Mail', 'title.rules': 'Forwarding Rules', 'title.dest': 'Destination Addresses',
    'title.stats': 'Forwarding Stats', 'title.settings': 'Settings',
    'cf.connected': 'Cloudflare connected',
    'theme.label': 'Theme', 'theme.glass': 'Fluid Glass', 'theme.min': 'Minimal', 'theme.play': 'Playful',
    'lang.label': 'Language', 'layout.label': 'Layout', 'layout.sidebar': 'Sidebar', 'layout.top': 'Header',
    'mode.label': 'Appearance', 'mode.light': 'Light', 'mode.dark': 'Dark', 'mode.auto': 'System', 'mode.toggle': 'Toggle light/dark',
    'st.forwarded': 'Forwarded', 'st.blocked': 'Blocked', 'st.dropped': 'Dropped', 'st.rejected': 'Bounced', 'st.error': 'Error',
    'common.save': 'Save', 'common.cancel': 'Cancel', 'common.delete': 'Delete', 'common.edit': 'Edit',
    'common.add': 'Add', 'common.loading': 'Loading…', 'common.logout': 'Sign out',
    'login.title': 'InboxFly', 'login.sub': 'Sign in to the admin panel', 'login.user': 'Username', 'login.pass': 'Password', 'login.go': 'Sign in',
    'err.bad_credentials': 'Incorrect username or password', 'err.rate_limited': 'Too many attempts, try again later',
    'wiz.welcome': 'Welcome to InboxFly', 'wiz.sub': 'Open-source Cloudflare email forwarding manager · Setup wizard',
    'wiz.step': 'Step', 'wiz.s1': 'Verify deployer identity', 'wiz.s2': 'Create admin credentials', 'wiz.s3': 'Enable Email Routing',
    'wiz.s4': 'Add destination address', 'wiz.s5': 'Create first rule',
    'wiz.token': 'SETUP_TOKEN', 'wiz.tokenHint': 'Local dev: see inboxfly/.dev.vars (default inboxfly-local-setup)',
    'wiz.tokenPh': 'Initialization token from deployment', 'wiz.verifyNext': 'Verify & continue', 'wiz.user': 'Admin username',
    'wiz.pass': 'Admin password (≥8 chars)', 'wiz.createCred': 'Create credentials', 'wiz.back': 'Back',
    'wiz.why': 'Why this step is needed', 'wiz.risk': 'Risks & consequences',
    'wiz.why1': 'Proves you are the deployer, preventing a stranger who obtains the panel URL from taking over.',
    'wiz.risk1': 'The token only appears in deploy output (or .dev.vars) and is invalidated once setup completes.',
    'wiz.why2': 'This panel can read all your email copies, so strong credentials are required.',
    'wiz.risk2': 'Passwords are stored hashed and cannot be recovered. Keep it safe.',
    'wiz.why3': 'Mail must flow through Cloudflare Email Routing (MX → catch-all → Worker) to enter the forwarding pipeline.',
    'wiz.risk3': 'If the domain already uses another mail service, switching MX will stop that service from receiving — confirm each record.',
    'wiz.why4': 'Cloudflare requires destination addresses to be verified by their owner. Destinations are account-level: verify once, use everywhere.',
    'wiz.risk4': 'Confirmation mail may land in spam; unverified addresses cannot be used in rules.',
    'wiz.why5': 'Creates a ready-to-use default rule and sets the first verified address as the fail-open fallback.',
    'wiz.risk5': 'Rules can be edited or disabled anytime; first match wins, exact beats catch-all.',
    'wiz.prodPath': 'In production:',
    'wiz.prodSteps': 'Cloudflare Dashboard → your zone → Email → Email Routing → Enable → Catch-all address → action "Send to a Worker" → pick InboxFly Worker. If conflicting MX records exist (domain in use by another mail service), confirm each before replacing.',
    'wiz.localSkip': 'Local dev: real inbound mail is unavailable locally — skip this step; use Settings → Simulate later to exercise the full pipeline.',
    'wiz.skipLocal': 'Skip (local)', 'wiz.doneProd': 'I have completed this',
    'wiz.destPh': 'Destination email, e.g. me@gmail.com', 'wiz.markVerified': 'I confirmed in CF', 'wiz.pending': 'Pending', 'wiz.verified': 'Verified',
    'wiz.needVerified': 'Continue (need ≥1 verified)', 'wiz.destFlow': 'Flow: add → CF emails the address (production) → recipient clicks → return here and mark verified',
    'wiz.rulePattern': 'Match pattern (catch-all)', 'wiz.ruleAction': 'Action', 'wiz.ruleTo': 'Forward to (verified)',
    'wiz.finish': 'Finish & open panel', 'wiz.done': 'Setup complete',
    'mail.search': 'Search sender / subject / body…', 'mail.sim': 'Simulate', 'mail.allDomains': 'All domains',
    'mail.allStatus': 'All statuses', 'mail.empty': 'No mail yet', 'mail.emptyHint': 'Local dev: click "Simulate" above to seed test data. In production, wait for the first message.',
    'mail.pick': 'Select an email to view details', 'mail.more': 'Load more', 'mail.raw': 'Raw MIME (.eml)',
    'mail.bodySandbox': 'Body (iframe sandboxed · remote images blocked by default)', 'mail.noHtml': '(empty body)',
    'mail.textOnly': 'This mail stored text-only content — see raw MIME (.eml)',
    'mail.metaOnly': 'Blocked mail stores metadata only (enable "store blocked bodies" in Settings)',
    'mail.deleted': 'Deleted', 'mail.deleteConfirm': 'Delete this email (copy + attachments)?',
    'mail.simDone': 'Generated {n} test emails', 'mail.layoutToggle': 'Toggle sidebar / header mode',
    'domains.autoVerify': 'CF credentials configured: ownership and Email Routing status are verified automatically after submit.', 'domains.manualHint': 'No CF credentials: enable Email Routing on Cloudflare yourself (configure credentials in Settings for auto-verification).', 'set.pwaInstall': 'Install app (PWA)', 'set.pwaHint': 'Install the panel as a standalone app. If the button is hidden, use your browser menu → Install / Add to Home Screen.',
    'mail.unread': 'Unread', 'mail.refresh': 'Refresh', 'mail.refreshed': 'Refreshed',
    'mail.defaultFwd': 'Default fallback',
    'rules.evalOrder': 'Evaluation: exact addresses → catch-alls, sorted within group, first match wins',
    'rules.exactGroup': 'Exact address rules', 'rules.catchGroup': 'Catch-all rules', 'rules.none': 'None', 'rules.new': 'New rule',
    'rules.exact': 'Exact', 'rules.catchall': 'Domain wildcard', 'rules.blacklist': 'Blacklist {n}',
    'rules.regex': 'Subject regex', 'rules.size': '≤{n}MB', 'rules.forward': 'Forward', 'rules.block': 'Bounce', 'rules.blackhole': 'Drop',
    'rules.type': 'Match type', 'rules.pattern': 'Pattern', 'rules.action': 'Action',
    'rules.actionFwd': 'Forward', 'rules.actionBlock': 'Bounce (sender is notified)', 'rules.actionHole': 'Drop (silent)',
    'rules.destField': 'Destinations (verified only)', 'rules.noVerified': 'No verified destinations yet — add one on the Destinations page',
    'rules.blacklistLabel': 'Sender blacklist (one per line: address / @domain / /regex/)',
    'rules.blacklistPh': 'spam@scam.com\n@mkting-deal.net\n/@marketing.*\\.io$/', 'rules.regexLabel': 'Subject regex (pass condition, optional)',
    'rules.regexPh': '^(Invoice|Receipt)', 'rules.sizeLabel': 'Size cap (MB, optional, ≤25)',
    'rules.attLabel': 'Attachment condition', 'rules.attAny': 'Any', 'rules.attYes': 'Must have attachment', 'rules.attNo': 'Must not have',
    'rules.created': 'Rule created', 'rules.saved': 'Rule saved', 'rules.deleteConfirm': 'Delete this rule?', 'rules.deleted': 'Deleted',
    'rules.enabled': 'Enabled', 'rules.disabled': 'Disabled', 'rules.noDest': '(no destination)',
    'rules.tblTitle': 'Routing rules', 'rules.tblRule': 'Rule', 'rules.tblAction': 'Action', 'rules.tblStats': 'Handled', 'rules.tblStatus': 'Status',
    'rules.catchallRow': 'Catch-all', 'rules.catchallDesc': 'Handles all mail not matched by any rule above', 'rules.alwaysOn': 'Always on',
    'rules.statLine': 'Total {total} · today {today}', 'rules.todayHandled': 'Handled today',
    'rules.ovEmailRouting': 'Email Routing', 'rules.ovDns': 'DNS records', 'rules.ovDnsOk': 'Configured',
    'rules.layerNote': 'Cloudflare keeps a single Catch-all rule that hands all mail to the InboxFly Worker; the rules below are matched one-by-one by the InboxFly engine. Do not create routing rules manually in the Cloudflare dashboard (mail would bypass the panel) — import existing native rules via Settings → Domains.',
    'rules.enhanced': 'InboxFly enhancement', 'set.forwardMoved': 'Default action & fallback address have moved to the Catch-all row on the Rules page.',
    'dest.flowAuto': 'After adding, Cloudflare automatically sends a confirmation email to the address; it becomes verified here once the recipient clicks the link.',
    'dest.flowManual': 'CF credentials not configured (Settings → Domains): add the same mailbox under Cloudflare Dashboard → Email → Destination addresses, verify it there, then refresh this page.',
    'dest.manualAdded': 'Added — complete verification on Cloudflare, then refresh this page',
    'rules.createTitle': 'Create routing rule', 'rules.editTitle': 'Edit routing rule',
    'rules.createSub': 'Create a routing rule and set the action to take on incoming email.', 'rules.matchLabel': 'Email match',
    'rules.matchHint': 'Left: name (e.g. info, support). Leave empty to match the whole domain.', 'rules.actionLabel': 'Action',
    'rules.actFwdShort': 'Send to an email', 'rules.actDropShort': 'Drop', 'rules.actBlockShort': 'Bounce (reject)',
    'rules.actFwdDesc': 'Send to an email: routes matching email to a destination address.',
    'rules.actDropDesc': 'Drop: deletes matching email without routing it.',
    'rules.actBlockDesc': 'Bounce (InboxFly enhancement): rejects via SMTP and notifies the sender (not available natively in Cloudflare).',
    'rules.advFilters': 'Advanced filters (optional · InboxFly enhancement)', 'dest.pickDest': 'Destination addresses (verified)',
    'dest.addPh': 'Add destination email, e.g. me@gmail.com', 'dest.flow': 'Flow: add → CF emails the address (production) → recipient clicks → mark verified here. Destinations are account-level: verify once, use everywhere.',
    'dest.verifiedAt': 'Added {a} · verified {b} · source: {s}', 'dest.createdAt': 'Added {a}', 'dest.manual': 'manual', 'dest.api': 'CF API',
    'dest.fallback': 'Default fallback', 'dest.deleteConfirm': 'Remove this destination?', 'dest.usedByRule': 'Referenced by a rule — edit the rule first',
    'dest.dup': 'Address already exists', 'dest.badEmail': 'Invalid email', 'dest.markedVerified': 'Marked as verified', 'dest.empty': 'No destinations yet — add one',
    'stats.bytes': 'Total processed', 'stats.chart': 'Last 14 days (stacked by status)',
    'stats.note': '"Forwarded" means Cloudflare accepted the forward; final delivery (including recipient spam folder) is not observable.',
    'stats.byDomain': 'By domain', 'stats.noData': 'No data yet — simulate mail or wait for real traffic',
    'set.forwardCard': 'Forwarding behavior', 'set.defaultAction': 'Action when no rule matches',
    'set.fa_fwd': 'Forward to default address (forward_default)', 'set.fa_rej': 'Bounce (reject)', 'set.fa_drop': 'Silent drop (drop)',
    'set.defaultForward': 'Default forward address (fail-open fallback)', 'set.none': '(not set)',
    'set.fallbackHint': 'Fallback beyond rules & filters; the Worker tries it on internal errors to avoid silent loss',
    'set.blockedAction': 'How filter-blocked mail is handled', 'set.drop': 'Silent drop (default)', 'set.reject': 'Bounce (reject)',
    'set.saved': 'Settings saved', 'set.storageCard': 'Storage', 'set.storageMode': 'Storage mode',
    'set.storageFull': 'Full (copies + bodies + attachments)', 'set.storageMeta': 'Metadata only (no R2 usage, forwarding unaffected)',
    'set.storageHint': 'Switch to "metadata only" when R2 usage approaches the cap',
    'set.storeBlocked': 'Store blocked mail bodies', 'set.sbOff': 'Metadata only (default, spam-storm safe)', 'set.sbOn': 'Store full bodies',
    'set.appearance': 'Appearance (theme / language / layout)',
    'set.adminCard': 'Admin account', 'set.adminUser': 'Username', 'set.adminCur': 'Current password (required)',
    'set.adminNew': 'New password (≥8 chars, leave empty to keep)', 'set.changeAdmin': 'Update admin', 'set.adminChanged': 'Admin updated',
    'set.domainsCard': 'Domains (Cloudflare hosted)', 'set.cfToken': 'CF API Token (Zone.Read + Email Routing Read)',
    'set.cfTokenHint': 'Used to sync all hosted zones and their Email Routing status; the token is stored only in your own Worker database',
    'set.cfTokenSet': 'set', 'set.cfTokenNotSet': 'not set', 'set.cfSave': 'Save token', 'set.cfSync': 'Sync from Cloudflare',
    'set.manualAdd': 'Register manually', 'set.syncDone': 'Synced: {z} zones, {er} with Email Routing on', 'set.cfTokenMissing': 'Save a CF API Token first',
    'set.devCard': 'Local dev tools', 'set.devHint': 'Local cannot receive real mail: Simulate runs the exact production pipeline (match → filter → decide → store → stats) and only skips actual delivery.',
    'set.resetConfirm': 'Clear all mail/attachments/stats? (rules & config are kept)', 'set.resetDone': 'Cleared',
    'domains.title': 'Domains', 'domains.empty': 'No domains — register manually or configure a CF API Token to sync',
    'domains.addTitle': 'Register domain', 'domains.addPh': 'example.com', 'domains.erToggle': 'Email Routing enabled on this domain',
    'domains.added': 'Domain registered', 'domains.deleted': 'Removed', 'domains.deleteConfirm': 'Remove from list? (does not change anything on Cloudflare)',
    'err.invalid_token': 'Incorrect SETUP_TOKEN', 'err.bad_username': 'Username must be ≥3 chars', 'err.bad_password': 'Password must be ≥8 chars',
    'err.already_setup': 'Already set up', 'err.referenced_by_rule': 'Referenced by a rule — edit the rule first',
    'err.destinations_unverified': 'Some destinations are not verified', 'err.bad_subject_regex': 'Invalid subject regex',
    'err.bad_max_size': 'Size cap must be 1-25', 'err.bad_pattern': 'Invalid pattern',
    'err.no_destinations': 'Forward action needs at least one destination', 'err.default_forward_not_verified': 'Default forward is not verified',
    'err.bad_domain': 'Invalid domain', 'err.cf_api_error': 'CF API error',
    'login.subtitle': 'Enter your credentials to access your forwarding panel', 'login.remember': 'Keep me signed in (30 days)',
    'login.foot': 'InboxFly · open-source Cloudflare forwarding manager',
    'set.turnstileCard': 'Bot protection (Cloudflare Turnstile)', 'set.turnstileEnable': 'Enable Turnstile human verification on sign-in',
    'set.tsSite': 'Site key (public)', 'set.tsSecret': 'Secret key (never echoed back)',
    'set.tsHint': 'Create a site in Cloudflare Dashboard → Turnstile to get the keys. For local testing use the official test keys: Site 1x00000000000000000000AA / Secret 1x0000000000000000000000000000000AA (always passes).',
    'set.tsSaved': 'Protection settings saved',
    'err.turnstile_failed': 'Human verification failed, please retry', 'err.turnstile_keys_required': 'Fill in both the site key and secret key before enabling',
    'err.cf_token_missing': 'Configure a CF API Token in Settings first', 'err.cf_account_missing': 'Account info missing — click "Sync from Cloudflare" in Settings first',
    'mail.deleteSelected': 'Delete selected ({n})', 'mail.batchConfirm': 'Delete {n} selected emails (copies + attachments)?',
    'mail.batchDone': 'Deleted {n}', 'mail.textBody': 'Plain-text body',
    'set.r2Warn': 'R2 usage estimate {size} (last 30 days) is near the 10GB free cap — switch to metadata-only mode',
    'set.switchMeta': 'Switch to metadata-only', 'set.storageNowMeta': 'Switched to metadata-only', 'set.retentionLabel': 'R2 retention days (daily cron cleanup)',
    'domains.enableBtn': 'Enable forwarding', 'domains.importBtn': 'Import native rules',
    'domains.importConfirm': 'Import native rules as InboxFly rules and delete them? (import is a copy; catch-all keeps pointing to the Worker)',
    'domains.importDone': 'Imported {n} · skipped {s} · removed {d} native',
    'domains.mxConfirm': 'Conflicting MX records found (the previous mail service will stop receiving):\n{list}\n\nReplace them?',
    'domains.enableDone': 'Forwarding enabled', 'domains.none': 'No domains',
    'dest.cfAddBtn': 'Add via CF API', 'dest.cfAdded': 'Submitted — CF sent a confirmation email; the address auto-verifies here once clicked',
  },
};
// 合并多语言扩展包（i18n.js：繁中/日/韩/德/法/意/俄/越）
if (window.I18N_EXTRA) Object.assign(STR, window.I18N_EXTRA);
const LANGS = window.APP_LANGS || [{ code: 'zh', label: '中文' }, { code: 'en', label: 'English' }];
const langOptions = selected => LANGS.map(l => `<option value="${l.code}" ${selected === l.code ? 'selected' : ''}>${esc(l.label)}</option>`).join('');
const detectLang = () => {
  const nav = (navigator.language || 'zh').toLowerCase();
  const m = [['zh-tw', 'zhTW'], ['zh-hk', 'zhTW'], ['zh-hant', 'zhTW'], ['zh-hans', 'zh'], ['ja', 'ja'], ['ko', 'ko'], ['de', 'de'], ['fr', 'fr'], ['it', 'it'], ['ru', 'ru'], ['vi', 'vi']];
  for (const [p, c] of m) if (nav.startsWith(p)) return c;
  return nav.startsWith('zh') ? 'zh' : 'en';
};
let LANG = 'zh';
try { LANG = localStorage.getItem('if-lang') || detectLang(); } catch { LANG = 'zh'; }
const t = k => (STR[LANG] && STR[LANG][k]) || STR.zh[k] || k;
const tf = (k, map) => Object.entries(map || {}).reduce((s, [a, b]) => s.replace(`{${a}}`, b), t(k));
function setLang(l) {
  LANG = l;
  try { localStorage.setItem('if-lang', l); } catch {}
  render();
}

// ---------- 深浅色模式（浅色 / 深色 / 跟随系统） ----------
function getMode() {
  const m = localStorage.getItem('if-mode');
  if (m === 'dark' || m === 'light') return m;
  try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}
function applyMode() {
  const m = getMode();
  document.documentElement.dataset.mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.innerHTML = icon(m === 'dark' ? 'sun' : 'moon');
    b.title = t('mode.toggle');
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = m === 'dark' ? '#0e0f13' : '#0a84ff';
}
function setMode(m) {
  // 'light' | 'dark' | 'auto'
  if (m === 'auto') { try { localStorage.removeItem('if-mode'); } catch {} }
  else { try { localStorage.setItem('if-mode', m); } catch {} }
  applyMode();
}
function toggleMode() { setMode(getMode() === 'dark' ? 'light' : 'dark'); }

// 布局状态
const getLayout = () => {
  try { if (matchMedia('(max-width: 900px)').matches) return 'top'; } catch {} // 移动端仅页眉布局
  return localStorage.getItem('if-layout') === 'top' ? 'top' : 'sidebar';
};
const setLayout = l => { try { localStorage.setItem('if-layout', l); } catch {} render(); };
const isCollapsed = () => localStorage.getItem('if-side-collapsed') === '1';
const toggleCollapsed = () => {
  localStorage.setItem('if-side-collapsed', isCollapsed() ? '0' : '1');
  document.body.classList.toggle('side-collapsed', !isCollapsed());
};

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
  if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  if (!['GET', 'HEAD'].includes(init.method)) init.headers['X-CSRF-Token'] = getCookie('if_csrf');
  const res = await fetch(path, init);
  let data = {};
  try { data = await res.json(); } catch { /* 204 等 */ }
  if (res.status === 401) {
    if (data.error === 'setup_required') { location.hash = '#/setup'; throw new Error('setup'); }
    location.hash = '#/login';
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const err = new Error(data.error || String(res.status));
    err.data = data; // 透传详情（如 mx_conflicts 的冲突记录列表）
    throw err;
  }
  return data;
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toast-wrap').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 300ms'; setTimeout(() => el.remove(), 320); }, 2600);
}

function setTheme(th) {
  document.documentElement.dataset.theme = th;
  try { localStorage.setItem('if-theme', th); } catch {}
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString(LANG === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(LANG === 'en' ? 'en-US' : 'zh-CN', { month: 'numeric', day: 'numeric' });
}

function fmtBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(i ? 1 : 0) + ' ' + u[i];
}

// ---------- 图标 ----------
const IC = {
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  rules: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  dest: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  stats: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  domains: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
};
const icon = n => `<span class="ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg></span>`;

const LOGO = (s) => `<img class="logo-img" src="/icons/logo.svg" alt="InboxFly" title="InboxFly" style="height:${s}px;width:auto;" ondragstart="return false">`;

const STATUS_BADGE = { forwarded: 'ok', blocked: 'warn', dropped: 'mute', rejected: 'err', error: 'info' };
const badge = st => `<span class="badge ${STATUS_BADGE[st] || 'mute'}"><i></i>${t('st.' + st)}</span>`;

// =====================================================================
// 路由
// =====================================================================
const routes = {};
let MAIL_QUERY = new URLSearchParams();

window.addEventListener('hashchange', render);

async function render() {
  const raw = location.hash.replace('#/', '') || 'mail';
  const [view0, qs] = raw.split('?');
  MAIL_QUERY = new URLSearchParams(qs || '');
  document.body.dataset.layout = getLayout();
  const view = routes[view0] ? view0 : 'mail';
  if (view === 'login') return routes.login();
  try {
    CFG = await api('/api/config');
  } catch { return; }
  if (!CFG.setup_completed) return routes.setup();
  if (view === 'setup') { location.hash = '#/mail'; return; }
  const titles = { mail: 'title.mail', rules: 'title.rules', destinations: 'title.dest', stats: 'title.stats', settings: 'title.settings' };
  $('#app').innerHTML = shell(view, titles[view] || 'title.mail');
  bindShell();
  await routes[view]();
  await loadSideDomains();
}

const NAV = [
  { id: 'mail', icon: 'mail', t: () => t('nav.mail') },
  { id: 'rules', icon: 'rules', t: () => t('nav.rules') },
  { id: 'destinations', icon: 'dest', t: () => t('nav.dest') },
  { id: 'stats', icon: 'stats', t: () => t('nav.stats') },
  { id: 'settings', icon: 'settings', t: () => t('nav.settings') },
];

function navLinks(active) {
  return NAV.map(n => `<a class="nav ${active === n.id ? 'on' : ''}" href="#/${n.id}" title="${esc(n.t())}">${icon(n.icon)}<span class="lb">${esc(n.t())}</span>${n.id === 'mail' ? '<span class="cnt" data-badge="mail" style="display:none;"></span>' : ''}</a>`).join('');
}

function selectsHtml() {
  return `
    <select class="ft-select" id="theme-select" title="${esc(t('theme.label'))}">
      <option value="glass">${esc(t('theme.glass'))}</option>
      <option value="min">${esc(t('theme.min'))}</option>
      <option value="play">${esc(t('theme.play'))}</option>
    </select>
    <select class="ft-select" id="lang-select" title="${esc(t('lang.label'))}">${langOptions(LANG)}</select>`;
}


// 图标按钮下拉菜单（主题/语言选择）
function openIconMenu(btn, items, onPick) {
  document.querySelectorAll('.icon-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'icon-menu panel';
  menu.innerHTML = items.map(i =>
    `<button class="im-item ${i.current ? 'on' : ''}" data-v="${esc(i.value)}"><span>${esc(i.label)}</span><span class="tick">${i.current ? '✓' : ''}</span></button>`
  ).join('');
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  const mw = Math.max(menu.offsetWidth, 168);
  let x = Math.max(8, Math.min(r.right - mw, document.documentElement.clientWidth - mw - 8));
  let y = r.bottom + 6;
  if (y + menu.offsetHeight > window.innerHeight - 8) y = Math.max(8, r.top - menu.offsetHeight - 6);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.querySelectorAll('.im-item').forEach(b => b.onclick = () => { menu.remove(); onPick(b.dataset.v); });
  setTimeout(() => {
    const close = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
    document.addEventListener('click', close);
  });
}
function themeMenuItems() {
  const cur = document.documentElement.dataset.theme || 'glass';
  return [
    { value: 'glass', label: t('theme.glass'), current: cur === 'glass' },
    { value: 'min', label: t('theme.min'), current: cur === 'min' },
    { value: 'play', label: t('theme.play'), current: cur === 'play' },
  ];
}
function langMenuItems() {
  return LANGS.map(l => ({ value: l.code, label: l.label, current: LANG === l.code }));
}
function bindIconMenus() {
  for (const id of ['sf-theme', 'mt-theme']) {
    const b = document.getElementById(id);
    if (b) b.onclick = () => openIconMenu(b, themeMenuItems(), v => { setTheme(v); render(); });
  }
  for (const id of ['sf-lang', 'mt-lang']) {
    const b = document.getElementById(id);
    if (b) b.onclick = () => openIconMenu(b, langMenuItems(), v => setLang(v));
  }
}

function bindShellCommon() {
  const th = $('#theme-select');
  if (th) { th.value = document.documentElement.dataset.theme || 'glass'; th.onchange = () => setTheme(th.value); }
  const lg = $('#lang-select');
  if (lg) { lg.value = LANG; lg.onchange = () => setLang(lg.value); }
  document.querySelectorAll('.mode-btn').forEach(b => { b.onclick = () => toggleMode(); });
  applyMode();
  bindIconMenus();
  const lo = $('#sf-logout');
  if (lo) lo.onclick = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    location.hash = '#/login';
  };
}

function shell(active, titleKey) {
  const layout = getLayout();
  const collapsed = isCollapsed();
  const head = `
    <div class="mobile-top">
      <button class="hamb" id="hamb-btn" aria-label="menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
      ${LOGO(24)}<span class="title">InboxFly</span>
      <button class="icon-btn" id="mt-theme" title="${esc(t('theme.label'))}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.68-.75 1.68-1.68 0-.44-.17-.86-.48-1.17a1.68 1.68 0 0 1 1.18-2.86h2.12c3.09 0 5.5-2.41 5.5-5.5C22 5.16 17.5 2 12 2z"/></svg>
      </button>
      <button class="icon-btn" id="mt-lang" title="${esc(t('lang.label'))}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC.languages}</svg>
      </button>
      <button class="icon-btn mode-btn" title="${esc(t('mode.toggle'))}"></button>
      <button class="icon-btn" id="mt-logout" title="${esc(t('common.logout'))}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
      </button>
      <button class="hamb" id="pwa-top" style="display:none;" title="PWA">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
      </button>
      <span class="status-pill"><span class="dot"></span></span>
    </div>
    <div class="drawer-mask" id="drawer-mask"></div>`;
  const foot = `
    <div class="side-foot">
      <div class="status-pill"><span class="dot"></span>${esc(t('cf.connected'))}</div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="icon-btn" id="sf-theme" title="${esc(t('theme.label'))}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.68-.75 1.68-1.68 0-.44-.17-.86-.48-1.17a1.68 1.68 0 0 1 1.18-2.86h2.12c3.09 0 5.5-2.41 5.5-5.5C22 5.16 17.5 2 12 2z"/></svg>
        </button>
        <button class="icon-btn" id="sf-lang" title="${esc(t('lang.label'))}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC.languages}</svg>
        </button>
        <button class="icon-btn mode-btn" title="${esc(t('mode.toggle'))}"></button>
        <button class="icon-btn" id="sf-logout" title="${esc(t('common.logout'))}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </div>
    </div>`;
  const domainSec = `
    <div class="dom-sec">
      <div class="dom-sec-head"><span class="sec-label">${esc(t('nav.domains'))}</span>
        <span id="dom-er-count"></span>
        <button class="add" id="dom-add" title="${esc(t('set.manualAdd'))}">＋</button>
      </div>
      <div class="dom-list" id="side-domains"><div class="dom-empty">${esc(t('common.loading'))}</div></div>
    </div>`;

  if (layout === 'top') {
    return `${head}
      <header class="topbar">
        <div class="brand">${LOGO(24)}</div>
        ${navLinks(active)}
        <span class="spacer"></span>
        <span class="status-pill"><span class="dot"></span>${esc(t('cf.connected'))}</span>
        <select id="top-domains" title="${esc(t('nav.domains'))}"><option value="">${esc(t('nav.domains'))}</option></select>
        ${selectsHtml()}
        <button class="icon-btn mode-btn" title="${esc(t('mode.toggle'))}"></button>
        <button class="icon-btn" id="top-logout" title="${esc(t('common.logout'))}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </header>
      <main class="content">
        <div class="page-head"><h2>${esc(t(titleKey))}</h2><span id="head-extra"></span></div>
        <div id="content"></div>
        <footer class="app-foot"><a href="https://inboxfly.email" target="_blank" rel="noopener">${esc(t('login.foot'))}</a></footer>
      </main>`;
  }
  return `${head}
    <div class="app ${collapsed ? 'collapsed' : ''}">
      <aside class="side">
        <div class="brand">${LOGO(26)}
          <button class="collapse-btn" id="collapse-btn" title="${esc(t('layout.sidebar'))}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>
          </button>
        </div>
        ${navLinks(active)}
        ${domainSec}
        ${foot}
      </aside>
      <main class="content">
        <div class="page-head"><h2>${esc(t(titleKey))}</h2><span id="head-extra"></span></div>
        <div id="content"></div>
        <footer class="app-foot"><a href="https://inboxfly.email" target="_blank" rel="noopener">${esc(t('login.foot'))}</a></footer>
      </main>
    </div>`;
}

function bindShell() {
  bindShellCommon();
  document.body.classList.toggle('side-collapsed', isCollapsed());
  const cb = $('#collapse-btn');
  if (cb) cb.onclick = () => { toggleCollapsed(); render(); };
  const hamb = $('#hamb-btn');
  if (hamb) hamb.onclick = () => document.body.classList.add('drawer-open');
  const pt = $('#pwa-top');
  if (pt && _pwaPrompt) { pt.style.display = 'grid'; pt.onclick = installPwa; }
  const mask = $('#drawer-mask');
  if (mask) mask.onclick = () => document.body.classList.remove('drawer-open');
  const td = $('#top-domains');
  if (td) td.onchange = () => { if (td.value) location.hash = `#/mail?domain=${encodeURIComponent(td.value)}`; };
  const add = $('#dom-add');
  if (add) add.onclick = () => openDomainAddModal();
  const lo = $('#top-logout');
  if (lo) lo.onclick = doLogout;
  bindIconMenus();
  const mo = $('#mt-logout');
  if (mo) mo.onclick = doLogout;
}
async function doLogout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  location.hash = '#/login';
}

// 侧栏「＋」：登记域名（有 CF 凭据时自动验证归属与 Email Routing 状态）
function openDomainAddModal() {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="panel modal" style="width:min(420px,92vw);">
      <h3>${esc(t('domains.addTitle'))}</h3>
      <div class="field"><input id="dm-input" placeholder="${esc(t('domains.addPh'))}"
        style="padding:10px 12px;border-radius:var(--r-item);border:1px solid var(--field-bd);background:var(--field-bg);color:var(--text);outline:none;font-size:14px;width:100%;"></div>
      <div class="hint" style="margin:-6px 0 14px;">${esc(CFG.cf_api_token_set ? t('domains.autoVerify') : t('domains.manualHint'))}</div>
      <div class="modal-foot">
        <button class="btn sec" id="dm-cancel">${esc(t('common.cancel'))}</button>
        <button class="btn" id="dm-save">${esc(t('common.add'))}</button>
      </div>
    </div>`;
  document.body.appendChild(mask);
  mask.querySelector('#dm-cancel').onclick = () => mask.remove();
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
  mask.querySelector('#dm-save').onclick = async () => {
    try {
      const domain = mask.querySelector('#dm-input').value.trim();
      if (!domain) return;
      await api('/api/domains', { method: 'POST', body: { domain } });
      toast(t('domains.added'), 'ok');
      mask.remove();
      await loadSideDomains();
    } catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err'); }
  };
  mask.querySelector('#dm-input').focus();
}

async function loadSideDomains() {
  try {
    const r = await api('/api/domains');
    const list = r.items;
    const item = d => `
      <div class="dom-item ${MAIL_QUERY.get('domain') === d.domain ? 'cur' : ''}" data-dm="${esc(d.domain)}" title="${esc(d.domain)}${d.email_routing === true ? ' · Email Routing' : ''}">
        <span class="er ${d.email_routing === true ? 'on' : d.email_routing === false ? 'off' : ''}"></span>
        <span class="nm">${esc(d.domain)}</span>
        ${d.emails ? `<span class="n">${d.emails}</span>` : ''}
      </div>`;
    const html = list.length
      ? list.map(item).join('')
      : `<div class="dom-empty">${esc(t('domains.empty'))}</div>`;
    const side = $('#side-domains');
    if (side) {
      side.innerHTML = html;
      side.querySelectorAll('[data-dm]').forEach(el => el.onclick = () => {
        document.body.classList.remove('drawer-open');
        location.hash = `#/mail?domain=${encodeURIComponent(el.dataset.dm)}`;
      });
    }
    const ec = $('#dom-er-count');
    if (ec) ec.innerHTML = r.erCount ? `<span class="badge ok" style="padding:1px 7px;"><i></i>ER ×${r.erCount}</span>` : '';
    const td = $('#top-domains');
    if (td) {
      td.innerHTML = `<option value="">${esc(t('nav.domains'))}</option>` +
        list.map(d => `<option value="${esc(d.domain)}" ${MAIL_QUERY.get('domain') === d.domain ? 'selected' : ''}>${d.email_routing === true ? '✉ ' : ''}${esc(d.domain)}</option>`).join('');
    }
  } catch { /* 侧栏域名加载失败不打断页面 */ }
}

// =====================================================================
// 首次运行向导（§3.2）
// =====================================================================
routes.setup = function () {
  const w = (routes._wiz ||= { step: 1, token: '', username: '', password: '', dests: [] });
  let body = '';
  if (w.step === 1) {
    body = `
      <div class="field"><label>${esc(t('wiz.token'))}</label>
        <input id="wz-token" type="password" placeholder="${esc(t('wiz.tokenPh'))}" autocomplete="off">
        <div class="hint">${esc(t('wiz.tokenHint'))}</div>
      </div>
      <div class="wiz-nav"><span></span><button class="btn" id="wz-next">${esc(t('wiz.verifyNext'))}</button></div>`;
  } else if (w.step === 2) {
    body = `
      <div class="field"><label>${esc(t('wiz.user'))}</label><input id="wz-user" value="${esc(w.username)}" autocomplete="username"></div>
      <div class="field"><label>${esc(t('wiz.pass'))}</label><input id="wz-pass" type="password" autocomplete="new-password"></div>
      <div class="wiz-nav"><button class="btn sec" id="wz-back">${esc(t('wiz.back'))}</button><button class="btn" id="wz-next">${esc(t('wiz.createCred'))}</button></div>`;
  } else if (w.step === 3) {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    body = `
      <div class="wiz-note"><div><b>${esc(t('wiz.prodPath'))}</b><br>${esc(t('wiz.prodSteps'))}</div></div>
      ${local ? `<div class="wiz-note"><div>${esc(t('wiz.localSkip'))}</div></div>` : ''}
      <div class="wiz-nav"><button class="btn sec" id="wz-back">${esc(t('wiz.back'))}</button><button class="btn" id="wz-next">${esc(local ? t('wiz.skipLocal') : t('wiz.doneProd'))}</button></div>`;
  } else if (w.step === 4) {
    body = `
      <div id="wz-dest-list" class="card-list" style="margin-bottom:14px;"></div>
      <div style="display:flex;gap:8px;">
        <div class="field" style="flex:1;margin:0;"><input id="wz-dest-email" placeholder="${esc(t('wiz.destPh'))}" type="email"></div>
        <button class="btn sec" id="wz-dest-add" style="align-self:flex-start;">${esc(t('common.add'))}</button>
      </div>
      <div class="hint" style="margin-top:8px;">${esc(t('wiz.destFlow'))}</div>
      <div class="wiz-nav"><button class="btn sec" id="wz-back">${esc(t('wiz.back'))}</button><button class="btn" id="wz-next" ${w.dests.some(d => d.status === 'verified') ? '' : 'disabled'}>${esc(t('wiz.needVerified'))}</button></div>`;
  } else if (w.step === 5) {
    const verified = w.dests.filter(d => d.status === 'verified');
    const domain = (verified[0]?.email || 'you@example.com').split('@')[1];
    body = `
      <div class="field"><label>${esc(t('wiz.rulePattern'))}</label><input id="wz-rule-pattern" value="*@${esc(domain)}"></div>
      <div class="field"><label>${esc(t('wiz.ruleAction'))}</label><select id="wz-rule-action"><option value="forward">${esc(t('rules.actionFwd'))}</option></select></div>
      <div class="field"><label>${esc(t('wiz.ruleTo'))}</label>
        <select id="wz-rule-dest">${verified.map(d => `<option value="${esc(d.email)}">${esc(d.email)}</option>`).join('')}</select>
      </div>
      <div class="wiz-nav"><button class="btn sec" id="wz-back">${esc(t('wiz.back'))}</button><button class="btn" id="wz-next">${esc(t('wiz.finish'))}</button></div>`;
  }
  const title = [t('wiz.s1'), t('wiz.s2'), t('wiz.s3'), t('wiz.s4'), t('wiz.s5')][w.step - 1];
  $('#app').innerHTML = `
    <div class="center-wrap"><div class="panel auth-card" style="width:min(500px,94vw);">
      <div class="logo-lg">${LOGO(40)}<h1>${esc(t('wiz.welcome'))}</h1></div>
      <div class="sub">${esc(t('wiz.sub'))}</div>
      <div class="wiz-steps">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= w.step ? 'on' : ''}"></span>`).join('')}</div>
      <div class="wiz-step-kicker">${esc(t('wiz.step'))} ${w.step} / 5</div>
      <div class="wiz-step-title">${esc(title)}</div>
      <div class="wiz-note"><div><b>${esc(t('wiz.why'))}</b><br>${esc(t('wiz.why' + w.step))}</div></div>
      <div class="wiz-note risk"><div><b>${esc(t('wiz.risk'))}</b><br>${esc(t('wiz.risk' + w.step))}</div></div>
      ${body}
    </div></div>`;

  const back = $('#wz-back');
  if (back) back.onclick = () => { w.step--; routes.setup(); };
  const next = $('#wz-next');
  if (next) next.onclick = async () => {
    try {
      next.disabled = true;
      if (w.step === 1) {
        w.token = $('#wz-token').value.trim();
        await api('/api/setup/verify', { method: 'POST', body: { token: w.token } });
        w.step = 2;
      } else if (w.step === 2) {
        w.username = $('#wz-user').value.trim();
        w.password = $('#wz-pass').value;
        await api('/api/setup', { method: 'POST', body: { token: w.token, username: w.username, password: w.password } });
        CFG = await api('/api/config');
        w.step = 3;
      } else if (w.step === 3) w.step = 4;
      else if (w.step === 4) w.step = 5;
      else if (w.step === 5) {
        await api('/api/rules', {
          method: 'POST',
          body: { pattern: $('#wz-rule-pattern').value.trim(), pattern_type: 'catchall', action: 'forward', destinations: [$('#wz-rule-dest').value] },
        });
        toast(t('wiz.done'), 'ok');
        location.hash = '#/mail';
        return;
      }
      routes.setup();
    } catch (e) {
      toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err');
      next.disabled = false;
    }
  };
  if (w.step === 4) {
    const renderDests = async () => {
      const r = await api('/api/destinations');
      w.dests = r.items;
      $('#wz-dest-list').innerHTML = r.items.length ? r.items.map(d => `
        <div class="row-card panel" style="padding:11px 14px;">
          <div class="row-main"><div class="row-title">${esc(d.email)}</div></div>
          ${d.status === 'verified'
            ? `<span class="badge ok"><i></i>${esc(t('wiz.verified'))}</span>`
            : `<button class="btn sm" data-verify="${d.id}">${esc(t('wiz.markVerified'))}</button><span class="badge warn"><i></i>${esc(t('wiz.pending'))}</span>`}
        </div>`).join('') : '';
      $('#wz-next').disabled = !r.items.some(d => d.status === 'verified');
      $('#wz-dest-list').querySelectorAll('[data-verify]').forEach(b => b.onclick = async () => {
        try { await api(`/api/destinations/${b.dataset.verify}/verify`, { method: 'POST' }); toast(t('dest.markedVerified'), 'ok'); renderDests(); }
        catch (e) { toast(e.message, 'err'); }
      });
    };
    renderDests();
    $('#wz-dest-add').onclick = async () => {
      try {
        const email = $('#wz-dest-email').value.trim();
        if (!email) return;
        await api('/api/destinations', { method: 'POST', body: { email } });
        $('#wz-dest-email').value = '';
        toast(t('common.add'), 'ok');
        renderDests();
      } catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err'); }
    };
  }
};

// =====================================================================
// 登录（astermail 风格：居中窄栏 · 大 logo · 密码可见切换 · 保持登录 · Turnstile）
// =====================================================================
routes.login = async function () {
  let challenge = { enabled: false, siteKey: null };
  try { challenge = await api('/api/auth/challenge'); } catch { /* 未初始化等情况 */ }
  let tsToken = '';

  $('#app').innerHTML = `
    <div class="center-wrap"><div class="login-col">
      <img class="login-logo" src="/icons/logo.png" alt="InboxFly" draggable="false">
      <h1 class="login-title">${esc(t('login.title'))}</h1>
      <div class="login-sub">${esc(t('login.subtitle'))}</div>
      <div class="lfield"><label>${esc(t('login.user'))}</label><input id="lg-user" autocomplete="username"></div>
      <div class="lfield">
        <label>${esc(t('login.pass'))}</label>
        <div class="pwrap">
          <input id="lg-pass" type="password" autocomplete="current-password">
          <button class="eye" id="lg-eye" type="button" title="👁">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <label class="check-row keep"><input type="checkbox" id="lg-remember" checked> ${esc(t('login.remember'))}</label>
      <div id="ts-box" class="ts-box" style="display:none;"></div>
      <button class="btn lg-btn" id="lg-go">${esc(t('login.go'))}</button>
      <div class="login-foot">
        <div class="lf-line1">
          <a href="https://inboxfly.email" target="_blank" rel="noopener">${esc(t('login.foot'))}</a>
        </div>
        <div class="lf-line2">
          <select id="lg-theme" title="${esc(t('theme.label'))}">
            <option value="glass">${esc(t('theme.glass'))}</option>
            <option value="min">${esc(t('theme.min'))}</option>
            <option value="play">${esc(t('theme.play'))}</option>
          </select>
          <select id="lg-lang" title="${esc(t('lang.label'))}">${langOptions(LANG)}</select>
          <button class="icon-btn mode-btn" title="${esc(t('mode.toggle'))}"></button>
        </div>
      </div>
    </div></div>`;

  // 密码可见性切换
  $('#lg-eye').onclick = () => {
    const p = $('#lg-pass');
    p.type = p.type === 'password' ? 'text' : 'password';
  };
  // 迷你外观/语言切换
  $('#lg-theme').value = document.documentElement.dataset.theme || 'glass';
  $('#lg-theme').onchange = () => setTheme($('#lg-theme').value);
  $('#lg-lang').value = LANG;
  $('#lg-lang').onchange = () => setLang($('#lg-lang').value);
  const lgMode = document.querySelector('.login-foot .mode-btn');
  if (lgMode) lgMode.onclick = () => toggleMode();
  applyMode(); // 填充模式按钮图标

  // Turnstile（后台开启时）
  if (challenge.enabled && challenge.siteKey) {
    const box = $('#ts-box');
    box.style.display = 'flex';
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.onload = res;
        s.onerror = () => rej(new Error('load'));
        document.head.appendChild(s);
      });
      window.turnstile.render('#ts-box', {
        sitekey: challenge.siteKey,
        theme: getMode() === 'dark' ? 'dark' : 'light',
        callback: tk => { tsToken = tk; },
        'expired-callback': () => { tsToken = ''; },
      });
    } catch {
      box.innerHTML = `<div class="muted">Turnstile ${esc(t('common.loading'))}</div>`;
    }
  }

  const go = async () => {
    try {
      $('#lg-go').disabled = true;
      await api('/api/auth/login', {
        method: 'POST',
        body: {
          username: $('#lg-user').value.trim(),
          password: $('#lg-pass').value,
          remember: $('#lg-remember').checked,
          turnstile_token: tsToken,
        },
      });
      location.hash = '#/mail';
    } catch (e) {
      toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err');
      $('#lg-go').disabled = false;
      // Turnstile token 一次性：失败后重置组件
      if (e.message === 'turnstile_failed' && window.turnstile && challenge.enabled) {
        try { window.turnstile.reset('#ts-box'); tsToken = ''; } catch { /* ignore */ }
      }
    }
  };
  $('#lg-go').onclick = go;
  document.addEventListener('keydown', function onEnter(e) {
    if (e.key === 'Enter' && location.hash === '#/login') { document.removeEventListener('keydown', onEnter); go(); }
  });
};

// =====================================================================
// 邮件页（§6）
// =====================================================================
routes.mail = async function () {
  const state = {
    domain: MAIL_QUERY.get('domain') || 'all',
    status: 'all', q: '', page: 1, items: [], total: 0, sel: null,
    selIds: new Set(),
  };

  $('#head-extra').innerHTML = `<button class="icon-btn" id="ml-layout" title="${esc(t('mail.layoutToggle'))}">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>
  </button>`;
  $('#ml-layout').onclick = () => {
    setLayout(getLayout() === 'sidebar' ? 'top' : 'sidebar'); // 切换侧边栏 ⇄ 页眉模式
  };

  $('#content').innerHTML = `
    <div class="mail-layout">
      <div class="panel list-panel">
        <div class="toolbar">
          <div class="search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="ml-q" placeholder="${esc(t('mail.search'))}"></div>
          <button class="icon-btn" id="ml-refresh" title="${esc(t('mail.refresh'))}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>
          </button>
          <button class="btn sm" id="ml-sim" title="dev">${esc(t('mail.sim'))}</button>
          <button class="btn danger sm" id="ml-batch" style="display:none;"></button>
        </div>
        <div class="toolbar" id="ml-domains"></div>
        <div class="toolbar" id="ml-status">
          <span class="chip on" data-st="all">${esc(t('mail.allStatus'))}</span>
          <span class="chip" data-st="forwarded">${esc(t('st.forwarded'))}</span>
          <span class="chip" data-st="blocked">${esc(t('st.blocked'))}</span>
          <span class="chip" data-st="dropped">${esc(t('st.dropped'))}</span>
          <span class="chip" data-st="rejected">${esc(t('st.rejected'))}</span>
          <span class="chip" data-st="error">${esc(t('st.error'))}</span>
        </div>
        <div id="ml-list"></div>
        <div style="text-align:center;margin-top:10px;"><button class="btn sec sm" id="ml-more" style="display:none;"></button></div>
      </div>
      <div class="panel detail-panel" id="ml-detail"><div class="empty">${esc(t('mail.pick'))}</div></div>
    </div>`;

  const loadDomains = async () => {
    const r = await api('/api/domains');
    $('#ml-domains').innerHTML = `<span class="chip ${state.domain === 'all' ? 'on' : ''}" data-dm="all">${esc(t('mail.allDomains'))}</span>` +
      r.items.map(d => `<span class="chip ${state.domain === d.domain ? 'on' : ''}" data-dm="${esc(d.domain)}">${esc(d.domain)}${d.emails ? ` · ${d.emails}` : ''}</span>`).join('');
    $('#ml-domains').querySelectorAll('[data-dm]').forEach(ch => ch.onclick = () => {
      state.domain = ch.dataset.dm; state.page = 1; state.items = [];
      $('#ml-domains').querySelectorAll('[data-dm]').forEach(x => x.classList.toggle('on', x.dataset.dm === state.domain));
      loadList(true);
    });
  };

  const loadList = async (reset) => {
    const p = new URLSearchParams({ page: state.page, size: 20 });
    if (state.domain !== 'all') p.set('domain', state.domain);
    if (state.status !== 'all') p.set('status', state.status);
    if (state.q) p.set('q', state.q);
    const r = await api('/api/emails?' + p);
    state.items = reset ? r.items : state.items.concat(r.items);
    state.total = r.total;
    const list = $('#ml-list');
    if (!state.items.length) {
      list.innerHTML = `<div class="empty">${esc(t('mail.empty'))}<br><br>${esc(t('mail.emptyHint'))}</div>`;
    } else {
      list.innerHTML = state.items.map(m => `
        <div class="mail-item ${state.sel === m.id ? 'sel' : ''} ${!m.is_read ? 'unread' : ''}" data-id="${m.id}">
          <input type="checkbox" class="ml-chk" data-id="${m.id}" ${state.selIds.has(m.id) ? 'checked' : ''} title="${esc(t('common.delete'))}">
          <span class="unread-dot ${m.is_read ? '' : 'on'}" title="${esc(t('mail.unread'))}"></span>
          <div class="ava" style="background:${avaColor(m.from_addr)};">${esc((m.from_name || m.from_addr || '?')[0].toUpperCase())}</div>
          <div class="mail-mid">
            <div class="mail-top"><span class="from">${esc(m.from_name || m.from_addr || '(?)')}</span><span class="time">${fmtTime(m.received_at)}</span></div>
            <div class="subj">${esc(m.subject || '')}</div>
            <div class="prev">${esc(m.body_preview || '')}</div>
          </div>
          ${badge(m.status)}
        </div>`).join('');
      list.querySelectorAll('.mail-item').forEach(el => el.onclick = () => selectMail(el.dataset.id));
      list.querySelectorAll('.ml-chk').forEach(chk => chk.onclick = e => {
        e.stopPropagation();
        if (chk.checked) state.selIds.add(chk.dataset.id); else state.selIds.delete(chk.dataset.id);
        updateBatchBtn();
      });
    }
    const more = $('#ml-more');
    more.style.display = state.items.length < state.total ? '' : 'none';
    more.textContent = `${t('mail.more')}（${state.items.length}/${state.total}）`;
  };

  const updateBatchBtn = () => {
    const b = $('#ml-batch');
    b.style.display = state.selIds.size ? '' : 'none';
    b.textContent = tf('mail.deleteSelected', { n: state.selIds.size });
  };
  $('#ml-batch').onclick = async () => {
    if (!state.selIds.size) return;
    if (!confirm(tf('mail.batchConfirm', { n: state.selIds.size }))) return;
    try {
      const r = await api('/api/emails/batch-delete', { method: 'POST', body: { ids: [...state.selIds] } });
      toast(tf('mail.batchDone', { n: r.deleted }), 'ok');
      state.selIds.clear(); state.sel = null;
      $('#ml-detail').innerHTML = `<div class="empty">${esc(t('mail.pick'))}</div>`;
      await Promise.all([loadList(true), loadSideDomains()]);
    } catch (e) { toast(e.message, 'err'); }
  };

  // 未读徽章：导航「邮件」项 + 45s 轮询
  async function updateUnread() {
    try {
      const r = await api('/api/emails/unread-count');
      const n = r.unread;
      document.querySelectorAll('[data-badge="mail"]').forEach(b => {
        b.textContent = n > 0 ? (n > 99 ? '99+' : n) : '';
        b.style.display = n > 0 ? '' : 'none';
      });
    } catch { /* 轮询失败静默 */ }
  }
  const unreadTimer = setInterval(updateUnread, 45000);
  window.addEventListener('beforeunload', () => clearInterval(unreadTimer));
  await updateUnread();

  // 配额预警（§11）：R2 估算接近免费上限时提示切换仅元数据
  const checkStorageBanner = async () => {
    try {
      const s = await api('/api/stats/summary');
      const list = document.querySelector('.list-panel');
      if (!list || list.querySelector('.r2-banner')) return;
      if (s.r2_estimate_30d > 9 * 1024 ** 3 && CFG.storage_mode !== 'metadata_only') {
        const div = document.createElement('div');
        div.className = 'r2-banner';
        div.innerHTML = `⚠ ${esc(tf('set.r2Warn', { size: fmtBytes(s.r2_estimate_30d) }))} <button class="btn sm" id="r2-meta">${esc(t('set.switchMeta'))}</button>`;
        list.prepend(div);
        $('#r2-meta').onclick = async () => {
          try {
            await api('/api/config', { method: 'PATCH', body: { storage_mode: 'metadata_only' } });
            CFG = await api('/api/config');
            toast(t('set.storageNowMeta'), 'ok');
            div.remove();
          } catch (e) { toast(e.message, 'err'); }
        };
      }
    } catch { /* 统计不可用不阻塞列表 */ }
  };

  const selectMail = async (id) => {
    state.sel = id;
    $('#ml-list').querySelectorAll('.mail-item').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
    // 标记已读 + 行样式即时更新
    try {
      const r = await api(`/api/emails/${id}/read`, { method: 'POST' });
      if (r.changed) {
        const row = $('#ml-list').querySelector(`.mail-item[data-id="${id}"]`);
        if (row) { row.classList.remove('unread'); row.querySelector('.unread-dot')?.classList.remove('on'); }
        await updateUnread();
      }
    } catch { /* 已读标记失败不阻断 */ }
    const box = $('#ml-detail');
    box.innerHTML = `<div class="empty">${esc(t('common.loading'))}</div>`;
    try {
      const m = await api('/api/emails/' + id);
      const perDest = m.per_destination || [];
      box.innerHTML = `
        <div class="d-subj">${esc(m.subject || '')}</div>
        <div class="d-meta">
          <b style="color:var(--text);">${esc(m.from_name || m.from_addr || '')}</b>
          ${m.from_addr ? `&lt;${esc(m.from_addr)}&gt;` : ''} · ${esc(safeParse(m.to_addrs_json, []).join(', '))} · ${fmtTime(m.received_at)}
          ${badge(m.status)}
        </div>
        <div class="d-meta muted">
          ${m.rule_id ? esc(m.rule_id) : esc(t('mail.defaultFwd'))} · ${fmtBytes(m.size_bytes)}
          ${perDest.length ? ' · ' + perDest.map(p => `${esc(p.to)} ${p.ok ? '✓' : '✗'}`).join(' / ') : ''}
          ${m.blocked_reason ? ' · ' + esc(m.blocked_reason) : ''}
        </div>
        <div class="d-actions">
          ${m.raw_r2_key ? `<a class="btn sec sm" href="/api/emails/${id}/raw">${esc(t('mail.raw'))}</a>` : ''}
          <button class="btn danger sm" id="ml-del">${esc(t('common.delete'))}</button>
        </div>
        ${m.attachments && m.attachments.length ? `<div class="att-chips">${m.attachments.map(a =>
          `<a class="att-chip" href="/api/emails/${id}/attachments/${a.id}" download>📎 ${esc(a.filename)} · ${fmtBytes(a.size_bytes)}</a>`).join('')}</div>` : ''}
        <div class="d-body" id="ml-body"><div class="empty">${esc(t('common.loading'))}</div></div>`;
      $('#ml-del').onclick = async () => {
        if (!confirm(t('mail.deleteConfirm'))) return;
        await api('/api/emails/' + id, { method: 'DELETE' });
        toast(t('mail.deleted'), 'ok');
        state.sel = null;
        box.innerHTML = `<div class="empty">${esc(t('mail.pick'))}</div>`;
        loadList(true);
      };
      if (m.body_html_r2_key) {
        const h = await api(`/api/emails/${id}/html`);
        const f = document.createElement('iframe');
        f.setAttribute('sandbox', 'allow-same-origin'); // 读取内容高度；脚本仍被沙箱禁用
        f.setAttribute('csp', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
        f.srcdoc = h.html || t('mail.noHtml');
        f.onload = () => {
          try {
            const hh = f.contentDocument?.documentElement?.scrollHeight;
            if (hh) f.style.height = Math.min(Math.max(hh + 24, 160), 2400) + 'px';
          } catch { /* 跨域降级保持默认高度 */ }
        };
        $('#ml-body').replaceChildren(f);
      } else if (m.body_text_r2_key) {
        const tx = await api(`/api/emails/${id}/text`);
        $('#ml-body').innerHTML = `
          <div class="d-meta muted" style="margin:14px 0 4px;">${esc(t('mail.textBody'))}</div>
          <div class="body-ph" style="white-space:pre-wrap;">${esc(tx.text || '')}</div>`;
      } else {
        $('#ml-body').innerHTML = `<div class="empty">${esc(t('mail.metaOnly'))}</div>`;
      }
      if (window.innerWidth <= 1020) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      box.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  };

  const qInput = $('#ml-q');
  let deb;
  qInput.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(() => { state.q = qInput.value.trim(); state.page = 1; loadList(true); }, 300);
  });
  $('#ml-status').querySelectorAll('[data-st]').forEach(ch => ch.onclick = () => {
    state.status = ch.dataset.st; state.page = 1; state.items = [];
    $('#ml-status').querySelectorAll('[data-st]').forEach(x => x.classList.toggle('on', x.dataset.st === state.status));
    loadList(true);
  });
  $('#ml-more').onclick = () => { state.page++; loadList(false); };
  $('#ml-refresh').onclick = async () => { try { await Promise.all([loadList(true), updateUnread()]); toast(t('mail.refreshed'), 'ok'); } catch (e) { toast(e.message, 'err'); } };
  $('#ml-sim').onclick = async () => {
    try {
      $('#ml-sim').disabled = true;
      const r = await api('/api/dev/simulate', { method: 'POST', body: { count: 5 } });
      toast(tf('mail.simDone', { n: r.created }), 'ok');
      await Promise.all([loadList(true), loadDomains(), loadSideDomains()]);
    } catch (e) { toast(e.message, 'err'); } finally { $('#ml-sim').disabled = false; }
  };

  await Promise.all([loadList(true), loadDomains(), loadSideDomains(), checkStorageBanner()]);
};

function avaColor(seed) {
  const colors = [['#5e5ce6', '#bf5af2'], ['#0a84ff', '#64d2ff'], ['#ff9f0a', '#ff375f'], ['#30d158', '#64d2ff'], ['#ff5c1a', '#ff4d6b']];
  let h = 0;
  for (const c of String(seed || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = colors[h % colors.length];
  return `linear-gradient(135deg,${a},${b})`;
}
function safeParse(s, d) { try { const v = JSON.parse(s); return v ?? d; } catch { return d; } }

// =====================================================================
// 规则页（§4 · 对齐 CF 邮件路由页：概览摘要 + 统一规则表 + 全收兜底行）
const actionChips = rule => {
  if (rule.action === 'forward') {
    return `<span class="act-chip">📨 ${esc(t('rules.forward'))} → ${rule.destinations.map(esc).join(' / ') || esc(t('rules.noDest'))}</span>`;
  }
  if (rule.action === 'block') {
    return `<span class="act-chip">↩ ${esc(t('rules.block'))} <span class="enh-tag">${esc(t('rules.enhanced'))}</span></span>`;
  }
  return `<span class="act-chip">🗑 ${esc(t('rules.blackhole'))}</span>`;
};

routes.rules = async function () {
  const load = async () => {
    const [r, d, doms] = await Promise.all([api('/api/rules'), api('/api/destinations'), api('/api/domains')]);
    const dests = d.items;
    const verified = dests.filter(x => x.status === 'verified');
    const erOk = doms.items.some(x => x.email_routing === true);
    const erDomains = doms.items.map(x => x.domain);
    const groups = {
      exact: r.items.filter(x => x.pattern_type === 'exact'),
      catchall: r.items.filter(x => x.pattern_type === 'catchall'),
    };
    const stats = r.stats || {};
    const defStats = r.defaultStats || { total: 0, today: 0 };
    const totalToday = Object.values(stats).reduce((a, b) => a + (b.today || 0), 0) + (defStats.today || 0);

    const rowHtml = rule => `
      <tr>
        <td class="rc-name">
          <span class="code">${esc(rule.pattern)}</span>
          <div class="row-sub">
            ${esc(rule.pattern_type === 'exact' ? t('rules.exact') : t('rules.catchall'))}
            ${(rule.filters.from_blacklist || []).length ? ' · ' + esc(tf('rules.blacklist', { n: rule.filters.from_blacklist.length })) : ''}
            ${rule.filters.subject_regex ? ' · ' + esc(t('rules.regex')) : ''}
            ${rule.filters.max_size_mb ? ' · ≤' + rule.filters.max_size_mb + 'MB' : ''}
          </div>
        </td>
        <td data-l="${esc(t('rules.tblAction'))}">${actionChips(rule)}</td>
        <td class="rc-stat" data-l="${esc(t('rules.tblStats'))}">${stats[rule.id] ? esc(tf('rules.statLine', { total: stats[rule.id].total, today: stats[rule.id].today })) : '<span class="muted">—</span>'}</td>
        <td data-l="${esc(t('rules.tblStatus'))}">
          <label class="sw" style="width:38px;height:22px;" title="${esc(t('rules.enabled'))}">
            <input type="checkbox" data-toggle="${rule.id}" ${rule.enabled ? 'checked' : ''}>
            <span class="tr" style="border-radius:999px;"></span>
            <span class="kn" style="width:17px;height:17px;"></span>
          </label>
        </td>
        <td class="rc-actions" data-l="">
          <button class="icon-btn" data-edit="${rule.id}">${esc(t('common.edit'))}</button>
          <button class="icon-btn" data-del="${rule.id}">${esc(t('common.delete'))}</button>
        </td>
      </tr>`;

    // 全收兜底行（对齐 CF 的 catch-all 规则行）
    const fa = CFG.default_action || 'forward_default';
    const catchAllAction = fa === 'forward_default' && CFG.default_forward
      ? `<span class="act-chip">📨 ${esc(t('rules.forward'))} → ${esc(CFG.default_forward)}</span>`
      : fa === 'reject'
        ? '<span class="act-chip">↩ ' + esc(t('set.fa_rej')) + '</span>'
        : '<span class="act-chip">🗑 ' + esc(t('set.fa_drop')) + '</span>';

    $('#content').innerHTML = `
      <div class="layer-note">${esc(t('rules.layerNote'))}</div>
      <div class="stat-cards" style="margin-bottom:16px;">
        <div class="panel stat-card"><div class="num">${erOk ? '✓' : '⚠'}</div><div class="cap">${esc(t('rules.ovEmailRouting'))}</div></div>
        <div class="panel stat-card"><div class="num">${esc(t('rules.ovDnsOk'))}</div><div class="cap">${esc(t('rules.ovDns'))}</div></div>
        <div class="panel stat-card"><div class="num">${verified.length}</div><div class="cap">${esc(t('nav.dest'))}</div></div>
        <div class="panel stat-card"><div class="num">${r.items.length}</div><div class="cap">${esc(t('nav.rules'))}</div></div>
        <div class="panel stat-card"><div class="num">${totalToday}</div><div class="cap">${esc(t('rules.todayHandled'))}</div></div>
      </div>
      <div class="panel" style="padding:16px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
          <h3 style="font-size:15px;font-weight:700;margin-right:auto;">${esc(t('rules.tblTitle'))}</h3>
          <button class="btn" id="rule-add">${esc(t('rules.new'))}</button>
        </div>
        <div class="rules-scroll"><table class="rules-table">
          <thead><tr><th>${esc(t('rules.tblRule'))}</th><th>${esc(t('rules.tblAction'))}</th><th>${esc(t('rules.tblStats'))}</th><th>${esc(t('rules.tblStatus'))}</th><th></th></tr></thead>
          <tbody>
            ${groups.exact.map(rowHtml).join('') || `<tr><td colspan="5" class="muted" style="padding:10px 12px;">${esc(t('rules.exactGroup'))} · ${esc(t('rules.none'))}</td></tr>`}
            ${groups.catchall.map(rowHtml).join('') || `<tr><td colspan="5" class="muted" style="padding:10px 12px;">${esc(t('rules.catchGroup'))} · ${esc(t('rules.none'))}</td></tr>`}
            <tr class="catchall-row">
              <td class="rc-name">
                <span class="code">📌 ${esc(t('rules.catchallRow'))}</span>
                <div class="row-sub">${esc(t('rules.catchallDesc'))}</div>
              </td>
              <td data-l="${esc(t('rules.tblAction'))}">${catchAllAction}</td>
              <td class="rc-stat" data-l="${esc(t('rules.tblStats'))}">${esc(tf('rules.statLine', { total: defStats.total, today: defStats.today }))}</td>
              <td data-l="${esc(t('rules.tblStatus'))}"><span class="badge ok"><i></i>${esc(t('rules.alwaysOn'))}</span></td>
              <td class="rc-actions" data-l=""><button class="icon-btn" id="catchall-edit">${esc(t('common.edit'))}</button></td>
            </tr>
          </tbody>
        </table></div>
      </div>`;

    const verifiedList = verified;
    $('#rule-add').onclick = () => openRuleModal(null, verifiedList, erDomains, load);

    $('#content').querySelectorAll('[data-toggle]').forEach(el => el.addEventListener('change', async () => {
      try { await api('/api/rules/' + el.dataset.toggle, { method: 'PATCH', body: { enabled: el.checked } }); toast(el.checked ? t('rules.enabled') : t('rules.disabled'), 'ok'); }
      catch (e) { toast(e.message, 'err'); load(); }
    }));
    $('#content').querySelectorAll('[data-del]').forEach(el => el.onclick = async () => {
      if (!confirm(t('rules.deleteConfirm'))) return;
      try { await api('/api/rules/' + el.dataset.del, { method: 'DELETE' }); toast(t('rules.deleted'), 'ok'); load(); }
      catch (e) { toast(e.message, 'err'); }
    });
    $('#content').querySelectorAll('[data-edit]').forEach(el => el.onclick = () => {
      openRuleModal(r.items.find(x => x.id === el.dataset.edit), verifiedList, erDomains, load);
    });
    $('#catchall-edit').onclick = () => openCatchAllModal(load);
  };
  await load();
};

// 全收（Catch-all）兜底编辑：对齐 CF 的 catch-all 编辑（默认动作 + 兜底地址 + 筛选拦截处理）
function openCatchAllModal(onSaved) {
  const fa = CFG.default_action || 'forward_default';
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="panel modal">
      <h3>📌 ${esc(t('rules.catchallRow'))}</h3>
      <div class="hint" style="margin:-8px 0 14px;">${esc(t('rules.catchallDesc'))}</div>
      <div class="field"><label>${esc(t('set.defaultAction'))}</label>
        <select id="ca-action">
          <option value="forward_default" ${fa === 'forward_default' ? 'selected' : ''}>${esc(t('set.fa_fwd'))}</option>
          <option value="reject" ${fa === 'reject' ? 'selected' : ''}>${esc(t('set.fa_rej'))}</option>
          <option value="drop" ${fa === 'drop' ? 'selected' : ''}>${esc(t('set.fa_drop'))}</option>
        </select></div>
      <div class="field" id="ca-fw-field"><label>${esc(t('set.defaultForward'))}</label>
        <select id="ca-forward"><option value="">${esc(t('set.none'))}</option></select></div>
      <div class="field"><label>${esc(t('set.blockedAction'))}</label>
        <select id="ca-blocked">
          <option value="drop" ${CFG.blocked_mail_action === 'drop' ? 'selected' : ''}>${esc(t('set.drop'))}</option>
          <option value="reject" ${CFG.blocked_mail_action === 'reject' ? 'selected' : ''}>${esc(t('set.reject'))}</option>
        </select></div>
      <div class="modal-foot">
        <button class="btn sec" id="ca-cancel">${esc(t('common.cancel'))}</button>
        <button class="btn" id="ca-save">${esc(t('common.save'))}</button>
      </div>
    </div>`;
  document.body.appendChild(mask);
  const fillDests = async () => {
    try {
      const d = await api('/api/destinations');
      const v = d.items.filter(x => x.status === 'verified');
      $('#ca-forward', mask).innerHTML = `<option value="">${esc(t('set.none'))}</option>` +
        v.map(x => `<option value="${esc(x.email)}" ${CFG.default_forward === x.email ? 'selected' : ''}>${esc(x.email)}</option>`).join('');
    } catch { /* ignore */ }
  };
  fillDests();
  const syncFw = () => { $('#ca-fw-field', mask).style.display = $('#ca-action', mask).value === 'forward_default' ? '' : 'none'; };
  $('#ca-action', mask).addEventListener('change', syncFw);
  syncFw();
  $('#ca-cancel', mask).onclick = () => mask.remove();
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
  $('#ca-save', mask).onclick = async () => {
    try {
      await api('/api/config', {
        method: 'PATCH',
        body: {
          default_action: $('#ca-action', mask).value,
          default_forward: $('#ca-forward', mask).value,
          blocked_mail_action: $('#ca-blocked', mask).value,
        },
      });
      CFG = await api('/api/config');
      toast(t('set.saved'), 'ok');
      mask.remove();
      onSaved();
    } catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err'); }
  };
}


// 创建/编辑路由规则弹窗（严格对齐 CF 原生表单：电子邮件匹配模式 + 操作）
function openRuleModal(rule, dests, erDomains, onSaved) {
  const isNew = !rule;
  const f = rule?.filters || {};
  let prefix = '', domain = erDomains[0] || '';
  if (rule) {
    if (rule.pattern_type === 'exact') { const [p, dm] = rule.pattern.split('@'); prefix = p; domain = dm; }
    else domain = rule.pattern.replace(/^\*\@/, '');
  }
  const domainOpts = erDomains.length ? erDomains : [domain].filter(Boolean);
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="panel modal" style="width:min(680px,94vw);">
      <h3>${esc(isNew ? t('rules.createTitle') : t('rules.editTitle'))}</h3>
      <div class="hint" style="margin:-6px 0 18px;">${esc(t('rules.createSub'))}</div>
      <div class="field"><label>${esc(t('rules.matchLabel'))}</label>
        <div style="display:flex;align-items:stretch;">
          <input id="rf-prefix" placeholder="info" value="${esc(prefix)}" autocomplete="off"
            style="flex:1;min-width:0;padding:11px 13px;border:1px solid var(--field-bd);background:var(--field-bg);color:var(--text);font-size:14px;outline:none;border-radius:12px 0 0 12px;text-align:right;">
          <span style="display:grid;place-items:center;padding:0 14px;background:var(--field-bg);border-top:1px solid var(--field-bd);border-bottom:1px solid var(--field-bd);font-weight:700;font-size:15px;">@</span>
          <select id="rf-domain" style="width:190px;padding:11px 12px;border:1px solid var(--field-bd);background:var(--field-bg);color:var(--text);font-size:14px;outline:none;border-radius:0 12px 12px 0;">
            ${domainOpts.map(dm => `<option value="${esc(dm)}" ${dm === domain ? 'selected' : ''}>${esc(dm)}</option>`).join('')}
          </select>
        </div>
        <div class="hint">${esc(t('rules.matchHint'))}</div>
      </div>
      <div class="field"><label>${esc(t('rules.actionLabel'))}</label>
        <select id="rf-action">
          <option value="forward" ${rule?.action === 'forward' || !rule ? 'selected' : ''}>${esc(t('rules.actFwdShort'))}</option>
          <option value="blackhole" ${rule?.action === 'blackhole' ? 'selected' : ''}>${esc(t('rules.actDropShort'))}</option>
          <option value="block" ${rule?.action === 'block' ? 'selected' : ''}>${esc(t('rules.actBlockShort'))}</option>
        </select>
        <div class="hint" style="line-height:1.7;">
          ${esc(t('rules.actFwdDesc'))}<br>${esc(t('rules.actDropDesc'))}<br>${esc(t('rules.actBlockDesc'))}
        </div></div>
      <div class="field" id="rf-dest-field"><label>${esc(t('dest.pickDest'))}</label>
        ${dests.length ? dests.map(x => `
          <label class="check-row"><input type="checkbox" value="${esc(x.email)}" ${rule?.destinations?.includes(x.email) ? 'checked' : ''}> ${esc(x.email)}</label>`).join('')
          : `<div class="hint">${esc(t('rules.noVerified'))}</div>`}
      </div>
      <details style="margin:6px 0 0;">
        <summary style="cursor:pointer;font-size:13px;font-weight:620;color:var(--text-2);">${esc(t('rules.advFilters'))}</summary>
        <div class="field" style="margin-top:12px;"><label>${esc(t('rules.blacklistLabel'))}</label>
          <textarea id="rf-blacklist" placeholder="${esc(t('rules.blacklistPh'))}">${esc((f.from_blacklist || []).join('\n'))}</textarea></div>
        <div class="field"><label>${esc(t('rules.regexLabel'))}</label><input id="rf-regex" value="${esc(f.subject_regex || '')}" placeholder="${esc(t('rules.regexPh'))}"></div>
        <div class="field"><label>${esc(t('rules.sizeLabel'))}</label><input id="rf-size" type="number" min="1" max="25" value="${f.max_size_mb ?? ''}"></div>
        <div class="field"><label>${esc(t('rules.attLabel'))}</label>
          <select id="rf-att">
            <option value="any" ${f.has_attachment === undefined ? 'selected' : ''}>${esc(t('rules.attAny'))}</option>
            <option value="yes" ${f.has_attachment === true ? 'selected' : ''}>${esc(t('rules.attYes'))}</option>
            <option value="no" ${f.has_attachment === false ? 'selected' : ''}>${esc(t('rules.attNo'))}</option>
          </select></div>
      </details>
      <div class="modal-foot">
        <button class="btn sec" id="rf-cancel">${esc(t('common.cancel'))}</button>
        <button class="btn" id="rf-save">${esc(isNew ? t('common.add') : t('common.save'))}</button>
      </div>
    </div>`;
  document.body.appendChild(mask);
  const $m = sel => mask.querySelector(sel);
  const syncDestVisibility = () => { $m('#rf-dest-field').style.display = $m('#rf-action').value === 'forward' ? '' : 'none'; };
  $m('#rf-action').addEventListener('change', syncDestVisibility);
  syncDestVisibility();
  const close = () => mask.remove();
  $m('#rf-cancel').onclick = close;
  mask.addEventListener('click', e => { if (e.target === mask) close(); });
  $m('#rf-save').onclick = async () => {
    const action = $m('#rf-action').value;
    const body = {
      pattern: $m('#rf-prefix').value.trim() ? $m('#rf-prefix').value.trim() + '@' + $m('#rf-domain').value : '*@' + $m('#rf-domain').value,
      pattern_type: $m('#rf-prefix').value.trim() ? 'exact' : 'catchall',
      action,
      destinations: action === 'forward' ? [...mask.querySelectorAll('#rf-dest-field input:checked')].map(x => x.value) : [],
      filters: {
        from_blacklist: $m('#rf-blacklist').value.split('\n').map(x => x.trim()).filter(Boolean),
        subject_regex: $m('#rf-regex').value.trim(),
        max_size_mb: $m('#rf-size').value || null,
        has_attachment: { any: null, yes: true, no: false }[$m('#rf-att').value],
      },
      enabled: rule ? rule.enabled : true,
    };
    try {
      if (isNew) await api('/api/rules', { method: 'POST', body });
      else await api('/api/rules/' + rule.id, { method: 'PATCH', body });
      toast(isNew ? t('rules.created') : t('rules.saved'), 'ok');
      close();
      onSaved();
    } catch (e) {
      toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err');
    }
  };
}

// =====================================================================
// 目标地址页（§3.3）
// =====================================================================
routes.destinations = async function () {
  const load = async () => {
    const r = await api('/api/destinations');
    $('#content').innerHTML = `
      <div class="card-list">
        <div style="display:flex;gap:8px;">
          <input id="dst-email" placeholder="${esc(t('dest.addPh'))}" style="flex:1;padding:9px 12px;border-radius:var(--r-item);
            border:1px solid var(--field-bd);background:var(--field-bg);color:var(--text);outline:none;font-size:13.5px;">
          <button class="btn" id="dst-add">${esc(t('common.add'))}</button>
        </div>
        <div class="muted">${esc(CFG.cf_api_token_set ? t('dest.flowAuto') : t('dest.flowManual'))}</div>
        <div id="dst-list" class="card-list" style="gap:10px;">
          ${r.items.length ? r.items.map(d => `
            <div class="row-card panel">
              <div class="row-main"><div class="row-title">${esc(d.email)}</div>
                <div class="row-sub">${esc(tf('dest.verifiedAt', { a: fmtTime(d.created_at), b: d.verified_at ? fmtTime(d.verified_at) : '—', s: t('dest.' + (d.source === 'api' ? 'api' : 'manual')) }))}</div></div>
              ${d.status === 'verified'
                ? `<span class="badge ok"><i></i>${esc(t('wiz.verified'))}</span>${CFG.default_forward === d.email ? `<span class="badge info"><i></i>${esc(t('dest.fallback'))}</span>` : ''}`
                : `<button class="btn sm" data-verify="${d.id}">${esc(t('wiz.markVerified'))}</button><span class="badge warn"><i></i>${esc(t('wiz.pending'))}</span>`}
              <button class="icon-btn" data-del="${d.id}">${esc(t('common.delete'))}</button>
            </div>`).join('') : `<div class="empty">${esc(t('dest.empty'))}</div>`}
        </div>
      </div>`;
    $('#dst-add').onclick = async () => {
      try {
        const email = $('#dst-email').value.trim();
        if (!email) return;
        // 与 Cloudflare 默认操作一致：添加后自动发送确认邮件，收件人点击后状态自动回同步
        if (CFG.cf_api_token_set) {
          await api('/api/destinations/cf', { method: 'POST', body: { email } });
          toast(t('dest.cfAdded'), 'ok');
        } else {
          await api('/api/destinations', { method: 'POST', body: { email } });
          toast(t('dest.manualAdded'), 'ok');
        }
        $('#dst-email').value = '';
        load();
      } catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err'); }
    };
    $('#content').querySelectorAll('[data-verify]').forEach(b => b.onclick = async () => {
      try { await api(`/api/destinations/${b.dataset.verify}/verify`, { method: 'POST' }); toast(t('dest.markedVerified'), 'ok'); load(); }
      catch (e) { toast(e.message, 'err'); }
    });
    $('#content').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm(t('dest.deleteConfirm'))) return;
      try { await api(`/api/destinations/${b.dataset.del}`, { method: 'DELETE' }); toast(t('common.delete'), 'ok'); load(); }
      catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err'); }
    });
  };
  await load();
};

// =====================================================================
// 统计页（§7 处理状态口径）
// =====================================================================
routes.stats = async function () {
  const [sum, daily] = await Promise.all([api('/api/stats/summary'), api('/api/stats/daily?days=14')]);
  const t2 = sum.totals;
  const max = Math.max(1, ...daily.items.map(d => d.forwarded + d.blocked + d.dropped + d.rejected + d.error));
  const segs = [
    ['forwarded', 'var(--st-ok-fg)', 'st.ok'], ['blocked', 'var(--st-warn-fg)', 'st.warn'],
    ['dropped', 'var(--st-mute-fg)', 'st.mute'], ['rejected', 'var(--st-err-fg)', 'st.err'], ['error', 'var(--st-info-fg)', 'st.info'],
  ];
  $('#content').innerHTML = `
    <div class="stat-cards">
      <div class="panel stat-card"><div class="num">${t2.forwarded}</div><div class="cap">${esc(t('st.forwarded'))}</div></div>
      <div class="panel stat-card"><div class="num">${t2.blocked}</div><div class="cap">${esc(t('st.blocked'))}</div></div>
      <div class="panel stat-card"><div class="num">${t2.dropped}</div><div class="cap">${esc(t('st.dropped'))}</div></div>
      <div class="panel stat-card"><div class="num">${t2.rejected}</div><div class="cap">${esc(t('st.rejected'))}</div></div>
      <div class="panel stat-card"><div class="num">${t2.error}</div><div class="cap">${esc(t('st.error'))}</div></div>
      <div class="panel stat-card"><div class="num">${fmtBytes(t2.bytes)}</div><div class="cap">${esc(t('stats.bytes'))}</div></div>
    </div>
    <div class="panel bars-panel">
      <div style="font-size:13px;font-weight:650;margin-bottom:14px;">${esc(t('stats.chart'))}</div>
      <div class="bars">${daily.items.map(d => {
        const total = d.forwarded + d.blocked + d.dropped + d.rejected + d.error;
        return `<div class="bar" title="${d.date}：${segs.map(([k]) => `${t(k)} ${d[k]}`).join(' / ')}">
          ${segs.map(([k, c]) => total ? `<span class="seg" style="height:${(d[k] / max) * 100}%;background:${c};opacity:.85;"></span>` : '').join('')}
          <span class="lbl">${d.date.slice(5)}</span></div>`;
      }).join('')}</div>
      <div class="legend">${segs.map(([k, , lk]) => `<em><i style="background:var(--${lk}-fg);"></i>${esc(t(k))}</em>`).join('')}</div>
      <div class="muted" style="margin-top:10px;">${esc(t('stats.note'))}</div>
    </div>
    <div class="card-list" style="margin-top:16px;max-width:960px;">
      <h3 style="font-size:13px;color:var(--text-2);">${esc(t('stats.byDomain'))}</h3>
      ${sum.byDomain.length ? sum.byDomain.map(d => `
        <div class="row-card panel" style="padding:12px 16px;">
          <div class="row-main"><div class="row-title">${esc(d.domain)}</div></div>
          <span class="badge ok"><i></i>${esc(t('st.forwarded'))} ${d.forwarded}</span>
          <span class="badge warn"><i></i>${esc(t('st.blocked'))} ${d.blocked}</span>
          <span class="muted">${fmtBytes(d.bytes)}</span>
        </div>`).join('') : `<div class="empty">${esc(t('stats.noData'))}</div>`}
    </div>`;
};

// =====================================================================
// 设置页（转发行为 / 存储 / 外观 / 域名 / 管理员 / 本地工具）
// =====================================================================
routes.settings = async function () {
  const [d, me] = await Promise.all([api('/api/destinations'), api('/api/auth/me')]);
  const verified = d.items.filter(x => x.status === 'verified');
  $('#content').innerHTML = `
    <div class="settings-grid">
      <div class="panel settings-card">
        <h3>${esc(t('set.storageCard'))}</h3>
        <div class="hint" style="margin-bottom:12px;">${esc(t('set.forwardMoved'))}</div>
        <div class="field"><label>${esc(t('set.storageMode'))}</label>
          <select id="st-storage">
            <option value="full" ${CFG.storage_mode === 'full' ? 'selected' : ''}>${esc(t('set.storageFull'))}</option>
            <option value="metadata_only" ${CFG.storage_mode === 'metadata_only' ? 'selected' : ''}>${esc(t('set.storageMeta'))}</option>
          </select>
          <div class="hint">${esc(t('set.storageHint'))}</div></div>
        <div class="field"><label>${esc(t('set.storeBlocked'))}</label>
          <select id="st-store-blocked">
            <option value="false" ${CFG.store_blocked_mail !== 'true' ? 'selected' : ''}>${esc(t('set.sbOff'))}</option>
            <option value="true" ${CFG.store_blocked_mail === 'true' ? 'selected' : ''}>${esc(t('set.sbOn'))}</option>
          </select></div>
        <div class="field"><label>${esc(t('set.retentionLabel'))}</label>
          <input id="st-retention" type="number" min="1" max="365" value="${esc(CFG.retention_days || '30')}"></div>
        <button class="btn" id="st-save" style="margin-top:12px;">${esc(t('common.save'))}</button>
      </div>
      <div class="panel settings-card">
        <h3>${esc(t('set.appearance'))}</h3>
        <div class="field"><label>${esc(t('theme.label'))}</label>
          <div class="seg">
            <button class="btn sm ${document.documentElement.dataset.theme === 'glass' ? '' : 'sec'}" data-t="glass">${esc(t('theme.glass'))}</button>
            <button class="btn sm ${document.documentElement.dataset.theme === 'min' ? '' : 'sec'}" data-t="min">${esc(t('theme.min'))}</button>
            <button class="btn sm ${document.documentElement.dataset.theme === 'play' ? '' : 'sec'}" data-t="play">${esc(t('theme.play'))}</button>
          </div></div>
        <div class="field"><label>${esc(t('lang.label'))}</label>
          <div class="seg">
            ${LANGS.map(l => `<button class="btn sm ${LANG === l.code ? '' : 'sec'}" data-l="${l.code}">${esc(l.label)}</button>`).join('')}
          </div></div>
        <div class="field"><label>PWA</label>
          <button class="btn sm sec" id="pwa-install" style="display:none;">${esc(t('set.pwaInstall'))}</button>
          <div class="hint">${esc(t('set.pwaHint'))}</div></div>
        <div class="field"><label>${esc(t('mode.label'))}</label>
          <div class="seg">
            <button class="btn sm ${getMode() === 'light' ? '' : 'sec'}" data-m="light">${esc(t('mode.light'))}</button>
            <button class="btn sm ${getMode() === 'dark' ? '' : 'sec'}" data-m="dark">${esc(t('mode.dark'))}</button>
            <button class="btn sm ${localStorage.getItem('if-mode') ? 'sec' : ''}" data-m="auto">${esc(t('mode.auto'))}</button>
          </div></div>
        <div class="field"><label>${esc(t('layout.label'))}</label>
          <div class="seg">
            <button class="btn sm ${getLayout() === 'sidebar' ? '' : 'sec'}" data-layout-set="sidebar">${esc(t('layout.sidebar'))}</button>
            <button class="btn sm ${getLayout() === 'top' ? '' : 'sec'}" data-layout-set="top">${esc(t('layout.top'))}</button>
          </div></div>
      </div>
      <div class="panel settings-card">
        <h3>${esc(t('set.domainsCard'))}</h3>
        <div class="field"><label>${esc(t('set.cfToken'))} · ${esc(CFG.cf_api_token_set ? t('set.cfTokenSet') : t('set.cfTokenNotSet'))}</label>
          <input id="st-cf-token" type="password" placeholder="v1.0-..." autocomplete="off">
          <div class="hint">${esc(t('set.cfTokenHint'))}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn sec sm" id="st-cf-save">${esc(t('set.cfSave'))}</button>
          <button class="btn sm" id="st-cf-sync">${esc(t('set.cfSync'))}</button>
        </div>
        <div class="field" style="margin-top:14px;"><label>${esc(t('set.manualAdd'))}</label>
          <div style="display:flex;gap:8px;">
            <input id="st-manual-domain" placeholder="${esc(t('domains.addPh'))}">
            <button class="btn sec sm" id="st-manual-add">${esc(t('common.add'))}</button>
          </div></div>
        <div class="field" style="margin-top:14px;margin-bottom:0;"><label>${esc(t('domains.title'))}</label></div>
        <div id="st-dom-list" class="card-list" style="gap:8px;"><div class="muted">${esc(t('common.loading'))}</div></div>
      </div>
      <div class="panel settings-card">
        <h3>${esc(t('set.turnstileCard'))}</h3>
        <div class="field"><label class="check-row"><input type="checkbox" id="ts-enable" ${CFG.turnstile_enabled ? 'checked' : ''}> ${esc(t('set.turnstileEnable'))}</label>
          <div class="hint">${esc(t('set.tsHint'))}</div></div>
        <div class="field"><label>${esc(t('set.tsSite'))}</label><input id="st-ts-site" value="${esc(CFG.turnstile_site_key || '')}" placeholder="0x4AAAAAAA..." autocomplete="off"></div>
        <div class="field"><label>${esc(t('set.tsSecret'))} · ${esc(CFG.turnstile_secret_set ? t('set.cfTokenSet') : t('set.cfTokenNotSet'))}</label>
          <input id="st-ts-secret" type="password" placeholder="0x4AAAAAAA..." autocomplete="new-password"></div>
        <button class="btn" id="st-ts-save">${esc(t('common.save'))}</button>
      </div>
      <div class="panel settings-card">
        <h3>${esc(t('set.adminCard'))}</h3>
        <div class="field"><label>${esc(t('set.adminCur'))}</label><input id="ad-cur" type="password" autocomplete="current-password"></div>
        <div class="field"><label>${esc(t('set.adminUser'))}</label><input id="ad-user" value="${esc(me.username)}" autocomplete="username"></div>
        <div class="field"><label>${esc(t('set.adminNew'))}</label><input id="ad-new" type="password" autocomplete="new-password"></div>
        <button class="btn" id="ad-save">${esc(t('set.changeAdmin'))}</button>
      </div>
      <div class="panel settings-card">
        <h3>${esc(t('set.devCard'))}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn" id="dev-sim">${esc(t('mail.sim'))} ×5</button>
          <button class="btn" id="dev-sim20">${esc(t('mail.sim'))} ×20</button>
          <button class="btn danger" id="dev-reset">${esc(t('common.delete'))}</button>
        </div>
        <div class="hint" style="margin-top:10px;">${esc(t('set.devHint'))}</div>
        <div class="hint" style="margin-top:6px;">${esc(t('login.user'))}: <b>${esc(me.username)}</b> <button class="icon-btn" id="st-logout" style="margin-left:6px;">${esc(t('common.logout'))}</button></div>
      </div>
    </div>`;

  $('#st-save').onclick = async () => {
    try {
      await api('/api/config', {
        method: 'PATCH',
        body: {
          storage_mode: $('#st-storage').value,
          store_blocked_mail: $('#st-store-blocked').value,
          retention_days: String($('#st-retention').value || 30),
        },
      });
      CFG = await api('/api/config');
      toast(t('set.saved'), 'ok');
    } catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err'); }
  };
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { setTheme(b.dataset.t); render(); });
  document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => setLang(b.dataset.l));
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { setMode(b.dataset.m); render(); });
  const pwaBtn = document.querySelector('#pwa-install');
  if (pwaBtn && typeof installPwa === 'function' && _pwaPrompt) { pwaBtn.style.display = ''; pwaBtn.onclick = installPwa; }
  document.querySelectorAll('[data-layout-set]').forEach(b => b.onclick = () => setLayout(b.dataset.layoutSet));

  $('#st-cf-save').onclick = async () => {
    try {
      await api('/api/config', { method: 'PATCH', body: { cf_api_token: $('#st-cf-token').value.trim() } });
      CFG = await api('/api/config');
      toast(t('set.saved'), 'ok');
      render();
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#st-cf-sync').onclick = async () => {
    try {
      $('#st-cf-sync').disabled = true;
      const r = await api('/api/domains/sync', { method: 'POST' });
      toast(tf('set.syncDone', { z: r.zones, er: r.email_routing_on }), 'ok');
      await loadSideDomains();
    } catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : (e.message === 'cf_token_missing' ? t('set.cfTokenMissing') : e.message), 'err'); }
    finally { $('#st-cf-sync').disabled = false; }
  };
  $('#st-manual-add').onclick = async () => {
    try {
      const domain = $('#st-manual-domain').value.trim();
      if (!domain) return;
      await api('/api/domains', { method: 'POST', body: { domain, email_routing: false } });
      toast(t('domains.added'), 'ok');
      $('#st-manual-domain').value = '';
      await Promise.all([loadSideDomains(), loadDomList()]);
    } catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err'); }
  };

  // 域名列表（含 §3.4 写路径操作：一键开启转发 / 导入原生规则）
  const loadDomList = async () => {
    const el = $('#st-dom-list');
    if (!el) return;
    const r = await api('/api/domains');
    el.innerHTML = r.items.length ? r.items.map(d => `
      <div class="row-card panel" style="padding:10px 14px;">
        <div class="row-main"><div class="row-title">${esc(d.domain)}
          <span class="badge ${d.email_routing === true ? 'ok' : 'mute'}"><i></i>ER</span></div>
          <div class="row-sub">${d.emails ? esc(d.emails) + ' · ' : ''}${d.has_rule ? '' : esc(t('rules.none'))}</div></div>
        ${d.email_routing !== true && CFG.cf_api_token_set ? `<button class="btn sm" data-enable="${esc(d.domain)}">${esc(t('domains.enableBtn'))}</button>` : ''}
        ${CFG.cf_api_token_set && d.email_routing === true ? `<button class="btn sec sm" data-import="${esc(d.domain)}">${esc(t('domains.importBtn'))}</button>` : ''}
        <button class="icon-btn" data-rm="${esc(d.domain)}">${esc(t('common.delete'))}</button>
      </div>`).join('') : `<div class="muted">${esc(t('domains.none'))}</div>`;

    const doEnable = async (domain, confirm) => {
      try {
        await api(`/api/domains/${encodeURIComponent(domain)}/enable`, { method: 'POST', body: { confirm } });
        toast(t('domains.enableDone'), 'ok');
        await Promise.all([loadDomList(), loadSideDomains()]);
      } catch (e) {
        if (e.data?.error === 'mx_conflicts') {
          if (confirm(tf('domains.mxConfirm', { list: (e.data.conflicts || []).join('\n') }))) return doEnable(domain, true);
        } else {
          toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : (e.data?.detail || e.message), 'err');
        }
      }
    };
    el.querySelectorAll('[data-enable]').forEach(b => b.onclick = () => doEnable(b.dataset.enable, false));
    el.querySelectorAll('[data-import]').forEach(b => b.onclick = async () => {
      if (!confirm(t('domains.importConfirm'))) return;
      try {
        const r = await api(`/api/domains/${encodeURIComponent(b.dataset.import)}/native-rules/import`, { method: 'POST', body: { disable_native: true } });
        toast(tf('domains.importDone', { n: r.imported, s: r.skipped, d: r.disabled }), 'ok');
      } catch (e) { toast(e.data?.detail || e.message, 'err'); }
    });
    el.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      if (!confirm(t('domains.deleteConfirm'))) return;
      try { await api(`/api/domains/${encodeURIComponent(b.dataset.rm)}`, { method: 'DELETE' }); toast(t('common.delete'), 'ok'); await Promise.all([loadDomList(), loadSideDomains()]); }
      catch (e) { toast(e.message, 'err'); }
    });
  };
  loadDomList();

  $('#st-ts-save').onclick = async () => {
    try {
      const body = {
        turnstile_enabled: $('#ts-enable').checked ? 'true' : 'false',
        turnstile_site_key: $('#st-ts-site').value.trim(),
      };
      const secret = $('#st-ts-secret').value.trim();
      if (secret) body.turnstile_secret_key = secret; // 留空 = 保留已存密钥
      await api('/api/config', { method: 'PATCH', body });
      CFG = await api('/api/config');
      toast(t('set.tsSaved'), 'ok');
      render();
    } catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err'); }
  };

  $('#ad-save').onclick = async () => {
    try {
      const r = await api('/api/auth/change-admin', {
        method: 'POST',
        body: { current_password: $('#ad-cur').value, username: $('#ad-user').value.trim(), new_password: $('#ad-new').value || undefined },
      });
      if (r.csrf) try { localStorage.setItem('if-csrf-hint', '1'); } catch {}
      toast(t('set.adminChanged'), 'ok');
      $('#ad-cur').value = ''; $('#ad-new').value = '';
    } catch (e) { toast(t('err.' + e.message) !== 'err.' + e.message ? t('err.' + e.message) : e.message, 'err'); }
  };

  const sim = async n => {
    try { const r = await api('/api/dev/simulate', { method: 'POST', body: { count: n } }); toast(tf('mail.simDone', { n: r.created }), 'ok'); await loadSideDomains(); }
    catch (e) { toast(e.message, 'err'); }
  };
  $('#dev-sim').onclick = () => sim(5);
  $('#dev-sim20').onclick = () => sim(20);
  $('#dev-reset').onclick = async () => {
    if (!confirm(t('set.resetConfirm'))) return;
    try { await api('/api/dev/reset', { method: 'POST' }); toast(t('set.resetDone'), 'ok'); } catch (e) { toast(e.message, 'err'); }
  };
  $('#st-logout').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.hash = '#/login';
  };
};

// =====================================================================
// PWA + 启动
// =====================================================================
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
let _pwaPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
  const slot = document.querySelector('#pwa-install');
  if (slot) { slot.style.display = ''; slot.onclick = installPwa; }
});
async function installPwa() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  await _pwaPrompt.userChoice;
  _pwaPrompt = null;
  const slot = document.querySelector('#pwa-install');
  if (slot) slot.style.display = 'none';
}

async function boot() {
  if (!location.hash) { location.hash = '#/mail'; return; }
  await render();
}
window.addEventListener('hashchange', render);
boot();

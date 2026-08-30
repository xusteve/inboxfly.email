# InboxFly 官网（inboxfly.email）

静态站点：英文默认（`/`）+ 中文（`/zh`），PWA + 深浅色，datafa.st 风格。独立 Worker `inboxfly-landing`，自定义域绑定 `inboxfly.email`。

## ⚠️ Cloud 版上线时恢复首页（重要）

当前 Cloud 首页未上线，`public/_redirects` 里有两行**临时跳转**：

```
/ /self-hosted 302
/zh /zh/self-hosted 302
```

恢复步骤：① 删除这两行；② 在 `public/` 放入 Cloud 首页 `index.html`（根路径）；③ `npx wrangler deploy`。

## 结构

```
landing/
├── wrangler.jsonc        # 部署配置（无绑定，纯静态资产）
└── public/
    ├── _redirects        # 临时跳转（见上）· 404 处理
    ├── self-hosted.html  # 英文开源版介绍页
    ├── zh/self-hosted.html
    ├── 404.html · manifest.webmanifest · sw.js
    └── assets/（style.css · landing.js · logo · panel-dark.png）
```

## 部署

```bash
cd landing
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler deploy
```

自定义域 `inboxfly.email` 已在 CF 后台绑定到 `inboxfly-landing` Worker（生产环境）。

## 待办（建 GitHub 仓库后）

把页面内所有 `href="#"`（Deploy to Cloudflare 按钮、GitHub 链接）替换为实际仓库地址：`self-hosted.html` 与 `zh/self-hosted.html` 各 2 处。

# 博客在线发布系统 - 部署指南

## 架构说明

```
博客前端 (newlaodao.html / newsuibi.html)
  │
  ├── CONFIG.workerUrl → blog-github-proxy Worker
  │     ├── /api/github  → GitHub API 代理（创建/更新 Markdown 文件）
  │     └── /api/upload  → 又拍云图片上传
  │
  └── CONFIG.draftUrl → blog-laodao-draft Worker
        └── /api/drafts → 云草稿 KV 存储
```

---

## 前置准备

1. **Cloudflare 账号**（免费即可）
2. **GitHub PAT**（Personal Access Token）
   - 生成地址: https://github.com/settings/tokens → Generate new token (classic)
   - 勾选 `repo` 权限
3. **又拍云账号**（用于图片存储，没有可先跳过图片上传功能）

---

## 部署步骤

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. 部署 GitHub 代理 Worker

```bash
cd workers/github-proxy

# 创建 Worker
wrangler deploy

# 设置环境变量（在 Cloudflare Dashboard 或命令行）
wrangler secret put ADMIN_TOKEN       # 你的管理密钥（自己定一个复杂密码）
wrangler secret put GITHUB_TOKEN      # 你的 GitHub PAT
wrangler secret put UPYUN_OPERATOR    # 又拍云操作员名
wrangler secret put UPYUN_PASSWORD    # 又拍云操作员密码
wrangler secret put UPYUN_BUCKET      # 又拍云桶名
wrangler secret put UPYUN_DOMAIN      # 又拍云域名 如 https://img.yourdomain.com
```

部署后会得到一个 URL，如: `https://blog-github-proxy.your-name.workers.dev`

### 3. 创建 KV 命名空间 + 部署草稿 Worker

```bash
cd workers/laodao-draft

# 创建 KV 命名空间
wrangler kv:namespace create "DRAFTS_KV"
# 输出类似: { binding = "DRAFTS_KV", id = "xxxx" }

# 把返回的 id 填入 wrangler.toml 的 [[kv_namespaces]] 中

# 设置密钥
wrangler secret put ADMIN_TOKEN       # 和上面的管理密钥保持一致

# 部署
wrangler deploy
```

部署后会得到一个 URL，如: `https://blog-laodao-draft.your-name.workers.dev`

### 4. 修改博客前端配置

修改 `themes/jingzhe_v3/layouts/_default/newlaodao.html` 中的 CONFIG：

```javascript
const CONFIG = {
    workerUrl: "https://blog-github-proxy.your-name.workers.dev",
    draftUrl: "https://blog-laodao-draft.your-name.workers.dev",
    owner: "GuoRan18",        // 你的 GitHub 用户名
    repo: "blog",              // 你的仓库名
    branch: "master",          // 你的分支名
    upyunDomain: "https://img.yourdomain.com",  // 又拍云域名
};
```

修改 `themes/jingzhe_v3/layouts/_default/newsuibi.html` 中的 CONFIG 同理。

### 5. 访问发布页面

- 发布唠叨: `https://blog.qiongl.com/newlaodao/`
- 发布随笔: `https://blog.qiongl.com/newsuibi/`

输入你设置的 `ADMIN_TOKEN` 即可登录使用。

---

## 自定义域名（可选）

如果你不想用 `workers.dev` 域名，可以在 Cloudflare Dashboard 中为 Worker 绑定自定义域名。

---

## 安全说明

- `ADMIN_TOKEN` 存储在浏览器 localStorage 中，不通过网络传输（仅在请求头中发送）
- GitHub PAT 和又拍云密钥存储在 Cloudflare Worker Secrets 中，不会暴露给前端
- 所有 API 请求都需要验证 ADMIN_TOKEN

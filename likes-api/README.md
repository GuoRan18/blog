# 点赞系统后端 API

基于 Cloudflare Workers + KV 的轻量级点赞服务。

## 快速部署

### 1. 安装依赖

```bash
cd likes-api
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 KV 命名空间

```bash
npx wrangler kv:namespace create LIKES_KV
```

执行后会输出类似：
```
{ binding = "LIKES_KV", id = "xxxx..." }
```

复制这个 ID，更新 `wrangler.toml` 中的 `id` 字段。

### 4. 配置 Turnstile 密钥

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Turnstile
2. 创建一个 Site，获取 **Secret Key**
3. 设置环境变量：

```bash
npx wrangler secret put TURNSTILE_SECRET
```

粘贴你的 Secret Key。

### 5. 更新允许的域名

编辑 `wrangler.toml`，修改 `ALLOWED_ORIGIN`：

```toml
[vars]
ALLOWED_ORIGIN = "https://your-domain.com"
```

### 6. 部署

```bash
npm run deploy
```

部署成功后会显示 Workers 的 URL，例如：
```
https://likes.你的子域名.workers.dev
```

### 7. 绑定自定义域名（可选）

在 Cloudflare Dashboard → Workers → 你的 Worker → Settings → Triggers → Custom Domains，添加：

```
likes.your-domain.com
```

## 前端配置

部署完成后，修改博客前端的 API 地址：

编辑 `static/js/laodao.js`，找到：

```javascript
const LIKE_API_BASE = 'https://likes.i4017.workers.dev/api/likes';
```

替换为：

```javascript
const LIKE_API_BASE = 'https://likes.你的域名/api/likes';
```

## API 接口

### GET /api/likes

获取所有页面的点赞数据。

**响应：**
```json
{
  "counts": {
    "/posts/hello-world": 42,
    "/posts/another-post": 15
  },
  "myLikes": []
}
```

### POST /api/likes/submit

提交点赞。

**请求头：**
```
Content-Type: application/json
CF-Turnstile-Response: <turnstile_token>
```

**请求体：**
```json
{
  "url": "/posts/hello-world"
}
```

**响应：**
```json
{
  "success": true,
  "count": 43
}
```

## 本地开发

```bash
npm run dev
```

访问 http://localhost:8787

## 查看日志

```bash
npm run tail
```

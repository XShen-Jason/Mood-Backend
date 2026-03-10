# 🚀 RomanceSpace-Backend (VPS 部署指南)

本项目为 RomanceSpace 架构中的**核心写端 (Write-Side)**。所有消耗 CPU 的模板渲染、R2 写操作、KV 写操作以及 Supabase 入库均由此 Express 进程独立承担，从而保证前台 Worker 边缘网关的无感极速读取。

## 环境要求
- 一台具有公网 IP 的 Linux VPS (推荐 Ubuntu 22.04+)
- Node.js (v18+)
- PM2 (用于守护进程)

## 📦 部署步骤

### 1. 拉取代码并安装依赖
```bash
git clone <your-repo-url>
cd RomanceSpace-Backend
npm install
```

### 2. 配置环境变量
复制根目录的环境变量参考文件：
```bash
cp .env.example .env
```
编辑 `.env` 添加你的敏感密钥（**绝对不可泄露**）：
```ini
# 服务端口
PORT=3000

# 跨域白名单（前端托管在你哪个域名下，就填哪个）
ALLOWED_ORIGIN=https://www.885201314.xyz

# Cloudflare 相关凭证
CLOUDFLARE_ACCOUNT_ID=你的CF账户ID
CLOUDFLARE_API_TOKEN=你的API_Token(具备KV和缓存刷新权限)
KV_NAMESPACE_ID=你的KV空间ID

# Cloudflare R2 对象存储凭证
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=your-bucket-name

# Supabase 数据库凭证 (用于防抢注、防多占)
SUPABASE_URL=https://djcfqtrbfjaykdyperpf.supabase.co
# ⚠️ 注意这是 Service Role Key，非 Public Anon Key！
SUPABASE_SERVICE_ROLE_KEY=eyJh....
```

### 3. 一键使用 PM2 守护进程启动
确保你安装了全局 pm2：
```bash
npm install -g pm2
```
拉起后台服务：
```bash
pm2 start src/app.js --name romancespace-api
```
设置开机自启：
```bash
pm2 save
pm2 startup
```

## 🛡️ Nginx 反代配置 (可选但强烈建议)
为了让你的前端通过 `https://api.885201314.xyz/api/...` 安全访问到你的 VPS 的 3000 端口，你需要在 VPS 上配置 Nginx 反向代理并配置 SSL 证书。

简要 Nginx 示例：
```nginx
server {
    listen 443 ssl;
    server_name api.885201314.xyz;

    ssl_certificate /etc/letsencrypt/live/api.885201314.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.885201314.xyz/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔄 运维排障常识
- **看错误日志**：`pm2 logs romancespace-api` 
- **重启服务**：`pm2 restart romancespace-api`
- **某域名前缀卡死报错**：去 Supabase 面板清空一下该用户的 `projects` 落库记录，或者在 CF KV 后台删掉相应的键，即可解除锁定。

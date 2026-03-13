# 🤖 RomanceSpace 全栈自动部署配置指南 (VPS CI/CD)

通过本指南，您将实现前端 (Frontend) 和后端 (Backend) 的全自动部署。每个项目都会在自己独立的目录下进行 `git pull` 和更新。

## 目录结构说明
本指南假设您的 VPS 目录结构如下：
- 后端：`/opt/RomanceSpace-Backend`
- 前端：`/opt/RomanceSpace-Frontend`

---

## 第一步：在 VPS 上准备 SSH 访问

如果您还没有为 GitHub Actions 准备过密钥，请在 VPS 终端执行：

```bash
# 1. 生成密钥对 (一路回车，不要设置密码)
ssh-keygen -t rsa -b 4096 -C "rs-deploy-action"

# 2. 将公钥添加到系统的授权列表中
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys

# 3. 确保目录权限正确
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

## 第二步：在 GitHub 仓库添加加密密钥 (Secrets)

您需要分别在 `RomanceSpace-Frontend` 和 `RomanceSpace-Backend` 的 **Settings -> Secrets and variables -> Actions** 中添加以下三个密钥：

| 密钥名称 (Name) | 对应的内容 (Value) |
| :--- | :--- |
| `SSH_HOST` | 您的 VPS 公网 IP 地址 |
| `SSH_USER` | 您的登录用户名 (通常是 `root`) |
| `SSH_KEY` | 您的私钥内容 (执行 `cat ~/.ssh/id_rsa` 看到的全部内容，包含 BEGIN 和 END 行) |

## 第三步：部署流程详解

### 1. 后端 (Backend) 自动化逻辑
当您推送代码到后端仓库时，它会：
1. 进入 `/opt/RomanceSpace-Backend`。
2. 执行 `git pull`。
3. 执行 `npm install`。
4. 执行 `pm2 restart romancespace-api` (重启 API 服务)。

### 2. 前端 (Frontend) 自动化逻辑
当您推送代码到前端仓库时，它会：
1. 进入 `/opt/RomanceSpace-Frontend`。
2. 执行 `git pull`。
3. 执行 `npm install`。
4. 执行 `npm run build` (重新打包静态文件到 `dist` 目录)。
5. **无需重启**：Nginx 会直接读取最新的 `dist` 内容。

---

## ⚡ 常见问题

**Q: 如果我的目录名不一样怎么办？**
A: 请在对应仓库的 `.github/workflows/deploy.yml` 文件中，修改 `cd /opt/xxxx` 这一行，将其改为您真实的目录路径。

**Q: 如何查看部署状态？**
A: 在 GitHub 仓库顶部的 **Actions** 标签页中可以查看每一次部署的实时日志和结果。

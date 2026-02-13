# 部署到 Vercel

本文说明如何将 **ai-consultant-web**（Next.js 前端）部署到 Vercel。

## 一、前置条件

1. 代码已推送到 GitHub 仓库，例如：`siegzhong-maker/business_knowledge`
2. 已注册 [Vercel](https://vercel.com) 账号（可用 GitHub 登录）

## 二、在 Vercel 部署（推荐：从 GitHub 导入）

### 1. 导入项目

1. 打开 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **Add New…** → **Project**
3. 选择 **Import Git Repository**，找到并选择 `siegzhong-maker/business_knowledge`（若未显示，先点 **Configure** 连接 GitHub 账号并授权该仓库）

### 2. 配置构建设置（必改）

本仓库根目录是 `business_knowledge`，Next.js 应用在子目录 `ai-consultant-web` 中，**必须**在 Vercel 里指定根目录：

- **Root Directory**：点击 **Edit**，填写 **`ai-consultant-web`**，并确认
- **Framework Preset**：保持 **Next.js**（自动识别）
- **Build Command**：留空（使用默认 `next build`）
- **Output Directory**：留空（使用默认）
- **Install Command**：留空（使用默认 `npm install`）

### 3. 环境变量

在 **Environment Variables** 中添加：

| 名称 | 值 | 说明 |
|------|-----|------|
| `OPENROUTER_API_KEY` | `sk-or-...` | 必填。在 [OpenRouter](https://openrouter.ai) 获取的 API Key，用于聊天接口 |
| `DATABASE_URL` | Supabase 连接串 | 必填。Supabase **Session Pooler** 连接串（端口 5432），与本地 `.env` 中一致；密码中若有 `@` 需写成 `%40` |

可选：

- `OPENROUTER_BASE_URL`：不填则使用默认 `https://openrouter.ai/api/v1`

填写后可为 **Production / Preview / Development** 分别勾选需要生效的环境，然后点击 **Deploy**。

### 4. 部署与访问

- 部署完成后，Vercel 会给出一个 **Production URL**，例如：`https://xxx.vercel.app`
- 之后每次向 `main`（或你指定的生产分支）推送代码，都会自动触发一次新部署

---

## 三、用 Vercel CLI 部署（可选）

若想从本机直接部署而不经过 GitHub：

### 1. 安装并登录

```bash
npm i -g vercel
vercel login
```

### 2. 在项目子目录中部署

```bash
cd /Users/silas/Desktop/business_knowledge/ai-consultant-web
vercel
```

按提示选择或创建项目、关联团队。首次会询问环境变量，可在此处填写 `OPENROUTER_API_KEY`，或稍后在 Vercel 控制台 **Project → Settings → Environment Variables** 中配置。

### 3. 生产环境部署

```bash
vercel --prod
```

---

## 四、部署后检查

1. 打开 Vercel 提供的站点 URL
2. 在页面中发起一次对话；若未配置或配置错误的 `OPENROUTER_API_KEY`，聊天会报错；若出现 500，可到 Vercel 的 **Functions** 日志查看是否为数据库连接错误
3. 在 Vercel 项目 **Settings → Environment Variables** 中确认 `OPENROUTER_API_KEY` 与 `DATABASE_URL` 已正确填写并已对 Production 生效

---

## 五、常见问题

- **构建失败 / 找不到 Next.js**  
  确认 **Root Directory** 已设为 **`ai-consultant-web`**，而不是仓库根目录。

- **构建失败 / Turbopack 报错（如 creating new process、binding to a port）**  
  项目已使用 `next build --webpack`，在 Vercel 上使用 Webpack 而非 Turbopack 进行构建。若在 Vercel 中自定义了 **Build Command**，请保持为 `npm run build`（不要改成 `next build`）。

- **聊天接口 500 / 未授权**  
  在 Vercel 中检查 **Environment Variables** 里的 `OPENROUTER_API_KEY` 是否正确，并重新部署一次使环境变量生效。

- **Prisma / 数据库**  
  聊天已使用 Prisma 写入 Supabase。若聊天 500 或报错，请检查 Vercel 中 `DATABASE_URL` 是否与 Supabase Session Pooler（端口 5432）一致、是否对当前环境生效，并重新部署。

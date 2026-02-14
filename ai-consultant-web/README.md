## AI Consultant Web 前端（Next.js）

这是基于 Next.js App Router 搭建的前端，用于承载「高小新战略官」与「商业模式架构师」两个智能体的对话 + 画布体验。

### 1. 环境准备

- Node.js：建议 18+（Next.js 16 官方推荐版本）。
- 包管理工具：任选 `npm` / `pnpm` / `yarn` / `bun`。

### 2. 配置环境变量

在 `ai-consultant-web` 目录下，将示例文件复制为本地配置：

```bash
cp .env.local.example .env.local
```

然后编辑 `.env.local`，填入你的 OpenRouter API Key：

```bash
OPENROUTER_API_KEY=sk-or-...
```

> 注意：不要将 `.env.local` 提交到代码仓库。

### 3. 安装依赖

```bash
npm install
```

或使用其他包管理器：

```bash
pnpm install
```

### 4. 启动开发服务器

```bash
npm run dev
```

启动后，访问：

- 浏览器打开 `http://localhost:3000`
- 左侧为聊天窗口，右侧为画布区域（高小新雷达图 / BMC 九宫格）

### 5. 功能自测

- **聊天与智能体切换**
  - 在左侧输入框中输入中文商业想法，点击发送；
  - 观察右侧画布是否根据对话内容更新；
  - 将鼠标悬浮在头像区域，可在「高小新战略官」与「商业模式架构师」之间切换。

- **画布实时更新**
  - 当模型调用 `updateCanvas` 工具时，前端会通过 Zustand 将结构化数据写入 `canvasData`；
  - 高小新视图中，雷达图与字段内容会被实时刷新；
  - BMC 视图中，各宫格的提示文案会逐步被更具体的内容替代。

- **导出交付物**
  - 页面右下方浮动工具条中，点击「导出交付物」按钮；
  - 当前所选智能体会导出对应 Markdown 文件：
    - 高小新：`gxx-report-YYYY-MM-DD.md`（包含项目概览、三维评分和诊断总结）；
    - BMC：`bmc-canvas-YYYY-MM-DD.md`（包含九宫格各块内容）。

> 如果未配置 `OPENROUTER_API_KEY`，接口请求会失败，前端会在聊天区域提示错误；请确保本地 `.env.local` 中的密钥可用。

### 6. 知识库（可选）

高小新智能体的系统提示会注入「会议纪要」知识库，用于引用案例与推理。知识库文件路径：`data/knowledge_base.json`。若该文件不存在或格式有误，服务端会使用占位文案，不会报错；详见 `data/README.md`。

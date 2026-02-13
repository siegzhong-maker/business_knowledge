# 企业咨询 AI 智能体 (高小新版)

本项目是基于会议纪要构建的 AI 咨询顾问系统，旨在通过“高小新”方法论帮助企业主进行商业方向诊断。

## 📂 项目文件结构
- `extract_knowledge.py`: 从 PDF 提取文本并构建知识库的脚本。
- `knowledge_base.json`: 提取后的结构化知识库（包含方法论原文）。
- `gao_xiaoxin_agent.py`: 智能体核心逻辑（包含 Prompt 和 OpenRouter 接口）。
- `run_gao_xiaoxin.sh`: 启动脚本。

## 🚀 快速开始

### 1. 提取最新的知识库
如果您有新的 PDF 会议纪要，请放入当前目录并运行：
```bash
python3 extract_knowledge.py
```

### 2. 运行高小新智能体
为了获得最佳体验，请先设置 OpenRouter API Key：
```bash
export OPENROUTER_API_KEY='sk-or-...'
```
然后运行：
```bash
./run_gao_xiaoxin.sh
```

## 🧠 核心功能
智能体基于《创业方向与“高小新”寻找策略会》设计，会从三个维度评估您的项目：
1.  **高 (High)**: 天花板高、高频、高毛利。
2.  **小 (Small)**: 小切口、MVP 验证、聚焦。
3.  **新 (New)**: 新品类、新人群、新红利。

## 🖥 运行方式与自测

### 1. 安装 Python 依赖

在项目根目录（本 README 所在目录）执行：

```bash
pip install -r requirements.txt
```

> 如有多个 Python 版本，建议使用虚拟环境（例如 `python -m venv .venv && source .venv/bin/activate`）。

### 2. 构建或更新知识库

将会议纪要等 PDF 文件放在当前目录下，然后运行：

```bash
python3 extract_knowledge.py
```

预期结果：
- 终端输出发现的 PDF 数量及逐个处理日志；
- 生成或更新 `knowledge_base.json`，包含每个 PDF 的全文内容。

### 3. 运行 CLI 模式（终端对话）

先（可选）设置 OpenRouter API Key（如无则自动走 Mock 路径）：

```bash
export OPENROUTER_API_KEY='sk-or-...'
```

然后运行：

```bash
python3 gao_xiaoxin_agent.py
```

预期行为：
- 终端打印欢迎语；
- 输入中文创业想法后，智能体返回分析文本，并在结尾附带 JSON 区块（包含 `high_score` / `small_score` / `new_score` / `summary`）。
- 如果未配置 `OPENROUTER_API_KEY`，会返回标记为 `[Mock Response]` 的模拟结果，用于本地快速验证。

### 4. 运行 Streamlit Web 界面

在项目根目录执行：

```bash
streamlit run app.py
```

预期行为：
- 浏览器自动打开一个页面，左侧为“实时评估看板”，右侧为对话区域；
- 在输入框中输入创业想法后，右侧显示对话内容，左侧三项进度条会根据返回 JSON 中的分数实时更新；
- 点击「🔄 重置对话」按钮后，对话和打分会被清空。

> 提示：若未配置 `OPENROUTER_API_KEY`，界面仍可使用，只是底层走 Mock 响应路径。

### 5. 测试脚本（可选）

#### `test_agent.py`

```bash
python3 test_agent.py
```

预期行为：
- 在不配置 `OPENROUTER_API_KEY` 的情况下，验证知识库加载是否正常，以及 Mock 响应逻辑是否生效。

#### `test_live_agent.py`

```bash
export OPENROUTER_API_KEY='sk-or-...'
python3 test_live_agent.py
```

预期行为：
- 检查环境变量中是否存在 API Key；
- 向 OpenRouter 发送一条真实请求，并输出完整响应内容，便于验证联通性与 Persona 是否正确。

## 🛠 后续计划
- 开发更丰富的 Web 界面 (包含画布、导出功能等)。
- 增加“股权”和“营销”智能体。

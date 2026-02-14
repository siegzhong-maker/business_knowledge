# 知识库数据（可选）

高小新智能体的系统提示会注入本目录下的会议纪要知识库，用于引用案例与推理。

## 文件说明

- **`knowledge_base.json`**（可选）：若不存在或格式有误，服务端会使用占位文案，不会报错。

## 格式

`knowledge_base.json` 为 JSON 数组，每项包含：

- `source`（string）：文档来源名称，如文件名或会议标题。
- `content`（string）：该文档的正文内容，将原样拼接到系统提示上下文中。

示例：

```json
[
  { "source": "会议纪要 A.pdf", "content": "会议总结\n..." },
  { "source": "会议纪要 B.pdf", "content": "..." }
]
```

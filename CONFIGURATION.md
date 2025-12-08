# CareerOS 配置指南

本文档详细说明 CareerOS 的所有配置选项。

## 目录

- [LLM 配置](#llm-配置)
- [目录配置](#目录配置)
- [隐私配置](#隐私配置)
- [性能配置](#性能配置)
- [Taxonomy 配置](#taxonomy-配置)
- [高级配置](#高级配置)

## LLM 配置

CareerOS 支持多种 LLM 提供商，并允许为不同任务配置不同的模型。

### 支持的提供商

| 提供商 | 说明 | 配置要求 |
|--------|------|----------|
| `local` | 本地 LLM (Ollama/LM Studio) | Base URL |
| `openai` | OpenAI API | API Key |
| `anthropic` | Anthropic Claude | API Key |
| `google` | Google Gemini | API Key |

### 角色配置

系统为不同任务定义了三种角色：

#### extract (提取角色)
- **用途**: NoteCard 和 JDCard 提取
- **推荐**: 本地 LLM（保护隐私）或 GPT-3.5
- **特点**: 需要良好的 JSON 输出能力

```typescript
{
  provider: 'local',
  model: 'llama3.2',
  baseUrl: 'http://localhost:11434/api/chat',
  jsonMode: true
}
```

#### analyze (分析角色)
- **用途**: 差距分析和行动计划生成
- **推荐**: GPT-4 或 Claude（高质量输出）
- **特点**: 需要强大的推理和规划能力

```typescript
{
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'your-api-key'
}
```

#### embedding (嵌入角色)
- **用途**: 向量嵌入（预留功能）
- **推荐**: text-embedding-ada-002 或本地嵌入模型

### API Key 配置

在设置界面中配置各提供商的 API Key：

| 配置项 | 说明 |
|--------|------|
| `openaiApiKey` | OpenAI API 密钥 |
| `anthropicApiKey` | Anthropic API 密钥 |
| `googleApiKey` | Google API 密钥 |

> ⚠️ API Key 存储在 Obsidian 的插件数据目录中，由 Obsidian 加密保护。

### 代理和自定义端点

如果需要使用代理或自定义 API 端点：

```typescript
{
  customBaseUrl: 'https://your-proxy.com/v1/chat/completions',
  // 或在单个角色配置中
  llmConfigs: {
    extract: {
      provider: 'openai',
      baseUrl: 'https://your-proxy.com/v1/chat/completions',
      model: 'gpt-3.5-turbo'
    }
  }
}
```

## 目录配置

### 数据存储目录

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `indexDirectory` | `CareerOS/index` | NoteCard JSON 文件存储位置 |
| `mappingDirectory` | `CareerOS/mapping` | 画像、分析报告、计划存储位置 |
| `marketCardsDirectory` | `CareerOS/market_cards` | JDCard JSON 文件存储位置 |

### 目录结构示例

```
your-vault/
├── CareerOS/
│   ├── index/                    # NoteCard 存储
│   │   ├── projects_my-project.json
│   │   └── courses_python-course.json
│   ├── mapping/                  # 画像和分析
│   │   ├── self_profile_2024-12-08.json
│   │   ├── self_profile_2024-12-08.md
│   │   ├── market_python_backend_hangzhou_2024-12-08.json
│   │   ├── gap_analysis_Python_Backend_杭州_2024-12-08.md
│   │   └── action_plan_Python_Backend_杭州_2024-12-08.md
│   ├── market_cards/             # JDCard 存储
│   │   ├── uuid-1234-5678.json
│   │   └── uuid-abcd-efgh.json
│   └── error_log.md              # 错误日志
└── your-notes/
    ├── projects/
    └── courses/
```

## 隐私配置

### 排除规则

配置不参与 LLM 处理的笔记：

```typescript
{
  exclusionRules: {
    directories: [
      'private/',
      'personal/',
      'diary/'
    ],
    tags: [
      'private',
      'sensitive',
      'no-index'
    ]
  }
}
```

### PII 过滤

外部 LLM 调用时自动过滤的 PII 类型：

| 类型 | 模式 | 替换为 |
|------|------|--------|
| 手机号 | `1[3-9]\d{9}` | `[PHONE]` |
| 邮箱 | `[\w.-]+@[\w.-]+\.\w+` | `[EMAIL]` |
| 身份证 | `\d{17}[\dXx]` | `[ID_CARD]` |

> 本地 LLM 调用不会进行 PII 过滤。

## 性能配置

### 并发和重试

| 配置项 | 默认值 | 说明 | 建议范围 |
|--------|--------|------|----------|
| `concurrency` | `3` | 并发处理任务数 | 1-5 |
| `maxRetries` | `3` | LLM 调用最大重试次数 | 2-5 |
| `timeout` | `30000` | 单次 LLM 调用超时 (ms) | 15000-60000 |

### 重试策略

系统使用指数退避重试策略：

```
延迟 = baseDelay * 2^attempt + jitter
```

- 第 1 次重试: ~1 秒
- 第 2 次重试: ~2 秒
- 第 3 次重试: ~4 秒
- 最大延迟: 30 秒

### Dry-Run 模式

在正式索引前验证提取质量：

```typescript
{
  dryRunMode: true,
  dryRunMaxNotes: 5  // 只处理前 5 个笔记
}
```

Dry-Run 模式特点：
- 不写入任何文件
- 结果显示在控制台
- 用于验证 LLM 输出质量

## Taxonomy 配置

### 技能别名映射

配置技能名称的标准化映射：

```typescript
{
  taxonomy: {
    skillMappings: [
      {
        standardName: 'Python',
        aliases: ['python', 'Python3', 'py'],
        category: 'language'
      },
      {
        standardName: 'React',
        aliases: ['ReactJS', 'React.js', 'react'],
        category: 'framework'
      },
      {
        standardName: 'PostgreSQL',
        aliases: ['postgres', 'pg', 'Postgres'],
        category: 'database'
      }
    ]
  }
}
```

### 技能分类

支持的技能分类：

| 分类 | 说明 | 示例 |
|------|------|------|
| `language` | 编程语言 | Python, JavaScript, Go |
| `framework` | 框架 | React, Django, Spring |
| `database` | 数据库 | PostgreSQL, MongoDB, Redis |
| `tool` | 工具 | Git, Docker, Kubernetes |
| `platform` | 平台 | AWS, Azure, Linux |
| `soft` | 软技能 | 沟通, 团队协作, 项目管理 |

## 高级配置

### 分析视图压缩

控制发送给 LLM 的数据量：

```typescript
{
  analysisViewConfig: {
    topSkillsCount: 15,      // 分析视图中的技能数量
    recentProjectsCount: 5   // 分析视图中的项目数量
  }
}
```

### 时间衰减配置

技能分数的时间衰减系数：

| 时间范围 | 衰减系数 |
|----------|----------|
| 0-6 个月 | 1.0 |
| 6-12 个月 | 0.8 |
| 12-24 个月 | 0.6 |
| 24-36 个月 | 0.4 |
| 36+ 个月 | 0.2 |

### 笔记类型权重

不同笔记类型对技能分数的贡献权重：

| 笔记类型 | 权重 |
|----------|------|
| `project` | 1.5 |
| `course` | 1.0 |
| `reflection` | 0.8 |
| `other` | 0.5 |

## 配置文件位置

插件配置存储在：
```
your-vault/.obsidian/plugins/career-os/data.json
```

> ⚠️ 不建议直接编辑此文件，请使用插件设置界面。

## 配置示例

### 完整配置示例

```json
{
  "indexDirectory": "CareerOS/index",
  "mappingDirectory": "CareerOS/mapping",
  "marketCardsDirectory": "CareerOS/market_cards",
  "maxRetries": 3,
  "timeout": 30000,
  "concurrency": 3,
  "dryRunMode": false,
  "openaiApiKey": "",
  "anthropicApiKey": "",
  "googleApiKey": "",
  "customBaseUrl": "",
  "llmConfigs": {
    "extract": {
      "provider": "local",
      "model": "llama3.2",
      "baseUrl": "http://localhost:11434/api/chat",
      "jsonMode": true
    },
    "analyze": {
      "provider": "openai",
      "model": "gpt-4",
      "jsonMode": false
    },
    "embedding": {
      "provider": "openai",
      "model": "text-embedding-ada-002"
    }
  },
  "exclusionRules": {
    "directories": ["private/", "diary/"],
    "tags": ["private", "sensitive"]
  },
  "taxonomy": {
    "skillMappings": []
  }
}
```

## 相关文档

- [README.md](./README.md) - 项目概述和快速开始
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 故障排除指南

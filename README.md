# CareerOS - 职业规划操作系统

CareerOS 是一个 Obsidian 插件，旨在构建一套「职业规划操作系统」。该系统通过分析用户在 Obsidian 中积累的笔记（项目、课程、反思等）和市场招聘信息（JD），自动生成能力画像、市场画像、差距分析和可执行的行动计划。

## 特性

- 📝 **自动提取技能信息** - 从项目笔记中提取技能、经验和偏好
- 🔄 **增量更新** - 笔记修改后自动同步能力画像
- 🔒 **隐私优先** - 支持本地 LLM，数据本地存储
- 📊 **能力画像** - 聚合技能数据，生成全面的自我画像
- 💼 **市场分析** - 从招聘信息中提取岗位要求
- 📈 **差距分析** - 对比自我画像和市场需求
- 🎯 **行动计划** - 生成可执行的能力提升计划
- 🎨 **可视化面板** - 集中查看所有数据和分析结果

## 安装

### 开发环境设置

1. 克隆此仓库到 Obsidian vault 的 `.obsidian/plugins/career-os` 目录
2. 安装依赖：
   ```bash
   npm install
   ```
3. 构建插件：
   ```bash
   npm run build
   ```
4. 在 Obsidian 中启用插件

### 开发模式

运行开发模式（自动重新构建）：
```bash
npm run dev
```

## 使用方法

### 1. 配置 LLM

在插件设置中配置 LLM 提供商：
- 本地 LLM（推荐，保护隐私）
- OpenAI
- Anthropic
- Google

### 2. 冷启动索引

首次使用时，运行"Cold Start Indexing"命令来索引现有笔记。

### 3. 构建能力画像

运行"Build Self Profile"命令来生成自我能力画像。

### 4. 分析市场需求

1. 创建包含招聘信息的笔记
2. 运行"Extract JD Cards from Current Note"命令
3. 运行"Build Market Profile"命令

### 5. 生成差距分析和行动计划

1. 运行"Generate Gap Analysis"命令
2. 运行"Generate Action Plan"命令

### 6. 查看面板

运行"Open Dashboard"命令查看可视化面板。

## 项目结构

```
career-os/
├── main.ts              # 插件主文件
├── types.ts             # TypeScript 类型定义
├── schema.ts            # Zod 验证模式
├── manifest.json        # 插件清单
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript 配置
└── esbuild.config.mjs   # 构建配置
```

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 类型检查

```bash
npm run build
```

## 数据架构

CareerOS 使用三层数据架构：

1. **原始层** - Obsidian vault 中的 Markdown 笔记
2. **卡片层** - 从笔记中提取的结构化 JSON 卡片（NoteCard, JDCard）
3. **画像/视图层** - 聚合的画像和分析（SelfProfile, MarketProfile, Plans）

## 隐私保护

- 优先使用本地 LLM
- 所有数据本地存储
- 外部 LLM 调用前自动过滤 PII
- 支持目录和标签排除
- 无遥测或分析

## 许可证

MIT

## 贡献

欢迎贡献！请提交 Issue 或 Pull Request。

## 支持

如有问题或建议，请在 GitHub 上提交 Issue。

# CareerOS 故障排除指南

本文档帮助您解决使用 CareerOS 时可能遇到的常见问题。

## 目录

- [LLM 相关问题](#llm-相关问题)
- [索引问题](#索引问题)
- [文件操作问题](#文件操作问题)
- [性能问题](#性能问题)
- [数据问题](#数据问题)
- [错误日志解读](#错误日志解读)

## LLM 相关问题

### 本地 LLM (Ollama) 连接失败

**症状**: 提示 "Failed to connect to local LLM" 或请求超时

**解决方案**:

1. 确认 Ollama 服务正在运行：
   ```bash
   # 检查 Ollama 状态
   ollama list
   
   # 如果未运行，启动服务
   ollama serve
   ```

2. 检查 Base URL 配置：
   - 默认地址: `http://localhost:11434/api/chat`
   - 确保端口 11434 未被占用

3. 验证模型已下载：
   ```bash
   # 列出已安装模型
   ollama list
   
   # 如果需要，下载模型
   ollama pull llama3.2
   ```

4. 测试连接：
   ```bash
   curl http://localhost:11434/api/tags
   ```

### OpenAI API 错误

**症状**: 401 Unauthorized 或 429 Rate Limited

**解决方案**:

1. **401 错误**: 检查 API Key 是否正确
   - 确认 Key 以 `sk-` 开头
   - 检查是否有多余空格

2. **429 错误**: 达到速率限制
   - 减少并发数 (`concurrency: 1`)
   - 增加重试间隔
   - 检查 OpenAI 账户配额

3. **500 错误**: OpenAI 服务问题
   - 等待几分钟后重试
   - 检查 [OpenAI Status](https://status.openai.com/)

### JSON 解析失败

**症状**: "Failed to parse JSON from LLM response"

**解决方案**:

1. 系统会自动尝试清洗 JSON（移除 markdown 包装等）
2. 如果持续失败：
   - 尝试启用 `jsonMode: true`（仅 OpenAI 支持）
   - 更换为更强的模型
   - 检查 Prompt 是否明确要求 JSON 输出

3. 查看错误日志中的原始响应：
   ```
   CareerOS/error_log.md
   ```

### 响应超时

**症状**: "LLM request timed out"

**解决方案**:

1. 增加超时时间：
   ```
   timeout: 60000  // 60 秒
   ```

2. 对于本地 LLM，检查硬件资源：
   - GPU 内存是否充足
   - CPU 负载是否过高

3. 减少单次处理的内容量

## 索引问题

### 冷启动索引卡住

**症状**: 进度条不动或处理极慢

**解决方案**:

1. 检查并发设置：
   ```
   concurrency: 2  // 降低并发
   ```

2. 使用 Dry-Run 模式测试：
   - 启用 `dryRunMode: true`
   - 设置 `dryRunMaxNotes: 3`
   - 观察控制台输出

3. 检查是否有大文件：
   - 超大笔记可能导致处理缓慢
   - 考虑将其加入排除列表

### 笔记未被索引

**症状**: 某些笔记没有生成 NoteCard

**解决方案**:

1. 检查排除规则：
   - 笔记是否在排除目录中
   - 笔记是否包含排除标签

2. 检查文件格式：
   - 确认是 `.md` 文件
   - 文件是否可读

3. 查看错误日志：
   - 可能是提取失败
   - 检查具体错误原因

### 增量更新不工作

**症状**: 修改笔记后 NoteCard 未更新

**解决方案**:

1. 确认内容确实改变：
   - 系统使用内容哈希检测变化
   - 仅格式变化可能不触发更新

2. 手动触发重新索引：
   - 删除对应的 NoteCard 文件
   - 重新运行冷启动索引

3. 检查文件事件监听：
   - 重启 Obsidian
   - 重新启用插件

## 文件操作问题

### 文件写入失败

**症状**: "Failed to write file" 或 "EACCES"

**解决方案**:

1. 检查目录权限：
   - 确保 Obsidian 有写入权限
   - 检查目录是否存在

2. 检查磁盘空间：
   - 确保有足够的存储空间

3. 关闭可能锁定文件的程序：
   - 其他编辑器
   - 同步软件

### 文件损坏

**症状**: JSON 解析错误或数据丢失

**解决方案**:

1. 系统会自动创建备份：
   - 查找 `.bak` 文件
   - 手动恢复

2. 从源笔记重新生成：
   - 删除损坏的 Card 文件
   - 重新运行索引

3. 检查同步冲突：
   - 如果使用云同步，检查冲突文件

### Schema 版本不匹配

**症状**: "Schema version mismatch" 警告

**解决方案**:

1. 系统会自动迁移旧版本数据
2. 如果迁移失败：
   - 备份现有数据
   - 删除旧文件
   - 重新生成

## 性能问题

### 内存占用过高

**症状**: Obsidian 变慢或崩溃

**解决方案**:

1. 减少并发数：
   ```
   concurrency: 1
   ```

2. 分批处理：
   - 使用 Dry-Run 模式
   - 分多次索引

3. 清理旧数据：
   - 删除不需要的 Card 文件
   - 清理错误日志

### 索引速度慢

**症状**: 冷启动索引耗时过长

**解决方案**:

1. 优化 LLM 配置：
   - 使用更快的模型
   - 本地 LLM 考虑使用 GPU

2. 调整并发：
   - 本地 LLM: `concurrency: 1-2`
   - 云 API: `concurrency: 3-5`

3. 排除不需要的笔记：
   - 配置排除目录
   - 排除大文件

### Dashboard 加载慢

**症状**: 打开 Dashboard 卡顿

**解决方案**:

1. 减少数据量：
   - 清理旧的分析报告
   - 限制显示的项目数量

2. 检查 React 组件：
   - 打开开发者工具
   - 查看性能分析

## 数据问题

### 技能名称不一致

**症状**: 同一技能显示为多个名称

**解决方案**:

1. 配置 Taxonomy 别名：
   ```json
   {
     "standardName": "Python",
     "aliases": ["python", "Python3", "py"]
   }
   ```

2. 重新构建 SelfProfile：
   - 执行 `CareerOS: Build Self Profile`

### 技能分数不准确

**症状**: 技能熟练度与预期不符

**解决方案**:

1. 检查时间衰减：
   - 旧项目的技能分数会降低
   - 这是预期行为

2. 检查笔记类型：
   - `project` 类型权重最高
   - 确认笔记被正确分类

3. 检查证据笔记：
   - 在 Dashboard 中查看技能详情
   - 确认关联的笔记正确

### JD 重复

**症状**: 同一 JD 生成多个 Card

**解决方案**:

1. 系统使用内容哈希去重
2. 如果仍有重复：
   - 检查 JD 内容是否有细微差异
   - 手动删除重复的 Card

### 差距分析不准确

**症状**: 匹配度或差距识别有误

**解决方案**:

1. 确保数据充足：
   - SelfProfile 需要足够的 NoteCard
   - MarketProfile 需要足够的 JDCard

2. 检查 Taxonomy 配置：
   - 技能名称需要正确映射

3. 重新生成分析：
   - 更新画像后重新运行分析

## 错误日志解读

### 日志位置

```
CareerOS/error_log.md
```

### 日志格式

```markdown
## 2024-12-08T10:30:00.000Z

- **Path**: projects/my-project.md
- **Attempts**: 3
- **Error**: Failed to parse JSON: Unexpected token...

---
```

### 常见错误类型

| 错误类型 | 说明 | 解决方案 |
|----------|------|----------|
| `LLM Error` | LLM 调用失败 | 检查 API 配置 |
| `JSON Parse Error` | JSON 解析失败 | 检查 LLM 输出 |
| `Schema Validation Error` | 数据格式错误 | 检查 Prompt |
| `File System Error` | 文件操作失败 | 检查权限 |
| `Timeout Error` | 请求超时 | 增加超时时间 |

### 清理错误日志

如果日志过大，可以手动清理：

1. 打开 `CareerOS/error_log.md`
2. 保留最近的错误记录
3. 删除旧记录

## 获取帮助

如果以上方案无法解决问题：

1. **查看控制台日志**:
   - 打开 Obsidian 开发者工具 (`Ctrl/Cmd + Shift + I`)
   - 查看 Console 标签页

2. **提交 Issue**:
   - 访问 [GitHub Issues](https://github.com/CodeVoyager21932/obsidian_chajian/issues)
   - 提供详细的错误信息和复现步骤

3. **提供信息**:
   - Obsidian 版本
   - 插件版本
   - 操作系统
   - 错误日志内容
   - 相关配置（隐藏敏感信息）

## 相关文档

- [README.md](./README.md) - 项目概述和快速开始
- [CONFIGURATION.md](./CONFIGURATION.md) - 详细配置说明

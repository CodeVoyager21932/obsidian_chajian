# CareerOS 示例文档

本文档提供 CareerOS 的输入输出示例，帮助您理解系统的工作方式。

## 目录

- [NoteCard 提取示例](#notecard-提取示例)
- [JDCard 提取示例](#jdcard-提取示例)
- [SelfProfile 示例](#selfprofile-示例)
- [MarketProfile 示例](#marketprofile-示例)
- [差距分析示例](#差距分析示例)
- [行动计划示例](#行动计划示例)

## NoteCard 提取示例

### 输入：项目笔记

```markdown
# 电商后台管理系统

## 项目概述
2023年3月至2023年8月，我负责开发公司内部的电商后台管理系统。

## 技术栈
- 后端：Python + Django + Django REST Framework
- 数据库：PostgreSQL + Redis
- 前端：React + TypeScript + Ant Design
- 部署：Docker + Kubernetes

## 主要工作
1. 设计并实现了商品管理模块，支持 SKU 管理和库存同步
2. 开发了订单处理流水线，日处理订单量 5000+
3. 实现了基于 Redis 的缓存层，将 API 响应时间降低 60%

## 收获
这个项目让我对分布式系统有了更深的理解。我特别喜欢解决高并发场景下的技术挑战。
```

### 输出：NoteCard JSON

```json
{
  "schema_version": 1,
  "note_path": "projects/ecommerce-backend.md",
  "hash": "a1b2c3d4",
  "summary": "电商后台管理系统开发项目，负责商品管理、订单处理和缓存优化",
  "type": "project",
  "time_span": "2023-03 到 2023-08",
  "tech_stack": [
    {
      "name": "Python",
      "context": "后端开发主语言",
      "level": "熟练"
    },
    {
      "name": "Django",
      "context": "Web 框架，配合 Django REST Framework",
      "level": "熟练"
    },
    {
      "name": "PostgreSQL",
      "context": "主数据库",
      "level": "熟悉"
    },
    {
      "name": "Redis",
      "context": "缓存层实现",
      "level": "熟悉"
    },
    {
      "name": "React",
      "context": "前端开发",
      "level": "熟悉"
    },
    {
      "name": "TypeScript",
      "context": "前端类型安全",
      "level": "熟悉"
    },
    {
      "name": "Docker",
      "context": "容器化部署",
      "level": "熟悉"
    },
    {
      "name": "Kubernetes",
      "context": "容器编排",
      "level": "入门"
    }
  ],
  "topics": ["电商", "后台管理", "分布式系统", "高并发"],
  "preferences": {
    "likes": ["解决高并发场景下的技术挑战"],
    "dislikes": [],
    "traits": []
  },
  "evidence": [
    "设计并实现了商品管理模块，支持 SKU 管理和库存同步",
    "开发了订单处理流水线，日处理订单量 5000+",
    "实现了基于 Redis 的缓存层，将 API 响应时间降低 60%"
  ],
  "last_updated": "2023-08",
  "detected_date": "2024-12-08T10:00:00.000Z",
  "status": "draft"
}
```

## JDCard 提取示例

### 输入：招聘信息笔记

```markdown
# 杭州 Python 后端岗位收集

## 岗位 1：阿里巴巴 - Python 后端工程师

**地点**：杭州
**薪资**：25k-40k * 16薪

### 岗位要求
- 本科及以上学历，计算机相关专业
- 3年以上 Python 后端开发经验
- 熟练掌握 Django 或 Flask 框架
- 熟悉 MySQL、Redis、MongoDB 等数据库
- 了解分布式系统设计原理
- 有大规模系统开发经验优先

### 加分项
- 熟悉 Kubernetes、Docker
- 有机器学习相关经验
- 良好的英语读写能力

---

## 岗位 2：网易 - 高级 Python 开发

**地点**：杭州
**薪资**：30k-50k

### 岗位要求
- 本科及以上学历
- 5年以上 Python 开发经验
- 精通 Python 异步编程
- 熟悉微服务架构
- 有团队管理经验优先
```

### 输出：JDCard JSON 数组

```json
[
  {
    "schema_version": 1,
    "jd_id": "550e8400-e29b-41d4-a716-446655440001",
    "source_note": "market/hangzhou-python-jobs.md",
    "company": "阿里巴巴",
    "title": "Python 后端工程师",
    "location": "杭州",
    "salary_range": "25k-40k * 16薪",
    "skills_required": [
      "Python",
      "Django",
      "Flask",
      "MySQL",
      "Redis",
      "MongoDB",
      "分布式系统"
    ],
    "skills_optional": [
      "Kubernetes",
      "Docker",
      "机器学习",
      "英语"
    ],
    "experience": "3年以上",
    "degree": "本科",
    "raw_text_hash": "abc123def456",
    "tags": ["互联网", "后端", "Python", "大厂"],
    "created_at": "2024-12-08T10:00:00.000Z",
    "updated_at": "2024-12-08T10:00:00.000Z"
  },
  {
    "schema_version": 1,
    "jd_id": "550e8400-e29b-41d4-a716-446655440002",
    "source_note": "market/hangzhou-python-jobs.md",
    "company": "网易",
    "title": "高级 Python 开发",
    "location": "杭州",
    "salary_range": "30k-50k",
    "skills_required": [
      "Python",
      "Python 异步编程",
      "微服务架构"
    ],
    "skills_optional": [
      "团队管理"
    ],
    "experience": "5年以上",
    "degree": "本科",
    "raw_text_hash": "xyz789ghi012",
    "tags": ["互联网", "后端", "Python", "高级"],
    "created_at": "2024-12-08T10:00:00.000Z",
    "updated_at": "2024-12-08T10:00:00.000Z"
  }
]
```

## SelfProfile 示例

### 输出：SelfProfile JSON

```json
{
  "schema_version": 1,
  "skills": [
    {
      "name": "Python",
      "category": "language",
      "level": 4.5,
      "evidence_notes": [
        "projects/ecommerce-backend.md",
        "projects/data-pipeline.md",
        "courses/python-advanced.md"
      ],
      "last_active": "2024-11-15"
    },
    {
      "name": "Django",
      "category": "framework",
      "level": 4.0,
      "evidence_notes": [
        "projects/ecommerce-backend.md",
        "projects/blog-system.md"
      ],
      "last_active": "2024-10-20"
    },
    {
      "name": "React",
      "category": "framework",
      "level": 3.5,
      "evidence_notes": [
        "projects/ecommerce-backend.md",
        "courses/react-hooks.md"
      ],
      "last_active": "2024-09-10"
    },
    {
      "name": "PostgreSQL",
      "category": "database",
      "level": 3.2,
      "evidence_notes": [
        "projects/ecommerce-backend.md"
      ],
      "last_active": "2024-08-15"
    },
    {
      "name": "Redis",
      "category": "database",
      "level": 3.0,
      "evidence_notes": [
        "projects/ecommerce-backend.md"
      ],
      "last_active": "2024-08-15"
    }
  ],
  "preferences": {
    "likes": [
      "解决高并发场景下的技术挑战",
      "学习新技术",
      "代码重构"
    ],
    "dislikes": [
      "重复性工作",
      "文档编写"
    ],
    "traits": [
      "注重代码质量",
      "善于沟通"
    ]
  },
  "projects": [
    {
      "note_path": "projects/ecommerce-backend.md",
      "summary": "电商后台管理系统开发项目",
      "tech_stack": [
        {"name": "Python", "context": "后端开发", "level": "熟练"},
        {"name": "Django", "context": "Web 框架", "level": "熟练"}
      ],
      "time_span": "2023-03 到 2023-08"
    }
  ],
  "analysis_view": {
    "top_skills": [
      {"name": "Python", "category": "language", "level": 4.5, "evidence_notes": [], "last_active": "2024-11-15"},
      {"name": "Django", "category": "framework", "level": 4.0, "evidence_notes": [], "last_active": "2024-10-20"},
      {"name": "React", "category": "framework", "level": 3.5, "evidence_notes": [], "last_active": "2024-09-10"}
    ],
    "recent_projects": [
      {
        "note_path": "projects/ecommerce-backend.md",
        "summary": "电商后台管理系统开发项目",
        "tech_stack": [],
        "time_span": "2023-03 到 2023-08"
      }
    ]
  },
  "last_built": "2024-12-08T10:00:00.000Z"
}
```

## MarketProfile 示例

### 输出：MarketProfile JSON

```json
{
  "schema_version": 1,
  "role": "Python 后端",
  "location": "杭州",
  "skills_demand": [
    {
      "name": "Python",
      "frequency": 20,
      "experience_hint": ["3年以上", "5年以上"]
    },
    {
      "name": "Django",
      "frequency": 15,
      "experience_hint": ["熟练掌握"]
    },
    {
      "name": "MySQL",
      "frequency": 14,
      "experience_hint": []
    },
    {
      "name": "Redis",
      "frequency": 12,
      "experience_hint": []
    },
    {
      "name": "分布式系统",
      "frequency": 10,
      "experience_hint": ["了解原理"]
    },
    {
      "name": "Docker",
      "frequency": 8,
      "experience_hint": []
    },
    {
      "name": "Kubernetes",
      "frequency": 6,
      "experience_hint": []
    }
  ],
  "soft_requirements": [
    "学历要求 本科: 8个岗位 (80%)",
    "学历要求 硕士: 2个岗位 (20%)"
  ],
  "experience_distribution": {
    "3年以上": 5,
    "5年以上": 3,
    "1-3年": 2
  },
  "sample_jd_ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "last_built": "2024-12-08T10:00:00.000Z"
}
```

## 差距分析示例

### 输出：Gap Analysis Markdown

```markdown
---
type: gap_analysis
target_role: "Python 后端"
target_location: "杭州"
match_percentage: 72.5
strengths_count: 4
gaps_count: 3
generated_at: "2024-12-08T10:00:00.000Z"
source_self_profile: "self_profile_2024-12-08.json"
source_market_profile: "market_python_backend_hangzhou_2024-12-08.json"
schema_version: 1
---

# Gap Analysis Summary

## Overview
- **Target Role**: Python 后端
- **Target Location**: 杭州
- **Match Percentage**: 72.5%
- **Generated**: 2024-12-08T10:00:00.000Z

## Quick Stats
- **Strengths Identified**: 4
- **Gaps Identified**: 3
- **High Priority Gaps**: 1

---

## 差距分析摘要

### 匹配度评估
- 整体匹配度：72.5%
- 核心技能匹配：Python、Django、Redis
- 关键差距：分布式系统、Kubernetes

### 优势分析
- **Python** - 熟练度超出市场平均要求
- **Django** - 有丰富的项目经验
- **Redis** - 有实际的缓存优化经验
- **高并发处理** - 有日处理 5000+ 订单的经验

### 差距分析
| 技能 | 市场需求度 | 当前水平 | 优先级 | 建议提升方式 |
|------|-----------|---------|--------|-------------|
| 分布式系统 | 10 | 2.0 | 高 | 系统学习 + 实践项目 |
| Kubernetes | 6 | 1.0 | 中 | 在线课程 + 本地实验 |
| 微服务架构 | 5 | 1.5 | 中 | 阅读文档 + 重构现有项目 |
```

## 行动计划示例

### 输出：Action Plan Markdown

```markdown
---
type: action_plan
role: "Python 后端"
location: "杭州"
period: "3 个月"
weekly_hours: 10
generated_at: "2024-12-08T10:00:00.000Z"
source_self_profile: "self_profile_2024-12-08.json"
source_market_profile: "market_python_backend_hangzhou_2024-12-08.json"
schema_version: 1
---

# 行动计划

## 计划概览
- **目标岗位**: Python 后端
- **目标地点**: 杭州
- **计划周期**: 3 个月
- **每周可用时间**: 10 小时
- **生成时间**: 2024-12-08T10:00:00.000Z

---

## 阶段性目标

### 第一阶段（第 1-4 周）：分布式系统基础

**目标**：建立分布式系统的理论基础，理解核心概念

**关键成果**：
- 完成《Designing Data-Intensive Applications》前 6 章阅读
- 能够解释 CAP 定理、一致性模型、分区策略

### 第二阶段（第 5-8 周）：Kubernetes 实践

**目标**：掌握 Kubernetes 基本操作，能够部署和管理应用

**关键成果**：
- 完成 Kubernetes 官方教程
- 在本地搭建 K8s 集群并部署一个 Django 应用

### 第三阶段（第 9-12 周）：微服务实战

**目标**：将现有项目改造为微服务架构

**关键成果**：
- 完成一个微服务 Demo 项目
- 实现服务发现、负载均衡、熔断等功能

## 每周任务清单

### 第 1 周
- [ ] 阅读 DDIA 第 1-2 章（4 小时）
- [ ] 观看分布式系统入门视频（3 小时）
- [ ] 整理笔记，总结关键概念（3 小时）

**本周重点**：理解分布式系统的基本挑战和解决思路

### 第 2 周
- [ ] 阅读 DDIA 第 3-4 章（4 小时）
- [ ] 实践：搭建 Redis 集群（3 小时）
- [ ] 学习 Redis 分布式锁实现（3 小时）

**本周重点**：理解数据存储和复制策略

### 第 5 周
- [ ] 安装 minikube，搭建本地 K8s 环境（3 小时）
- [ ] 完成 K8s 官方教程 Part 1-3（4 小时）
- [ ] 编写第一个 Deployment YAML（3 小时）

**本周重点**：熟悉 K8s 基本概念和操作

## 学习资源推荐

### 分布式系统
- **入门**：《Designing Data-Intensive Applications》
- **进阶**：MIT 6.824 分布式系统课程
- **实战**：搭建 Redis Cluster、Kafka 集群

### Kubernetes
- **入门**：Kubernetes 官方文档和教程
- **进阶**：《Kubernetes in Action》
- **实战**：在 minikube 上部署完整应用

### 微服务
- **入门**：《微服务设计》
- **进阶**：Spring Cloud / Go-kit 文档
- **实战**：将单体应用拆分为微服务

## 里程碑检查点

| 检查点 | 时间 | 验收标准 |
|--------|------|---------|
| 分布式基础 | 第 4 周 | 能够解释 CAP、Paxos、Raft 等核心概念 |
| K8s 入门 | 第 8 周 | 能够独立部署和管理 K8s 应用 |
| 微服务实战 | 第 12 周 | 完成一个包含 3+ 服务的微服务项目 |
```

## 相关文档

- [README.md](./README.md) - 项目概述和快速开始
- [CONFIGURATION.md](./CONFIGURATION.md) - 详细配置说明
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 故障排除指南

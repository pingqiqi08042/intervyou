# IntervYOU — 技术实施方案

> **版本**: v1.0 | **日期**: 2026-07-11 | **对应 PRD**: [PRD.md](./PRD.md)

---

## 目录

1. [架构总览](#1-架构总览)
2. [技术选型](#2-技术选型)
3. [项目结构](#3-项目结构)
4. [数据模型](#4-数据模型)
5. [API 设计](#5-api-设计)
6. [Agent 设计（核心）](#6-agent-设计核心)
7. [语音方案](#7-语音方案)
8. [前端组件设计](#8-前端组件设计)
9. [关键实现细节](#9-关键实现细节)
10. [部署方案](#10-部署方案)
11. [开发排期](#11-开发排期)

---

## 1. 架构总览

```
┌──────────────────────────────────────────────────────┐
│                      客户端（浏览器）                   │
│  ┌─────────────┐  ┌──────────┐  ┌────────────────┐   │
│  │ 面试聊天界面  │  │ 简历上传  │  │ 复盘报告查看    │   │
│  └──────┬──────┘  └────┬─────┘  └───────┬────────┘   │
│         │              │                │            │
│    ┌────┴────┐    ┌────┴────┐     ┌─────┴─────┐      │
│    │ Web     │    │ File    │     │ Chart.js  │      │
│    │ Speech  │    │ Upload  │     │ 雷达图     │      │
│    │ API     │    │ API     │     │           │      │
│    └────┬────┘    └────┬────┘     └─────┬─────┘      │
└─────────┼──────────────┼───────────────┼─────────────┘
          │              │               │
    ┌─────┴──────────────┴───────────────┴─────────────┐
    │              Next.js 服务端                        │
    │                                                    │
    │  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
    │  │ API      │  │ Interview │  │ Resume        │   │
    │  │ Routes   │  │ Engine    │  │ Parser        │   │
    │  └────┬─────┘  └─────┬────┘  └──────┬────────┘   │
    │       │              │              │             │
    │  ┌────┴─────┐   ┌────┴────┐  ┌──────┴────────┐   │
    │  │ Prisma   │   │ Claude  │  │ pdf-parse /   │   │
    │  │ ORM      │   │ API     │  │ mammoth       │   │
    │  └────┬─────┘   └─────────┘  └───────────────┘   │
    └───────┼───────────────────────────────────────────┘
            │
    ┌───────┴───────────┐
    │   SQLite (本地)    │
    │   或 PostgreSQL   │
    └───────────────────┘
```

**架构说明：**

- **Next.js 统一前后端**：API Routes 处理业务逻辑，React Server Components 做首屏渲染
- **Claude API 是核心引擎**：所有面试对话生成、评估、复盘都由 Claude 驱动
- **SQLite MVP → PostgreSQL 生产**：开发阶段零配置，上线迁移无缝
- **Web Speech API 做语音**：浏览器原生能力，零额外成本，MVP 够用

---

## 2. 技术选型

### 2.1 前端

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|---------|
| Next.js | 14 (App Router) | 全栈框架 | API Routes + React 一体，部署简单 |
| TypeScript | 5.x | 类型安全 | 减少运行时错误，代码可维护 |
| Tailwind CSS | 3.x | 样式 | 快速开发，响应式友好 |
| shadcn/ui | latest | UI 组件库 | 基于 Radix，无障碍，可定制 |
| Framer Motion | 11.x | 动画 | 聊天消息过渡动画 |
| Recharts | 2.x | 图表 | 面试能力雷达图 |
| react-markdown | 9.x | 渲染 | 复盘报告 markdown 渲染 |

### 2.2 后端

| 技术 | 用途 | 选型理由 |
|------|------|---------|
| Next.js API Routes | HTTP 接口 | 无需独立后端服务 |
| Prisma | ORM | 类型安全，迁移简单 |
| SQLite → PostgreSQL | 数据库 | 开发零配置，生产可迁移 |
| Anthropic SDK | Claude API 调用 | 官方 SDK，支持 streaming |
| pdf-parse | PDF 文本提取 | 轻量，纯 JS |
| mammoth | Word 文本提取 | 支持 .docx |

### 2.3 AI / Agent

| 技术 | 用途 |
|------|------|
| Claude Sonnet 5 | 主力模型（面试对话+评估） |
| Claude Haiku 4.5 | 轻量任务（简历解析、简单分类） |
| Prompt Engineering | 面试官角色定义、追问决策、评估体系 |
| Streaming | 逐字输出面试官消息（提升体验） |

### 2.4 语音

| 阶段 | STT（语音→文字） | TTS（文字→语音） |
|------|------------------|------------------|
| MVP | Web Speech API（浏览器内置） | 暂不做，输出文本 |
| V2 | Deepgram 流式 STT | ElevenLabs / Edge TTS |

---

## 3. 项目结构

```
interview-coach/
├── prisma/
│   └── schema.prisma              # 数据库 schema
│
├── public/
│   ├── favicon.ico
│   └── og-image.png               # 社交分享图
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # 根布局
│   │   ├── page.tsx               # 首页（上传简历入口）
│   │   ├── globals.css            # Tailwind 全局样式
│   │   │
│   │   ├── setup/                 # 面试设置页
│   │   │   └── page.tsx           # 选择模式 + 难度
│   │   │
│   │   ├── interview/             # 面试页
│   │   │   └── [sessionId]/
│   │   │       └── page.tsx       # 面试聊天界面
│   │   │
│   │   ├── report/                # 报告页
│   │   │   └── [sessionId]/
│   │   │       └── page.tsx       # 复盘报告
│   │   │
│   │   └── api/                   # API Routes
│   │       ├── resumes/
│   │       │   ├── route.ts       # POST 上传简历
│   │       │   └── [id]/
│   │       │       └── route.ts   # GET 简历详情
│   │       ├── sessions/
│   │       │   ├── route.ts       # POST 创建面试会话
│   │       │   └── [id]/
│   │       │       ├── route.ts   # GET 会话详情
│   │       │       └── chat/
│   │       │           └── route.ts # POST 发送消息
│   │       └── feedback/
│   │           └── [sessionId]/
│   │               └── route.ts   # GET 复盘报告
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn/ui 组件
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── select.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ...
│   │   │
│   │   ├── ResumeUploader.tsx     # 简历上传组件（拖拽+预览）
│   │   ├── ResumePreview.tsx      # 简历结构化预览（可编辑）
│   │   ├── ModeSelector.tsx       # 面试模式选择卡片
│   │   ├── DifficultySelector.tsx # 难度滑块/选择
│   │   ├── ChatInterface.tsx      # 面试聊天主界面
│   │   ├── ChatBubble.tsx         # 单条消息气泡
│   │   ├── ChatInput.tsx          # 输入框（文本+语音按钮）
│   │   ├── VoiceButton.tsx        # 语音录制按钮
│   │   ├── InterviewStatusBar.tsx # 顶部状态栏（进度/模式/难度）
│   │   ├── FeedbackReport.tsx     # 复盘报告渲染
│   │   ├── RadarChart.tsx         # 能力雷达图
│   │   ├── ScoreCard.tsx          # 评分卡片
│   │   └── EndInterviewDialog.tsx # 结束面试确认弹窗
│   │
│   ├── lib/
│   │   ├── claude.ts              # Claude API 客户端封装
│   │   ├── prompts/               # System Prompt 管理
│   │   │   ├── index.ts           # prompt 导出入口
│   │   │   ├── base.ts            # 基础面试官角色
│   │   │   ├── modes.ts           # 四种模式的 prompt
│   │   │   ├── difficulty.ts      # 三种难度的行为指令
│   │   │   └── evaluation.ts      # 评估 prompt 模板
│   │   ├── resume-parser.ts       # 简历解析逻辑
│   │   ├── interview-engine.ts    # 面试引擎（消息→Claude→响应）
│   │   ├── scoring.ts             # 评分计算逻辑
│   │   ├── speech.ts              # 语音相关工具函数
│   │   └── utils.ts               # 通用工具
│   │
│   ├── hooks/
│   │   ├── useInterview.ts        # 面试核心状态管理
│   │   ├── useVoice.ts            # 语音录制 hook
│   │   └── useAutoScroll.ts       # 聊天自动滚动
│   │
│   └── types/
│       └── index.ts               # TypeScript 类型定义
│
├── docs/
│   ├── PRD.md
│   └── TECHNICAL_PLAN.md          # 本文件
│
├── .env.local                     # 环境变量（Claude API Key 等）
├── .env.example                   # 环境变量模板
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── README.md
```

---

## 4. 数据模型

### 4.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"    // MVP 用 SQLite，生产改为 "postgresql"
  url      = env("DATABASE_URL")
}

model Resume {
  id          String             @id @default(cuid())
  fileName    String
  rawText     String             // 原始提取文本
  parsedData  String             // JSON string — AI 结构化后的数据
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  sessions    InterviewSession[]
}

model InterviewSession {
  id             String             @id @default(cuid())
  resumeId       String
  resume         Resume             @relation(fields: [resumeId], references: [id])
  mode           InterviewMode      // 面试模式
  difficulty     Difficulty          // 难度等级
  status         SessionStatus       // 状态
  currentPhase   InterviewPhase?     // 当前阶段（综合模式用）
  questionIndex  Int                @default(0) // 当前问题序号
  messages       Message[]
  feedback       Feedback?
  createdAt      DateTime           @default(now())
  completedAt    DateTime?
}

model Message {
  id          String    @id @default(cuid())
  sessionId   String
  session     InterviewSession @relation(fields: [sessionId], references: [id])
  role        MessageRole      // interviewer | candidate | system
  content     String
  metadata    String?          // JSON — 内部评分、追问决策等（候选人不看到）
  createdAt   DateTime  @default(now())
}

model Feedback {
  id              String           @id @default(cuid())
  sessionId       String           @unique
  session         InterviewSession @relation(fields: [sessionId], references: [id])
  overallScore    Int              // 0-100
  dimensionScores String           // JSON: { starCompleteness: 65, quantification: 58, ... }
  strengths       String           // JSON: string[]
  improvements    String           // JSON: { questionIndex: number, issue: string, suggestion: string }[]
  fullReport      String           // Markdown — 完整报告文本
  createdAt       DateTime         @default(now())
}

// ── 枚举 ──

enum InterviewMode {
  RESUME_DEEP_DIVE   // 简历深挖
  BEHAVIORAL         // 行为面试
  TECHNICAL          // 技术面试
  COMPREHENSIVE      // 综合模拟
}

enum Difficulty {
  FRIENDLY    // 友好
  STANDARD    // 标准
  PRESSURE    // 压力
}

enum SessionStatus {
  SETUP       // 配置中
  IN_PROGRESS // 进行中
  COMPLETED   // 已结束
}

enum MessageRole {
  INTERVIEWER // 面试官
  CANDIDATE   // 候选人
  SYSTEM      // 系统消息（阶段切换等）
}

enum InterviewPhase {
  OPENING      // 开场
  SELF_INTRO   // 自我介绍
  RESUME_DEEP  // 简历深挖
  BEHAVIORAL_Q // 行为问题
  SITUATIONAL  // 情景假设
  REVERSE_Q    // 反问环节
  CLOSING      // 结束
}
```

### 4.2 核心类型定义

```typescript
// src/types/index.ts

// ── 简历相关 ──
export interface ParsedResume {
  name: string;
  education: Education[];
  experiences: Experience[];
  skills: string[];
  projects: Project[];
  certifications?: string[];
  languages?: string[];
}

export interface Education {
  school: string;
  degree: string;        // 本科/硕士/博士
  major: string;
  year: string;          // 毕业年份
  gpa?: string;
}

export interface Experience {
  type: 'internship' | 'fulltime' | 'project' | 'activity';
  company: string;
  role: string;
  duration: string;      // "2025.06 - 2025.09"
  description: string;
  highlights: string[];  // AI 提取的亮点
  techStack?: string[];
}

export interface Project {
  name: string;
  role: string;
  description: string;
  highlights: string[];
  techStack?: string[];
}

// ── 面试相关 ──
export type InterviewMode = 'resume_deep_dive' | 'behavioral' | 'technical' | 'comprehensive';
export type Difficulty = 'friendly' | 'standard' | 'pressure';
export type SessionStatus = 'setup' | 'in_progress' | 'completed';
export type InterviewPhase = 'opening' | 'self_intro' | 'resume_deep' | 'behavioral_q' | 'situational' | 'reverse_q' | 'closing';

export interface InterviewConfig {
  resumeId: string;
  mode: InterviewMode;
  difficulty: Difficulty;
}

export interface ChatMessage {
  id: string;
  role: 'interviewer' | 'candidate' | 'system';
  content: string;
  metadata?: MessageMetadata; // 内部评估数据（面试结束后展示）
  createdAt: string;
}

export interface MessageMetadata {
  evaluation?: AnswerEvaluation;
  phase?: InterviewPhase;
  questionIndex?: number;
}

export interface AnswerEvaluation {
  starCompleteness: number;   // 1-5
  quantification: number;     // 1-5
  logicClarity: number;       // 1-5
  technicalDepth: number;     // 1-5
  communication: number;      // 1-5
  notes: string;              // 内部评语
  followUpNeeded: boolean;    // 是否需要追问
  followUpReason?: string;    // 追问原因
}

// ── 复盘相关 ──
export interface FeedbackReport {
  overallScore: number;
  dimensionScores: {
    starCompleteness: number;
    quantification: number;
    logicClarity: number;
    technicalDepth: number;
    communication: number;
  };
  strengths: string[];
  improvements: ImprovementItem[];
  questionReviews: QuestionReview[];
  resumeSuggestions: ResumeSuggestion[];
  fullReport: string; // Markdown
}

export interface ImprovementItem {
  questionIndex: number;
  issue: string;
  suggestion: string;
  rewriteExample: string;
}

export interface QuestionReview {
  questionIndex: number;
  question: string;
  answer: string;
  rating: 'green' | 'yellow' | 'red';
  comment: string;
}

export interface ResumeSuggestion {
  experienceIndex: number;
  issue: string;
  suggestion: string;
}
```

---

## 5. API 设计

### 5.1 接口一览

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| `POST` | `/api/resumes` | 上传简历 | FormData (file) | `{ id, parsedData }` |
| `GET` | `/api/resumes/[id]` | 获取简历详情 | — | `Resume` |
| `POST` | `/api/sessions` | 创建面试会话 | `{ resumeId, mode, difficulty }` | `{ sessionId }` |
| `GET` | `/api/sessions/[id]` | 获取会话详情 | — | `InterviewSession` |
| `POST` | `/api/sessions/[id]/chat` | 发送候选人的回答 | `{ content }` | `ChatMessage` (面试官回复) |
| `GET` | `/api/sessions/[id]/feedback` | 获取/生成复盘报告 | — | `FeedbackReport` |

### 5.2 核心接口详细设计

#### `POST /api/resumes` — 上传简历

```
Request:  multipart/form-data { file: File }
Response: {
  id: string,
  fileName: string,
  parsedData: ParsedResume,
  rawText: string
}

流程：
1. 接收文件 → 保存到 /tmp
2. pdf-parse / mammoth 提取文本
3. 调用 Claude Haiku 进行结构化提取
4. 存入数据库 → 返回 parsedData
```

#### `POST /api/sessions` — 创建面试

```
Request:  { resumeId: string, mode: string, difficulty: string }
Response: {
  sessionId: string,
  openingMessage: ChatMessage  // 面试官开场白（首条消息）
}

流程：
1. 校验参数 → 查询简历
2. 构建 System Prompt（简历 + 模式 + 难度）
3. 生成开场白消息（不走 chat 接口，直接生成）
4. 创建 Session + 首条 Message → 返回
```

#### `POST /api/sessions/[id]/chat` — 面试对话

```
Request:  { content: string }  // 候选人的回答
Response: {
  message: ChatMessage,        // 面试官回复
  phase?: InterviewPhase,      // 当前阶段（综合模式）
  isComplete?: boolean          // 面试是否结束
}

流程：
1. 获取会话上下文（简历 + 历史消息 + 模式/难度）
2. 构建 messages 数组：[system_prompt, ...history, user_message]
3. 调用 Claude API (streaming)
4. Claude 返回：面试官回复 + 内部评估（metadata）
5. 保存消息 → 返回面试官消息
6. 判断面试是否结束（轮次达到上限 / Claude 发出结束信号）
```

#### `GET /api/sessions/[id]/feedback` — 复盘报告

```
Response: FeedbackReport

流程：
1. 获取完整对话历史
2. 将全部消息组装为评估 prompt
3. 调用 Claude 生成结构化复盘报告
4. 解析结构化数据 + 保留完整 Markdown
5. 保存 Feedback → 返回
```

---

## 6. Agent 设计（核心）

### 6.1 设计理念

IntervYOU 的 Agent 不是 "聊天机器人 + 题库"，而是一个 **有决策能力的面试官**。核心设计原则：

1. **简历驱动**：所有问题从简历出发，不是从题库出发
2. **动态追问**：根据回答质量实时决定追问深度，而非预设脚本
3. **评估内化**：Agent 在每次回答后内部评估，但不直接告诉候选人（保留到复盘）
4. **角色一致**：整个面试过程保持同一个面试官人格

### 6.2 System Prompt 架构

```
┌─────────────────────────────────────────────┐
│              SYSTEM PROMPT                    │
│                                               │
│  ┌─────────────────────────────────────┐     │
│  │  1. 角色定义 (Role Definition)        │     │
│  │  - 你是谁、你的风格、你的目标           │     │
│  └─────────────────────────────────────┘     │
│  ┌─────────────────────────────────────┐     │
│  │  2. 候选人档案 (Candidate Context)    │     │
│  │  - 简历结构化数据（注入）              │     │
│  └─────────────────────────────────────┘     │
│  ┌─────────────────────────────────────┐     │
│  │  3. 面试模式指令 (Mode Instructions)  │     │
│  │  - 简历深挖/行为/技术/综合 的行为差异   │     │
│  └─────────────────────────────────────┘     │
│  ┌─────────────────────────────────────┐     │
│  │  4. 难度行为指令 (Difficulty Rules)   │     │
│  │  - 友好/标准/压力的追问和语气差异      │     │
│  └─────────────────────────────────────┘     │
│  ┌─────────────────────────────────────┐     │
│  │  5. 追问决策框架 (Follow-up Logic)    │     │
│  │  - 什么时候追、追多深、什么时候换题    │     │
│  └─────────────────────────────────────┘     │
│  ┌─────────────────────────────────────┐     │
│  │  6. 内部评估规范 (Evaluation Rules)   │     │
│  │  - 五个维度的评分标准                  │     │
│  │  - 不直接输出评分（保留内部）          │     │
│  └─────────────────────────────────────┘     │
│  ┌─────────────────────────────────────┐     │
│  │  7. 输出格式 (Output Format)          │     │
│  │  - JSON 结构：对话内容 + 内部评估       │     │
│  └─────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

### 6.3 Base System Prompt（核心）

```
你是一名专业的校招面试官，你正在面试一位应届毕业生。

## 你的身份
- 你在一家中大型互联网公司担任技术/产品方向的面试官
- 你有 8 年以上的面试经验，面试过 500+ 位候选人
- 你擅长通过深度追问来判断候选人的真实水平
- 你的面试风格会根据「难度设定」动态调整（见下方指令）

## 候选人档案
{候选人简历结构化数据，JSON 格式注入}

## 面试模式：{mode}
## 难度等级：{difficulty}

---

# 核心行为准则

## 1. 问题来源
- **所有问题必须从候选人的简历出发**。针对简历中的实习经历、项目经历、技能
  逐一提问。
- 禁止使用与简历无关的泛泛而谈的问题。
- 优先追问候选人简历中最有含金量的经历。

## 2. 追问规则
你需要根据候选人的回答质量，动态决定追问策略：

| 回答质量 | 追问策略 |
|---------|---------|
| 回答扎实、有细节、有数据 | 深入一层追问（验证深度） |
| 回答模糊、缺少细节 | 要求具体化："你能举个具体例子吗？" |
| 回答中出现矛盾或漏洞 | 指出矛盾："你刚才说X，但现在又说Y，能解释一下吗？" |
| 明显在编造或夸大 | 温和质疑："这个项目中你具体负责了哪个部分？" |
| 完全答不上来 | 给一次提示机会（友好模式）/ 记录下来并换题（标准/压力模式） |

追问深度控制：
- 每个话题最多追问 2-3 层（友好模式）/ 3-4 层（标准模式）/ 4-5 层（压力模式）
- 当候选人在某个话题上已经展示了足够的深度，可以切换到下一个话题
- 当候选人明显无法继续回答时，不要在同一个点上死磕

## 3. 难度行为差异

### 友好模式 (friendly)
- 语气温暖、鼓励："没关系，你可以想一想" / "已经回答得很好了"
- 候选人答不上来时，给出引导性提示
- 追问 1-2 层即可
- 评分标准宽松

### 标准模式 (standard)
- 语气专业、中立
- 候选人答不上来时，不提示，直接换下一个问题
- 追问 2-3 层
- 评分标准正常

### 压力模式 (pressure)
- 语气冷静、略带质疑
- 持续追问细节直到候选人无法回答
- 对模糊回答直接指出："这个回答太虚了，我需要你更具体"
- 追问 3-5 层
- 评分标准严格
- 可以适当制造时间压力："你还有 30 秒，请用一句话总结"

## 4. 内部评估（不要告诉候选人）
在每次候选人回答后，你需要内部评估（在 metadata 中记录，不要输出给候选人）：

评估维度（1-5 分）：
- STAR 完整性：Situation-Task-Action-Result 是否完整？
- 量化能力：是否使用了具体数字、百分比？
- 逻辑清晰度：回答结构是否清晰、有条理？
- 技术/专业深度：对项目细节的掌握程度？
- 沟通表达：语言流畅度、自信度？

## 5. 面试节奏
- 单次回复控制在 50-150 字
- 每次只问一个问题
- 面试总轮次：8-15 轮
- 在以下情况结束面试：
  - 关键经历都已深挖完毕
  - 候选人连续 3 个问题回答质量很低
  - 达到预设轮次上限
  - 反问环节结束后（综合模式）

## 6. 禁止行为
- 禁止连续问 2 个以上不相关的问题
- 禁止对候选人的个人特质进行评价（"你很聪明"）
- 禁止透露内部评分
- 禁止使用面试题库式的机械语言
- 禁止在未完成追问的情况下跳过核心项目

---

# 输出格式

你的每次回复必须严格按以下 JSON 格式输出（不要输出其他内容）：

```json
{
  "message": "面试官对候选人说的话（50-150字）",
  "metadata": {
    "evaluation": {
      "starCompleteness": 4,
      "quantification": 2,
      "logicClarity": 4,
      "technicalDepth": 3,
      "communication": 4,
      "notes": "回答有逻辑但缺少具体数据支撑",
      "followUpNeeded": true,
      "followUpReason": "候选人提到提升了DAU但没有给出具体数字"
    },
    "phase": "resume_deep",
    "questionIndex": 3
  },
  "isComplete": false,
  "completionReason": null
}
```

- `message`：你对候选人说的话（纯文本，不透露评分）
- `metadata`：内部评估数据（用于后续复盘）
- `isComplete`：面试是否结束
- `completionReason`：如果结束，说明原因（如 "已完成所有项目深挖"）
```

### 6.4 不同模式的 Prompt 差异

**简历深挖模式 (resume_deep_dive) 增量指令：**
```
## 模式特定指令：简历深挖

你的任务是对候选人简历中的每一项经历进行深度追问。
流程：
1. 从最有亮点的经历开始
2. 针对每段经历追问：背景 → 具体行动 → 技术细节 → 量化结果 → 反思
3. 追问链示例：
   - "你在XX项目中具体做了什么？"
   - "这个方案为什么选择XX技术而不是YY？"
   - "过程中遇到的最大挑战是什么？"
   - "如果让你重做一次，你会怎么改进？"
4. 完成一段经历后，自然过渡到下一段
```

**行为面试模式 (behavioral) 增量指令：**
```
## 模式特定指令：行为面试

你的任务是围绕行为面试经典维度提问，所有问题必须结合候选人经历。
维度池：
- 领导力 / 主导项目
- 团队协作 / 处理分歧
- 解决复杂问题
- 抗压 / 失败经历
- 学习能力 / 快速上手
- 职业规划 / 自我认知

追问要求：确保每个回答符合 STAR 法则
- Situation: "当时是什么背景？"
- Task: "你的具体任务是什么？"
- Action: "你做了什么？为什么？"
- Result: "最终结果如何？怎么衡量的？"

如果候选人 STRA 但缺 R（结果），追问：
- "这个项目的结果怎么样？有数据可以分享吗？"
```

**技术面试模式 (technical) 增量指令：**
```
## 模式特定指令：技术面试

你的任务是综合考察候选人的技术能力：
1. 基础知识：根据简历中列出的技术栈，问 2-3 个基础但关键的问题
2. 项目中的技术决策：为什么选这个技术？有什么 trade-off？
3. 系统设计感：如果项目规模扩大 10 倍，架构需要怎么变？
4. 代码/算法：针对技术岗位，可以出 1-2 道思考题

注意：
- 技术问题必须与简历声称的技能匹配
- 不要脱离简历问冷门知识点
- 如果候选人简历写了 "熟悉 XX"，就追问 XX 的底层原理
```

**综合模拟模式 (comprehensive) 增量指令：**
```
## 模式特定指令：综合模拟

这是最接近真实面试的完整流程模拟。你需要按照以下阶段推进：

阶段 1 — 开场（1 轮）
- 简单寒暄 + 说明面试结构
- 发出 "请做一下自我介绍" 指令

阶段 2 — 自我介绍（1 轮）
- 候选人自我介绍后，简短确认，进入下一阶段
- 内部评估：是否超过 2 分钟、有无记忆点、结构是否清晰

阶段 3 — 简历深挖（3-5 轮）
- 同 "简历深挖模式" 的指令
- 挑选最有亮点的 1-2 段经历深挖

阶段 4 — 行为问题（2-3 轮）
- 同 "行为面试模式" 的指令
- 从简历经历出发适配问题

阶段 5 — 情景假设（1-2 轮）
- 出一个与目标岗位相关的情景题
- 例：产品岗 → "如果上线前一天发现关键 bug，作为 PM 你怎么决策？"

阶段 6 — 反问环节（1 轮）
- 发出 "我的问题问完了，你有什么想问我的吗？"
- 候选人的反问也要被评估（问题质量体现候选人的思考深度）

阶段 7 — 结束
- 简短结束语，不透露评价
- 标记 isComplete: true
```

### 6.5 Claude API 调用封装

```typescript
// src/lib/claude.ts

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function generateInterviewResponse(params: {
  systemPrompt: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  streaming?: boolean;
}): Promise<{
  message: string;
  metadata: any;
  isComplete: boolean;
}> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5-20250901',  // Sonnet 5，性价比最优
    max_tokens: 1024,
    system: params.systemPrompt,
    messages: params.messages,
    temperature: 0.7,  // 适度创造性，避免机械感
  });

  // 解析 Claude 返回的 JSON
  const text = response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
  
  try {
    // 尝试提取 JSON（Claude 可能会包在 ```json ``` 中）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    // 降级：如果 JSON 解析失败，直接当作纯文本问题返回
    console.error('Failed to parse Claude response as JSON:', e);
    return {
      message: text.trim(),
      metadata: {},
      isComplete: false,
    };
  }
}

// 流式版本（逐字输出，提升用户体验）
export async function* streamInterviewResponse(params: {
  systemPrompt: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}): AsyncGenerator<string> {
  const stream = await anthropic.messages.create({
    model: 'claude-sonnet-5-20250901',
    max_tokens: 1024,
    system: params.systemPrompt,
    messages: params.messages,
    temperature: 0.7,
    stream: true,
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
```

---

## 7. 语音方案

### 7.1 MVP 方案：Web Speech API

**只做 STT（语音输入），TTS 留到 V2。**

```typescript
// src/hooks/useVoice.ts

import { useState, useCallback, useRef } from 'react';

interface UseVoiceReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => Promise<string>;
  isSupported: boolean;
}

export function useVoice(): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';  // 支持中英文混合
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final || interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript('');
  }, [isSupported]);

  const stopListening = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = () => {
          setIsListening(false);
          resolve(transcript);
        };
        recognitionRef.current.stop();
      } else {
        setIsListening(false);
        resolve(transcript);
      }
    });
  }, [transcript]);

  return { isListening, transcript, startListening, stopListening, isSupported };
}
```

### 7.2 V2 升级路径

```
MVP (Web Speech API)                 V2 (Deepgram + ElevenLabs)
┌──────────────────┐                ┌──────────────────┐
│  浏览器内置 API    │                │  Deepgram 流式 STT │
│  • 免费            │    ──────►     │  • $0.005/min     │
│  • 零延迟(本地)    │                │  • 更准确(中英混合) │
│  • Chrome 支持好   │                │  • 实时流式        │
│  • 准确度一般      │                │  • WebSocket 传输  │
└──────────────────┘                └──────────────────┘
                                             │
                                    ┌────────┴─────────┐
                                    │  ElevenLabs TTS  │
                                    │  • 最自然的中文    │
                                    │  • 流式播放        │
                                    │  • $0.015/千字    │
                                    └──────────────────┘
```

---

## 8. 前端组件设计

### 8.1 页面树

```
/                          → 首页（上传简历入口，介绍产品）
/setup                     → 选择面试模式 + 难度
/interview/[sessionId]     → 面试聊天界面（核心页）
/report/[sessionId]        → 复盘报告页
```

### 8.2 核心组件：ChatInterface

```typescript
// 面试聊天界面的状态管理

// src/hooks/useInterview.ts

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, InterviewConfig } from '@/types';

export function useInterview(config: InterviewConfig) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);

  // 开始面试（创建 session + 获取开场白）
  const startInterview = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      setMessages([data.openingMessage]);
    } catch (error) {
      console.error('Failed to start interview:', error);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  // 发送回答
  const sendAnswer = useCallback(async (content: string) => {
    if (!sessionId || isComplete) return;

    // 1. 添加候选人消息到界面
    const candidateMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'candidate',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, candidateMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();

      // 2. 添加面试官回复
      setMessages(prev => [...prev, data.message]);

      // 3. 更新状态
      if (data.phase) setCurrentPhase(data.phase);
      if (data.isComplete) setIsComplete(true);
    } catch (error) {
      console.error('Failed to send answer:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isComplete]);

  // 结束面试
  const endInterview = useCallback(async () => {
    setIsComplete(true);
  }, []);

  return {
    messages,
    isLoading,
    isComplete,
    sessionId,
    currentPhase,
    startInterview,
    sendAnswer,
    endInterview,
  };
}
```

### 8.3 关键 UI 状态

```
ChatInterface 状态矩阵：

┌──────────┬──────────────┬─────────────────────┐
│ 状态      │ 条件          │ UI 表现              │
├──────────┼──────────────┼─────────────────────┤
│ 未开始    │ 刚进入页面    │ 显示"开始面试"按钮    │
│ 进行中    │ session存在   │ 消息列表 + 输入框     │
│ 等待回复  │ isLoading     │ 输入框禁用 + "..."动画 │
│ 已结束    │ isComplete    │ 输入框替换为"查看报告" │
│ 错误      │ error !== null│ Toast 提示 + 重试     │
└──────────┴──────────────┴─────────────────────┘

消息气泡样式：
- 面试官消息：左侧对齐，灰色背景，带 🤖 头像
- 候选人消息：右侧对齐，蓝色背景，带 👤 头像
- 系统消息：居中，灰色小字，无头像
- 流式输出中：光标闪烁动画
```

---

## 9. 关键实现细节

### 9.1 简历解析 pipeline

```typescript
// src/lib/resume-parser.ts

import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { callClaudeStructured } from './claude';

export async function parseResume(file: File): Promise<{
  rawText: string;
  parsedData: ParsedResume;
}> {
  // Step 1: 提取文本
  let rawText = '';
  if (file.type === 'application/pdf') {
    const buffer = Buffer.from(await file.arrayBuffer());
    rawText = (await pdf(buffer)).text;
  } else if (file.type.includes('word') || file.name.endsWith('.docx')) {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    rawText = result.value;
  } else {
    // 纯文本 / Markdown
    rawText = await file.text();
  }

  if (!rawText.trim()) {
    throw new Error('无法从简历中提取文本，请检查文件格式');
  }

  // Step 2: AI 结构化（用 Haiku，快速便宜）
  const parsedData = await callClaudeStructured<ParsedResume>({
    model: 'claude-haiku-4-5-20251001',
    system: `你是一个简历解析器。从以下简历文本中提取结构化信息。
返回严格的 JSON 格式，不要添加任何额外内容。
如果某项信息不存在，用空字符串或空数组表示。

{
  "name": "姓名",
  "education": [{ "school": "学校", "degree": "学位", "major": "专业", "year": "毕业年份" }],
  "experiences": [{
    "type": "internship|fulltime|project|activity",
    "company": "公司/组织",
    "role": "职位",
    "duration": "时间段",
    "description": "描述",
    "highlights": ["亮点1", "亮点2"],
    "techStack": ["技术1"]
  }],
  "skills": ["技能"],
  "projects": [{ "name": "项目名", "role": "角色", "description": "描述", "highlights": [], "techStack": [] }]
}`,
    messages: [{ role: 'user', content: rawText }],
    maxTokens: 2048,
    temperature: 0.1, // 低温度保证准确提取
  });

  return { rawText, parsedData };
}
```

### 9.2 面试引擎

```typescript
// src/lib/interview-engine.ts

import { Anthropic } from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './prompts';
import type { ParsedResume, InterviewMode, Difficulty, ChatMessage, InterviewPhase } from '@/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface EngineResponse {
  message: ChatMessage;
  phase?: InterviewPhase;
  isComplete: boolean;
  completionReason?: string;
}

export async function processInterviewTurn(params: {
  resume: ParsedResume;
  mode: InterviewMode;
  difficulty: Difficulty;
  currentPhase?: InterviewPhase;
  questionIndex: number;
  history: { role: 'user' | 'assistant'; content: string }[];
  userAnswer?: string; // undefined = 首轮（生成开场白）
}): Promise<EngineResponse> {
  
  const systemPrompt = buildSystemPrompt({
    resume: params.resume,
    mode: params.mode,
    difficulty: params.difficulty,
    currentPhase: params.currentPhase,
    questionIndex: params.questionIndex,
  });

  // 构建消息数组
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  if (params.userAnswer) {
    // 正常对话轮次
    messages.push(...params.history);
    messages.push({ role: 'user', content: params.userAnswer });
  } else {
    // 首轮：需要 AI 生成开场白
    messages.push({ 
      role: 'user', 
      content: '面试即将开始，请根据你的角色设定，向候选人发出开场白和第一个问题。' 
    });
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5-20250901',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    temperature: 0.7,
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  // 解析 JSON 响应
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    
    if (parsed && parsed.message) {
      return {
        message: {
          id: '', // 由调用方生成
          role: 'interviewer',
          content: parsed.message,
          metadata: parsed.metadata || {},
          createdAt: new Date().toISOString(),
        },
        phase: parsed.metadata?.phase,
        isComplete: parsed.isComplete || false,
        completionReason: parsed.completionReason,
      };
    }
  } catch (e) {
    console.error('Failed to parse agent response:', e);
  }

  // 降级：返回纯文本
  return {
    message: {
      id: '',
      role: 'interviewer',
      content: text.trim() || '请继续。',
      metadata: {},
      createdAt: new Date().toISOString(),
    },
    isComplete: false,
  };
}
```

### 9.3 Prompt 构建

```typescript
// src/lib/prompts/index.ts

import { BASE_SYSTEM_PROMPT } from './base';
import { MODE_PROMPTS } from './modes';
import { DIFFICULTY_PROMPTS } from './difficulty';
import type { ParsedResume, InterviewMode, Difficulty, InterviewPhase } from '@/types';

export function buildSystemPrompt(params: {
  resume: ParsedResume;
  mode: InterviewMode;
  difficulty: Difficulty;
  currentPhase?: InterviewPhase;
  questionIndex: number;
}): string {
  const resumeContext = JSON.stringify(params.resume, null, 2);

  return `
${BASE_SYSTEM_PROMPT}

## 候选人简历
\`\`\`json
${resumeContext}
\`\`\`

## 当前设置
- 面试模式：${params.mode}
- 难度等级：${params.difficulty}
- 当前阶段：${params.currentPhase || '初始'}
- 当前问题序号：${params.questionIndex}

${MODE_PROMPTS[params.mode]}

${DIFFICULTY_PROMPTS[params.difficulty]}

## 重要提醒
- 当前是第 ${params.questionIndex} 个问题
- 最多进行 15 轮对话
- 记住：不要向候选人透露你的内部评分
`.trim();
}
```

### 9.4 复盘报告生成

```typescript
// src/lib/scoring.ts

export async function generateFeedback(params: {
  resume: ParsedResume;
  mode: InterviewMode;
  messages: ChatMessage[];
}): Promise<FeedbackReport> {
  const systemPrompt = `
你是一位资深的面试复盘专家。请对以下面试对话进行全面分析。

## 输出格式
返回严格的 JSON：

{
  "overallScore": 78,
  "dimensionScores": {
    "starCompleteness": 65,
    "quantification": 58,
    "logicClarity": 80,
    "technicalDepth": 76,
    "communication": 82
  },
  "strengths": ["自我介绍结构清晰", "..."],
  "improvements": [
    {
      "questionIndex": 2,
      "issue": "量化不足",
      "suggestion": "补充具体数据：DAU从X提升到Y",
      "rewriteExample": "通过优化推荐策略，我们将DAU从120万提升到138万，增幅15%"
    }
  ],
  "questionReviews": [
    {
      "questionIndex": 1,
      "question": "请做自我介绍",
      "answer": "...",
      "rating": "green",
      "comment": "结构完整，有亮点，时长适中"
    }
  ],
  "resumeSuggestions": [
    {
      "experienceIndex": 0,
      "issue": "字节实习经历缺少冷启动方案准备",
      "suggestion": "补充推荐系统冷启动的处理方案"
    }
  ],
  "fullReport": "完整的 Markdown 格式报告..."
}`;

  // 准备对话历史
  const conversationText = params.messages
    .map(m => `[${m.role === 'interviewer' ? '面试官' : '候选人'}]: ${m.content}`)
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5-20250901',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `请对以下面试对话进行复盘分析：\n\n候选人简历：${JSON.stringify(params.resume)}\n\n面试对话：\n${conversationText}`,
      },
    ],
    temperature: 0.3, // 评估场景需要稳定性
  });

  // 解析 + 返回
  // ...
}
```

---

## 10. 部署方案

### MVP 部署（零成本）

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  GitHub      │────▶│  Vercel       │────▶│  SQLite       │
│  代码仓库     │     │  自动部署      │     │  (Vercel 自带) │
└─────────────┘     └──────────────┘     └──────────────┘
                            │
                     ┌──────┴──────┐
                     │  Vercel      │
                     │  Environment │
                     │  Variables   │
                     │  (API Key)   │
                     └─────────────┘
```

**步骤：**
1. `git push` 到 GitHub
2. Vercel 关联仓库，自动检测 Next.js 项目
3. 在 Vercel Dashboard 设置环境变量：
   - `ANTHROPIC_API_KEY=sk-ant-...`
   - `DATABASE_URL=file:./dev.db`
4. 部署完成，获得 `https://intervyou.vercel.app` 域名

**注意事项：**
- Vercel Serverless 函数有 10s 超时限制（Claude API 调用可能在极限情况触达）
- SQLite 在 Serverless 环境下是只读的 → V2 需要迁移到 PostgreSQL
- MVP 可以用 Vercel KV 或 Neon（免费 PostgreSQL）替代 SQLite

### V2 生产部署

```
┌──────────┐    ┌──────────┐    ┌──────────────┐
│  GitHub   │───▶│  Vercel   │───▶│  Neon         │
│           │    │  (前端+API)│    │  (PostgreSQL) │
└──────────┘    └──────────┘    └──────────────┘
                       │
                ┌──────┴──────┐
                │  Deepgram    │  (STT 服务)
                │  ElevenLabs  │  (TTS 服务)
                │  UploadThing │  (文件上传)
                └─────────────┘
```

---

## 11. 开发排期

### 第 1 周：基础搭建

| 天 | 任务 | 产出 |
|----|------|------|
| D1 | Next.js 项目初始化 + Tailwind + shadcn/ui 配置 | 可运行的空项目 |
| D2 | Prisma Schema + 数据库初始化 + 基础 API 骨架 | 数据库就绪 |
| D3 | 简历上传页面 + 简历解析 pipeline | 能上传并看到解析结果 |
| D4 | System Prompt 编写（base + 简历深挖模式） | Agent 核心就绪 |
| D5 | POST /api/sessions + POST /chat 接口 | 后端对话链路通 |
| D6 | ChatInterface 组件开发 | 前端聊天界面 |
| D7 | 首尾串联调试 + 修复 bug | 能跑通一次完整面试 |

### 第 2 周：核心体验

| 天 | 任务 | 产出 |
|----|------|------|
| D8 | 复盘报告生成 + 报告页面 | 面试 → 报告闭环 |
| D9 | 三种难度实现 + 调优 | 友好/标准/压力可用 |
| D10 | Web Speech API 语音输入 | 语音输入可用 |
| D11 | UI 打磨（动画、响应式、暗色模式） | 体验提升 |
| D12 | 边界情况处理（错误状态、空状态、loading） | 鲁棒性 |
| D13 | 另外三种模式（行为/技术/综合） | 全模式可用 |
| D14 | 整体测试 + bug 修复 | MVP 完成 |

### 第 3 周：打磨 + 文档

| 天 | 任务 |
|----|------|
| D15-16 | 产品细节打磨（prompt 调优、UI 微调） |
| D17 | 撰写 README + 项目文档 |
| D18 | 准备 Demo 视频 / 截图 |
| D19 | 部署到 Vercel |
| D20-21 | 预留缓冲 |

---

## 附录 A：环境变量模板

```bash
# .env.example

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# 数据库
DATABASE_URL=file:./dev.db          # MVP: SQLite
# DATABASE_URL=postgres://...        # V2: PostgreSQL

# 应用
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 语音（V2）
# DEEPGRAM_API_KEY=...
# ELEVENLABS_API_KEY=...
```

---

## 附录 B：依赖清单

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "@prisma/client": "^5.18.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.7.0",
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "framer-motion": "^11.3.0",
    "recharts": "^2.12.0",
    "react-markdown": "^9.0.0",
    "lucide-react": "^0.400.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "prisma": "^5.18.0",
    "@types/pdf-parse": "^1.1.4",
    "@types/react": "^18.3.0",
    "@types/node": "^22.0.0",
    "eslint": "^8.57.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

> **本方案对应 PRD v1.0 的 MVP 范围。V2+ 内容仅标注方向，细节留待后续迭代。**

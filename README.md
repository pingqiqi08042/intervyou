# IntervYOU — AI 面试教练

面向校招生的 AI 面试教练平台。上传简历 → 诊断分析 → 模拟面试 → 复盘报告 → 优化简历。

## 功能

| 模块 | 说明 |
|------|------|
| 简历管理 | 上传 PDF/Word/Markdown，AI 自动解析并生成 7 维诊断报告 |
| 模拟面试 | 4 种模式 × 3 级难度，AI 面试官从简历出发动态追问 |
| 语音输入 | 浏览器内置语音识别（Chrome/Edge），边说边转文字 |
| 复盘报告 | 五维雷达评分 + 逐题点评 + 优势/改进 + 简历建议 |
| 优化简历 | 基于诊断/面试反馈生成优化简历，支持 .md / .docx 下载 |
| 面试记录 | 历史面试列表，未完成可继续，已完成可查看报告 |

## 技术栈

- **前端**: Next.js 14 (App Router) + React 18 + Tailwind CSS + Recharts
- **后端**: Next.js API Routes + Prisma ORM + SQLite
- **AI**: DeepSeek V3（默认） / Claude Sonnet / OpenAI GPT-4o（可切换）
- **语音**: Web Speech API（浏览器原生，零成本）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 LLM_API_KEY

# 3. 初始化数据库
npx prisma db push

# 4. 启动开发服务器
npm run dev
```

打开 http://localhost:3000

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_PROVIDER` | AI 提供商 (deepseek/claude/openai) | deepseek |
| `LLM_API_KEY` | API Key | - |
| `DATABASE_URL` | 数据库地址 | file:./dev.db |

## 项目结构

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # 15+ API routes
│   ├── page.tsx              # 首页（上传+诊断）
│   ├── setup/                # 面试配置
│   ├── interview/[id]/       # 面试聊天
│   ├── report/[id]/          # 复盘报告
│   ├── optimize/             # 优化简历
│   └── history/              # 面试记录
├── lib/
│   ├── prompts/              # 模块化 Prompt（base/modes/difficulty）
│   ├── agent.ts              # 面试引擎
│   ├── llm-client.ts         # 多 Provider 统一客户端
│   └── docx-generator.ts     # .docx 生成
├── components/               # UI 组件
└── hooks/                    # React Hooks
```

## 命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm test` | 跑 Prompt 测试（17 用例） |
| `npm run db:studio` | 数据库管理界面 |

## License

MIT

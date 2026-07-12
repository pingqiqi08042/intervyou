# 部署 & Demo 录制指南

---

## 一、API Key 方案

部署上线后，**别人使用不会花你的钱**：

| 场景 | 行为 |
|------|------|
| **本地开发**（`REQUIRE_USER_KEY` 未设置） | 服务端 Key 兜底，用户不填就是用你的 |
| **生产部署**（`REQUIRE_USER_KEY=true`） | 用户必须先填入自己的 Key 才能用 |

用户填入 Key 的方式：侧边栏「API 配置」→ 选择 DeepSeek → 粘贴自己的 Key → 保存。
Key 仅存在浏览器 localStorage，每次请求通过 Header 传给服务端，服务端不存储。

**建议的生产配置**（Vercel 环境变量）：
```
LLM_PROVIDER=deepseek
REQUIRE_USER_KEY=true
DATABASE_URL=postgres://...（Neon 免费 PostgreSQL）
```

不需要配 `LLM_API_KEY`——因为每个用户用自己的。

---

## 二、部署步骤（Vercel + Neon）

### Step 1：初始化 Git
```bash
cd d:/three_important_projcect/pro3
git init
git add .
git commit -m "IntervYOU MVP"
```

### Step 2：创建 GitHub 仓库
在 github.com 新建仓库（如 `intervyou`），然后：
```bash
git remote add origin https://github.com/你的用户名/intervyou.git
git branch -M main
git push -u origin main
```

### Step 3：创建 Neon 免费 PostgreSQL
1. 打开 [neon.tech](https://neon.tech)，注册登录
2. 创建项目 → 复制连接字符串（格式：`postgres://...`）
3. 替换 `.env` 中的 `DATABASE_URL`

### Step 4：Vercel 部署
1. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录
2. 「Add New Project」→ 选择 `intervyou` 仓库
3. 环境变量添加：
   - `LLM_PROVIDER` = `deepseek`
   - `REQUIRE_USER_KEY` = `true`
   - `DATABASE_URL` = Neon 连接字符串
4. 点击 Deploy

### Step 5：初始化数据库
```bash
npx prisma db push
```
或在 Vercel 部署后，在 Settings → Functions 中配置 build command 包含 `prisma db push`。

---

## 三、Demo 视频录制

### 工具
- **Windows**：Win+G（Xbox Game Bar）或 OBS Studio（免费）
- **Mac**：QuickTime Player → 文件 → 新建屏幕录制
- 录制时长：**2-3 分钟**

### 录制脚本（照着操作）

**0:00-0:20 开场**
> 打开首页，展示上传区域。简单旁白："这是一个 AI 面试教练平台，上传简历后会进行智能诊断。"

**0:20-0:40 上传简历 + 诊断**
> 粘贴 `tests/sample-resume.md` 的内容到「粘贴文字」Tab → 点击「开始分析」→ 展示诊断报告（评分、风险点、改写建议）。旁白："系统会自动分析简历，指出面试风险点和改写建议。"

**0:40-1:20 配置面试**
> 点击「开始模拟面试」→ 展示设置页：选择简历 → 展开「岗位&JD」→ 选「后端开发」→ 模式选「简历深挖」→ 难度选「标准」→ 开始面试。旁白："支持5种岗位，3种难度，4层递进提问。"

**1:20-2:20 模拟面试**
> 用 `tests/sample-answers.md` 的回答逐条发送（2-3轮即可）。
> 展示Agent追问、换题。旁白："Agent会针对回答动态追问，从概述到细节到难点到量化，层层递进。不会重复提问。"

**2:20-2:40 复盘报告**
> 点退出→终止面试→展示雷达图+评分+改进建议。旁白："面试结束后生成五维雷达图和逐题点评。"

**2:40-3:00 优化简历**
> 点「去优化简历」→ 生成 → 下载 .docx。旁白："最后可以一键生成优化简历，支持Markdown和Word下载。"

### 注意事项
- 提前打开 `tests/sample-answers.md` 在旁边，方便复制
- 录制前关掉无关通知、微信等
- 不用配音，录完加字幕或直接录旁白
- 最后 5 秒停一下让观众看清最终页面

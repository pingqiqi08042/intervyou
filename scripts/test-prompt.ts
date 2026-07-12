/**
 * test-prompt.ts — Prompt 调优测试脚本
 *
 * 用法：
 *   npm test                        # 跑所有测试（默认用 DeepSeek）
 *   npm test -- --case 3            # 只跑第 3 个用例
 *   npm test -- --mode pressure     # 只跑压力模式用例
 *   npm test -- --verbose           # 显示完整 Agent 响应
 *
 * 切换 Provider：在 .env 中修改 LLM_PROVIDER
 *   LLM_PROVIDER=deepseek   （默认，最便宜）
 *   LLM_PROVIDER=claude     （效果最好）
 *
 * 每次运行会在 tests/output/ 下生成带时间戳的结果文件。
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { buildSystemPromptV2 } from '../src/lib/prompts/system-v2';
import { TEST_CASES } from '../tests/test-cases';
import { chat, printConfig, getLlmConfig } from '../src/lib/llm-client';
import type { TestCase } from '../src/lib/prompts/types';

dotenv.config();

// ─── 配置 ──────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, '..', 'tests', 'output');

interface TestResult {
  caseName: string;
  passed: boolean;
  duration: number;
  agentMessage: string;
  agentMetadata: any;
  isComplete: boolean;
  tokensUsed?: string;
  error?: string;
  notes: string;
}

// ─── 主函数 ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flags = parseArgs(args);

  // 过滤测试用例
  let cases = TEST_CASES;
  if (flags.case !== undefined) {
    const idx = Number(flags.case) - 1;
    if (idx < 0 || idx >= cases.length) {
      console.error(`❌ 用例序号超出范围 (1-${cases.length})`);
      process.exit(1);
    }
    cases = [cases[idx]];
  }
  if (flags.mode) {
    cases = cases.filter((c) => c.mode === flags.mode);
    if (cases.length === 0) {
      console.error(`❌ 没有找到模式为 "${flags.mode}" 的用例`);
      process.exit(1);
    }
  }

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let config: ReturnType<typeof getLlmConfig>;
  try {
    config = getLlmConfig();
  } catch (e: any) {
    console.error('❌ LLM 配置错误：');
    console.error('  ', e.message);
    console.error('');
    console.error('请在 .env 文件中设置（以 DeepSeek 为例）：');
    console.error('  LLM_PROVIDER=deepseek');
    console.error('  LLM_API_KEY=sk-your-deepseek-key');
    console.error('');
    console.error('获取 DeepSeek API Key：https://platform.deepseek.com');
    console.error('获取 Claude API Key：https://console.anthropic.com');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(OUTPUT_DIR, `test-run-${timestamp}.md`);

  console.log('╔══════════════════════════════════════════╗');
  console.log('║     IntervYOU — Prompt 调优测试          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('🔧 LLM 配置：');
  console.log(printConfig().split('\n').map(l => `   ${l}`).join('\n'));
  console.log('');
  console.log(`📋 测试用例数：${cases.length}`);
  console.log(`📝 输出文件：${outputFile}`);
  console.log('');

  const results: TestResult[] = [];
  let outputContent = `# Prompt 调优测试报告\n\n> 时间：${new Date().toLocaleString()}\n> 配置：${printConfig().replace(/\n/g, ' | ')}\n\n---\n\n`;

  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    console.log(`[${i + 1}/${cases.length}] ${testCase.name}`);
    console.log(`  描述：${testCase.description}`);
    console.log(`  模式：${testCase.mode} | 难度：${testCase.difficulty}`);

    const result = await runTestCase(testCase, flags.verbose);
    results.push(result);

    const icon = result.passed ? '✅' : '⚠️';
    console.log(`  ${icon} ${result.notes}`);
    if (result.tokensUsed) {
      console.log(`  💰 ${result.tokensUsed}`);
    }
    if (result.error) {
      console.log(`  ❌ 错误：${result.error}`);
    }
    console.log(`  ⏱ ${result.duration}ms`);
    console.log('');

    // 追加到输出文件
    outputContent += formatResultMarkdown(testCase, result, flags.verbose);
    outputContent += '\n---\n\n';

    // 避免触发速率限制
    if (i < cases.length - 1) {
      await sleep(1000);
    }
  }

  // 汇总
  const passed = results.filter((r) => r.passed).length;
  console.log('═══════════════════════════════════════════');
  console.log(`📊 汇总：${passed}/${results.length} 通过`);
  console.log('');

  const failedCases = results.filter((r) => !r.passed);
  if (failedCases.length > 0) {
    console.log('需要关注的用例：');
    failedCases.forEach((r) => {
      console.log(`  ⚠ ${r.caseName}：${r.notes}`);
    });
    console.log('');
  }

  // 写入汇总
  outputContent += `\n## 📊 汇总\n\n- 通过：${passed}/${results.length}\n`;
  if (failedCases.length > 0) {
    outputContent += `- 需要关注：\n`;
    failedCases.forEach((r) => {
      outputContent += `  - **${r.caseName}**：${r.notes}\n`;
    });
  }
  outputContent += `\n> 修改 Prompt 后重新运行 \`npm test\` 查看效果。\n`;

  fs.writeFileSync(outputFile, outputContent, 'utf-8');
  console.log(`📝 详细报告已保存到：${outputFile}`);
}

// ─── 跑单个测试用例 ────────────────────────────────────────

async function runTestCase(
  testCase: TestCase,
  verbose?: boolean
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // 1. 构建 System Prompt
    const systemPrompt = buildSystemPromptV2({
      resume: testCase.resume,
      mode: testCase.difficulty, // V2: guided/standard/pressure
      questionIndex: testCase.conversationHistory.length + 1,
    });

    // 2. 组装 messages
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    if (testCase.conversationHistory.length === 0) {
      // 首轮：需要生成开场白
      messages.push({
        role: 'user',
        content:
          '面试即将开始。请根据你的角色设定，向候选人发出开场白和第一个问题。',
      });
    } else {
      // 后续轮次：发送历史 + 最新回答
      messages.push(...testCase.conversationHistory);
      messages.push({ role: 'user', content: testCase.latestUserAnswer });
    }

    // 3. 调用 LLM（统一客户端）
    const response = await chat({
      systemPrompt,
      messages,
      temperature: 0.7,
      maxTokens: 1024,
      jsonMode: true, // 强制 JSON 输出（解决 DeepSeek 格式不稳定）
    });

    const text = response.content;

    // 4. 解析响应
    let agentMessage = '';
    let agentMetadata: any = {};
    let isComplete = false;

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        agentMessage = parsed.message || '';
        agentMetadata = parsed.metadata || {};
        isComplete = parsed.isComplete || false;
      } else {
        // JSON 解析失败，可能是纯文本回复
        agentMessage = text.trim();
      }
    } catch {
      agentMessage = text.trim();
    }

    // 5. 自动检查
    const checks: string[] = [];

    if (!agentMessage || agentMessage.length < 10) {
      checks.push('Agent 回复过短');
    }

    if (!text.includes('"message"')) {
      checks.push('未输出标准 JSON 格式（可能是纯文本回复）');
    }

    // 检查评分是否泄露到了 message 中
    const leakedScore =
      /starCompleteness|quantification|logicClarity|technicalDepth|评价|评分|打分/.test(
        agentMessage
      );
    if (leakedScore) {
      checks.push('⚠ 可能在 message 中泄露了内部评分');
    }

    // 首轮检查：是否从简历出发
    if (testCase.conversationHistory.length === 0) {
      const resumeKeywords = testCase.resume.experiences.map((e) => e.company);
      const mentionsResume = resumeKeywords.some((kw) =>
        agentMessage.includes(kw)
      );
      if (!mentionsResume && testCase.mode !== 'comprehensive') {
        checks.push('首轮未提及简历中的公司/项目');
      }
    }

    const duration = Date.now() - startTime;
    const passed = checks.length === 0;

    // Token 用量
    const tokensUsed = response.usage
      ? `input: ${response.usage.inputTokens} | output: ${response.usage.outputTokens}`
      : undefined;

    if (verbose) {
      console.log(
        '  ┌─────────────────────────────────────────────┐'
      );
      console.log(
        `  │ ${agentMessage.substring(0, 80)}...`
      );
      console.log(
        `  │ Metadata: ${JSON.stringify(agentMetadata).substring(0, 80)}...`
      );
      console.log(
        '  └─────────────────────────────────────────────┘'
      );
    }

    return {
      caseName: testCase.name,
      passed,
      duration,
      agentMessage,
      agentMetadata,
      isComplete,
      tokensUsed,
      notes:
        checks.length > 0
          ? checks.join('; ')
          : '基本检查通过（需人工确认行为是否符合预期）',
    };
  } catch (error: any) {
    return {
      caseName: testCase.name,
      passed: false,
      duration: Date.now() - startTime,
      agentMessage: '',
      agentMetadata: {},
      isComplete: false,
      error: error.message || String(error),
      notes: 'API 调用失败',
    };
  }
}

// ─── 工具函数 ──────────────────────────────────────────────

function parseArgs(args: string[]): {
  case?: number;
  mode?: string;
  verbose?: boolean;
} {
  const result: { case?: number; mode?: string; verbose?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--case' && args[i + 1]) {
      result.case = Number(args[i + 1]);
      i++;
    } else if (args[i] === '--mode' && args[i + 1]) {
      result.mode = args[i + 1];
      i++;
    } else if (args[i] === '--verbose') {
      result.verbose = true;
    }
  }
  return result;
}

function formatResultMarkdown(
  testCase: TestCase,
  result: TestResult,
  verbose?: boolean
): string {
  let md = '';
  md += `### ${result.passed ? '✅' : '⚠️'} ${testCase.name}\n\n`;
  md += `- **描述**：${testCase.description}\n`;
  md += `- **模式**：${testCase.mode} | **难度**：${testCase.difficulty}\n`;
  md += `- **耗时**：${result.duration}ms\n`;
  if (result.tokensUsed) {
    md += `- **Token**：${result.tokensUsed}\n`;
  }
  md += `- **结论**：${result.notes}\n`;

  if (result.error) {
    md += `- **错误**：${result.error}\n`;
  }

  md += `\n**Agent 回复**：\n> ${result.agentMessage || '(无)'}\n`;

  if (verbose && result.agentMetadata?.evaluation) {
    const ev = result.agentMetadata.evaluation;
    md += `\n**内部评估**：\n`;
    md += `- STAR: ${ev.starCompleteness} | 量化: ${ev.quantification} | 逻辑: ${ev.logicClarity} | 深度: ${ev.technicalDepth} | 表达: ${ev.communication}\n`;
    md += `- Notes: ${ev.notes || '(无)'}\n`;
    md += `- FollowUp: ${ev.followUpNeeded ? ev.followUpReason : '否'}\n`;
  }

  md += `\n**期望行为**（人工对照）：\n${testCase.expectedBehavior}\n`;
  return md;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── 启动 ──────────────────────────────────────────────────

main().catch((err) => {
  console.error('测试运行失败：', err);
  process.exit(1);
});

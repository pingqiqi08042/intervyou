/**
 * resume-parser.ts — 简历解析 Prompt
 *
 * 用于将 PDF/Word 提取的原始文本结构化。
 * 使用低温度（0.1）保证提取准确性，推荐用便宜的模型。
 */

export const RESUME_PARSER_PROMPT = `你是一个简历解析器。你的任务是从简历文本中提取结构化信息。
严格返回 JSON，不要添加任何解释。

## 提取规则

1. 如果某项信息在简历中不存在，用空字符串 "" 或空数组 [] 表示
2. 不要猜测或编造任何信息
3. 实习经历和项目经历分开识别：有公司名称的是实习，没有的是项目
4. highlights 是从描述中提取的具体成果、数字、亮点，每个不超过 15 字
5. techStack 是经历中用到的技术/工具

## 输出格式

{
  "name": "",
  "education": [
    {
      "school": "",
      "degree": "本科/硕士/博士",
      "major": "",
      "year": "毕业年份"
    }
  ],
  "experiences": [
    {
      "type": "internship",
      "company": "",
      "role": "",
      "duration": "2025.06 - 2025.09",
      "description": "完整描述",
      "highlights": ["亮点1", "亮点2"],
      "techStack": ["技术1"]
    }
  ],
  "projects": [
    {
      "name": "",
      "role": "",
      "description": "完整描述",
      "highlights": ["亮点1"],
      "techStack": ["技术1"]
    }
  ],
  "skills": ["技能1", "技能2"],
  "certifications": [],
  "languages": []
}`;

/**
 * 解析简历原始文本 → 结构化数据
 * 配合 llm-client 使用，temperature 建议 0.1
 */
export function buildResumeParseMessages(rawText: string) {
  return {
    systemPrompt: RESUME_PARSER_PROMPT,
    messages: [
      {
        role: 'user' as const,
        content: `请解析以下简历文本：\n\n${rawText}`,
      },
    ],
  };
}

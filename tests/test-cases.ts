/**
 * test-cases.ts — Prompt 调优测试用例
 *
 * 包含：1 份示范简历 + 8 个测试场景
 * 每个场景定义了期望的 Agent 行为，用于验证 Prompt 调优效果。
 */

import type { TestCase, ParsedResume } from '../src/lib/prompts/types';

// ─── 示范简历 ──────────────────────────────────────────────
// 这是一个典型的校招生简历，包含常见的亮点和问题

export const SAMPLE_RESUME: ParsedResume = {
  name: '张同学',
  education: [
    {
      school: '浙江大学',
      degree: '硕士',
      major: '软件工程',
      year: '2026',
    },
    {
      school: '武汉大学',
      degree: '本科',
      major: '计算机科学与技术',
      year: '2023',
    },
  ],
  experiences: [
    {
      type: 'internship',
      company: '字节跳动',
      role: '后端开发实习生',
      duration: '2025.06 - 2025.09',
      description: '负责抖音电商推荐系统的后端开发，优化推荐链路性能',
      highlights: [
        '推荐接口延迟从 200ms 降至 80ms',
        '从 0 到 1 搭建推荐效果 AB 实验平台',
      ],
      techStack: ['Go', 'Redis', 'Kafka', 'MySQL'],
    },
    {
      type: 'internship',
      company: '网易',
      role: '产品实习生',
      duration: '2024.07 - 2024.09',
      description: '参与网易云音乐用户增长方向的策略制定',
      highlights: ['DAU 提升 15%', '主导 3 个增长实验'],
      techStack: ['SQL', 'Excel', 'Figma'],
    },
  ],
  projects: [
    {
      name: '分布式 KV 存储系统',
      role: '核心开发者',
      description: '基于 Raft 协议实现了一个高可用的分布式 KV 存储系统',
      highlights: ['支持 Leader 选举和日志复制', '吞吐量达到 10000 QPS'],
      techStack: ['Go', 'gRPC', 'Raft'],
    },
  ],
  skills: ['Go', 'Python', 'Java', 'Redis', 'MySQL', 'Kafka', 'Docker', 'Git'],
};

// ─── 测试用例 ──────────────────────────────────────────────

export const TEST_CASES: TestCase[] = [
  // ═══ 用例 1：简历深挖 — 首轮开场 ═══
  {
    name: 'resume_deep_first_question',
    description: 'Agent 应该从简历中最有亮点的经历（字节实习）开始提问，而非随机出题',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [],
    latestUserAnswer: '', // 空表示首轮，需要 Agent 自己开场
    expectedBehavior: `
      1. 开场白简短说明面试开始（不超过2句话）
      2. 第一个问题指向字节跳动的实习经历
      3. 问题具体，不是"介绍一下"而是"你做的推荐性能优化，具体做了什么？"
      4. JSON 中 questionIndex=1, phase='resume_deep', isComplete=false
    `,
  },

  // ═══ 用例 2：候选人回答扎实 → 应该深入追问 ═══
  {
    name: 'strong_answer_deep_followup',
    description: '候选人给出了有细节有技术的回答，Agent 应该追问更深一层而非换题',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你在字节做推荐系统优化，接口延迟从200降到80ms，能展开讲讲你是怎么做到的吗？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":1},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '我们主要做了三件事：一是把同步调用改成了异步，用 Kafka 做消息队列解耦；' +
      '二是加了多级缓存，热点数据用 Redis 做本地缓存；' +
      '三是对数据库查询做了索引优化和慢查询治理。这里面效果最明显的是异步化，' +
      '因为之前每次推荐请求都要同步等好几个下游服务返回。',
    expectedBehavior: `
      1. 追问应该深入，不是换题
      2. 追问方向合理：比如追问 Kafka 选型的 trade-off / 缓存一致性 / 降级策略
      3. evaluation 各项应该在 4-5 分（回答扎实）
      4. followUpNeeded=true，且 followUpReason 有具体理由
      5. 不应该夸"很好"（标准模式不表扬）
    `,
  },

  // ═══ 用例 3：候选人回答模糊 → 要求具体化 ═══
  {
    name: 'vague_answer_ask_specific',
    description: '候选人回答非常笼统，Agent 应该要求给出具体例子而非直接换题',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你在网易云音乐做了用户增长，DAU提升15%，能具体讲讲你们做了什么吗？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":1},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '我们主要是通过优化推荐策略和做一些营销活动来提升用户活跃度的，' +
      '团队一起讨论了很多方案，最后选了几个效果比较好的去执行。整体效果还不错。',
    expectedBehavior: `
      1. 追问要求具体化："你能举个具体的实验或者活动的例子吗？"
      2. 追问中暗示 STAR 缺失："你个人在其中具体做了什么？"
      3. evaluation 各项在 1-3 分（严重缺细节和量化）
      4. quantification 应该给 1 或 2 分（完全没有数字）
      5. notes 应该提到"回答太笼统，缺少具体行动和数据"
    `,
  },

  // ═══ 用例 4：候选人完全答不上来 ═══
  {
    name: 'cannot_answer_graceful_handling',
    description: '候选人被追问到答不上来，Agent 应该给台阶换题而非死磕',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你说从0到1搭建了AB实验平台，那实验分流的哈希策略你们是怎么做的？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":2},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '呃…这个我不太清楚，这部分好像是我们组的另一个同学负责的，' +
      '我主要是用这个平台来看实验数据的。',
    expectedBehavior: `
      1. 不嘲讽、不继续追问同一个点
      2. 给台阶："好的，了解了。那我们换个方向..."
      3. 换到简历中其他经历
      4. evaluation 中 technicalDepth 给 1-2 分
      5. notes 应该记录"核心亮点描述夸大了，候选人对AB实验平台细节不了解"
    `,
  },

  // ═══ 用例 5：压力模式 — 质疑数据 ═══
  {
    name: 'pressure_mode_challenge_data',
    description: '压力模式下，Agent 应该质疑候选人的数据，追问计算逻辑',
    mode: 'resume_deep_dive',
    difficulty: 'pressure',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"DAU提升了15%，这个数字你怎么算出来的？我要听具体逻辑。","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":1},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '就是对比了我们做实验前后的数据，发现DAU从之前到现在涨了15%左右。',
    expectedBehavior: `
      1. 语气应该犀利但不侮辱："这个回答太虚了。我需要你具体说：对比的
         时间范围是什么？有没有设置对照组？怎么排除自然增长的？"
      2. 追问更深度，直接质疑数据可信度
      3. evaluation 中 quantification 给 1 分（回答没有任何具体数字，
         连"之前是多少"都没说）
      4. notes 应该提到"候选人无法解释自己简历上写的数字"
    `,
  },

  // ═══ 用例 6：友好模式 — 引导而非质疑 ═══
  {
    name: 'friendly_mode_guide',
    description: '友好模式下候选人答不上来，Agent 应该给提示引导而非施压',
    mode: 'resume_deep_dive',
    difficulty: 'friendly',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你做的分布式KV存储用了Raft协议，能讲讲Raft是怎么保证一致性的吗？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":3},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '嗯…就是通过选举leader来保证的…具体的我有点忘了，' +
      '主要是看了论文然后照着实现的。',
    expectedBehavior: `
      1. 语气温暖、给引导："没关系，你可以想想Raft的三个核心机制，
         除了Leader选举还有哪些？"
      2. 或者给提示降低难度："日志复制和安全性方面呢？"
      3. 如果候选人还是答不上来，给台阶换题
      4. 不应该有任何质疑或不满的语气
      5. evaluation 可以比标准模式宽松
    `,
  },

  // ═══ 用例 7：综合模式 — 自我介绍阶段 ═══
  {
    name: 'comprehensive_self_intro',
    description: '综合模式首轮应该引导自我介绍，而非直接进入项目深挖',
    mode: 'comprehensive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [],
    latestUserAnswer: '',
    expectedBehavior: `
      1. 开场白说明面试流程（简短）
      2. phase='self_intro'
      3. 问题应该是"请做自我介绍"或类似表达
      4. 不应该一上来就问具体项目
    `,
  },

  // ═══ 用例 8：行为面试 — STAR 不完整时追问缺失部分 ═══
  {
    name: 'behavioral_star_incomplete',
    description: '候选人回答行为问题时缺了 Result，Agent 应该追问结果',
    mode: 'behavioral',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你在网易实习时，有没有遇到过和团队成员意见不一致的情况？","metadata":{"evaluation":{},"phase":"behavioral_q","questionIndex":1},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '有过的。有一次我们在讨论一个增长实验的方案，我觉得应该先做A/B测试验证，' +
      '但组里另一个同学想直接全量上。后来我们各自做了分析，我拉了一些竞品数据' +
      '和历史实验数据，最后说服了他，我们按A/B的方式去做了。',
    expectedBehavior: `
      1. STAR 分析：有 S（讨论实验方案），有 T（决定方案），有 A（拉数据说服），
         缺 R（A/B测试结果怎么样？）
      2. Agent 应该追问结果："所以A/B测试最后的结果怎么样？"
      3. 追问不应该重复问 S/T/A 部分
      4. evaluation 评估 STAR completeness 给 3-4 分（缺 R）
    `,
  },

  // ═══ 用例 9：难度对比—友好 ───────────────────────────
  {
    name: 'difficulty_friendly_vague_answer',
    description: '友好模式：同一段模糊回答，Agent 应该温和引导而非质疑',
    mode: 'resume_deep_dive',
    difficulty: 'friendly',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你在网易云音乐做的用户增长，DAU提升了15%，能展开讲讲吗？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":1},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '我们主要是通过优化推荐策略和做一些营销活动来提升用户活跃度的，' +
      '团队一起讨论了很多方案，最后选了几个效果比较好的去执行。',
    expectedBehavior: `
      1. 语气温和鼓励，如"没关系，可以慢慢想"或"你可以从一个具体的活动开始讲"
      2. 引导而非质疑："比如你们当时做的第一个实验是什么？"
      3. 不应出现"太虚了""不够具体"等压力用语
      4. 给提示降低难度
    `,
  },

  // ═══ 用例 10：难度对比—标准 ───────────────────────────
  {
    name: 'difficulty_standard_vague_answer',
    description: '标准模式：同一段模糊回答，Agent 应该专业追问但不施压',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你在网易云音乐做的用户增长，DAU提升了15%，能展开讲讲吗？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":1},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '我们主要是通过优化推荐策略和做一些营销活动来提升用户活跃度的，' +
      '团队一起讨论了很多方案，最后选了几个效果比较好的去执行。',
    expectedBehavior: `
      1. 语气专业中立："你能具体说一个实验的设计思路吗？"
      2. 追问要求具体化，但不带质疑语气
      3. 可能追问个人贡献："你在这个过程中的角色是什么？"
      4. 不应有"没关系""慢慢想"等友好用语，也不应有"太虚了"等压力用语
    `,
  },

  // ═══ 用例 11：难度对比—压力 ───────────────────────────
  {
    name: 'difficulty_pressure_vague_answer',
    description: '压力模式：同一段模糊回答，Agent 应该犀利质疑并施压',
    mode: 'resume_deep_dive',
    difficulty: 'pressure',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你在网易云音乐做的用户增长，DAU提升了15%，能展开讲讲吗？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":1},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '我们主要是通过优化推荐策略和做一些营销活动来提升用户活跃度的，' +
      '团队一起讨论了很多方案，最后选了几个效果比较好的去执行。',
    expectedBehavior: `
      1. 语气犀利："这个回答太虚了。我需要你具体说。"
      2. 质疑数据可信度："15%怎么算的？有对照组吗？"
      3. 追问个人贡献："你总说'团队''我们'，你到底做了什么？"
      4. 评分严格：quantification 给 1 分
      5. 不应出现友好/标准模式的缓和用语
    `,
  },

  // ═══ 用例 12：边界—候选人给出极短回答 ──────────────────
  {
    name: 'edge_very_short_answer',
    description: '候选人只回了一个词，Agent 应该追问而非放过',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你做的分布式KV存储，Raft协议的选举机制你们怎么实现的？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":3},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer: '就是照着论文实现的。',
    expectedBehavior: `
      1. 不应满足于一个词的回答
      2. 追问要求展开："具体说说？比如选举超时你们设的多少？"
      3. 如果追问后仍然极短，记录弱点，换题
      4. evaluation 各项给低分
    `,
  },

  // ═══ 用例 13：边界—候选人反问面试官 ────────────────────
  {
    name: 'edge_candidate_asks_back',
    description: '面试中途候选人反问面试官，Agent 应礼貌拒绝并拉回面试节奏',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你简历里写了熟悉Redis和Kafka，在字节实习时这两个技术你怎么选型的？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":3},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '这个我觉得当时主要是团队已有的技术栈决定的。对了，我想问一下，' +
      '你们公司对新人有什么培训计划吗？我比较关心这个。',
    expectedBehavior: `
      1. 不应回答候选人的问题（面试中不是反问环节）
      2. 礼貌拉回："这个问题可以等反问环节再聊，我们先继续你的面试。"
      3. 继续刚才的话题或自然换题
      4. 不应出现因为被反问而慌乱的表现
    `,
  },

  // ═══ 用例 14：边界—候选人简历矛盾 ──────────────────────
  {
    name: 'edge_resume_contradiction',
    description: '候选人回答与简历矛盾，Agent 应记录但不羞辱',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content:
          '{"message":"你简历里写了Python，能讲讲你在实际项目中用Python做了什么吗？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":4},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '其实Python我主要是自学的，用得不多，可能就是照着教程写过一些脚本。' +
      '我主要还是用Java多一些。',
    expectedBehavior: `
      1. 注意到简历写了Python但候选人承认用得不多
      2. 标准模式：不纠缠，自然过渡："了解了。那Java方面呢？"
      3. 不应批评或羞辱候选人
      4. evaluation 中 technicalDepth 应给低分
      5. notes 应记录"技能栏写了Python但候选人承认不熟练"
    `,
  },

  // ═══ 用例 15：综合模式完整阶段流转 ──────────────────
  {
    name: 'comprehensive_full_flow',
    description: '综合模式的阶段流转：从深挖过渡到行为问题',
    mode: 'comprehensive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content: '{"message":"你好，我是今天面试官李昂。面试大概15分钟，先从自我介绍开始吧。","metadata":{"evaluation":{},"phase":"self_intro","questionIndex":0},"isComplete":false,"completionReason":null}',
      },
      {
        role: 'user',
        content: '我是张同学，浙大软件工程硕士，有两段实习：字节后端开发和网易产品实习。',
      },
      {
        role: 'assistant',
        content: '{"message":"了解了。先聊聊字节实习吧，推荐系统优化具体做了什么？","metadata":{"evaluation":{"starCompleteness":3,"quantification":2,"logicClarity":4,"technicalDepth":3,"communication":4,"notes":"结构清晰但缺细节","followUpNeeded":true,"followUpReason":"需要深入技术细节"},"phase":"resume_deep","questionIndex":2},"isComplete":false,"completionReason":null}',
      },
      {
        role: 'user',
        content: '优化推荐接口延迟从200ms降到80ms，用了异步解耦、Redis多级缓存、数据库索引优化。',
      },
      {
        role: 'assistant',
        content: '{"message":"异步解耦后数据一致性怎么保证的？","metadata":{"evaluation":{"starCompleteness":4,"quantification":4,"logicClarity":4,"technicalDepth":4,"communication":4,"notes":"回答扎实","followUpNeeded":true,"followUpReason":"验证技术深度"},"phase":"resume_deep","questionIndex":3},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer: '我们做了消息重试机制，失败了三次就走兜底策略。',
    expectedBehavior: `
      1. 继续追问或自然过渡到下一阶段
      2. phase 应从 resume_deep 向前推进
      3. 不回到已完成的阶段
      4. isComplete 仍为 false
    `,
  },

  // ═══ 用例 16：连续 3 轮敷衍自动换题 ────────────────
  {
    name: 'edge_three_weak_answers',
    description: '候选人连续多轮极短敷衍回答，Agent 应果断换题',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content: '{"message":"你在字节做的AB实验平台，具体怎么设计实验分流的？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":1},"isComplete":false,"completionReason":null}',
      },
      { role: 'user', content: '就是用的哈希分流。' },
      {
        role: 'assistant',
        content: '{"message":"哈希冲突怎么处理的？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":2},"isComplete":false,"completionReason":null}',
      },
      { role: 'user', content: '没有特别处理。' },
    ],
    latestUserAnswer: '不太清楚具体的。',
    expectedBehavior: `
      1. 识别到连续敷衍，果断换题
      2. 过渡到简历中其他经历
      3. 不应继续追问同一个话题
    `,
  },

  // ═══ 用例 17：候选人超长回答 ──────────────────────────
  {
    name: 'edge_very_long_answer',
    description: '候选人200+字长回答，Agent 应选关键点追问而非泛泛回复',
    mode: 'resume_deep_dive',
    difficulty: 'standard',
    resume: SAMPLE_RESUME,
    conversationHistory: [
      {
        role: 'assistant',
        content: '{"message":"你在字节做的推荐系统优化，能具体讲讲吗？","metadata":{"evaluation":{},"phase":"resume_deep","questionIndex":1},"isComplete":false,"completionReason":null}',
      },
    ],
    latestUserAnswer:
      '我们做了几件事。第一是异步化改造，用Kafka做消息队列解耦。' +
      '第二是加多级缓存，本地Caffeine做L1，Redis做L2。' +
      '第三是数据库索引优化，加了联合索引。' +
      '第四是限流熔断防止下游拖垮链路。整个过程做了两个月。',
    expectedBehavior: `
      1. 不应说"展开说说"——回答已经够具体了
      2. 选一个点精准追问："异步化后数据一致性怎么保证？"或"限流的阈值怎么定的？"
      3. 追问应专业且有方向感
    `,
  },
];

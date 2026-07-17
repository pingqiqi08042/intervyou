/**
 * types.ts — 类型定义
 */

export type InterviewMode = 'resume_deep_dive' | 'behavioral' | 'technical' | 'comprehensive';
export type Difficulty = 'friendly' | 'standard' | 'pressure';
export type InterviewPhase =
  | 'opening'
  | 'self_intro'
  | 'resume_deep'
  | 'behavioral_q'
  | 'situational'
  | 'reverse_q'
  | 'closing';

export interface ParsedResume {
  name: string;
  education: {
    school: string;
    degree: string;
    major: string;
    year: string;
  }[];
  experiences: {
    type: 'internship' | 'fulltime' | 'project' | 'activity';
    company: string;
    role: string;
    duration: string;
    description: string;
    highlights: string[];
    techStack?: string[];
  }[];
  skills: string[];
  jobIntent?: string; // 简历中的求职意向
  projects: {
    name: string;
    role: string;
    description: string;
    highlights: string[];
    techStack?: string[];
  }[];
}

export interface BuildPromptParams {
  resume: ParsedResume;
  mode: InterviewMode;
  difficulty: Difficulty;
  currentPhase?: InterviewPhase;
  questionIndex: number;
}

export interface AgentResponse {
  message: string;
  metadata: {
    evaluation: {
      starCompleteness: number;
      quantification: number;
      logicClarity: number;
      technicalDepth: number;
      communication: number;
      notes: string;
      followUpNeeded: boolean;
      followUpReason: string;
    };
    phase: InterviewPhase;
    questionIndex: number;
  };
  isComplete: boolean;
  completionReason: string | null;
}

export interface TestCase {
  name: string;
  description: string;
  mode: InterviewMode;
  difficulty: Difficulty;
  resume: ParsedResume;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  latestUserAnswer: string;
  expectedBehavior: string; // 用自然语言描述期望的 Agent 行为
}

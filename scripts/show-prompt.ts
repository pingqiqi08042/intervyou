import { buildSystemPromptV2 } from '../src/lib/prompts/system-v2';
import { SAMPLE_RESUME } from '../tests/test-cases';
import * as fs from 'fs';

const prompt = buildSystemPromptV2({
  resume: SAMPLE_RESUME,
  mode: 'standard',
  jobRole: 'product',
  questionIndex: 3,
  currentPhase: 'resume_deep',
});

fs.writeFileSync('tests/output/sample-prompt-product-standard.txt', prompt, 'utf-8');
console.log('Saved. Length:', prompt.length, 'chars, ~', Math.round(prompt.length / 2), 'tokens');

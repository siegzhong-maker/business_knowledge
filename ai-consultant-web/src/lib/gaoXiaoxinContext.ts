import fs from 'fs';
import path from 'path';

type KnowledgeItem = {
  source: string;
  content: string;
};

let cachedContext: string | null = null;

/**
 * Load and flatten the Gao Xiaoxin meeting minutes library
 * into a single long context string for the system prompt.
 */
export function buildGaoXiaoxinContext(): string {
  if (cachedContext) return cachedContext;

  try {
    const filePath = path.join(process.cwd(), 'data', 'knowledge_base.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data: KnowledgeItem[] = JSON.parse(raw);

    let context = 'Here is the library of Meeting Minutes you have access to:\n\n';

    for (const item of data) {
      const filename = item.source;
      const content = item.content;
      context += `=== DOCUMENT: ${filename} ===\n${content}\n\n`;
    }

    cachedContext = context;
    return context;
  } catch (error) {
    console.error('Failed to load Gao Xiaoxin knowledge base:', error);
    return 'No knowledge base found. Please ensure data/knowledge_base.json is present.';
  }
}


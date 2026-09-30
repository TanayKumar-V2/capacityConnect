import { RetrievalResult } from './retrieval';

const MAX_CONTEXT_LENGTH = 12000;

export function buildContext(chunks: RetrievalResult[]): string {
  let context = '';
  
  for (const chunk of chunks) {
    // We format the chunk clearly so that it's distinguished from instructions
    const chunkText = `\n--- SOURCE: Resource ${chunk.resourceId} (Course ${chunk.courseId}) ---\n${chunk.content}\n-----------------------------------\n`;
    
    // Check if adding this chunk exceeds the context limit
    if (context.length + chunkText.length > MAX_CONTEXT_LENGTH) {
      break; // Stop adding when limit is reached
    }
    
    context += chunkText;
  }
  
  return context.trim();
}

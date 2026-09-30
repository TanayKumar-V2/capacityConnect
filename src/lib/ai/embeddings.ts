import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  // Use text-embedding-004 which supports 768 dimensions by default
  const response = await genAI.models.embedContent({
    model: 'text-embedding-004',
    contents: text,
  });

  const vector = response.embeddings?.[0]?.values;
  if (!vector) {
    throw new Error('Failed to generate embedding');
  }

  if (vector.length !== 768) {
    throw new Error(`Embedding dimension mismatch. Expected 768, got ${vector.length}`);
  }

  return vector;
}

export function chunkText(text: string, chunkSize = 1200, overlap = 200): string[] {
  if (!text) return [];
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let i = 0;
  
  while (i < cleanText.length) {
    chunks.push(cleanText.substring(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  
  return chunks;
}

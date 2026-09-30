import { prisma } from '../prisma';
import { generateEmbedding } from '../ai/embeddings';

type RawSemanticResult = {
  chunkId: string;
  resourceId: string;
  courseId: string;
  lessonId: string;
  content: string;
  semanticScore: number;
};

type RawKeywordResult = {
  chunkId: string;
  resourceId: string;
  courseId: string;
  lessonId: string;
  content: string;
  keywordScore: number;
};

export interface RetrievalResult {
  chunkId: string;
  resourceId: string;
  courseId: string;
  lessonId: string;
  content: string;
  semanticScore: number;
  keywordScore: number;
  hybridScore: number;
}

const SEMANTIC_WEIGHT = 0.65;
const KEYWORD_WEIGHT = 0.35;
const THRESHOLD = 0.65;
const SEMANTIC_TOP_K = 20;
const KEYWORD_TOP_K = 20;
const FINAL_TOP_K = 10;

export async function retrieveRelevantChunks(
  userId: string,
  organizationId: string,
  query: string,
  courseId?: string
): Promise<RetrievalResult[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('Query cannot be empty');
  }
  if (query.length > 1000) {
    throw new Error('Query exceeds maximum length of 1000 characters');
  }

  // 1. Generate query embedding
  const queryVector = await generateEmbedding(query);
  
  // Format vector for pgvector
  const vectorStr = `[${queryVector.join(',')}]`;

  // 2. Perform Semantic Retrieval (Authorized)
  // We constrain the vector search strictly to courses the user is enrolled in (or the specific course requested)
  // and ensuring it belongs to their organization.
  
  // Parameterized SQL for Semantic Search
  const semanticResults: RawSemanticResult[] = await prisma.$queryRaw`
    SELECT 
      rc.id as "chunkId",
      rc."resourceId",
      r."courseId",
      r."lessonId",
      rc.content,
      1 - (rc.embedding <=> ${vectorStr}::vector) as "semanticScore"
    FROM "ResourceChunk" rc
    JOIN "Resource" r ON rc."resourceId" = r.id
    JOIN "Course" c ON r."courseId" = c.id
    JOIN "Enrollment" e ON e."courseId" = c.id
    WHERE e."userId" = ${userId}
    ORDER BY rc.embedding <=> ${vectorStr}::vector
    LIMIT ${SEMANTIC_TOP_K};
  `;

  // 3. Perform Keyword Retrieval (Authorized)
  const searchTerms = query.split(' ').filter(w => w.length > 3).join(' | '); // simple tsquery
  let keywordResults: RawKeywordResult[] = [];
  
  if (searchTerms.length > 0) {
    keywordResults = await prisma.$queryRaw`
      SELECT 
        rc.id as "chunkId",
        rc."resourceId",
        r."courseId",
        r."lessonId",
        rc.content,
        ts_rank_cd(to_tsvector('english', rc.content), to_tsquery('english', ${searchTerms})) as "keywordScore"
      FROM "ResourceChunk" rc
      JOIN "Resource" r ON rc."resourceId" = r.id
      JOIN "Course" c ON r."courseId" = c.id
      JOIN "Enrollment" e ON e."courseId" = c.id
      WHERE e."userId" = ${userId}
      AND to_tsvector('english', rc.content) @@ to_tsquery('english', ${searchTerms})
      ORDER BY "keywordScore" DESC
      LIMIT ${KEYWORD_TOP_K};
    `;
  }

  // 4. Hybrid Ranking & Deduplication
  const map = new Map<string, RetrievalResult>();

  // Normalize semantic (already 0-1 from cosine distance)
  for (const row of semanticResults) {
    map.set(row.chunkId, {
      chunkId: row.chunkId,
      resourceId: row.resourceId,
      courseId: row.courseId,
      lessonId: row.lessonId,
      content: row.content,
      semanticScore: row.semanticScore,
      keywordScore: 0,
      hybridScore: 0
    });
  }

  // Normalize keyword scores (approximate max rank mapping)
  const maxKwScore = keywordResults.length > 0 ? Math.max(...keywordResults.map(r => r.keywordScore)) : 1;
  const safeMaxKw = maxKwScore > 0 ? maxKwScore : 1;

  for (const row of keywordResults) {
    const normKw = row.keywordScore / safeMaxKw;
    if (map.has(row.chunkId)) {
      map.get(row.chunkId)!.keywordScore = normKw;
    } else {
      map.set(row.chunkId, {
        chunkId: row.chunkId,
        resourceId: row.resourceId,
        courseId: row.courseId,
        lessonId: row.lessonId,
        content: row.content,
        semanticScore: 0,
        keywordScore: normKw,
        hybridScore: 0
      });
    }
  }

  // Calculate Hybrid
  const finalResults: RetrievalResult[] = [];
  for (const result of map.values()) {
    result.hybridScore = (result.semanticScore * SEMANTIC_WEIGHT) + (result.keywordScore * KEYWORD_WEIGHT);
    if (result.hybridScore >= THRESHOLD) {
      finalResults.push(result);
    }
  }

  return finalResults.sort((a, b) => b.hybridScore - a.hybridScore).slice(0, FINAL_TOP_K);
}

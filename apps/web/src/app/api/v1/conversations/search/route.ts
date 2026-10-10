import { z } from 'zod';
import { apiRoute, intParam, query } from '@/server/api/rest';
import { searchConversations } from '@/server/api/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/conversations/search?q=refund&limit=10 */
export const GET = apiRoute(async (p, req) => {
  const q = z.object({ q: z.string().min(2), limit: intParam }).parse(query(req));
  return searchConversations(p, q.q, q.limit);
});

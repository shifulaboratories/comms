import { z } from 'zod';
import { apiRoute, intParam, jsonBody, query, type IdCtx } from '@/server/api/rest';
import { getConversation, sendReply } from '@/server/api/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/conversations/:id/messages?limit=30&before=ISO */
export const GET = apiRoute(async (p, req, { params }: IdCtx) => {
  const { id } = await params;
  const q = z
    .object({ limit: intParam, before: z.string().datetime({ offset: true }).optional() })
    .parse(query(req));
  return (await getConversation(p, id, { messageLimit: q.limit, before: q.before })).messages;
});

/** POST /api/v1/conversations/:id/messages { body } — send a reply. */
export const POST = apiRoute(async (p, req, { params }: IdCtx) => {
  const { id } = await params;
  const b = z.object({ body: z.string().min(1) }).parse(await jsonBody(req));
  return sendReply(p, id, b.body);
});

import { z } from 'zod';
import { apiRoute, intParam, jsonBody, query, type IdCtx } from '@/server/api/rest';
import { getConversation, updateConversation } from '@/server/api/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/conversations/:id?messages=30&before=ISO&notes=true */
export const GET = apiRoute(async (p, req, { params }: IdCtx) => {
  const { id } = await params;
  const q = z
    .object({
      messages: intParam,
      before: z.string().datetime({ offset: true }).optional(),
      notes: z.enum(['true', 'false']).optional(),
    })
    .parse(query(req));
  return getConversation(p, id, {
    messageLimit: q.messages,
    before: q.before,
    includeNotes: q.notes === 'true',
  });
});

/** PATCH /api/v1/conversations/:id { status?, priority?, assigneeEmail? } */
export const PATCH = apiRoute(async (p, req, { params }: IdCtx) => {
  const { id } = await params;
  const b = z
    .object({
      status: z.enum(['open', 'pending', 'snoozed', 'closed']).optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      assigneeEmail: z.string().nullable().optional(),
    })
    .parse(await jsonBody(req));
  return updateConversation(p, id, b);
});

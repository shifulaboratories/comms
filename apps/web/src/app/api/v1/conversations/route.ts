import { z } from 'zod';
import { apiRoute, intParam, jsonBody, query } from '@/server/api/rest';
import { listConversations, startConversation } from '@/server/api/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/conversations?status=open&assigned=me&contactId=…&limit=20&before=ISO */
export const GET = apiRoute(async (p, req) => {
  const q = z
    .object({
      status: z.enum(['open', 'pending', 'snoozed', 'closed', 'all']).optional(),
      assigned: z.enum(['me', 'unassigned', 'any']).optional(),
      contactId: z.string().optional(),
      limit: intParam,
      before: z.string().datetime({ offset: true }).optional(),
    })
    .parse(query(req));
  return listConversations(p, q);
});

/** POST /api/v1/conversations { address, body } — message a phone number or email. */
export const POST = apiRoute(async (p, req) => {
  const b = z
    .object({ address: z.string().min(3), body: z.string().min(1) })
    .parse(await jsonBody(req));
  return startConversation(p, b);
});

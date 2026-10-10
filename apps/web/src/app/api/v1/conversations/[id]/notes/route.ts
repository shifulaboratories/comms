import { z } from 'zod';
import { apiRoute, jsonBody, type IdCtx } from '@/server/api/rest';
import { addNote } from '@/server/api/service';

export const dynamic = 'force-dynamic';

/** POST /api/v1/conversations/:id/notes { body } — add an internal note. */
export const POST = apiRoute(async (p, req, { params }: IdCtx) => {
  const { id } = await params;
  const b = z.object({ body: z.string().min(1) }).parse(await jsonBody(req));
  return addNote(p, id, b.body);
});

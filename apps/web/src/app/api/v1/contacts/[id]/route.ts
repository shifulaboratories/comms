import { apiRoute, type IdCtx } from '@/server/api/rest';
import { getContact } from '@/server/api/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/contacts/:id — details, known facts and recent conversations. */
export const GET = apiRoute(async (p, _req, { params }: IdCtx) => getContact(p, (await params).id));

import { z } from 'zod';
import { apiRoute, intParam, query } from '@/server/api/rest';
import { findContacts } from '@/server/api/service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/contacts?query=…  or  ?phone=…&email=… */
export const GET = apiRoute(async (p, req) => {
  const q = z
    .object({
      query: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      limit: intParam,
    })
    .refine((v) => v.query || v.phone || v.email, 'Pass query, phone or email.')
    .parse(query(req));
  return findContacts(p, q);
});

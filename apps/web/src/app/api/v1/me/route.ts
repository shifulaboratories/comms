import { apiRoute } from '@/server/api/rest';
import { whoAmI } from '@/server/api/service';

export const dynamic = 'force-dynamic';

export const GET = apiRoute(async (p) => whoAmI(p));

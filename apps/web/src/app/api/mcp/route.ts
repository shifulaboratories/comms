import { mcpGet, mcpOptions, mcpPost } from '@/server/api/mcp';
import { tokenFromRequest } from '@/server/api/tokens';

export const dynamic = 'force-dynamic';

/** MCP over Streamable HTTP. Authenticate with `Authorization: Bearer cms_…`. */
export async function POST(req: Request) {
  return mcpPost(req, tokenFromRequest(req));
}
export const GET = mcpGet;
export const OPTIONS = mcpOptions;

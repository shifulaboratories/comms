import { mcpGet, mcpOptions, mcpPost } from '@/server/api/mcp';
import { tokenFromRequest } from '@/server/api/tokens';

export const dynamic = 'force-dynamic';

/**
 * The same MCP server with the key in the URL, for clients that can only be
 * given a URL — Claude's and ChatGPT's "add a custom connector" screens. The
 * URL is the credential: it is shown once and revoking the key kills it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return mcpPost(req, tokenFromRequest(req) ?? decodeURIComponent(key));
}
export const GET = mcpGet;
export const OPTIONS = mcpOptions;

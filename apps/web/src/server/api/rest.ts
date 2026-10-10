import 'server-only';
import { z } from 'zod';
import { ApiError, authenticateToken, tokenFromRequest, type ApiPrincipal } from './tokens';

/**
 * Wrap a REST handler: authenticate the bearer key, run, and turn failures
 * into JSON errors with the right status. Every v1 route goes through here.
 */
export function apiRoute<Ctx>(
  handler: (p: ApiPrincipal, req: Request, ctx: Ctx) => Promise<unknown>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const principal = await authenticateToken(tokenFromRequest(req));
    if (!principal) {
      return Response.json(
        { error: { code: 'unauthorized', message: 'Missing or invalid Comms API key.' } },
        { status: 401, headers: { 'www-authenticate': 'Bearer realm="comms"' } },
      );
    }
    try {
      const data = await handler(principal, req, ctx);
      return Response.json({ data });
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json(
          { error: { code: codeFor(err.status), message: err.message } },
          { status: err.status },
        );
      }
      if (err instanceof z.ZodError) {
        return Response.json(
          {
            error: {
              code: 'invalid_request',
              message: err.issues
                .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
                .join('; '),
            },
          },
          { status: 400 },
        );
      }
      console.error('[api] unhandled', err);
      return Response.json(
        { error: { code: 'internal', message: 'Something went wrong.' } },
        { status: 500 },
      );
    }
  };
}

function codeFor(status: number) {
  return status === 404
    ? 'not_found'
    : status === 403
      ? 'forbidden'
      : status === 422
        ? 'unprocessable'
        : 'error';
}

export async function jsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'The request body must be JSON.');
  }
}

export const query = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);
export const intParam = z.coerce.number().int().optional();

export type IdCtx = { params: Promise<{ id: string }> };

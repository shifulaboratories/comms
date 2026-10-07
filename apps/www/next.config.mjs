import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Trace from the monorepo root so pnpm's symlinked node_modules resolve.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  eslint: { ignoreDuringBuilds: true },
  // Every page is static, so the site can also ship as plain files — that's
  // how it deploys to Cloudflare (see wrangler.jsonc). Opt-in, because
  // `next start` (the Railway path) refuses to serve an exported build.
  ...(process.env.STATIC_EXPORT === '1' ? { output: 'export' } : {}),
};

export default nextConfig;

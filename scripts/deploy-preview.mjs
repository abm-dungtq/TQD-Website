// Builds and deploys the preview Worker (tqd-next) using the "preview" wrangler environment.
import { execSync } from 'node:child_process';

const env = { ...process.env, CLOUDFLARE_ENV: 'preview' };
execSync('npm run build', { stdio: 'inherit', env });
execSync('npx wrangler deploy', { stdio: 'inherit', env });

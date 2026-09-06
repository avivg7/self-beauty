import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface Target {
  url: string;
  anonKey: string;
  serviceKey: string;
  remote: boolean;
}

/**
 * Default: the LOCAL stack (values from the Supabase CLI; anything non-local is refused).
 * Production verification (run once, right after `db push`, before any real data exists):
 *   SB_PROD_VERIFY=1 with SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in the environment
 *   (loaded from a private env file outside the repo — see docs/RUNBOOK.md). The suite refuses to run remotely
 *   when the listings table is not empty, and it only ever deletes rows and users it created itself.
 */
export async function target(): Promise<Target> {
  if (process.env.SB_PROD_VERIFY === '1') {
    const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))
      throw new Error(`SB_PROD_VERIFY needs a https://<ref>.supabase.co SUPABASE_URL, got "${url}"`);
    if (!anonKey || !serviceKey) throw new Error('SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY missing');
    return { url, anonKey, serviceKey, remote: true };
  }
  const { stdout } = await run('npx', ['supabase', 'status', '-o', 'env'], { cwd: process.cwd() });
  const vars = Object.fromEntries(
    stdout
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [
          l.slice(0, i).trim(),
          l
            .slice(i + 1)
            .trim()
            .replace(/^"|"$/g, ''),
        ];
      }),
  );
  const url = vars.API_URL ?? '';
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url))
    throw new Error(`refusing non-local API_URL: ${url}`);
  const anonKey = vars.ANON_KEY ?? vars.PUBLISHABLE_KEY ?? '';
  const serviceKey = vars.SERVICE_ROLE_KEY ?? vars.SECRET_KEY ?? '';
  if (!anonKey || !serviceKey) throw new Error('local stack keys missing; run `npx supabase start`');
  return { url, anonKey, serviceKey, remote: false };
}

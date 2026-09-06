import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Reads the local stack's URL and keys from the Supabase CLI. Refuses anything that is not localhost. */
export async function localStack(): Promise<{ url: string; anonKey: string; serviceKey: string }> {
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
  return { url, anonKey, serviceKey };
}

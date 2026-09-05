import type { APIRoute } from 'astro';
import { href } from '@/lib/urls';

export const GET: APIRoute = ({ site }) => {
  const sitemap = site ? new URL(href('/sitemap-index.xml'), site).toString() : href('/sitemap-index.xml');
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemap}`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

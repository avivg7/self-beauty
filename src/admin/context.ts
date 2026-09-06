import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

export type ToastKind = 'ok' | 'error' | 'info';
export interface AppApi {
  toast: (message: string, kind?: ToastKind) => void;
  /** Called when an API call fails with an expired/invalid session: signs out and shows the login screen. */
  onAuthError: () => void;
  siteHref: string;
}
export const AppContext = createContext<AppApi>({ toast: () => {}, onAuthError: () => {}, siteHref: '/' });
export const useApp = () => useContext(AppContext);

export type Route = { name: 'list' } | { name: 'archive' } | { name: 'new' } | { name: 'edit'; id: string };
export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h === 'archive') return { name: 'archive' };
  if (h === 'new') return { name: 'new' };
  const m = /^edit\/([0-9a-f-]{36})$/i.exec(h);
  if (m) return { name: 'edit', id: m[1]! };
  return { name: 'list' };
}
export function routeHref(r: Route): string {
  switch (r.name) {
    case 'archive':
      return '#/archive';
    case 'new':
      return '#/new';
    case 'edit':
      return `#/edit/${r.id}`;
    default:
      return '#/';
  }
}
export function navigate(r: Route) {
  location.hash = routeHref(r);
}

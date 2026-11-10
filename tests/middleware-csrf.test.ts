import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// The login and account-link pages need a CSRF cookie before the first POST.

function get(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, { headers: { 'cf-connecting-ip': '127.0.0.1' } });
}

describe('middleware CSRF cookie', () => {
  it.each(['/login', '/account/setup'])('sets the CSRF cookie on %s', (path) => {
    const res = middleware(get(path));
    expect(res.cookies.get('csrf_token')?.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not set it on other pages', () => {
    expect(middleware(get('/review')).cookies.get('csrf_token')).toBeUndefined();
  });
});

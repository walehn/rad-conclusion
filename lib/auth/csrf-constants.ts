/** Cookie name that carries the double-submit CSRF token (non-httpOnly so the client can echo it). */
export const CSRF_COOKIE_NAME = 'csrf_token';
/** Header name the client uses to echo the CSRF token on state-changing requests. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

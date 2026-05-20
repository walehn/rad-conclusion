"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotionPalette } from "@/components/notion-tone";

interface LoginFormProps {
  csrfToken: string;
  nextPath: string;
}

/**
 * Client-side login form. CSRF token is passed via a custom header
 * (double-submit pattern); a hidden input is also rendered for defense-in-depth
 * progressive-enhancement scenarios.
 */
export function LoginForm({ csrfToken, nextPath }: LoginFormProps): React.ReactElement {
  const router = useRouter();
  const { c, tokens } = useNotionPalette();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ email, password, next: nextPath }),
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const seconds = retryAfter ? parseInt(retryAfter, 10) : 0;
        setError(
          seconds > 0
            ? `로그인 시도가 너무 많습니다. ${seconds}초 후 다시 시도해 주세요.`
            : "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
        );
        return;
      }

      if (!res.ok) {
        let message = "로그인에 실패했습니다";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse failure; fall through with default message
        }
        setError(message);
        return;
      }

      const data = (await res.json()) as { redirectTo?: string };
      const target = data?.redirectTo || "/";
      router.push(target);
      // Refresh so server components re-read the new session cookie.
      router.refresh();
    } catch {
      setError("로그인 요청 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ ...tokens, background: c.canvas }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="grid h-12 w-12 place-items-center rounded-xl"
            style={{
              background: c.accentBg,
              color: c.primary,
              border: `1px solid ${c.hairlineSoft}`,
            }}
          >
            <Stethoscope className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1
              className="text-[28px] font-semibold"
              style={{ color: c.ink, letterSpacing: "-0.4px" }}
            >
              Rad Conclusion
            </h1>
            <p
              className="mt-1 text-[14px]"
              style={{ color: c.slate }}
            >
              계정으로 로그인하여 계속 진행하세요
            </p>
          </div>
        </div>

        <div
          className="rounded-xl border p-6"
          style={{
            background: c.card,
            borderColor: c.hairline,
          }}
        >
          <div className="mb-4">
            <div
              className="text-[11px] font-medium uppercase"
              style={{ color: c.steel, letterSpacing: "0.08em" }}
            >
              Sign in
            </div>
            <div
              className="mt-0.5 text-[17px] font-semibold"
              style={{ color: c.ink, letterSpacing: "-0.2px" }}
            >
              로그인
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {/* Hidden CSRF field for defensive progressive enhancement. */}
              <input type="hidden" name="csrf_token" value={csrfToken} />

              {/* suppressHydrationWarning: password managers (LastPass,
                  1Password, Bitwarden, etc.) inject sibling helper elements
                  next to the <input> at runtime, which produces benign
                  hydration mismatches against the SSR markup. The wrapper is
                  the closest common ancestor where the injected node lands. */}
              <div className="flex flex-col gap-2" suppressHydrationWarning>
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  아이디
                </label>
                <input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="cmcabdomen 또는 you@example.com"
                />
              </div>

              <div className="flex flex-col gap-2" suppressHydrationWarning>
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  비밀번호
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={loading}
                className="w-full font-medium"
                size="lg"
                style={{
                  background: c.primary,
                  color: c.primaryForeground,
                  borderRadius: 9999,
                }}
              >
                {loading ? (
                  "로그인 중..."
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    로그인
                  </>
                )}
              </Button>
            </form>
          </div>

        <p
          className="mt-6 text-center text-[12px]"
          style={{ color: c.steel }}
        >
          계정 문의는 관리자에게 연락해 주세요.
        </p>
      </div>
    </div>
  );
}

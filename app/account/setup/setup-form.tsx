"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, Stethoscope, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotionPalette } from "@/components/notion-tone";

interface SetupFormProps {
  csrfToken: string;
}

type LinkInfo = { kind: "invite" | "reset"; expiresAt: string; username: string | null };

type State =
  | { step: "checking" }
  | { step: "invalid"; message: string; reason?: string }
  | { step: "form"; token: string; info: LinkInfo }
  | { step: "done"; kind: "invite" | "reset"; username: string };

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function formatKst(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

/**
 * Invite: choose a username and password for a new account.
 * Reset: choose a new password for the account the link names.
 *
 * The token comes from the URL fragment and is removed from the address bar
 * as soon as it is read, so it does not linger in history or on screen.
 */
export function SetupForm({ csrfToken }: SetupFormProps): React.ReactElement {
  const { c, tokens } = useNotionPalette();
  const [state, setState] = React.useState<State>({ step: "checking" });
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const post = React.useCallback(
    (path: string, body: unknown) =>
      fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(body),
      }),
    [csrfToken]
  );

  React.useEffect(() => {
    const token = window.location.hash.slice(1);
    if (token) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (!token) {
      setState({ step: "invalid", message: "링크가 올바르지 않습니다. 받은 링크 전체를 다시 열어 주세요." });
      return;
    }
    post("/api/account-links/inspect", { token })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ step: "invalid", message: data.error ?? "유효하지 않거나 만료된 링크입니다", reason: data.reason });
          return;
        }
        setState({ step: "form", token, info: data as LinkInfo });
      })
      .catch(() => setState({ step: "invalid", message: "링크를 확인하지 못했습니다. 잠시 후 다시 열어 주세요." }));
  }, [post]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.step !== "form" || submitting) return;
    setError("");
    if (password !== confirm) {
      setError("두 비밀번호가 다릅니다");
      return;
    }
    setSubmitting(true);
    try {
      const res = await post("/api/account-links/redeem", {
        token: state.token,
        username: state.info.kind === "invite" ? username : undefined,
        password,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setState({ step: "invalid", message: data.error ?? "유효하지 않거나 만료된 링크입니다", reason: data.reason });
        } else {
          setError(data.error ?? "처리하지 못했습니다");
        }
        return;
      }
      setPassword("");
      setConfirm("");
      setState({ step: "done", kind: data.kind, username: data.username });
    } catch {
      setError("요청 중 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const isInvite = state.step === "form" && state.info.kind === "invite";
  const title =
    state.step === "form" ? (isInvite ? "계정 만들기" : "비밀번호 재설정") : state.step === "done" ? "완료" : "계정 설정";

  return (
    <div className="min-h-screen" style={{ ...tokens, background: c.canvas }}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="grid h-12 w-12 place-items-center rounded-xl"
            style={{ background: c.accentBg, color: c.primary, border: `1px solid ${c.hairlineSoft}` }}
          >
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="text-[28px] font-semibold" style={{ color: c.ink, letterSpacing: "-0.4px" }}>
            Rad Conclusion
          </h1>
        </div>

        <div className="rounded-xl border p-6" style={{ background: c.card, borderColor: c.hairline }}>
          <div className="mb-4 text-[17px] font-semibold" style={{ color: c.ink, letterSpacing: "-0.2px" }}>
            {title}
          </div>

          {state.step === "checking" && (
            <p className="text-sm" style={{ color: c.slate }}>
              링크를 확인하고 있습니다…
            </p>
          )}

          {state.step === "invalid" && (
            <div className="flex flex-col gap-3">
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {state.message}
              </div>
              {state.reason === "used" ? (
                <>
                  <p className="text-sm" style={{ color: c.slate }}>
                    직접 사용하지 않았는데 이 안내가 나온다면 관리자에게 알려 주세요.
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex h-11 w-full items-center justify-center text-sm font-medium"
                    style={{ background: c.primary, color: c.primaryForeground, borderRadius: 9999 }}
                  >
                    로그인하러 가기
                  </Link>
                </>
              ) : (
                <p className="text-sm" style={{ color: c.slate }}>
                  링크는 한 번만 쓸 수 있고 48시간 뒤 만료됩니다. 새 링크는 관리자에게 요청해 주세요.
                </p>
              )}
            </div>
          )}

          {state.step === "form" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <p className="text-sm" style={{ color: c.slate }}>
                {isInvite
                  ? "사용할 아이디와 비밀번호를 정해 주세요."
                  : `${state.info.username} 계정의 새 비밀번호를 정해 주세요. 다른 기기의 로그인은 모두 끊깁니다.`}
                <br />이 링크는 {formatKst(state.info.expiresAt)}까지 쓸 수 있습니다.
              </p>

              {isInvite && (
                <div className="flex flex-col gap-2" suppressHydrationWarning>
                  <label htmlFor="username" className="text-sm font-medium text-foreground">
                    아이디
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    disabled={submitting}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="영문 소문자, 숫자, . _ @ + -"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2" suppressHydrationWarning>
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  {isInvite ? "비밀번호" : "새 비밀번호"}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={submitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="8자 이상"
                />
              </div>

              <div className="flex flex-col gap-2" suppressHydrationWarning>
                <label htmlFor="confirm" className="text-sm font-medium text-foreground">
                  비밀번호 확인
                </label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={submitting}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={INPUT_CLASS}
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
                disabled={submitting}
                className="w-full font-medium"
                size="lg"
                style={{ background: c.primary, color: c.primaryForeground, borderRadius: 9999 }}
              >
                {submitting ? (
                  "처리 중..."
                ) : isInvite ? (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    계정 만들기
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    비밀번호 바꾸기
                  </>
                )}
              </Button>
            </form>
          )}

          {state.step === "done" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: c.slate }}>
                {state.kind === "invite"
                  ? `계정 ${state.username}을(를) 만들었습니다. 이제 로그인할 수 있습니다.`
                  : `${state.username} 계정의 비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.`}
              </p>
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center text-sm font-medium"
                style={{ background: c.primary, color: c.primaryForeground, borderRadius: 9999 }}
              >
                로그인하러 가기
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Check, Copy, KeyRound, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/auth/csrf-constants";
import { cn } from "@/lib/utils";

interface AccountRow {
  id: number;
  username: string;
  role: "admin" | "restricted";
  createdAt: string;
  lastLoginAt: string | null;
  disabledAt: string | null;
  invitedBy: string | null;
}

interface LinkRow {
  id: number;
  kind: "invite" | "reset";
  status: "pending" | "used" | "expired" | "revoked";
  note: string | null;
  target: string | null;
  usedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

/** A freshly created link: shown once, then only its row in the table remains. */
interface NewLink {
  kind: "invite" | "reset";
  label: string;
  url: string;
  expiresAt: string;
}

const STATUS_LABEL: Record<LinkRow["status"], string> = {
  pending: "대기",
  used: "사용됨",
  expired: "만료",
  revoked: "취소",
};

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function send(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The token goes in the fragment so it never appears in a request line or access log. */
function setupUrl(token: string): string {
  return `${window.location.origin}/account/setup#${token}`;
}

const CELL = "px-3 py-2 text-sm align-top";
const HEAD = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";

export function AccountsClient({ currentUserId }: { currentUserId: number }): React.ReactElement {
  const [accounts, setAccounts] = React.useState<AccountRow[]>([]);
  const [links, setLinks] = React.useState<LinkRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [newLink, setNewLink] = React.useState<NewLink | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/accounts");
      if (!res.ok) throw new Error(`목록을 불러오지 못했습니다 (${res.status})`);
      const data = (await res.json()) as { users: AccountRow[]; links: LinkRow[] };
      setAccounts(data.users);
      setLinks(data.links);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<Response>, onOk?: (res: Response) => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `요청이 실패했습니다 (${res.status})`);
        return;
      }
      if (onOk) await onOk(res);
      await load();
    } catch {
      setError("요청 중 오류가 발생했습니다");
    } finally {
      setBusy(false);
    }
  };

  const showLink = async (res: Response, kind: NewLink["kind"], label: string) => {
    const data = (await res.json()) as { token: string; expiresAt: string };
    setCopied(false);
    setNewLink({ kind, label, url: setupUrl(data.token), expiresAt: data.expiresAt });
  };

  const createInvite = () =>
    act(
      () => send("POST", "/api/admin/links", { kind: "invite", note: note.trim() || undefined }),
      async (res) => {
        await showLink(res, "invite", note.trim() || "메모 없음");
        setNote("");
      }
    );

  const createReset = (account: AccountRow) =>
    act(
      () => send("POST", "/api/admin/links", { kind: "reset", userId: account.id }),
      (res) => showLink(res, "reset", account.username)
    );

  const setDisabled = (account: AccountRow, disabled: boolean) => {
    if (disabled && !window.confirm(`${account.username} 계정을 정지할까요? 바로 로그아웃되고 다시 로그인할 수 없습니다.`)) {
      return;
    }
    act(() => send("PATCH", `/api/admin/users/${account.id}`, { disabled }));
  };

  const revoke = (link: LinkRow) => {
    if (!window.confirm("이 링크를 취소할까요? 취소하면 다시 쓸 수 없습니다.")) return;
    act(() => send("DELETE", `/api/admin/links/${link.id}`));
  };

  const copy = async () => {
    if (!newLink) return;
    try {
      await navigator.clipboard.writeText(newLink.url);
      setCopied(true);
    } catch {
      setError("복사하지 못했습니다. 링크를 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground">계정 관리</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        초대 링크로 만든 계정은 제한 계정입니다. 링크는 한 번만 쓸 수 있고 48시간 뒤 만료됩니다.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">초대 링크 만들기</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="누구에게 보내는지 메모 (예: 영상의학과 ○○○ 선생님)"
            aria-label="초대 메모"
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button onClick={createInvite} disabled={busy}>
            <UserPlus className="mr-2 h-4 w-4" />
            초대 링크 만들기
          </Button>
        </div>

        {newLink && (
          <div className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-3">
            <div className="text-sm font-medium text-foreground">
              {newLink.kind === "invite" ? "초대 링크" : "비밀번호 재설정 링크"} — {newLink.label}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              이 링크는 지금 한 번만 보입니다. 본인만 볼 수 있는 경로로 보내 주세요. {fmt(newLink.expiresAt)}까지 한 번 쓸 수 있습니다.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={newLink.url}
                aria-label="새로 만든 링크"
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs"
              />
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? "복사됨" : "복사"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewLink(null)}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          불러오는 중…
        </div>
      ) : (
        <>
          <section className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
            <h2 className="px-4 pt-4 text-base font-semibold text-foreground">계정</h2>
            <table className="mt-2 w-full min-w-[720px]">
              <thead className="border-b border-border">
                <tr>
                  <th className={HEAD}>아이디</th>
                  <th className={HEAD}>권한</th>
                  <th className={HEAD}>상태</th>
                  <th className={HEAD}>만든 날</th>
                  <th className={HEAD}>마지막 로그인</th>
                  <th className={HEAD}>초대한 계정</th>
                  <th className={HEAD} />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0" data-account={a.username}>
                    <td className={cn(CELL, "font-medium text-foreground")}>
                      {a.username}
                      {a.id === currentUserId && <span className="ml-1 text-xs text-muted-foreground">(나)</span>}
                    </td>
                    <td className={CELL}>{a.role === "admin" ? "관리자" : "제한"}</td>
                    <td className={cn(CELL, a.disabledAt ? "text-destructive" : "text-foreground")}>
                      {a.disabledAt ? `정지 (${fmt(a.disabledAt)})` : "사용 중"}
                    </td>
                    <td className={CELL}>{fmt(a.createdAt)}</td>
                    <td className={CELL}>{fmt(a.lastLoginAt)}</td>
                    <td className={CELL}>{a.invitedBy ?? "—"}</td>
                    <td className={cn(CELL, "whitespace-nowrap text-right")}>
                      {!a.disabledAt && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => createReset(a)}>
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          재설정 링크
                        </Button>
                      )}
                      {a.id !== currentUserId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          className="ml-1"
                          onClick={() => setDisabled(a, !a.disabledAt)}
                        >
                          {a.disabledAt ? "다시 사용" : "정지"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
            <h2 className="px-4 pt-4 text-base font-semibold text-foreground">링크</h2>
            {links.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">아직 만든 링크가 없습니다.</p>
            ) : (
              <table className="mt-2 w-full min-w-[720px]">
                <thead className="border-b border-border">
                  <tr>
                    <th className={HEAD}>종류</th>
                    <th className={HEAD}>대상</th>
                    <th className={HEAD}>상태</th>
                    <th className={HEAD}>만든 계정</th>
                    <th className={HEAD}>만든 시각</th>
                    <th className={HEAD}>만료</th>
                    <th className={HEAD}>사용한 계정</th>
                    <th className={HEAD} />
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0" data-link={l.id}>
                      <td className={CELL}>{l.kind === "invite" ? "초대" : "재설정"}</td>
                      <td className={CELL}>{l.kind === "invite" ? (l.note ?? "—") : (l.target ?? "—")}</td>
                      <td className={cn(CELL, l.status === "pending" ? "font-medium text-foreground" : "text-muted-foreground")}>
                        {STATUS_LABEL[l.status]}
                      </td>
                      <td className={CELL}>{l.createdBy ?? "—"}</td>
                      <td className={CELL}>{fmt(l.createdAt)}</td>
                      <td className={CELL}>{fmt(l.expiresAt)}</td>
                      <td className={CELL}>{l.kind === "invite" ? (l.usedBy ?? "—") : l.usedAt ? fmt(l.usedAt) : "—"}</td>
                      <td className={cn(CELL, "text-right")}>
                        {l.status === "pending" && (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => revoke(l)}>
                            취소
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}

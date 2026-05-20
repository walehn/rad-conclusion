"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { C } from "@/components/notion-tone";
import { CSRF_COOKIE_NAME } from "@/lib/auth/csrf-constants";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 1024;

/** Reads the double-submit CSRF token from the non-httpOnly cookie. */
function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : "";
}

type FeedbackKind = "success" | "error";

interface Feedback {
  kind: FeedbackKind;
  message: string;
}

/**
 * Password-change form rendered inside the /settings page.
 *
 * Flow:
 *  - Three fields: current password, new password, confirm new password.
 *  - Client-side validation runs first (length, match, must-differ) so a
 *    misformed form never burns server time on argon2.
 *  - On submit, POSTs {currentPassword, newPassword} to
 *    /api/auth/change-password with the double-submit CSRF token.
 *  - Server responses surface as inline feedback below the submit button;
 *    success clears the inputs.
 *
 * Session cookie stays valid after a successful change — the server response
 * does not rotate it, and the iron-session payload does not embed the
 * password.
 */
export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);

  const clearFeedbackOn = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (value: T) => {
      if (feedback) setFeedback(null);
      setter(value);
    };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    // Client-side guards. Server enforces the same rules; this just avoids a
    // pointless round-trip when the radiologist fat-fingers the form.
    if (!currentPassword) {
      setFeedback({ kind: "error", message: "현재 비밀번호를 입력하세요." });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFeedback({
        kind: "error",
        message: `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
      });
      return;
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      setFeedback({
        kind: "error",
        message: `새 비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하여야 합니다.`,
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({
        kind: "error",
        message: "새 비밀번호와 확인 값이 일치하지 않습니다.",
      });
      return;
    }
    if (newPassword === currentPassword) {
      setFeedback({
        kind: "error",
        message: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setFeedback({
          kind: "success",
          message: "비밀번호가 변경되었습니다.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        let serverMessage = "비밀번호 변경에 실패했습니다.";
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body?.error === "string" && body.error.length > 0) {
            serverMessage = body.error;
          }
        } catch {
          // body parse failed — keep generic message.
        }
        setFeedback({ kind: "error", message: serverMessage });
      }
    } catch {
      setFeedback({
        kind: "error",
        message: "네트워크 오류로 비밀번호를 변경하지 못했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4"
      autoComplete="off"
      noValidate
    >
      <FieldRow
        id="pw-current"
        label="현재 비밀번호"
        value={currentPassword}
        onChange={clearFeedbackOn(setCurrentPassword)}
        autoComplete="current-password"
      />
      <FieldRow
        id="pw-new"
        label="새 비밀번호"
        value={newPassword}
        onChange={clearFeedbackOn(setNewPassword)}
        autoComplete="new-password"
        hint={`${MIN_PASSWORD_LENGTH}자 이상`}
      />
      <FieldRow
        id="pw-confirm"
        label="새 비밀번호 확인"
        value={confirmPassword}
        onChange={clearFeedbackOn(setConfirmPassword)}
        autoComplete="new-password"
      />

      <div className="flex items-center gap-3 pt-1">
        <Button
          type="submit"
          disabled={submitting}
          style={{
            background: C.primary,
            color: "#ffffff",
            borderRadius: 9999,
            paddingInline: 18,
          }}
        >
          {submitting ? "변경 중…" : "비밀번호 변경"}
        </Button>
        {feedback && (
          <p
            role={feedback.kind === "error" ? "alert" : "status"}
            className="text-[13px]"
            style={{
              color:
                feedback.kind === "success" ? "#2f7a3b" : "#b3261e",
              lineHeight: 1.5,
            }}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </form>
  );
}

/**
 * Single password field with stacked label / hint / input. Notion-tone
 * surface so it sits coherently inside the `Block` wrapper on /settings.
 */
function FieldRow({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="text-[13px] font-medium"
        style={{ color: C.charcoal }}
      >
        {label}
        {hint && (
          <span
            className="ml-2 text-[11px] font-normal"
            style={{ color: C.steel }}
          >
            {hint}
          </span>
        )}
      </label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        maxLength={MAX_PASSWORD_LENGTH}
        spellCheck={false}
        className="max-w-md"
      />
    </div>
  );
}

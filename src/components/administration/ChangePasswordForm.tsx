"use client";

import {
  FormEvent,
  useState,
} from "react";
import { signOut } from "next-auth/react";

export default function ChangePasswordForm() {
  const [password, setPassword] =
    useState("");
  const [
    confirmation,
    setConfirmation,
  ] = useState("");
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function submit(
    event: FormEvent,
  ) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/auth/change-password",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            newPassword: password,
            confirmation,
          }),
        },
      );

      const payload =
        (await response.json()) as {
          success: boolean;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.message ??
            payload.error ??
            "Password could not be changed.",
        );
      }

      await signOut({
        callbackUrl: "/login",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Password could not be changed.",
      );
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
        Account security
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">
        Change temporary password
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Create a private password with at least 12
        characters. You will sign in again afterwards.
      </p>

      {error ? (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <label className="mt-6 block text-sm text-slate-300">
        New password
        <input
          required
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={password}
          onChange={(event) =>
            setPassword(
              event.target.value,
            )
          }
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
        />
      </label>

      <label className="mt-4 block text-sm text-slate-300">
        Confirm password
        <input
          required
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) =>
            setConfirmation(
              event.target.value,
            )
          }
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {saving
          ? "Saving…"
          : "Change password"}
      </button>
    </form>
  );
}

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { setAccessToken } from "@/auth/access-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/layout/page-shell";
import { SchoolMark } from "@/components/school-mark";
import { useSchoolName } from "@/lib/use-school-name";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { meRefused, signInStarted } from "@/redux/features/auth-slice";
import {
  useLazyMeQuery,
  useLoginMutation,
  useLogoutMutation,
} from "@/redux/services/portal-api";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

/** The address of the staff app on this school's host. */
function schoolAppUrl(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.protocol}//${window.location.host}/`;
}

/**
 * The sign-in page.
 *
 * The parent types their email and password and the ordinary tenant sign-in
 * answers. On success the shell takes over through `me/`; a 404 there means
 * the account is not a parent at this school (a teacher, a bursar, or a
 * parent at a different school) and the parent is sent back here with a
 * sentence pointing them at the right place.
 */
export default function SignInPage() {
  const slug = currentSchoolSlug();
  const name = useSchoolName();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const notAParent = useAppSelector((s) => s.auth.notAParent);
  const [login, loginState] = useLoginMutation();
  const [logout] = useLogoutMutation();
  const [fetchMe] = useLazyMeQuery();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [passErr, setPassErr] = useState("");
  const [generalErr, setGeneralErr] = useState("");
  const [refusal, setRefusal] = useState("");

  // The last sign-in attempt was a non-parent: show the staff-app message
  // and keep the parent's typed email on screen so they can switch accounts
  // without typing it twice.
  const kickedForWrongApp = notAParent;

  if (!slug) {
    return (
      <PageShell className="min-h-dvh flex flex-col items-center justify-center gap-6 text-center">
        <SchoolMark logo={null} size={64} alt="XVS crest" animate={false} />
        <h1 className="font-mont text-base font-semibold text-black-01">
          No school at this address
        </h1>
      </PageShell>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailErr("");
    setPassErr("");
    setGeneralErr("");
    setRefusal("");
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setEmailErr("Enter the email the school invited you with.");
      return;
    }
    if (!password) {
      setPassErr("Enter your password.");
      return;
    }
    dispatch(signInStarted());
    try {
      const result = await login({ email: trimmedEmail, password }).unwrap();
      // The platform tenant is XVS's own staff: never a school parent.
      if (result.data.tenant?.kind === "PLATFORM") {
        await logout().unwrap().catch(() => {});
        setRefusal("That is a Codex staff account. Sign in on the Codex console.");
        return;
      }
      // Pupils are handed off to the student app from school-fe; they never
      // reach here. Guard regardless so an unexpected `device_app` does not
      // open the parent shell for a pupil.
      if (result.data.device_app) {
        await logout().unwrap().catch(() => {});
        setRefusal("That account signs in on the student app, not here.");
        return;
      }
      // Check that this is actually a parent at this school. 404 is "not a
      // parent"; we sign them out and show the staff-app message.
      const meResult = await fetchMe().unwrap().then(
        () => ({ ok: true as const }),
        (err: unknown) => ({
          ok: false as const,
          status: (err as { status?: number })?.status,
        }),
      );
      if (meResult.ok) {
        navigate("/", { replace: true });
      } else if (meResult.status === 404) {
        // Not a parent here. Close the session the login just opened; then
        // put the "not a parent" flag back, since the logout reducer clears
        // the slice on its way out.
        await logout().unwrap().catch(() => {});
        setAccessToken("");
        dispatch(meRefused());
      } else {
        setGeneralErr("Something went wrong signing you in. Please try again.");
      }
    } catch (err) {
      const refusalErr = err as { status?: number | string; data?: { message?: string } };
      if (refusalErr?.status === 401 || refusalErr?.status === 400) {
        setRefusal(refusalErr.data?.message || "Those details did not match an account at this school.");
      } else if (refusalErr?.status === 0 || refusalErr?.status === "FETCH_ERROR") {
        setGeneralErr("Could not reach the school. Check your connection and try again.");
      } else {
        setGeneralErr(refusalErr?.data?.message || "Something went wrong. Please try again.");
      }
    }
  };

  const busy = loginState.isLoading;

  return (
    <PageShell className="min-h-dvh flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <SchoolMark logo={schoolLogoUrl(slug)} size={54} alt={name} animate={false} />
          {name && (
            <h1 className="font-mont text-base font-semibold text-black-01">{name}</h1>
          )}
          <p className="text-xs text-gray-05">
            Parent Portal
          </p>
        </div>

        {kickedForWrongApp && (
          <div
            role="alert"
            className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
          >
            This account is not a parent on this school. If you work here,
            sign in on the{" "}
            <a className="font-semibold underline underline-offset-4" href={schoolAppUrl()}>
              staff app
            </a>
            .
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-black-01">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setGeneralErr("");
                setRefusal("");
              }}
              aria-invalid={!!emailErr}
              aria-describedby={emailErr ? "email-err" : undefined}
              disabled={busy}
            />
            {emailErr ? (
              <p id="email-err" role="alert" className="mt-1 text-xs text-error-text">
                {emailErr}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-05">
                Use the email address the school invited you with.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-black-01">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setGeneralErr("");
                setRefusal("");
              }}
              aria-invalid={!!passErr}
              aria-describedby={passErr ? "password-err" : undefined}
              disabled={busy}
            />
            {passErr && (
              <p id="password-err" role="alert" className="mt-1 text-xs text-error-text">
                {passErr}
              </p>
            )}
          </div>

          {refusal && (
            <p role="alert" className="rounded-md bg-red-01/10 px-3 py-2 text-xs text-error-text">
              {refusal}
            </p>
          )}
          {generalErr && (
            <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {generalErr}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" loading={busy}>
            Sign in
          </Button>
        </form>

        <p className="mt-8 text-center text-[11px] text-gray-05">
          Powered by CodeX Vision{name ? ` · ${name}` : ""}
        </p>
      </div>
    </PageShell>
  );
}

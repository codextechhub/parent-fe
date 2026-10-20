import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router";

import { setAccessToken } from "@/auth/access-token";
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

import "./sign-in.css";

/** The school's own pages on this host: its staff sign-in and its password reset. */
const SCHOOL_SIGN_IN = "/accounts";
const FORGOT_PASSWORD = "/accounts/forgot-password";

type Refusal = { message: string; staff?: boolean };

/**
 * The sign-in page, in the student app's design: the school's welcome beside
 * the form on a wide screen, above it on a phone.
 *
 * The parent types their email and password and the ordinary tenant sign-in
 * answers. On success the shell takes over through `me/`; a 404 there means
 * the account is not a parent at this school (a teacher, a bursar, or a
 * parent at a different school), so the session just opened is closed and
 * the page points them at the school's own sign-in. A teacher who is also a
 * parent here is a parent to `me/`, and comes straight in. Every refusal
 * shows in one place under the fields, as the student app's does.
 */
export default function SignInPage() {
  const slug = currentSchoolSlug();
  const schoolName = useSchoolName();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const notAParent = useAppSelector((s) => s.auth.notAParent);
  const [login, loginState] = useLoginMutation();
  const [logout] = useLogoutMutation();
  const [fetchMe] = useLazyMeQuery();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [checking, setChecking] = useState(false);

  const shown: Refusal | null = refusal ?? (notAParent
    ? { message: "This account is not a parent at this school.", staff: true }
    : null);

  const clear = () => {
    setRefusal(null);
    if (notAParent) dispatch(signInStarted());
  };

  const refuse = (next: Refusal) => {
    setPassword("");
    setPasswordVisible(false);
    setRefusal(next);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const typed = email.trim().toLowerCase();
    if (!typed || !password) {
      setRefusal({ message: "Enter the email the school invited you with, and your password." });
      return;
    }
    setRefusal(null);
    dispatch(signInStarted());
    setChecking(true);
    try {
      const result = await login({ email: typed, password }).unwrap();
      // The platform tenant is XVS's own staff: never a school parent.
      if (result.data.tenant?.kind === "PLATFORM") {
        await logout().unwrap().catch(() => {});
        refuse({ message: "That is a CodeX staff account. Sign in on the CodeX console." });
        return;
      }
      // A pupil belongs in the student app; guard so a `device_app` never opens this shell.
      if (result.data.device_app) {
        await logout().unwrap().catch(() => {});
        refuse({ message: "That account signs in on the student app, not here." });
        return;
      }
      const meResult = await fetchMe().unwrap().then(
        () => ({ ok: true as const }),
        (err: unknown) => ({ ok: false as const, status: (err as { status?: number })?.status }),
      );
      if (meResult.ok) {
        navigate("/", { replace: true });
      } else if (meResult.status === 404) {
        // Not a parent here. The logout reducer clears the slice, so the flag is put back after it.
        await logout().unwrap().catch(() => {});
        setAccessToken("");
        dispatch(meRefused());
        setPassword("");
      } else {
        refuse({ message: "Something went wrong signing you in. Please try again." });
      }
    } catch (err) {
      const failed = err as { status?: number | string; data?: { message?: string } };
      if (failed?.status === 401 || failed?.status === 400) {
        refuse({ message: failed.data?.message || "Those details did not match an account at this school." });
      } else if (failed?.status === 0 || failed?.status === "FETCH_ERROR") {
        refuse({ message: "Could not reach the school. Check your connection and try again." });
      } else {
        refuse({ message: failed?.data?.message || "Something went wrong. Please try again." });
      }
    } finally {
      setChecking(false);
    }
  };

  const busy = loginState.isLoading || checking;

  return (
    <main className="signin-page">
      <div className="signin-stage">
        <section className="signin-welcome" aria-label="Welcome">
          <div className="signin-welcome-copy">
            {schoolName && <p className="signin-school-name">{schoolName}</p>}
            <h1>Every child&apos;s school day, <span>in one place.</span></h1>
            <p>Results, attendance, notices and fees for each child you look after.</p>
          </div>
          <p className="signin-welcome-foot"><LockKeyhole size={17} aria-hidden="true" />One sign-in for all your children</p>
        </section>

        <section className="signin-area" aria-label="Sign in">
          <div className="signin-card">
            <div className="signin-form-mark"><SchoolMark logo={slug ? schoolLogoUrl(slug) : null} size={48} animate={false} alt={schoolName || "School crest"} /></div>
            <h2>Sign in to your school</h2>
            <p className="signin-card-intro">Your parent account, with the email the school invited you with.</p>
            {!slug ? (
              <div className="signin-error" role="alert">This address doesn&apos;t belong to a school. Open the parent app from your school&apos;s own address.</div>
            ) : (
              <form className="signin-form" onSubmit={onSubmit} noValidate>
                <div className="signin-field">
                  <label htmlFor="signin-email">Email</label>
                  <input id="signin-email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. adaeze.okafor@gmail.com" value={email} aria-invalid={!!shown} onChange={(event) => { setEmail(event.target.value); clear(); }} />
                </div>
                <div className="signin-field">
                  <label htmlFor="signin-password">Password</label>
                  <div className="signin-password-wrap">
                    <input id="signin-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} aria-invalid={!!shown} onChange={(event) => { setPassword(event.target.value); clear(); }} />
                    <button type="button" className="signin-visibility" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} title={passwordVisible ? "Hide password" : "Show password"} onClick={() => setPasswordVisible((visible) => !visible)}>
                      {passwordVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <a className="signin-forgot" href={FORGOT_PASSWORD}>Forgot password?</a>
                {shown && <div className="signin-error" role="alert">{shown.message}{shown.staff && <><br /><a href={SCHOOL_SIGN_IN}>If you work here, go to the school&apos;s sign-in</a></>}</div>}
                <button type="submit" className="signin-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={18} aria-hidden="true" /></button>
              </form>
            )}
            <p className="signin-helper">Trouble signing in? <strong>Ask the school office.</strong></p>
          </div>
        </section>
      </div>
    </main>
  );
}

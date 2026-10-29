import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { setAccessToken } from "@/auth/access-token";
import { clearAccount } from "@/auth/device-account";
import { keepNativeCredential } from "@/auth/device-credential";
import { SchoolMark } from "@/components/school-mark";
import { useSchoolName } from "@/lib/use-school-name";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { meRefused, signInStarted } from "@/redux/features/auth-slice";
import {
  useLazyMeQuery,
  useLoginMutation,
  useLogoutMutation,
} from "@/redux/services/portal-api";
import { isNativeApp } from "@/native/platform";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug, schoolWebAddress } from "@/utils/school-host";

import "./sign-in.css";

/** The school's own pages on this host: its staff sign-in and its password reset. */
const SCHOOL_SIGN_IN = "/accounts";
const FORGOT_PASSWORD = "/accounts/forgot-password";

/**
 * Where a link to the school's own website goes. In a browser it is a path on
 * the address the parent is already at; the store app has no such address, so
 * it is the school's website, which the phone opens in its own browser.
 */
function schoolLink(path: string, slug: string) {
  return isNativeApp()
    ? { href: `${schoolWebAddress(slug)}${path}`, target: "_blank", rel: "noreferrer" }
    : { href: path };
}

type Refusal = { message: string; staff?: boolean };

const NOT_A_PARENT = "This account is not a parent at this school.";

/** The code the API gives a refusal, under either key it uses. */
function refusalCode(data: unknown): string {
  const error = (data as { error?: { code?: string; error_code?: string } } | undefined)?.error;
  return error?.code ?? error?.error_code ?? "";
}

/**
 * The sign-in page (design 1a), as the student app's: the school's crest and
 * name on the deep blue welcome, the form on a white card that rises over it
 * on a phone and sits beside it on a wide screen.
 *
 * The parent types their email and password and the sign-in asks for a device
 * session. On success the shell takes over through `me/`. An account the
 * school does not offer a device session (staff) is refused by the sign-in
 * itself as `DEVICE_SESSION_NOT_OFFERED`; a 404 from `me/` means the account
 * is not a parent at this school (a parent at a different school), so the
 * session just opened is closed. Either way the page points them at the
 * school's own sign-in. A teacher who is also a parent here is a parent to
 * `me/`, and comes straight in. Every refusal shows in one place under the
 * fields, as the student app's does.
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
    ? { message: NOT_A_PARENT, staff: true }
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
      // The store app keeps its credential in secure storage, before anything else can need it to sign out.
      if (isNativeApp() && !(await keepNativeCredential(result.data.account, result.data.refresh))) {
        setAccessToken("");
        await clearAccount();
        refuse({ message: "This phone could not keep your sign-in safe, so you were not signed in. Try again." });
        return;
      }
      // The platform tenant is XVS's own staff: never a school parent.
      if (result.data.tenant?.kind === "PLATFORM") {
        await logout().unwrap().catch(() => {});
        refuse({ message: "That is a CodeX staff account. Sign in on the CodeX console." });
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
      if (failed?.status === 403 && refusalCode(failed.data) === "DEVICE_SESSION_NOT_OFFERED") {
        // Not a parent at this school: a teacher, a bursar, a pupil.
        refuse({ message: NOT_A_PARENT, staff: true });
      } else if (failed?.status === 401 || failed?.status === 400) {
        refuse({ message: failed.data?.message || "Those details did not match an account at this school." });
      } else if (failed?.status === 0 || failed?.status === "FETCH_ERROR" || failed?.status === "TIMEOUT_ERROR") {
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
            <div className="signin-school">
              <SchoolMark logo={slug ? schoolLogoUrl(slug) : null} size={40} animate={false} surface="blue" alt={schoolName || "School crest"} />
              {schoolName && <p className="signin-school-name">{schoolName}</p>}
            </div>
            <h1>Every child, <span>one clear view.</span></h1>
            <p>Classes, results, attendance and fees for each of your children.</p>
          </div>
        </section>

        <section className="signin-area" aria-label="Sign in">
          <div className="signin-card">
            <h2>Sign in as a parent</h2>
            <p className="signin-card-intro">Use the email your school has for you.</p>
            {!slug ? (
              <div className="signin-error" role="alert">This address doesn&apos;t belong to a school. Open the parent app from your school&apos;s own address.</div>
            ) : (
              <form className="signin-form" onSubmit={onSubmit} noValidate>
                <div className="signin-field">
                  <label htmlFor="signin-email">Email address</label>
                  <input id="signin-email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={email} aria-invalid={!!shown} onChange={(event) => { setEmail(event.target.value); clear(); }} />
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
                <a className="signin-forgot" {...schoolLink(FORGOT_PASSWORD, slug)}>Forgot password?</a>
                {shown && <div className="signin-error" role="alert">{shown.message}{shown.staff && <><br /><a {...schoolLink(SCHOOL_SIGN_IN, slug)}>If you work here, go to the school&apos;s sign-in</a></>}</div>}
                <button type="submit" className="signin-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={18} aria-hidden="true" /></button>
              </form>
            )}
            <p className="signin-helper">New here? <strong>Your school sends an invitation to set your password.</strong></p>
            {isNativeApp() && <Link to="/school" className="signin-change-school">Change school</Link>}
            <p className="signin-device-note"><LockKeyhole size={15} aria-hidden="true" />Staff and pupils sign in on their own apps</p>
          </div>
        </section>
      </div>
    </main>
  );
}

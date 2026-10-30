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
  useTwoStepVerifyMutation,
  type LoginData,
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

const SET_UP_FIRST =
  "Your account needs two-step sign-in, and it is not set up yet. Set it up on the school's staff sign-in, then sign in here again.";

/** The challenge a refusal carries when the server wants a two-step code. */
function challengeOf(data: unknown): string {
  const error = (data as { error?: { challenge?: unknown } } | undefined)?.error;
  return typeof error?.challenge === "string" ? error.challenge : "";
}

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
  // A member of staff who is also a parent: the password was right and the
  // server wants the code from their authenticator app. Held here only, so a
  // reload starts again at the password.
  const [challenge, setChallenge] = useState("");
  const [verify, verifyState] = useTwoStepVerifyMutation();

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

  /** The sign-in is answered: keep it, or close it for an account that is not a parent here. */
  const finish = async (result: { data: LoginData }) => {
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
      await finish(await login({ email: typed, password }).unwrap());
    } catch (err) {
      const failed = err as { status?: number | string; data?: { message?: string } };
      const code = refusalCode(failed?.data);
      if (failed?.status === 403 && code === "TWO_STEP_REQUIRED" && challengeOf(failed.data)) {
        setPassword("");
        setChallenge(challengeOf(failed.data));
      } else if (failed?.status === 403 && code === "TWO_STEP_SET_UP_REQUIRED") {
        refuse({ message: SET_UP_FIRST, staff: true });
      } else if (failed?.status === 403 && code === "DEVICE_SESSION_NOT_OFFERED") {
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

  /** The code from the authenticator app, or a backup code, for the waiting sign-in. */
  const onCode = async (answer: { code?: string; recovery_code?: string }) => {
    setRefusal(null);
    setChecking(true);
    try {
      const result = await verify({ challenge, ...answer }).unwrap();
      setChallenge("");
      await finish(result);
    } catch (err) {
      const failed = err as { status?: number | string; data?: { message?: string } };
      if (refusalCode(failed?.data) === "TWO_STEP_CHALLENGE_INVALID") {
        setChallenge("");
        refuse({ message: "This sign-in has expired. Enter your email and password again." });
      } else if (failed?.status === 0 || failed?.status === "FETCH_ERROR" || failed?.status === "TIMEOUT_ERROR") {
        setRefusal({ message: "Could not reach the school. Check your connection and try again." });
      } else {
        setRefusal({ message: "That code is not right. Check your authenticator app and try again." });
      }
    } finally {
      setChecking(false);
    }
  };

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
            ) : challenge ? (
              <CodeStep
                busy={checking || verifyState.isLoading}
                refusal={refusal?.message ?? ""}
                onChange={() => setRefusal(null)}
                onSubmit={(answer) => void onCode(answer)}
                onStartAgain={() => {
                  setChallenge("");
                  setRefusal(null);
                }}
              />
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

/**
 * The second step for a member of staff who is also a parent: their school
 * asks them for a code from their authenticator app after their password. They
 * set the app up on the school's staff sign-in, so this asks only for a code,
 * or one of the backup codes they saved there.
 */
function CodeStep({
  busy,
  refusal,
  onChange,
  onSubmit,
  onStartAgain,
}: {
  busy: boolean;
  refusal: string;
  onChange: () => void;
  onSubmit: (answer: { code?: string; recovery_code?: string }) => void;
  onStartAgain: () => void;
}) {
  const [backup, setBackup] = useState(false);
  const [value, setValue] = useState("");
  const ready = backup ? value.trim().length >= 10 : /^\d{6}$/.test(value);

  return (
    <form
      className="signin-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || busy) return;
        onSubmit(backup ? { recovery_code: value.trim() } : { code: value });
      }}
    >
      <p className="signin-card-intro">
        {backup
          ? "Type one of the backup codes you saved when you set up two-step sign-in. Each one works once."
          : "Your school asks staff for a code from their authenticator app. Type the 6-digit code it shows."}
      </p>
      <div className="signin-field">
        <label htmlFor="signin-code">{backup ? "Backup code" : "6-digit code"}</label>
        <input
          id="signin-code"
          name="code"
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={backup ? 16 : 6}
          placeholder={backup ? "For example 3f9a2-7c1e0" : "123456"}
          value={value}
          aria-invalid={!!refusal}
          autoFocus
          onChange={(event) => {
            setValue(backup ? event.target.value : event.target.value.replace(/\D/g, ""));
            onChange();
          }}
        />
      </div>
      <button
        type="button"
        className="signin-forgot"
        onClick={() => {
          setBackup((was) => !was);
          setValue("");
          onChange();
        }}
      >
        {backup ? "Use the authenticator app instead" : "Lost your phone? Use a backup code"}
      </button>
      {refusal && <div className="signin-error" role="alert">{refusal}</div>}
      <button type="submit" className="signin-submit" disabled={busy || !ready}>
        {busy ? "Checking…" : "Continue"}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <button type="button" className="signin-forgot" onClick={onStartAgain}>
        Sign in as someone else
      </button>
    </form>
  );
}

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { SchoolMark } from "@/components/school-mark";
import { lookUpSchool } from "@/native/school-lookup";
import { normaliseSchoolCode, saveSchoolCode } from "@/native/school-code";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

import "./school-choice.css";

const NOT_FOUND = "We could not find a school with that code. Check the code on the letter from your school and try again.";
const UNREACHABLE = "We can't reach the service right now. Check your connection and try again.";

/**
 * Choosing the school, in the store app only.
 *
 * A browser knows its school from the address it was opened at; the store app
 * has no such address, so the parent enters their school's code once. The code
 * is checked against the school's public name route, the school's name and
 * crest are shown for the parent to confirm, and only then is it kept. The app
 * then reloads, so every part of it starts again for the chosen school.
 *
 * It is the first screen on a fresh install, and "Change school" on the
 * sign-in screen comes back here, with a way to cancel because a school is
 * already chosen.
 */
export function SchoolChoicePage() {
  const current = currentSchoolSlug();
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ code: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const look = async (event: FormEvent) => {
    event.preventDefault();
    const clean = normaliseSchoolCode(code);
    if (!clean) {
      setError("Enter your school code, for example meridian.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await lookUpSchool(clean);
    setBusy(false);
    if (result.ok) setFound({ code: clean, name: result.name });
    else setError(result.reason === "not-found" ? NOT_FOUND : UNREACHABLE);
  };

  const confirm = async () => {
    if (!found) return;
    setBusy(true);
    try {
      await saveSchoolCode(found.code);
    } catch {
      setBusy(false);
      setError("This phone could not keep your school. Try again.");
      return;
    }
    window.location.replace(import.meta.env.BASE_URL);
  };

  return (
    <main className="school-choice-page">
      <div className="school-choice-card">
        {found ? (
          <>
            <div className="school-choice-mark">
              <SchoolMark logo={schoolLogoUrl(found.code)} size={72} animate={false} alt={`${found.name} crest`} />
            </div>
            <p className="school-choice-eyebrow">Is this your school?</p>
            <h1 className="school-choice-name">{found.name}</h1>
            {error && <div className="school-choice-error" role="alert">{error}</div>}
            <button type="button" className="school-choice-submit" disabled={busy} onClick={confirm}>
              {busy ? "Saving…" : "Yes, this is my school"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" className="school-choice-secondary" disabled={busy} onClick={() => { setFound(null); setError(""); }}>
              No, try another code
            </button>
          </>
        ) : (
          <>
            <div className="school-choice-mark">
              <SchoolMark logo={null} size={56} animate={false} alt="XVS" />
            </div>
            <h1>Enter your school code</h1>
            <p className="school-choice-hint">It is on the letter from your school, for example meridian.</p>
            <form className="school-choice-form" onSubmit={look} noValidate>
              <label htmlFor="school-code">School code</label>
              <input
                id="school-code"
                name="school-code"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
                placeholder="e.g. meridian"
                value={code}
                aria-invalid={!!error}
                onChange={(event) => { setCode(event.target.value); setError(""); }}
              />
              {error && <div className="school-choice-error" role="alert">{error}</div>}
              <button type="submit" className="school-choice-submit" disabled={busy}>
                {busy ? "Looking…" : "Find my school"}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </form>
            {current && <Link to="/sign-in" className="school-choice-secondary">Cancel and keep the current school</Link>}
          </>
        )}
      </div>
    </main>
  );
}

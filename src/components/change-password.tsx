import { useState, type FormEvent } from "react";
import { ChevronRight, CircleCheck, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import {
  passwordRefusals,
  useChangePasswordMutation,
  usePasswordPolicyQuery,
  type PasswordRefusals,
} from "@/redux/services/portal-api";

const MISMATCH_MESSAGE = "The new passwords don't match.";
const RULES_FALLBACK =
  "At least 12 characters, with an uppercase letter, a lowercase letter, a number and a special character.";

type Field = "current_password" | "password" | "confirm_password";

/**
 * The Change password row in Profile's settings list (design 1k), which
 * opens the form under itself. Cancel, or the row again, clears typed
 * passwords and closes it.
 *
 * The same `/user/auth/password/change/` and `/user/auth/password/policy/`
 * endpoints the staff app uses. A refusal lands under the box it is about;
 * mismatches are caught here before anything is sent. After a successful
 * change the boxes empty and the parent is told what happened; the backend
 * revokes the account's other sessions, and on this device the current
 * access token keeps working until it expires or they sign out.
 */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const { data: policy } = usePasswordPolicyQuery(undefined, { skip: !open });
  const [change, { isLoading }] = useChangePasswordMutation();
  const [values, setValues] = useState({ current_password: "", password: "", confirm_password: "" });
  const [errors, setErrors] = useState<PasswordRefusals>({});
  const [changed, setChanged] = useState(false);

  const mismatch =
    values.confirm_password.length > 0 && values.confirm_password !== values.password;
  const canSave =
    !!values.current_password &&
    !!values.password &&
    !!values.confirm_password &&
    !mismatch &&
    !isLoading;

  const edit = (field: Field) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
    setChanged(false);
  };

  const close = () => {
    setValues({ current_password: "", password: "", confirm_password: "" });
    setErrors({});
    setChanged(false);
    setOpen(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setErrors({});
    try {
      await change(values).unwrap();
      setValues({ current_password: "", password: "", confirm_password: "" });
      setChanged(true);
    } catch (error) {
      setErrors(passwordRefusals(error));
    }
  };

  const rules = policy?.requirements ?? [];

  return (
    <section aria-labelledby="password-heading" className="settings-item">
      <button type="button" className="settings-row" aria-expanded={open} aria-controls="profile-password-form" onClick={() => (open ? close() : setOpen(true))}>
        <span className="settings-icon is-brand"><KeyRound size={16} aria-hidden="true" /></span>
        <span className="settings-label" id="password-heading">Change password</span>
        <ChevronRight className="settings-chevron" size={17} aria-hidden="true" />
      </button>

      {open && (
        <form id="profile-password-form" onSubmit={submit} noValidate className="settings-panel profile-password-form">
          <div className="min-w-0 space-y-4">
            <Box
              id="current_password"
              label="Current password"
              autoComplete="current-password"
              value={values.current_password}
              onChange={edit("current_password")}
              error={errors.current_password}
            />
            <Box
              id="new_password"
              label="New password"
              autoComplete="new-password"
              value={values.password}
              onChange={edit("password")}
              error={errors.password}
            />
            <Box
              id="confirm_password"
              label="Type the new password again"
              autoComplete="new-password"
              value={values.confirm_password}
              onChange={edit("confirm_password")}
              error={errors.confirm_password || (mismatch ? MISMATCH_MESSAGE : undefined)}
            />
          </div>

          <div aria-label="Password rules" className="min-w-0 self-start rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="mb-1.5 font-medium text-foreground">Your new password needs</p>
            {rules.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4">
                {rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            ) : (
              <p>{RULES_FALLBACK}</p>
            )}
            <p className="mt-2">It can&apos;t be the password you use now.</p>
          </div>

          {errors.form && (
            <p role="alert" className="profile-password-wide text-xs font-medium text-destructive">
              {errors.form}
            </p>
          )}

          {changed && (
            <div
              role="status"
              className="profile-password-wide flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900"
            >
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 space-y-2">
                <p>
                  <strong>Password changed.</strong> Your other sessions have been signed out. This
                  device stays signed in until your access runs out.
                </p>
              </div>
            </div>
          )}

          <div className="profile-password-wide flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Saving signs you out of your other devices.
            </p>
            <div className="profile-password-actions">
              <Button type="button" variant="outline" size="sm" onClick={close} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!canSave} loading={isLoading}>
                Save password
              </Button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

function Box({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-foreground">
        {label}
      </label>
      <PasswordInput
        id={id}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span id={`${id}-error`} className="block text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

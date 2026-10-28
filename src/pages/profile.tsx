import { useRef, useState, type FormEvent } from "react";
import { Camera, ImagePlus, KeyRound, LogOut, Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { ChangePassword } from "@/components/change-password";
import { ChildAvatar } from "@/components/child-avatar";
import { DeleteAccountRow } from "@/components/delete-account-card";
import { InstallSetting } from "@/components/install-offer";
import { PageShell } from "@/components/layout/page-shell";
import { PushSetting } from "@/components/push-settings";
import { useShownImage } from "@/lib/shown-image";
import { useAppSelector } from "@/redux/hooks";
import {
  refusal,
  useLogoutMutation,
  useProfileQuery,
  useRemovePhotoMutation,
  useUpdateProfileMutation,
  useUploadPhotoMutation,
  type EditableFields,
  type ProfileData,
} from "@/redux/services/portal-api";

import "./delete-account.css";
import "./profile.css";

/**
 * The parent's profile (design 1k), opened from My profile in the child
 * switcher, with a way back to Home where the school's crest would be.
 *
 * Their photo (the camera changes it), name and school, centred. Then their
 * contact details (phone, second phone, address editable; the sign-in email
 * read-only with the school's sentence), their children as the school has
 * linked them (each opens that child's Results), and the settings as one
 * list: password, notifications, installing the app. Sign out and Delete my
 * account sit apart, in a card of their own.
 */
export function ProfilePage() {
  const me = useAppSelector((s) => s.auth.me);
  const { data: profile, isLoading, isError, refetch } = useProfileQuery();

  return (
    <PageShell className="profile-page">
      <div className="profile-wrap">
        {isLoading && !profile && (
          <div className="profile-loading" role="status" aria-label="Loading profile" />
        )}
        {isError && !profile && (
          <div className="profile-error" role="alert">
            Your profile can&apos;t be shown right now.{" "}
            <button type="button" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}
        {profile && (
          <>
            <ProfileHero profile={profile} schoolName={me?.school.name ?? ""} />
            <div className="profile-cards">
              <EditableDetails profile={profile} />
              <LinkedChildren profile={profile} showBranch={me?.show_branch ?? false} />
            </div>
          </>
        )}
        <div className="profile-settings-column">
          <div className="screen-card profile-settings">
            <ChangePassword />
            <PushSetting />
            <InstallSetting />
          </div>
          <div className="screen-card profile-account">
            <SignOutRow />
            <DeleteAccountRow />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/** Sign out, as the child switcher's: the session ends and the sign-in screen opens. */
function SignOutRow() {
  const navigate = useNavigate();
  const [logout, { isLoading }] = useLogoutMutation();
  const signOut = async () => {
    await logout().unwrap().catch(() => {});
    navigate("/sign-in", { replace: true });
  };
  return (
    <button type="button" className="settings-row" onClick={() => void signOut()} disabled={isLoading}>
      <LogOut size={18} aria-hidden="true" className="settings-plain-icon" />
      <span className="settings-label">{isLoading ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}

/** The largest photograph the school takes, as the student app's. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * The parent's banner: their photograph (or initials) with the camera that
 * changes it, their name, and the school.
 *
 * The photograph is the one on their guardian record, the one the school sees,
 * so it is fetched with the parent's token (`useShownImage`). The camera stays
 * off while the app cannot reach the school.
 */
function ProfileHero({ profile, schoolName }: { profile: ProfileData; schoolName: string }) {
  const name = profile.managed_by_school.full_name;
  // The server's initials: a title such as "Mrs." is not the parent's first initial.
  const initials = useAppSelector((s) => s.auth.me?.parent.initials) ?? "";
  const offline = useAppSelector((s) => s.connectivity.offline);
  const photo = useShownImage(profile.photo_url);
  const picker = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [upload, { isLoading: uploading }] = useUploadPhotoMutation();
  const [remove, { isLoading: removing }] = useRemovePhotoMutation();

  const chosen = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Choose a PNG, JPEG or WebP photo.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("That photo is larger than 5 MB. Choose a smaller one.");
      return;
    }
    try {
      await upload(file).unwrap();
      toast.success("Photo updated");
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  const drop = async () => {
    try {
      await remove().unwrap();
      setMenuOpen(false);
      toast.success("Photo removed");
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  return (
    <section className="profile-hero" aria-label="Parent identity">
      <div className="profile-hero-photo">
        <div className="profile-hero-avatar">
          {photo.src ? (
            <img src={photo.src} alt="" className="object-cover" />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </div>
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger className="profile-camera" type="button" aria-label="Profile photo options" disabled={offline || uploading || removing}>
            <Camera size={18} aria-hidden="true" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="profile-photo-overlay" />
            <Dialog.Content className="profile-photo-dialog" aria-describedby={undefined}>
              <Dialog.Title>Profile photo</Dialog.Title>
              <button type="button" onClick={() => { setMenuOpen(false); picker.current?.click(); }}>
                <ImagePlus size={19} aria-hidden="true" /> Choose a photo
              </button>
              {profile.photo_url && (
                <button type="button" onClick={() => void drop()} disabled={removing || uploading}>
                  <Trash2 size={19} aria-hidden="true" /> {removing ? "Removing…" : "Remove photo"}
                </button>
              )}
              <Dialog.Close type="button" className="profile-photo-cancel">Cancel</Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <input
          ref={picker}
          className="profile-photo-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Choose a profile photo"
          onChange={(event) => {
            void chosen(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      <div className="profile-hero-content">
        <h1>{name}</h1>
        <p className="profile-hero-school">{schoolName ? `Parent at ${schoolName}` : "Parent"}</p>
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>{value || "None"}</dd>
    </div>
  );
}

function EditableDetails({ profile }: { profile: ProfileData }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(profile.editable.phone);
  const [altPhone, setAltPhone] = useState(profile.editable.alt_phone);
  const [address, setAddress] = useState(profile.editable.address);
  const [errors, setErrors] = useState<{ phone?: string; alt_phone?: string; address?: string; form?: string }>(
    {},
  );
  const [save, { isLoading }] = useUpdateProfileMutation();
  const changed =
    phone.trim() !== profile.editable.phone ||
    altPhone.trim() !== profile.editable.alt_phone ||
    address.trim() !== profile.editable.address;

  const start = () => {
    setPhone(profile.editable.phone);
    setAltPhone(profile.editable.alt_phone);
    setAddress(profile.editable.address);
    setErrors({});
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setErrors({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!changed || isLoading) return;
    const body: EditableFields = {};
    if (phone.trim() !== profile.editable.phone) body.phone = phone.trim();
    if (altPhone.trim() !== profile.editable.alt_phone) body.alt_phone = altPhone.trim();
    if (address.trim() !== profile.editable.address) body.address = address.trim();
    try {
      await save(body).unwrap();
      setEditing(false);
      toast.success("Details updated");
    } catch (error) {
      const { message, field } = refusal(error);
      if (field === "phone" || field === "alt_phone" || field === "address") {
        setErrors({ [field]: message });
      } else {
        setErrors({ form: message });
      }
    }
  };

  const edit = (setter: (v: string) => void, key: "phone" | "alt_phone" | "address") =>
    (value: string) => {
      setter(value);
      setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    };

  return (
    <section className="profile-group profile-contact" aria-labelledby="profile-contact-heading">
      <div className="profile-group-top">
        <h2 id="profile-contact-heading" className="profile-group-label">Your contact details</h2>
        {!editing && (
          <button type="button" className="profile-edit-button" onClick={start} aria-label="Edit your contact details">
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <form className="screen-card profile-form" onSubmit={submit} noValidate>
          <div className="profile-field">
            <label htmlFor="profile-phone">Phone number</label>
            <input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              aria-invalid={!!errors.phone}
              onChange={(event) => edit(setPhone, "phone")(event.target.value)}
            />
            <p className="profile-field-hint">A number the school can reach you on.</p>
            {errors.phone && (
              <p className="profile-field-error" role="alert">
                {errors.phone}
              </p>
            )}
          </div>
          <div className="profile-field">
            <label htmlFor="profile-alt-phone">Second phone (optional)</label>
            <input
              id="profile-alt-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={altPhone}
              aria-invalid={!!errors.alt_phone}
              onChange={(event) => edit(setAltPhone, "alt_phone")(event.target.value)}
            />
            <p className="profile-field-hint">Leave empty if you only use one number.</p>
            {errors.alt_phone && (
              <p className="profile-field-error" role="alert">
                {errors.alt_phone}
              </p>
            )}
          </div>
          <div className="profile-field">
            <label htmlFor="profile-address">Home address</label>
            <textarea
              id="profile-address"
              rows={3}
              value={address}
              aria-invalid={!!errors.address}
              onChange={(event) => edit(setAddress, "address")(event.target.value)}
            />
            {errors.address && (
              <p className="profile-field-error" role="alert">
                {errors.address}
              </p>
            )}
          </div>
          {errors.form && (
            <p className="profile-field-error" role="alert">
              {errors.form}
            </p>
          )}
          <div className="profile-form-actions">
            <button type="button" className="profile-cancel" onClick={cancel} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="profile-save" disabled={!changed || isLoading}>
              {isLoading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <dl className="screen-card profile-rows">
          <DetailRow label="Phone number" value={profile.editable.phone} />
          {profile.editable.alt_phone && <DetailRow label="Second phone" value={profile.editable.alt_phone} />}
          <DetailRow label="Home address" value={profile.editable.address} />
          <DetailRow label="Email" value={profile.managed_by_school.sign_in_email} />
        </dl>
      )}
      <p className="profile-group-note">Your email is the address you sign in with. Ask the school to change it.</p>
    </section>
  );
}

/** The children the school has linked, each opening their Results. Only the school adds one. */
function LinkedChildren({ profile, showBranch }: { profile: ProfileData; showBranch: boolean }) {
  const children = profile.managed_by_school.children;
  return (
    <section className="profile-group profile-linked" aria-labelledby="profile-children-heading">
      <h2 id="profile-children-heading" className="profile-group-label">Your children</h2>
      <div className="screen-card profile-linked-card">
        {children.length > 0 && (
          <ul className="profile-linked-list">
            {children.map((child) => (
              <li key={child.id}>
                <Link to={`/results?child=${child.id}`} className="profile-linked-row">
                  <ChildAvatar name={child.full_name} childId={child.id} size={36} />
                  <span className="profile-linked-main">
                    <strong>{child.full_name}</strong>
                    <small>
                      {[child.class_name, showBranch ? child.branch?.name : null, child.relationship]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="profile-linked-note">
          {children.length === 0
            ? "No children on your account. Ask the school to link your children."
            : "Only the school can add a child here. Ask the school to link another child to your account."}
        </p>
      </div>
    </section>
  );
}

/** Re-export so the test file names the heading icon for its probe. */
export { KeyRound as PasswordIcon };

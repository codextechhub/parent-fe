import { useRef, useState, type FormEvent } from "react";
import { Camera, ChevronRight, ImagePlus, Info, KeyRound, LockKeyhole, Pencil, Trash2, Users } from "lucide-react";
import { Dialog } from "radix-ui";
import { Link } from "react-router";
import { toast } from "sonner";

import { ChangePasswordCard } from "@/components/change-password";
import { ChildAvatar } from "@/components/child-avatar";
import { InstallSetting } from "@/components/install-offer";
import { PageShell } from "@/components/layout/page-shell";
import { PushSetting } from "@/components/push-settings";
import { useShownImage } from "@/lib/shown-image";
import { useAppSelector } from "@/redux/hooks";
import {
  refusal,
  useProfileQuery,
  useRemovePhotoMutation,
  useUpdateProfileMutation,
  useUploadPhotoMutation,
  type EditableFields,
  type ProfileData,
} from "@/redux/services/portal-api";

import "./profile.css";

/**
 * The parent's profile.
 *
 * "Managed by the school" is read-only (name, sign-in email, children). The
 * email box carries the backend's sentence about not being changeable here.
 * "Your details" edits phone, alt_phone and address; each refusal lands
 * under its own box, and Save is off until something changed. Linked
 * children links to that child's Results screen with `?child=`.
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
              <SchoolDetails profile={profile} />
            </div>
            <LinkedChildren profile={profile} showBranch={me?.show_branch ?? false} />
            <InstallSetting />
            <PushSetting />
            <ChangePasswordCard />
          </>
        )}
      </div>
    </PageShell>
  );
}

/** The largest photograph the school takes, as the student app's. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * The parent's banner: their photograph (or initials) with the camera that
 * changes it, their name, and how many children they have at the school.
 *
 * The photograph is the one on their guardian record, the one the school sees,
 * so it is fetched with the parent's token (`useShownImage`). The camera stays
 * off while the app cannot reach the school.
 */
function ProfileHero({ profile, schoolName }: { profile: ProfileData; schoolName: string }) {
  const name = profile.managed_by_school.full_name;
  const count = profile.managed_by_school.children.length;
  const childWord = count === 1 ? "child" : "children";
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
        <h2>{name}</h2>
        <p className="profile-hero-school">
          Parent · {count} {childWord}
          {schoolName ? ` · ${schoolName}` : ""}
        </p>
      </div>
    </section>
  );
}

function DetailRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>
        {value || "None"}
        {hint && <small>{hint}</small>}
      </dd>
    </div>
  );
}

function SchoolDetails({ profile }: { profile: ProfileData }) {
  const managed = profile.managed_by_school;
  const count = managed.children.length;
  return (
    <section className="profile-surface profile-card profile-school">
      <div className="profile-card-heading">
        <span className="profile-card-icon">
          <LockKeyhole size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>Managed by the school</h2>
          <p>Your official details on your account</p>
        </div>
      </div>
      <dl className="profile-rows">
        <DetailRow label="Full name" value={managed.full_name} />
        <DetailRow
          label="Sign-in email"
          value={managed.sign_in_email}
          hint="Your email is the address you sign in with. Ask the school to change it."
        />
        <DetailRow label="Children on your account" value={String(count)} />
      </dl>
      <p className="profile-school-tip">
        <Info size={17} aria-hidden="true" />
        <span>Need to correct one of these? Ask the school office.</span>
      </p>
    </section>
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
    <section className="profile-surface profile-card profile-contact">
      <div className="profile-card-top">
        <div className="profile-card-heading">
          <span className="profile-card-icon">
            <Pencil size={19} aria-hidden="true" />
          </span>
          <div>
            <h2>Your details</h2>
            <p>Keep these up to date for the school</p>
          </div>
        </div>
        {!editing && (
          <button type="button" className="profile-edit-button" onClick={start}>
            Edit details
          </button>
        )}
      </div>
      {editing ? (
        <form className="profile-form" onSubmit={submit} noValidate>
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
        <dl className="profile-rows">
          <DetailRow label="Phone number" value={profile.editable.phone} />
          <DetailRow label="Second phone" value={profile.editable.alt_phone} />
          <DetailRow label="Home address" value={profile.editable.address} />
        </dl>
      )}
    </section>
  );
}

function LinkedChildren({ profile, showBranch }: { profile: ProfileData; showBranch: boolean }) {
  const children = profile.managed_by_school.children;
  return (
    <section className="profile-surface profile-card profile-linked">
      <div className="profile-card-heading">
        <span className="profile-card-icon">
          <Users size={19} aria-hidden="true" />
        </span>
        <div>
          <h2>Linked children</h2>
          <p>Only the school can add or remove a link here.</p>
        </div>
      </div>
      {children.length === 0 ? (
        <p className="profile-linked-empty">No children on your account. Ask the school to link your children.</p>
      ) : (
        <ul className="profile-linked-list">
          {children.map((child) => (
            <li key={child.id}>
              <Link to={`/results?child=${child.id}`} className="profile-linked-row">
                <ChildAvatar name={child.full_name} childId={child.id} size={38} />
                <span className="profile-linked-main">
                  <strong>{child.full_name}</strong>
                  <small>
                    {[child.class_name, showBranch ? child.branch?.name : null, child.relationship]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <ChevronRight size={17} aria-hidden="true" className="profile-linked-chev" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Re-export so the test file names the heading icon for its probe. */
export { KeyRound as PasswordIcon };

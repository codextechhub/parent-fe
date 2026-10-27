import { Bell, CheckCircle2, ChevronRight, CreditCard, Wallet } from "lucide-react";
import { Link } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { ScreenTitle } from "@/components/layout/screen";
import { ChildAvatar } from "@/components/child-avatar";
import { InstallOffer } from "@/components/install-offer";
import { PaymentNotices } from "@/components/payment-notices";
import { PushOffer } from "@/components/push-settings";
import { formatLongDate, formatNaira } from "@/lib/format";
import { forChildren, rowTime } from "@/lib/inbox";
import { childHues, paleOf } from "@/lib/name-hue";
import { clearPayAllQueue } from "@/pages/pay-all-queue";
import { useAppSelector } from "@/redux/hooks";
import {
  cardPaymentsOn,
  useFamilyFeesQuery,
  useHomeQuery,
  type ChildAttendance,
  type ChildFees,
  type ChildHomeBlock,
  type ChildResults,
  type FamilyFees,
  type Home,
  type Unavailable,
} from "@/redux/services/portal-api";

import "./home.css";

/**
 * Where the family's children are, at a school with several branches: "2
 * children at Lekki Branch" when they share one, "3 children across 2
 * branches" when they do not.
 */
function familyLine(children: { branch?: { id: number; name: string } }[]): string {
  if (children.length === 0) return "";
  const count = `${children.length} child${children.length === 1 ? "" : "ren"}`;
  const branches = new Map(children.map((c) => [c.branch?.id ?? 0, c.branch?.name ?? ""]));
  if (branches.size === 1) {
    const [name] = branches.values();
    return name ? `${count} at ${name}` : count;
  }
  return `${count} across ${branches.size} branches`;
}

/** "₦85,000" for whole naira and "₦85,000.50" otherwise: the short form for a legend. */
function shortNaira(kobo: number): string {
  const full = formatNaira(kobo);
  return full.endsWith(".00") ? full.slice(0, -3) : full;
}

/**
 * The parent's home (design 1b): the family at a glance.
 *
 * The date and "Welcome, Patricia" as the large title, with the family's
 * branches and the term as chips. Then the fees card: what the family still
 * owes, split by child in each child's colour, with Pay all balances where
 * the school takes cards. Then one card per child (attendance, the latest
 * term's result, their fees; the head opens their timetable), payments the
 * school has booked since the parent last looked, and the latest notice.
 * Every block honours its own `available: false` with the server's sentence;
 * a zero figure is never shown for an unavailable block. From 900px the
 * title and money sit on the left and the children on the right.
 */
export function HomePage() {
  const me = useAppSelector((s) => s.auth.me);
  const { data: home, isLoading, isError, refetch } = useHomeQuery();
  const schoolYear = [me?.term?.name, me?.session?.name].filter(Boolean).join(" · ");
  const branchLine = me?.show_branch ? familyLine(me.children) : me?.school.name ?? "";
  const greeting = me?.parent.first_name ? `Welcome, ${me.parent.first_name}` : "Welcome";
  const unreadNotices = home?.notices.available && home.notices.unread_count ? home.notices.unread_count : 0;
  const unreadNotifications = home?.notifications.available && home.notifications.unread_count ? home.notifications.unread_count : 0;
  // Today without the year, as the design writes it: "Monday, 26 Oct".
  const today = home ? formatLongDate(home.date).replace(/ \d{4}$/, "") : "Today";

  return (
    <PageShell className="home-page">
      <div className="home-layout">
        <div className="home-side">
          <ScreenTitle title={greeting} eyebrow={today}>
            {(branchLine || schoolYear || unreadNotifications > 0) && (
              <div className="chips">
                {branchLine && <span className="chip chip--brand">{branchLine}</span>}
                {schoolYear && <span className="chip">{schoolYear}</span>}
                {unreadNotifications > 0 && (
                  <span className="chip" aria-label={`${unreadNotifications} unread notifications`}>
                    <Bell size={12} aria-hidden="true" className="home-chip-icon" />{unreadNotifications} unread
                  </span>
                )}
              </div>
            )}
          </ScreenTitle>
          {isLoading && !home && <div className="home-loading is-money" role="status" aria-label="Loading home" />}
          {isError && !home && (
            <div className="screen-card home-error" role="alert">
              Your home screen can&apos;t be shown right now.{" "}
              <button type="button" onClick={() => refetch()}>Try again</button>
            </div>
          )}
          {home && (
            <>
              <FamilyFeesCard block={home.fees} children={home.children} />
              <InstallOffer />
              <PushOffer />
              <PaymentNotices />
            </>
          )}
        </div>

        {home && (
          <div className="home-content">
            <section className="home-section" aria-labelledby="home-children-title">
              <div className="screen-section">
                <h2 id="home-children-title">Your children</h2>
                <span className="screen-section-aside">
                  {home.children.length === 1 ? "Their week at a glance" : "Each of them, at a glance"}
                </span>
              </div>
              {home.children.map((child) => (
                <ChildCard key={child.id} child={child} />
              ))}
              {home.children.length === 0 && (
                <p className="screen-card home-empty-card">
                  No children on the roll under your account. Ask the school to link your children.
                </p>
              )}
            </section>
            <NoticeSection block={home.notices} unread={unreadNotices} />
          </div>
        )}
      </div>
    </PageShell>
  );
}

/**
 * What the family still owes, on the deep blue card: the amount, a bar split
 * by each child's share in their colour with a legend under it, and Pay all
 * balances where the school takes cards and there is a bill to pay. Where
 * the school takes transfers only, a line says so instead. Nothing owed is a
 * green card; fees the school cannot show now are an amber one with its
 * sentence.
 */
function FamilyFeesCard({ block, children }: { block: FamilyFees; children: ChildHomeBlock[] }) {
  const offline = useAppSelector((s) => s.connectivity.offline);
  const ids = useAppSelector((s) => s.auth.me?.children.map((child) => child.id) ?? []);
  const hues = childHues(ids);
  const owesSomething = block.available && children.some((child) => child.fees.available && child.fees.owing > 0);
  // Read only to learn how this school's families pay, and whether Pay all has a bill to pay; Fees reads the same.
  const { data: fees } = useFamilyFeesQuery(undefined, { skip: !owesSomething });
  const transferOnly = !!fees && !cardPaymentsOn(fees);

  if (!block.available) {
    return (
      <section className="home-banner home-banner--amber" role="status">
        <span className="home-banner-icon"><Wallet size={19} aria-hidden="true" /></span>
        <div className="home-banner-text">
          <strong>Fees</strong>
          <p>{block.message}</p>
        </div>
        <Link to="/fees" className="home-banner-link">Open Fees</Link>
      </section>
    );
  }
  const availableChildren = children.filter((child) => child.fees.available);
  const owingOf = (child: ChildHomeBlock) => (child.fees.available ? child.fees.owing : 0);
  const due = availableChildren.length ? availableChildren.reduce((total, child) => total + owingOf(child), 0) : block.outstanding;
  const credit = availableChildren.length
    ? availableChildren.reduce((total, child) => total + (child.fees.available ? child.fees.credit : 0), 0)
    : block.credit;

  if (due <= 0) {
    return (
      <section className="home-banner home-banner--green" aria-label="Family fees status">
        <span className="home-banner-icon"><CheckCircle2 size={19} aria-hidden="true" /></span>
        <div className="home-banner-text">
          <strong>All fees are paid.</strong>
          <p>{credit > 0
            ? `Nothing is outstanding. ${formatNaira(credit)} in credit across your children.`
            : "Nothing is outstanding across your children."}</p>
        </div>
      </section>
    );
  }

  const payAll = fees?.pay_all;
  const canPayAll = !!payAll && cardPaymentsOn(fees) && payAll.total > 0 && payAll.steps.length > 0;
  const [whole, kobo] = formatNaira(due).split(".");
  const owing = availableChildren.filter((child) => owingOf(child) > 0);
  return (
    <section className="home-banner home-fees" aria-label="Family fees status">
      <span className="screen-orb" aria-hidden="true" />
      <span className="home-fees-label">Still due on bills and charges</span>
      <strong className="home-fees-amount" aria-label={formatNaira(due)}>
        {whole}<span>.{kobo}</span>
      </strong>
      {availableChildren.length > 1 && (
        <>
          <div className="home-fees-bar" aria-hidden="true">
            {owing.map((child) => (
              <span key={child.id} style={{ flexGrow: owingOf(child), background: paleOf(hues.get(child.id) ?? 255) }} />
            ))}
          </div>
          <ul className="home-fees-legend">
            {availableChildren.map((child) => (
              <li key={child.id}>
                <span className="home-fees-dot" style={{ background: paleOf(hues.get(child.id) ?? 255) }} aria-hidden="true" />
                {owingOf(child) > 0 ? `${child.first_name} ${shortNaira(owingOf(child))}` : `${child.first_name} paid up`}
              </li>
            ))}
          </ul>
        </>
      )}
      {(credit > 0 || transferOnly) && (
        <p className="home-fees-note">
          {credit > 0 && `${formatNaira(credit)} credit held by the school. Ask the school to apply it before you pay.`}
          {credit > 0 && transferOnly && " "}
          {transferOnly && "Pay by transfer to each child's account on the Fees screen."}
        </p>
      )}
      <div className="home-fees-actions">
        {canPayAll && !offline && (
          <Link to="/fees/pay-all" onClick={clearPayAllQueue} className="home-fees-pay">
            <CreditCard size={17} aria-hidden="true" />Pay all balances
          </Link>
        )}
        <Link to="/fees" className={canPayAll && !offline ? "home-fees-open" : "home-fees-pay"}>Open Fees</Link>
      </div>
    </section>
  );
}

/**
 * One child at a glance: their avatar in their colour, class and branch, the
 * head opening their timetable (the design's way to it). Under it two tiles,
 * attendance and the latest term's result, each opening its screen for the
 * child, and their fees on an amber strip when they owe, green when not.
 */
function ChildCard({ child }: { child: ChildHomeBlock }) {
  const me = useAppSelector((s) => s.auth.me);
  // The /home/ response carries neither the branch nor the full name per child; `me.children` does.
  const known = me?.children.find((c) => c.id === child.id);
  const branch = me?.show_branch ? known?.branch?.name : null;
  const about = [child.class_name || "No class yet", branch].filter(Boolean).join(" · ");
  return (
    <article className="screen-card home-child" aria-label={`${child.first_name}'s card`}>
      <Link
        to={`/timetable?child=${child.id}`}
        className="home-child-head"
        aria-label={`Open ${child.first_name}'s timetable`}
      >
        <ChildAvatar name={known?.full_name || child.first_name} childId={child.id} size={44} />
        <span className="home-child-name">
          <strong>{child.first_name}</strong>
          <span>{about}</span>
        </span>
        <span className="home-child-go"><ChevronRight size={17} aria-hidden="true" /></span>
      </Link>
      <div className="home-child-stats">
        <AttendanceTile child={child.id} block={child.attendance} />
        <ResultsTile child={child.id} block={child.results} />
      </div>
      <FeesStrip block={child.fees} />
    </article>
  );
}

function Tile({ to, label, value, children }: { to: string; label: string; value: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="home-stat">
      <span className="home-stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="home-stat-sub">{children}</span>
    </Link>
  );
}

function AttendanceTile({ child, block }: { child: number; block: ChildAttendance }) {
  const to = `/attendance?child=${child}`;
  if (!block.available) return <Tile to={to} label="Attendance" value="–">{block.message}</Tile>;
  const rate = block.rate;
  return (
    <Tile to={to} label="Attendance" value={rate === null ? "–" : `${Math.round(rate)}%`}>
      {rate === null ? "No marks yet" : "This term"}
    </Tile>
  );
}

function ResultsTile({ child, block }: { child: number; block: ChildResults }) {
  const to = `/results?child=${child}`;
  if (!block.available) return <Tile to={to} label="Latest result" value="–">{block.message}</Tile>;
  if (!block.released) return <Tile to={to} label="Latest result" value="–">No term released yet</Tile>;
  const average = Number(block.overall_average);
  const shown = Number.isFinite(average) ? `${Math.round(average)}%` : block.overall_average;
  return <Tile to={to} label={block.term.name} value={shown}>{block.term.session}</Tile>;
}

/** A child's fees in a line: amber with the amount while they owe, green when paid up or in credit. */
function FeesStrip({ block }: { block: ChildFees }) {
  if (!block.available) {
    return (
      <Link to="/fees" className="home-child-fees is-grey">
        <span className="home-child-fees-label"><Wallet size={16} aria-hidden="true" />Fees</span>
        <span className="home-child-fees-sub">{block.message}</span>
      </Link>
    );
  }
  if (block.status !== "OWING") {
    return (
      <Link to="/fees" className="home-child-fees is-clear">
        <span className="home-child-fees-label"><CheckCircle2 size={16} aria-hidden="true" />Fees</span>
        <span className="home-child-fees-sub">
          {block.status === "IN_CREDIT" ? `In credit · ${formatNaira(block.credit)}` : "Paid up"}
        </span>
      </Link>
    );
  }
  const open = [
    block.open_invoice_count > 0 ? `${block.open_invoice_count} open bill${block.open_invoice_count === 1 ? "" : "s"}` : null,
    block.open_charge_count > 0 ? `${block.open_charge_count} open charge${block.open_charge_count === 1 ? "" : "s"}` : null,
    block.credit > 0 ? `${formatNaira(block.credit)} credit held` : null,
  ].filter(Boolean).join(" · ");
  return (
    <Link to="/fees" className="home-child-fees is-owing">
      <span className="home-child-fees-label"><Wallet size={16} aria-hidden="true" />Fees</span>
      <span className="home-child-fees-figure">
        <strong>{formatNaira(block.owing)}</strong>
        <span>{open || "Owing"}</span>
      </span>
    </Link>
  );
}

function NoticeSection({ block, unread }: { block: Home["notices"]; unread: number }) {
  const latest = block.available ? block.latest : null;
  return (
    <section className="home-section" aria-labelledby="home-notice-title">
      <div className="screen-section">
        <h2 id="home-notice-title">From your school</h2>
        {block.available
          ? <Link to="/inbox?show=notices" className="screen-section-link">{unread ? `${unread} unread · See all` : "See all"}</Link>
          : null}
      </div>
      {!block.available ? (
        <Unavailably block={block} />
      ) : !latest ? (
        <p className="screen-card home-empty-card">No notices yet.</p>
      ) : (
        <Link to={`/notices/${latest.id}`} className="screen-card home-notice">
          <span className="icon-tile home-notice-icon"><Bell size={19} aria-hidden="true" /></span>
          <span className="home-notice-body">
            <span className="home-notice-top">
              <strong>
                {latest.unread && <span className="home-unread-dot" aria-label="Unread" />}
                <span className="home-notice-title">{latest.title}</span>
              </strong>
              <time dateTime={latest.published_at}>{rowTime(latest.published_at)}</time>
            </span>
            <span className="home-notice-excerpt">{latest.body}</span>
            <span className="home-notice-for">{forChildren(latest.children, latest.audience_label)}</span>
          </span>
        </Link>
      )}
    </section>
  );
}

function Unavailably({ block }: { block: Unavailable }) {
  return <p className="screen-card home-empty-card">{block.message}</p>;
}

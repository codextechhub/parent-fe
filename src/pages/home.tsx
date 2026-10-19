import { Bell, CheckCircle2, ChevronRight, Users, Wallet } from "lucide-react";
import { Link } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { ChildAvatar } from "@/components/child-avatar";
import { formatLongDate, formatNaira, formatTimestampDate } from "@/lib/format";
import { useAppSelector } from "@/redux/hooks";
import {
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
 * The parent's home.
 *
 * Family header greeting, then the money banner (what the family owes in all,
 * or an "all paid" line), one card per child, then the latest notice. Every
 * block honours its own `available: false` with the server's sentence; a
 * zero figure is never shown for an unavailable block. Follow-ups, messages
 * and open-work counts are parked (plan 2.3 point 5).
 */
export function HomePage() {
  const me = useAppSelector((s) => s.auth.me);
  const { data: home, isLoading, isError, refetch } = useHomeQuery();
  const schoolYear = [me?.term?.name, me?.session?.name].filter(Boolean).join(" · ");
  const branchLine = me?.show_branch
    ? me.children.length === 0
      ? ""
      : `${me.children.length} child${me.children.length === 1 ? "" : "ren"} across ${
          new Set(me.children.map((c) => c.branch?.id ?? 0)).size
        } branches`
    : me?.school.name ?? "";
  const greeting = me?.parent.first_name
    ? `Welcome, ${me.parent.first_name}`
    : "Welcome";
  const unreadNotices =
    home?.notices.available && home.notices.unread_count ? home.notices.unread_count : 0;
  const unreadNotifications =
    home?.notifications.available && home.notifications.unread_count
      ? home.notifications.unread_count
      : 0;

  return (
    <PageShell className="home-page">
      <div className="home-layout">
        <div className="home-side">
          <section className="home-hero" aria-labelledby="home-welcome">
            <div className="home-hero-orb" aria-hidden="true" />
            <p className="home-hero-date">{home ? formatLongDate(home.date) : "Today"}</p>
            <h1 id="home-welcome">{greeting}</h1>
            {(branchLine || schoolYear) && (
              <div className="home-hero-chips">
                {branchLine && <span className="home-glass-chip">{branchLine}</span>}
                {schoolYear && <span className="home-glass-chip">{schoolYear}</span>}
              </div>
            )}
            {unreadNotifications > 0 && (
              <p className="home-hero-bell" aria-label={`${unreadNotifications} unread notifications`}>
                <Bell size={14} aria-hidden="true" /> {unreadNotifications} unread
              </p>
            )}
          </section>
        </div>

        <div className="home-content">
          {isLoading && !home && (
            <div className="home-loading" role="status" aria-label="Loading home" />
          )}
          {isError && !home && (
            <div className="home-surface home-error" role="alert">
              Your home screen can&apos;t be shown right now.{" "}
              <button type="button" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          )}
          {home && (
            <>
              <FamilyFeesBanner block={home.fees} />
              <section aria-labelledby="home-children-title">
                <SectionHeading
                  title="Your children"
                  subtitle={
                    home.children.length === 1 ? "Their week at a glance" : "Each of them, at a glance"
                  }
                  id="home-children-title"
                />
                <div className="home-children">
                  {home.children.map((child) => (
                    <ChildCard key={child.id} child={child} showBranchName={!!me?.show_branch} />
                  ))}
                  {home.children.length === 0 && (
                    <p className="home-empty home-surface home-child-empty">
                      No children on the roll under your account. Ask the school to link your
                      children.
                    </p>
                  )}
                </div>
              </section>
              <NoticeSection block={home.notices} unread={unreadNotices} />
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function SectionHeading({
  title,
  subtitle,
  id,
  href,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  id: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="home-section-heading">
      <div>
        <h2 id={id}>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {href && linkLabel && (
        <Link to={href} className="home-section-link">
          {linkLabel}
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function Unavailably({ block }: { block: Unavailable }) {
  return <p className="home-empty">{block.message}</p>;
}

function FamilyFeesBanner({ block }: { block: FamilyFees }) {
  if (!block.available) {
    return (
      <section className="home-surface home-banner home-banner--amber" role="status">
        <div className="home-banner-icon">
          <Wallet size={21} aria-hidden="true" />
        </div>
        <div className="home-banner-text">
          <strong>Fees</strong>
          <p>{block.message}</p>
        </div>
        <Link to="/fees" className="home-banner-cta">
          Open Fees
        </Link>
      </section>
    );
  }
  if (block.outstanding <= 0) {
    return (
      <section className="home-surface home-banner home-banner--green" aria-label="Family fees status">
        <div className="home-banner-icon">
          <CheckCircle2 size={21} aria-hidden="true" />
        </div>
        <div className="home-banner-text">
          <strong>All fees are paid.</strong>
          <p>Nothing is outstanding across your children.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="home-surface home-banner" aria-label="Family fees status">
      <div className="home-banner-icon">
        <Wallet size={21} aria-hidden="true" />
      </div>
      <div className="home-banner-text">
        <strong>{formatNaira(block.outstanding)} outstanding</strong>
        <p>Across your children, with {formatNaira(block.pay_all_total)} ready to pay.</p>
      </div>
      <Link to="/fees" className="home-banner-cta">
        Open Fees
      </Link>
    </section>
  );
}

function ChildCard({ child, showBranchName }: { child: ChildHomeBlock; showBranchName: boolean }) {
  return (
    <article className="home-surface home-child" aria-label={`${child.first_name}'s card`}>
      <header className="home-child-head">
        <ChildAvatar name={child.first_name} size={38} />
        <div className="home-child-name">
          <strong>{child.first_name}</strong>
          <span>{child.class_name || "No class yet"}</span>
        </div>
        <Link to={`/results?child=${child.id}`} className="home-child-link" aria-label={`Open ${child.first_name}'s results`}>
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
      </header>
      <dl className="home-child-stats">
        <AttendanceStat block={child.attendance} />
        <FeesStat block={child.fees} />
        <ResultsStat block={child.results} />
      </dl>
      {!showBranchName ? null : (
        <ChildBranchLine child={child} />
      )}
    </article>
  );
}

function ChildBranchLine({ child }: { child: ChildHomeBlock }) {
  // The /home/ response does not carry the branch per child; `me.children` does.
  // Pull it from the auth slice so the tag reads "Lekki" alongside the stats.
  const me = useAppSelector((s) => s.auth.me);
  const match = me?.children.find((c) => c.id === child.id);
  const branch = match?.branch?.name ?? "";
  if (!branch) return null;
  return (
    <p className="home-child-branch">
      <Users size={13} aria-hidden="true" /> {branch}
    </p>
  );
}

function AttendanceStat({ block }: { block: ChildAttendance }) {
  if (!block.available) {
    return (
      <Stat label="Attendance" value="—">
        {block.message}
      </Stat>
    );
  }
  const rate = block.rate;
  return (
    <Stat label="Attendance" value={rate === null ? "—" : `${Math.round(rate)}%`}>
      {rate === null ? "No marks yet" : "This term"}
    </Stat>
  );
}

const FEE_STATUS: Record<"OWING" | "CLEAR" | "IN_CREDIT", string> = {
  OWING: "Owing",
  CLEAR: "Paid up",
  IN_CREDIT: "In credit",
};

function FeesStat({ block }: { block: ChildFees }) {
  if (!block.available) {
    return (
      <Stat label="Fees" value="—">
        {block.message}
      </Stat>
    );
  }
  const sub =
    block.status === "OWING" && block.open_invoice_count > 0
      ? `${block.open_invoice_count} open bill${block.open_invoice_count === 1 ? "" : "s"}`
      : FEE_STATUS[block.status];
  return (
    <Stat label="Fees" value={formatNaira(Math.abs(block.balance))}>
      {sub}
    </Stat>
  );
}

function ResultsStat({ block }: { block: ChildResults }) {
  if (!block.available) {
    return (
      <Stat label="Latest result" value="—">
        {block.message}
      </Stat>
    );
  }
  if (!block.released) {
    return (
      <Stat label="Latest result" value="—">
        No term released yet
      </Stat>
    );
  }
  const average = Number(block.overall_average);
  const shown = Number.isFinite(average) ? `${Math.round(average)}%` : block.overall_average;
  return (
    <Stat label={block.term.name} value={shown}>
      {block.term.session}
    </Stat>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="home-stat">
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        <span>{children}</span>
      </dd>
    </div>
  );
}

function NoticeSection({ block, unread }: { block: Home["notices"]; unread: number }) {
  const latest = block.available ? block.latest : null;
  return (
    <section aria-labelledby="home-notice-title">
      <SectionHeading
        title="From your school"
        subtitle={unread ? `${unread} unread` : "Latest announcement"}
        id="home-notice-title"
        href={block.available ? "/notices" : undefined}
        linkLabel="See all"
      />
      {!block.available ? (
        <div className="home-surface home-notice">
          <Unavailably block={block} />
        </div>
      ) : !latest ? (
        <div className="home-surface home-notice">
          <p className="home-empty">No notices yet.</p>
        </div>
      ) : (
        <Link to={`/notices/${latest.id}`} className="home-surface home-notice home-notice-link">
          <span className="home-notice-icon">
            <Bell size={19} aria-hidden="true" />
          </span>
          <span className="home-notice-body">
            <span className="home-notice-top">
              <strong>
                {latest.unread && <span className="home-unread-dot" aria-label="Unread" />}
                {latest.title}
              </strong>
              <time dateTime={latest.published_at}>{formatTimestampDate(latest.published_at)}</time>
            </span>
            <span className="home-notice-excerpt">{latest.body}</span>
            {latest.children.length > 0 && (
              <span className="home-notice-for">For {latest.children.join(" and ")}</span>
            )}
          </span>
        </Link>
      )}
    </section>
  );
}

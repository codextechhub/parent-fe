import type { ReactNode } from "react";

import { useShownImage } from "@/lib/shown-image";
import type { DocumentLetterhead } from "@/redux/services/portal-api";

import "./finance-document.css";

/**
 * The pieces the invoice and receipt sheets share with the school's printed
 * copies: the letterhead, its crest, and the block titles.
 *
 * The sheets draw the same design the backend prints to PDF
 * (`vs_finance/templates/vs_finance/invoice_document.html` and
 * `receipt_document.html`), so a parent who reads an invoice here and then
 * downloads it sees one document, not two. The tokens in
 * `finance-document.css` are that template's; keep them in step with it.
 *
 * A school with no crest of its own gets the template's drawn crest with its
 * initials, which is what its PDF prints, rather than the XVS crest the app
 * chrome falls back to: this is the school's document, not the app.
 */
export function Letterhead({
  letterhead,
  kind,
  kindSub,
  number,
  tone = "navy",
}: {
  letterhead: DocumentLetterhead;
  kind: string;
  kindSub: string;
  number: string;
  tone?: "navy" | "paid";
}) {
  const contact = [letterhead.email, letterhead.phone].filter(Boolean).join(" · ");
  return (
    <header className="fdoc-letterhead">
      <div className="fdoc-issuer">
        <Crest name={letterhead.name} logo={letterhead.logo_url} />
        <div className="fdoc-issuer-text">
          <p className="fdoc-school">{letterhead.name}</p>
          {letterhead.tag && <p className="fdoc-tag">{letterhead.tag}</p>}
          {(letterhead.address || contact || letterhead.website) && (
            <p className="fdoc-issuer-meta">
              {letterhead.address && <span>{letterhead.address}</span>}
              {contact && <span>{contact}</span>}
              {letterhead.website && <span>{letterhead.website}</span>}
            </p>
          )}
        </div>
      </div>
      <div className="fdoc-kind">
        <p className={tone === "paid" ? "fdoc-kind-title is-paid" : "fdoc-kind-title"}>{kind}</p>
        <p className="fdoc-kind-sub">{kindSub}</p>
        <p className="fdoc-number">{number}</p>
        <span className="fdoc-gold-rule" aria-hidden="true" />
      </div>
    </header>
  );
}

/** The school's stored crest, or the template's drawn shield with its initials. */
function Crest({ name, logo }: { name: string; logo: string }) {
  const shown = useShownImage(logo);
  if (shown.pending) return <span className="fdoc-crest" aria-hidden="true" />;
  if (shown.src) return <img className="fdoc-crest" src={shown.src} alt="" />;
  return (
    <svg className="fdoc-crest" viewBox="0 0 54 60" aria-hidden="true" focusable="false">
      <path d="M27 0 L54 8 V32 C54 47 42 56 27 60 C12 56 0 47 0 32 V8 Z" fill="#1B2A4A" />
      <path
        d="M27 4 L50 11 V32 C50 44.5 39.6 52.8 27 56.4 C14.4 52.8 4 44.5 4 32 V11 Z"
        fill="none"
        stroke="#B08D57"
        strokeWidth="1.2"
      />
      <text
        x="27"
        y="30"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="16"
        fontWeight="700"
        fill="#ffffff"
        letterSpacing="1"
      >
        {name.slice(0, 2).toUpperCase()}
      </text>
      <line x1="14" y1="35" x2="40" y2="35" stroke="#B08D57" strokeWidth="1" />
    </svg>
  );
}

/** A small uppercase heading over a block, with the template's hairline under it. */
export function BlockTitle({ children }: { children: ReactNode }) {
  return <h3 className="fdoc-block-title">{children}</h3>;
}

/** One label and value row of a details block. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fdoc-kv">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

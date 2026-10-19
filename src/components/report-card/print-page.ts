import { useEffect } from "react";

/**
 * Prints the whole document on the report card's page: A4, portrait.
 *
 * Every other print in the app is landscape (`@page` in index.css). A named
 * page set on the card itself does not reach Chrome from inside the layout's
 * grid, and switching page names part-way through forces a blank page, so the
 * name goes on the document root while a report card screen is open and comes
 * off when it closes.
 */
export function useReportCardPrint() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.printPage = "report-card";
    return () => {
      delete root.dataset.printPage;
    };
  }, []);
}

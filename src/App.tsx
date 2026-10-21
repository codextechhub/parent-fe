import { BrowserRouter, Link, Route, Routes } from "react-router";
import { Toaster } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { InstallListener } from "@/components/install-offer";
import { PageShell } from "@/components/layout/page-shell";
import { UpdateBar } from "@/components/update-bar";
import { RequireParent } from "@/pages/guard";
import SignInPage from "@/pages/sign-in";
import { PushListener } from "@/push/push-listener";
import { AttendancePage } from "@/pages/attendance";
import { FeesPage } from "@/pages/fees";
import { HomePage } from "@/pages/home";
import { InvoicePage } from "@/pages/invoice";
import { MessagesPage } from "@/pages/messages";
import { NoticesPage } from "@/pages/notices";
import { PaidPage } from "@/pages/paid";
import { PayPage } from "@/pages/pay";
import { PayAllPage } from "@/pages/pay-all";
import { ProfilePage } from "@/pages/profile";
import { ReceiptPage } from "@/pages/receipt";
import { ReportCardPage } from "@/pages/report-card";
import { ResultsPage } from "@/pages/results";
import { TimetablePage } from "@/pages/timetable";

/**
 * The parent app's routes, all under `/parent/`.
 *
 * `/sign-in` is public; everything else goes through `RequireParent`, which
 * reads `GET me/` and sends the parent back to sign-in on a 404 (not a
 * parent) or 401 (session expired). Phase 2 ships the shell, the child
 * switcher, auth, and placeholder screens for Home, Results, Fees, Notices
 * and Profile; later phases replace each placeholder.
 */
export default function App() {
  return (
    <BrowserRouter basename="/parent">
      <PushListener />
      <InstallListener />
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route
          element={
            <RequireParent>
              <AppShell />
            </RequireParent>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="results/card/:termId" element={<ReportCardPage />} />
          <Route path="fees" element={<FeesPage />} />
          <Route path="fees/invoices/:invoiceRef" element={<InvoicePage />} />
          <Route path="fees/receipts/:paymentRef" element={<ReceiptPage />} />
          <Route path="fees/pay/:invoiceRef" element={<PayPage />} />
          <Route path="fees/pay-all" element={<PayAllPage />} />
          <Route path="fees/paid" element={<PaidPage />} />
          <Route path="notices" element={<NoticesPage />} />
          <Route path="notices/:id" element={<NoticesPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="messages/new" element={<MessagesPage />} />
          <Route path="messages/:id" element={<MessagesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <UpdateBar />
      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  );
}

function NotFoundPage() {
  return (
    <PageShell className="min-h-dvh flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-mont text-xl font-semibold text-black-01">Page not found</h1>
      <Link to="/" className="text-sm text-primary underline underline-offset-4">
        Go back to the start
      </Link>
    </PageShell>
  );
}

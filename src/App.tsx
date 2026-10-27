import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { InstallListener } from "@/components/install-offer";
import { NativeCheckoutReturn } from "@/native/native-checkout";
import { NativeLinks } from "@/native/native-links";
import { NativePushListener } from "@/native/native-push";
import { isNativeApp, routerBasename } from "@/native/platform";
import { SplashGate } from "@/native/splash-gate";
import { StatusBarGate } from "@/native/status-bar-gate";
import { VersionGate } from "@/native/version-gate";
import { DeleteAccountPage } from "@/pages/delete-account";
import { NotFoundPage } from "@/pages/not-found";
import { SchoolChoicePage } from "@/pages/school-choice";
import { currentSchoolSlug } from "@/utils/school-host";
import { UpdateBar } from "@/components/update-bar";
import { RequireParent } from "@/pages/guard";
import SignInPage from "@/pages/sign-in";
import { PushListener } from "@/push/push-listener";
import { AttendancePage } from "@/pages/attendance";
import { FeesPage } from "@/pages/fees";
import { HomePage } from "@/pages/home";
import { InboxPage } from "@/pages/inbox";
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
 *
 * The store app is the same app on its own origin: the basename is `/`, there
 * is no install offer, service worker or Web Push (`NativePushListener` does
 * native push instead), the splash stays up until the first real screen is
 * drawn (`SplashGate`), links from a school's website open the right screen
 * (`NativeLinks`), a card payment's checkout browser hands back to the result
 * screen (`NativeCheckoutReturn`), the version check can block or nudge
 * (`VersionGate`), and until a school code has been entered the only screen is
 * the one that asks for it. Choosing a school reloads the app, so this reads
 * the school once per load.
 */
export default function App() {
  const native = isNativeApp();
  if (native && !currentSchoolSlug()) {
    return (
      <BrowserRouter basename={routerBasename()}>
        <SchoolChoicePage />
        <SplashGate ready />
        <StatusBarGate />
        <NativeLinks />
        <VersionGate />
        <Toaster position="top-center" richColors closeButton />
      </BrowserRouter>
    );
  }
  return (
    <BrowserRouter basename={routerBasename()}>
      {native ? (
        <>
          <NativePushListener />
          <SplashGate />
          <StatusBarGate />
          <NativeLinks />
          <NativeCheckoutReturn />
          <VersionGate />
        </>
      ) : (
        <>
          <PushListener />
          <InstallListener />
        </>
      )}
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        {native && <Route path="/school" element={<SchoolChoicePage />} />}
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
          <Route path="inbox" element={<InboxPage />} />
          {/* The lists live in the Inbox now; their old addresses open it on that list. */}
          <Route path="notices" element={<Navigate to="/inbox?show=notices" replace />} />
          <Route path="notices/:id" element={<NoticesPage />} />
          <Route path="messages" element={<Navigate to="/inbox?show=messages" replace />} />
          <Route path="messages/new" element={<MessagesPage />} />
          <Route path="messages/:id" element={<MessagesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/delete-account" element={<DeleteAccountPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!native && <UpdateBar />}
      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  );
}

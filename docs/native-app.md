# The store app

The parent app also ships as a store app for iPhone and Android: this same
code in a Capacitor shell (`com.codexng.xvs.parent`, "XVS Parent"). The web app
is unchanged. Everything native is additive and runs only inside the shell,
behind `isNativeApp()` in `src/native/platform.ts`, which asks
`Capacitor.isNativePlatform()`. No other file asks the platform a different
way. It is the pupil app's store app (`student-fe/docs/native-app.md`) adapted
to a parent: one account on the phone, no pupil switching.

## Building and running

Use the arm64 Node, as for the web app.

```bash
npm install
npm run cap:sync          # build:native, then `cap sync` into ios/ and android/
npx cap open ios          # Xcode: pick an iPhone simulator, press Run
npx cap open android      # Android Studio: pick an emulator, press Run
```

From the command line, an iPhone simulator build:

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator \
  -configuration Debug -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.codexng.xvs.parent
```

`CODE_SIGNING_ALLOWED=NO` builds an app with no signature at all, and an
unsigned app cannot reach the Keychain, so a sign-in on the simulator ends with
"This phone could not keep your sign-in safe". To sign in on the simulator, build
with an ad-hoc signature instead: replace that flag with
`CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=YES CODE_SIGNING_ALLOWED=YES DEVELOPMENT_TEAM=""`.

iOS needs Xcode 26 or later and uses Swift Package Manager (no CocoaPods).
Android needs the Android SDK and a JDK 21. Run `npm run cap:sync` again after
any change to the web code or to a Capacitor plugin.

### Against a local backend

`VITE_NATIVE_API_ORIGIN=http://localhost:8000 npm run cap:sync` points the app
at the local API (the backend already accepts the two native origins). The
iPhone simulator reaches `localhost` directly; for the Android emulator run
`adb reverse tcp:8000 tcp:8000` first. Run a plain `npm run cap:sync` again
before a release build.

## The native build

`npm run build:native` is `vite build --mode native`, configured in
`vite.config.ts`. It writes `dist-native/` (gitignored); the web build's
`dist/` is never touched.

- `base` is `/` and the router's basename is `/`, because the app is served
  from its own origin, `capacitor://localhost` (iOS) or `https://localhost`
  (Android). Capacitor's default schemes are kept: those two origins are what
  the API accepts as the store app.
- The PWA plugin is off. There is no service worker, manifest or push worker,
  and `virtual:pwa-register/react` is stood in for by
  `src/native/pwa-register-stub.ts`.
- The API is a separate origin, so its address is absolute. Set
  `VITE_NATIVE_API_ORIGIN` (no `/v1`) when building; it is staging's
  `https://api-staging.codexng.com` when unset. `VITE_APP_BASE_DOMAIN` is the
  domain schools' websites are under, used for "Forgot password"; it is
  `xvs-staging.codexng.com` when unset. For production:

  ```bash
  VITE_NATIVE_API_ORIGIN=https://api.codexng.com VITE_APP_BASE_DOMAIN=xvs.codexng.com npm run cap:sync
  ```

The generated projects live in `ios/` and `android/` and are kept in the
repository. Their build outputs, the copied web assets, Capacitor's generated
config files and `android/local.properties` are ignored by the ignore files
Capacitor writes there.

## What is native-only

- **School choice.** A browser reads its school off the address. The store app
  has one address for every school, so the first screen asks for the school
  code (the left part of the school's address, `meridian` for
  `meridian.xvs.codexng.com`), checks it against the public school name route,
  shows the school's name and crest to confirm, and keeps the code in
  `@capacitor/preferences` (`src/native/school-code.ts`). It is read into memory
  before the app mounts, so `currentSchoolSlug()` stays synchronous and answers
  with the code. "Change school" on the sign-in screen comes back to the
  choice; choosing reloads the app. The device account key is kept per school
  code, so changing school shows that school's sign-in and leaves the other's.
- **Sign-in by device session.** The parent app signs in with `session:
  "device"` on the web too and keeps one account key
  (`src/auth/device-account.ts`, behind `AccountStorage`). In the store app the
  key sits in the phone's preferences (`src/native/account-storage.ts`) and the
  refresh credential the API returns in the body is kept in the iOS Keychain or
  Android Keystore (`src/native/credentials.ts`), sent in the body of the
  refresh and sign-out calls (`src/auth/refresh.ts`,
  `src/auth/device-credential.ts`) and replaced by the rotated one on every
  refresh. No cookie and no CSRF token is used. Access tokens stay in memory.
  A 401 (`TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_INVALID`) forgets the account
  and its credential and asks for sign-in; a 409 (`TOKEN_STALE`) is retried
  with the credential kept. A secure storage that cannot be read decides
  nothing: the parent is not signed out for it. A sign-in whose credential
  cannot be kept is ended at once, on the API's side too.
- **Secure storage plugin.** `@aparajita/capacitor-secure-storage` 8.0.1: the
  Keychain and the Android Keystore, keys prefixed `xvs.parent.`, iCloud sync
  off and items `ThisDeviceOnly`, so a backup restored on another phone carries
  no sign-in.
- **Links to the school's website** ("Forgot password", the staff sign-in
  notice) are absolute addresses that the phone opens in its own browser.

## Off in the store app

The install offer, the update bar, service-worker Web Push and everything that
registers a service worker. Native push (below) takes the place of Web Push.

## Start-up, splash and icons

- **The splash.** `@capacitor/splash-screen` shows the XVS crest from launch.
  The app hides it itself (`src/native/splash.ts`, `splash-gate.tsx`) after the
  first real screen is painted: the school choice, the sign-in, or the parent's
  home (once `me/` has answered), never the loading mark. If the app never gets
  that far the plugin removes the splash after 8 seconds (`launchShowDuration`
  in `capacitor.config.ts`). The web view's own colour before it paints is the
  app's page background, so nothing flashes black. The status bar's text colour is set by
  the app (`src/native/status-bar.ts`, `status-bar-gate.tsx`, `@capacitor/status-bar`
  8.0.4): light over the sign-in's dark blue header (with a strip of the same
  blue held under the status bar so it stays readable as the white card scrolls
  up), dark on every other screen. It is always set explicitly, because the
  app's screens do not follow the phone's dark mode.
- **Icons and splash art.** The sources are in `assets/` and are drawn from the
  XVS crest in `public/svg/`, never the bare CodeX mark. `npm run store-art`
  redraws them (`scripts/render-store-art.mjs`, which needs Google Chrome) and
  runs `@capacitor/assets` to write every size into `ios/` and `android/`
  (`--ios --android` only: it must not touch the web manifest).

## Version check

On the store app only, at start and when the app returns to the foreground (at
most every four hours), `src/native/app-version.ts` asks the public
`GET /v1/app-versions/?app=com.codexng.xvs.parent&platform=<ios|android>&version=<x.y.z>`
and reads `status`:

- `update_required`: a full screen, "This version of XVS Parent is no longer
  supported. Update it to keep using it.", with one button that opens
  `store_url` in the phone's store (`@capacitor/app-launcher`).
- `update_available`: a small dismissible note with an Update button. A
  dismissal is remembered in `@capacitor/preferences` against that `latest`
  version, so the note stays away until a newer one is published.
- `current`, a 404 (no policy set), being offline, or any failure: nothing
  happens.

The version it sends is what `@capacitor/app` `getInfo()` reports, which is the
native project's version. **To release a new version, bump both**:
`MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in
`ios/App/App.xcodeproj/project.pbxproj` (two occurrences each, Debug and
Release), and `versionName` and `versionCode` in `android/app/build.gradle`.
Both are `1.0.0`, build 1 today. `package.json`'s version is not used.

## Links that open the app

The school's website publishes Android's `assetlinks.json` and iPhone's
`apple-app-site-association` on every school address, claiming `/parent/*` for
this app. The app side:

- **iOS**: `ios/App/App/App.entitlements` carries Associated Domains,
  `applinks:` and `webcredentials:` for `*.xvs.codexng.com` and
  `*.xvs-staging.codexng.com`, set as `CODE_SIGN_ENTITLEMENTS` on the App
  target. The App ID in the Apple Developer account needs the Associated
  Domains capability.
- **Android**: an `autoVerify` intent filter on `MainActivity` for `https`,
  both wildcard hosts, path prefix `/parent`.
- **In the app** (`src/native/app-links.ts`, `native-links.tsx`): `appUrlOpen`
  gives the link; the host's left label is the school code and the path after
  `/parent` is the screen (the store app's router starts at `/`). The same
  school navigates. Another school, or any school when none is chosen yet,
  shows "This link is for <School name>. Switch to that school?" and only a tap
  saves the code and reloads. Anything that is not a school's `/parent`
  address is ignored.

The links verify only once the store values are set on the school website's
side (the Apple team and bundle id, the Android certificate fingerprints).
Until then:

```bash
adb shell am start -a android.intent.action.VIEW -d "https://meridian.xvs-staging.codexng.com/parent/fees"
xcrun simctl openurl booted "https://meridian.xvs-staging.codexng.com/parent/fees"
```

Until the domain verifies, neither phone hands the link to the app: Android
opens it in the browser and the simulator opens Safari. That is expected, not a
fault.

## Building for Android on this Mac

Android Studio's bundled JDK is 25, which Gradle 8.14 cannot run on
(`Unsupported class file major version 69`), so the Gradle wrapper is 9.1.0,
the first release that runs on Java 25 and that the Android Gradle plugin 8.13
builds with. `android/local.properties` points at the SDK
(`sdk.dir=$HOME/Library/Android/sdk`) and is not committed.

```bash
export ANDROID_HOME=~/Library/Android/sdk
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
npm run cap:sync && cd android && ./gradlew assembleDebug
```

## Native push

Notifications reach the phone through Firebase Cloud Messaging on both
platforms, using `@capacitor-firebase/messaging` 8.5.2. The package's own
JavaScript is not imported (its web implementation pulls in the whole Firebase
web SDK): `src/native/messaging-plugin.ts` registers the plugin by name and
uses only its types. A Capacitor plugin is a proxy that answers `then` as a
missing method, so it must never be the result of an `await` or an async return
(`push-device.test.ts` holds that).

- **Config files** (committed, not secret): `android/app/google-services.json`
  (the Google services Gradle plugin is applied by `app/build.gradle` when the
  file exists) and `ios/App/App/GoogleService-Info.plist` (an App target
  resource). iOS also has `aps-environment` (`development`; the store build
  needs `production`) in `App.entitlements`, the `remote-notification`
  background mode in `Info.plist`, and the three APNs forwarding methods in
  `AppDelegate.swift`. `capacitor.config.ts` links the plugin by symlink for
  Swift Package Manager and sets the iPhone to show the banner and sound for an
  open app.
- **A build without the iPhone file.** The plugin configures Firebase only when
  `GoogleService-Info.plist` is in the bundle and otherwise logs and carries on,
  so the app starts. Such a build cannot get a token: the setting reads
  "Unavailable" (`firebaseConfigured`, probed when the offer or the setting is
  about to show) and the offer is not made. Dropping the file into
  `ios/App/App/` is all a build needs (it is already referenced by the App
  target).
- **Asking.** Only after the parent has signed in, and only behind the in-app
  explanation (`NativePushOffer`: "Get a notification when results, notices or
  payments arrive", with Not now). Turn on then shows the phone's own prompt.
  The choice is `push/push-choice` (`on`, `off`, `not-now`); a refusal is
  remembered and never asked again, and the choice goes with the sign-in.
  Profile's notifications card (`NativePushSetting`) shows on, off, blocked
  (with where to allow it in the phone's settings) or unavailable, and turns it
  on or off later.
- **Registering** (`native-push-state.ts`, `push-register.ts`). `POST
  /v1/notify/push/devices/` with `{token, platform, app, app_version, account}`
  (`app` is `com.codexng.xvs.parent`, `account` the sign-in's device key), made
  by `auth/parent-fetch.ts` with the parent's access token: at start once
  signed in, when the app returns to the front and when Firebase issues a new
  token. 503 `PUSH_NOT_CONFIGURED` is "the school sends no phone push yet": no
  error, the offer is put away and the setting says unavailable. Signing out
  also calls `DELETE` on the same route, best effort.
- **A tap** (`native-push.tsx`, `push-routing.ts`). The `url` opens with
  `/parent` removed, and a push that carries a `child` (a number sent as text)
  opens a per-child screen (Results, Attendance, Timetable) on that child with
  `?child=` when the address does not name one. A `url` outside `/parent`
  opens Home. A tap that launches the app waits for the session first.
- **An open app.** iPhone shows the system banner; Android shows a toast. A
  "Payment received" push, and the app returning to the front
  (`appStateChange`), read the fees and the watched transfers again at once.
- **Debug builds** log `[push] Firebase token obtained: <token>` once at start
  (`push-debug.ts`); a release build logs nothing.
- Not done: Android's small notification icon is the app icon; the iPhone
  `aps-environment` must be `production` in a store build, and the APNs key must
  be uploaded to Firebase.

## Deleting the account

Profile has "Delete my account" for any parent whose `GET
/v1/user/me/account-closure/` says `eligible` (or has a request waiting); a 403
`ACCOUNT_CLOSURE_NOT_OFFERED` (a teacher who is also a parent) hides it. It
opens `/profile/delete-account` (`pages/delete-account.tsx`), which says "Your
sign-in will be closed now. Your children's school records, results and fees
stay with the school.", sends `POST {confirm: true}`, and on `closed` takes the
parent off this device through `leaveAfterClosure` (the access token, the
account key, the stored credential and the notification choice are discarded
and every read is cleared) and shows the sign-in. Where the school is the one
to decide (`request` mode) the screen says the request was sent and shows its
date while it waits. Same screen in the browser and the store app.

## Card payments

Card is a per-school setting, off by default: the fees answers carry
`card_payments`. When it is false the app is transfer-only and none of the below
runs. When it is true: in a browser the Pay screen sends the page to the gateway
and the gateway returns to `/parent/fees/paid?reference=...`. In the store app
that would carry the web view away, so `pages/pay.tsx` opens the checkout with
`@capacitor/browser` 8.0.5 (a Safari view controller or a Custom Tab) through
`native/checkout.ts`. The app comes back by either route:

- the return link opens the app (`appUrlOpen`, `native-links.tsx`): the browser
  is closed and the result screen shown;
- the parent closes the browser (`browserFinished`, `native-checkout.tsx`): the
  result screen is shown for the checkout they left.

The result screen (`pages/paid.tsx`) asks the API for the payment's status by
reference. Nothing in an address and nothing about how the browser was left
marks a payment paid. Pay all runs one checkout per child through the same
screen. On an iPhone the return link may load inside the Safari view instead of
opening the app; the parent taps Done and the second route takes over.

## Fees by transfer

Where `card_payments` is false, the Pay screen and an invoice show the child's
own account number, and the Fees screen lists every child's account under
"Show account numbers" below Payment history, a disclosure that opens and
closes. While an account is on screen the app's one watcher
(`lib/use-deposit-watch.ts`) asks for deposits every 5 seconds while the app is
visible, and the store app also asks at once when it returns to the foreground
(`appStateChange`) and when a "Payment received" push arrives while it is open.

## What the App Store is told

- **Camera.** The profile photo is a web file picker, and on an iPhone that
  picker offers "Take Photo". iOS ends the app the moment that is tapped unless
  `Info.plist` says why the camera is wanted, so `NSCameraUsageDescription`
  says it: only when the person chooses to take a profile photo.
- **Privacy manifest.** `ios/App/App/PrivacyInfo.xcprivacy`, bundled by the
  App target, declares what XVS Parent collects (no tracking, every item linked
  to the person and used only to run the app) and its one reason-required API
  (UserDefaults, `CA92.1`, the app's own settings). It must match the privacy
  answers given in App Store Connect, which the privacy policy draft lists
  under "App store privacy answers"; change both together.

## Later phases

File sharing of receipts and report cards; the camera for the profile photo.

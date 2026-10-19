/**
 * What the install card says on a device that has not installed the app,
 * read from the browser the parent opened the link in.
 *
 * Ebere's mother opens the school's link from many places: Chrome on her
 * Android phone, Safari on her iPhone, Chrome on that iPhone, the browser
 * inside Instagram or Facebook when the school posts the link there, and
 * Firefox or Safari on the family computer. Each gets exactly one way to
 * install, and never a button that cannot work. On her Samsung phone the
 * link opens in Samsung Internet, whose install sets off Play Protect's
 * "may put your device at risk" warning, so there she is sent to Chrome.
 */
import { describe, expect, it } from "vitest";

import { installSituation, type BrowserFacts } from "./situation";

const phone = (userAgent: string): BrowserFacts => ({ userAgent, platform: "Linux armv8l", maxTouchPoints: 5 });
const iPhone = (userAgent: string): BrowserFacts => ({ userAgent, platform: "iPhone", maxTouchPoints: 5 });

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  iPhoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iPhoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  iPhoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15",
  iPhoneEdge:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/130.2849.80 Mobile/15E148 Safari/605.1.15",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 352.0.0.38.100 Android (34/14; 450dpi; 1080x2340; samsung; SM-A546E; a54x; s5e8835; en_GB; 650000000)",
  instagramIPhone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 352.0.0.38.100 (iPhone15,2; iOS 18_0; en_GB; en-GB; scale=3.00; 1179x2556; 650000000)",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.40.109;]",
  messengerIPhone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.40.109;FBBV/650000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.0]",
  tiktokAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 trill_370104 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/37.1.4 ByteLocale/en BytedanceWebview/d8a21c6",
  snapchatAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Snapchat/13.12.0.42 (SM-A546E; Android 14; gzip)",
  linkedinAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [LinkedInApp]/9.30.1234",
  lineAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Line/14.17.1/IAB",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  edgeAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.0.0",
  operaAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 OPR/85.0.0.0",
  phoenixAndroid:
    "Mozilla/5.0 (Linux; Android 13; TECNO KJ5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 PHX/14.4",
  miuiAndroid:
    "Mozilla/5.0 (Linux; U; Android 13; en-gb; 23021RAAEG) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.5615.136 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.5.0-gn",
  edgeDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  firefoxDesktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
};

describe("a browser that gives an install prompt", () => {
  it("offers Install once Chrome on Android has handed over its prompt", () => {
    expect(installSituation(phone(UA.androidChrome), "ready")).toBe("prompt");
  });

  it("points at the browser's menu once the prompt has been turned down", () => {
    expect(installSituation(phone(UA.androidChrome), "dismissed")).toBe("prompt-dismissed");
  });
});

describe("Safari on an iPhone or iPad", () => {
  it("shows Safari's steps, whether or not a prompt exists", () => {
    expect(installSituation(iPhone(UA.iPhoneSafari), "none")).toBe("ios-safari");
  });

  it("knows an iPad that says it is a Mac by its touch screen", () => {
    expect(installSituation({ userAgent: UA.macSafari, platform: "MacIntel", maxTouchPoints: 5 }, "none")).toBe("ios-safari");
  });
});

describe("a browser that cannot install", () => {
  it("sends Chrome on an iPhone (CriOS) to Safari, and Firefox and Edge there too", () => {
    expect(installSituation(iPhone(UA.iPhoneChrome), "none")).toBe("open-in-safari");
    expect(installSituation(iPhone(UA.iPhoneFirefox), "none")).toBe("open-in-safari");
    expect(installSituation(iPhone(UA.iPhoneEdge), "none")).toBe("open-in-safari");
  });

  it("sends Instagram's browser to Chrome on Android and to Safari on an iPhone", () => {
    expect(installSituation(phone(UA.instagramAndroid), "none")).toBe("open-in-chrome");
    expect(installSituation(iPhone(UA.instagramIPhone), "none")).toBe("open-in-safari");
  });

  it("knows the other apps' browsers by their marks", () => {
    expect(installSituation(phone(UA.facebookAndroid), "none")).toBe("open-in-chrome");
    expect(installSituation(iPhone(UA.messengerIPhone), "none")).toBe("open-in-safari");
    expect(installSituation(phone(UA.tiktokAndroid), "none")).toBe("open-in-chrome");
    expect(installSituation(phone(UA.snapchatAndroid), "none")).toBe("open-in-chrome");
    expect(installSituation(phone(UA.linkedinAndroid), "none")).toBe("open-in-chrome");
    expect(installSituation(phone(UA.lineAndroid), "none")).toBe("open-in-chrome");
  });

  it("never offers Install inside an app's browser, even with a prompt", () => {
    expect(installSituation(phone(UA.instagramAndroid), "ready")).toBe("open-in-chrome");
  });
});

describe("an Android browser other than Chrome", () => {
  it("sends Samsung Internet to Chrome, even with its own prompt in hand", () => {
    expect(installSituation(phone(UA.samsungInternet), "ready")).toBe("open-in-chrome");
    expect(installSituation(phone(UA.samsungInternet), "none")).toBe("open-in-chrome");
  });

  it("sends Edge, Opera and the phone makers' browsers to Chrome too", () => {
    expect(installSituation(phone(UA.edgeAndroid), "ready")).toBe("open-in-chrome");
    expect(installSituation(phone(UA.operaAndroid), "ready")).toBe("open-in-chrome");
    expect(installSituation(phone(UA.phoenixAndroid), "none")).toBe("open-in-chrome");
    expect(installSituation(phone(UA.miuiAndroid), "none")).toBe("open-in-chrome");
  });

  it("keeps Install for Edge on a computer, where nothing warns", () => {
    expect(installSituation({ userAgent: UA.edgeDesktop, platform: "Win32", maxTouchPoints: 0 }, "ready")).toBe("prompt");
  });
});

describe("anything else", () => {
  it("points Firefox, Safari on a Mac and Chrome before its prompt at the browser's menu", () => {
    expect(installSituation({ userAgent: UA.firefoxDesktop, platform: "Win32", maxTouchPoints: 0 }, "none")).toBe("menu");
    expect(installSituation({ userAgent: UA.macSafari, platform: "MacIntel", maxTouchPoints: 0 }, "none")).toBe("menu");
    expect(installSituation(phone(UA.androidChrome), "none")).toBe("menu");
  });
});

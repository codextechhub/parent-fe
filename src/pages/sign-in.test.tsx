import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mrs Patricia Okafor signs in to the Lagoon View Academy parent app. The page
 * is the student app's design: the school's welcome beside the form, the
 * password revealed on request, and every refusal in one place under the
 * fields. A teacher at the school who is no parent there is pointed at the
 * school's own sign-in.
 */
const mocks = vi.hoisted(() => ({
  auth: { notAParent: false },
  login: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
  dispatch: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: mocks.auth }),
}));
vi.mock("@/redux/services/portal-api", () => ({
  useLoginMutation: () => [mocks.login, { isLoading: false }],
  useLogoutMutation: () => [mocks.logout],
  useLazyMeQuery: () => [mocks.fetchMe],
}));
vi.mock("@/lib/use-school-name", () => ({ useSchoolName: () => "Lagoon View Academy" }));
vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => "lagoon-view" }));
vi.mock("@/utils/school-brand", () => ({ schoolLogoUrl: () => "" }));
vi.mock("@/components/school-mark", () => ({ SchoolMark: () => <span>School crest</span> }));
vi.mock("react-router", async (actual) => ({
  ...(await actual<typeof import("react-router")>()),
  useNavigate: () => mocks.navigate,
}));

import SignInPage from "./sign-in";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

const unwrapped = (value: unknown, ok = true) => ({
  unwrap: () => (ok ? Promise.resolve(value) : Promise.reject(value)),
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.auth = { notAParent: false };
  for (const fn of [mocks.login, mocks.logout, mocks.fetchMe, mocks.dispatch, mocks.navigate]) fn.mockReset();
  mocks.logout.mockReturnValue(unwrapped({}));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () => act(() => root.render(<MemoryRouter><SignInPage /></MemoryRouter>));

const type = (name: string, value: string) => {
  const input = container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const submit = () =>
  act(async () => {
    (container.querySelector("form") as HTMLFormElement).requestSubmit();
  });

describe("parent sign-in", () => {
  it("welcomes the parent in the school's name, once", () => {
    render();
    expect(container.querySelector(".signin-school-name")?.textContent).toBe("Lagoon View Academy");
    expect(container.textContent?.match(/Lagoon View Academy/g)).toHaveLength(1);
    expect(container.querySelector("h2")?.textContent).toBe("Sign in to your school");
  });

  it("reveals the password and hides it again", () => {
    render();
    const input = container.querySelector('input[name="password"]') as HTMLInputElement;
    expect(input.type).toBe("password");
    act(() => (container.querySelector('button[aria-label="Show password"]') as HTMLButtonElement).click());
    expect(input.type).toBe("text");
    act(() => (container.querySelector('button[aria-label="Hide password"]') as HTMLButtonElement).click());
    expect(input.type).toBe("password");
  });

  it("asks for both details before trying", async () => {
    render();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Enter the email the school invited you with, and your password.",
    );
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("shows the school's refusal and clears the password", async () => {
    mocks.login.mockReturnValue(unwrapped({ status: 401, data: { message: "Invalid credentials." } }, false));
    render();
    type("email", "Patricia.Okafor@example.ng");
    type("password", "wrong-pass-1");
    await submit();
    expect(mocks.login).toHaveBeenCalledWith({ email: "patricia.okafor@example.ng", password: "wrong-pass-1" });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Invalid credentials.");
    expect((container.querySelector('input[name="password"]') as HTMLInputElement).value).toBe("");
  });

  it("opens the parent's home once the school knows her as a parent", async () => {
    mocks.login.mockReturnValue(unwrapped({ data: { tenant: { kind: "SCHOOL" } } }));
    mocks.fetchMe.mockReturnValue(unwrapped({}));
    render();
    type("email", "patricia.okafor@example.ng");
    type("password", "Parent@School2026");
    await submit();
    expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("points a member of staff who is no parent here at the school's own sign-in", () => {
    mocks.auth = { notAParent: true };
    render();
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("This account is not a parent at this school.");
    expect(alert?.querySelector("a")?.getAttribute("href")).toBe("/accounts");
  });
});

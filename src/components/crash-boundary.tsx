import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** What shows in place of the children once they have crashed. `retry` draws them again. */
  fallback: (retry: () => void) => ReactNode;
  /** A change of this (the address, in the shell) draws the children again. */
  resetKey?: unknown;
};

/**
 * Catches a screen that throws while it draws, so a bug in one screen shows
 * an error page instead of a blank white app.
 *
 * The app has two: one around everything (`main.tsx`), and one around the
 * screen inside the shell, keyed by the address, so the tab bar stays and a
 * tap on another tab leaves the broken screen behind. student-fe and
 * parent-fe keep the same file; keep the two in step.
 */
export class CrashBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // React itself logs the error to the console, so it is not logged here again.
  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  retry = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}

import { useEffect, useState } from "react";

import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import { parentApi, type Deposit } from "@/redux/services/portal-api";

import { browserEnvironment, DepositWatcher } from "./deposit-watcher";

let shared: DepositWatcher | null = null;

/** The one watcher the whole app uses, so its single timer serves every screen. */
function sharedWatcher(): DepositWatcher {
  if (!shared) {
    shared = new DepositWatcher({
      environment: browserEnvironment,
      fetchDeposits: async () => [],
      onBooked: () => undefined,
    });
  }
  return shared;
}

/** Forgets the shared watcher; each test starts without the last one's children. */
export function _resetDepositWatcherForTests(): void {
  shared?.dispose();
  shared = null;
}

/** Asks about every watched child's transfers now, for example when a "Payment received" notice arrives. */
export function refreshDepositWatch(): void {
  shared?.refresh();
}

/**
 * The transfers into one child's account since `since`, kept current while the
 * screen is showing. Pass `null` for either until the account is known; nothing
 * is asked until both are.
 *
 * When a transfer is first seen booked, the fees, payments and home reads are
 * marked stale so balances and receipts catch up at once.
 */
export function useDepositWatch(childId: number | null, since: string | null): Deposit[] {
  const dispatch = useAppDispatch();
  const [state, setState] = useState<{ key: string; deposits: Deposit[] }>({ key: "", deposits: [] });
  const key = childId !== null && since !== null ? `${childId}@${since}` : "";

  useEffect(() => {
    const watcher = sharedWatcher();
    watcher.fetchDeposits = async (id, from) => {
      const answer = await dispatch(
        parentApi.endpoints.childDeposits.initiate(
          { childId: id, since: from },
          { forceRefetch: true, subscribe: false },
        ),
      ).unwrap();
      return answer.deposits;
    };
    watcher.onBooked = () => {
      dispatch(baseApi.util.invalidateTags(["Fees", "Me", "Payments"]));
    };
  }, [dispatch]);

  useEffect(() => {
    if (childId === null || since === null) return;
    return sharedWatcher().watch(childId, since, (deposits) => setState({ key, deposits }));
  }, [childId, since, key]);

  return state.key === key ? state.deposits : [];
}

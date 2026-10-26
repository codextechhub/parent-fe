import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";

import { setPushChoice } from "@/push/push-choice";
import { sessionEnded } from "@/redux/features/auth-slice";
import { baseApi } from "@/redux/services/base-api";

import { clearAccount, getAccount } from "./device-account";
import { forgetCredential } from "./device-credential";
import { markSessionInvalidated } from "./refresh";

type Dispatch = ThunkDispatch<unknown, unknown, UnknownAction>;

/**
 * Takes the parent off this device after their account was closed.
 *
 * The API has already ended the sign-in, so nothing is sent to it: the access
 * token, the stored account key and (in the store app) the credential in
 * secure storage are discarded, along with the notification choice and every
 * read the store holds. A fresh sign-in starts from nothing.
 */
export const leaveAfterClosure = () => async (dispatch: Dispatch): Promise<void> => {
  markSessionInvalidated();
  const account = await getAccount();
  await clearAccount();
  if (account) await forgetCredential(account);
  setPushChoice(null);
  dispatch(sessionEnded());
  dispatch(baseApi.util.resetApiState());
};

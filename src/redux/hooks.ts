import { useDispatch, useSelector } from "react-redux";

import type { AppDispatch, RootState } from "./store";

/** The store's dispatch, typed for its thunks. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
/** A typed selector over the store's state. */
export const useAppSelector = useSelector.withTypes<RootState>();

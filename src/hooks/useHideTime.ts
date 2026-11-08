import { useSyncExternalStore } from "react";
import { hideTimeStore } from "../lib/hideTime";

export function useHideTime(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(hideTimeStore.subscribe, hideTimeStore.get), hideTimeStore.set];
}

import { useSyncExternalStore } from "react";
import { showTriggersStore } from "../lib/showTriggers";

export function useShowTriggers(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(showTriggersStore.subscribe, showTriggersStore.get), showTriggersStore.set];
}

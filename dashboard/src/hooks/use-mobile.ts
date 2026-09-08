import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/*
 * Version useSyncExternalStore du hook shadcn : la règle react-hooks de
 * eslint-config-next 16 refuse un setState synchrone dans un useEffect.
 * matchMedia est une source externe, c'est exactement le cas prévu par ce hook.
 * Côté serveur (pas de window), on renvoie false.
 */
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

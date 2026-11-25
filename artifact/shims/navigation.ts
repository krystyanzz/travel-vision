import { useMemo } from "react";
import { navigate, useRoute } from "../router";

export function usePathname(): string {
  return useRoute().path;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useRoute();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useRouter() {
  return { push: navigate, replace: navigate };
}

import { useState, useEffect, useCallback } from "react";

export function useNavigation() {
  const [pathname, setPathname] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname || "/";
    }
    return "/";
  });

  const [search, setSearch] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.location.search || "";
    }
    return "";
  });

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname || "/");
      setSearch(window.location.search || "");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (typeof window !== "undefined") {
      const currentFull = (window.location.pathname || "/") + (window.location.search || "");
      if (currentFull !== to) {
        window.history.pushState({}, "", to);
        setPathname(window.location.pathname || "/");
        setSearch(window.location.search || "");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, []);

  return { pathname, search, navigate };
}

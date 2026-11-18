import { createContext, useContext, useEffect, useState } from "react";
import { refresh, acceptSession, logout, request } from "./api.js";
export const Auth = createContext(null);
export const Business = createContext(null);
export function Providers({ children }) {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [business, setBusiness] = useState(null);
  useEffect(() => {
    let alive = true;
    const update = (event) => {
      if (alive) setSession(event.detail);
    };
    window.addEventListener("salon-session", update);
    refresh()
      .catch(() => null)
      .finally(() => {
        if (alive) setLoading(false);
      });
    request("/public/settings")
      .then((value) => {
        if (alive) setBusiness(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
      window.removeEventListener("salon-session", update);
    };
  }, []);
  return (
    <Auth.Provider
      value={{
        session,
        loading,
        setSession: (value) => (value ? acceptSession(value) : logout()),
        reloadBusiness: () => request("/public/settings").then(setBusiness),
      }}
    >
      <Business.Provider value={business}>{children}</Business.Provider>
    </Auth.Provider>
  );
}
export const useAuth = () => useContext(Auth);
export const useBusiness = () => useContext(Business);
export function useData(path) {
  const auth = useContext(Auth);
  const identity = auth?.session?.user.id || "public";
  const key = identity + ":" + path;
  const [state, setState] = useState({
    key: null,
    data: null,
    loading: true,
    error: "",
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    request(path)
      .then((data) => {
        if (alive) setState({ key, data, loading: false, error: "" });
      })
      .catch((error) => {
        if (alive)
          setState({ key, data: null, loading: false, error: error.message });
      });
    return () => {
      alive = false;
    };
  }, [path, key, version]);
  // Never display a prior professional's data or options while a new scope is loading.
  const current =
    state.key === key ? state : { data: null, loading: true, error: "" };
  return { ...current, reload: () => setVersion((v) => v + 1) };
}

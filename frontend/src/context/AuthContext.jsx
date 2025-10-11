
import { createContext, useState, useEffect } from "react";

function decodeJwtPayload(jwt) {
  try {
    const base64 = jwt.split(".")[1];
    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    if (token) {
      const payload = decodeJwtPayload(token);
      setUser(payload);
    } else {
      setUser(null);
    }
  }, [token]);

  const login = (jwt) => {
    localStorage.setItem("token", jwt);
    setToken(jwt);
    const payload = decodeJwtPayload(jwt);
    setUser(payload);
  };
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
    const basePath =
      (typeof import.meta !== "undefined" && import.meta.env.BASE_URL) || "/";
    const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;
    window.location.href = normalizedBasePath;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

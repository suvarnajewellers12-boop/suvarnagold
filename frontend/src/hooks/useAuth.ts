import { useEffect, useState } from "react";

interface User {
  id: string;
  username: string;
  role: "SUPER_ADMIN" | "ADMIN";
  [key: string]: any;
}

function decodeJwt(token: string): User | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded as User;
  } catch {
    return null;
  }
}

export function useAuth() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("token");
      return t ? decodeJwt(t) : null;
    }
    return null;
  });
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const verifyAuth = () => {
    if (!token) {
      setIsAuthenticated(false);
      setIsAuthChecking(false);
      window.location.href = "/auth/login";
      return;
    }

    const decoded = decodeJwt(token);
    setCurrentUser(decoded);
    setIsAuthenticated(true);
    setIsAuthChecking(false);
  };

  useEffect(() => {
    verifyAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    setIsAuthenticated(false);
    window.location.href = "/auth/login";
  };

  return {
    currentUser,
    isAuthChecking,
    isAuthenticated,
    token,
    logout,
  };
}

import { createContext, useContext, useState, useCallback } from 'react';
import client from '../api/client';

/** Decode a single claim from a JWT without a library. */
function parseJwtClaim(token, claim) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload[claim];
  } catch {
    return undefined;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = sessionStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    const { token, user: userData } = data;

    // Check is_admin from response body OR JWT payload
    const isAdmin = userData.is_admin || parseJwtClaim(token, 'is_admin');
    if (!isAdmin) {
      throw new Error('Access denied. Admin privileges required.');
    }

    userData.is_admin = true;
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

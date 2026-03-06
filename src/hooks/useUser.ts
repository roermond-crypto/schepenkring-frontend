"use client";

import { useState, useEffect } from 'react';
import Cookies from "js-cookie";

export interface User {
  id: string;
  name: string;
  email: string;
  role: {
    id: string;
    name: string;
  };
  [key: string]: any;
}

function decodeSession(value: string): User | null {
  try {
    const parsed = JSON.parse(atob(value.replace(/-/g, "+").replace(/_/g, "/")));
    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      role: { id: "1", name: parsed.role },
    };
  } catch {
    return null;
  }
}

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = () => {
      try {
        const sessionCookie = Cookies.get("schepenkring_session");
        setUser(sessionCookie ? decodeSession(sessionCookie) : null);
      } catch (error) {
        console.error('Error loading user data:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();

    const userCheckInterval = setInterval(loadUser, 1000);
    const clearTimer = setTimeout(() => clearInterval(userCheckInterval), 10000);

    return () => {
      clearInterval(userCheckInterval);
      clearTimeout(clearTimer);
    };
  }, []);

  return {
    user,
    isLoading,
    userType: user?.role?.name || 'client',
    isAuthenticated: !!user,
  };
};

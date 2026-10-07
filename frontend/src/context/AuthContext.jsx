import React, { createContext, useContext, useState } from "react";
import api, { errMsg } from "../api/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("userInfo")) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const save = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("userInfo", JSON.stringify(data));
    setUser(data);
  };

  const authCall = async (path, payload) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post(path, payload);
      save(data);
      return data;
    } catch (err) {
      const message = errMsg(err, "Request failed. Please try again.");
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const login = (email, password) => authCall("/auth/login", { email, password });
  const register = (payload) => authCall("/auth/register", payload);
  const updateUser = (patch) => {
    setUser((u) => {
      const next = { ...u, ...patch };
      localStorage.setItem("userInfo", JSON.stringify(next));
      return next;
    });
  };
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userInfo");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, loading, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

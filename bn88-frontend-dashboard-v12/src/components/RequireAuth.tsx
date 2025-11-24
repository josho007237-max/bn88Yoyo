// src/components/RequireAuth.tsx (ย่อ)
import { Navigate, Outlet } from "react-router-dom";
export default function RequireAuth() {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("BN9_TOKEN") : null;
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

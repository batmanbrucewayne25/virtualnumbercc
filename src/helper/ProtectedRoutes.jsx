import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "@/utils/auth";

const ProtectedRoutes = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/sign-in" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoutes;

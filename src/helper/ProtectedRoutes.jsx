import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated, isAdminSession } from "@/utils/auth";
import { getApiBaseUrl } from "@/utils/apiUrl.js";

const ProtectedRoutes = () => {
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);
  const [inMaintenance, setInMaintenance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/reseller/maintenance-mode`);
        if (!res.ok) {
          if (!cancelled) setMaintenanceChecked(true);
          return;
        }
        const json = await res.json();
        if (!cancelled && json.success && json.data && typeof json.data.maintenanceMode === "boolean") {
          setInMaintenance(json.data.maintenanceMode === true);
        }
      } catch {
        /* ignore — allow access if API unreachable */
      } finally {
        if (!cancelled) setMaintenanceChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!maintenanceChecked) {
    return (
      <div className="d-flex justify-content-center align-items-center py-40">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (inMaintenance && !isAdminSession()) {
    return <Navigate to="/maintenance" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoutes;

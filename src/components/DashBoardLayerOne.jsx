import SalesStatisticOne from "./child/SalesStatisticOne";
import TotalSubscriberOne from "./child/TotalSubscriberOne";
import UsersOverviewOne from "./child/UsersOverviewOne";
import LatestRegisteredOne from "./child/LatestRegisteredOne";
import TopPerformerOne from "./child/TopPerformerOne";
import TopCountries from "./child/TopCountries";
import GeneratedContent from "./child/GeneratedContent";
import UnitCountOne from "./child/UnitCountOne";
import ResellerPaymentsLayer from "./ResellerPaymentsLayer";
import { getUserData, getAuthToken } from "@/utils/auth";
import { useState, useEffect } from "react";

const DashBoardLayerOne = () => {
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
  }, []);

  const isSuperAdmin = userRole === 'admin' || userRole === 'super_admin';

  return (
    <>
      {/* UnitCountOne */}
      <UnitCountOne />

      {/* Reseller Payments - Super Admin Only */}
      {isSuperAdmin && (
        <div className="mt-24">
          <ResellerPaymentsLayer />
        </div>
      )}

      <section className='row gy-4 mt-1'>
        {/* SalesStatisticOne */}
        <SalesStatisticOne />

        {/* TotalSubscriberOne */}
        <TotalSubscriberOne />

        {/* UsersOverviewOne */}
        <UsersOverviewOne />

        {/* LatestRegisteredOne */}
        <LatestRegisteredOne />

        {/* TopPerformerOne */}
        <TopPerformerOne />

        {/* TopCountries */}
        <TopCountries />

        {/* GeneratedContent */}
        <GeneratedContent />
      </section>
    </>
  );
};

export default DashBoardLayerOne;

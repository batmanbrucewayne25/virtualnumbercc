import { useState, useEffect } from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ResellerDashboardLayer from "../components/ResellerDashboardLayer";
import { getUserData } from "../utils/auth";
import { graphqlRequest } from "../hasura";

const ResellerDashboardPage = () => {
  const [expiryDate, setExpiryDate] = useState(null);

  useEffect(() => {
    const fetchExpiryDate = async () => {
      try {
        const userData = getUserData();
        console.log(userData , userData.id , userData.role === "reseller");

        if (userData && userData.id) {
          const QUERY = `query GetResellerWithValidity($id: uuid!) {
            mst_reseller_by_pk(id: $id) {
              id
              mst_reseller_validity {
                validity_end_date
              }
            }
          }`;

          const result = await graphqlRequest(QUERY, { id: userData.id });
          console.log(result.data.mst_reseller_by_pk.mst_reseller_validity.validity_end_date, 'result');
          if (result?.data?.mst_reseller_by_pk?.mst_reseller_validity) {
            setExpiryDate(result.data.mst_reseller_by_pk.mst_reseller_validity?.validity_end_date);
          }
        }
      } catch (err) {
        console.error("Error fetching expiry date:", err);
      }
    };

    fetchExpiryDate();
  }, []);

  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Dashboard' expiryDate={expiryDate} />

        {/* ResellerDashboardLayer */}
        <ResellerDashboardLayer />
      </MasterLayout>
    </>
  );
};

export default ResellerDashboardPage;


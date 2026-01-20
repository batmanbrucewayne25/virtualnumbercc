import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ResellerDashboardLayer from "../components/ResellerDashboardLayer";

const ResellerDashboardPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Dashboard' />

        {/* ResellerDashboardLayer */}
        <ResellerDashboardLayer />
      </MasterLayout>
    </>
  );
};

export default ResellerDashboardPage;


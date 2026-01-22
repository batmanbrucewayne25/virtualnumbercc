import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ViewResellerDashboardLayer from "../components/ViewResellerDashboardLayer";

const ViewResellerPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Reseller Dashboard' />

        {/* ViewResellerDashboardLayer */}
        <ViewResellerDashboardLayer />
      </MasterLayout>
    </>
  );
};

export default ViewResellerPage;

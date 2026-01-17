import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ViewResellerLayer from "../components/ViewResellerLayer";

const ViewResellerPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='View Reseller' />

        {/* ViewResellerLayer */}
        <ViewResellerLayer />
      </MasterLayout>
    </>
  );
};

export default ViewResellerPage;

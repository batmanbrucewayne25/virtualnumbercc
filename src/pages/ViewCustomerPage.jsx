import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ViewCustomerLayer from "../components/ViewCustomerLayer";

const ViewCustomerPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='View Customer' />

        {/* ViewCustomerLayer */}
        <ViewCustomerLayer />
      </MasterLayout>
    </>
  );
};

export default ViewCustomerPage;


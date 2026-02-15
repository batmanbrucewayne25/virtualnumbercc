import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import CustomerListLayer from "../components/CustomerListLayer";

const CustomerListPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='New Customers' />

        {/* CustomerListLayer */}
        <CustomerListLayer />
      </MasterLayout>
    </>
  );
};

export default CustomerListPage;


import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import AllowedCustomersLayer from "../components/AllowedCustomersLayer";

const AllowedCustomersPage = () => {
  return (
    <>
      <MasterLayout>
        <Breadcrumb title="Allowed Customers" />
        <AllowedCustomersLayer />
      </MasterLayout>
    </>
  );
};

export default AllowedCustomersPage;

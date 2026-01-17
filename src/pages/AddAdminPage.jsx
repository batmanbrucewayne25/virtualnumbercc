import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import AddAdminLayer from "../components/AddAdminLayer";

const AddAdminPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Add Admin' />

        {/* AddAdminLayer */}
        <AddAdminLayer />
      </MasterLayout>
    </>
  );
};

export default AddAdminPage;

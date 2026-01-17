import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import EditAdminLayer from "../components/EditAdminLayer";

const EditAdminPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Edit Admin' />

        {/* EditAdminLayer */}
        <EditAdminLayer />
      </MasterLayout>
    </>
  );
};

export default EditAdminPage;

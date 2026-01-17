import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ViewAdminLayer from "../components/ViewAdminLayer";

const ViewAdminPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='View Admin' />

        {/* ViewAdminLayer */}
        <ViewAdminLayer />
      </MasterLayout>
    </>
  );
};

export default ViewAdminPage;

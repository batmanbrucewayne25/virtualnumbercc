import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ViewUserLayer from "../components/ViewUserLayer";

const ViewUserPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='View User' />

        {/* ViewUserLayer */}
        <ViewUserLayer />
      </MasterLayout>
    </>
  );
};

export default ViewUserPage;


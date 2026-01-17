import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import EditResellerLayer from "../components/EditResellerLayer";

const EditResellerPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Edit Reseller' />

        {/* EditResellerLayer */}
        <EditResellerLayer />
      </MasterLayout>
    </>
  );
};

export default EditResellerPage;

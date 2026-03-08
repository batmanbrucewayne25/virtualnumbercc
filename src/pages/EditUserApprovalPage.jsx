import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import EditUserApprovalLayer from "../components/EditUserApprovalLayer";

const EditUserApprovalPage = () => {
  return (
    <>
      <MasterLayout>
        <Breadcrumb title="Edit Customer Profile" />
        <EditUserApprovalLayer />
      </MasterLayout>
    </>
  );
};

export default EditUserApprovalPage;

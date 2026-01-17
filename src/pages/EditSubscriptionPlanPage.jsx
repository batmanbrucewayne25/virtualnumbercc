import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import EditSubscriptionPlanLayer from "../components/EditSubscriptionPlanLayer";

const EditSubscriptionPlanPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Edit Subscription Plan' />

        {/* EditSubscriptionPlanLayer */}
        <EditSubscriptionPlanLayer />
      </MasterLayout>
    </>
  );
};

export default EditSubscriptionPlanPage;

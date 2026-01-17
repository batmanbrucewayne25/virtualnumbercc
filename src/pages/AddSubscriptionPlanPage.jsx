import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import AddSubscriptionPlanLayer from "../components/AddSubscriptionPlanLayer";

const AddSubscriptionPlanPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Add Subscription Plan' />

        {/* AddSubscriptionPlanLayer */}
        <AddSubscriptionPlanLayer />
      </MasterLayout>
    </>
  );
};

export default AddSubscriptionPlanPage;

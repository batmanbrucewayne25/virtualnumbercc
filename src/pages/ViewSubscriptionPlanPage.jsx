import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ViewSubscriptionPlanLayer from "../components/ViewSubscriptionPlanLayer";

const ViewSubscriptionPlanPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='View Subscription Plan' />

        {/* ViewSubscriptionPlanLayer */}
        <ViewSubscriptionPlanLayer />
      </MasterLayout>
    </>
  );
};

export default ViewSubscriptionPlanPage;

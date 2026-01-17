import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import SubscriptionPlanListLayer from "../components/SubscriptionPlanListLayer";

const SubscriptionPlanListPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Subscription Plans' />

        {/* SubscriptionPlanListLayer */}
        <SubscriptionPlanListLayer />
      </MasterLayout>
    </>
  );
};

export default SubscriptionPlanListPage;

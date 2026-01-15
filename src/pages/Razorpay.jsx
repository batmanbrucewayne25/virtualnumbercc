import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import Razorpay from "../components/Razorpay";

const NotificationPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='RazorPay Subscription Creation' />

        <Razorpay />
      </MasterLayout>
    </>
  );
};

export default NotificationPage;

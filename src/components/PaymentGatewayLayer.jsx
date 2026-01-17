import Paypal from "./child/Paypal";
import RazorpayPlanAdminStatic from "./Razorpay";

const PaymentGatewayLayer = () => {
  return (
    <div className='row gy-4'>
      {/* Paypal */}
      {/* <Paypal /> */}

      {/* RazorPay - Using database-connected component */}
      <div className='col-12'>
        <RazorpayPlanAdminStatic />
      </div>
    </div>
  );
};

export default PaymentGatewayLayer;

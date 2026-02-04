import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import SignUpLayer from "../pages/public/Signup/Index";

const AdminAddResellerPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Add New Reseller' />

        {/* Signup Layer with skipOtpVerification */}
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <SignUpLayer skipOtpVerification={true} />
            </div>
          </div>
        </div>
      </MasterLayout>
    </>
  );
};

export default AdminAddResellerPage;


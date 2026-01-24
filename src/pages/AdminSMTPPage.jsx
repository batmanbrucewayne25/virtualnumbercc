import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import AdminSMTPLayer from "../components/AdminSMTPLayer";

const AdminSMTPPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='SMTP Configuration' />

        {/* AdminSMTPLayer */}
        <AdminSMTPLayer />
      </MasterLayout>
    </>
  );
};

export default AdminSMTPPage;


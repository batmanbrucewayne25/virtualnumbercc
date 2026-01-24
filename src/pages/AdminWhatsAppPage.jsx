import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import AdminWhatsAppLayer from "../components/AdminWhatsAppLayer";

const AdminWhatsAppPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='WhatsApp Configuration' />

        {/* AdminWhatsAppLayer */}
        <AdminWhatsAppLayer />
      </MasterLayout>
    </>
  );
};

export default AdminWhatsAppPage;


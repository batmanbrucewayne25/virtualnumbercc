import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import AdminSmtpTemplateLayer from "../components/AdminSmtpTemplateLayer";

const AdminSmtpTemplatePage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='SMTP Template' />

        {/* AdminSmtpTemplateLayer */}
        <AdminSmtpTemplateLayer />
      </MasterLayout>
    </>
  );
};

export default AdminSmtpTemplatePage;


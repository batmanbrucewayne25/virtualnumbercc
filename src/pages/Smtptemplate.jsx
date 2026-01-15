import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import Smtptemplate from "../components/Smtptemplate";

const NotificationPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='SMTP Template' />

        <Smtptemplate />
      </MasterLayout>
    </>
  );
};

export default NotificationPage;

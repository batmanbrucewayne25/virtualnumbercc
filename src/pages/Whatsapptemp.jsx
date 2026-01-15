import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import Whatsapptemp from "../components/Whatsapptemp";

const NotificationPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='SMTP Template' />

        <Whatsapptemp />
      </MasterLayout>
    </>
  );
};

export default NotificationPage;

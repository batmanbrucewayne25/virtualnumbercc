import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import Whatsapplayer from "../components/Whatsapp";

const NotificationPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Settings - Notification' />

        <Whatsapplayer />
      </MasterLayout>
    </>
  );
};

export default NotificationPage;

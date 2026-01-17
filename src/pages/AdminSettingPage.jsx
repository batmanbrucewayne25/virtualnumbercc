import MasterLayout from "@/masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import AdminSettingLayer from "@/components/AdminSettingLayer";

const AdminSettingPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Admin Setting" />
      <AdminSettingLayer />
    </MasterLayout>
  );
};

export default AdminSettingPage;

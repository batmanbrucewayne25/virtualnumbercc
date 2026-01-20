import MasterLayout from "@/masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ChangePasswordLayer from "@/components/ChangePasswordLayer";

const ChangePasswordPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Reset Password" />
      <ChangePasswordLayer />
    </MasterLayout>
  );
};

export default ChangePasswordPage;


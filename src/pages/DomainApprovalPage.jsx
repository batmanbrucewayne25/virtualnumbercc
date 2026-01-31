import MasterLayout from "@/masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import DomainApprovalLayer from "@/components/DomainApprovalLayer";

const DomainApprovalPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Domain Approvals" />
      <DomainApprovalLayer />
    </MasterLayout>
  );
};

export default DomainApprovalPage;


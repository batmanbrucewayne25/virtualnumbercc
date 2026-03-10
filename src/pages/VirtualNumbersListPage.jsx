import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import VirtualNumbersListLayer from "../components/VirtualNumbersListLayer";

const VirtualNumbersListPage = () => {
  return (
    <>
      <MasterLayout>
        <Breadcrumb title="Virtual Numbers" />
        <VirtualNumbersListLayer />
      </MasterLayout>
    </>
  );
};

export default VirtualNumbersListPage;

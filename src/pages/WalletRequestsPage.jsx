import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import WalletRequestsLayer from "../components/WalletRequestsLayer";

const WalletRequestsPage = () => {
  return (
    <>
      <MasterLayout>
        <Breadcrumb title="Wallet Requests" />
        <WalletRequestsLayer />
      </MasterLayout>
    </>
  );
};

export default WalletRequestsPage;

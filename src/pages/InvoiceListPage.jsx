import { Navigate } from "react-router-dom";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import InvoiceListLayer from "../components/InvoiceListLayer";
import { getUserData } from "../utils/auth";


const InvoiceListPage = () => {
  const userData = getUserData();
  if (userData?.role === "reseller") {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <MasterLayout>
        <Breadcrumb title='Wallet Ledger' />
        <InvoiceListLayer />
      </MasterLayout>
    </>
  );
};

export default InvoiceListPage;

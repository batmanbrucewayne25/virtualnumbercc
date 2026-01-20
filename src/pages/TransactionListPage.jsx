import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import TransactionListLayer from "../components/TransactionListLayer";

const TransactionListPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Transactions' />

        {/* TransactionListLayer */}
        <TransactionListLayer />
      </MasterLayout>
    </>
  );
};

export default TransactionListPage;


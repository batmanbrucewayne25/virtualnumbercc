import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ResellerListLayer from "../components/ResellerListLayer";

const ResellerListPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Reseller List' />

        {/* ResellerListLayer */}
        <ResellerListLayer />
      </MasterLayout>
    </>
  );
};

export default ResellerListPage;

import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import AdminListLayer from "../components/AdminListLayer";

const AdminListPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Admin List' />

        {/* AdminListLayer */}
        <AdminListLayer />
      </MasterLayout>
    </>
  );
};

export default AdminListPage;

import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import CustomDomainSettingsLayer from "../components/CustomDomainSettingsLayer";

const CustomDomainSettingsPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>
        {/* Breadcrumb */}
        <Breadcrumb title='Custom Domain' />

        {/* CustomDomainSettingsLayer */}
        <CustomDomainSettingsLayer />
      </MasterLayout>
    </>
  );
};

export default CustomDomainSettingsPage;


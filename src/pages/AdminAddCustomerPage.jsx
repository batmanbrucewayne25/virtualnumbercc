import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ClientHubLayer from "../pages/public/ClientHub/Index";
import { useState, useEffect } from "react";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getUserData, getAuthToken } from "@/utils/auth";

const AdminAddCustomerPage = () => {
  const [resellers, setResellers] = useState([]);
  const [selectedResellerId, setSelectedResellerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState(null);
  const [isReseller, setIsReseller] = useState(false);

  useEffect(() => {
    // Check if user is reseller or admin
    const token = getAuthToken();
    const userData = getUserData();
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload.role || userData?.role;
        setUserRole(role);
        setIsReseller(role === 'reseller');
        
        // If reseller, use their own ID directly
        if (role === 'reseller' && userData?.id) {
          setSelectedResellerId(userData.id);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    
    // Only fetch resellers if admin
    if (userRole === 'admin' || userRole === 'super_admin' || !userRole) {
      fetchResellers();
    }
  }, [userRole]);

  const fetchResellers = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMstResellers();
      if (result.success) {
        // Filter only active resellers
        const activeResellers = (result.data || []).filter((r) => r.status && !r.suspended_at);
        setResellers(activeResellers);
      } else {
        setError("Failed to load resellers");
      }
    } catch (err) {
      console.error("Error fetching resellers:", err);
      setError("An error occurred while loading resellers");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MasterLayout>
        <Breadcrumb title='Add New Customer' />
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="card h-100 p-24">
                <div className="text-center py-40">
                  <p>Loading resellers...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MasterLayout>
    );
  }

  if (error) {
    return (
      <MasterLayout>
        <Breadcrumb title='Add New Customer' />
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="card h-100 p-24">
                <div className="alert alert-danger">{error}</div>
              </div>
            </div>
          </div>
        </div>
      </MasterLayout>
    );
  }

  // Show reseller selector if admin and not selected yet (resellers skip this)
  if (!selectedResellerId && !isReseller) {
    return (
      <MasterLayout>
        <Breadcrumb title='Add New Customer' />
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="card h-100 p-24">
                <h4 className="mb-24">Select Reseller</h4>
                <p className="text-sm text-secondary-light mb-24">
                  Please select the reseller for this customer
                </p>
                <div className="mb-24">
                  <label className="form-label text-sm mb-8">
                    Reseller <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select h-56-px"
                    value={selectedResellerId || ""}
                    onChange={(e) => setSelectedResellerId(e.target.value)}
                  >
                    <option value="">Select a reseller</option>
                    {resellers.map((reseller) => (
                      <option key={reseller.id} value={reseller.id}>
                        {reseller.business_name || `${reseller.first_name} ${reseller.last_name}`.trim()} ({reseller.email})
                      </option>
                    ))}
                  </select>
                </div>
                {resellers.length === 0 && (
                  <div className="alert alert-warning">
                    No active resellers found. Please create a reseller first.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </MasterLayout>
    );
  }

  // Show ClientHub with skipOtpVerification and selected resellerId
  return (
    <MasterLayout>
      <Breadcrumb title='Add New Customer' />
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <ClientHubLayer 
              skipOtpVerification={true} 
              resellerId={selectedResellerId}
              isAdminMode={true}
            />
          </div>
        </div>
      </div>
    </MasterLayout>
  );
};

export default AdminAddCustomerPage;


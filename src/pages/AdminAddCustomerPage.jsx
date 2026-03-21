import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ClientHubLayer from "../pages/public/ClientHub/Index";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getUserData, getAuthToken } from "@/utils/auth";

/** Only admin / super_admin may add customers via this flow (resellers cannot). */
const AdminAddCustomerPage = () => {
  const [resellers, setResellers] = useState([]);
  const [selectedResellerId, setSelectedResellerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    const userData = getUserData();

    if (!token) {
      setIsAdminUser(false);
      setRoleChecked(true);
      setLoading(false);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const role = payload.role || userData?.role;
      setIsAdminUser(role === "admin" || role === "super_admin");
    } catch (err) {
      console.error("Error decoding token:", err);
      setIsAdminUser(false);
    } finally {
      setRoleChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!roleChecked || !isAdminUser) {
      if (roleChecked && !isAdminUser) setLoading(false);
      return;
    }

    const fetchResellers = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getMstResellers();
        if (result.success) {
          const activeResellers = (result.data || []).filter(
            (r) => r.status && !r.suspended_at
          );
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

    fetchResellers();
  }, [roleChecked, isAdminUser]);

  if (!roleChecked) {
    return (
      <MasterLayout>
        <Breadcrumb title="Add New Customer" />
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="card h-100 p-24">
                <div className="text-center py-40">
                  <p>Loading...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MasterLayout>
    );
  }

  if (!isAdminUser) {
    return <Navigate to="/users-list" replace />;
  }

  if (loading) {
    return (
      <MasterLayout>
        <Breadcrumb title="Add New Customer" />
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
        <Breadcrumb title="Add New Customer" />
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

  // Super admin: select reseller first
  if (!selectedResellerId) {
    return (
      <MasterLayout>
        <Breadcrumb title="Add New Customer" />
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
                        {reseller.business_name ||
                          `${reseller.first_name} ${reseller.last_name}`.trim()}{" "}
                        ({reseller.email})
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

  return (
    <MasterLayout>
      <Breadcrumb title="Add New Customer" />
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

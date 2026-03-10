import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstVirtualNumbers } from "@/hasura/mutations/virtualNumber";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getUserData } from "@/utils/auth";
import { formatDateIST } from "@/utils/dateUtils";

const VirtualNumbersListLayer = () => {
  const [virtualNumbers, setVirtualNumbers] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [resellerFilter, setResellerFilter] = useState("all");

  useEffect(() => {
    fetchResellers();
  }, []);

  useEffect(() => {
    fetchVirtualNumbers();
  }, [resellerFilter]);

  const fetchResellers = async () => {
    try {
      const result = await getMstResellers();
      if (result.success) {
        setResellers(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching resellers:", err);
    }
  };

  const fetchVirtualNumbers = async () => {
    setLoading(true);
    setError("");
    try {
      const userData = getUserData();
      const filters = {};

      // Admin sees all; reseller sees only their numbers
      if (userData?.role === "reseller" && userData?.id) {
        filters.resellerId = userData.id;
      } else if (resellerFilter && resellerFilter !== "all") {
        filters.resellerId = resellerFilter;
      }

      const result = await getMstVirtualNumbers(filters);
      if (result.success) {
        setVirtualNumbers(result.data || []);
      } else {
        setError(result.message || "Failed to load virtual numbers");
      }
    } catch (err) {
      console.error("Error fetching virtual numbers:", err);
      setError("An error occurred while loading virtual numbers");
    } finally {
      setLoading(false);
    }
  };

  const getResellerDisplayName = (reseller) => {
    if (!reseller) return "-";
    return (
      reseller.brand_name ||
      reseller.business_name ||
      [reseller.first_name, reseller.last_name].filter(Boolean).join(" ") ||
      reseller.email ||
      "-"
    );
  };

  const getCustomerDisplayName = (customer) => {
    if (!customer) return "-";
    return customer.profile_name || customer.email || "-";
  };

  const formatDate = formatDateIST;

  const getDaysLeft = (expiryDateStr) => {
    if (!expiryDateStr) return "-";
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const diffMs = expiry - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 0 : diffDays;
  };

  // Filter by search (client-side for virtual number, customer, call forwarding, reseller)
  const filteredVirtualNumbers = virtualNumbers.filter((vn) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const vnNum = (vn.virtual_number || "").toLowerCase();
    const callFwd = (vn.call_forwarding_number || "").toLowerCase();
    const customerName = getCustomerDisplayName(vn.mst_customer).toLowerCase();
    const customerEmail = (vn.mst_customer?.email || "").toLowerCase();
    const resellerName = getResellerDisplayName(vn.mst_reseller).toLowerCase();
    const resellerEmail = (vn.mst_reseller?.email || "").toLowerCase();
    return (
      vnNum.includes(term) ||
      callFwd.includes(term) ||
      customerName.includes(term) ||
      customerEmail.includes(term) ||
      resellerName.includes(term) ||
      resellerEmail.includes(term)
    );
  });

  const uniqueResellerIds = [...new Set(virtualNumbers.map((vn) => vn.mst_reseller?.id).filter(Boolean))];
  const resellerCount = uniqueResellerIds.length;

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
        <div className="d-flex align-items-center flex-wrap gap-3">
          <form className="navbar-search">
            <input
              type="text"
              className="bg-base h-40-px w-auto"
              name="search"
              placeholder="Search by number, customer, reseller..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Icon icon="ion:search-outline" className="icon" />
          </form>
          {getUserData()?.role === "admin" && (
            <select
              className="form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px"
              value={resellerFilter}
              onChange={(e) => setResellerFilter(e.target.value)}
            >
              <option value="all">All Resellers</option>
              {resellers.map((r) => (
                <option key={r.id} value={r.id}>
                  {getResellerDisplayName(r)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="card-body p-24">
        {getUserData()?.role === "admin" && (
          <p className="text-muted small mb-3">
            {resellerFilter === "all"
              ? `Showing ${filteredVirtualNumbers.length} of ${virtualNumbers.length} virtual number(s) across ${resellerCount} reseller(s)`
              : `Showing ${filteredVirtualNumbers.length} of ${virtualNumbers.length} virtual number(s) of 1 reseller`}
          </p>
        )}
        {error && (
          <div className="alert alert-danger radius-8 mb-24" role="alert">
            <Icon icon="material-symbols:error-outline" className="icon me-2" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-40">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted mt-3">Loading virtual numbers...</p>
          </div>
        ) : filteredVirtualNumbers.length === 0 ? (
          <div className="text-center py-40">
            <Icon icon="mdi:phone-off" className="icon text-6xl text-muted mb-3" />
            <p className="text-muted">No virtual numbers found</p>
          </div>
        ) : (
          <div className="table-responsive scroll-sm">
            <table className="table bordered-table sm-table mb-0">
              <thead>
                <tr>
                  <th scope="col">S NO</th>
                  <th scope="col">Virtual Number</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Call Forwarding Num</th>
                  <th scope="col">Reseller Name</th>
                  <th scope="col">Exp Date</th>
                  <th scope="col">Count</th>
                </tr>
              </thead>
              <tbody>
                {filteredVirtualNumbers.map((vn, index) => (
                  <tr key={vn.id}>
                    <td>{index + 1}</td>
                    <td>
                      <span className="fw-medium">{vn.virtual_number || "-"}</span>
                    </td>
                    <td>
                      {vn.mst_customer ? (
                        <Link
                          to={`/view-customer/${vn.mst_customer.id}`}
                          className="text-decoration-none hover-text-primary"
                        >
                          {getCustomerDisplayName(vn.mst_customer)}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{vn.call_forwarding_number || "-"}</td>
                    <td>
                      {vn.mst_reseller ? (
                        <Link
                          to={`/view-reseller/${vn.mst_reseller.id}`}
                          className="text-decoration-none hover-text-primary"
                        >
                          {getResellerDisplayName(vn.mst_reseller)}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{formatDate(vn.expiry_date)}</td>
                    <td>{getDaysLeft(vn.expiry_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualNumbersListLayer;

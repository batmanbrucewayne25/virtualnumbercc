import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  getApprovedCustomersByReseller,
  getAllApprovedCustomers,
} from "@/hasura/mutations/user";
import { updateMstCustomer } from "@/hasura/mutations/customer";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getMaxVirtualNumbersForCustomer } from "@/hasura/mutations/numberLimits";
import { getUserData, getAuthToken } from "@/utils/auth";
import { formatDateIST } from "@/utils/dateUtils";
import { useResellerValidityGate } from "@/contexts/ResellerValidityGateContext";

// Simple JWT decode function (or use jwt-decode library if available)
const decodeJWT = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const UsersListLayer = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [resellers, setResellers] = useState([]);
  const [selectedResellerId, setSelectedResellerId] = useState("all");
  const [editPhoneModalOpen, setEditPhoneModalOpen] = useState(false);
  const [editPhoneCustomer, setEditPhoneCustomer] = useState(null);
  const [editPhoneValue, setEditPhoneValue] = useState("");
  const [editPhoneSaving, setEditPhoneSaving] = useState(false);
  const [editPhoneError, setEditPhoneError] = useState("");

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError("Please log in to view customers.");
      setLoading(false);
      return;
    }
    let role = null;
    try {
      const decoded = decodeJWT(token);
      if (decoded) {
        role = decoded.role;
        setUserRole(role);
        if (role === "admin" || role === "super_admin") {
          fetchResellers();
        }
      }
    } catch (err) {
      console.error("Error decoding token:", err);
      setLoading(false);
      return;
    }
    if (role == null) {
      setLoading(false);
      return;
    }
    // Pass role so first load uses decoded role immediately (avoids race with state update)
    fetchCustomers(role);
  }, [startDate, endDate, expiringSoon, userRole, selectedResellerId]);

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

  const fetchCustomers = async (roleOverride) => {
    setLoading(true);
    setError("");
    const effectiveRole = roleOverride !== undefined ? roleOverride : userRole;
    try {
      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        searchTerm: searchTerm || undefined,
        expiringSoon: expiringSoon || undefined,
      };

      let result;

      if (effectiveRole === "admin" || effectiveRole === "super_admin") {
        result = await getAllApprovedCustomers(filters);
      } else {
        const userData = getUserData();
        if (!userData || !userData.id) {
          setError("Unable to determine reseller ID. Please log in again.");
          setLoading(false);
          return;
        }
        result = await getApprovedCustomersByReseller(userData.id, filters);
      }

      if (result.success) {
        setCustomers(result.data || []);
      } else {
        setError("Failed to load customers");
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError("An error occurred while loading customers");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchCustomers();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setExpiringSoon(false);
    setSelectedResellerId("all");
  };

  const formatDate = formatDateIST;

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "₹0.00";
    return `₹${Number(amount).toFixed(2)}`;
  };

  const calculateDaysLeft = (expiryDate) => {
    if (!expiryDate) return "-";
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getCustomerName = (customer) => {
    return (
      customer.business_name ||
      customer.profile_name ||
      customer.pan_full_name ||
      customer.email ||
      "N/A"
    );
  };

  const getVirtualNumber = (customer) => {
    return customer.mst_virtual_numbers?.[0]?.virtual_number || "-";
  };

  const getCallForwardNumber = (customer) => {
    return customer.mst_virtual_numbers?.[0]?.call_forwarding_number || "-";
  };

  const getPurchaseDate = (customer) => {
    return customer.mst_virtual_numbers?.[0]?.purchase_date || "-";
  };

  const getExpiryDate = (customer) => {
    return customer.mst_virtual_numbers?.[0]?.expiry_date || "-";
  };

  const getPaymentMode = (customer) => {
    return customer.mst_transactions?.[0]?.payment_mode || "-";
  };

  const getAmount = (customer) => {
    return customer.mst_transactions?.[0]?.amount || 0;
  };

  const getDaysLeft = (customer) => {
    const expiryDate = customer.mst_virtual_numbers?.[0]?.expiry_date;
    if (!expiryDate) return "-";
    return calculateDaysLeft(expiryDate);
  };

  const getVirtualNumberCount = (customer) => {
    return customer.mst_virtual_numbers?.length || 0;
  };

  // Filter customers based on search term and reseller filter
  const filteredCustomers = customers.filter((customer) => {
    // Filter by reseller (for admins)
    if (
      (userRole === "admin" || userRole === "super_admin") &&
      selectedResellerId !== "all"
    ) {
      if (customer.reseller_id !== selectedResellerId) {
        return false;
      }
    }

    // Filter by search term (global: name, email, phone)
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase().trim();
    const searchPhone = searchTerm.replace(/\s/g, "");
    const name = getCustomerName(customer).toLowerCase();
    const email = (customer.email || "").toLowerCase();
    const phone = (customer.phone || "").replace(/\s/g, "");

    return (
      name.includes(searchLower) ||
      email.includes(searchLower) ||
      (searchPhone && phone.includes(searchPhone))
    );
  });

  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const isReseller = userRole === "reseller";
  const { loading: validityLoading, blocked: validityBlocked, reason: validityReason } =
    useResellerValidityGate();
  const resellerActionsDisabled =
    isReseller && !validityLoading && validityBlocked;

  const openEditPhoneModal = (customer) => {
    setEditPhoneCustomer(customer);
    setEditPhoneValue((customer.phone || "").replace(/\D/g, "").slice(0, 10));
    setEditPhoneError("");
    setEditPhoneModalOpen(true);
  };

  const closeEditPhoneModal = () => {
    if (editPhoneSaving) return;
    setEditPhoneModalOpen(false);
    setEditPhoneCustomer(null);
    setEditPhoneValue("");
    setEditPhoneError("");
  };

  const handleSaveCustomerPhone = async () => {
    if (!editPhoneCustomer?.id) return;
    const digits = editPhoneValue.replace(/\D/g, "").slice(0, 10);
    if (digits.length !== 10) {
      setEditPhoneError("Enter a valid 10-digit phone number.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setEditPhoneError("Phone must be 10 digits and start with 6–9.");
      return;
    }
    setEditPhoneSaving(true);
    setEditPhoneError("");
    try {
      const result = await updateMstCustomer(editPhoneCustomer.id, { phone: digits });
      if (result.success) {
        setEditPhoneModalOpen(false);
        setEditPhoneCustomer(null);
        setEditPhoneValue("");
        fetchCustomers();
      } else {
        setEditPhoneError(result.message || "Failed to update phone number.");
      }
    } catch (err) {
      console.error("Error updating phone:", err);
      setEditPhoneError(err?.message || "An error occurred while updating.");
    } finally {
      setEditPhoneSaving(false);
    }
  };

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
        <h5 className="text-md text-primary-light mb-0">Approved Customers</h5>
        {isAdmin && (
          <Link
            to="/add-customer"
            className="btn btn-primary text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2"
          >
            <Icon
              icon="ic:baseline-plus"
              className="icon text-xl line-height-1"
            />
            Add New Customer
          </Link>
        )}
      </div>

      <div className="card-body p-24">
        {/* Filters */}
        <div className="row g-3 mb-24">
          {(userRole === "admin" || userRole === "super_admin") && (
            <div className="col-md-2">
              {/* <label className="form-label text-sm fw-semibold mb-8">
                Reseller
              </label> */}
              <select
                className="form-select form-select-sm"
                value={selectedResellerId}
                onChange={(e) => setSelectedResellerId(e.target.value)}
              >
                <option value="all">All Resellers</option>
                {resellers.map((reseller) => (
                  <option key={reseller.id} value={reseller.id}>
                    {reseller.business_name ||
                      `${reseller.first_name || ""} ${
                        reseller.last_name || ""
                      }`.trim() ||
                      reseller.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            className={
              userRole === "admin" || userRole === "super_admin"
                ? "col-md-4"
                : "col-md-4"
            }
          >
            {/* <label className="form-label text-sm fw-semibold mb-8">
              Search
            </label> */}
            <div className="d-flex gap-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search by name, email, or phone"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm d-flex align-items-center justify-content-center"
                onClick={handleSearch}
              >
                <Icon icon="ion:search-outline" className="icon text-xl line-height-1" />
              </button>
            </div>
          </div>

          {/* <div className="col-md-2">
            <label className="form-label text-sm fw-semibold mb-8">
              Start Date
            </label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label text-sm fw-semibold mb-8">
              End Date
            </label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label text-sm fw-semibold mb-8">
              Expiring Soon
            </label>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={expiringSoon}
                onChange={(e) => setExpiringSoon(e.target.checked)}
              />
            </div>
          </div> */}

          <div className="col-md-2 d-flex align-items-end">
            <button
              type="button"
              className="btn btn-secondary btn-sm d-flex align-items-center gap-1"
              onClick={handleClearFilters}
            >
              <Icon icon="mdi:filter-off" className="icon text-xl line-height-1" />
              Clear Filters
            </button>
          </div>
        </div>

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
            <p className="text-muted mt-3">Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-40">
            <Icon
              icon="mdi:account-off"
              className="icon text-6xl text-muted mb-3"
            />
            <p className="text-muted">No customers found</p>
          </div>
        ) : (
          <>
            <div className="table-responsive scroll-sm">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">S.L</th>
                    <th scope="col">Customer Name</th>
                    <th scope="col">Phone</th>
                    {(userRole === "admin" || userRole === "super_admin") && (
                      <th scope="col">Reseller</th>
                    )}
                    <th scope="col">Email</th>
                    <th scope="col" className="text-center">
                      Virtual Numbers
                    </th>
                    {/* <th scope="col">Virtual Number</th>
                    <th scope="col">Call Forward Number</th>
                    <th scope="col">Purchase Date</th>
                    <th scope="col">Expiry Date</th>
                    <th scope="col">Payment Mode</th> */}
                    {/* <th scope="col" className="text-end">
                      WalletAmount
                    </th> */}
                    {/* <th scope="col">Days Left</th> */}
                    {/* <th scope="col" className="text-center">
                      Renew
                    </th> */}
                    <th scope="col" className="text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer, index) => (
                    <tr key={customer.id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="text-sm fw-medium">
                          {getCustomerName(customer)}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm">{customer.phone || "-"}</span>
                      </td>
                      {(userRole === "admin" || userRole === "super_admin") && (
                        <td>
                          <span className="text-sm fw-medium">
                            {customer.mst_reseller?.business_name ||
                              `${customer.mst_reseller?.first_name || ""} ${
                                customer.mst_reseller?.last_name || ""
                              }`.trim() ||
                              "N/A"}
                          </span>
                        </td>
                      )}
                      <td>
                        <span className="text-sm">{customer.email || "-"}</span>
                      </td>
                      <td className="text-center">
                        <span className="text-sm fw-medium text-primary-600">
                          {getVirtualNumberCount(customer)} / {getMaxVirtualNumbersForCustomer(customer) ?? "-"}
                        </span>
                      </td>
                      {/* <td>
                        <span className="text-sm">
                          {getVirtualNumber(customer)}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm">
                          {getCallForwardNumber(customer)}
                        </span>
                      </td>
                      <td>{formatDate(getPurchaseDate(customer))}</td>
                      <td>{formatDate(getExpiryDate(customer))}</td>
                      <td>
                        <span className="text-sm">
                          {getPaymentMode(customer)}
                        </span>
                      </td> */}
                      {/* <td className="text-end">
                        <span className="text-sm fw-medium text-success-600">
                          {formatCurrency(getAmount(customer))}
                        </span>
                      </td> */}
                      {/* <td>
                        <span
                          className={`text-sm fw-medium ${
                            getDaysLeft(customer) < 30 &&
                            getDaysLeft(customer) !== "-"
                              ? "text-warning-600"
                              : "text-secondary-light"
                          }`}
                        >
                          {getDaysLeft(customer)}
                        </span>
                      </td> */}
                      {/* <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled
                          title="Renew (Disabled)"
                        >
                          <Icon icon="mdi:refresh" className="icon" />
                        </button>
                      </td> */}
                      <td className="text-center">
                        <div className="d-flex justify-content-center align-items-center gap-2 flex-wrap">
                          {isReseller && (
                            <span
                              className="d-inline-block"
                              title={resellerActionsDisabled ? validityReason : undefined}
                              style={
                                resellerActionsDisabled
                                  ? { cursor: "not-allowed" }
                                  : undefined
                              }
                            >
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => openEditPhoneModal(customer)}
                                disabled={resellerActionsDisabled}
                                title={
                                  resellerActionsDisabled
                                    ? validityReason
                                    : "Edit customer phone number"
                                }
                              >
                                Edit
                              </button>
                            </span>
                          )}
                          {isAdmin && (
                            <Link
                              to={`/edit-user/${customer.id}`}
                              className="bg-warning-focus bg-hover-warning-200 text-warning-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle"
                              title="Edit Profile"
                            >
                              <Icon
                                icon="lucide:edit"
                                className="icon text-xl"
                              />
                            </Link>
                          )}
                          {isReseller && resellerActionsDisabled ? (
                            <span
                              className="d-inline-block"
                              title={validityReason}
                              style={{ cursor: "not-allowed" }}
                            >
                              <span
                                className="bg-info-focus text-info-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle opacity-50 pointer-events-none"
                                aria-disabled="true"
                              >
                                <Icon
                                  icon="majesticons:eye-line"
                                  className="icon text-xl"
                                />
                              </span>
                            </span>
                          ) : (
                            <Link
                              to={`/view-user/${customer.id}`}
                              className="bg-info-focus bg-hover-info-200 text-info-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle"
                              title="View Details"
                            >
                              <Icon
                                icon="majesticons:eye-line"
                                className="icon text-xl"
                              />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24">
              <span>
                Showing {filteredCustomers.length} of {customers.length}{" "}
                customer(s)
              </span>
            </div>
          </>
        )}
      </div>

      {editPhoneModalOpen && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content radius-12">
              <div className="modal-header border-bottom">
                <h5 className="modal-title text-md text-primary-light">Edit phone number</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeEditPhoneModal}
                  disabled={editPhoneSaving}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body p-24">
                {editPhoneCustomer && (
                  <p className="text-sm text-secondary-light mb-16">
                    <span className="fw-medium text-primary-light">{getCustomerName(editPhoneCustomer)}</span>
                    {editPhoneCustomer.email ? (
                      <span className="d-block text-xs mt-4">{editPhoneCustomer.email}</span>
                    ) : null}
                  </p>
                )}
                {editPhoneError && (
                  <div className="alert alert-danger py-12 radius-8 mb-16" role="alert">
                    {editPhoneError}
                  </div>
                )}
                <label className="form-label fw-semibold text-primary-light text-sm mb-8" htmlFor="edit-customer-phone">
                  Phone number <span className="text-danger-600">*</span>
                </label>
                <input
                  id="edit-customer-phone"
                  type="tel"
                  className="form-control radius-8"
                  placeholder="10-digit mobile number"
                  value={editPhoneValue}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setEditPhoneValue(v);
                    setEditPhoneError("");
                  }}
                  disabled={editPhoneSaving}
                  maxLength={10}
                />
                <small className="text-xs text-secondary-light d-block mt-8">
                  10 digits, starting with 6–9.
                </small>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-secondary radius-8"
                  onClick={closeEditPhoneModal}
                  disabled={editPhoneSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary radius-8"
                  onClick={handleSaveCustomerPhone}
                  disabled={editPhoneSaving}
                >
                  {editPhoneSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersListLayer;

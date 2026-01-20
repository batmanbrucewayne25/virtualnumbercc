import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstCustomersByReseller } from "@/hasura/mutations/customer";
import { getUserData } from "@/utils/auth";

const CustomerListLayer = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending"); // Default to pending to show newly registered customers

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const userData = getUserData();
      if (!userData || !userData.id) {
        setError("Unable to determine reseller ID. Please log in again.");
        setLoading(false);
        return;
      }

      const result = await getMstCustomersByReseller(userData.id);
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

  // Filter customers based on search and status
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      searchTerm === "" ||
      customer.profile_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm) ||
      customer.business_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && customer.status === "pending") ||
      (statusFilter === "approved" && customer.status === "approved") ||
      (statusFilter === "rejected" && customer.status === "rejected");

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { class: "bg-warning-focus text-warning-600 border-warning-main", text: "Pending" },
      approved: { class: "bg-success-focus text-success-600 border-success-main", text: "Approved" },
      rejected: { class: "bg-danger-focus text-danger-600 border-danger-main", text: "Rejected" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`${config.class} border px-24 py-4 radius-4 fw-medium text-sm`}>
        {config.text}
      </span>
    );
  };

  const getKycStatusBadge = (kycStatus) => {
    const statusConfig = {
      pending: { class: "bg-warning-focus text-warning-600 border-warning-main", text: "Pending" },
      verified: { class: "bg-success-focus text-success-600 border-success-main", text: "Verified" },
      rejected: { class: "bg-danger-focus text-danger-600 border-danger-main", text: "Rejected" },
    };

    const config = statusConfig[kycStatus] || statusConfig.pending;
    return (
      <span className={`${config.class} border px-24 py-4 radius-4 fw-medium text-sm`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
        <div className='d-flex align-items-center flex-wrap gap-3'>
          <form className='navbar-search'>
            <input
              type='text'
              className='bg-base h-40-px w-auto'
              name='search'
              placeholder='Search by name, email, or phone'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Icon icon='ion:search-outline' className='icon' />
          </form>
          <select
            className='form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px'
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value='all'>All Status</option>
            <option value='pending'>Pending</option>
            <option value='approved'>Approved</option>
            <option value='rejected'>Rejected</option>
          </select>
        </div>
      </div>
      <div className='card-body p-24'>
        {error && (
          <div className='alert alert-danger radius-8 mb-24' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error}
          </div>
        )}

        {loading ? (
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className='text-center py-40'>
            <Icon icon='mdi:account-off' className='icon text-6xl text-muted mb-3' />
            <p className='text-muted'>No customers found</p>
          </div>
        ) : (
          <>
            <div className='table-responsive scroll-sm'>
              <table className='table bordered-table sm-table mb-0'>
                <thead>
                  <tr>
                    <th scope='col'>S.L</th>
                    <th scope='col'>Date</th>
                    <th scope='col'>Profile Name</th>
                    <th scope='col'>Email</th>
                    <th scope='col'>Phone</th>
                    <th scope='col'>Business Email</th>
                    <th scope='col' className='text-center'>Status</th>
                    <th scope='col' className='text-center'>KYC Status</th>
                    <th scope='col' className='text-center'>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer, index) => (
                    <tr key={customer.id}>
                      <td>{index + 1}</td>
                      <td>{formatDate(customer.created_at)}</td>
                      <td>
                        <div className='d-flex align-items-center'>
                          <div className='w-40-px h-40-px rounded-circle flex-shrink-0 me-12 overflow-hidden bg-primary-100 d-flex align-items-center justify-content-center'>
                            <Icon
                              icon='solar:user-bold'
                              className='icon text-primary-600 text-xl'
                            />
                          </div>
                          <div className='flex-grow-1'>
                            <span className='text-md mb-0 fw-normal text-secondary-light'>
                              {customer.profile_name || "N/A"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {customer.email || "-"}
                        </span>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {customer.phone || "-"}
                        </span>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {customer.business_email || "-"}
                        </span>
                      </td>
                      <td className='text-center'>
                        {getStatusBadge(customer.status)}
                      </td>
                      <td className='text-center'>
                        {getKycStatusBadge(customer.kyc_status)}
                      </td>
                      <td className='text-center'>
                        <div className='d-flex align-items-center gap-10 justify-content-center flex-wrap'>
                          <Link
                            to={`/view-customer/${customer.id}`}
                            className='bg-info-focus bg-hover-info-200 text-info-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle'
                            title='View KYC Details'
                          >
                            <Icon
                              icon='majesticons:eye-line'
                              className='icon text-xl'
                            />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className='d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24'>
              <span>
                Showing {filteredCustomers.length} of {customers.length} customer(s)
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerListLayer;


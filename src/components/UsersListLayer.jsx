import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getApprovedCustomersByReseller } from "@/hasura/mutations/user";
import { getUserData } from "@/utils/auth";

const UsersListLayer = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expiringSoon, setExpiringSoon] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [startDate, endDate, expiringSoon]);

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

      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        searchTerm: searchTerm || undefined,
        expiringSoon: expiringSoon || undefined,
      };

      const result = await getApprovedCustomersByReseller(userData.id, filters);
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
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

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
    return customer.business_name || customer.profile_name || customer.pan_full_name || "N/A";
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

  // Filter customers based on search term
  const filteredCustomers = customers.filter((customer) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const name = getCustomerName(customer).toLowerCase();
    const virtualNumber = getVirtualNumber(customer).toLowerCase();
    const callForward = getCallForwardNumber(customer).toLowerCase();

    return (
      name.includes(searchLower) ||
      virtualNumber.includes(searchLower) ||
      callForward.includes(searchLower)
    );
  });

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
        <h5 className='text-md text-primary-light mb-0'>Approved Customers</h5>
      </div>

      <div className='card-body p-24'>
        {/* Filters */}
        <div className='row g-3 mb-24'>
          <div className='col-md-3'>
            <label className='form-label text-sm fw-semibold mb-8'>Search</label>
            <div className='d-flex gap-2'>
              <input
                type='text'
                className='form-control form-control-sm'
                placeholder='Name, virtual number, alternate number...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                type='button'
                className='btn btn-primary btn-sm'
                onClick={handleSearch}
              >
                <Icon icon='ion:search-outline' />
              </button>
            </div>
          </div>

          <div className='col-md-2'>
            <label className='form-label text-sm fw-semibold mb-8'>Start Date</label>
            <input
              type='date'
              className='form-control form-control-sm'
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className='col-md-2'>
            <label className='form-label text-sm fw-semibold mb-8'>End Date</label>
            <input
              type='date'
              className='form-control form-control-sm'
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className='col-md-2'>
            <label className='form-label text-sm fw-semibold mb-8'>Expiring Soon</label>
            <div className='form-check form-switch'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={expiringSoon}
                onChange={(e) => setExpiringSoon(e.target.checked)}
              />
            </div>
          </div>

          <div className='col-md-3 d-flex align-items-end'>
            <button
              type='button'
              className='btn btn-secondary btn-sm'
              onClick={handleClearFilters}
            >
              <Icon icon='mdi:filter-off' className='icon me-2' />
              Clear Filters
            </button>
          </div>
        </div>

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
                    <th scope='col'>Customer Name</th>
                    <th scope='col'>Virtual Number</th>
                    <th scope='col'>Call Forward Number</th>
                    <th scope='col'>Purchase Date</th>
                    <th scope='col'>Expiry Date</th>
                    <th scope='col'>Payment Mode</th>
                    <th scope='col' className='text-end'>Amount</th>
                    <th scope='col'>Days Left</th>
                    <th scope='col' className='text-center'>Renew</th>
                    <th scope='col' className='text-center'>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer, index) => (
                    <tr key={customer.id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className='text-sm fw-medium'>
                          {getCustomerName(customer)}
                        </span>
                      </td>
                      <td>
                        <span className='text-sm'>
                          {getVirtualNumber(customer)}
                        </span>
                      </td>
                      <td>
                        <span className='text-sm'>
                          {getCallForwardNumber(customer)}
                        </span>
                      </td>
                      <td>{formatDate(getPurchaseDate(customer))}</td>
                      <td>{formatDate(getExpiryDate(customer))}</td>
                      <td>
                        <span className='text-sm'>
                          {getPaymentMode(customer)}
                        </span>
                      </td>
                      <td className='text-end'>
                        <span className='text-sm fw-medium text-success-600'>
                          {formatCurrency(getAmount(customer))}
                        </span>
                      </td>
                      <td>
                        <span className={`text-sm fw-medium ${
                          getDaysLeft(customer) < 30 && getDaysLeft(customer) !== "-" 
                            ? "text-warning-600" 
                            : "text-secondary-light"
                        }`}>
                          {getDaysLeft(customer)}
                        </span>
                      </td>
                      <td className='text-center'>
                        <button
                          type='button'
                          className='btn btn-sm btn-outline-secondary'
                          disabled
                          title='Renew (Disabled)'
                        >
                          <Icon icon='mdi:refresh' className='icon' />
                        </button>
                      </td>
                      <td className='text-center'>
                        <Link
                          to={`/view-user/${customer.id}`}
                          className='bg-info-focus bg-hover-info-200 text-info-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle'
                          title='View Details'
                        >
                          <Icon
                            icon='majesticons:eye-line'
                            className='icon text-xl'
                          />
                        </Link>
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

export default UsersListLayer;

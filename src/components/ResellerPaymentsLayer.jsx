import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getAllTransactions, getTransactionStats } from "@/services/razorpayApi";

const ResellerPaymentsLayer = () => {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReseller, setSelectedReseller] = useState("");
  const [resellers, setResellers] = useState([]);

  useEffect(() => {
    fetchData();
  }, [limit, offset, statusFilter, selectedReseller]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    
    try {
      // Fetch transactions and stats in parallel
      const [transactionsResult, statsResult] = await Promise.all([
        getAllTransactions({
          limit,
          offset,
          status: statusFilter !== "all" ? statusFilter : undefined,
          reseller_id: selectedReseller || undefined
        }),
        getTransactionStats()
      ]);

      if (transactionsResult.success) {
        setTransactions(transactionsResult.data?.transactions || []);
        
        // Extract unique resellers for filter dropdown
        const uniqueResellers = [];
        const resellerIds = new Set();
        (transactionsResult.data?.transactions || []).forEach(t => {
          if (t.mst_reseller && !resellerIds.has(t.reseller_id)) {
            resellerIds.add(t.reseller_id);
            uniqueResellers.push({
              id: t.reseller_id,
              name: t.mst_reseller.business_name || 
                    `${t.mst_reseller.first_name || ''} ${t.mst_reseller.last_name || ''}`.trim() ||
                    t.mst_reseller.email
            });
          }
        });
        setResellers(uniqueResellers);
      } else {
        setError(transactionsResult.message || "Failed to load transactions");
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "An error occurred while loading data");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount, currency = "INR") => {
    if (amount === null || amount === undefined) return "₹0.00";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR'
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      success: { class: "bg-success-focus text-success-600 border-success-main", text: "Success" },
      captured: { class: "bg-success-focus text-success-600 border-success-main", text: "Captured" },
      authorized: { class: "bg-info-focus text-info-600 border-info-main", text: "Authorized" },
      pending: { class: "bg-warning-focus text-warning-600 border-warning-main", text: "Pending" },
      failed: { class: "bg-danger-focus text-danger-600 border-danger-main", text: "Failed" },
      refunded: { class: "bg-secondary-focus text-secondary-600 border-secondary-main", text: "Refunded" },
    };

    const config = statusConfig[status] || { class: "bg-secondary-focus text-secondary-600 border-secondary-main", text: status || "Unknown" };

    return (
      <span className={`${config.class} px-12 py-4 radius-4 fw-medium text-sm border`}>
        {config.text}
      </span>
    );
  };

  const handlePageChange = (newOffset) => {
    setOffset(newOffset);
  };

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
        <div className='d-flex align-items-center gap-3'>
          <h5 className='mb-0'>
            <Icon icon='solar:wallet-money-bold' className='icon me-2 text-primary-600' />
            Reseller Transactions
          </h5>
          {stats && (
            <span className='text-sm text-muted'>
              {stats.total_count} total transaction(s) from {stats.active_resellers} reseller(s)
            </span>
          )}
        </div>
        <div className='d-flex align-items-center gap-3 flex-wrap'>
          <select
            className='form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px'
            value={selectedReseller}
            onChange={(e) => {
              setSelectedReseller(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All Resellers</option>
            {resellers.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select
            className='form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px'
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="captured">Captured</option>
            <option value="authorized">Authorized</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            className='form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px'
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value));
              setOffset(0);
            }}
          >
            <option value={25}>Show 25</option>
            <option value={50}>Show 50</option>
            <option value={100}>Show 100</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className='card-body border-bottom bg-base py-16 px-24'>
          <div className='row g-3'>
            <div className='col-md-2'>
              <div className='p-16 bg-success-focus radius-8'>
                <div className='d-flex align-items-center justify-content-between'>
                  <div>
                    <p className='text-sm text-muted mb-4'>Total Amount</p>
                    <h6 className='mb-0 text-success-600'>{formatCurrency(stats.total_amount)}</h6>
                  </div>
                  <Icon icon='solar:dollar-bold' className='icon text-success-600 text-2xl' />
                </div>
              </div>
            </div>
            <div className='col-md-2'>
              <div className='p-16 bg-primary-focus radius-8'>
                <div className='d-flex align-items-center justify-content-between'>
                  <div>
                    <p className='text-sm text-muted mb-4'>Total</p>
                    <h6 className='mb-0 text-primary-600'>{stats.total_count || 0}</h6>
                  </div>
                  <Icon icon='solar:bill-list-bold' className='icon text-primary-600 text-2xl' />
                </div>
              </div>
            </div>
            <div className='col-md-2'>
              <div className='p-16 bg-info-focus radius-8'>
                <div className='d-flex align-items-center justify-content-between'>
                  <div>
                    <p className='text-sm text-muted mb-4'>Successful</p>
                    <h6 className='mb-0 text-info-600'>{stats.successful_count || 0}</h6>
                  </div>
                  <Icon icon='solar:check-circle-bold' className='icon text-info-600 text-2xl' />
                </div>
              </div>
            </div>
            <div className='col-md-2'>
              <div className='p-16 bg-danger-focus radius-8'>
                <div className='d-flex align-items-center justify-content-between'>
                  <div>
                    <p className='text-sm text-muted mb-4'>Failed</p>
                    <h6 className='mb-0 text-danger-600'>{stats.failed_count || 0}</h6>
                  </div>
                  <Icon icon='solar:close-circle-bold' className='icon text-danger-600 text-2xl' />
                </div>
              </div>
            </div>
            <div className='col-md-2'>
              <div className='p-16 bg-warning-focus radius-8'>
                <div className='d-flex align-items-center justify-content-between'>
                  <div>
                    <p className='text-sm text-muted mb-4'>Pending</p>
                    <h6 className='mb-0 text-warning-600'>{stats.pending_count || 0}</h6>
                  </div>
                  <Icon icon='solar:hourglass-bold' className='icon text-warning-600 text-2xl' />
                </div>
              </div>
            </div>
            <div className='col-md-2'>
              <div className='p-16 bg-cyan-focus radius-8'>
                <div className='d-flex align-items-center justify-content-between'>
                  <div>
                    <p className='text-sm text-muted mb-4'>Today</p>
                    <h6 className='mb-0 text-cyan-600'>{stats.today_count || 0}</h6>
                  </div>
                  <Icon icon='solar:calendar-bold' className='icon text-cyan-600 text-2xl' />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <p className='text-muted mt-3'>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className='text-center py-40'>
            <Icon icon='solar:wallet-money-broken' className='icon text-6xl text-muted mb-3' />
            <p className='text-muted'>No transactions found</p>
            <p className='text-sm text-muted'>
              Transactions will appear here when resellers receive payments through their Razorpay accounts.
            </p>
          </div>
        ) : (
          <>
            <div className='table-responsive scroll-sm'>
              <table className='table bordered-table sm-table mb-0'>
                <thead>
                  <tr>
                    <th scope='col'>S.L</th>
                    <th scope='col'>Date</th>
                    <th scope='col'>Reseller</th>
                    <th scope='col'>Transaction ID</th>
                    <th scope='col'>Customer</th>
                    <th scope='col'>Amount</th>
                    <th scope='col'>Status</th>
                    <th scope='col'>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => (
                    <tr key={transaction.id}>
                      <td>{offset + index + 1}</td>
                      <td className="text-nowrap">{formatDate(transaction.created_at)}</td>
                      <td>
                        <div>
                          <span className='text-md mb-0 fw-normal text-secondary-light d-block'>
                            {transaction.mst_reseller?.business_name || 
                             `${transaction.mst_reseller?.first_name || ''} ${transaction.mst_reseller?.last_name || ''}`.trim() ||
                             "Unknown"}
                          </span>
                          {transaction.mst_reseller?.email && (
                            <span className='text-xs text-muted'>{transaction.mst_reseller.email}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <span className='text-md mb-0 fw-normal text-secondary-light font-monospace d-block'>
                            {transaction.transaction_number}
                          </span>
                          {transaction.razorpay_payment_id && (
                            <span className='text-xs text-muted font-monospace'>
                              RZP: {transaction.razorpay_payment_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <span className='text-md mb-0 fw-normal text-secondary-light d-block'>
                            {transaction.customer_name || 
                             transaction.mst_customer?.profile_name || 
                             transaction.customer_email?.split('@')[0] || 
                             "-"}
                          </span>
                          {(transaction.customer_email || transaction.mst_customer?.email) && (
                            <span className='text-xs text-muted'>
                              {transaction.customer_email || transaction.mst_customer?.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-semibold text-success-600'>
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </span>
                      </td>
                      <td>
                        {getStatusBadge(transaction.status)}
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light text-capitalize'>
                          {transaction.payment_method || transaction.payment_mode || "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className='d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24'>
              <span className="text-muted">
                Showing {offset + 1} to {Math.min(offset + transactions.length, offset + limit)} of {stats?.total_count || transactions.length} entries
              </span>
              <div className='d-flex gap-2'>
                <button
                  className='btn btn-sm btn-outline-primary'
                  onClick={() => handlePageChange(Math.max(0, offset - limit))}
                  disabled={offset === 0 || loading}
                >
                  <Icon icon='solar:arrow-left-bold' className='icon' />
                  Previous
                </button>
                <button
                  className='btn btn-sm btn-outline-primary'
                  onClick={() => handlePageChange(offset + limit)}
                  disabled={transactions.length < limit || loading}
                >
                  Next
                  <Icon icon='solar:arrow-right-bold' className='icon' />
                </button>
                <button
                  className='btn btn-sm btn-primary'
                  onClick={fetchData}
                  disabled={loading}
                >
                  <Icon icon='solar:refresh-bold' className='icon me-1' />
                  Refresh
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResellerPaymentsLayer;

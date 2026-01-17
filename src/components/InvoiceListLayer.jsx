import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { creditWallet, getAllMstWalletTransactions } from "@/hasura/mutations/wallet";
import { getMstResellers } from "@/hasura/mutations/reseller";

const InvoiceListLayer = () => {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [resellerFilter, setResellerFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    reseller_id: "",
    amount: "",
    description: "",
    reference: "",
  });

  useEffect(() => {
    fetchResellers();
    fetchTransactions();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [resellerFilter]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, transactionTypeFilter, resellerFilter, itemsPerPage]);

  const fetchResellers = async () => {
    setLoadingResellers(true);
    try {
      const result = await getMstResellers();
      if (result.success) {
        setResellers(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching resellers:", err);
    } finally {
      setLoadingResellers(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError("");
    try {
      const resellerId = resellerFilter === "all" ? undefined : resellerFilter;
      const result = await getAllMstWalletTransactions(resellerId);
      console.log("Transaction fetch result:", result);
      if (result.success) {
        setTransactions(result.data || []);
      } else {
        console.error("Transaction fetch error:", result.message);
        setError(result.message || "Failed to load transactions");
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(err.message || "An error occurred while loading transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.reseller_id) {
      setError("Please select a reseller");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setActionLoading(true);
    try {
      const result = await creditWallet(
        formData.reseller_id,
        amount,
        formData.description || "Wallet credit",
        formData.reference || null
      );

      if (result.success) {
        setSuccess("Wallet credited successfully!");
        setFormData({
          reseller_id: "",
          amount: "",
          description: "",
          reference: "",
        });
        setTimeout(() => {
          setSuccess("");
          setWalletModalOpen(false);
        }, 2000);
        // Refresh transactions list
        fetchTransactions();
      } else {
        setError(result.message || "Failed to credit wallet");
      }
    } catch (err) {
      console.error("Error crediting wallet:", err);
      setError(err.message || "An error occurred while crediting wallet");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch =
      searchTerm === "" ||
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.transaction_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.mst_wallet?.mst_reseller?.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.mst_wallet?.mst_reseller?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${transaction.mst_wallet?.mst_reseller?.first_name} ${transaction.mst_wallet?.mst_reseller?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      transactionTypeFilter === "all" ||
      transaction.transaction_type === transactionTypeFilter;

    return matchesSearch && matchesType;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
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

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "₹0.00";
    return `₹${Number(amount).toFixed(2)}`;
  };

  return (
    <div className='card'>
      <div className='card-header d-flex flex-wrap align-items-center justify-content-between gap-3'>
        <div className='d-flex flex-wrap align-items-center gap-3'>
          <div className='d-flex align-items-center gap-2'>
            <span>Show</span>
            <select
              className='form-select form-select-sm w-auto'
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
            >
              <option value='10'>10</option>
              <option value='15'>15</option>
              <option value='20'>20</option>
              <option value='50'>50</option>
              <option value='100'>100</option>
            </select>
          </div>
          <div className='icon-field'>
            <input
              type='text'
              name='#0'
              className='form-control form-control-sm w-auto'
              placeholder='Search transactions'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className='icon'>
              <Icon icon='ion:search-outline' />
            </span>
          </div>
        </div>
        <div className='d-flex flex-wrap align-items-center gap-3'>
          <select
            className='form-select form-select-sm w-auto'
            value={resellerFilter}
            onChange={(e) => setResellerFilter(e.target.value)}
          >
            <option value='all'>All Resellers</option>
            {resellers.map((reseller) => (
              <option key={reseller.id} value={reseller.id}>
                {reseller.business_name || reseller.email}
              </option>
            ))}
          </select>
          <select
            className='form-select form-select-sm w-auto'
            value={transactionTypeFilter}
            onChange={(e) => setTransactionTypeFilter(e.target.value)}
          >
            <option value='all'>All Types</option>
            <option value='CREDIT'>Credit</option>
            <option value='DEBIT'>Debit</option>
          </select>
          <button
            type='button'
            className='btn btn-primary text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2'
            onClick={() => setWalletModalOpen(true)}
          >
            <Icon
              icon='mdi:wallet-plus'
              className='icon text-xl line-height-1'
            />
            Wallet
          </button>
        </div>
      </div>
      <div className='card-body'>
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
        ) : (
          <>
            <div className='table-responsive scroll-sm'>
              <table className='table bordered-table mb-0'>
                <thead>
                  <tr>
                    <th scope='col'>S.L</th>
                    <th scope='col'>Date</th>
                    <th scope='col'>Reseller</th>
                    <th scope='col'>Type</th>
                    <th scope='col'>Amount</th>
                    <th scope='col'>Balance Before</th>
                    <th scope='col'>Balance After</th>
                    <th scope='col'>Description</th>
                    <th scope='col'>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="9" className='text-center py-40'>
                        <Icon icon='mdi:receipt-text-outline' className='icon text-6xl text-muted mb-3' />
                        <p className='text-muted'>No transactions found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((transaction, index) => (
                      <tr key={transaction.id}>
                        <td>{startIndex + index + 1}</td>
                        <td>{formatDate(transaction.created_at)}</td>
                        <td>
                          {transaction.mst_wallet?.mst_reseller ? (
                            <div className='d-flex align-items-center'>
                              <div className='w-40-px h-40-px rounded-circle flex-shrink-0 me-12 overflow-hidden bg-primary-100 d-flex align-items-center justify-content-center'>
                                <Icon
                                  icon='solar:user-bold'
                                  className='icon text-primary-600 text-xl'
                                />
                              </div>
                              <div className='flex-grow-1'>
                                <span className='text-md mb-0 fw-normal text-secondary-light d-block'>
                                  {transaction.mst_wallet.mst_reseller.business_name || 
                                   `${transaction.mst_wallet.mst_reseller.first_name} ${transaction.mst_wallet.mst_reseller.last_name}`}
                                </span>
                                <span className='text-xs mb-0 fw-normal text-muted'>
                                  {transaction.mst_wallet.mst_reseller.email}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className='text-md fw-normal text-secondary-light'>-</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`${
                              transaction.transaction_type === 'CREDIT'
                                ? "bg-success-focus text-success-600 border border-success-main"
                                : "bg-danger-focus text-danger-600 border border-danger-main"
                            } px-16 py-4 radius-4 fw-medium text-sm`}
                          >
                            {transaction.transaction_type}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`text-md fw-medium ${
                              transaction.transaction_type === 'CREDIT'
                                ? "text-success-600"
                                : "text-danger-600"
                            }`}
                          >
                            {transaction.transaction_type === 'CREDIT' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </span>
                        </td>
                        <td>
                          <span className='text-md fw-normal text-secondary-light'>
                            {formatCurrency(transaction.balance_before)}
                          </span>
                        </td>
                        <td>
                          <span className='text-md fw-medium text-primary-light'>
                            {formatCurrency(transaction.balance_after)}
                          </span>
                        </td>
                        <td>
                          <span className='text-md fw-normal text-secondary-light'>
                            {transaction.description || "-"}
                          </span>
                        </td>
                        <td>
                          <span className='text-md fw-normal text-secondary-light'>
                            {transaction.reference || "-"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className='d-flex flex-wrap align-items-center justify-content-between gap-2 mt-24'>
              <span>
                Showing {filteredTransactions.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} transaction(s)
              </span>
              {totalPages > 1 && (
                <ul className='pagination d-flex flex-wrap align-items-center gap-2 justify-content-center mb-0'>
                  <li className='page-item'>
                    <button
                      type='button'
                      className='page-link text-secondary-light fw-medium radius-4 border-0 px-10 py-10 d-flex align-items-center justify-content-center h-32-px me-8 w-32-px bg-base'
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                    >
                      <Icon icon='ep:d-arrow-left' className='text-xl' />
                    </button>
                  </li>
                  <li className='page-item'>
                    <button
                      type='button'
                      className='page-link text-secondary-light fw-medium radius-4 border-0 px-10 py-10 d-flex align-items-center justify-content-center h-32-px me-8 w-32-px bg-base'
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <Icon icon='ep:arrow-left' className='text-xl' />
                    </button>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <li key={page} className='page-item'>
                          <button
                            type='button'
                            className={`page-link fw-medium radius-4 border-0 px-10 py-10 d-flex align-items-center justify-content-center h-32-px me-8 w-32-px ${
                              currentPage === page
                                ? 'bg-primary-600 text-white'
                                : 'bg-primary-50 text-secondary-light'
                            }`}
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </button>
                        </li>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <li key={page} className='page-item'>
                          <span className='page-link bg-transparent border-0 px-10 py-10 d-flex align-items-center justify-content-center h-32-px me-8 w-32-px text-secondary-light'>
                            ...
                          </span>
                        </li>
                      );
                    }
                    return null;
                  })}
                  <li className='page-item'>
                    <button
                      type='button'
                      className='page-link text-secondary-light fw-medium radius-4 border-0 px-10 py-10 d-flex align-items-center justify-content-center h-32-px me-8 w-32-px bg-base'
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <Icon icon='ep:arrow-right' className='text-xl' />
                    </button>
                  </li>
                  <li className='page-item'>
                    <button
                      type='button'
                      className='page-link text-secondary-light fw-medium radius-4 border-0 px-10 py-10 d-flex align-items-center justify-content-center h-32-px me-8 w-32-px bg-base'
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <Icon icon='ep:d-arrow-right' className='text-xl' />
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Wallet Modal */}
      {walletModalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content radius-12">
              <div className="modal-header border-bottom">
                <h5 className="modal-title text-md text-primary-light">Add Wallet Amount</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setWalletModalOpen(false);
                    setFormData({
                      reseller_id: "",
                      amount: "",
                      description: "",
                      reference: "",
                    });
                    setError("");
                    setSuccess("");
                  }}
                  disabled={actionLoading}
                  aria-label="Close"
                />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-24">
                  {error && (
                    <div className='alert alert-danger radius-8 mb-24' role='alert'>
                      <Icon icon='material-symbols:error-outline' className='icon me-2' />
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className='alert alert-success radius-8 mb-24' role='alert'>
                      <Icon icon='material-symbols:check-circle-outline' className='icon me-2' />
                      {success}
                    </div>
                  )}

                  <div className="mb-20">
                    <label
                      htmlFor='reseller_id'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Reseller <span className='text-danger-600'>*</span>
                    </label>
                    <select
                      className='form-select radius-8'
                      id='reseller_id'
                      name='reseller_id'
                      value={formData.reseller_id}
                      onChange={handleChange}
                      required
                      disabled={loadingResellers || actionLoading}
                    >
                      <option value=''>Select Reseller</option>
                      {resellers.map((reseller) => (
                        <option key={reseller.id} value={reseller.id}>
                          {reseller.business_name || reseller.email} ({reseller.first_name} {reseller.last_name})
                        </option>
                      ))}
                    </select>
                    {loadingResellers && (
                      <small className='text-muted'>Loading resellers...</small>
                    )}
                  </div>

                  <div className="mb-20">
                    <label
                      htmlFor='amount'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Amount (₹) <span className='text-danger-600'>*</span>
                    </label>
                    <input
                      type='number'
                      step='0.01'
                      min='0'
                      className='form-control radius-8'
                      id='amount'
                      name='amount'
                      placeholder='Enter amount to add'
                      value={formData.amount}
                      onChange={handleChange}
                      required
                      disabled={actionLoading}
                    />
                  </div>

                  <div className="mb-20">
                    <label
                      htmlFor='description'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Description
                    </label>
                    <textarea
                      className='form-control radius-8'
                      id='description'
                      name='description'
                      rows='3'
                      placeholder='Enter transaction description (optional)'
                      value={formData.description}
                      onChange={handleChange}
                      disabled={actionLoading}
                    />
                  </div>

                  <div className="mb-20">
                    <label
                      htmlFor='reference'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Reference
                    </label>
                    <input
                      type='text'
                      className='form-control radius-8'
                      id='reference'
                      name='reference'
                      placeholder='Enter reference (optional)'
                      value={formData.reference}
                      onChange={handleChange}
                      disabled={actionLoading}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button
                    type="button"
                    className="btn btn-secondary radius-8"
                    onClick={() => {
                      setWalletModalOpen(false);
                      setFormData({
                        reseller_id: "",
                        amount: "",
                        description: "",
                        reference: "",
                      });
                      setError("");
                      setSuccess("");
                    }}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary radius-8"
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Processing...
                      </>
                    ) : (
                      "Add Amount"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceListLayer;

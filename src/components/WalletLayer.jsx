import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getMstWalletTransactions, getMstWalletByResellerId, creditWallet, debitWallet } from "@/hasura/mutations/wallet";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getUserData } from "@/utils/auth";

const WalletLayer = () => {
  const [transactions, setTransactions] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [selectedResellerId, setSelectedResellerId] = useState("");
  const [resellers, setResellers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [debitModalOpen, setDebitModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [debitAmount, setDebitAmount] = useState("");
  const [transactionDescription, setTransactionDescription] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [validityDate, setValidityDate] = useState("");

  useEffect(() => {
    checkUserRole();
  }, []);

  useEffect(() => {
    if (selectedResellerId || !isAdmin) {
      fetchWalletData();
    }
  }, [selectedResellerId, isAdmin]);

  const checkUserRole = () => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userRole = payload.role;
        setIsAdmin(userRole === 'admin');
        
        if (userRole === 'admin') {
          fetchResellers();
        } else {
          // For reseller, use their own ID
          const userData = getUserData();
          if (userData && userData.id) {
            setSelectedResellerId(userData.id);
          }
        }
      }
    } catch (err) {
      console.error("Error decoding token:", err);
      setIsAdmin(false);
    }
  };

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

  const fetchWalletData = async () => {
    if (!selectedResellerId) return;

    setLoading(true);
    setError("");
    try {
      // Fetch wallet
      const walletResult = await getMstWalletByResellerId(selectedResellerId);
      if (walletResult.success && walletResult.data) {
        setWallet(walletResult.data);
        
        // Fetch transactions
        const transactionsResult = await getMstWalletTransactions(walletResult.data.id);
        if (transactionsResult.success) {
          setTransactions(transactionsResult.data || []);
        } else {
          setError("Failed to load transactions");
        }
      } else {
        setWallet(null);
        setTransactions([]);
        if (!walletResult.message || walletResult.message !== "Wallet not found") {
          setError("Failed to load wallet data");
        }
      }
    } catch (err) {
      console.error("Error fetching wallet data:", err);
      setError("An error occurred while loading wallet data");
    } finally {
      setLoading(false);
    }
  };

  const handleCredit = async () => {
    if (!selectedResellerId) {
      setError("Please select a reseller");
      return;
    }

    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const result = await creditWallet(
        selectedResellerId,
        amount,
        transactionDescription || "Wallet credit",
        transactionReference || null,
        validityDate || null
      );

      if (result.success) {
        setCreditAmount("");
        setTransactionDescription("");
        setTransactionReference("");
        setValidityDate("");
        setCreditModalOpen(false);
        fetchWalletData();
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

  const handleDebit = async () => {
    if (!selectedResellerId) {
      setError("Please select a reseller");
      return;
    }

    const amount = parseFloat(debitAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const result = await debitWallet(
        selectedResellerId,
        amount,
        transactionDescription || "Wallet debit",
        transactionReference || null
      );

      if (result.success) {
        setDebitAmount("");
        setTransactionDescription("");
        setTransactionReference("");
        setDebitModalOpen(false);
        fetchWalletData();
      } else {
        setError(result.message || "Failed to debit wallet");
      }
    } catch (err) {
      console.error("Error debiting wallet:", err);
      setError(err.message || "An error occurred while debiting wallet");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch =
      searchTerm === "" ||
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.transaction_type?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      transactionTypeFilter === "all" ||
      transaction.transaction_type === transactionTypeFilter;

    return matchesSearch && matchesType;
  });

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
    <>
      <div className='row gy-4'>
        <div className='col-lg-9'>
          <div className='card h-100 p-0 radius-12'>
            <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
              <div className='d-flex align-items-center flex-wrap gap-3'>
                {isAdmin && (
                  <select
                    className='form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px'
                    value={selectedResellerId}
                    onChange={(e) => setSelectedResellerId(e.target.value)}
                  >
                    <option value=''>Select Reseller</option>
                    {resellers.map((reseller) => (
                      <option key={reseller.id} value={reseller.id}>
                        {reseller.business_name || reseller.email} ({reseller.first_name} {reseller.last_name})
                      </option>
                    ))}
                  </select>
                )}
                <form className='navbar-search'>
                  <input
                    type='text'
                    className='bg-base h-40-px w-auto'
                    name='search'
                    placeholder='Search transactions'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Icon icon='ion:search-outline' className='icon' />
                </form>
                <select
                  className='form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px'
                  value={transactionTypeFilter}
                  onChange={(e) => setTransactionTypeFilter(e.target.value)}
                >
                  <option value='all'>All Types</option>
                  <option value='CREDIT'>Credit</option>
                  <option value='DEBIT'>Debit</option>
                </select>
              </div>
              {selectedResellerId && (
                <div className='d-flex gap-2'>
                  <button
                    type='button'
                    className='btn btn-success text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2'
                    onClick={() => setCreditModalOpen(true)}
                  >
                    <Icon icon='ic:baseline-plus' className='icon text-xl line-height-1' />
                    Credit
                  </button>
                  <button
                    type='button'
                    className='btn btn-danger text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2'
                    onClick={() => setDebitModalOpen(true)}
                  >
                    <Icon icon='ic:baseline-minus' className='icon text-xl line-height-1' />
                    Debit
                  </button>
                </div>
              )}
            </div>
            <div className='card-body p-24'>
              {error && (
                <div className='alert alert-danger radius-8 mb-24' role='alert'>
                  <Icon icon='material-symbols:error-outline' className='icon me-2' />
                  {error}
                </div>
              )}

              {!selectedResellerId && isAdmin ? (
                <div className='text-center py-40'>
                  <Icon icon='mdi:wallet-outline' className='icon text-6xl text-muted mb-3' />
                  <p className='text-muted'>Please select a reseller to view wallet transactions</p>
                </div>
              ) : loading ? (
                <div className='text-center py-40'>
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className='text-muted mt-3'>Loading wallet data...</p>
                </div>
              ) : !wallet ? (
                <div className='text-center py-40'>
                  <Icon icon='mdi:wallet-off' className='icon text-6xl text-muted mb-3' />
                  <p className='text-muted'>No wallet found for this reseller</p>
                </div>
              ) : (
                <>
                  <div className='table-responsive scroll-sm'>
                    <table className='table bordered-table sm-table mb-0'>
                      <thead>
                        <tr>
                          <th scope='col'>S.L</th>
                          <th scope='col'>Date</th>
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
                            <td colSpan="8" className='text-center py-40'>
                              <Icon icon='mdi:receipt-text-outline' className='icon text-6xl text-muted mb-3' />
                              <p className='text-muted'>No transactions found</p>
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((transaction, index) => (
                            <tr key={transaction.id}>
                              <td>{index + 1}</td>
                              <td>{formatDate(transaction.created_at)}</td>
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
                  <div className='d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24'>
                    <span>
                      Showing {filteredTransactions.length} of {transactions.length} transaction(s)
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className='col-lg-3'>
          <div className='card h-100'>
            <div className='card-body p-24'>
              <div className='mb-24'>
                <span className='text-sm text-secondary-light mb-8 d-block'>Wallet Balance</span>
                <h5 className='text-2xl text-primary-light mb-0'>
                  {wallet ? formatCurrency(wallet.balance) : "₹0.00"}
                </h5>
              </div>
              {wallet && (
                <>
                  <div className='mt-24 pb-24 mb-24 border-bottom d-flex align-items-center gap-16 justify-content-between flex-wrap'>
                    <div className='text-center d-flex align-items-center flex-column'>
                      <span className='w-60-px h-60-px bg-success-50 text-success-600 text-2xl d-inline-flex justify-content-center align-items-center rounded-circle'>
                        <Icon icon='ic:baseline-plus' />
                      </span>
                      <span className='text-primary-light fw-medium mt-6 text-sm'>Total Credit</span>
                      <span className='text-success-600 fw-semibold mt-2'>
                        {formatCurrency(wallet.credit_amount)}
                      </span>
                    </div>
                    <div className='text-center d-flex align-items-center flex-column'>
                      <span className='w-60-px h-60-px bg-danger-50 text-danger-600 text-2xl d-inline-flex justify-content-center align-items-center rounded-circle'>
                        <Icon icon='ic:baseline-minus' />
                      </span>
                      <span className='text-primary-light fw-medium mt-6 text-sm'>Total Debit</span>
                      <span className='text-danger-600 fw-semibold mt-2'>
                        {formatCurrency(wallet.debit_amount)}
                      </span>
                    </div>
                  </div>
                  {wallet.last_transaction_at && (
                    <div className='mb-16'>
                      <span className='text-xs text-secondary-light mb-4 d-block'>Last Transaction</span>
                      <span className='text-sm text-primary-light'>
                        {formatDate(wallet.last_transaction_at)}
                      </span>
                    </div>
                  )}
                  <div className='mb-16'>
                    <span className='text-xs text-secondary-light mb-4 d-block'>Wallet ID</span>
                    <span className='text-sm text-primary-light font-monospace'>
                      {wallet.id.substring(0, 8)}...
                    </span>
                  </div>
                  <div>
                    <span className='text-xs text-secondary-light mb-4 d-block'>User Type</span>
                    <span className='text-sm text-primary-light'>
                      {wallet.user_type || 'RESELLER'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Credit Modal */}
      {creditModalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content radius-12">
              <div className="modal-header border-bottom">
                <h5 className="modal-title text-md text-primary-light">Credit Wallet</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setCreditModalOpen(false);
                    setCreditAmount("");
                    setTransactionDescription("");
                    setTransactionReference("");
                    setValidityDate("");
                    setError("");
                  }}
                  disabled={actionLoading}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body p-24">
                <div className="mb-20">
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Amount (₹) <span className='text-danger-600'>*</span>
                  </label>
                  <input
                    type='number'
                    step='0.01'
                    min='0'
                    className='form-control radius-8'
                    placeholder='Enter amount to credit'
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    required
                    disabled={actionLoading}
                  />
                </div>
                <div className="mb-20">
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Description
                  </label>
                  <textarea
                    className='form-control radius-8'
                    rows='3'
                    placeholder='Enter transaction description (optional)'
                    value={transactionDescription}
                    onChange={(e) => setTransactionDescription(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>
                <div className="mb-20">
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Reference
                  </label>
                  <input
                    type='text'
                    className='form-control radius-8'
                    placeholder='Enter reference (optional)'
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>
                <div className="mb-20">
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Validity Date (Optional)
                  </label>
                  <input
                    type='date'
                    className='form-control radius-8'
                    value={validityDate}
                    onChange={(e) => setValidityDate(e.target.value)}
                    disabled={actionLoading}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <small className='text-xs text-secondary-light mt-4 d-block'>
                    Set the validity end date for the reseller. If not set, validity will be calculated based on default (365 days).
                  </small>
                </div>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-secondary radius-8"
                  onClick={() => {
                    setCreditModalOpen(false);
                    setCreditAmount("");
                    setTransactionDescription("");
                    setTransactionReference("");
                    setValidityDate("");
                    setError("");
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success radius-8"
                  onClick={handleCredit}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Processing...
                    </>
                  ) : (
                    "Credit Wallet"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debit Modal */}
      {debitModalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content radius-12">
              <div className="modal-header border-bottom">
                <h5 className="modal-title text-md text-primary-light">Debit Wallet</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setDebitModalOpen(false);
                    setDebitAmount("");
                    setTransactionDescription("");
                    setTransactionReference("");
                    setError("");
                  }}
                  disabled={actionLoading}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body p-24">
                <div className="mb-20">
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Amount (₹) <span className='text-danger-600'>*</span>
                  </label>
                  <input
                    type='number'
                    step='0.01'
                    min='0'
                    className='form-control radius-8'
                    placeholder='Enter amount to debit'
                    value={debitAmount}
                    onChange={(e) => setDebitAmount(e.target.value)}
                    required
                    disabled={actionLoading}
                  />
                </div>
                <div className="mb-20">
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Description
                  </label>
                  <textarea
                    className='form-control radius-8'
                    rows='3'
                    placeholder='Enter transaction description (optional)'
                    value={transactionDescription}
                    onChange={(e) => setTransactionDescription(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>
                <div className="mb-20">
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Reference
                  </label>
                  <input
                    type='text'
                    className='form-control radius-8'
                    placeholder='Enter reference (optional)'
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-secondary radius-8"
                  onClick={() => {
                    setDebitModalOpen(false);
                    setDebitAmount("");
                    setTransactionDescription("");
                    setTransactionReference("");
                    setError("");
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger radius-8"
                  onClick={handleDebit}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Processing...
                    </>
                  ) : (
                    "Debit Wallet"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletLayer;

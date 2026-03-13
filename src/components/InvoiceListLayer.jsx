import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getAllMstWalletTransactions } from "@/hasura/mutations/wallet";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { formatDateTimeIST } from "@/utils/dateUtils";
import { getUserData } from "@/utils/auth";
import AddWalletAmountModal from "./AddWalletAmountModal";

const InvoiceListLayer = () => {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [resellerFilter, setResellerFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isResellerView, setIsResellerView] = useState(false);

  useEffect(() => {
    const userData = getUserData();
    if (userData?.role === "reseller" && userData?.id) {
      setIsResellerView(true);
      setResellerFilter(userData.id);
    }
  }, []);

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



  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch =
      searchTerm === "" ||
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.transaction_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.mst_wallet?.mst_reseller?.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.mst_wallet?.mst_reseller?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${transaction.mst_wallet?.mst_reseller?.first_name} ${transaction.mst_wallet?.mst_reseller?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.mst_wallet?.mst_reseller?.phone && String(transaction.mst_wallet.mst_reseller.phone).includes(searchTerm.trim()));

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

  const formatDate = formatDateTimeIST;

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
              placeholder='Search by description, reseller, phone...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className='icon'>
              <Icon icon='ion:search-outline' />
            </span>
          </div>
        </div>
        <div className='d-flex flex-wrap align-items-center gap-3'>
          {!isResellerView && (
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
          )}
          <select
            className='form-select form-select-sm w-auto'
            value={transactionTypeFilter}
            onChange={(e) => setTransactionTypeFilter(e.target.value)}
          >
            <option value='all'>All Types</option>
            <option value='CREDIT'>Credit</option>
            <option value='DEBIT'>Debit</option>
          </select>
          {!isResellerView && (
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
          )}
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
                             
                              <div className='flex-grow-1'>
                                <span className='text-md mb-0 fw-normal text-secondary-light d-block'>
                                  {transaction.mst_wallet.mst_reseller.business_name || 
                                   `${transaction.mst_wallet.mst_reseller.first_name} ${transaction.mst_wallet.mst_reseller.last_name}`}
                                </span>
                                <span className='text-xs mb-0 fw-normal text-muted'>
                                  {transaction.mst_wallet.mst_reseller.email} 
                                </span>
                                <span className='text-xs mb-0 fw-normal text-muted mx-2'> | </span>
                                <span className='text-xs mb-0 fw-normal text-muted'>
                                   {transaction.mst_wallet.mst_reseller.phone}
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

      <AddWalletAmountModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onSuccess={fetchTransactions}
      />
    </div>
  );
};

export default InvoiceListLayer;

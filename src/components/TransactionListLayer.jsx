import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getMstTransactionsByReseller } from "@/hasura/mutations/transaction";
import { getUserData } from "@/utils/auth";
import * as XLSX from "xlsx";

const TransactionListLayer = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter, startDate, endDate]);

  const fetchTransactions = async () => {
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
        status: statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        searchTerm: searchTerm || undefined,
      };

      const result = await getMstTransactionsByReseller(userData.id, filters);
      if (result.success) {
        setTransactions(result.data || []);
      } else {
        setError("Failed to load transactions");
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError("An error occurred while loading transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchTransactions();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
  };

  const exportToExcel = () => {
    setExporting(true);
    try {
      // Prepare data for Excel
      const excelData = transactions.map((txn) => ({
        "Transaction Number": txn.transaction_number || "-",
        "Customer Name": txn.mst_customer?.profile_name || txn.mst_customer?.email || "-",
        "Customer Email": txn.mst_customer?.email || "-",
        "Virtual Number": txn.mst_virtual_number?.virtual_number || "-",
        "Payment Mode": txn.payment_mode || "-",
        "Payment Method": txn.payment_method || "-",
        "Reference Number": txn.reference_number || "-",
        "Amount (₹)": Number(txn.amount).toFixed(2),
        "Status": txn.status || "-",
        "Transaction Type": txn.transaction_type || "-",
        "Payment Date": txn.payment_date || "-",
        "Created At": txn.created_at ? new Date(txn.created_at).toLocaleString() : "-",
        "Failure Reason": txn.failure_reason || "-",
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 20 }, // Transaction Number
        { wch: 25 }, // Customer Name
        { wch: 30 }, // Customer Email
        { wch: 18 }, // Virtual Number
        { wch: 15 }, // Payment Mode
        { wch: 15 }, // Payment Method
        { wch: 20 }, // Reference Number
        { wch: 12 }, // Amount
        { wch: 12 }, // Status
        { wch: 18 }, // Transaction Type
        { wch: 15 }, // Payment Date
        { wch: 20 }, // Created At
        { wch: 30 }, // Failure Reason
      ];
      ws["!cols"] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");

      // Generate filename with date range
      const dateStr = startDate && endDate 
        ? `${startDate}_to_${endDate}`
        : new Date().toISOString().split("T")[0];
      const filename = `transactions_${dateStr}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);
      
      alert("Transactions exported to Excel successfully!");
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      alert("Failed to export transactions. Please try again.");
    } finally {
      setExporting(false);
    }
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

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-GB", {
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      success: { class: "bg-success-focus text-success-600 border-success-main", text: "Success" },
      failure: { class: "bg-danger-focus text-danger-600 border-danger-main", text: "Failure" },
      pending: { class: "bg-warning-focus text-warning-600 border-warning-main", text: "Pending" },
    };

    const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
    return (
      <span className={`${config.class} border px-24 py-4 radius-4 fw-medium text-sm`}>
        {config.text}
      </span>
    );
  };

  // Filter transactions based on search term (client-side for better UX)
  const filteredTransactions = transactions.filter((txn) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const customerName = txn.mst_customer?.profile_name?.toLowerCase() || "";
    const customerEmail = txn.mst_customer?.email?.toLowerCase() || "";
    const virtualNumber = txn.mst_virtual_number?.virtual_number?.toLowerCase() || "";
    const referenceNumber = txn.reference_number?.toLowerCase() || "";
    const transactionNumber = txn.transaction_number?.toLowerCase() || "";

    return (
      customerName.includes(searchLower) ||
      customerEmail.includes(searchLower) ||
      virtualNumber.includes(searchLower) ||
      referenceNumber.includes(searchLower) ||
      transactionNumber.includes(searchLower)
    );
  });

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
        <h5 className='text-md text-primary-light mb-0'>Transactions</h5>
        <div className='d-flex align-items-center flex-wrap gap-3'>
          <button
            type='button'
            className='btn btn-success btn-sm d-flex align-items-center gap-2'
            onClick={exportToExcel}
            disabled={exporting || filteredTransactions.length === 0}
          >
            <Icon icon='mdi:file-excel' className='icon' />
            {exporting ? "Exporting..." : "Export to Excel"}
          </button>
        </div>
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
                placeholder='Customer name, virtual number, reference...'
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
            <label className='form-label text-sm fw-semibold mb-8'>Status</label>
            <select
              className='form-select form-select-sm'
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value='all'>All Status</option>
              <option value='success'>Success</option>
              <option value='failure'>Failure</option>
              <option value='pending'>Pending</option>
            </select>
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
            <p className='text-muted mt-3'>Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className='text-center py-40'>
            <Icon icon='mdi:receipt-text-outline' className='icon text-6xl text-muted mb-3' />
            <p className='text-muted'>No transactions found</p>
          </div>
        ) : (
          <>
            <div className='table-responsive scroll-sm'>
              <table className='table bordered-table sm-table mb-0'>
                <thead>
                  <tr>
                    <th scope='col'>S.L</th>
                    <th scope='col'>Transaction #</th>
                    <th scope='col'>Date</th>
                    <th scope='col'>Customer Name</th>
                    <th scope='col'>Virtual Number</th>
                    <th scope='col'>Payment Mode</th>
                    <th scope='col'>Payment Method</th>
                    <th scope='col'>Reference Number</th>
                    <th scope='col' className='text-end'>Amount</th>
                    <th scope='col' className='text-center'>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn, index) => (
                    <tr key={txn.id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className='text-sm fw-medium text-primary-600'>
                          {txn.transaction_number || "-"}
                        </span>
                      </td>
                      <td>{formatDate(txn.payment_date || txn.created_at)}</td>
                      <td>
                        <div className='d-flex flex-column'>
                          <span className='text-sm fw-medium'>
                            {txn.mst_customer?.profile_name || "N/A"}
                          </span>
                          <span className='text-xs text-secondary-light'>
                            {txn.mst_customer?.email || ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className='text-sm'>
                          {txn.mst_virtual_number?.virtual_number || "-"}
                        </span>
                      </td>
                      <td>
                        <span className='text-sm'>
                          {txn.payment_mode || "-"}
                        </span>
                      </td>
                      <td>
                        <span className='text-sm'>
                          {txn.payment_method || "-"}
                        </span>
                      </td>
                      <td>
                        <span className='text-sm'>
                          {txn.reference_number || "-"}
                        </span>
                      </td>
                      <td className='text-end'>
                        <span className='text-sm fw-medium text-success-600'>
                          {formatCurrency(txn.amount)}
                        </span>
                      </td>
                      <td className='text-center'>
                        {getStatusBadge(txn.status)}
                      </td>
                    </tr>
                  ))}
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
  );
};

export default TransactionListLayer;


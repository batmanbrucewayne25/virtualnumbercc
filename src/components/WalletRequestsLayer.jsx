import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getWalletRequests, updateWalletRequestStatus } from "@/hasura/mutations/walletRequest";
import { getUserData } from "@/utils/auth";
import { formatDateTimeIST } from "@/utils/dateUtils";
import AddWalletAmountModal from "./AddWalletAmountModal";

const WalletRequestsLayer = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectRequest, setRejectRequest] = useState(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getWalletRequests();
      if (result.success) {
        setRequests(result.data || []);
      } else {
        setError(result.message || "Failed to load requests");
      }
    } catch (err) {
      setError(err?.message || "Failed to load wallet requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRejectClick = (row) => {
    setRejectRequest(row);
    setRejectModalOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectRequest) return;
    setRejectSubmitting(true);
    setError("");
    try {
      const userData = getUserData();
      const result = await updateWalletRequestStatus(rejectRequest.id, {
        status: "REJECTED",
        reviewed_by: userData?.id || null,
      });
      if (result.success) {
        setRejectModalOpen(false);
        setRejectRequest(null);
        await fetchRequests();
      } else {
        setError(result.message || "Failed to reject");
      }
    } catch (err) {
      setError(err?.message || "Failed to reject request");
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handleAcceptClick = (row) => {
    setSelectedRequest(row);
    setAcceptModalOpen(true);
  };

  const handleAcceptSuccess = async () => {
    if (!selectedRequest) return;
    const userData = getUserData();
    await updateWalletRequestStatus(selectedRequest.id, {
      status: "APPROVED",
      reviewed_by: userData?.id || null,
    });
    setAcceptModalOpen(false);
    setSelectedRequest(null);
    await fetchRequests();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("wallet-should-refresh"));
    }
  };

  const formatDate = formatDateTimeIST;
  const formatCurrency = (amount) => {
    if (amount == null) return "₹0.00";
    return `₹${Number(amount).toFixed(2)}`;
  };

  const getResellerDisplay = (row) => {
    const r = row.mst_reseller;
    if (!r) return row.reseller_id || "-";
    return r.business_name || r.email || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "-";
  };

  const initialValues = selectedRequest
    ? {
        resellerId: selectedRequest.reseller_id,
        resellerDisplayName: getResellerDisplay(selectedRequest),
        amount: selectedRequest.amount,
        reference: selectedRequest.reference || "",
        description: selectedRequest.description || "",
        validityDate: "",
        paymentType: selectedRequest.payment_type || "bank_transfer",
      }
    : undefined;

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-body p-24">
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
            <p className="text-muted mt-3">Loading wallet requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-40">
            <Icon icon="mdi:wallet-outline" className="icon text-6xl text-muted mb-3" />
            <p className="text-muted">No wallet requests</p>
          </div>
        ) : (
          <div className="table-responsive scroll-sm">
            <table className="table bordered-table sm-table mb-0">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Reseller</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Payment Type</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created at</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{getResellerDisplay(row)}</td>
                    <td>{formatCurrency(row.amount)}</td>
                    <td>{row.payment_type === "upi" ? "UPI" : "Bank Transfer"}</td>
                    <td>{row.reference || "-"}</td>
                    <td>{row.description || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          row.status === "PENDING"
                            ? "bg-warning"
                            : row.status === "APPROVED"
                            ? "bg-success"
                            : "bg-danger"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      {row.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-success me-2"
                            onClick={() => handleAcceptClick(row)}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRejectClick(row)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {row.status !== "PENDING" && "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject confirmation modal */}
      {rejectModalOpen && rejectRequest && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content radius-12">
              <div className="modal-header border-bottom">
                <h5 className="modal-title text-md text-primary-light">Reject request</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => { setRejectModalOpen(false); setRejectRequest(null); }}
                  disabled={rejectSubmitting}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body p-24">
                <p className="mb-0">
                  Reject wallet request of {formatCurrency(rejectRequest.amount)} from {getResellerDisplay(rejectRequest)}?
                </p>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setRejectModalOpen(false); setRejectRequest(null); }}
                  disabled={rejectSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleRejectConfirm}
                  disabled={rejectSubmitting}
                >
                  {rejectSubmitting ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AddWalletAmountModal
        isOpen={acceptModalOpen}
        onClose={() => { setAcceptModalOpen(false); setSelectedRequest(null); }}
        onSuccess={handleAcceptSuccess}
        initialValues={initialValues}
      />
    </div>
  );
};

export default WalletRequestsLayer;

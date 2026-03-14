import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { getUserData } from "@/utils/auth";
import { getMstResellerById, updateMstReseller } from "@/hasura/mutations/reseller";
import {
  getResellerAllowedCustomers,
  insertResellerAllowedCustomerOne,
  updateResellerAllowedCustomerByPk,
  deleteResellerAllowedCustomerByPk,
  deleteResellerAllowedCustomers,
  insertResellerAllowedCustomers,
} from "@/hasura/mutations/resellerAllowedCustomer";
import { formatDateIST } from "@/utils/dateUtils";

function parseSheetForEmailsAndPhones(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
        if (rows.length < 1) {
          resolve({ emails: [], phones: [] });
          return;
        }
        const headers = rows[0].map((h) => String(h || "").toLowerCase().trim());
        const emailCol = headers.findIndex((h) => /email/.test(h));
        const phoneCol = headers.findIndex((h) => /phone|mobile/.test(h));
        const emails = [];
        const phones = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (emailCol >= 0 && row[emailCol] != null) {
            const v = String(row[emailCol]).trim();
            if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) emails.push(v);
          }
          if (phoneCol >= 0 && row[phoneCol] != null) {
            const v = String(row[phoneCol]).replace(/\D/g, "");
            if (v.length >= 10) phones.push(v);
          }
        }
        resolve({ emails: [...new Set(emails)], phones: [...new Set(phones)] });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

const AllowedCustomersLayer = () => {
  const [resellerId, setResellerId] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [allowExistingCustomer, setAllowExistingCustomer] = useState(false);
  const [updatingToggle, setUpdatingToggle] = useState(false);
  const [toggleDropdown, setToggleDropdown] = useState(false);
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    const userData = getUserData();
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.role === "reseller" && userData?.id) {
          setResellerId(userData.id);
          fetchResellerAndList(userData.id);
          return;
        }
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    setError("Only resellers can access this page.");
    setFetching(false);
  }, []);

  const fetchResellerAndList = async (id) => {
    setFetching(true);
    setError("");
    try {
      const res = await getMstResellerById(id);
      if (res.success && res.data) {
        setAllowExistingCustomer(res.data.allow_existing_customer === true);
      }
      const listRes = await getResellerAllowedCustomers(id);
      if (listRes.success && listRes.data) {
        setList(listRes.data);
      }
    } catch (err) {
      setError(err?.message || "Failed to load data");
    } finally {
      setFetching(false);
    }
  };

  const fetchList = async () => {
    if (!resellerId) return;
    setListLoading(true);
    try {
      const listRes = await getResellerAllowedCustomers(resellerId);
      if (listRes.success && listRes.data) {
        setList(listRes.data);
      }
    } finally {
      setListLoading(false);
    }
  };

  const handleToggleChange = async (value) => {
    if (!resellerId) return;
    setToggleDropdown(false);
    setUpdatingToggle(true);
    setError("");
    try {
      const result = await updateMstReseller(resellerId, { allow_existing_customer: value });
      if (result?.success !== false) {
        setAllowExistingCustomer(value);
        setSuccess("Allow Only Existing Customer updated.");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result?.message || "Failed to update.");
      }
    } catch (err) {
      setError(err?.message || "Failed to update.");
    } finally {
      setUpdatingToggle(false);
    }
  };

  const handleBulkUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Please select a CSV or Excel file.");
      return;
    }
    const ext = (file.name || "").toLowerCase();
    if (!ext.endsWith(".csv") && !ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      setError("Please upload a CSV or Excel file (.csv, .xlsx, .xls).");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const { emails, phones } = await parseSheetForEmailsAndPhones(file);
      if (emails.length === 0 && phones.length === 0) {
        setError("No valid email or phone columns found. Use headers like 'email', 'phone', or 'mobile'.");
        setUploading(false);
        return;
      }
      const delRes = await deleteResellerAllowedCustomers(resellerId);
      if (!delRes.success) {
        setError(delRes.message || "Failed to clear existing list.");
        setUploading(false);
        return;
      }
      const objects = [
        ...emails.map((email) => ({ reseller_id: resellerId, email, phone: null })),
        ...phones.map((phone) => ({ reseller_id: resellerId, phone, email: null })),
      ];
      const insertRes = await insertResellerAllowedCustomers(objects);
      if (insertRes.success) {
        setSuccess(`List updated (${insertRes.affected_rows ?? 0} contact(s)).`);
        setTimeout(() => setSuccess(""), 4000);
        await fetchList();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setError(insertRes.message || "Failed to upload list.");
      }
    } catch (err) {
      setError(err?.message || "Failed to process file.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const eTrim = (addEmail || "").trim();
    const pTrim = (addPhone || "").replace(/\D/g, "");
    if (!eTrim && pTrim.length < 10) {
      setError("Enter at least one valid email or phone (10+ digits).");
      return;
    }
    setAddSubmitting(true);
    setError("");
    try {
      const result = await insertResellerAllowedCustomerOne(resellerId, {
        email: eTrim || null,
        phone: pTrim.length >= 10 ? pTrim : null,
      });
      if (result.success) {
        setAddModalOpen(false);
        setAddEmail("");
        setAddPhone("");
        setSuccess("Contact added.");
        setTimeout(() => setSuccess(""), 3000);
        await fetchList();
      } else {
        setError(result.message || "Failed to add contact.");
      }
    } catch (err) {
      setError(err?.message || "Failed to add contact.");
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEditModal = (row) => {
    setEditRow(row);
    setEditEmail(row.email || "");
    setEditPhone(row.phone || "");
    setEditModalOpen(true);
    setError("");
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editRow) return;
    const eTrim = (editEmail || "").trim();
    const pTrim = (editPhone || "").replace(/\D/g, "");
    if (!eTrim && pTrim.length < 10) {
      setError("Enter at least one valid email or phone (10+ digits).");
      return;
    }
    setEditSubmitting(true);
    setError("");
    try {
      const result = await updateResellerAllowedCustomerByPk(editRow.id, {
        email: eTrim || null,
        phone: pTrim.length >= 10 ? pTrim : null,
      });
      if (result.success) {
        setEditModalOpen(false);
        setEditRow(null);
        setSuccess("Contact updated.");
        setTimeout(() => setSuccess(""), 3000);
        await fetchList();
      } else {
        setError(result.message || "Failed to update.");
      }
    } catch (err) {
      setError(err?.message || "Failed to update.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const openDeleteModal = (row) => {
    setDeleteRow(row);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRow) return;
    setDeleteSubmitting(true);
    setError("");
    try {
      const result = await deleteResellerAllowedCustomerByPk(deleteRow.id);
      if (result.success) {
        setDeleteModalOpen(false);
        setDeleteRow(null);
        setSuccess("Contact removed.");
        setTimeout(() => setSuccess(""), 3000);
        await fetchList();
      } else {
        setError(result.message || "Failed to delete.");
      }
    } catch (err) {
      setError(err?.message || "Failed to delete.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (fetching) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !resellerId) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-body p-24">
        {error && (
          <div className="alert alert-danger radius-8 mb-24" role="alert">
            <Icon icon="material-symbols:error-outline" className="icon me-2" />
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success radius-8 mb-24" role="alert">
            {success}
          </div>
        )}

        {/* Allow Only Existing Customer */}
        <div className="mb-24">
          <label className="form-label fw-semibold text-primary-light text-sm mb-8">
            Allow Only Existing Customer
          </label>
          <div className="d-flex align-items-center gap-2">
            <span className="text-secondary-light">{allowExistingCustomer ? "Yes" : "No"}</span>
            <div className="position-relative">
              <button
                type="button"
                className="btn btn-sm btn-link text-primary p-0"
                onClick={() => setToggleDropdown((v) => !v)}
                disabled={updatingToggle}
                title="Edit"
                aria-label="Edit Allow Only Existing Customer"
              >
                <Icon icon="solar:pen-outline" className="icon" style={{ fontSize: "18px" }} />
              </button>
              {toggleDropdown && (
                <>
                  <div
                    className="position-fixed top-0 start-0 w-100 h-100"
                    style={{ zIndex: 10 }}
                    onClick={() => setToggleDropdown(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="dropdown-menu show position-absolute"
                    style={{ zIndex: 11, minWidth: "120px" }}
                  >
                    <button type="button" className="dropdown-item" onClick={() => handleToggleChange(true)}>
                      Yes
                    </button>
                    <button type="button" className="dropdown-item" onClick={() => handleToggleChange(false)}>
                      No
                    </button>
                  </div>
                </>
              )}
            </div>
            {updatingToggle && (
              <span className="spinner-border spinner-border-sm text-primary ms-2" role="status" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Allowed customers list */}
        <div>
          <label className="form-label fw-semibold text-primary-light text-sm mb-8">
            Allowed customers list
          </label>
          <p className="text-secondary-light text-xs mb-12">
            Upload a CSV or Excel file with columns for <strong>email</strong> and/or <strong>phone</strong>, or add contacts one by one. Only these contacts can sign up as customers when the option above is Yes.
          </p>

          <div className="d-flex align-items-center flex-wrap gap-2 mb-24">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="form-control form-control-sm w-auto"
              disabled={uploading}
              onChange={() => setError("")}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={uploading}
              onClick={handleBulkUpload}
            >
              {uploading ? "Uploading..." : "Upload list"}
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setAddEmail(""); setAddPhone(""); setError(""); setAddModalOpen(true); }}>
              Add contact
            </button>
            <a
              href="/sample-allowed-customers.csv"
              download="sample-allowed-customers.csv"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            >
              <Icon icon="mdi:download" className="icon text-lg" />
              Sample File
            </a>
          </div>

          {listLoading ? (
            <div className="text-center py-24">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-24 text-muted">
              <Icon icon="mdi:account-group-outline" className="icon text-4xl mb-2" />
              <p className="mb-0">No allowed contacts yet. Upload a file or add contacts above.</p>
            </div>
          ) : (
            <div className="table-responsive scroll-sm">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Email</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Created at</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.email || "-"}</td>
                      <td>{row.phone || "-"}</td>
                      <td>{formatDateIST(row.created_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-primary p-0 me-2"
                          onClick={() => openEditModal(row)}
                          title="Edit"
                        >
                          <Icon icon="solar:pen-outline" style={{ fontSize: "18px" }} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger p-0"
                          onClick={() => openDeleteModal(row)}
                          title="Delete"
                        >
                          <Icon icon="solar:trash-bin-outline" style={{ fontSize: "18px" }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      {addModalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content radius-12">
              <div className="modal-header border-bottom">
                <h5 className="modal-title text-md text-primary-light">Add contact</h5>
                <button type="button" className="btn-close" onClick={() => setAddModalOpen(false)} aria-label="Close" />
              </div>
              <form onSubmit={handleAddSubmit}>
                <div className="modal-body p-24">
                  <div className="mb-3">
                    <label className="form-label">Email (optional)</label>
                    <input
                      type="email"
                      className="form-control"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Phone (optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      placeholder="10+ digits"
                    />
                  </div>
                  <p className="text-muted small mt-2 mb-0">At least one of email or phone is required.</p>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-secondary" onClick={() => setAddModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={addSubmitting}>
                    {addSubmitting ? "Adding..." : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModalOpen && editRow && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content radius-12">
              <div className="modal-header border-bottom">
                <h5 className="modal-title text-md text-primary-light">Edit contact</h5>
                <button type="button" className="btn-close" onClick={() => setEditModalOpen(false)} aria-label="Close" />
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body p-24">
                  <div className="mb-3">
                    <label className="form-label">Email (optional)</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Phone (optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="10+ digits"
                    />
                  </div>
                  <p className="text-muted small mt-2 mb-0">At least one of email or phone is required.</p>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                    {editSubmitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteModalOpen && deleteRow && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content radius-12">
              <div className="modal-header border-bottom">
                <h5 className="modal-title text-md text-primary-light">Remove contact</h5>
                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)} aria-label="Close" />
              </div>
              <div className="modal-body p-24">
                <p className="mb-0">
                  Remove <strong>{deleteRow.email || deleteRow.phone || "this contact"}</strong> from the allowed list?
                </p>
              </div>
              <div className="modal-footer border-top">
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleteSubmitting}>
                  {deleteSubmitting ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllowedCustomersLayer;

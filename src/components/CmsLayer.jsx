import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill/dist/quill.snow.css";
import {
  getCmsPages,
  createCmsPage,
  updateCmsPage,
  deleteCmsPage,
} from "@/hasura/mutations/cms";
import { generateSlug } from "@/utils/slugGenerator";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getUserData, getAuthToken } from "@/utils/auth";

/** Reseller CMS: only these two page types (fixed titles + slugs for ClientHub links) */
const RESELLER_CMS_PAGE_TYPES = [
  { page_title: "Terms and Conditions", slug: "terms-and-conditions" },
  { page_title: "Privacy Policy", slug: "privacy-policy" },
];

const findResellerPageType = (page) => {
  if (!page) return null;
  return (
    RESELLER_CMS_PAGE_TYPES.find(
      (t) => t.page_title === page.page_title || t.slug === page.slug
    ) || null
  );
};

/** Only include fields that changed so the API does not overwrite untouched columns */
const buildCmsPageUpdateDiff = (editingPage, formData, isResellerRole, resellerId) => {
  const diff = {};
  const t = (s) => (s ?? "").trim();
  if (t(formData.page_title) !== t(editingPage.page_title)) {
    diff.page_title = formData.page_title.trim();
  }
  if ((formData.content ?? "") !== (editingPage.content ?? "")) {
    diff.content = formData.content;
  }
  if (t(formData.slug) !== t(editingPage.slug)) {
    diff.slug = formData.slug.trim();
  }
  if (!!formData.is_published !== !!editingPage.is_published) {
    diff.is_published = formData.is_published;
  }
  if (!isResellerRole) {
    const next =
      resellerId == null || resellerId === "" ? null : String(resellerId);
    const prev =
      editingPage.reseller_id == null ? null : String(editingPage.reseller_id);
    if (next !== prev) {
      diff.reseller_id = resellerId ?? null;
    }
  }
  return diff;
};

const CmsLayer = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const quillRef = useRef(null);

  const userData = getUserData();
  const roleFromToken = (() => {
    try {
      const token = getAuthToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload?.role ?? null;
    } catch {
      return null;
    }
  })();
  const isResellerRole = userData?.role === "reseller" || roleFromToken === "reseller";
  const currentResellerId = isResellerRole ? (userData?.id ?? null) : null;

  const [resellerFilter, setResellerFilter] = useState("all");
  const [resellers, setResellers] = useState([]);

  const [formData, setFormData] = useState({
    page_title: "",
    content: "",
    slug: "",
    is_published: false,
    reseller_id: null,
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  /** Reseller: at most 2 CMS pages (one per type); hide Add when both exist */
  const resellerCmsMaxReached = isResellerRole && pages.length >= RESELLER_CMS_PAGE_TYPES.length;

  /** Options for reseller title dropdown: types not already used by another page */
  const getResellerPageTypeOptions = (editingPage) => {
    return RESELLER_CMS_PAGE_TYPES.filter((opt) => {
      const usedByOther = pages.some(
        (p) =>
          p.id !== editingPage?.id &&
          (p.page_title === opt.page_title || p.slug === opt.slug)
      );
      return !usedByOther;
    });
  };

  useEffect(() => {
    if (!isResellerRole) {
      getMstResellers().then((res) => {
        if (res.success && res.data) setResellers(res.data);
      });
    }
  }, [isResellerRole]);

  useEffect(() => {
    fetchPages();
  }, [resellerFilter, currentResellerId]);

  const fetchPages = async () => {
    setLoading(true);
    setError("");
    try {
      const filter = isResellerRole
        ? { resellerId: currentResellerId }
        : resellerFilter === "all"
          ? undefined
          : resellerFilter === "admin"
            ? { resellerId: null }
            : { resellerId: resellerFilter };
      const result = await getCmsPages(filter);
      if (result.success) {
        setPages(result.data || []);
      } else {
        setError("Failed to load CMS pages");
      }
    } catch (err) {
      console.error("Error fetching CMS pages:", err);
      setError("An error occurred while loading CMS pages");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (page = null) => {
    if (!page && isResellerRole && resellerCmsMaxReached) {
      return;
    }
    if (page) {
      setEditingPage(page);
      const meta = isResellerRole ? findResellerPageType(page) : null;
      setFormData({
        page_title: meta?.page_title ?? page.page_title ?? "",
        content: page.content || "",
        slug: meta?.slug ?? page.slug ?? "",
        is_published: page.is_published || false,
        reseller_id: page.reseller_id ?? null,
      });
      setSlugManuallyEdited(true);
    } else {
      setEditingPage(null);
      setFormData({
        page_title: "",
        content: "",
        slug: "",
        is_published: false,
        reseller_id: isResellerRole ? currentResellerId : null,
      });
      setSlugManuallyEdited(false);
    }
    setModalOpen(true);
    setError("");
    setSuccess("");
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingPage(null);
    setFormData({
      page_title: "",
      content: "",
      slug: "",
      is_published: false,
      reseller_id: null,
    });
    setSlugManuallyEdited(false);
    setError("");
    setSuccess("");
  };

  const handlePageTitleChange = (e) => {
    const title = e.target.value;
    setFormData((prev) => ({
      ...prev,
      page_title: title,
    }));

    // Auto-generate slug if not manually edited
    if (!slugManuallyEdited) {
      setFormData((prev) => ({
        ...prev,
        page_title: title,
        slug: generateSlug(title),
      }));
    }
  };

  /** Reseller: fixed title + slug from predefined page types */
  const handleResellerPageTypeChange = (e) => {
    const title = e.target.value;
    const meta = RESELLER_CMS_PAGE_TYPES.find((t) => t.page_title === title);
    setSlugManuallyEdited(true);
    setFormData((prev) => ({
      ...prev,
      page_title: title,
      slug: meta ? meta.slug : "",
    }));
    setError("");
  };

  const handleSlugChange = (e) => {
    setSlugManuallyEdited(true);
    setFormData((prev) => ({
      ...prev,
      slug: e.target.value,
    }));
  };

  const handleContentChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      content: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.page_title.trim()) {
      setError("Page title is required");
      return;
    }

    if (!formData.slug.trim()) {
      setError("Slug is required");
      return;
    }

    if (!formData.content.trim()) {
      setError("Content is required");
      return;
    }

    if (isResellerRole) {
      const meta = RESELLER_CMS_PAGE_TYPES.find(
        (t) =>
          t.page_title === formData.page_title.trim() &&
          t.slug === formData.slug.trim()
      );
      if (!meta) {
        setError("Please select Terms and Conditions or Privacy Policy");
        return;
      }
      const duplicate = pages.some(
        (p) =>
          p.id !== editingPage?.id &&
          (p.page_title === meta.page_title || p.slug === meta.slug)
      );
      if (duplicate) {
        setError("A page with this title already exists. You can only have one of each type.");
        return;
      }
    }

    setActionLoading(true);
    try {
      const resellerId = isResellerRole ? currentResellerId : formData.reseller_id ?? null;
      let result;
      if (editingPage) {
        const updatePayload = buildCmsPageUpdateDiff(
          editingPage,
          formData,
          isResellerRole,
          resellerId
        );
        if (Object.keys(updatePayload).length === 0) {
          setSuccess("No changes to save");
          setTimeout(() => {
            setSuccess("");
            handleCloseModal();
          }, 1200);
          return;
        }
        result = await updateCmsPage(editingPage.id, updatePayload);
      } else {
        result = await createCmsPage({
          page_title: formData.page_title.trim(),
          content: formData.content,
          slug: formData.slug.trim(),
          is_published: formData.is_published,
          reseller_id: resellerId,
        });
      }

      if (result.success) {
        setSuccess(
          editingPage
            ? "CMS page updated successfully"
            : "CMS page created successfully"
        );
        setTimeout(() => {
          setSuccess("");
          handleCloseModal();
          fetchPages();
        }, 1500);
      } else {
        setError(result.message || "Failed to save CMS page");
      }
    } catch (err) {
      console.error("Error saving CMS page:", err);
      setError("An error occurred while saving CMS page");
    } finally {
      setActionLoading(false);
    }
  };

  const openDeleteConfirm = (id, title) => {
    setDeleteTarget({ id, title });
  };

  const closeDeleteConfirm = () => {
    if (actionLoading) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setActionLoading(true);
    try {
      const result = await deleteCmsPage(id);
      if (result.success) {
        setDeleteTarget(null);
        setSuccess("CMS page deleted successfully");
        setTimeout(() => {
          setSuccess("");
          fetchPages();
        }, 1500);
      } else {
        setError(result.message || "Failed to delete CMS page");
        setTimeout(() => setError(""), 5000);
      }
    } catch (err) {
      console.error("Error deleting CMS page:", err);
      setError("An error occurred while deleting CMS page");
      setTimeout(() => setError(""), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
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

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      ["link", "image"],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "color",
    "background",
    "link",
    "image",
  ];

  return (
    <div>
      <div className="card h-100 p-0 radius-12">
        <div className="card-header border-bottom bg-base py-16 px-24">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h5 className="text-md text-primary-light mb-0">CMS Pages</h5>
            <div className="d-flex align-items-center gap-2">
              {!isResellerRole && (
                <select
                  className="form-select form-select-sm w-auto"
                  value={resellerFilter}
                  onChange={(e) => setResellerFilter(e.target.value)}
                  aria-label="Filter by owner"
                >
                  <option value="all">All</option>
                  <option value="admin">Admin only</option>
                  {resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      Reseller: {r.brand_name || r.business_name || r.email || r.id}
                    </option>
                  ))}
                </select>
              )}
              {(!isResellerRole || !resellerCmsMaxReached) && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleOpenModal()}
                >
                  <Icon icon="lucide:plus" className="icon me-2" />
                  Add New Page
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="card-body p-24">
          {error && (
            <div className="alert alert-danger radius-8 mb-24" role="alert">
              <Icon
                icon="material-symbols:error-outline"
                className="icon me-2"
              />
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success radius-8 mb-24" role="alert">
              <Icon
                icon="material-symbols:check-circle-outline"
                className="icon me-2"
              />
              {success}
            </div>
          )}

          {loading ? (
            <div className="text-center py-40">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted mt-3">Loading CMS pages...</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-40">
              <Icon
                icon="mdi:file-document-outline"
                className="icon text-6xl text-muted mb-3"
              />
              <p className="text-muted">No CMS pages found</p>
              {(!isResellerRole || !resellerCmsMaxReached) && (
                <button
                  type="button"
                  className="btn btn-primary mt-3"
                  onClick={() => handleOpenModal()}
                >
                  <Icon icon="lucide:plus" className="icon me-2" />
                  Add Your First Page
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive scroll-sm">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">S.L</th>
                    <th scope="col">Page Title</th>
                    <th scope="col">Slug</th>
                    {!isResellerRole && <th scope="col">Owner</th>}
                    <th scope="col" className="text-center">Published</th>
                    <th scope="col">Created Date</th>
                    <th scope="col">Updated Date</th>
                    <th scope="col" className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page, index) => (
                    <tr key={page.id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="text-sm fw-medium">
                          {page.page_title}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-secondary-light">
                          {page.slug}
                        </span>
                      </td>
                      {!isResellerRole && (
                        <td>
                          <span className="text-sm">
                            {page.reseller_id == null
                              ? "Admin"
                              : (page.mst_reseller?.brand_name ||
                                  page.mst_reseller?.business_name ||
                                  page.mst_reseller?.email ||
                                  "Reseller")}
                          </span>
                        </td>
                      )}
                      <td className="text-center">
                        <span
                          className={`${
                            page.is_published
                              ? "bg-success-focus text-success-600 border border-success-main"
                              : "bg-danger-focus text-danger-600 border border-danger-main"
                          } px-24 py-4 radius-4 fw-medium text-sm`}
                        >
                          {page.is_published ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm">
                          {formatDate(page.created_date)}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm">
                          {formatDate(page.updated_date)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleOpenModal(page)}
                            disabled={actionLoading}
                          >
                            <Icon icon="lucide:edit" className="icon" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => openDeleteConfirm(page.id, page.page_title)}
                            disabled={actionLoading}
                          >
                            <Icon icon="lucide:trash-2" className="icon" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-delete-modal-title"
          tabIndex="-1"
          onClick={closeDeleteConfirm}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content radius-12">
              <div className="modal-header border-bottom">
                <h5
                  className="modal-title text-md text-primary-light mb-0"
                  id="cms-delete-modal-title"
                >
                  Delete page?
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeDeleteConfirm}
                  disabled={actionLoading}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body p-24">
                <p className="text-primary-light mb-0">
                  Are you sure you want to delete the page &quot;
                  {deleteTarget.title}&quot;? This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-secondary radius-8"
                  onClick={closeDeleteConfirm}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger radius-8"
                  onClick={confirmDelete}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-xl modal-dialog-scrollable" style={{ maxHeight: "90vh" }}>
            <div className="modal-content radius-12" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div className="modal-header border-bottom" style={{ flexShrink: 0 }}>
                <h5 className="modal-title text-md text-primary-light">
                  {editingPage ? "Edit CMS Page" : "Add New CMS Page"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseModal}
                  disabled={actionLoading}
                  aria-label="Close"
                />
              </div>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div className="modal-body p-24" style={{ overflowY: "auto", flex: 1 }}>
                  {error && (
                    <div
                      className="alert alert-danger radius-8 mb-24"
                      role="alert"
                    >
                      <Icon
                        icon="material-symbols:error-outline"
                        className="icon me-2"
                      />
                      {error}
                    </div>
                  )}

                  {success && (
                    <div
                      className="alert alert-success radius-8 mb-24"
                      role="alert"
                    >
                      <Icon
                        icon="material-symbols:check-circle-outline"
                        className="icon me-2"
                      />
                      {success}
                    </div>
                  )}

                  <div className="mb-20">
                    <label
                      htmlFor="page_title"
                      className="form-label fw-semibold text-primary-light text-sm mb-8"
                    >
                      Page Title <span className="text-danger-600">*</span>
                    </label>
                    {isResellerRole ? (
                      <>
                        <select
                          className="form-select radius-8"
                          id="page_title"
                          name="page_title"
                          value={formData.page_title}
                          onChange={handleResellerPageTypeChange}
                          required
                          disabled={actionLoading}
                        >
                          <option value="">
                           Select page type
                          </option>
                          {getResellerPageTypeOptions(editingPage).map((opt) => (
                            <option key={opt.slug} value={opt.page_title}>
                              {opt.page_title}
                            </option>
                          ))}
                        </select>
                      
                      </>
                    ) : (
                      <input
                        type="text"
                        className="form-control radius-8"
                        id="page_title"
                        name="page_title"
                        placeholder="Enter page title"
                        value={formData.page_title}
                        onChange={handlePageTitleChange}
                        required
                        disabled={actionLoading}
                      />
                    )}
                  </div>

                  {!isResellerRole && (
                    <div className="mb-20">
                      <label
                        htmlFor="owner"
                        className="form-label fw-semibold text-primary-light text-sm mb-8"
                      >
                        Owner
                      </label>
                      <select
                        className="form-select radius-8"
                        id="owner"
                        value={formData.reseller_id || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            reseller_id: e.target.value || null,
                          }))
                        }
                        disabled={actionLoading}
                      >
                        <option value="">Admin</option>
                        {resellers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.brand_name || r.business_name || r.email || r.id}
                          </option>
                        ))}
                      </select>
                      <small className="text-xs text-secondary-light mt-4 d-block">
                        Leave as Admin for pages shown on admin login/footer; select a reseller for that reseller&apos;s ClientHub/footer.
                      </small>
                    </div>
                  )}

                  <div className="mb-20">
                    <label
                      htmlFor="slug"
                      className="form-label fw-semibold text-primary-light text-sm mb-8"
                    >
                      Slug <span className="text-danger-600">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control radius-8"
                      id="slug"
                      name="slug"
                      placeholder="page-slug"
                      value={formData.slug}
                      onChange={handleSlugChange}
                      required
                      disabled={actionLoading || isResellerRole}
                    />
                    <small className="text-xs text-secondary-light mt-4 d-block">
                      {isResellerRole
                        ? "Set automatically from the page title you selected."
                        : "URL-friendly version of the page title. Auto-generated from title, but you can edit it manually."}
                    </small>
                  </div>

                  <div className="mb-20">
                    <label
                      htmlFor="content"
                      className="form-label fw-semibold text-primary-light text-sm mb-8"
                    >
                      Content <span className="text-danger-600">*</span>
                    </label>
                    <div className="border border-neutral-200 radius-8 overflow-hidden">
                      <div style={{ minHeight: "300px", maxHeight: "400px" }}>
                        <ReactQuill
                          ref={quillRef}
                          theme="snow"
                          value={formData.content}
                          onChange={handleContentChange}
                          modules={modules}
                          formats={formats}
                          placeholder="Enter page content..."
                          readOnly={actionLoading}
                          style={{ height: "350px" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-20">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="is_published"
                        checked={formData.is_published}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            is_published: e.target.checked,
                          }))
                        }
                        disabled={actionLoading}
                      />
                      <label
                        className="form-check-label text-sm text-primary-light"
                        htmlFor="is_published"
                      >
                        Publish this page
                      </label>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary radius-8"
                    onClick={handleCloseModal}
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
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        {editingPage ? "Updating..." : "Creating..."}
                      </>
                    ) : editingPage ? (
                      "Update Page"
                    ) : (
                      "Create Page"
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

export default CmsLayer;


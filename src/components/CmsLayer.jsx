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

const CmsLayer = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const quillRef = useRef(null);

  const [formData, setFormData] = useState({
    page_title: "",
    content: "",
    slug: "",
    is_published: false,
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCmsPages();
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
    if (page) {
      setEditingPage(page);
      setFormData({
        page_title: page.page_title || "",
        content: page.content || "",
        slug: page.slug || "",
        is_published: page.is_published || false,
      });
      setSlugManuallyEdited(true);
    } else {
      setEditingPage(null);
      setFormData({
        page_title: "",
        content: "",
        slug: "",
        is_published: false,
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

    setActionLoading(true);
    try {
      let result;
      if (editingPage) {
        result = await updateCmsPage(editingPage.id, {
          page_title: formData.page_title.trim(),
          content: formData.content,
          slug: formData.slug.trim(),
          is_published: formData.is_published,
        });
      } else {
        result = await createCmsPage({
          page_title: formData.page_title.trim(),
          content: formData.content,
          slug: formData.slug.trim(),
          is_published: formData.is_published,
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

  const handleDelete = async (id, title) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the page "${title}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      const result = await deleteCmsPage(id);
      if (result.success) {
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
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="text-md text-primary-light mb-0">CMS Pages</h5>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleOpenModal()}
            >
              <Icon icon="lucide:plus" className="icon me-2" />
              Add New Page
            </button>
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
              <button
                type="button"
                className="btn btn-primary mt-3"
                onClick={() => handleOpenModal()}
              >
                <Icon icon="lucide:plus" className="icon me-2" />
                Add Your First Page
              </button>
            </div>
          ) : (
            <div className="table-responsive scroll-sm">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">S.L</th>
                    <th scope="col">Page Title</th>
                    <th scope="col">Slug</th>
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
                            onClick={() => handleDelete(page.id, page.page_title)}
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
                  </div>

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
                      disabled={actionLoading}
                    />
                    <small className="text-xs text-secondary-light mt-4 d-block">
                      URL-friendly version of the page title. Auto-generated from
                      title, but you can edit it manually.
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


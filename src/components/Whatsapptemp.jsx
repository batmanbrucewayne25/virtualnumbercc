import { useState, useEffect } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { getUserData, getAuthToken } from "@/utils/auth";
import { getMstWhatsappTemplatesByResellerId, createMstWhatsappTemplate, updateMstWhatsappTemplate, deleteMstWhatsappTemplate } from "@/hasura/mutations/whatsappTemplate";

const TEMPLATE_TYPES = [
  { value: "otp", label: "OTP" },
  { value: "notification", label: "Notification" },
  { value: "payment_link", label: "Payment Link" },
];

const WhatsAppTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({
    template_name: "",
    template_type: "",
    template_id: "",
    message_body: "",
    variables: "",
    is_active: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [resellerId, setResellerId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    // Get logged-in reseller ID
    const userData = getUserData();
    const token = getAuthToken();
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'reseller' && userData?.id) {
          setResellerId(userData.id);
          fetchTemplates(userData.id);
        } else {
          setError("Only resellers can manage WhatsApp templates");
          setFetching(false);
        }
      } catch (err) {
        console.error("Error decoding token:", err);
        setError("Failed to authenticate user");
        setFetching(false);
      }
    } else {
      setError("Please login to manage WhatsApp templates");
      setFetching(false);
    }
  }, []);

  const fetchTemplates = async (resellerId) => {
    setFetching(true);
    setError("");
    try {
      const result = await getMstWhatsappTemplatesByResellerId(resellerId);
      if (result.success) {
        setTemplates(result.data || []);
      } else {
        setError(result.message || "Failed to fetch templates");
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("An error occurred while loading templates");
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ 
      ...form, 
      [name]: type === "checkbox" ? checked : value 
    });
    setError("");
  };

  const handleEdit = (template) => {
    setEditingId(template.id);
    setForm({
      template_name: template.template_name || "",
      template_type: template.template_type || "",
      template_id: template.template_id || "",
      message_body: template.message_body || "",
      variables: template.variables ? Object.keys(template.variables).join(", ") : "",
      is_active: template.is_active !== undefined ? template.is_active : true,
    });
    setShowForm(true);
    setPreview(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}"?`)) {
      return;
    }

    try {
      const result = await deleteMstWhatsappTemplate(id);
      if (result.success) {
        setSuccess("Template deleted successfully");
        fetchTemplates(resellerId);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result.message || "Failed to delete template");
      }
    } catch (err) {
      console.error("Error deleting template:", err);
      setError("An error occurred while deleting template");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      template_name: "",
      template_type: "",
      template_id: "",
      message_body: "",
      variables: "",
      is_active: true,
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!resellerId) {
      setError("Reseller ID not found. Please login again.");
      return;
    }

    if (!form.template_name || !form.template_type || !form.template_id || !form.message_body) {
      setError("Please fill all required WhatsApp template fields");
      return;
    }

    setLoading(true);
    try {
      const variablesObj = form.variables
        ? form.variables.split(",").reduce((acc, v) => {
            const trimmed = v.trim();
            if (trimmed) acc[trimmed] = trimmed;
            return acc;
          }, {})
        : null;

      let result;
      if (editingId) {
        result = await updateMstWhatsappTemplate(editingId, {
          template_name: form.template_name.trim(),
          template_type: form.template_type,
          template_id: form.template_id.trim(),
          message_body: form.message_body.trim(),
          variables: variablesObj,
          is_active: form.is_active,
        });
      } else {
        result = await createMstWhatsappTemplate(resellerId, {
          template_name: form.template_name.trim(),
          template_type: form.template_type,
          template_id: form.template_id.trim(),
          message_body: form.message_body.trim(),
          variables: variablesObj,
          is_active: form.is_active,
        });
      }

      if (result.success) {
        setSuccess(result.message || "Template saved successfully");
        handleCancel();
        fetchTemplates(resellerId);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result.message || "Failed to save template");
      }
    } catch (err) {
      console.error("Error saving template:", err);
      setError(err.message || "An error occurred while saving template");
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
    });
  };

  if (fetching) {
    return (
      <div className='card h-100 p-0 radius-12 overflow-hidden'>
        <div className='card-body p-40'>
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading WhatsApp templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='card h-100 p-0 radius-12 overflow-hidden'>
      <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
        <h5 className='text-md text-primary-light mb-0'>WhatsApp Templates</h5>
        {!showForm && (
          <button
            type='button'
            className='btn btn-primary text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2'
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm({
                template_name: "",
                template_type: "",
                template_id: "",
                message_body: "",
                variables: "",
                is_active: true,
              });
            }}
          >
            <Icon icon='ic:baseline-plus' className='icon text-xl line-height-1' />
            Add Template
          </button>
        )}
      </div>
      <div className='card-body p-40'>
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

        {showForm ? (
          <form onSubmit={handleSubmit}>
            <div className='row'>
              {/* Template Name */}
              <div className='col-sm-6'>
                <div className='mb-20'>
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Template Name <span className='text-danger-600'>*</span>
                  </label>
                  <input
                    type='text'
                    name='template_name'
                    className='form-control radius-8'
                    placeholder='e.g. OTP WhatsApp'
                    value={form.template_name}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Template Type */}
              <div className='col-sm-6'>
                <div className='mb-20'>
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Template Type <span className='text-danger-600'>*</span>
                  </label>
                  <select
                    name='template_type'
                    className='form-control radius-8 form-select'
                    value={form.template_type}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value=''>Select Template Type</option>
                    {TEMPLATE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Template ID */}
              <div className='col-sm-12'>
                <div className='mb-20'>
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Template ID (Meta) <span className='text-danger-600'>*</span>
                  </label>
                  <input
                    type='text'
                    name='template_id'
                    className='form-control radius-8'
                    placeholder='otp_confirmation_v1'
                    value={form.template_id}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <small className='text-secondary'>
                    Must match the approved template ID in Meta WhatsApp Business API
                  </small>
                </div>
              </div>

              {/* Variables */}
              <div className='col-sm-12'>
                <div className='mb-20'>
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Template Variables (comma separated)
                  </label>
                  <input
                    type='text'
                    name='variables'
                    className='form-control radius-8'
                    placeholder='name, otp, amount'
                    value={form.variables}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <small className='text-secondary'>
                    Use numbered variables: <b>{`{{1}}`}</b>, <b>{`{{2}}`}</b>
                  </small>
                </div>
              </div>

              {/* Message Body */}
              <div className='col-sm-12'>
                <div className='mb-20'>
                  <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                    Message Body <span className='text-danger-600'>*</span>
                  </label>
                  <textarea
                    name='message_body'
                    rows='6'
                    className='form-control radius-8'
                    placeholder={`Hello {{1}}, your OTP is {{2}}`}
                    value={form.message_body}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Active Status */}
              <div className='col-sm-12'>
                <div className='mb-20'>
                  <div className='form-check form-switch'>
                    <input
                      className='form-check-input'
                      type='checkbox'
                      id='is_active'
                      name='is_active'
                      checked={form.is_active}
                      onChange={handleChange}
                      disabled={loading}
                    />
                    <label
                      className='form-check-label fw-semibold text-primary-light text-sm'
                      htmlFor='is_active'
                    >
                      Active
                    </label>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className='col-sm-12'>
                <div className='d-flex align-items-center gap-3'>
                  <button
                    type='button'
                    className='btn btn-outline-secondary'
                    onClick={() => setPreview(!preview)}
                    disabled={loading}
                  >
                    {preview ? "Hide Preview" : "Preview"}
                  </button>
                  <button
                    type='button'
                    className='btn btn-secondary'
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='btn btn-primary border border-primary-600 px-40 py-11 radius-8'
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      editingId ? "Update Template" : "Save Template"
                    )}
                  </button>
                </div>
              </div>

              {/* Preview */}
              {preview && (
                <div className='col-sm-12 mt-24'>
                  <h6>WhatsApp Preview</h6>
                  <div className='border radius-8 p-16 bg-light'>
                    <pre style={{ whiteSpace: "pre-wrap" }}>{form.message_body}</pre>
                  </div>
                </div>
              )}
            </div>
          </form>
        ) : (
          <>
            {templates.length === 0 ? (
              <div className='text-center py-40'>
                <Icon icon='mdi:whatsapp' className='icon text-6xl text-muted mb-3' />
                <p className='text-muted'>No templates found</p>
              </div>
            ) : (
              <div className='table-responsive scroll-sm'>
                <table className='table bordered-table mb-0'>
                  <thead>
                    <tr>
                      <th scope='col'>S.L</th>
                      <th scope='col'>Template Name</th>
                      <th scope='col'>Type</th>
                      <th scope='col'>Template ID</th>
                      <th scope='col' className='text-center'>Status</th>
                      <th scope='col' className='text-center'>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template, index) => (
                      <tr key={template.id}>
                        <td>{index + 1}</td>
                        <td>{template.template_name}</td>
                        <td>
                          <span className='text-md fw-normal text-secondary-light'>
                            {TEMPLATE_TYPES.find(t => t.value === template.template_type)?.label || template.template_type}
                          </span>
                        </td>
                        <td>{template.template_id}</td>
                        <td className='text-center'>
                          <span
                            className={`${
                              template.is_active
                                ? "bg-success-focus text-success-600 border border-success-main"
                                : "bg-danger-focus text-danger-600 border border-danger-main"
                            } px-24 py-4 radius-4 fw-medium text-sm`}
                          >
                            {template.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className='text-center'>
                          <div className='d-flex align-items-center gap-10 justify-content-center'>
                            <button
                              type='button'
                              onClick={() => handleEdit(template)}
                              className='bg-success-focus text-success-600 bg-hover-success-200 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle border-0'
                              title='Edit'
                            >
                              <Icon icon='lucide:edit' className='menu-icon' />
                            </button>
                            <button
                              type='button'
                              onClick={() => handleDelete(template.id, template.template_name)}
                              className='bg-danger-focus bg-hover-danger-200 text-danger-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle border-0'
                              title='Delete'
                            >
                              <Icon icon='fluent:delete-24-regular' className='menu-icon' />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WhatsAppTemplates;

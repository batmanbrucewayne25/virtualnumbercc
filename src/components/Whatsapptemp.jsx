import { useState } from "react";

const TEMPLATE_TYPES = [
  { value: "OTP", label: "OTP Message" },
  { value: "ACCOUNT_APPROVED", label: "Account Approved" },
  { value: "ACCOUNT_REJECTED", label: "Account Rejected" },
  { value: "PAYMENT_REMINDER", label: "Payment Reminder" },
  { value: "ORDER_UPDATE", label: "Order Update" },
  { value: "PASSWORD_RESET", label: "Password Reset" },
];

const MESSAGE_CATEGORIES = [
  "AUTHENTICATION",
  "UTILITY",
  "MARKETING",
];

const WhatsAppTemplates = () => {
  const [form, setForm] = useState({
    templateName: "",
    templateType: "",
    metaTemplateName: "",
    category: "UTILITY",
    language: "en",
    body: "",
    variables: "",
  });

  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !form.templateName ||
      !form.templateType ||
      !form.metaTemplateName ||
      !form.body
    ) {
      setError("Please fill all required WhatsApp template fields");
      return;
    }

    const payload = {
      templateName: form.templateName,
      templateType: form.templateType,
      metaTemplateName: form.metaTemplateName, // Used by Meta API
      category: form.category,
      language: form.language,
      body: form.body,
      variables: form.variables
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    };

    console.log("WHATSAPP TEMPLATE PAYLOAD:", payload);

    // 🔐 Backend API call here
    setSuccess("WhatsApp template saved successfully");
  };

  return (
    <div className='card h-100 p-0 radius-12 overflow-hidden'>
      <div className='card-body p-40'>

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
                  name='templateName'
                  className='form-control radius-8'
                  placeholder='e.g. OTP WhatsApp'
                  value={form.templateName}
                  onChange={handleChange}
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
                  name='templateType'
                  className='form-control radius-8 form-select'
                  value={form.templateType}
                  onChange={handleChange}
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

            {/* Meta Template Name */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Meta Template Name <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='text'
                  name='metaTemplateName'
                  className='form-control radius-8'
                  placeholder='otp_confirmation_v1'
                  value={form.metaTemplateName}
                  onChange={handleChange}
                />
                <small className='text-secondary'>
                  Must match the approved template name in Meta
                </small>
              </div>
            </div>

            {/* Category */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Message Category
                </label>
                <select
                  name='category'
                  className='form-control radius-8 form-select'
                  value={form.category}
                  onChange={handleChange}
                >
                  {MESSAGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Language */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Language
                </label>
                <select
                  name='language'
                  className='form-control radius-8 form-select'
                  value={form.language}
                  onChange={handleChange}
                >
                  <option value='en'>English</option>
                  <option value='ta'>Tamil</option>
                  <option value='hi'>Hindi</option>
                </select>
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
                />
                <small className='text-secondary'>
                  Use numbered variables: <b>{`{{1}}`}</b>, <b>{`{{2}}`}</b>
                </small>
              </div>
            </div>

            {/* Body */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Message Body <span className='text-danger-600'>*</span>
                </label>
                <textarea
                  name='body'
                  rows='6'
                  className='form-control radius-8'
                  placeholder={`Hello {{1}}, your OTP is {{2}}`}
                  value={form.body}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Messages */}
            {error && <p className='text-danger-600'>{error}</p>}
            {success && <p className='text-success-600'>{success}</p>}

            {/* Buttons */}
            <div className='col-sm-12'>
              <div className='d-flex align-items-center gap-3'>
                <button
                  type='button'
                  className='btn btn-outline-secondary'
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? "Hide Preview" : "Preview"}
                </button>

                <button
                  type='submit'
                  className='btn btn-primary border border-primary-600 px-40 py-11 radius-8'
                >
                  Save Template
                </button>
              </div>
            </div>

            {/* Preview */}
            {preview && (
              <div className='col-sm-12 mt-24'>
                <h6>WhatsApp Preview</h6>
                <div className='border radius-8 p-16 bg-light'>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{form.body}</pre>
                </div>
              </div>
            )}

          </div>
        </form>
      </div>
    </div>
  );
};

export default WhatsAppTemplates;

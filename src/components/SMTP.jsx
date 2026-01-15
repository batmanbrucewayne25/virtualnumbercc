import { useState } from "react";

const SMTPSettings = () => {
  const [form, setForm] = useState({
    smtpHost: "",
    smtpPort: "",
    encryption: "ssl",
    smtpUser: "",
    smtpPassword: "",
    fromName: "",
    fromEmail: "",
    footerText: "",
    testEmail: "",
  });

  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target.result);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const requiredFields = [
      "smtpHost",
      "smtpPort",
      "smtpUser",
      "smtpPassword",
      "fromEmail",
    ];

    for (let field of requiredFields) {
      if (!form[field]) {
        setError("Please fill all required SMTP fields");
        return;
      }
    }

    console.log("SMTP + Branding Payload:", {
      ...form,
      logo: logoPreview,
    });

    setSuccess("SMTP settings saved successfully");
    // 🔐 Backend API call here
  };

  return (
    <div className='card h-100 p-0 radius-12 overflow-hidden'>
      <div className='card-body p-40'>
        <form onSubmit={handleSubmit}>
          <div className='row'>

            {/* SMTP Host */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  SMTP Host <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='text'
                  name='smtpHost'
                  className='form-control radius-8'
                  placeholder='smtp.yourdomain.com'
                  value={form.smtpHost}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* SMTP Port */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  SMTP Port <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='number'
                  name='smtpPort'
                  className='form-control radius-8'
                  placeholder='465 or 587'
                  value={form.smtpPort}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Encryption */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Encryption
                </label>
                <select
                  name='encryption'
                  className='form-control radius-8 form-select'
                  value={form.encryption}
                  onChange={handleChange}
                >
                  <option value='ssl'>SSL</option>
                  <option value='tls'>TLS</option>
                  <option value='none'>None</option>
                </select>
              </div>
            </div>

            {/* SMTP Username */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  SMTP Username <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='email'
                  name='smtpUser'
                  className='form-control radius-8'
                  placeholder='no-reply@yourdomain.com'
                  value={form.smtpUser}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* SMTP Password */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  SMTP Password <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='password'
                  name='smtpPassword'
                  className='form-control radius-8'
                  placeholder='App password'
                  value={form.smtpPassword}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* From Name */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  From Name
                </label>
                <input
                  type='text'
                  name='fromName'
                  className='form-control radius-8'
                  placeholder='Your Company Name'
                  value={form.fromName}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* From Email */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  From Email <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='email'
                  name='fromEmail'
                  className='form-control radius-8'
                  placeholder='support@yourdomain.com'
                  value={form.fromEmail}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Email Logo
                </label>
                <input
                  type='file'
                  className='form-control radius-8'
                  accept='image/*'
                  onChange={handleLogoUpload}
                />
                {logoPreview && (
                  <img
                    src={logoPreview}
                    alt='Logo Preview'
                    className='mt-12'
                    style={{ maxHeight: 60 }}
                  />
                )}
              </div>
            </div>

            {/* Footer Text */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Email Footer
                </label>
                <textarea
                  name='footerText'
                  className='form-control radius-8'
                  placeholder='Company address, support email, disclaimer...'
                  value={form.footerText}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Test Email */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Test Email Address
                </label>
                <input
                  type='email'
                  name='testEmail'
                  className='form-control radius-8'
                  placeholder='your@email.com'
                  value={form.testEmail}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Messages */}
            {error && <p className='text-danger-600'>{error}</p>}
            {success && <p className='text-success-600'>{success}</p>}

            {/* Buttons */}
            <div className='col-sm-12'>
              <div className='d-flex align-items-center justify-content-center gap-3 mt-24'>
                <button
                  type='reset'
                  className='border border-danger-600 bg-hover-danger-200 text-danger-600 px-40 py-11 radius-8'
                  onClick={() => {
                    setForm({
                      smtpHost: "",
                      smtpPort: "",
                      encryption: "ssl",
                      smtpUser: "",
                      smtpPassword: "",
                      fromName: "",
                      fromEmail: "",
                      footerText: "",
                      testEmail: "",
                    });
                    setLogoPreview(null);
                    setError("");
                    setSuccess("");
                  }}
                >
                  Reset
                </button>

                <button
                  type='submit'
                  className='btn btn-primary border border-primary-600 px-40 py-11 radius-8'
                >
                  Save SMTP Settings
                </button>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
};

export default SMTPSettings;

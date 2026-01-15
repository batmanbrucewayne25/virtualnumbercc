import { useState } from "react";

const PasswordField = ({
  value,
  onChange,
  id,
  placeholder = "Password",
  className = "",
  required = false,
  name,
  disableToggle = false,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={disableToggle ? "" : "position-relative"}>
      <input
        type={visible ? "text" : "password"}
        className={`form-control h-56-px ${className}`}
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
      />

      {!disableToggle && (
        <button
          type="button"
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={(e) => {
            e.preventDefault();
            setVisible((v) => !v);
          }}
          className={`toggle-password cursor-pointer position-absolute end-0 top-50 translate-middle-y me-16 text-secondary-light btn btn-unstyled`}
        >
          <i className={visible ? "ri-eye-off-line" : "ri-eye-line"} />
        </button>
      )}
    </div>
  );
};

export default PasswordField;

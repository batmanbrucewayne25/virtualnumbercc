import { useState } from "react";

const PasswordField = ({
  value,
  onChange,
  defaultValue,
  id,
  placeholder = "Password",
  className = "",
  required = false,
  name,
  disableToggle = false,
  disabled = false,
  autoComplete = "off",
}) => {
  const isControlled = value !== undefined;
  const [visible, setVisible] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(
    () => defaultValue ?? ""
  );

  const displayValue = isControlled ? value ?? "" : uncontrolledValue;

  const handleChange = (e) => {
    if (!isControlled) {
      setUncontrolledValue(e.target.value);
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className={disableToggle ? "" : "position-relative"}>
      <input
        type={visible ? "text" : "password"}
        className={["form-control", "h-56-px", className].filter(Boolean).join(" ")}
        id={id}
        name={name}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
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

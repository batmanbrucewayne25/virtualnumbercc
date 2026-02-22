import { Icon } from "@iconify/react";
import { Link } from "react-router-dom";
// eslint-disable-next-line react/prop-types
const Breadcrumb = ({ title, expiryDate }) => {
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const calculateDaysLeft = (expiryDate) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysLeft = expiryDate ? calculateDaysLeft(expiryDate) : null;
  const isExpired = daysLeft !== null && daysLeft < 0;
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

  return (
    <div className='d-flex flex-wrap align-items-center justify-content-between gap-3 mb-24'>
      <h6 className='fw-semibold mb-0'>{title}</h6>
      {expiryDate && (
        <div className='d-flex align-items-center gap-2'>
          <Icon
            icon='solar:calendar-date-outline'
            className='icon text-lg text-secondary-light'
          />
          <div className='d-flex flex-column align-items-end'>
            <span className='text-xs text-secondary-light'>Expiry Date</span>
            <span
              className={`text-sm fw-medium ${
                isExpired
                  ? "text-danger-600"
                  : isExpiringSoon
                  ? "text-warning-600"
                  : "text-primary-light"
              }`}
            >
              {formatDate(expiryDate)}
            </span>
            {daysLeft !== null && (
              <span
                className={`text-xs ${
                  isExpired
                    ? "text-danger-600"
                    : isExpiringSoon
                    ? "text-warning-600"
                    : "text-secondary-light"
                }`}
              >
                {isExpired
                  ? `Expired ${Math.abs(daysLeft)} days ago`
                  : `${daysLeft} days left`}
              </span>
            )}
          </div>
        </div>
      )}
      {/* <ul className='d-flex align-items-center gap-2'>
        <li className='fw-medium'>
          <Link
            to='/index'
            className='d-flex align-items-center gap-1 hover-text-primary'
          >
            <Icon
              icon='solar:home-smile-angle-outline'
              className='icon text-lg'
            />
            Dashboard
          </Link>
        </li>
        <li> - </li>
        <li className='fw-medium'>{title}</li>
      </ul> */}
    </div>
  );
};

export default Breadcrumb;

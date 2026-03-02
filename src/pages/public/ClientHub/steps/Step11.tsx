import { Icon } from "@iconify/react";

interface Step11Props {
  resellerName: string;
}

const Step11 = ({ resellerName }: Step11Props) => {
  return (
    <>
      <div className="text-center mb-24">
        <h4 className="mb-8">Registration Successful!</h4>
        <p className="text-sm text-secondary-light mb-0">
          Your registration has been submitted successfully.
        </p>
      </div>

      <div className="alert alert-info mb-24">
        <div className="d-flex align-items-start gap-12">
          <Icon icon="solar:info-circle-bold" className="text-info-main text-lg flex-shrink-0 mt-2" />
          <div>
            <p className="mb-0 fw-semibold">What's Next?</p>
            <p className="mb-0 text-sm mt-4">
              Admin <strong>{resellerName}</strong> will contact you soon to complete your onboarding process.
            </p>
          </div>
        </div>
      </div>

      <div className="card border mb-16">
        <div className="card-body p-16">
          <h6 className="mb-12 fw-semibold">What to expect:</h6>
          <ul className="list-unstyled mb-0">
            <li className="mb-8 d-flex align-items-start gap-8">
              <Icon icon="solar:check-circle-bold" className="text-success-main text-sm flex-shrink-0 mt-2" />
              <span className="text-sm text-secondary-light">
                You will receive a confirmation email with your account details
              </span>
            </li>
            <li className="mb-8 d-flex align-items-start gap-8">
              <Icon icon="solar:check-circle-bold" className="text-success-main text-sm flex-shrink-0 mt-2" />
              <span className="text-sm text-secondary-light">
                Our team will review your submitted documents
              </span>
            </li>
            <li className="d-flex align-items-start gap-8">
              <Icon icon="solar:check-circle-bold" className="text-success-main text-sm flex-shrink-0 mt-2" />
              <span className="text-sm text-secondary-light">
                You'll be contacted within 24-48 hours to proceed further
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-secondary-light mb-0">
          For any queries, please contact our support team.
        </p>
      </div>
    </>
  );
};

export default Step11;


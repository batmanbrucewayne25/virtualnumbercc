import { Link } from "react-router-dom";

const AccessDeniedLayer = () => {
  return (
    <div className='custom-bg'>
      <div className='container container--xl'>
        <div className='d-flex align-items-center justify-content-between py-24'>
          <Link to='/' className=''>
            <img src='assets/images/own/dlogo.png' alt='WowDash React Vite' />
          </Link>
          <Link to='/' className='btn btn-outline-primary-600 text-sm'>
            {" "}
            Go To Home{" "}
          </Link>
        </div>
        <div className='pt-48 pb-40 text-center'>
          <div className='max-w-500-px mx-auto'>
            <img
              src='assets/images/own/access denied.png'
              alt='WowDash React Vite'
            />
          </div>
          <div className='max-w-700-px mx-auto mt-40'>
            <h3 className='mb-24 max-w-1000-px'>Access Denied</h3>
            <p className='text-neutral-500 max-w-700-px text-lg'>
              Your account has been suspended. Kindly contact your *(Reseller name) for further information
            </p>
            <Link
              to='/'
              className='btn btn-primary-600 px-32 py-16 flex-shrink-0 d-inline-flex align-items-center justify-content-center gap-8 mt-28'
            >
              <i className='ri-home-4-line' /> Go Back To Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedLayer;

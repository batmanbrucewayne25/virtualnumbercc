const RazorPay = () => {
  return (
    <div className='col-xxl-6'>
      <div className='card radius-12 shadow-none border overflow-hidden'>
        {/* Header */}
        <div className='card-header bg-neutral-100 border-bottom py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
          <div className='d-flex align-items-center gap-10'>
            <span className='w-36-px h-36-px bg-base rounded-circle d-flex justify-content-center align-items-center'>
              <img
                src='assets/images/payment/payment-gateway2.png'
                alt='razorpay'
              />
            </span>
            <span className='text-lg fw-semibold text-primary-light'>
              Razorpay
            </span>
          </div>

          {/* Enable / Disable */}
          <div className='form-switch switch-primary d-flex align-items-center justify-content-center'>
            <input
              className='form-check-input'
              type='checkbox'
              role='switch'
              id='razorpayEnable'
            />
          </div>
        </div>

        {/* Body */}
        <div className='card-body p-24'>
          <div className='row gy-3'>
            {/* Environment */}
            <div className='col-sm-6'>
              <span className='form-label fw-semibold text-primary-light text-md mb-8'>
                Environment <span className='text-danger-600'>*</span>
              </span>
              <div className='d-flex align-items-center gap-3'>
                <div className='d-flex align-items-center gap-10'>
                  <input
                    className='form-check-input radius-4 border border-neutral-500'
                    type='radio'
                    name='razorpayEnvironment'
                    id='razorpayTest'
                    value='test'
                  />
                  <label
                    htmlFor='razorpayTest'
                    className='form-label fw-medium text-lg text-primary-light mb-0'
                  >
                    Test
                  </label>
                </div>

                <div className='d-flex align-items-center gap-10'>
                  <input
                    className='form-check-input radius-4 border border-neutral-500'
                    type='radio'
                    name='razorpayEnvironment'
                    id='razorpayLive'
                    value='live'
                  />
                  <label
                    htmlFor='razorpayLive'
                    className='form-label fw-medium text-lg text-primary-light mb-0'
                  >
                    Live
                  </label>
                </div>
              </div>
            </div>

            {/* Currency */}
            <div className='col-sm-6'>
              <label
                htmlFor='razorpayCurrency'
                className='form-label fw-semibold text-primary-light text-md mb-8'
              >
                Currency <span className='text-danger-600'>*</span>
              </label>
              <select
                className='form-control radius-8 form-select'
                id='razorpayCurrency'
              >
                <option value='INR'>INR</option>
              </select>
            </div>

            {/* Key ID */}
            <div className='col-sm-6'>
              <label
                htmlFor='razorpayKeyId'
                className='form-label fw-semibold text-primary-light text-md mb-8'
              >
                Key ID <span className='text-danger-600'>*</span>
              </label>
              <input
                type='text'
                className='form-control radius-8'
                id='razorpayKeyId'
                placeholder='rzp_test_xxxxxxxxxx'
              />
            </div>

            {/* Key Secret */}
            <div className='col-sm-6'>
              <label
                htmlFor='razorpayKeySecret'
                className='form-label fw-semibold text-primary-light text-md mb-8'
              >
                Key Secret <span className='text-danger-600'>*</span>
              </label>
              <input
                type='password'
                className='form-control radius-8'
                id='razorpayKeySecret'
                placeholder='Enter Razorpay key secret'
              />
            </div>

            {/* Webhook Secret (Optional) */}
            <div className='col-sm-12'>
              <label
                htmlFor='razorpayWebhookSecret'
                className='form-label fw-semibold text-primary-light text-md mb-8'
              >
                Webhook Secret (Optional)
              </label>
              <input
                type='text'
                className='form-control radius-8'
                id='razorpayWebhookSecret'
                placeholder='Webhook secret'
              />
            </div>

            {/* Save Button */}
            <div className='col-sm-12'>
              <button
                type='submit'
                className='btn btn-primary border border-primary-600 text-md px-24 py-8 radius-8 w-100 text-center'
              >
                Save Change
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RazorPay;

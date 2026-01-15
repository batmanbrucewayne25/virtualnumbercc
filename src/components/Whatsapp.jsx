const Whatsapplayer = () => {
  return (
    <div className='card h-100 p-0 radius-12 overflow-hidden'>
      <div className='card-body p-40'>
        <form action='#'>
          <div className='row'>
            {/* Access Token */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label
                  htmlFor='whatsappAccessToken'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Access Token <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='password'
                  className='form-control radius-8'
                  id='whatsappAccessToken'
                  placeholder='Enter Meta WhatsApp access token'
                />
              </div>
            </div>

            {/* Phone Number ID */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label
                  htmlFor='phoneNumberId'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Phone Number ID <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='text'
                  className='form-control radius-8'
                  id='phoneNumberId'
                  placeholder='WhatsApp phone number ID'
                />
              </div>
            </div>

            {/* Business Account ID */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label
                  htmlFor='businessAccountId'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Business Account ID <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='text'
                  className='form-control radius-8'
                  id='businessAccountId'
                  placeholder='Meta business account ID'
                />
              </div>
            </div>

            {/* Webhook Verify Token */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label
                  htmlFor='webhookVerifyToken'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Webhook Verify Token <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='text'
                  className='form-control radius-8'
                  id='webhookVerifyToken'
                  placeholder='Webhook verification token'
                />
              </div>
            </div>

            {/* Webhook URL */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label
                  htmlFor='webhookUrl'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Webhook URL <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='url'
                  className='form-control radius-8'
                  id='webhookUrl'
                  placeholder='https://yourdomain.com/webhook/whatsapp'
                />
              </div>
            </div>

            {/* Default Language */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label
                  htmlFor='defaultLanguage'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Default Language <span className='text-danger-600'>*</span>
                </label>
                <select
                  className='form-control radius-8'
                  id='defaultLanguage'
                >
                  <option value=''>Select language</option>
                  <option value='en'>English</option>
                  <option value='ta'>Tamil</option>
                  <option value='hi'>Hindi</option>
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div className='d-flex align-items-center justify-content-center gap-3 mt-24'>
              <button
                type='reset'
                className='border border-danger-600 bg-hover-danger-200 text-danger-600 text-md px-40 py-11 radius-8'
              >
                Reset
              </button>
              <button
                type='submit'
                className='btn btn-primary border border-primary-600 text-md px-24 py-12 radius-8'
              >
                Save Change
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Whatsapplayer;

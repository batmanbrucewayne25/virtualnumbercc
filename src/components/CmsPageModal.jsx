import { Icon } from "@iconify/react/dist/iconify.js";

const CmsPageModal = ({ isOpen, onClose, page, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" style={{ maxHeight: '90vh' }}>
        <div className="modal-content radius-12" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
          <div className="modal-header border-bottom" style={{ flexShrink: 0 }}>
            <h5 className="modal-title text-md text-primary-light">
              {page?.page_title || "Loading..."}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            />
          </div>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div className="text-center py-24">
                <p>Loading...</p>
              </div>
            ) : page?.content ? (
              <div 
                className="cms-content"
                dangerouslySetInnerHTML={{ __html: page.content }}
                style={{
                  lineHeight: '1.6',
                  color: '#333'
                }}
              />
            ) : (
              <div className="text-center py-24">
                <p className="text-secondary-light">No content available</p>
              </div>
            )}
          </div>
          <div className="modal-footer border-top" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary radius-8"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CmsPageModal;


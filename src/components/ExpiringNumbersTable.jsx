import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getAdminExpiringNumbers, getExpiringNumbers } from "@/utils/api";
import { getAuthToken } from "@/utils/auth";

const ExpiringNumbersTable = () => {
  const [userRole, setUserRole] = useState(null);
  const [expiringNumbers, setExpiringNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Get user role from token
    const token = getAuthToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
  }, []);

  useEffect(() => {
    const fetchExpiringNumbers = async () => {
      if (!userRole) return;
      
      setLoading(true);
      setError("");
      try {
        let result;
        if (userRole === 'admin' || userRole === 'super_admin') {
          result = await getAdminExpiringNumbers();
        } else if (userRole === 'reseller') {
          result = await getExpiringNumbers();
        } else {
          setLoading(false);
          return;
        }

        if (result.success) {
          setExpiringNumbers(result.data || []);
        } else {
          setError(result.message || "Failed to load expiring numbers");
        }
      } catch (err) {
        console.error("Error fetching expiring numbers:", err);
        // Check if error is a JSON parse error (HTML response)
        if (err.message && err.message.includes('JSON')) {
          setError("Server error: Please check if the server is running and the endpoint is available.");
        } else {
          setError(err.message || "Failed to load expiring numbers");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExpiringNumbers();
  }, [userRole]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const isSuperAdmin = userRole === 'admin' || userRole === 'super_admin';

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24'>
        <h5 className='text-md text-primary-light mb-0'>Expiring Numbers</h5>
      </div>
      <div className='card-body p-24'>
        {loading ? (
          <div className='text-center py-40'>
            <span className="spinner-border spinner-border-sm" role="status"></span>
            <p className='text-muted mt-3'>Loading expiring numbers...</p>
          </div>
        ) : error ? (
          <div className='alert alert-warning radius-8' role='alert'>
            <Icon icon='material-symbols:warning-outline' className='icon me-2' />
            {error}
          </div>
        ) : expiringNumbers.length === 0 ? (
          <div className='text-center py-40'>
            <Icon icon='mdi:check-circle-outline' className='icon text-6xl text-success mb-3' />
            <p className='text-muted'>No numbers expiring soon</p>
          </div>
        ) : (
          <div className='table-responsive scroll-sm'>
            <table className='table bordered-table sm-table mb-0'>
              <thead>
                <tr>
                  <th scope='col'>S.L</th>
                  {isSuperAdmin && <th scope='col'>Reseller</th>}
                  <th scope='col'>Customer Name</th>
                  <th scope='col'>Virtual Number</th>
                  <th scope='col'>Expiring Date</th>
                  <th scope='col' className='text-center'>Days Left</th>
                </tr>
              </thead>
              <tbody>
                {expiringNumbers.map((number, index) => (
                  <tr key={number.id}>
                    <td>{index + 1}</td>
                    {isSuperAdmin && (
                      <td>
                        <span className='text-sm fw-medium'>
                          {number.resellerName || "N/A"}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className='text-sm fw-medium'>
                        {number.customerName || "N/A"}
                      </span>
                    </td>
                    <td>
                      <span className='text-sm'>
                        {number.virtual_number || "-"}
                      </span>
                    </td>
                    <td>{formatDate(number.expiry_date)}</td>
                    <td className='text-center'>
                      <span className={`text-sm fw-medium ${
                        number.daysLeft < 7 
                          ? "text-danger-600" 
                          : number.daysLeft < 15 
                          ? "text-warning-600" 
                          : "text-secondary-light"
                      }`}>
                        {number.daysLeft} days
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpiringNumbersTable;


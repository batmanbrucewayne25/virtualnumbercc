import { Icon } from "@iconify/react";
import { useState, useEffect } from "react";
import { getDashboardStats } from "@/utils/api";

const UnitCountOne = () => {
  const [stats, setStats] = useState({
    totalAdmins: 0,
    activeVirtualNumbers: 0,
    activeCustomers: 0,
    soonToExpireNumbers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getDashboardStats();
        if (result.success && result.data) {
          setStats({
            totalAdmins: result.data.totalAdmins || 0,
            activeVirtualNumbers: result.data.activeVirtualNumbers || 0,
            activeCustomers: result.data.activeCustomers || 0,
            soonToExpireNumbers: result.data.soonToExpireNumbers || 0,
          });
        } else {
          setError(result.message || "Failed to load statistics");
        }
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        setError(err.message || "Failed to load statistics");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <div className='row row-cols-xxxl-5 row-cols-lg-3 row-cols-sm-2 row-cols-1 gy-4'>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className='col'>
            <div className='card shadow-none border bg-gradient-start-1 h-100'>
              <div className='card-body p-20'>
                <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                  <div>
                    <p className='fw-medium text-primary-light mb-1'>Loading...</p>
                    <h6 className='mb-0'>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                    </h6>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className='row row-cols-xxxl-5 row-cols-lg-3 row-cols-sm-2 row-cols-1 gy-4'>
      {/* Count of Admin */}
      <div className='col'>
        <div className='card shadow-none border bg-gradient-start-1 h-100'>
          <div className='card-body p-20'>
            <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
              <div>
                <p className='fw-medium text-primary-light mb-1'>Total Admins</p>
                <h6 className='mb-0'>{formatNumber(stats.totalAdmins)}</h6>
              </div>
              <div className='w-50-px h-50-px bg-cyan rounded-circle d-flex justify-content-center align-items-center'>
                <Icon
                  icon='flowbite:users-group-outline'
                  className='text-white text-2xl mb-0'
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Count of Active Virtual Numbers */}
      <div className='col'>
        <div className='card shadow-none border bg-gradient-start-2 h-100'>
          <div className='card-body p-20'>
            <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
              <div>
                <p className='fw-medium text-primary-light mb-1'>
                  Active Virtual Numbers
                </p>
                <h6 className='mb-0'>{formatNumber(stats.activeVirtualNumbers)}</h6>
              </div>
              <div className='w-50-px h-50-px bg-purple rounded-circle d-flex justify-content-center align-items-center'>
                <Icon
                  icon='solar:phone-calling-bold'
                  className='text-white text-2xl mb-0'
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Customers */}
      <div className='col'>
        <div className='card shadow-none border bg-gradient-start-3 h-100'>
          <div className='card-body p-20'>
            <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
              <div>
                <p className='fw-medium text-primary-light mb-1'>
                  Active Customers
                </p>
                <h6 className='mb-0'>{formatNumber(stats.activeCustomers)}</h6>
              </div>
              <div className='w-50-px h-50-px bg-info rounded-circle d-flex justify-content-center align-items-center'>
                <Icon
                  icon='fluent:people-20-filled'
                  className='text-white text-2xl mb-0'
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Soon to Expire Numbers */}
      <div className='col'>
        <div className='card shadow-none border bg-gradient-start-4 h-100'>
          <div className='card-body p-20'>
            <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
              <div>
                <p className='fw-medium text-primary-light mb-1'>
                  Soon to Expire Numbers
                </p>
                <h6 className='mb-0'>{formatNumber(stats.soonToExpireNumbers)}</h6>
              </div>
              <div className='w-50-px h-50-px bg-warning rounded-circle d-flex justify-content-center align-items-center'>
                <Icon
                  icon='solar:clock-circle-bold'
                  className='text-white text-2xl mb-0'
                />
              </div>
            </div>
            <p className='fw-medium text-sm text-primary-light mt-12 mb-0'>
              <span className='text-warning'>Expiring in next 30 days</span>
            </p>
          </div>
        </div>
      </div>
      
      {error && (
        <div className='col-12'>
          <div className='alert alert-warning radius-8' role='alert'>
            <Icon icon='material-symbols:warning-outline' className='icon me-2' />
            {error}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitCountOne;

import { Icon } from "@iconify/react";
import { useState, useEffect } from "react";
import { getDashboardStats, getResellerDashboardStats } from "@/utils/api";
import { getAuthToken } from "@/utils/auth";

const UnitCountOne = () => {
  const [userRole, setUserRole] = useState(null);
  const [stats, setStats] = useState({
    // Super Admin stats
    totalResellers: 0,
    activeVirtualNumbers: 0,
    activeCustomers: 0,
    soonToExpireNumbers: 0,
    totalWalletRecharge: 0,
    // Reseller stats
    walletBalance: 0,
    razorpayRevenue: 0,
  });
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
    const fetchStats = async () => {
      if (!userRole) return;
      
      setLoading(true);
      setError("");
      try {
        if (userRole === 'admin' || userRole === 'super_admin') {
          // Fetch Super Admin stats
          const result = await getDashboardStats();
          if (result.success && result.data) {
            setStats({
              totalResellers: result.data.totalResellers || result.data.totalCustomers || 0,
              activeVirtualNumbers: result.data.activeVirtualNumbers || 0,
              activeCustomers: result.data.activeCustomers || 0,
              soonToExpireNumbers: result.data.soonToExpireNumbers || 0,
              totalWalletRecharge: result.data.totalWalletRecharge || 0,
              walletBalance: 0,
              razorpayRevenue: 0,
            });
          } else {
            setError(result.message || "Failed to load statistics");
          }
        } else if (userRole === 'reseller') {
          // Fetch Reseller stats
          const result = await getResellerDashboardStats();
          if (result.success && result.data) {
            setStats({
              totalResellers: 0,
              activeVirtualNumbers: result.data.activeNumbers || 0,
              activeCustomers: 0, // Will be fetched separately if needed
              soonToExpireNumbers: result.data.expiringNumbers || 0,
              totalWalletRecharge: 0,
              walletBalance: result.data.walletBalance || 0,
              razorpayRevenue: result.data.razorpayRevenue || 0,
            });
          } else {
            setError(result.message || "Failed to load statistics");
          }
        }
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        setError(err.message || "Failed to load statistics");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userRole]);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toFixed(2)}`;
  };

  const isSuperAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isReseller = userRole === 'reseller';

  if (loading || !userRole) {
    return (
      <div className='row row-cols-xxxl-5 row-cols-lg-3 row-cols-sm-2 row-cols-1 gy-4'>
        {[1, 2, 3, 4, 5].map((i) => (
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
      {/* Super Admin Cards */}
      {isSuperAdmin && (
        <>
          {/* Total Resellers */}
          <div className='col'>
            <div className='card shadow-none border bg-gradient-start-1 h-100'>
              <div className='card-body p-20'>
                <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                  <div>
                    <p className='fw-medium text-primary-light mb-1'>Total Resellers</p>
                    <h6 className='mb-0'>{formatNumber(stats.totalResellers)}</h6>
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

          {/* Active Virtual Numbers */}
          <div className='col'>
            <div className='card shadow-none border bg-gradient-start-2 h-100'>
              <div className='card-body p-20'>
                <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                  <div>
                    <p className='fw-medium text-primary-light mb-1'>
                      Active Numbers
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

          {/* Expiring Numbers */}
          <div className='col'>
            <div className='card shadow-none border bg-gradient-start-4 h-100'>
              <div className='card-body p-20'>
                <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                  <div>
                    <p className='fw-medium text-primary-light mb-1'>
                      Expiring Numbers
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

          {/* Revenue (Total Wallet Recharge) */}
          <div className='col'>
            <div className='card shadow-none border bg-gradient-start-5 h-100'>
              <div className='card-body p-20'>
                <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                  <div>
                    <p className='fw-medium text-primary-light mb-1'>
                      Revenue
                    </p>
                    <h6 className='mb-0'>{formatCurrency(stats.totalWalletRecharge)}</h6>
                  </div>
                  <div className='w-50-px h-50-px bg-success rounded-circle d-flex justify-content-center align-items-center'>
                    <Icon
                      icon='solar:wallet-money-bold'
                      className='text-white text-2xl mb-0'
                    />
                  </div>
                </div>
                <p className='fw-medium text-sm text-primary-light mt-12 mb-0'>
                  <span className='text-success'>Total Wallet Recharge</span>
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reseller Cards */}
      {isReseller && (
        <>
          {/* Active Numbers */}
          <div className='col'>
            <div className='card shadow-none border bg-gradient-start-2 h-100'>
              <div className='card-body p-20'>
                <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                  <div>
                    <p className='fw-medium text-primary-light mb-1'>
                      Active Numbers
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

          {/* Expiring Numbers */}
          <div className='col'>
            <div className='card shadow-none border bg-gradient-start-4 h-100'>
              <div className='card-body p-20'>
                <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                  <div>
                    <p className='fw-medium text-primary-light mb-1'>
                      Expiring Numbers
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

          {/* Wallet Balance */}
          <div className='col'>
            <div className='card shadow-none border bg-gradient-start-1 h-100'>
              <div className='card-body p-20'>
                <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                  <div>
                    <p className='fw-medium text-primary-light mb-1'>
                      Wallet Balance
                    </p>
                    <h6 className='mb-0'>{formatCurrency(stats.walletBalance)}</h6>
                  </div>
                  <div className='w-50-px h-50-px bg-success rounded-circle d-flex justify-content-center align-items-center'>
                    <Icon
                      icon='solar:wallet-money-bold'
                      className='text-white text-2xl mb-0'
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Razorpay Revenue */}
          <div className='col'>
            <div className='card shadow-none border bg-gradient-start-5 h-100'>
              <div className='card-body p-20'>
                <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                  <div>
                    <p className='fw-medium text-primary-light mb-1'>
                      Razorpay Revenue
                    </p>
                    <h6 className='mb-0'>{formatCurrency(stats.razorpayRevenue)}</h6>
                  </div>
                  <div className='w-50-px h-50-px bg-primary rounded-circle d-flex justify-content-center align-items-center'>
                    <Icon
                      icon='solar:card-bold'
                      className='text-white text-2xl mb-0'
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
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

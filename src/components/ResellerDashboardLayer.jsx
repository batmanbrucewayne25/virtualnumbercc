import { Icon } from "@iconify/react/dist/iconify.js";
import ReactApexChart from "react-apexcharts";
import { useState, useEffect } from "react";
import { getResellerDashboardStats, getResellerDashboardCharts, getExpiringNumbers } from "@/utils/api";

const ResellerDashboardLayer = () => {
  const [stats, setStats] = useState({
    activeNumbers: 0,
    expiringNumbers: 0,
    walletBalance: 0,
    walletUsage: 0,
    creditAmount: 0,
    debitAmount: 0,
  });
  const [chartData, setChartData] = useState(null);
  const [expiringNumbers, setExpiringNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsResult, chartsResult, numbersResult] = await Promise.all([
        getResellerDashboardStats(),
        getResellerDashboardCharts(),
        getExpiringNumbers(),
      ]);

      if (statsResult.success) {
        setStats(statsResult.data);
      }

      if (chartsResult.success) {
        setChartData(chartsResult.data);
      }

      if (numbersResult.success) {
        setExpiringNumbers(numbersResult.data || []);
      }

      if (!statsResult.success || !chartsResult.success || !numbersResult.success) {
        setError("Failed to load some dashboard data");
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("An error occurred while loading dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Admin Performance Chart Options
  const adminPerformanceChartOptions = {
    chart: {
      type: 'line',
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: chartData?.adminPerformance?.labels || [],
      labels: {
        style: { colors: '#6c757d' }
      }
    },
    yaxis: {
      labels: {
        style: { colors: '#6c757d' }
      }
    },
    colors: ['#007bff', '#28a745', '#dc3545'],
    legend: {
      position: 'top',
      horizontalAlign: 'right'
    },
    tooltip: {
      theme: 'light'
    }
  };

  const adminPerformanceSeries = chartData?.adminPerformance ? [
    {
      name: 'Activations',
      data: chartData.adminPerformance.activations || []
    },
    {
      name: 'Renewals',
      data: chartData.adminPerformance.renewals || []
    },
    {
      name: 'Suspensions',
      data: chartData.adminPerformance.suspensions || []
    }
  ] : [];

  // Customers Chart Options (Pie Chart)
  const customersChartOptions = {
    chart: {
      type: 'donut',
      toolbar: { show: false }
    },
    labels: ['Verified', 'Active', 'Suspended'],
    colors: ['#007bff', '#28a745', '#dc3545'],
    legend: {
      position: 'bottom',
      horizontalAlign: 'center'
    },
    dataLabels: {
      enabled: true,
      formatter: function (val) {
        return val.toFixed(1) + "%";
      }
    },
    tooltip: {
      theme: 'light'
    }
  };

  const customersSeries = chartData?.customers ? [
    chartData.customers.verified || 0,
    chartData.customers.active || 0,
    chartData.customers.suspended || 0
  ] : [];

  if (loading) {
    return (
      <div className='text-center py-40'>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className='text-muted mt-3'>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className='alert alert-danger radius-8 mb-24' role='alert'>
          <Icon icon='material-symbols:error-outline' className='icon me-2' />
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div className='row row-cols-xxxl-5 row-cols-lg-3 row-cols-sm-2 row-cols-1 gy-4 mb-24'>
        {/* Active Numbers */}
        <div className='col'>
          <div className='card shadow-none border bg-gradient-start-1 h-100'>
            <div className='card-body p-20'>
              <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                <div>
                  <p className='fw-medium text-primary-light mb-1'>Active Numbers</p>
                  <h6 className='mb-0'>{formatNumber(stats.activeNumbers)}</h6>
                </div>
                <div className='w-50-px h-50-px bg-cyan rounded-circle d-flex justify-content-center align-items-center'>
                  <Icon
                    icon='mdi:phone-check'
                    className='text-white text-2xl mb-0'
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expiring Numbers */}
        <div className='col'>
          <div className='card shadow-none border bg-gradient-start-2 h-100'>
            <div className='card-body p-20'>
              <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                <div>
                  <p className='fw-medium text-primary-light mb-1'>Expiring Numbers</p>
                  <h6 className='mb-0'>{formatNumber(stats.expiringNumbers)}</h6>
                </div>
                <div className='w-50-px h-50-px bg-warning rounded-circle d-flex justify-content-center align-items-center'>
                  <Icon
                    icon='mdi:clock-alert'
                    className='text-white text-2xl mb-0'
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Balance */}
        <div className='col'>
          <div className='card shadow-none border bg-gradient-start-3 h-100'>
            <div className='card-body p-20'>
              <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                <div>
                  <p className='fw-medium text-primary-light mb-1'>Wallet Balance</p>
                  <h6 className='mb-0'>{formatCurrency(stats.walletBalance)}</h6>
                </div>
                <div className='w-50-px h-50-px bg-success rounded-circle d-flex justify-content-center align-items-center'>
                  <Icon
                    icon='mdi:wallet'
                    className='text-white text-2xl mb-0'
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Usage */}
        <div className='col'>
          <div className='card shadow-none border bg-gradient-start-4 h-100'>
            <div className='card-body p-20'>
              <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'>
                <div>
                  <p className='fw-medium text-primary-light mb-1'>Wallet Usage</p>
                  <h6 className='mb-0'>{formatCurrency(stats.walletUsage)}</h6>
                </div>
                <div className='w-50-px h-50-px bg-info rounded-circle d-flex justify-content-center align-items-center'>
                  <Icon
                    icon='mdi:chart-line'
                    className='text-white text-2xl mb-0'
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Credit vs Debit */}
        <div className='col'>
          <div className='card shadow-none border bg-gradient-start-5 h-100'>
            <div className='card-body p-20'>
              <div className='d-flex flex-column gap-2'>
                <div>
                  <p className='fw-medium text-primary-light mb-1 text-sm'>Credit</p>
                  <h6 className='mb-0 text-success'>{formatCurrency(stats.creditAmount)}</h6>
                </div>
                <div>
                  <p className='fw-medium text-primary-light mb-1 text-sm'>Debit</p>
                  <h6 className='mb-0 text-danger'>{formatCurrency(stats.debitAmount)}</h6>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className='row gy-4 mb-24'>
        {/* Admin Performance Chart */}
        <div className='col-xxl-8 col-xl-12'>
          <div className='card h-100'>
            <div className='card-header border-bottom bg-base py-16 px-24'>
              <h5 className='text-md text-primary-light mb-0'>Admin Performance</h5>
            </div>
            <div className='card-body p-24'>
              {chartData?.adminPerformance ? (
                <ReactApexChart
                  options={adminPerformanceChartOptions}
                  series={adminPerformanceSeries}
                  type="line"
                  height={350}
                />
              ) : (
                <div className='text-center py-40'>
                  <p className='text-muted'>No chart data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customers Chart */}
        <div className='col-xxl-4 col-xl-12'>
          <div className='card h-100'>
            <div className='card-header border-bottom bg-base py-16 px-24'>
              <h5 className='text-md text-primary-light mb-0'>Customers Overview</h5>
            </div>
            <div className='card-body p-24'>
              {chartData?.customers ? (
                <>
                  <ReactApexChart
                    options={customersChartOptions}
                    series={customersSeries}
                    type="donut"
                    height={300}
                  />
                  <div className='mt-20 d-flex flex-column gap-2'>
                    <div className='d-flex justify-content-between align-items-center'>
                      <span className='text-sm'>Verified:</span>
                      <span className='text-sm fw-medium'>{chartData.customers.verified || 0}</span>
                    </div>
                    <div className='d-flex justify-content-between align-items-center'>
                      <span className='text-sm'>Active:</span>
                      <span className='text-sm fw-medium text-success'>{chartData.customers.active || 0}</span>
                    </div>
                    <div className='d-flex justify-content-between align-items-center'>
                      <span className='text-sm'>Suspended:</span>
                      <span className='text-sm fw-medium text-danger'>{chartData.customers.suspended || 0}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className='text-center py-40'>
                  <p className='text-muted'>No chart data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Numbers Table */}
      <div className='card h-100 p-0 radius-12'>
        <div className='card-header border-bottom bg-base py-16 px-24'>
          <h5 className='text-md text-primary-light mb-0'>Expiring Numbers</h5>
        </div>
        <div className='card-body p-24'>
          {expiringNumbers.length === 0 ? (
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
                      <td>
                        <span className='text-sm fw-medium'>
                          {number.customerName}
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
    </div>
  );
};

export default ResellerDashboardLayer;


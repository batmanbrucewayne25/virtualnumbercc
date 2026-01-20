import ReactApexChart from "react-apexcharts";
import { useState, useEffect } from "react";
import { getDashboardStats } from "@/utils/api";

const UsersOverviewOne = () => {
  const [stats, setStats] = useState({
    totalAdmins: 0,
    activeCustomers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const result = await getDashboardStats();
        if (result.success && result.data) {
          setStats({
            totalAdmins: result.data.totalAdmins || 0,
            activeCustomers: result.data.activeCustomers || 0,
          });
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const donutChartOptions = {
    chart: {
      type: 'donut',
    },
    labels: ['Admins', 'Active Customers'],
    colors: ['#007bff', '#ffc107'],
    legend: {
      show: false
    },
    dataLabels: {
      enabled: true,
      formatter: function (val) {
        return val.toFixed(1) + "%";
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%'
        }
      }
    }
  };

  const donutChartSeries = [stats.totalAdmins, stats.activeCustomers];

  const total = stats.totalAdmins + stats.activeCustomers;
  const adminPercent = total > 0 ? ((stats.totalAdmins / total) * 100).toFixed(1) : 0;
  const customerPercent = total > 0 ? ((stats.activeCustomers / total) * 100).toFixed(1) : 0;

  return (
    <div className='col-xxl-3 col-xl-6'>
      <div className='card h-100 radius-8 border-0 overflow-hidden'>
        <div className='card-body p-24'>
          <div className='d-flex align-items-center flex-wrap gap-2 justify-content-between'>
            <h6 className='mb-2 fw-bold text-lg'>Users Overview</h6>
          </div>
          {loading ? (
            <div className='d-flex justify-content-center align-items-center' style={{ height: '264px' }}>
              <span className="spinner-border spinner-border-sm" role="status"></span>
            </div>
          ) : (
            <ReactApexChart
              options={donutChartOptions}
              series={donutChartSeries}
              type='donut'
              height={264}
            />
          )}
          <ul className='d-flex flex-wrap align-items-center justify-content-between mt-3 gap-3'>
            <li className='d-flex align-items-center gap-2'>
              <span className='w-12-px h-12-px radius-2 bg-primary-600' />
              <span className='text-secondary-light text-sm fw-normal'>
                Admins:
                <span className='text-primary-light fw-semibold'>{stats.totalAdmins}</span>
              </span>
            </li>
            <li className='d-flex align-items-center gap-2'>
              <span className='w-12-px h-12-px radius-2 bg-yellow' />
              <span className='text-secondary-light text-sm fw-normal'>
                Customers:
                <span className='text-primary-light fw-semibold'>{stats.activeCustomers}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UsersOverviewOne;

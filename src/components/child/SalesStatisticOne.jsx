import { Icon } from "@iconify/react/dist/iconify.js";
import ReactApexChart from "react-apexcharts";
import { useState, useEffect } from "react";
import { getDashboardChartData } from "@/utils/api";
import { getAuthToken } from "@/utils/auth";

const SalesStatisticOne = () => {
  const [userRole, setUserRole] = useState(null);
  const [chartData, setChartData] = useState({
    dates: [],
    values: []
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('Monthly');

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
    const fetchChartData = async () => {
      if (!userRole) return;
      
      setLoading(true);
      try {
        const result = await getDashboardChartData();
        if (result.success && result.data) {
          // For Super Admin, use reseller registrations; for others, use admin registrations
          const isSuperAdmin = userRole === 'admin' || userRole === 'super_admin';
          const data = isSuperAdmin 
            ? (result.data.resellerRegistrations || { dates: [], values: [] })
            : (result.data.adminRegistrations || { dates: [], values: [] });
          setChartData(data);
        }
      } catch (err) {
        console.error("Error fetching chart data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [period, userRole]);

  const chartOptions = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: chartData.dates || [],
      labels: {
        style: { colors: '#6c757d' }
      }
    },
    yaxis: {
      labels: {
        style: { colors: '#6c757d' }
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 90, 100]
      }
    },
    colors: ['#007bff'],
    tooltip: {
      theme: 'light'
    }
  };

  const isSuperAdmin = userRole === 'admin' || userRole === 'super_admin';
  const chartTitle = isSuperAdmin ? 'Reseller Registrations' : 'Admin Registrations';
  const chartSeriesName = isSuperAdmin ? 'Resellers' : 'Admins';

  const chartSeries = [{
    name: chartSeriesName,
    data: chartData.values || []
  }];

  const totalValue = chartData.values?.reduce((sum, val) => sum + val, 0) || 0;
  const lastValue = chartData.values?.[chartData.values.length - 1] || 0;
  const previousValue = chartData.values?.[chartData.values.length - 2] || 0;
  const changePercent = previousValue > 0 ? ((lastValue - previousValue) / previousValue * 100).toFixed(1) : 0;

  // Format dates for display (show only date, not time)
  const formattedDates = chartData.dates?.map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }) || [];

  const chartOptionsWithFormattedDates = {
    ...chartOptions,
    xaxis: {
      ...chartOptions.xaxis,
      categories: formattedDates,
    },
  };

  return (
    <div className='col-xxl-6 col-xl-12'>
      <div className='card h-100'>
        <div className='card-body'>
          <div className='d-flex flex-wrap align-items-center justify-content-between'>
            <h6 className='text-lg mb-0'>{chartTitle}</h6>
            <select
              className='form-select bg-base form-select-sm w-auto'
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value='Yearly'>Yearly</option>
              <option value='Monthly'>Monthly</option>
              <option value='Weekly'>Weekly</option>
              <option value='Today'>Today</option>
            </select>
          </div>
          <div className='d-flex flex-wrap align-items-center gap-2 mt-8'>
            <h6 className='mb-0'>{totalValue}</h6>
            <span className={`text-sm fw-semibold rounded-pill px-8 py-4 line-height-1 d-flex align-items-center gap-1 ${
              changePercent >= 0 ? 'bg-success-focus text-success-main border br-success' : 'bg-danger-focus text-danger-main border br-danger'
            }`}>
              {changePercent >= 0 ? '+' : ''}{changePercent}% <Icon icon={changePercent >= 0 ? 'bxs:up-arrow' : 'bxs:down-arrow'} className='text-xs' />
            </span>
            <span className='text-xs fw-medium'>Last 30 days</span>
          </div>
          {loading ? (
            <div className='d-flex justify-content-center align-items-center' style={{ height: '264px' }}>
              <span className="spinner-border spinner-border-sm" role="status"></span>
            </div>
          ) : (
            <ReactApexChart
              options={chartOptionsWithFormattedDates}
              series={chartSeries}
              type='area'
              height={264}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesStatisticOne;

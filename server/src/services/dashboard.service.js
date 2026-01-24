import { getHasuraClient } from '../config/hasura.client.js';

export class DashboardService {
  /**
   * Get dashboard statistics
   * @returns {Promise<object>}
   */
  static async getDashboardStats() {
    try {
      const client = getHasuraClient();
      
      // Get all statistics in parallel
      const [
        adminCountResult,
        activeAdminCountResult,
        resellerCountResult,
        activeResellerCountResult,
      ] = await Promise.all([
        // Total Admin Count
        client.client.request(`
          query GetAdminCount {
            mst_super_admin_aggregate {
              aggregate {
                count
              }
            }
          }
        `),
        
        // Active Admin Count
        client.client.request(`
          query GetActiveAdminCount {
            mst_super_admin_aggregate(where: { status: { _eq: true } }) {
              aggregate {
                count
              }
            }
          }
        `),
        
        // Total Reseller Count (Active Customers)
        client.client.request(`
          query GetResellerCount {
            mst_reseller_aggregate(
              where: { 
                _or: [
                  { isDelete: { _is_null: true } }, 
                  { isDelete: { _eq: false } }
                ]
              }
            ) {
              aggregate {
                count
              }
            }
          }
        `),
        
        // Active Reseller Count (Active Customers)
        client.client.request(`
          query GetActiveResellerCount {
            mst_reseller_aggregate(
              where: { 
                status: { _eq: true }
                _or: [
                  { isDelete: { _is_null: true } }, 
                  { isDelete: { _eq: false } }
                ]
              }
            ) {
              aggregate {
                count
              }
            }
          }
        `),
      ]);

      // Get virtual numbers count - try common table names
      let activeVirtualNumbersCount = 0;
      let soonToExpireCount = 0;
      
      try {
        // Try to get virtual numbers - try multiple possible table names
        const possibleTableNames = [
          'mst_virtual_number',
          'virtual_numbers',
          'mst_virtual_numbers',
          'virtual_number'
        ];
        
        let virtualNumbersQuery = null;
        let tableName = null;
        
        // Try each possible table name
        for (const table of possibleTableNames) {
          try {
            // Try to query active virtual numbers
            const testQuery = `
              query TestVirtualNumbersTable {
                ${table}_aggregate(where: { status: { _eq: true } }) {
                  aggregate {
                    count
                  }
                }
              }
            `;
            await client.client.request(testQuery);
            tableName = table;
            virtualNumbersQuery = `
              query GetVirtualNumbersStats {
                activeCount: ${table}_aggregate(where: { status: { _eq: true } }) {
                  aggregate {
                    count
                  }
                }
              }
            `;
            break;
          } catch (testError) {
            // Try next table name
            continue;
          }
        }
        
        if (virtualNumbersQuery && tableName) {
          const virtualNumbersResult = await client.client.request(virtualNumbersQuery);
          activeVirtualNumbersCount = virtualNumbersResult.activeCount?.aggregate?.count || 0;
          
          // Get soon to expire numbers (within next 30 days)
          const now = new Date();
          const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          
          try {
            const expireQuery = `
              query GetSoonToExpireNumbers {
                soonToExpire: ${tableName}_aggregate(
                  where: {
                    status: { _eq: true }
                    _and: [
                      { expiry_date: { _gte: "${now.toISOString()}" } }
                      { expiry_date: { _lte: "${thirtyDaysFromNow.toISOString()}" } }
                    ]
                  }
                ) {
                  aggregate {
                    count
                  }
                }
              }
            `;
            const expireResult = await client.client.request(expireQuery);
            soonToExpireCount = expireResult.soonToExpire?.aggregate?.count || 0;
          } catch (expireError) {
            // If expiry_date field doesn't exist, try alternative field names
            const alternativeFields = ['expires_at', 'expiration_date', 'valid_until', 'expiry_date'];
            for (const field of alternativeFields) {
              try {
                const altExpireQuery = `
                  query GetSoonToExpireNumbers {
                    soonToExpire: ${tableName}_aggregate(
                      where: {
                        status: { _eq: true }
                        _and: [
                          { ${field}: { _gte: "${now.toISOString()}" } }
                          { ${field}: { _lte: "${thirtyDaysFromNow.toISOString()}" } }
                        ]
                      }
                    ) {
                      aggregate {
                        count
                      }
                    }
                  }
                `;
                const altExpireResult = await client.client.request(altExpireQuery);
                soonToExpireCount = altExpireResult.soonToExpire?.aggregate?.count || 0;
                break;
              } catch (altError) {
                // Continue to next field
                continue;
              }
            }
          }
        } else {
          console.warn('Virtual numbers table not found. Tried:', possibleTableNames.join(', '));
        }
      } catch (error) {
        console.warn('Virtual numbers query error:', error.message);
        // Continue with 0 values
      }

      // Get transaction/payment statistics from mst_transaction table
      let paymentStats = {
        total_transactions: 0,
        successful_transactions: 0,
        total_amount: 0,
        today_transactions: 0,
        today_amount: 0,
        active_resellers: 0
      };

      try {
        const today = new Date().toISOString().split('T')[0];
        
        const transactionStatsResult = await client.client.request(`
          query GetTransactionStats {
            total: mst_transaction_aggregate {
              aggregate {
                count
                sum {
                  amount
                }
              }
            }
            successful: mst_transaction_aggregate(
              where: { status: { _in: ["success", "captured"] } }
            ) {
              aggregate {
                count
                sum {
                  amount
                }
              }
            }
            today: mst_transaction_aggregate(
              where: { created_at: { _gte: "${today}" } }
            ) {
              aggregate {
                count
                sum {
                  amount
                }
              }
            }
            resellers_with_transactions: mst_transaction(distinct_on: reseller_id) {
              reseller_id
            }
          }
        `);
        
        paymentStats.total_transactions = transactionStatsResult.total?.aggregate?.count || 0;
        paymentStats.total_amount = transactionStatsResult.total?.aggregate?.sum?.amount || 0;
        paymentStats.successful_transactions = transactionStatsResult.successful?.aggregate?.count || 0;
        paymentStats.today_transactions = transactionStatsResult.today?.aggregate?.count || 0;
        paymentStats.today_amount = transactionStatsResult.today?.aggregate?.sum?.amount || 0;
        paymentStats.active_resellers = transactionStatsResult.resellers_with_transactions?.length || 0;
      } catch (error) {
        console.warn('Error fetching transaction statistics:', error.message);
      }

      // Count resellers with Razorpay configured
      let configuredResellersCount = 0;
      try {
        const configuredResellersResult = await client.client.request(`
          query GetConfiguredResellers {
            mst_razorpay_config_aggregate(
              where: { 
                is_active: { _eq: true }
                key_id: { _is_null: false }
              }
            ) {
              aggregate {
                count
              }
            }
          }
        `);
        
        configuredResellersCount = configuredResellersResult.mst_razorpay_config_aggregate?.aggregate?.count || 0;
      } catch (error) {
        console.warn('Error fetching configured resellers count:', error.message);
      }

      // Get total wallet recharge revenue (sum of all credit transactions)
      let totalWalletRecharge = 0;
      try {
        const walletRechargeResult = await client.client.request(`
          query GetTotalWalletRecharge {
            mst_wallet_transaction_aggregate(
              where: { transaction_type: { _eq: "credit" } }
            ) {
              aggregate {
                sum {
                  amount
                }
              }
            }
          }
        `);
        totalWalletRecharge = Number(walletRechargeResult.mst_wallet_transaction_aggregate?.aggregate?.sum?.amount || 0);
      } catch (error) {
        console.warn('Error fetching wallet recharge revenue:', error.message);
      }

      return {
        totalAdmins: adminCountResult.mst_super_admin_aggregate?.aggregate?.count || 0,
        activeAdmins: activeAdminCountResult.mst_super_admin_aggregate?.aggregate?.count || 0,
        totalResellers: resellerCountResult.mst_reseller_aggregate?.aggregate?.count || 0,
        totalCustomers: resellerCountResult.mst_reseller_aggregate?.aggregate?.count || 0, // Keep for backward compatibility
        activeCustomers: activeResellerCountResult.mst_reseller_aggregate?.aggregate?.count || 0,
        activeVirtualNumbers: activeVirtualNumbersCount,
        soonToExpireNumbers: soonToExpireCount,
        totalWalletRecharge: totalWalletRecharge,
        paymentStats: paymentStats,
        configuredResellers: configuredResellersCount,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw new Error(error.message || 'Failed to fetch dashboard statistics');
    }
  }

  /**
   * Get chart data for dashboard
   * @returns {Promise<object>}
   */
  static async getChartData() {
    try {
      const client = getHasuraClient();
      
      // Get data for the last 7 days, 30 days, etc.
      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get admin registrations over time
      const adminRegistrations = await client.client.request(`
        query GetAdminRegistrations {
          mst_super_admin(
            order_by: { created_at: desc }
            limit: 100
          ) {
            created_at
            status
          }
        }
      `);

      // Get reseller registrations over time
      const resellerRegistrations = await client.client.request(`
        query GetResellerRegistrations {
          mst_reseller(
            where: { 
              _or: [
                { isDelete: { _is_null: true } }, 
                { isDelete: { _eq: false } }
              ]
            }
            order_by: { created_at: desc }
            limit: 100
          ) {
            created_at
            status
          }
        }
      `);

      // Get transaction data over time
      let transactionData = [];
      try {
        const transactionsResult = await client.client.request(`
          query GetTransactionsOverTime {
            mst_transaction(
              order_by: { created_at: desc }
              limit: 500
            ) {
              created_at
              amount
              status
              reseller_id
            }
          }
        `);
        transactionData = transactionsResult.mst_transaction || [];
      } catch (error) {
        console.warn('Error fetching transaction data for charts:', error.message);
      }

      // Process data for charts
      const processTimeSeriesData = (data, days = 30) => {
        const result = {};
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        
        for (let i = 0; i < days; i++) {
          const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
          const dateKey = date.toISOString().split('T')[0];
          result[dateKey] = 0;
        }

        data.forEach(item => {
          if (item.created_at) {
            const itemDate = new Date(item.created_at).toISOString().split('T')[0];
            if (result[itemDate] !== undefined) {
              result[itemDate]++;
            }
          }
        });

        return {
          dates: Object.keys(result),
          values: Object.values(result),
        };
      };

      // Process transaction amounts per day
      const processTransactionAmounts = (data, days = 30) => {
        const result = {};
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        
        for (let i = 0; i < days; i++) {
          const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
          const dateKey = date.toISOString().split('T')[0];
          result[dateKey] = 0;
        }

        data.forEach(item => {
          if (item.created_at && (item.status === 'success' || item.status === 'captured')) {
            const itemDate = new Date(item.created_at).toISOString().split('T')[0];
            if (result[itemDate] !== undefined) {
              result[itemDate] += parseFloat(item.amount) || 0;
            }
          }
        });

        return {
          dates: Object.keys(result),
          values: Object.values(result),
        };
      };

      return {
        adminRegistrations: processTimeSeriesData(adminRegistrations.mst_super_admin || [], 30),
        resellerRegistrations: processTimeSeriesData(resellerRegistrations.mst_reseller || [], 30),
        transactionCounts: processTimeSeriesData(transactionData, 30),
        transactionAmounts: processTransactionAmounts(transactionData, 30),
        last7Days: {
          admins: adminRegistrations.mst_super_admin?.filter(a => 
            new Date(a.created_at) >= last7Days
          ).length || 0,
          resellers: resellerRegistrations.mst_reseller?.filter(r => 
            new Date(r.created_at) >= last7Days
          ).length || 0,
          transactions: transactionData.filter(t =>
            new Date(t.created_at) >= last7Days
          ).length || 0,
        },
        last30Days: {
          admins: adminRegistrations.mst_super_admin?.filter(a => 
            new Date(a.created_at) >= last30Days
          ).length || 0,
          resellers: resellerRegistrations.mst_reseller?.filter(r => 
            new Date(r.created_at) >= last30Days
          ).length || 0,
          transactions: transactionData.filter(t =>
            new Date(t.created_at) >= last30Days
          ).length || 0,
        },
      };
    } catch (error) {
      console.error('Error fetching chart data:', error);
      throw new Error(error.message || 'Failed to fetch chart data');
    }
  }

  /**
   * Get expiring numbers list for Super Admin (all expiring numbers)
   * @returns {Promise<Array>}
   */
  static async getExpiringNumbers() {
    try {
      const client = getHasuraClient();
      
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      const expiryDate = thirtyDaysLater.toISOString().split('T')[0];

      const query = `
        query GetExpiringNumbers($today: date!, $expiry_date: date!) {
          mst_virtual_number(
            where: { 
              status: { _eq: "active" }
              expiry_date: { _gte: $today, _lte: $expiry_date }
            }
            order_by: { expiry_date: asc }
          ) {
            id
            virtual_number
            expiry_date
            mst_customer {
              id
              profile_name
              business_name
              pan_full_name
              email
            }
            mst_reseller {
              id
              business_name
              first_name
              last_name
            }
          }
        }
      `;

      const result = await client.client.request(query, {
        today,
        expiry_date: expiryDate,
      });

      if (result.errors) {
        console.error('GraphQL errors in getExpiringNumbers:', result.errors);
        throw new Error(result.errors[0]?.message || 'GraphQL query failed');
      }

      const numbers = result.mst_virtual_number || [];
      
      // Calculate days left for each number
      const numbersWithDaysLeft = numbers.map((vn) => {
        const expiry = new Date(vn.expiry_date);
        const todayDate = new Date();
        const diffTime = expiry - todayDate;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
          ...vn,
          daysLeft: daysLeft > 0 ? daysLeft : 0,
          customerName: vn.mst_customer?.business_name || 
                       vn.mst_customer?.profile_name || 
                       vn.mst_customer?.pan_full_name || 
                       "N/A",
          resellerName: vn.mst_reseller?.business_name || 
                       `${vn.mst_reseller?.first_name || ""} ${vn.mst_reseller?.last_name || ""}`.trim() || 
                       "N/A",
        };
      });

      return numbersWithDaysLeft;
    } catch (error) {
      console.error('Error fetching expiring numbers:', error);
      throw error;
    }
  }
}

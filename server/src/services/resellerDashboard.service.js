import { getHasuraClient } from '../config/hasura.client.js';

export class ResellerDashboardService {
  /**
   * Get reseller dashboard statistics
   * @param {string} resellerId 
   * @returns {Promise<object>}
   */
  static async getResellerDashboardStats(resellerId) {
    try {
      const client = getHasuraClient();
      
      // Get all statistics in parallel
      const [
        activeNumbersResult,
        expiringNumbersResult,
        walletResult,
        walletTransactionsResult,
      ] = await Promise.all([
        // Active virtual numbers count
        client.client.request(`
          query GetActiveNumbers($reseller_id: uuid!) {
            mst_virtual_number_aggregate(
              where: { 
                reseller_id: { _eq: $reseller_id }
                status: { _eq: "active" }
              }
            ) {
              aggregate {
                count
              }
            }
          }
        `, { reseller_id: resellerId }),
        
        // Expiring numbers count (within 30 days)
        client.client.request(`
          query GetExpiringNumbers($reseller_id: uuid!, $today: date!, $expiry_date: date!) {
            mst_virtual_number_aggregate(
              where: { 
                reseller_id: { _eq: $reseller_id }
                status: { _eq: "active" }
                expiry_date: { _gte: $today, _lte: $expiry_date }
              }
            ) {
              aggregate {
                count
              }
            }
          }
        `, { 
          reseller_id: resellerId,
          today: new Date().toISOString().split('T')[0],
          expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }),
        
        // Wallet balance
        client.client.request(`
          query GetWallet($reseller_id: uuid!) {
            mst_wallet(
              where: { reseller_id: { _eq: $reseller_id } }
              limit: 1
            ) {
              id
              balance
              credit_amount
              debit_amount
            }
          }
        `, { reseller_id: resellerId }),
        
        // Wallet transactions for usage calculation
        client.client.request(`
          query GetWalletTransactions($reseller_id: uuid!) {
            mst_wallet(
              where: { reseller_id: { _eq: $reseller_id } }
              limit: 1
            ) {
              id
            }
          }
        `, { reseller_id: resellerId }),
      ]);

      const activeNumbers = activeNumbersResult.mst_virtual_number_aggregate?.aggregate?.count || 0;
      const expiringNumbers = expiringNumbersResult.mst_virtual_number_aggregate?.aggregate?.count || 0;
      const wallet = walletResult.mst_wallet?.[0] || null;
      const walletBalance = wallet ? Number(wallet.balance) || 0 : 0;
      const creditAmount = wallet ? Number(wallet.credit_amount) || 0 : 0;
      const debitAmount = wallet ? Number(wallet.debit_amount) || 0 : 0;
      const walletUsage = debitAmount; // Total usage is total debits
      
      // Get wallet transactions separately if wallet exists
      let recentUsage = 0;
      if (wallet && wallet.id) {
        try {
          const walletId = wallet.id;
          const transactionsQuery = `
            query GetWalletTransactions($wallet_id: uuid!) {
              mst_wallet_transaction(
                where: { wallet_id: { _eq: $wallet_id } }
                order_by: { created_at: desc }
                limit: 100
              ) {
                id
                transaction_type
                amount
                created_at
              }
            }
          `;
          const transactionsResult = await client.client.request(transactionsQuery, { wallet_id: walletId });
          const transactions = transactionsResult.mst_wallet_transaction || [];
          
          // Calculate recent usage (last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          recentUsage = transactions
            .filter(txn => new Date(txn.created_at) >= thirtyDaysAgo && txn.transaction_type === 'DEBIT')
            .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0);
        } catch (error) {
          console.warn('Error fetching wallet transactions:', error);
        }
      }

      return {
        activeNumbers,
        expiringNumbers,
        walletBalance,
        walletUsage,
        creditAmount,
        debitAmount,
        recentUsage,
      };
    } catch (error) {
      console.error('Error fetching reseller dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get reseller dashboard chart data
   * @param {string} resellerId 
   * @returns {Promise<object>}
   */
  static async getResellerDashboardCharts(resellerId) {
    try {
      const client = getHasuraClient();
      
      // Get data for last 12 months
      const months = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toISOString().split('T')[0].substring(0, 7)); // YYYY-MM format
      }

      // Get activations, renewals, and suspensions
      const [activationsResult, renewalsResult, suspensionsResult, customersResult] = await Promise.all([
        // Activations (new virtual numbers created)
        client.client.request(`
          query GetActivations($reseller_id: uuid!) {
            mst_virtual_number(
              where: { 
                reseller_id: { _eq: $reseller_id }
              }
              order_by: { created_at: desc }
            ) {
              id
              created_at
            }
          }
        `, { reseller_id: resellerId }),
        
        // Renewals (transactions with renewal type or auto_renew enabled)
        client.client.request(`
          query GetRenewals($reseller_id: uuid!) {
            mst_transaction(
              where: { 
                reseller_id: { _eq: $reseller_id }
                transaction_type: { _eq: "renewal" }
              }
              order_by: { created_at: desc }
            ) {
              id
              created_at
            }
          }
        `, { reseller_id: resellerId }),
        
        // Suspensions (customers with suspended status)
        client.client.request(`
          query GetSuspensions($reseller_id: uuid!) {
            mst_customer(
              where: { 
                reseller_id: { _eq: $reseller_id }
                status: { _eq: "suspended" }
              }
              order_by: { updated_at: desc }
            ) {
              id
              updated_at
            }
          }
        `, { reseller_id: resellerId }),
        
        // Customer status counts
        client.client.request(`
          query GetCustomerStats($reseller_id: uuid!) {
            verified: mst_customer_aggregate(
              where: { 
                reseller_id: { _eq: $reseller_id }
                kyc_status: { _eq: "verified" }
              }
            ) {
              aggregate {
                count
              }
            }
            active: mst_customer_aggregate(
              where: { 
                reseller_id: { _eq: $reseller_id }
                status: { _eq: "approved" }
              }
            ) {
              aggregate {
                count
              }
            }
            suspended: mst_customer_aggregate(
              where: { 
                reseller_id: { _eq: $reseller_id }
                status: { _eq: "suspended" }
              }
            ) {
              aggregate {
                count
              }
            }
          }
        `, { reseller_id: resellerId }),
      ]);

      // Process activations by month
      const activations = new Array(12).fill(0);
      activationsResult.mst_virtual_number?.forEach((vn) => {
        const month = new Date(vn.created_at).toISOString().substring(0, 7);
        const index = months.indexOf(month);
        if (index >= 0) {
          activations[index]++;
        }
      });

      // Process renewals by month
      const renewals = new Array(12).fill(0);
      renewalsResult.mst_transaction?.forEach((txn) => {
        const month = new Date(txn.created_at).toISOString().substring(0, 7);
        const index = months.indexOf(month);
        if (index >= 0) {
          renewals[index]++;
        }
      });

      // Process suspensions by month
      const suspensions = new Array(12).fill(0);
      suspensionsResult.mst_customer?.forEach((customer) => {
        const month = new Date(customer.updated_at).toISOString().substring(0, 7);
        const index = months.indexOf(month);
        if (index >= 0) {
          suspensions[index]++;
        }
      });

      // Format month labels
      const monthLabels = months.map(month => {
        const [year, monthNum] = month.split('-');
        const date = new Date(year, parseInt(monthNum) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      });

      return {
        adminPerformance: {
          labels: monthLabels,
          activations,
          renewals,
          suspensions,
        },
        customers: {
          verified: customersResult.verified?.aggregate?.count || 0,
          active: customersResult.active?.aggregate?.count || 0,
          suspended: customersResult.suspended?.aggregate?.count || 0,
        },
      };
    } catch (error) {
      console.error('Error fetching reseller dashboard charts:', error);
      throw error;
    }
  }

  /**
   * Get expiring numbers list
   * @param {string} resellerId 
   * @returns {Promise<Array>}
   */
  static async getExpiringNumbers(resellerId) {
    try {
      const client = getHasuraClient();
      
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      const expiryDate = thirtyDaysLater.toISOString().split('T')[0];

      const query = `
        query GetExpiringNumbers($reseller_id: uuid!, $today: date!, $expiry_date: date!) {
          mst_virtual_number(
            where: { 
              reseller_id: { _eq: $reseller_id }
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
          }
        }
      `;

      const result = await client.client.request(query, {
        reseller_id: resellerId,
        today,
        expiry_date: expiryDate,
      });

      const numbers = result.mst_virtual_number || [];
      
      // Calculate days left for each number
      const numbersWithDaysLeft = numbers.map((vn) => {
        const expiry = new Date(vn.expiry_date);
        const today = new Date();
        const diffTime = expiry - today;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
          ...vn,
          daysLeft: daysLeft > 0 ? daysLeft : 0,
          customerName: vn.mst_customer?.business_name || 
                       vn.mst_customer?.profile_name || 
                       vn.mst_customer?.pan_full_name || 
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


import { getHasuraClient } from '../config/hasura.client.js';

/**
 * Virtual Numbers Service
 * Handles business logic for virtual numbers API
 */
export class VirtualNumbersService {
  // Default rate for virtual number activation (13 months)
  static DEFAULT_RATE = 500.00;
  static ACTIVATION_MONTHS = 13;

  /**
   * Get available virtual numbers
   * @returns {Promise<Array>} List of available numbers
   */
  static async getAvailableNumbers() {
    try {
      const client = getHasuraClient();
      
      // Query for numbers that are not assigned (no reseller_id and no customer_id)
      // or have status "available"
      const query = `
        query GetAvailableNumbers {
          mst_virtual_number(
            where: { 
              _or: [
                { 
                  _and: [
                    { reseller_id: { _is_null: true } },
                    { customer_id: { _is_null: true } }
                  ]
                },
                { status: { _eq: "available" } }
              ]
            }
            limit: 100
          ) {
            id
            virtual_number
            status
            reseller_id
            customer_id
          }
        }
      `;

      const result = await client.client.request(query);
      
      // Transform to API format
      const availableNumbers = (result.mst_virtual_number || []).map((vn) => ({
        id: vn.id,
        number: vn.virtual_number,
        region: "India", // Default region - can be enhanced
        rate: this.DEFAULT_RATE
      }));

      return {
        success: true,
        data: availableNumbers
      };
    } catch (error) {
      console.error('Error fetching available numbers:', error);
      throw new Error('Failed to fetch available numbers');
    }
  }

  /**
   * Activate a virtual number
   * @param {string} number - Virtual number to activate
   * @param {string} resellerId - Reseller ID (from API key)
   * @returns {Promise<object>} Activation result
   */
  static async activateNumber(number, resellerId) {
    try {
      const client = getHasuraClient();

      // 1. Check if number exists and is available
      const checkQuery = `
        query GetVirtualNumber($number: String!) {
          mst_virtual_number(
            where: { virtual_number: { _eq: $number } }
            limit: 1
          ) {
            id
            virtual_number
            status
            reseller_id
            customer_id
            purchase_date
            expiry_date
          }
        }
      `;

      const checkResult = await client.client.request(checkQuery, { number });
      const existingNumber = checkResult.mst_virtual_number?.[0];

      if (!existingNumber) {
        return {
          success: false,
          status: 404,
          message: 'Number not found or not available'
        };
      }

      if (existingNumber.status === 'active') {
        return {
          success: false,
          status: 400,
          message: 'Number is already active'
        };
      }

      // 2. Check wallet balance
      const walletQuery = `
        query GetWallet($reseller_id: uuid!) {
          mst_wallet(
            where: { reseller_id: { _eq: $reseller_id } }
            limit: 1
          ) {
            id
            balance
            reseller_id
          }
        }
      `;

      const walletResult = await client.client.request(walletQuery, { reseller_id: resellerId });
      const wallet = walletResult.mst_wallet?.[0];

      if (!wallet) {
        return {
          success: false,
          status: 400,
          message: 'Wallet not found. Please contact support.'
        };
      }

      if (wallet.balance < this.DEFAULT_RATE) {
        return {
          success: false,
          status: 400,
          message: `Insufficient balance. Required: ${this.DEFAULT_RATE}, Available: ${wallet.balance}`
        };
      }

      // 3. Calculate dates
      const today = new Date();
      const expiryDate = new Date(today);
      expiryDate.setMonth(expiryDate.getMonth() + this.ACTIVATION_MONTHS);

      // 4. Update virtual number
      const updateMutation = `
        mutation UpdateVirtualNumber(
          $id: uuid!
          $status: String!
          $reseller_id: uuid!
          $purchase_date: date!
          $expiry_date: date!
        ) {
          update_mst_virtual_number_by_pk(
            pk_columns: { id: $id }
            _set: {
              status: $status
              reseller_id: $reseller_id
              purchase_date: $purchase_date
              expiry_date: $expiry_date
            }
          ) {
            id
            virtual_number
            status
            purchase_date
            expiry_date
          }
        }
      `;

      await client.client.request(updateMutation, {
        id: existingNumber.id,
        status: 'active',
        reseller_id: resellerId,
        purchase_date: today.toISOString().split('T')[0],
        expiry_date: expiryDate.toISOString().split('T')[0]
      });

      // 5. Deduct from wallet
      const newBalance = Number(wallet.balance) - this.DEFAULT_RATE;
      const walletUpdateMutation = `
        mutation UpdateWallet($id: uuid!, $balance: numeric!) {
          update_mst_wallet_by_pk(
            pk_columns: { id: $id }
            _set: { balance: $balance }
          ) {
            id
            balance
          }
        }
      `;

      await client.client.request(walletUpdateMutation, {
        id: wallet.id,
        balance: newBalance
      });

      // 6. Create wallet transaction
      const transactionMutation = `
        mutation CreateTransaction(
          $wallet_id: uuid!
          $amount: numeric!
          $transaction_type: String!
          $balance_before: numeric!
          $balance_after: numeric!
          $description: String!
        ) {
          insert_mst_wallet_transaction_one(object: {
            wallet_id: $wallet_id
            amount: $amount
            transaction_type: $transaction_type
            balance_before: $balance_before
            balance_after: $balance_after
            description: $description
          }) {
            id
          }
        }
      `;

      await client.client.request(transactionMutation, {
        wallet_id: wallet.id,
        amount: this.DEFAULT_RATE,
        transaction_type: 'debit',
        balance_before: Number(wallet.balance),
        balance_after: newBalance,
        description: `Virtual number activation: ${number}`
      });

      return {
        success: true,
        data: {
          number: number,
          status: 'ACTIVE',
          activation_date: today.toISOString().split('T')[0],
          expiry_date: expiryDate.toISOString().split('T')[0],
          amount_deducted: this.DEFAULT_RATE,
          wallet_balance: newBalance
        }
      };
    } catch (error) {
      console.error('Error activating number:', error);
      throw new Error('Failed to activate number');
    }
  }

  /**
   * Configure call forwarding
   * @param {string} number - Virtual number
   * @param {string} forwardType - Type: mobile, extension, or uri
   * @param {string} forwardValue - Forwarding destination
   * @param {string} resellerId - Reseller ID
   * @returns {Promise<object>} Configuration result
   */
  static async configureCallForwarding(number, forwardType, forwardValue, resellerId) {
    try {
      // Validate forward type
      const validTypes = ['mobile', 'extension', 'uri'];
      if (!validTypes.includes(forwardType)) {
        return {
          success: false,
          status: 400,
          message: 'Invalid forward_type. Must be: mobile, extension, or uri'
        };
      }

      // Validate mobile number format
      if (forwardType === 'mobile') {
        if (!/^\d{10}$/.test(forwardValue)) {
          return {
            success: false,
            status: 400,
            message: 'Invalid mobile number. Must be 10 digits.'
          };
        }
      }

      const client = getHasuraClient();

      // Check if number exists and is active
      const checkQuery = `
        query GetVirtualNumber($number: String!, $reseller_id: uuid!) {
          mst_virtual_number(
            where: { 
              virtual_number: { _eq: $number },
              reseller_id: { _eq: $reseller_id },
              status: { _eq: "active" }
            }
            limit: 1
          ) {
            id
            virtual_number
            status
            call_forwarding_number
          }
        }
      `;

      const checkResult = await client.client.request(checkQuery, { 
        number, 
        reseller_id: resellerId 
      });
      const virtualNumber = checkResult.mst_virtual_number?.[0];

      if (!virtualNumber) {
        return {
          success: false,
          status: 404,
          message: 'Number not found or not activated'
        };
      }

      // Format forward value based on type
      let formattedForwardValue = forwardValue;
      if (forwardType === 'mobile') {
        formattedForwardValue = `SIP/airtel/${forwardValue}`;
      } else if (forwardType === 'extension') {
        formattedForwardValue = `SIP/${forwardValue}`;
      }
      // uri type uses the value as-is

      // Update call forwarding
      const updateMutation = `
        mutation UpdateCallForwarding($id: uuid!, $call_forwarding_number: String!) {
          update_mst_virtual_number_by_pk(
            pk_columns: { id: $id }
            _set: { call_forwarding_number: $call_forwarding_number }
          ) {
            id
            virtual_number
            call_forwarding_number
          }
        }
      `;

      await client.client.request(updateMutation, {
        id: virtualNumber.id,
        call_forwarding_number: formattedForwardValue
      });

      return {
        success: true,
        data: {
          number: number,
          forward_type: forwardType,
          forward_value: forwardValue
        }
      };
    } catch (error) {
      console.error('Error configuring call forwarding:', error);
      throw new Error('Failed to configure call forwarding');
    }
  }

  /**
   * Get number details
   * @param {string} number - Virtual number
   * @param {string} resellerId - Reseller ID
   * @returns {Promise<object>} Number details
   */
  static async getNumberDetails(number, resellerId) {
    try {
      const client = getHasuraClient();

      const query = `
        query GetNumberDetails($number: String!, $reseller_id: uuid!) {
          mst_virtual_number(
            where: { 
              virtual_number: { _eq: $number },
              reseller_id: { _eq: $reseller_id }
            }
            limit: 1
          ) {
            id
            virtual_number
            status
            call_forwarding_number
            purchase_date
            expiry_date
          }
        }
      `;

      const result = await client.client.request(query, { 
        number, 
        reseller_id: resellerId 
      });
      const virtualNumber = result.mst_virtual_number?.[0];

      if (!virtualNumber) {
        return {
          success: false,
          status: 404,
          message: 'Number not found'
        };
      }

      // Map status
      let status = 'AVAILABLE';
      if (virtualNumber.status === 'active') {
        status = 'ACTIVE';
      } else if (virtualNumber.status === 'suspended') {
        status = 'SUSPENDED';
      }

      return {
        success: true,
        data: {
          number: virtualNumber.virtual_number,
          status: status,
          forward_to: virtualNumber.call_forwarding_number || null,
          activation_date: virtualNumber.purchase_date || null,
          expiry_date: virtualNumber.expiry_date || null
        }
      };
    } catch (error) {
      console.error('Error fetching number details:', error);
      throw new Error('Failed to fetch number details');
    }
  }

  /**
   * Suspend a number
   * @param {string} number - Virtual number to suspend
   * @param {string} resellerId - Reseller ID
   * @returns {Promise<object>} Suspension result
   */
  static async suspendNumber(number, resellerId) {
    try {
      const client = getHasuraClient();

      // Check if number exists and is active
      const checkQuery = `
        query GetVirtualNumber($number: String!, $reseller_id: uuid!) {
          mst_virtual_number(
            where: { 
              virtual_number: { _eq: $number },
              reseller_id: { _eq: $reseller_id },
              status: { _eq: "active" }
            }
            limit: 1
          ) {
            id
            virtual_number
            status
          }
        }
      `;

      const checkResult = await client.client.request(checkQuery, { 
        number, 
        reseller_id: resellerId 
      });
      const virtualNumber = checkResult.mst_virtual_number?.[0];

      if (!virtualNumber) {
        return {
          success: false,
          status: 404,
          message: 'Number not found or not active'
        };
      }

      // Update status to suspended
      const updateMutation = `
        mutation SuspendNumber($id: uuid!) {
          update_mst_virtual_number_by_pk(
            pk_columns: { id: $id }
            _set: { status: "suspended" }
          ) {
            id
            virtual_number
            status
          }
        }
      `;

      await client.client.request(updateMutation, {
        id: virtualNumber.id
      });

      return {
        success: true,
        data: {
          number: number,
          status: 'SUSPENDED',
          suspended_on: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error suspending number:', error);
      throw new Error('Failed to suspend number');
    }
  }

  /**
   * Reactivate a suspended number
   * @param {string} number - Virtual number to reactivate
   * @param {string} resellerId - Reseller ID
   * @returns {Promise<object>} Reactivation result
   */
  static async reactivateNumber(number, resellerId) {
    try {
      const client = getHasuraClient();

      // Check if number exists and is suspended
      const checkQuery = `
        query GetVirtualNumber($number: String!, $reseller_id: uuid!) {
          mst_virtual_number(
            where: { 
              virtual_number: { _eq: $number },
              reseller_id: { _eq: $reseller_id },
              status: { _eq: "suspended" }
            }
            limit: 1
          ) {
            id
            virtual_number
            status
            expiry_date
          }
        }
      `;

      const checkResult = await client.client.request(checkQuery, { 
        number, 
        reseller_id: resellerId 
      });
      const virtualNumber = checkResult.mst_virtual_number?.[0];

      if (!virtualNumber) {
        return {
          success: false,
          status: 404,
          message: 'Number not active or not suspended'
        };
      }

      // Check wallet balance
      const walletQuery = `
        query GetWallet($reseller_id: uuid!) {
          mst_wallet(
            where: { reseller_id: { _eq: $reseller_id } }
            limit: 1
          ) {
            id
            balance
          }
        }
      `;

      const walletResult = await client.client.request(walletQuery, { 
        reseller_id: resellerId 
      });
      const wallet = walletResult.mst_wallet?.[0];

      if (!wallet) {
        return {
          success: false,
          status: 400,
          message: 'Wallet not found. Please contact support.'
        };
      }

      if (wallet.balance < this.DEFAULT_RATE) {
        return {
          success: false,
          status: 400,
          message: `Insufficient balance. Required: ${this.DEFAULT_RATE}, Available: ${wallet.balance}`
        };
      }

      // Calculate new expiry date (extend by 13 months from today)
      const today = new Date();
      const expiryDate = new Date(today);
      expiryDate.setMonth(expiryDate.getMonth() + this.ACTIVATION_MONTHS);

      // Update virtual number
      const updateMutation = `
        mutation ReactivateNumber($id: uuid!, $expiry_date: date!) {
          update_mst_virtual_number_by_pk(
            pk_columns: { id: $id }
            _set: { 
              status: "active",
              expiry_date: $expiry_date
            }
          ) {
            id
            virtual_number
            status
            expiry_date
          }
        }
      `;

      await client.client.request(updateMutation, {
        id: virtualNumber.id,
        expiry_date: expiryDate.toISOString().split('T')[0]
      });

      // Deduct from wallet
      const newBalance = Number(wallet.balance) - this.DEFAULT_RATE;
      const walletUpdateMutation = `
        mutation UpdateWallet($id: uuid!, $balance: numeric!) {
          update_mst_wallet_by_pk(
            pk_columns: { id: $id }
            _set: { balance: $balance }
          ) {
            id
            balance
          }
        }
      `;

      await client.client.request(walletUpdateMutation, {
        id: wallet.id,
        balance: newBalance
      });

      // Create wallet transaction
      const transactionMutation = `
        mutation CreateTransaction(
          $wallet_id: uuid!
          $amount: numeric!
          $transaction_type: String!
          $balance_before: numeric!
          $balance_after: numeric!
          $description: String!
        ) {
          insert_mst_wallet_transaction_one(object: {
            wallet_id: $wallet_id
            amount: $amount
            transaction_type: $transaction_type
            balance_before: $balance_before
            balance_after: $balance_after
            description: $description
          }) {
            id
          }
        }
      `;

      await client.client.request(transactionMutation, {
        wallet_id: wallet.id,
        amount: this.DEFAULT_RATE,
        transaction_type: 'debit',
        balance_before: Number(wallet.balance),
        balance_after: newBalance,
        description: `Virtual number reactivation: ${number}`
      });

      return {
        success: true,
        data: {
          number: number,
          status: 'ACTIVE',
          reactivated_on: today.toISOString(),
          expiry_date: expiryDate.toISOString().split('T')[0],
          amount_deducted: this.DEFAULT_RATE,
          wallet_balance: newBalance
        }
      };
    } catch (error) {
      console.error('Error reactivating number:', error);
      throw new Error('Failed to reactivate number');
    }
  }
}


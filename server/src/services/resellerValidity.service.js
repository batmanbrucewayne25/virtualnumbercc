import { getHasuraClient } from '../../config/hasura.client.js';

/**
 * Reseller Validity Service
 * Handles reseller validity updates when wallet recharge happens
 */
export class ResellerValidityService {
  /**
   * Default validity days when wallet is recharged
   */
  static DEFAULT_VALIDITY_DAYS = 365;

  /**
   * Update or create reseller validity when wallet is recharged
   * @param {string} resellerId - Reseller ID
   * @param {string} walletId - Wallet ID (from the recharge transaction)
   * @param {number} rechargeAmount - Amount recharged
   * @param {string} action - Action type: 'WALLET_RECHARGE_RESET' | 'ADMIN_RESET' | 'MANUAL_UPDATE'
   * @param {number} validityDays - Optional validity days (defaults to DEFAULT_VALIDITY_DAYS)
   * @returns {Promise<object>} Result with validity data
   */
  static async updateValidityOnRecharge(
    resellerId,
    walletId,
    rechargeAmount,
    action = 'WALLET_RECHARGE_RESET',
    validityDays = null
  ) {
    try {
      const client = getHasuraClient();
      const validityDaysToUse = validityDays || this.DEFAULT_VALIDITY_DAYS;

      // Get current validity if exists
      const getCurrentValidityQuery = `
        query GetCurrentValidity($reseller_id: uuid!) {
          mst_reseller_validity(
            where: { reseller_id: { _eq: $reseller_id } }
            limit: 1
          ) {
            id
            reseller_id
            validity_start_date
            validity_end_date
            validity_days
            status
          }
        }
      `;

      const currentValidityResult = await client.client.request(
        getCurrentValidityQuery,
        { reseller_id: resellerId }
      );

      const currentValidity = currentValidityResult.mst_reseller_validity?.[0];
      const now = new Date();
      const newValidityStart = now;
      const newValidityEnd = new Date(now);
      newValidityEnd.setDate(newValidityEnd.getDate() + validityDaysToUse);

      // Prepare previous validity dates for history
      const previousValidityStart = currentValidity?.validity_start_date || null;
      const previousValidityEnd = currentValidity?.validity_end_date || null;

      // Upsert validity (insert or update)
      const upsertValidityMutation = `
        mutation UpsertResellerValidity(
          $reseller_id: uuid!
          $validity_start_date: timestamp!
          $validity_end_date: timestamp!
          $validity_days: Int!
          $last_wallet_id: uuid!
          $last_recharge_amount: numeric!
          $status: String!
        ) {
          insert_mst_reseller_validity_one(
            object: {
              reseller_id: $reseller_id
              validity_start_date: $validity_start_date
              validity_end_date: $validity_end_date
              validity_days: $validity_days
              last_wallet_id: $last_wallet_id
              last_recharge_amount: $last_recharge_amount
              status: $status
            }
            on_conflict: {
              constraint: mst_reseller_validity_reseller_id_key
              update_columns: [
                validity_start_date
                validity_end_date
                validity_days
                last_wallet_id
                last_recharge_amount
                status
                updated_at
              ]
            }
          ) {
            id
            reseller_id
            validity_start_date
            validity_end_date
            validity_days
            last_wallet_id
            last_recharge_amount
            status
            created_at
            updated_at
          }
        }
      `;

      const validityResult = await client.client.request(
        upsertValidityMutation,
        {
          reseller_id: resellerId,
          validity_start_date: newValidityStart.toISOString(),
          validity_end_date: newValidityEnd.toISOString(),
          validity_days: validityDaysToUse,
          last_wallet_id: walletId,
          last_recharge_amount: rechargeAmount,
          status: 'ACTIVE',
        }
      );

      const validity = validityResult.insert_mst_reseller_validity_one;

      if (!validity) {
        throw new Error('Failed to create or update reseller validity');
      }

      // Create history record
      const createHistoryMutation = `
        mutation CreateResellerValidityHistory(
          $reseller_id: uuid!
          $wallet_id: uuid!
          $recharge_amount: numeric!
          $previous_validity_start: timestamp
          $previous_validity_end: timestamp
          $new_validity_start: timestamp!
          $new_validity_end: timestamp!
          $validity_days: Int!
          $action: String!
        ) {
          insert_mst_reseller_validity_history_one(
            object: {
              reseller_id: $reseller_id
              wallet_id: $wallet_id
              recharge_amount: $recharge_amount
              previous_validity_start: $previous_validity_start
              previous_validity_end: $previous_validity_end
              new_validity_start: $new_validity_start
              new_validity_end: $new_validity_end
              validity_days: $validity_days
              action: $action
            }
          ) {
            id
            reseller_id
            wallet_id
            recharge_amount
            previous_validity_start
            previous_validity_end
            new_validity_start
            new_validity_end
            validity_days
            action
            created_at
          }
        }
      `;

      const historyResult = await client.client.request(
        createHistoryMutation,
        {
          reseller_id: resellerId,
          wallet_id: walletId,
          recharge_amount: rechargeAmount,
          previous_validity_start: previousValidityStart,
          previous_validity_end: previousValidityEnd,
          new_validity_start: newValidityStart.toISOString(),
          new_validity_end: newValidityEnd.toISOString(),
          validity_days: validityDaysToUse,
          action: action,
        }
      );

      return {
        success: true,
        data: {
          validity: validity,
          history: historyResult.insert_mst_reseller_validity_history_one,
        },
        message: 'Reseller validity updated successfully',
      };
    } catch (error) {
      console.error('Error updating reseller validity:', error);
      return {
        success: false,
        message: error.message || 'Failed to update reseller validity',
      };
    }
  }

  /**
   * Get reseller validity
   * @param {string} resellerId - Reseller ID
   * @returns {Promise<object>} Validity data
   */
  static async getResellerValidity(resellerId) {
    try {
      const client = getHasuraClient();

      const query = `
        query GetResellerValidity($reseller_id: uuid!) {
          mst_reseller_validity(
            where: { reseller_id: { _eq: $reseller_id } }
            limit: 1
          ) {
            id
            reseller_id
            validity_start_date
            validity_end_date
            validity_days
            last_wallet_id
            last_recharge_amount
            status
            created_at
            updated_at
          }
        }
      `;

      const result = await client.client.request(query, {
        reseller_id: resellerId,
      });

      const validity = result.mst_reseller_validity?.[0];

      return {
        success: true,
        data: validity || null,
        message: validity ? 'Validity found' : 'No validity record found',
      };
    } catch (error) {
      console.error('Error getting reseller validity:', error);
      return {
        success: false,
        message: error.message || 'Failed to get reseller validity',
      };
    }
  }

  /**
   * Get reseller validity history
   * @param {string} resellerId - Reseller ID
   * @param {number} limit - Limit results (default: 50)
   * @returns {Promise<object>} History data
   */
  static async getResellerValidityHistory(resellerId, limit = 50) {
    try {
      const client = getHasuraClient();

      const query = `
        query GetResellerValidityHistory($reseller_id: uuid!, $limit: Int!) {
          mst_reseller_validity_history(
            where: { reseller_id: { _eq: $reseller_id } }
            order_by: { created_at: desc }
            limit: $limit
          ) {
            id
            reseller_id
            wallet_id
            recharge_amount
            previous_validity_start
            previous_validity_end
            new_validity_start
            new_validity_end
            validity_days
            action
            created_at
          }
        }
      `;

      const result = await client.client.request(query, {
        reseller_id: resellerId,
        limit: limit,
      });

      return {
        success: true,
        data: result.mst_reseller_validity_history || [],
        message: 'History retrieved successfully',
      };
    } catch (error) {
      console.error('Error getting reseller validity history:', error);
      return {
        success: false,
        message: error.message || 'Failed to get reseller validity history',
      };
    }
  }
}


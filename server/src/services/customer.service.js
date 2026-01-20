import { getHasuraClient } from '../config/hasura.client.js';
import { sendVirtualNumberEmail, sendRazorpayLinkEmail } from '../../services/emailService.js';

export class CustomerService {
  /**
   * Generate a virtual number
   * @returns {Promise<string>} Virtual number
   */
  static async generateVirtualNumber() {
    // Generate a random 10-digit virtual number
    // Format: +91XXXXXXXXXX (India country code + 10 digits)
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
    return `+91${randomDigits}`;
  }

  /**
   * Get admin wallet by admin ID
   * @param {string} adminId 
   * @returns {Promise<object|null>}
   */
  static async getAdminWallet(adminId) {
    try {
      const client = getHasuraClient();
      
      // Try to get admin wallet - assuming wallet table has user_type and reseller_id/admin_id fields
      const query = `
        query GetAdminWallet($admin_id: uuid!) {
          mst_wallet(
            where: { 
              user_type: { _eq: "admin" }
              reseller_id: { _eq: $admin_id }
            }
            limit: 1
          ) {
            id
            reseller_id
            user_type
            balance
          }
        }
      `;

      const data = await client.client.request(query, { admin_id: adminId });
      
      if (data.mst_wallet && data.mst_wallet.length > 0) {
        return data.mst_wallet[0];
      }

      // If not found, try alternative query structure
      const altQuery = `
        query GetAdminWalletAlt($admin_id: uuid!) {
          mst_wallet(
            where: { 
              user_type: { _eq: "admin" }
            }
            limit: 1
          ) {
            id
            reseller_id
            user_type
            balance
          }
        }
      `;

      const altData = await client.client.request(altQuery, { admin_id: adminId });
      return altData.mst_wallet && altData.mst_wallet.length > 0 ? altData.mst_wallet[0] : null;
    } catch (error) {
      console.error('Error fetching admin wallet:', error);
      return null;
    }
  }

  /**
   * Debit amount from admin wallet
   * @param {string} walletId 
   * @param {number} amount 
   * @returns {Promise<boolean>}
   */
  static async debitAdminWallet(walletId, amount) {
    try {
      const client = getHasuraClient();
      
      // Get current balance
      const getWalletQuery = `
        query GetWallet($id: uuid!) {
          mst_wallet_by_pk(id: $id) {
            id
            balance
          }
        }
      `;

      const walletData = await client.client.request(getWalletQuery, { id: walletId });
      const currentBalance = Number(walletData.mst_wallet_by_pk?.balance || 0);

      if (currentBalance < amount) {
        throw new Error('Insufficient wallet balance');
      }

      // Update wallet balance
      const updateMutation = `
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

      const newBalance = currentBalance - amount;
      await client.client.request(updateMutation, {
        id: walletId,
        balance: newBalance,
      });

      return true;
    } catch (error) {
      console.error('Error debiting admin wallet:', error);
      throw error;
    }
  }

  /**
   * Create virtual number for customer
   * @param {string} customerId 
   * @param {string} virtualNumber 
   * @param {string} resellerId - Optional reseller ID
   * @returns {Promise<object>}
   */
  static async createVirtualNumber(customerId, virtualNumber, resellerId = null) {
    try {
      const client = getHasuraClient();
      
      // Get today's date in YYYY-MM-DD format
      const purchaseDate = new Date().toISOString().split('T')[0];
      
      const mutation = `
        mutation CreateVirtualNumber(
          $customer_id: uuid!
          $virtual_number: String!
          $reseller_id: uuid
          $purchase_date: date!
        ) {
          insert_mst_virtual_number_one(object: {
            customer_id: $customer_id
            virtual_number: $virtual_number
            reseller_id: $reseller_id
            status: "active"
            purchase_date: $purchase_date
          }) {
            id
            customer_id
            reseller_id
            virtual_number
            status
            purchase_date
            expiry_date
            created_at
          }
        }
      `;

      const result = await client.client.request(mutation, {
        customer_id: customerId,
        virtual_number: virtualNumber,
        reseller_id: resellerId || null,
        purchase_date: purchaseDate,
      });

      if (result.insert_mst_virtual_number_one) {
        return result.insert_mst_virtual_number_one;
      }

      throw new Error('Failed to create virtual number');
    } catch (error) {
      console.error('Error creating virtual number:', error);
      throw error;
    }
  }

  /**
   * Create transaction record
   * @param {object} transactionData 
   * @returns {Promise<object>}
   */
  static async createTransaction(transactionData) {
    try {
      const client = getHasuraClient();
      
      // Generate unique transaction number
      const transactionNumber = `TXN${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      const mutation = `
        mutation CreateTransaction(
          $transaction_number: String!
          $customer_id: uuid
          $reseller_id: uuid!
          $virtual_number_id: uuid
          $transaction_type: String!
          $payment_mode: String
          $payment_method: String
          $amount: numeric!
          $status: String
          $reference_number: String
          $payment_date: date
        ) {
          insert_mst_transaction_one(object: {
            transaction_number: $transaction_number
            customer_id: $customer_id
            reseller_id: $reseller_id
            virtual_number_id: $virtual_number_id
            transaction_type: $transaction_type
            payment_mode: $payment_mode
            payment_method: $payment_method
            amount: $amount
            status: $status
            reference_number: $reference_number
            payment_date: $payment_date
          }) {
            id
            transaction_number
            customer_id
            reseller_id
            virtual_number_id
            transaction_type
            payment_mode
            payment_method
            amount
            status
            reference_number
            payment_date
            created_at
          }
        }
      `;

      const result = await client.client.request(mutation, {
        transaction_number: transactionNumber,
        customer_id: transactionData.customer_id || null,
        reseller_id: transactionData.reseller_id,
        virtual_number_id: transactionData.virtual_number_id || null,
        transaction_type: transactionData.transaction_type || 'payment',
        payment_mode: transactionData.payment_mode || null,
        payment_method: transactionData.payment_method || null,
        amount: transactionData.amount,
        status: transactionData.status || 'success',
        reference_number: transactionData.reference_number || null,
        payment_date: transactionData.payment_date || null,
      });

      return result.insert_mst_transaction_one;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   * @param {string} customerId 
   * @returns {Promise<object|null>}
   */
  static async getCustomerById(customerId) {
    try {
      const client = getHasuraClient();
      
      const query = `
        query GetCustomerById($id: uuid!) {
          mst_customer_by_pk(id: $id) {
            id
            reseller_id
            email
            phone
            profile_name
            business_email
            status
            kyc_status
            mst_reseller {
              id
              first_name
              last_name
              email
              business_name
            }
          }
        }
      `;

      const data = await client.client.request(query, { id: customerId });
      return data.mst_customer_by_pk;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  }

  /**
   * Get subscription plan by ID
   * @param {string} planId 
   * @returns {Promise<object|null>}
   */
  static async getSubscriptionPlanById(planId) {
    try {
      const client = getHasuraClient();
      
      const query = `
        query GetSubscriptionPlanById($id: uuid!) {
          mst_subscription_plan_by_pk(id: $id) {
            id
            plan_name
            amount
            currency
            duration_days
            razorpay_plan_id
            razorpay_link_id
            reseller_id
          }
        }
      `;

      const data = await client.client.request(query, { id: planId });
      return data.mst_subscription_plan_by_pk;
    } catch (error) {
      console.error('Error fetching subscription plan:', error);
      throw error;
    }
  }

  /**
   * Update customer status
   * @param {string} customerId 
   * @param {string} status 
   * @param {string} kycStatus 
   * @returns {Promise<object>}
   */
  static async updateCustomerStatus(customerId, status, kycStatus) {
    try {
      const client = getHasuraClient();
      
      const mutation = `
        mutation UpdateCustomerStatus(
          $id: uuid!
          $status: String!
          $kyc_status: String!
        ) {
          update_mst_customer_by_pk(
            pk_columns: { id: $id }
            _set: {
              status: $status
              kyc_status: $kyc_status
            }
          ) {
            id
            status
            kyc_status
          }
        }
      `;

      const data = await client.client.request(mutation, {
        id: customerId,
        status,
        kyc_status: kycStatus,
      });

      return data.update_mst_customer_by_pk;
    } catch (error) {
      console.error('Error updating customer status:', error);
      throw error;
    }
  }

  /**
   * Approve customer with payment processing
   * @param {object} approvalData 
   * @returns {Promise<object>}
   */
  static async approveCustomer(approvalData) {
    const {
      customer_id,
      payment_method,
      subscription_plan_id,
      payment_reference_number,
      payment_amount,
      payment_date,
      reseller_id,
    } = approvalData;

    try {
      // Get customer details
      const customer = await this.getCustomerById(customer_id);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get reseller details for admin email
      const reseller = customer.mst_reseller;
      if (!reseller) {
        throw new Error('Reseller not found');
      }

      if (payment_method === 'offline') {
        // Offline payment flow
        // 1. Get admin wallet (assuming reseller_id in approvalData is actually admin_id)
        // For now, we'll skip wallet debit as the exact admin wallet structure is unclear
        // TODO: Implement proper admin wallet debit logic based on actual schema
        
        // 2. Generate virtual number
        const virtualNumber = await this.generateVirtualNumber();
        
        // 3. Create virtual number record (pass reseller_id if available)
        const virtualNumberRecord = await this.createVirtualNumber(customer_id, virtualNumber, reseller_id);
        
        // 4. Create transaction record
        await this.createTransaction({
          customer_id: customer_id,
          reseller_id: reseller_id,
          virtual_number_id: virtualNumberRecord?.id || null,
          transaction_type: 'payment',
          payment_mode: 'offline',
          payment_method: 'offline',
          amount: parseFloat(payment_amount) || 0,
          status: 'success',
          reference_number: payment_reference_number || null,
          payment_date: payment_date || new Date().toISOString().split('T')[0],
        });
        
        // 5. Update customer status
        await this.updateCustomerStatus(customer_id, 'approved', 'verified');
        
        // 6. Send emails
        await sendVirtualNumberEmail(
          customer.email,
          customer.profile_name || customer.email,
          virtualNumber,
          reseller.business_name || `${reseller.first_name} ${reseller.last_name}`
        );
        
        // Send to admin (reseller email)
        await sendVirtualNumberEmail(
          reseller.email,
          reseller.business_name || `${reseller.first_name} ${reseller.last_name}`,
          virtualNumber,
          customer.profile_name || customer.email
        );

        return {
          success: true,
          virtual_number: virtualNumber,
          message: 'Customer approved successfully. Virtual number generated and emails sent.',
        };
      } else if (payment_method === 'online') {
        // Online payment flow
        // 1. Get subscription plan
        const subscriptionPlan = await this.getSubscriptionPlanById(subscription_plan_id);
        if (!subscriptionPlan) {
          throw new Error('Subscription plan not found');
        }

        // 2. Create pending transaction record
        await this.createTransaction({
          customer_id: customer_id,
          reseller_id: reseller_id,
          virtual_number_id: null, // Will be updated after payment
          transaction_type: 'payment',
          payment_mode: 'online',
          payment_method: 'razorpay',
          amount: Number(subscriptionPlan.amount) || 0,
          status: 'pending',
          reference_number: null,
          payment_date: null,
        });

        // 3. Update customer status (but don't generate virtual number yet - wait for payment)
        await this.updateCustomerStatus(customer_id, 'pending_payment', 'verified');
        
        // 4. Send Razorpay link email
        const razorpayLink = subscriptionPlan.razorpay_link_id 
          ? `https://razorpay.com/payment-link/${subscriptionPlan.razorpay_link_id}`
          : subscriptionPlan.razorpay_plan_id
          ? `https://razorpay.com/plans/${subscriptionPlan.razorpay_plan_id}`
          : null;

        if (!razorpayLink) {
          throw new Error('Razorpay link not configured for this subscription plan');
        }

        await sendRazorpayLinkEmail(
          customer.email,
          customer.profile_name || customer.email,
          razorpayLink,
          subscriptionPlan.plan_name,
          subscriptionPlan.amount,
          reseller.business_name || `${reseller.first_name} ${reseller.last_name}`
        );

        return {
          success: true,
          razorpay_link: razorpayLink,
          message: 'Razorpay payment link sent to customer email.',
        };
      } else {
        throw new Error('Invalid payment method');
      }
    } catch (error) {
      console.error('Error approving customer:', error);
      throw error;
    }
  }
}


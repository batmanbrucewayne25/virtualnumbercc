import { getHasuraClient } from "../config/hasura.client.js";
import {
  sendVirtualNumberEmail,
  sendRazorpayLinkEmail,
  sendCustomerRejectionEmail,
} from "../../services/emailService.js";
import { getResellerSmtpConfig } from "./smtpConfig.service.js";
import { VnApiClient } from "../utils/vnApiClient.js";

/**
 * Customer-related emails (approve, reject, payment link, etc.) must use reseller SMTP
 * from mst_smtp_config via getResellerSmtpConfig(reseller_id). Do not fall back to env
 * SMTP for reseller-scoped mail so that "any mail sending from reseller" uses reseller config only.
 */
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

      const altData = await client.client.request(altQuery, {
        admin_id: adminId,
      });
      return altData.mst_wallet && altData.mst_wallet.length > 0
        ? altData.mst_wallet[0]
        : null;
    } catch (error) {
      console.error("Error fetching admin wallet:", error);
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

      const walletData = await client.client.request(getWalletQuery, {
        id: walletId,
      });
      const currentBalance = Number(walletData.mst_wallet_by_pk?.balance || 0);

      if (currentBalance < amount) {
        throw new Error("Insufficient wallet balance");
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
      console.error("Error debiting admin wallet:", error);
      throw error;
    }
  }

  /**
   * Get reseller wallet by reseller ID
   * @param {string} resellerId
   * @returns {Promise<object|null>}
   */
  static async getResellerWallet(resellerId) {
    try {
      const client = getHasuraClient();
      const query = `
        query GetResellerWallet($reseller_id: uuid!) {
          mst_wallet(
            where: { reseller_id: { _eq: $reseller_id } }
            limit: 1
          ) {
            id
            reseller_id
            balance
            debit_amount
          }
        }
      `;
      const data = await client.client.request(query, {
        reseller_id: resellerId,
      });
      if (data.mst_wallet && data.mst_wallet.length > 0) {
        return data.mst_wallet[0];
      }
      return null;
    } catch (error) {
      console.error("Error fetching reseller wallet:", error);
      return null;
    }
  }

  /**
   * Debit amount from reseller wallet and create wallet transaction record
   * @param {string} resellerId
   * @param {number} amount
   * @param {string} description
   * @param {string|null} reference
   * @returns {Promise<boolean>}
   */
  static async debitResellerWallet(
    resellerId,
    amount,
    description,
    reference,
    customerId = null,
    virtualNumberId = null,
  ) {
    const wallet = await this.getResellerWallet(resellerId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }
    const balanceBefore = Number(String(wallet.balance).replace(/,/g, "")) || 0;
    const amountNum = Number(amount) || 0;
    if (amountNum <= 0) {
      throw new Error("Invalid debit amount");
    }
    if (balanceBefore < amountNum) {
      throw new Error(
        `Insufficient wallet balance. Required: ₹${amountNum.toFixed(2)} (price per number). Your balance: ₹${balanceBefore.toFixed(2)}.`,
      );
    }
    const balanceAfter = balanceBefore - amountNum;
    const existingDebitAmount = Number(wallet.debit_amount) || 0;
    const client = getHasuraClient();

    const insertTransactionMutation = `
      mutation CreateMstWalletTransaction(
        $wallet_id: uuid!
        $transaction_type: String!
        $amount: numeric!
        $balance_before: numeric!
        $balance_after: numeric!
        $description: String
        $reference: String
        $customer_id: uuid
        $virtual_number_id: uuid
      ) {
        insert_mst_wallet_transaction_one(object: {
          wallet_id: $wallet_id
          transaction_type: $transaction_type
          amount: $amount
          balance_before: $balance_before
          balance_after: $balance_after
          description: $description
          reference: $reference
          customer_id: $customer_id
          virtual_number_id: $virtual_number_id
        }) {
          id
        }
      }
    `;
    await client.client.request(insertTransactionMutation, {
      wallet_id: wallet.id,
      transaction_type: "DEBIT",
      amount: amountNum,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: description || "Wallet debit",
      reference: reference || null,
      customer_id: customerId || null,
      virtual_number_id: virtualNumberId || null,
    });

    const updateMutation = `
      mutation UpdateMstWallet(
        $id: uuid!
        $balance: numeric!
        $debit_amount: numeric!
        $last_transaction_at: timestamp!
      ) {
        update_mst_wallet_by_pk(
          pk_columns: { id: $id }
          _set: {
            balance: $balance
            debit_amount: $debit_amount
            last_transaction_at: $last_transaction_at
          }
        ) {
          id
          balance
        }
      }
    `;
    await client.client.request(updateMutation, {
      id: wallet.id,
      balance: balanceAfter,
      debit_amount: existingDebitAmount + amountNum,
      last_transaction_at: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Create virtual number for customer
   * @param {string} customerId
   * @param {string} virtualNumber
   * @param {string} resellerId - Optional reseller ID
   * @param {string} callForwardingNumber - Customer's mobile number for call forwarding
   * @param {string} subscriptionPlanId - Optional subscription plan ID
   * @returns {Promise<object>}
   */
  static async createVirtualNumber(
    customerId,
    virtualNumber,
    resellerId = null,
    callForwardingNumber = null,
    subscriptionPlanId = null,
  ) {
    try {
      const client = getHasuraClient();

      // Get today's date in YYYY-MM-DD format
      const purchaseDate = new Date().toISOString().split("T")[0];

      // Calculate expiry_date as 360 days from purchase_date
      const purchaseDateObj = new Date(purchaseDate);
      const expiryDateObj = new Date(purchaseDateObj);
      expiryDateObj.setDate(expiryDateObj.getDate() + 360);
      const expiryDate = expiryDateObj.toISOString().split("T")[0];

      const mutation = `
        mutation CreateVirtualNumber(
          $customer_id: uuid!
          $virtual_number: String!
          $reseller_id: uuid
          $purchase_date: date!
          $expiry_date: date!
          $call_forwarding_number: String
          $subscription_plan_id: uuid
        ) {
          insert_mst_virtual_number_one(object: {
            customer_id: $customer_id
            virtual_number: $virtual_number
            reseller_id: $reseller_id
            status: "active"
            purchase_date: $purchase_date
            expiry_date: $expiry_date
            call_forwarding_number: $call_forwarding_number
            subscription_plan_id: $subscription_plan_id
          }) {
            id
            customer_id
            reseller_id
            virtual_number
            call_forwarding_number
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
        expiry_date: expiryDate,
        call_forwarding_number: callForwardingNumber || null,
        subscription_plan_id: subscriptionPlanId || null,
      });

      if (result.insert_mst_virtual_number_one) {
        return result.insert_mst_virtual_number_one;
      }

      throw new Error("Failed to create virtual number");
    } catch (error) {
      console.error("Error creating virtual number:", error);
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
      const transactionNumber = `TXN${Date.now()}${Math.random()
        .toString(36)
        .substring(2, 9)
        .toUpperCase()}`;

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
          $customer_email: String
          $customer_name: String
          $notes: jsonb
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
            customer_email: $customer_email
            customer_name: $customer_name
            notes: $notes
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
        transaction_type: transactionData.transaction_type || "payment",
        payment_mode: transactionData.payment_mode || null,
        payment_method: transactionData.payment_method || null,
        amount: transactionData.amount,
        status: transactionData.status || "success",
        reference_number: transactionData.reference_number || null,
        payment_date: transactionData.payment_date || null,
        customer_email: transactionData.customer_email || null,
        customer_name: transactionData.customer_name || null,
        notes: transactionData.notes || null,
      });

      return result.insert_mst_transaction_one;
    } catch (error) {
      console.error("Error creating transaction:", error);
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
            approval
            mst_reseller {
              id
              first_name
              last_name
              email
              business_name
              brand_name
              price_per_number
            }
            mst_virtual_numbers(limit: 1) {
              id
            }
            mst_transactions(
              where: { status: { _in: ["pending", "success", "authorized"] } }
              limit: 1
              order_by: { created_at: desc }
            ) {
              id
              status
            }
          }
        }
      `;

      const data = await client.client.request(query, { id: customerId });
      return data.mst_customer_by_pk;
    } catch (error) {
      console.error("Error fetching customer:", error);
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
      console.error("Error fetching subscription plan:", error);
      throw error;
    }
  }

  /**
   * Update customer status
   * @param {string} customerId
   * @param {string} status
   * @param {string} kycStatus
   * @param {string|null} [rejectionReason] - When approving pass null to clear; when rejecting pass the reason
   * @returns {Promise<object>}
   */
  static async updateCustomerStatus(
    customerId,
    status,
    kycStatus,
    rejectionReason = undefined,
  ) {
    try {
      const client = getHasuraClient();

      const mutation = `
        mutation UpdateCustomerStatus(
          $id: uuid!
          $status: String!
          $kyc_status: String!
          $approval: String
          $rejection_reason: String
        ) {
          update_mst_customer_by_pk(
            pk_columns: { id: $id }
            _set: {
              status: $status
              kyc_status: $kyc_status
              approval: $approval
              rejection_reason: $rejection_reason
            }
          ) {
            id
            status
            kyc_status
            approval
            rejection_reason
          }
        }
      `;

      // Set approval field based on status
      let approvalValue = null;
      if (status === "approved" || status === "active") {
        approvalValue = "approved";
      } else if (status === "rejected") {
        approvalValue = "rejected";
      }

      // On approve/active: clear rejection_reason; on reject: set it
      const rejectionReasonValue =
        status === "approved" || status === "active"
          ? null
          : status === "rejected"
            ? (rejectionReason ?? null)
            : null;

      const data = await client.client.request(mutation, {
        id: customerId,
        status,
        kyc_status: kycStatus,
        approval: approvalValue,
        rejection_reason: rejectionReasonValue,
      });

      return data.update_mst_customer_by_pk;
    } catch (error) {
      console.error("Error updating customer status:", error);
      throw error;
    }
  }

  /**
   * Reject customer: update status and send rejection email using reseller SMTP.
   * Customer-related emails must use reseller SMTP from mst_smtp_config via getResellerSmtpConfig;
   * do not fall back to env SMTP for reseller-scoped mail.
   * @param {string} customerId
   * @param {string} rejectionReason
   * @returns {Promise<object>} { success, message, emailSent?, emailWarning? }
   */
  static async rejectCustomer(customerId, rejectionReason) {
    try {
      const customer = await this.getCustomerById(customerId);
      if (!customer) {
        throw new Error("Customer not found");
      }
      const reseller = customer.mst_reseller;
      const resellerName =
        reseller?.brand_name ||
        reseller?.business_name ||
        (reseller?.first_name && reseller?.last_name
          ? `${reseller.first_name} ${reseller.last_name}`
          : null) ||
        reseller?.email ||
        "Your reseller";

      const client = getHasuraClient();
      const mutation = `
        mutation RejectCustomer(
          $id: uuid!
          $status: String!
          $kyc_status: String!
          $approval: String!
          $rejection_reason: String!
        ) {
          update_mst_customer_by_pk(
            pk_columns: { id: $id }
            _set: {
              status: $status
              kyc_status: $kyc_status
              approval: $approval
              rejection_reason: $rejection_reason
            }
          ) {
            id
            status
            kyc_status
            approval
            rejection_reason
          }
        }
      `;
      await client.client.request(mutation, {
        id: customerId,
        status: "rejected",
        kyc_status: "rejected",
        approval: "rejected",
        rejection_reason: rejectionReason || "No reason provided.",
      });

      let emailSent = false;
      let emailWarning = null;
      const resellerSmtpConfig = await getResellerSmtpConfig(
        customer.reseller_id,
      );
      const emailResult = await sendCustomerRejectionEmail(
        customer.email,
        customer.profile_name || customer.email,
        rejectionReason,
        resellerName,
        resellerSmtpConfig,
      );
      if (emailResult?.success) {
        emailSent = true;
      } else {
        emailWarning =
          emailResult?.message ||
          "Rejection notification email could not be sent (reseller SMTP may not be configured).";
        console.warn("[rejectCustomer] Email failed:", emailWarning);
      }

      return {
        success: true,
        message: "Customer rejected successfully.",
        emailSent,
        emailWarning: emailSent ? null : emailWarning,
      };
    } catch (error) {
      console.error("Error rejecting customer:", error);
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
        throw new Error("Customer not found");
      }

      // Guard: block re-approval — check status, existing VN, and existing transactions
      // Status check
      const nonApprovableStatuses = ["active", "approved", "pending_payment"];
      if (nonApprovableStatuses.includes(customer.status)) {
        throw new Error(
          `Customer cannot be approved again — current status is "${customer.status}". ` +
            `If payment was sent but not completed, ask the customer to use the existing payment link.`,
        );
      }
      // VN check — strongest guard, regardless of status
      if (customer.mst_virtual_numbers?.length > 0) {
        throw new Error(
          "Customer already has a virtual number assigned — approval blocked to prevent duplicate assignment.",
        );
      }
      // Transaction check — catches cases where status was manually reset in DB
      // but a pending/success transaction already exists for this customer
      const existingTxn = customer.mst_transactions?.[0];
      if (existingTxn) {
        throw new Error(
          `Customer already has a ${existingTxn.status} transaction (id: ${existingTxn.id}) — ` +
            `approval blocked to prevent duplicate virtual number assignment. ` +
            `If this is a test, reset the transaction status or use a different customer.`,
        );
      }

      // Get reseller details for admin email
      const reseller = customer.mst_reseller;
      if (!reseller) {
        throw new Error("Reseller not found");
      }

      // When admin approves, use customer's reseller for wallet, virtual number, transaction, and emails
      const effectiveResellerId = customer.reseller_id || reseller_id;

      // ── Wallet balance check (blocks both offline and online approval) ────────
      // For offline: wallet is debited immediately on approval.
      // For online: wallet is debited after webhook — but we block here so the
      //   reseller cannot send a payment link they cannot fulfil.
      const pricePerNumber =
        Number(parseFloat(String(reseller?.price_per_number ?? ""))) || 0;
      if (pricePerNumber <= 0) {
        throw new Error(
          "price_per_number is not configured for this reseller. Please set it before approving customers.",
        );
      }
      const resellerWallet = await this.getResellerWallet(effectiveResellerId);
      if (!resellerWallet) {
        throw new Error(
          "Reseller wallet not found. Please contact the administrator.",
        );
      }
      const walletBalance =
        Number(String(resellerWallet.balance).replace(/,/g, "")) || 0;
      if (walletBalance < pricePerNumber) {
        throw new Error(
          `Insufficient wallet balance. Required: ₹${pricePerNumber.toFixed(2)} (price per number). ` +
            `Available: ₹${walletBalance.toFixed(2)}. Please top up your wallet before approving this customer.`,
        );
      }

      if (payment_method === "offline") {
        // Offline payment flow: debit customer's reseller wallet by price_per_number (not payment amount)
        const amountToDebit =
          Number(parseFloat(String(reseller?.price_per_number ?? ""))) || 0;
        if (amountToDebit <= 0) {
          throw new Error("Price per number is not set for this reseller");
        }

        // ── Step 1: Acquire VN from external API BEFORE touching the wallet ──
        const availableRes = await VnApiClient.getAvailableNumbers();
        const availableNumbers = availableRes?.data || [];
        if (availableNumbers.length === 0) {
          throw new Error("No virtual numbers available. Please contact support.");
        }
        const virtualNumber = availableNumbers[0].number;

        const activateRes = await VnApiClient.activateNumber(virtualNumber);
        console.log(`[approveCustomer] VN API activate response:`, activateRes);

        if (customer.phone) {
          try {
            await VnApiClient.configureCallForwarding(virtualNumber, "mobile", customer.phone);
          } catch (cfErr) {
            console.warn(`[approveCustomer] Call forwarding config failed (non-fatal):`, cfErr.message);
          }
        }

        // ── Step 2: Persist VN record in DB BEFORE debiting wallet ───────────
        const virtualNumberRecord = await this.createVirtualNumber(
          customer_id,
          virtualNumber,
          effectiveResellerId,
          customer.phone,
          subscription_plan_id || null,
        );

        // ── Step 3: Record the transaction first (wallet.reference must equal mst_transaction.id for list UI)
        const offlineApprovalTxn = await this.createTransaction({
          customer_id: customer_id,
          reseller_id: effectiveResellerId,
          virtual_number_id: virtualNumberRecord?.id || null,
          transaction_type: "payment",
          payment_mode: "offline",
          payment_method: "offline",
          amount: parseFloat(payment_amount) || 0,
          status: "success",
          reference_number: payment_reference_number || null,
          payment_date: payment_date || new Date().toISOString().split("T")[0],
        });

        // ── Step 4: Debit wallet (reference = transaction id, same as online/Razorpay flow)
        await this.debitResellerWallet(
          effectiveResellerId,
          amountToDebit,
          "Customer approval - offline payment",
          offlineApprovalTxn?.id ? String(offlineApprovalTxn.id) : null,
          customer_id || null,
          virtualNumberRecord?.id || null,
        );

        // 5. Update customer status
        await this.updateCustomerStatus(customer_id, "approved", "verified");

        // 6. Get reseller SMTP config for sending emails (customer's reseller)
        const resellerSmtpConfig =
          await getResellerSmtpConfig(effectiveResellerId);

        // 7. Send emails using reseller SMTP config (brand name if set, else reseller name)
        const resellerDisplayName =
          reseller.brand_name ||
          reseller.business_name ||
          `${reseller.first_name || ""} ${reseller.last_name || ""}`.trim() ||
          "Team";
        await sendVirtualNumberEmail(
          customer.email,
          customer.profile_name || customer.email,
          virtualNumber,
          resellerDisplayName,
          resellerSmtpConfig, // Pass reseller SMTP config
        );

        // Send to admin (reseller email)
        await sendVirtualNumberEmail(
          reseller.email,
          resellerDisplayName,
          virtualNumber,
          customer.profile_name || customer.email,
          resellerSmtpConfig, // Pass reseller SMTP config
        );

        return {
          success: true,
          virtual_number: virtualNumber,
          message:
            "Customer approved successfully. Virtual number generated and emails sent.",
        };
      } else if (payment_method === "online") {
        // Online payment flow
        // 1. Get subscription plan
        const subscriptionPlan =
          await this.getSubscriptionPlanById(subscription_plan_id);
        if (!subscriptionPlan) {
          throw new Error("Subscription plan not found");
        }

        // 2. Create pending transaction record.
        // IMPORTANT: Store customer_email and notes.customer_id so the webhook
        // service can match this pending record even when using static payment
        // links (which don't embed customer_id in Razorpay's own notes).
        await this.createTransaction({
          customer_id: customer_id,
          reseller_id: effectiveResellerId,
          virtual_number_id: null, // Will be updated after payment
          transaction_type: "payment",
          payment_mode: "online",
          payment_method: "razorpay",
          amount: Number(subscriptionPlan.amount) || 0,
          status: "pending",
          reference_number: null,
          payment_date: null,
          customer_email: customer.email || null,
          customer_name: customer.profile_name || null,
          notes: {
            customer_id: customer_id,
            reseller_id: effectiveResellerId,
            subscription_plan_id: subscription_plan_id,
            plan_name: subscriptionPlan.plan_name,
          },
        });

        // 3. Update customer status (but don't generate virtual number yet - wait for payment)
        await this.updateCustomerStatus(
          customer_id,
          "pending_payment",
          "verified",
        );

        // 4. Get reseller SMTP config for sending emails (customer's reseller)
        const resellerSmtpConfig =
          await getResellerSmtpConfig(effectiveResellerId);

        // 5. Generate Razorpay payment link
        let razorpayLink = null;

        // If razorpay_link_id is provided, use it (format: https://rzp.io/i/{link_id})
        // IMPORTANT: razorpay_link_id should be a payment link ID (plink_...), NOT a subscription ID (sub_...)
        if (
          subscriptionPlan.razorpay_link_id &&
          subscriptionPlan.razorpay_link_id.trim()
        ) {
          const linkId = subscriptionPlan.razorpay_link_id.trim();

          // Validate: Don't use subscription IDs (sub_...) as payment links
          if (linkId.startsWith("sub_")) {
            console.warn(
              `razorpay_link_id contains a subscription ID (${linkId}), not a payment link ID. Creating payment link dynamically instead.`,
            );
            // Fall through to create payment link dynamically
          } else {
            // Check if it's already a full URL
            if (linkId.startsWith("http://") || linkId.startsWith("https://")) {
              razorpayLink = linkId;
            } else if (
              linkId.startsWith("rzp.io/i/") ||
              linkId.startsWith("www.rzp.io/i/")
            ) {
              // If it starts with rzp.io but missing https://
              razorpayLink = `https://${linkId}`;
            } else {
              // Format as rzp.io short link (correct Razorpay payment link format)
              // Remove any leading slashes or spaces
              const cleanLinkId = linkId.replace(/^\/+/, "").trim();
              razorpayLink = `https://rzp.io/i/${cleanLinkId}`;
            }
          }
        }

        // If razorpay_link_id was not set (or was invalid like a subscription ID),
        // and razorpay_plan_id is provided, create a payment link dynamically
        // Note: razorpay_plan_id might be a plan_id (plan_...) or subscription_id (sub_...)
        // We always create a payment link for the amount, not use the plan/subscription ID directly
        if (!razorpayLink && subscriptionPlan.razorpay_plan_id) {
          // Import Razorpay service to create payment link
          const { createRazorpayPaymentLink } =
            await import("./razorpay.service.js");

          try {
            // Always create a new payment link for the subscription plan amount
            // This ensures we have a valid payment link regardless of whether
            // razorpay_plan_id is a plan ID or subscription ID
            // Create payment link WITHOUT Razorpay's email notification
            // We send the email ourselves using reseller's SMTP config below
            const paymentLinkResult = await createRazorpayPaymentLink(
              effectiveResellerId,
              {
                amount: Number(subscriptionPlan.amount) || 0,
                currency: subscriptionPlan.currency || "INR",
                description: `Payment for ${subscriptionPlan.plan_name}`,
                customer: {
                  name: customer.profile_name || customer.email,
                  email: customer.email,
                  contact: customer.phone || undefined,
                },
                // Disable Razorpay's email notification - we send it ourselves using reseller SMTP
                notify: {
                  email: false,
                  sms: false,
                },
                notes: {
                  customer_id: customer_id,
                  subscription_plan_id: subscription_plan_id,
                  razorpay_plan_id: subscriptionPlan.razorpay_plan_id,
                  reseller_id: effectiveResellerId,
                },
              },
            );

            if (paymentLinkResult && paymentLinkResult.short_url) {
              razorpayLink = paymentLinkResult.short_url;
            } else if (paymentLinkResult && paymentLinkResult.id) {
              // Format as rzp.io short link if short_url not available
              razorpayLink = `https://rzp.io/i/${paymentLinkResult.id}`;
            } else {
              throw new Error(
                "Payment link creation returned invalid response",
              );
            }
          } catch (linkError) {
            console.error("Error creating Razorpay payment link:", linkError);
            throw new Error(
              `Failed to create Razorpay payment link: ${
                linkError.message || linkError
              }. Please ensure Razorpay credentials are configured correctly.`,
            );
          }
        }

        if (!razorpayLink) {
          throw new Error(
            "Razorpay link not configured for this subscription plan. Please add razorpay_link_id or razorpay_plan_id to the subscription plan.",
          );
        }

        const resellerDisplayName =
          reseller.brand_name ||
          reseller.business_name ||
          `${reseller.first_name || ""} ${reseller.last_name || ""}`.trim() ||
          "Team";
        await sendRazorpayLinkEmail(
          customer.email,
          customer.profile_name || customer.email,
          razorpayLink,
          subscriptionPlan.plan_name,
          subscriptionPlan.amount,
          resellerDisplayName,
          resellerSmtpConfig, // Pass reseller SMTP config
        );

        return {
          success: true,
          razorpay_link: razorpayLink,
          message: "Razorpay payment link sent to customer email.",
        };
      } else {
        throw new Error("Invalid payment method");
      }
    } catch (error) {
      console.error("Error approving customer:", error);
      throw error;
    }
  }

  /**
   * Send renewal payment email for a virtual number (online payment flow).
   * Uses the selected subscription plan to create a Razorpay payment link and sends it to the customer's email.
   * Used when virtual number is expiring soon (e.g. less than 20 days).
   *
   * @param {string} virtualNumberId - Virtual number UUID
   * @param {string} subscriptionPlanId - Subscription plan UUID (required)
   * @param {string|null} resellerId - Reseller ID (for reseller role; admin passes null to use customer's reseller)
   * @returns {Promise<object>} { success, message, razorpay_link? }
   */
  static async sendRenewalPaymentEmail(
    virtualNumberId,
    subscriptionPlanId,
    resellerId = null,
  ) {
    try {
      const client = getHasuraClient();

      if (!subscriptionPlanId) {
        throw new Error("Please select a subscription plan for renewal.");
      }

      const subscriptionPlan =
        await this.getSubscriptionPlanById(subscriptionPlanId);
      if (!subscriptionPlan) {
        throw new Error("Subscription plan not found");
      }

      const query = `
        query GetVirtualNumberForRenewal($id: uuid!) {
          mst_virtual_number_by_pk(id: $id) {
            id
            virtual_number
            expiry_date
            customer_id
            reseller_id
            mst_customer {
              id
              email
              profile_name
              phone
              reseller_id
            }
            mst_reseller {
              id
              first_name
              last_name
              business_name
              brand_name
              email
              price_per_number
            }
          }
        }
      `;

      const result = await client.client.request(query, {
        id: virtualNumberId,
      });
      const vn = result?.mst_virtual_number_by_pk;

      if (!vn) {
        throw new Error("Virtual number not found");
      }

      const customer = vn.mst_customer;
      const reseller = vn.mst_reseller;

      if (!customer) {
        throw new Error("Customer not found for this virtual number");
      }
      if (!reseller) {
        throw new Error("Reseller not found for this virtual number");
      }

      const effectiveResellerId = resellerId || vn.reseller_id || reseller.id;

      if (resellerId && vn.reseller_id !== resellerId) {
        throw new Error(
          "You do not have permission to send renewal for this virtual number.",
        );
      }

      const pricePerNumber =
        Number(parseFloat(String(reseller?.price_per_number ?? ""))) || 0;

      if (pricePerNumber <= 0) {
        throw new Error(
          "price_per_number is not configured for this reseller. Please set it before sending renewal payment links.",
        );
      }

      const resellerWallet = await this.getResellerWallet(effectiveResellerId);
      if (!resellerWallet) {
        throw new Error(
          "Reseller wallet not found. Please contact the administrator.",
        );
      }
      const walletBalance =
        Number(String(resellerWallet.balance).replace(/,/g, "")) || 0;

      if (walletBalance < pricePerNumber) {
        throw new Error(
          `Insufficient wallet balance. Required: ₹${pricePerNumber.toFixed(2)} (price per number). ` +
            `Available: ₹${walletBalance.toFixed(2)}. Please top up your wallet before sending renewal link.`,
        );
      }

      const planAmount =
        Number(parseFloat(String(subscriptionPlan.amount ?? 0))) || 0;
      if (planAmount <= 0) {
        throw new Error("Subscription plan amount is invalid.");
      }

      console.log(
        `[sendRenewalPaymentEmail] Plan: ${subscriptionPlan.plan_name}, Amount: ₹${planAmount.toFixed(2)}, Duration: ${subscriptionPlan.duration_days} days`,
      );

      const resellerSmtpConfig =
        await getResellerSmtpConfig(effectiveResellerId);

      await this.createTransaction({
        customer_id: customer.id,
        reseller_id: effectiveResellerId,
        virtual_number_id: vn.id,
        transaction_type: "renewal",
        payment_mode: "online",
        payment_method: "razorpay",
        amount: planAmount,
        status: "pending",
        reference_number: null,
        payment_date: null,
        customer_email: customer.email || null,
        customer_name: customer.profile_name || null,
        notes: {
          customer_id: customer.id,
          reseller_id: effectiveResellerId,
          virtual_number_id: vn.id,
          subscription_plan_id: subscriptionPlanId,
          transaction_type: "renewal",
        },
      });

      let razorpayLink = null;

      // For renewal, always create a dynamic payment link so we can pass customer_id,
      // virtual_number_id, etc. in notes for webhook matching. Static links may not support custom notes.
      if (subscriptionPlan.razorpay_plan_id) {
        const { createRazorpayPaymentLink } =
          await import("./razorpay.service.js");
        const paymentLinkResult = await createRazorpayPaymentLink(
          effectiveResellerId,
          {
            amount: planAmount,
            currency: subscriptionPlan.currency || "INR",
            description: `Renewal for virtual number ${vn.virtual_number} - ${subscriptionPlan.plan_name}`,
            customer: {
              name: customer.profile_name || customer.email,
              email: customer.email,
              contact: customer.phone || undefined,
            },
            notify: { email: false, sms: false },
            notes: {
              customer_id: customer.id,
              reseller_id: effectiveResellerId,
              virtual_number_id: vn.id,
              subscription_plan_id: subscriptionPlanId,
              transaction_type: "renewal",
            },
          },
        );
        razorpayLink =
          paymentLinkResult?.short_url ||
          `https://rzp.io/i/${paymentLinkResult?.id || ""}`;
      }

      // For renewal, we must use dynamic payment links (razorpay_plan_id) so the amount
      // matches the selected plan. Static links (razorpay_link_id) have a fixed amount
      // in Razorpay and would show the wrong amount to the customer.
      if (!razorpayLink) {
        throw new Error(
          `Razorpay is not configured for renewal on plan "${subscriptionPlan.plan_name}". ` +
            `Please add razorpay_plan_id to this subscription plan so we can create a payment link with the correct amount (₹${planAmount.toFixed(2)}). ` +
            `Static payment links cannot be used for renewal as they have a fixed amount.`,
        );
      }

      const resellerDisplayName =
        reseller.brand_name ||
        reseller.business_name ||
        `${reseller.first_name || ""} ${reseller.last_name || ""}`.trim() ||
        "Team";

      const planDisplayName = `${subscriptionPlan.plan_name} (₹${planAmount.toFixed(2)} - ${subscriptionPlan.duration_days || 360} days) - Renewal for ${vn.virtual_number}`;

      await sendRazorpayLinkEmail(
        customer.email,
        customer.profile_name || customer.email,
        razorpayLink,
        planDisplayName,
        planAmount,
        resellerDisplayName,
        resellerSmtpConfig,
      );

      return {
        success: true,
        razorpay_link: razorpayLink,
        message: "Renewal payment link sent to customer email successfully.",
      };
    } catch (error) {
      console.error("Error sending renewal payment email:", error);
      throw error;
    }
  }

  /**
   * Renew a virtual number via offline payment.
   * Debits the reseller wallet by price_per_number, extends the expiry date
   * by the plan's duration_days, and creates a transaction record.
   *
   * @param {object} renewalData
   * @param {string} renewalData.virtual_number_id
   * @param {string} renewalData.subscription_plan_id
   * @param {string} renewalData.payment_amount
   * @param {string} renewalData.payment_reference_number
   * @param {string} renewalData.payment_date
   * @param {string|null} resellerId - Reseller ID (for reseller role; admin passes null)
   * @returns {Promise<object>}
   */
  static async renewVirtualNumberOffline(renewalData, resellerId = null) {
    const {
      virtual_number_id,
      subscription_plan_id,
      payment_amount,
      payment_reference_number,
      payment_date,
    } = renewalData;

    try {
      const client = getHasuraClient();

      if (!subscription_plan_id) {
        throw new Error("Please select a subscription plan for renewal.");
      }

      const subscriptionPlan =
        await this.getSubscriptionPlanById(subscription_plan_id);
      if (!subscriptionPlan) {
        throw new Error("Subscription plan not found");
      }

      const query = `
        query GetVirtualNumberForOfflineRenewal($id: uuid!) {
          mst_virtual_number_by_pk(id: $id) {
            id
            virtual_number
            expiry_date
            customer_id
            reseller_id
            mst_customer {
              id
              email
              profile_name
              phone
              reseller_id
            }
            mst_reseller {
              id
              first_name
              last_name
              business_name
              brand_name
              email
              price_per_number
            }
          }
        }
      `;

      const result = await client.client.request(query, {
        id: virtual_number_id,
      });
      const vn = result?.mst_virtual_number_by_pk;

      if (!vn) {
        throw new Error("Virtual number not found");
      }

      const customer = vn.mst_customer;
      const reseller = vn.mst_reseller;

      if (!customer) {
        throw new Error("Customer not found for this virtual number");
      }
      if (!reseller) {
        throw new Error("Reseller not found for this virtual number");
      }

      const effectiveResellerId = resellerId || vn.reseller_id || reseller.id;

      if (resellerId && vn.reseller_id !== resellerId) {
        throw new Error(
          "You do not have permission to renew this virtual number.",
        );
      }

      const pricePerNumber =
        Number(parseFloat(String(reseller?.price_per_number ?? ""))) || 0;
      if (pricePerNumber <= 0) {
        throw new Error(
          "price_per_number is not configured for this reseller. Please set it before renewing.",
        );
      }

      // ── Step 1: Reactivate on VN API (best-effort, non-fatal) ───────────────
      try {
        const reactivateRes = await VnApiClient.reactivateNumber(vn.virtual_number);
        console.log(`[renewVirtualNumberOffline] VN API reactivate response:`, reactivateRes);
      } catch (vnApiErr) {
        console.warn(`[renewVirtualNumberOffline] VN API reactivate failed (non-fatal):`, vnApiErr.message);
      }

      // ── Step 2: Extend expiry date in DB BEFORE debiting wallet ─────────────
      // If the DB update fails, no money moves.
      const durationDays = subscriptionPlan.duration_days || 360;
      const currentExpiry = new Date(vn.expiry_date);
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + durationDays);
      const newExpiryStr = newExpiry.toISOString().split("T")[0];

      const updateExpiryMutation = `
        mutation ExtendVNExpiryOfflineRenewal($id: uuid!, $expiry_date: date!) {
          update_mst_virtual_number_by_pk(
            pk_columns: { id: $id }
            _set: { expiry_date: $expiry_date }
          ) {
            id
            expiry_date
          }
        }
      `;
      await client.client.request(updateExpiryMutation, {
        id: vn.id,
        expiry_date: newExpiryStr,
      });

      // ── Step 3: Create transaction first (wallet.reference must equal mst_transaction.id for list UI)
      const offlineRenewalTxn = await this.createTransaction({
        customer_id: customer.id,
        reseller_id: effectiveResellerId,
        virtual_number_id: vn.id,
        transaction_type: "renewal",
        payment_mode: "offline",
        payment_method: "offline",
        amount: parseFloat(payment_amount) || 0,
        status: "success",
        reference_number: payment_reference_number || null,
        payment_date: payment_date || new Date().toISOString().split("T")[0],
        customer_email: customer.email || null,
        customer_name: customer.profile_name || null,
        notes: {
          customer_id: customer.id,
          reseller_id: effectiveResellerId,
          virtual_number_id: vn.id,
          subscription_plan_id: subscription_plan_id,
          transaction_type: "renewal",
          payment_method: "offline",
          previous_expiry: vn.expiry_date,
          new_expiry: newExpiryStr,
        },
      });

      // ── Step 4: Debit wallet (reference = transaction id)
      await this.debitResellerWallet(
        effectiveResellerId,
        pricePerNumber,
        `Renewal (offline) - ${vn.virtual_number}`,
        offlineRenewalTxn?.id ? String(offlineRenewalTxn.id) : null,
        customer.id || null,
        vn.id || null,
      );

      console.log(
        `[renewVirtualNumberOffline] Extended VN ${vn.virtual_number} expiry: ${vn.expiry_date} -> ${newExpiryStr} (+${durationDays} days)`,
      );

      return {
        success: true,
        message: `Virtual number ${vn.virtual_number} renewed successfully. New expiry: ${newExpiryStr}.`,
        new_expiry_date: newExpiryStr,
        virtual_number: vn.virtual_number,
      };
    } catch (error) {
      console.error("Error renewing virtual number offline:", error);
      throw error;
    }
  }

  /**
   * Enable a 24-hour grace period for a virtual number (admin only).
   * Sets grace_period_end to exactly 24 hours from the current timestamp.
   * This temporarily re-enables the reseller's ability to send a renewal payment link
   * even when the day count has reached 0.
   *
   * @param {string} virtualNumberId - Virtual number UUID
   * @returns {Promise<object>} { success, message, grace_period_end, virtual_number }
   */
  static async enableGracePeriod(virtualNumberId) {
    const client = getHasuraClient();

    const fetchQuery = `
      query GetVirtualNumberForGracePeriod($id: uuid!) {
        mst_virtual_number_by_pk(id: $id) {
          id
          virtual_number
          expiry_date
          grace_period_end
          customer_id
          reseller_id
          mst_customer {
            id
            email
            phone
            profile_name
          }
          mst_reseller {
            id
            first_name
            last_name
            business_name
            brand_name
            email
          }
        }
      }
    `;

    const result = await client.client.request(fetchQuery, {
      id: virtualNumberId,
    });
    const vn = result?.mst_virtual_number_by_pk;

    if (!vn) {
      throw new Error("Virtual number not found.");
    }

    if (!vn.mst_customer) {
      throw new Error("No customer is linked to this virtual number.");
    }

    if (!vn.mst_reseller) {
      throw new Error("No reseller is linked to this virtual number.");
    }

    if (vn.grace_period_end) {
      const existingEnd = new Date(vn.grace_period_end);
      if (existingEnd > new Date()) {
        throw new Error(
          `Grace period is already active until ${existingEnd.toISOString()}. ` +
            `Please wait for it to expire before enabling a new one.`,
        );
      }
    }

    const gracePeriodEnd = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString();

    const updateMutation = `
      mutation EnableGracePeriod($id: uuid!, $grace_period_end: timestamptz!) {
        update_mst_virtual_number_by_pk(
          pk_columns: { id: $id }
          _set: { grace_period_end: $grace_period_end }
        ) {
          id
          virtual_number
          grace_period_end
        }
      }
    `;

    const updateResult = await client.client.request(updateMutation, {
      id: virtualNumberId,
      grace_period_end: gracePeriodEnd,
    });

    const updated = updateResult?.update_mst_virtual_number_by_pk;
    if (!updated) {
      throw new Error("Failed to update grace period. Please try again.");
    }

    console.log(
      `[enableGracePeriod] Admin enabled 24h grace period for VN ${vn.virtual_number} ` +
        `(id=${virtualNumberId}). Expires at: ${gracePeriodEnd}`,
    );

    return {
      success: true,
      message: `24-hour grace period enabled for ${vn.virtual_number}. Expires at ${new Date(gracePeriodEnd).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`,
      grace_period_end: gracePeriodEnd,
      virtual_number: vn.virtual_number,
    };
  }

  /**
   * Check if customer has a recent successful add_virtual_number transaction (prevents duplicate offline adds).
   * @param {string} customerId
   * @param {string} resellerId
   * @param {number} withinSeconds
   * @returns {Promise<object|null>}
   */
  static async getRecentSuccessfulAddVirtualNumberTransaction(
    customerId,
    resellerId,
    withinSeconds = 15,
  ) {
    try {
      const client = getHasuraClient();
      const since = new Date(Date.now() - withinSeconds * 1000).toISOString();
      const query = `
        query GetRecentAddVN($customer_id: uuid!, $reseller_id: uuid!, $since: timestamptz!) {
          mst_transaction(
            where: {
              customer_id: { _eq: $customer_id }
              reseller_id: { _eq: $reseller_id }
              status: { _eq: "success" }
              created_at: { _gte: $since }
              notes: { _contains: { transaction_type: "add_virtual_number" } }
            }
            order_by: { created_at: desc }
            limit: 1
          ) {
            id
            created_at
          }
        }
      `;
      const result = await client.client.request(query, {
        customer_id: customerId,
        reseller_id: resellerId,
        since,
      });
      return result.mst_transaction?.[0] || null;
    } catch (err) {
      console.error("[getRecentSuccessfulAddVirtualNumberTransaction]", err);
      return null;
    }
  }

  /**
   * Check if customer has a pending add_virtual_number transaction (prevents duplicate payment links).
   * @param {string} customerId
   * @param {string} resellerId
   * @returns {Promise<object|null>}
   */
  static async getPendingAddVirtualNumberTransaction(customerId, resellerId) {
    try {
      const client = getHasuraClient();
      const query = `
        query GetPendingAddVN($customer_id: uuid!, $reseller_id: uuid!) {
          mst_transaction(
            where: {
              customer_id: { _eq: $customer_id }
              reseller_id: { _eq: $reseller_id }
              status: { _in: ["pending", "authorized"] }
              notes: { _contains: { transaction_type: "add_virtual_number" } }
            }
            order_by: { created_at: desc }
            limit: 1
          ) {
            id
            transaction_number
            created_at
          }
        }
      `;
      const result = await client.client.request(query, {
        customer_id: customerId,
        reseller_id: resellerId,
      });
      return result.mst_transaction?.[0] || null;
    } catch (err) {
      console.error("[getPendingAddVirtualNumberTransaction]", err);
      return null;
    }
  }

  /**
   * Add an additional virtual number to an already-approved customer.
   * Supports both online (send Razorpay payment link) and offline (debit wallet + create VN immediately) flows.
   * Unlike approveCustomer, this has NO re-approval guards and does NOT change customer status.
   */
  static async addVirtualNumber(data, resellerId = null) {
    const {
      customer_id,
      payment_method,
      subscription_plan_id,
      payment_reference_number,
      payment_amount,
      payment_date,
      call_forwarding_number,
    } = data;

    try {
      const customer = await this.getCustomerById(customer_id);
      if (!customer) {
        throw new Error("Customer not found");
      }

      const reseller = customer.mst_reseller;
      if (!reseller) {
        throw new Error("Reseller not found");
      }

      const effectiveResellerId = customer.reseller_id || resellerId;

      const pricePerNumber =
        Number(parseFloat(String(reseller?.price_per_number ?? ""))) || 0;
      if (pricePerNumber <= 0) {
        throw new Error(
          "price_per_number is not configured for this reseller. Please set it before adding virtual numbers.",
        );
      }
      const resellerWallet = await this.getResellerWallet(effectiveResellerId);
      if (!resellerWallet) {
        throw new Error(
          "Reseller wallet not found. Please contact the administrator.",
        );
      }
      const walletBalance =
        Number(String(resellerWallet.balance).replace(/,/g, "")) || 0;
      if (walletBalance < pricePerNumber) {
        throw new Error(
          `Insufficient wallet balance. Required: ₹${pricePerNumber.toFixed(2)} (price per number). ` +
            `Available: ₹${walletBalance.toFixed(2)}. Please top up your wallet.`,
        );
      }

      const forwardNumber = call_forwarding_number || customer.phone || null;

      if (payment_method === "offline") {
        // Idempotency: prevent duplicate VN from double-click (recent successful add).
        const recentAdd = await this.getRecentSuccessfulAddVirtualNumberTransaction(
          customer_id,
          effectiveResellerId,
          15,
        );
        if (recentAdd) {
          throw new Error(
            "A virtual number was just added for this customer. If you did not receive it, please refresh and try again.",
          );
        }

        const amountToDebit = pricePerNumber;

        // ── Step 1: Acquire VN from external API BEFORE touching the wallet ──
        // This ensures we never debit money if no VN is available.
        const availableRes = await VnApiClient.getAvailableNumbers();
        const availableNumbers = availableRes?.data || [];
        if (availableNumbers.length === 0) {
          throw new Error("No virtual numbers available. Please contact support.");
        }
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const virtualNumber = availableNumbers[randomIndex].number;

        const activateRes = await VnApiClient.activateNumber(virtualNumber);
        console.log(`[addVirtualNumber] VN API activate response:`, activateRes);

        if (forwardNumber) {
          try {
            await VnApiClient.configureCallForwarding(virtualNumber, "mobile", forwardNumber);
          } catch (cfErr) {
            console.warn(`[addVirtualNumber] Call forwarding config failed (non-fatal):`, cfErr.message);
          }
        }

        // ── Step 2: Persist VN record in DB ──────────────────────────────────
        // Do this before debiting so if the DB insert fails, the wallet is untouched.
        // If this throws (e.g. duplicate key), the error propagates and no money moves.
        const virtualNumberRecord = await this.createVirtualNumber(
          customer_id,
          virtualNumber,
          effectiveResellerId,
          forwardNumber,
          subscription_plan_id || null,
        );

        // ── Step 3: Record the transaction first (wallet.reference must equal mst_transaction.id for list UI)
        const offlineAddTxn = await this.createTransaction({
          customer_id: customer_id,
          reseller_id: effectiveResellerId,
          virtual_number_id: virtualNumberRecord?.id || null,
          transaction_type: "payment",
          payment_mode: "offline",
          payment_method: "offline",
          amount: parseFloat(payment_amount) || 0,
          status: "success",
          reference_number: payment_reference_number || null,
          payment_date: payment_date || new Date().toISOString().split("T")[0],
          notes: {
            transaction_type: "add_virtual_number",
            call_forwarding_number: forwardNumber || null,
          },
        });

        // ── Step 4: Debit wallet (reference = transaction id)
        await this.debitResellerWallet(
          effectiveResellerId,
          amountToDebit,
          "Add virtual number - offline payment",
          offlineAddTxn?.id ? String(offlineAddTxn.id) : null,
          customer_id || null,
          virtualNumberRecord?.id || null,
        );

        // ── Step 5: Send email (best-effort, never blocks success) ───────────
        const resellerSmtpConfig =
          await getResellerSmtpConfig(effectiveResellerId);

        const resellerDisplayName =
          reseller.brand_name ||
          reseller.business_name ||
          `${reseller.first_name || ""} ${reseller.last_name || ""}`.trim() ||
          "Team";
        try {
          await sendVirtualNumberEmail(
            customer.email,
            customer.profile_name || customer.email,
            virtualNumber,
            resellerDisplayName,
            resellerSmtpConfig,
          );
        } catch (emailErr) {
          console.warn(`[addVirtualNumber] Email send failed (non-fatal):`, emailErr.message);
        }

        return {
          success: true,
          virtual_number: virtualNumber,
          message: "Virtual number added successfully. Emails sent.",
        };
      } else if (payment_method === "online") {
        const subscriptionPlan =
          await this.getSubscriptionPlanById(subscription_plan_id);
        if (!subscriptionPlan) {
          throw new Error("Subscription plan not found");
        }

        // Idempotency: prevent duplicate pending transactions (e.g. double-click).
        // If a pending add_virtual_number txn exists, reject to avoid two payment links.
        const existingPending = await this.getPendingAddVirtualNumberTransaction(
          customer_id,
          effectiveResellerId,
        );
        if (existingPending) {
          throw new Error(
            "A payment link was already sent for adding a virtual number. Please wait for the customer to pay or the link to expire before sending another.",
          );
        }

        await this.createTransaction({
          customer_id: customer_id,
          reseller_id: effectiveResellerId,
          virtual_number_id: null,
          transaction_type: "payment",
          payment_mode: "online",
          payment_method: "razorpay",
          amount: Number(subscriptionPlan.amount) || 0,
          status: "pending",
          reference_number: null,
          payment_date: null,
          customer_email: customer.email || null,
          customer_name: customer.profile_name || null,
          notes: {
            customer_id: customer_id,
            reseller_id: effectiveResellerId,
            subscription_plan_id: subscription_plan_id,
            plan_name: subscriptionPlan.plan_name,
            transaction_type: "add_virtual_number",
            call_forwarding_number: forwardNumber || null,
          },
        });

        const resellerSmtpConfig =
          await getResellerSmtpConfig(effectiveResellerId);

        let razorpayLink = null;

        if (
          subscriptionPlan.razorpay_link_id &&
          subscriptionPlan.razorpay_link_id.trim()
        ) {
          const linkId = subscriptionPlan.razorpay_link_id.trim();
          if (linkId.startsWith("sub_")) {
            // Subscription ID, not payment link -- fall through
          } else if (linkId.startsWith("http://") || linkId.startsWith("https://")) {
            razorpayLink = linkId;
          } else if (linkId.startsWith("rzp.io/i/") || linkId.startsWith("www.rzp.io/i/")) {
            razorpayLink = `https://${linkId}`;
          } else {
            const cleanLinkId = linkId.replace(/^\/+/, "").trim();
            razorpayLink = `https://rzp.io/i/${cleanLinkId}`;
          }
        }

        if (!razorpayLink && subscriptionPlan.razorpay_plan_id) {
          const { createRazorpayPaymentLink } =
            await import("./razorpay.service.js");

          try {
            const paymentLinkResult = await createRazorpayPaymentLink(
              effectiveResellerId,
              {
                amount: Number(subscriptionPlan.amount) || 0,
                currency: subscriptionPlan.currency || "INR",
                description: `Payment for ${subscriptionPlan.plan_name}`,
                customer: {
                  name: customer.profile_name || customer.email,
                  email: customer.email,
                  contact: customer.phone || undefined,
                },
                notify: { email: false, sms: false },
                notes: {
                  customer_id: customer_id,
                  subscription_plan_id: subscription_plan_id,
                  razorpay_plan_id: subscriptionPlan.razorpay_plan_id,
                  reseller_id: effectiveResellerId,
                  transaction_type: "add_virtual_number",
                  call_forwarding_number: forwardNumber || null,
                },
              },
            );

            if (paymentLinkResult && paymentLinkResult.short_url) {
              razorpayLink = paymentLinkResult.short_url;
            } else if (paymentLinkResult && paymentLinkResult.id) {
              razorpayLink = `https://rzp.io/i/${paymentLinkResult.id}`;
            } else {
              throw new Error("Payment link creation returned invalid response");
            }
          } catch (linkError) {
            console.error("Error creating Razorpay payment link:", linkError);
            throw new Error(
              `Failed to create Razorpay payment link: ${linkError.message || linkError}`,
            );
          }
        }

        if (!razorpayLink) {
          throw new Error(
            "Razorpay link not configured for this subscription plan. Please add razorpay_link_id or razorpay_plan_id.",
          );
        }

        const resellerDisplayName =
          reseller.brand_name ||
          reseller.business_name ||
          `${reseller.first_name || ""} ${reseller.last_name || ""}`.trim() ||
          "Team";
        await sendRazorpayLinkEmail(
          customer.email,
          customer.profile_name || customer.email,
          razorpayLink,
          subscriptionPlan.plan_name,
          subscriptionPlan.amount,
          resellerDisplayName,
          resellerSmtpConfig,
        );

        return {
          success: true,
          razorpay_link: razorpayLink,
          message: "Razorpay payment link sent to customer email.",
        };
      } else {
        throw new Error("Invalid payment method. Must be 'offline' or 'online'.");
      }
    } catch (error) {
      console.error("Error adding virtual number:", error);
      throw error;
    }
  }
}

import { graphqlRequest } from "@/hasura";

/**
 * Get wallet by reseller ID
 */
export const getMstWalletByResellerId = async (resellerId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstWalletByResellerId($reseller_id: uuid!) {
    mst_wallet(
      where: { reseller_id: { _eq: $reseller_id } }
      limit: 1
    ) {
      id
      reseller_id
      user_type
      balance
      credit_amount
      debit_amount
      last_transaction_at
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { reseller_id: resellerId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch wallet",
        data: null,
      };
    }
    if (result?.data?.mst_wallet && result.data.mst_wallet.length > 0) {
      return {
        success: true,
        data: result.data.mst_wallet[0],
      };
    }
    return {
      success: false,
      message: "Wallet not found",
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to fetch wallet",
      data: null,
    };
  }
};

/**
 * Get wallet by ID
 */
export const getMstWalletById = async (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return {
      success: false,
      message: "Invalid wallet ID format",
      data: null,
    };
  }

  const QUERY = `query GetMstWalletById($id: uuid!) {
    mst_wallet_by_pk(id: $id) {
      id
      reseller_id
      user_type
      balance
      credit_amount
      debit_amount
      last_transaction_at
      created_at
      updated_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { id });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch wallet",
        data: null,
      };
    }
    if (result?.data?.mst_wallet_by_pk) {
      return {
        success: true,
        data: result.data.mst_wallet_by_pk,
      };
    }
    return {
      success: false,
      message: "Wallet not found",
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to fetch wallet",
      data: null,
    };
  }
};

/**
 * Create wallet for reseller
 */
export const createMstWallet = async (data: {
  reseller_id: string;
  user_type?: string;
  balance?: number;
  credit_amount?: number;
  debit_amount?: number;
}) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!data.reseller_id || typeof data.reseller_id !== 'string' || !uuidRegex.test(data.reseller_id)) {
    return {
      success: false,
      message: "Invalid reseller ID format",
    };
  }

  const MUTATION = `mutation CreateMstWallet(
    $reseller_id: uuid!
    $user_type: String
    $balance: numeric
    $credit_amount: numeric
    $debit_amount: numeric
  ) {
    insert_mst_wallet_one(object: {
      reseller_id: $reseller_id
      user_type: $user_type
      balance: $balance
      credit_amount: $credit_amount
      debit_amount: $debit_amount
    }) {
      id
      reseller_id
      user_type
      balance
      credit_amount
      debit_amount
      created_at
      updated_at
    }
  }`;

  try {
    const variables: any = {
      reseller_id: data.reseller_id,
      user_type: data.user_type || 'RESELLER',
    };

    if (data.balance !== undefined) {
      variables.balance = data.balance;
    }
    if (data.credit_amount !== undefined) {
      variables.credit_amount = data.credit_amount;
    }
    if (data.debit_amount !== undefined) {
      variables.debit_amount = data.debit_amount;
    }

    const result = await graphqlRequest(MUTATION, variables);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create wallet",
      };
    }
    if (result?.data?.insert_mst_wallet_one) {
      return {
        success: true,
        data: result.data.insert_mst_wallet_one,
        message: "Wallet created successfully",
      };
    }
    return {
      success: false,
      message: "Failed to create wallet",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to create wallet",
    };
  }
};

/**
 * Update wallet balance
 */
export const updateMstWallet = async (
  walletId: string,
  data: {
    balance?: number;
    credit_amount?: number;
    debit_amount?: number;
    last_transaction_at?: string;
  }
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!walletId || typeof walletId !== 'string' || !uuidRegex.test(walletId)) {
    return {
      success: false,
      message: "Invalid wallet ID format",
    };
  }

  const MUTATION = `mutation UpdateMstWallet(
    $id: uuid!
    $balance: numeric
    $credit_amount: numeric
    $debit_amount: numeric
    $last_transaction_at: timestamp
  ) {
    update_mst_wallet_by_pk(
      pk_columns: { id: $id }
      _set: {
        balance: $balance
        credit_amount: $credit_amount
        debit_amount: $debit_amount
        last_transaction_at: $last_transaction_at
      }
    ) {
      id
      balance
      credit_amount
      debit_amount
      last_transaction_at
      updated_at
    }
  }`;

  try {
    const variables: any = { id: walletId };
    
    if (data.balance !== undefined) {
      variables.balance = data.balance;
    }
    if (data.credit_amount !== undefined) {
      variables.credit_amount = data.credit_amount;
    }
    if (data.debit_amount !== undefined) {
      variables.debit_amount = data.debit_amount;
    }
    if (data.last_transaction_at !== undefined) {
      variables.last_transaction_at = data.last_transaction_at;
    }

    const result = await graphqlRequest(MUTATION, variables);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to update wallet",
      };
    }
    if (result?.data?.update_mst_wallet_by_pk) {
      return {
        success: true,
        data: result.data.update_mst_wallet_by_pk,
        message: "Wallet updated successfully",
      };
    }
    return {
      success: false,
      message: "Failed to update wallet",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to update wallet",
    };
  }
};

/**
 * Get wallet transactions
 */
export const getMstWalletTransactions = async (walletId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!walletId || typeof walletId !== 'string' || !uuidRegex.test(walletId)) {
    return {
      success: false,
      message: "Invalid wallet ID format",
      data: [],
    };
  }

  const QUERY = `query GetMstWalletTransactions($wallet_id: uuid!) {
    mst_wallet_transaction(
      where: { wallet_id: { _eq: $wallet_id } }
      order_by: { created_at: desc }
    ) {
      id
      wallet_id
      transaction_id
      transaction_type
      amount
      balance_before
      balance_after
      description
      reference
      created_at
    }
  }`;

  try {
    const result = await graphqlRequest(QUERY, { wallet_id: walletId });
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch transactions",
        data: [],
      };
    }
    if (result?.data?.mst_wallet_transaction) {
      return {
        success: true,
        data: result.data.mst_wallet_transaction,
      };
    }
    return {
      success: false,
      data: [],
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to fetch transactions",
      data: [],
    };
  }
};

/**
 * Get all wallet transactions with reseller info
 */
export const getAllMstWalletTransactions = async (resellerId?: string) => {
  try {
    // First, get wallets filtered by reseller_id if provided
    let walletIds: string[] = [];
    
    if (resellerId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!resellerId || typeof resellerId !== 'string' || !uuidRegex.test(resellerId)) {
        return {
          success: false,
          message: "Invalid reseller ID format",
          data: [],
        };
      }

      const walletQuery = `query GetWalletsByReseller($reseller_id: uuid!) {
        mst_wallet(where: { reseller_id: { _eq: $reseller_id } }) {
          id
        }
      }`;
      
      const walletResult = await graphqlRequest(walletQuery, { reseller_id: resellerId });
      if (walletResult?.errors) {
        return {
          success: false,
          message: walletResult.errors[0]?.message || "Failed to fetch wallets",
          data: [],
        };
      }
      if (walletResult?.data?.mst_wallet) {
        walletIds = walletResult.data.mst_wallet.map((w: any) => w.id);
      }
      if (walletIds.length === 0) {
        return { success: true, data: [] };
      }
    }

    // Fetch transactions
    const QUERY = resellerId && walletIds.length > 0
      ? `query GetAllMstWalletTransactions($wallet_ids: [uuid!]!) {
          mst_wallet_transaction(
            where: { wallet_id: { _in: $wallet_ids } }
            order_by: { created_at: desc }
          ) {
            id
            wallet_id
            transaction_id
            transaction_type
            amount
            balance_before
            balance_after
            description
            reference
            created_at
          }
        }`
      : `query GetAllMstWalletTransactions {
          mst_wallet_transaction(
            order_by: { created_at: desc }
          ) {
            id
            wallet_id
            transaction_id
            transaction_type
            amount
            balance_before
            balance_after
            description
            reference
            created_at
          }
        }`;

    const variables = resellerId && walletIds.length > 0 ? { wallet_ids: walletIds } : {};
    const result = await graphqlRequest(QUERY, variables);
    
    if (result?.errors) {
      console.error("GraphQL errors:", result.errors);
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to fetch transactions",
        data: [],
      };
    }
    
    if (!result?.data?.mst_wallet_transaction) {
      return {
        success: true,
        data: [],
      };
    }

    const transactions = result.data.mst_wallet_transaction;
    
    // If no transactions, return early
    if (transactions.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // Enrich with wallet and reseller info
    try {
      const uniqueWalletIds = [...new Set(transactions.map((t: any) => t.wallet_id).filter(Boolean))];
      
      if (uniqueWalletIds.length > 0) {
        const walletsQuery = `query GetWalletsInfo($wallet_ids: [uuid!]!) {
          mst_wallet(where: { id: { _in: $wallet_ids } }) {
            id
            reseller_id
            balance
          }
        }`;
        
        const walletsResult = await graphqlRequest(walletsQuery, { wallet_ids: uniqueWalletIds });
        if (walletsResult?.errors) {
          console.warn("Error fetching wallet info:", walletsResult.errors);
          return {
            success: true,
            data: transactions,
          };
        }
        
        const wallets = walletsResult?.data?.mst_wallet || [];
        const walletMap = new Map(wallets.map((w: any) => [w.id, w]));
        
        // Get unique reseller IDs
        const uniqueResellerIds = [...new Set(wallets.map((w: any) => w.reseller_id).filter(Boolean))];
        
        let resellerMap = new Map();
        if (uniqueResellerIds.length > 0) {
          const resellersQuery = `query GetResellersInfo($reseller_ids: [uuid!]!) {
            mst_reseller(where: { id: { _in: $reseller_ids } }) {
              id
              first_name
              last_name
              email
              business_name
            }
          }`;
          
          const resellersResult = await graphqlRequest(resellersQuery, { reseller_ids: uniqueResellerIds });
          if (!resellersResult?.errors && resellersResult?.data?.mst_reseller) {
            const resellers = resellersResult.data.mst_reseller;
            resellerMap = new Map(resellers.map((r: any) => [r.id, r]));
          }
        }
        
        // Enrich transactions with wallet and reseller data
        const enrichedTransactions = transactions.map((transaction: any) => {
          const wallet = walletMap.get(transaction.wallet_id);
          const reseller = wallet ? resellerMap.get(wallet.reseller_id) : null;
          
          return {
            ...transaction,
            mst_wallet: wallet ? {
              ...wallet,
              mst_reseller: reseller
            } : null
          };
        });
        
        return {
          success: true,
          data: enrichedTransactions,
        };
      }
    } catch (enrichError: any) {
      console.warn("Error enriching transactions:", enrichError);
      // Return transactions without enrichment if enrichment fails
      return {
        success: true,
        data: transactions,
      };
    }
    
    return {
      success: true,
      data: transactions,
    };
  } catch (error: any) {
    console.error("Error in getAllMstWalletTransactions:", error);
    return {
      success: false,
      message: error.message || "Failed to fetch transactions",
      data: [],
    };
  }
};

/**
 * Create wallet transaction
 */
export const createMstWalletTransaction = async (data: {
  wallet_id: string;
  transaction_id?: string;
  transaction_type: string;
  amount: number;
  balance_before?: number;
  balance_after?: number;
  description?: string;
  reference?: string;
}) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!data.wallet_id || typeof data.wallet_id !== 'string' || !uuidRegex.test(data.wallet_id)) {
    return {
      success: false,
      message: "Invalid wallet ID format",
    };
  }

  if (!data.transaction_type || !data.amount) {
    return {
      success: false,
      message: "Transaction type and amount are required",
    };
  }

  const MUTATION = `mutation CreateMstWalletTransaction(
    $wallet_id: uuid!
    $transaction_id: uuid
    $transaction_type: String!
    $amount: numeric!
    $balance_before: numeric
    $balance_after: numeric
    $description: String
    $reference: String
  ) {
    insert_mst_wallet_transaction_one(object: {
      wallet_id: $wallet_id
      transaction_id: $transaction_id
      transaction_type: $transaction_type
      amount: $amount
      balance_before: $balance_before
      balance_after: $balance_after
      description: $description
      reference: $reference
    }) {
      id
      wallet_id
      transaction_type
      amount
      balance_before
      balance_after
      description
      created_at
    }
  }`;

  try {
    const variables: any = {
      wallet_id: data.wallet_id,
      transaction_type: data.transaction_type,
      amount: data.amount,
    };

    if (data.transaction_id) {
      variables.transaction_id = data.transaction_id;
    }
    if (data.balance_before !== undefined) {
      variables.balance_before = data.balance_before;
    }
    if (data.balance_after !== undefined) {
      variables.balance_after = data.balance_after;
    }
    if (data.description) {
      variables.description = data.description;
    }
    if (data.reference) {
      variables.reference = data.reference;
    }

    const result = await graphqlRequest(MUTATION, variables);
    if (result?.errors) {
      return {
        success: false,
        message: result.errors[0]?.message || "Failed to create transaction",
      };
    }
    if (result?.data?.insert_mst_wallet_transaction_one) {
      return {
        success: true,
        data: result.data.insert_mst_wallet_transaction_one,
        message: "Transaction created successfully",
      };
    }
    return {
      success: false,
      message: "Failed to create transaction",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to create transaction",
    };
  }
};

/**
 * Add credit to wallet (creates wallet if doesn't exist, creates transaction, updates balance)
 */
export const creditWallet = async (
  resellerId: string,
  amount: number,
  description?: string,
  reference?: string,
  validity_date?: string | null
) => {
  try {
    // Get or create wallet
    let walletResult = await getMstWalletByResellerId(resellerId);
    let walletId: string;
    let currentBalance = 0;

    if (!walletResult.success || !walletResult.data) {
      // Create wallet if it doesn't exist
      const createResult = await createMstWallet({
        reseller_id: resellerId,
        balance: amount,
        credit_amount: amount,
      });
      if (!createResult.success) {
        return {
          success: false,
          message: createResult.message || "Failed to create wallet",
        };
      }
      walletId = createResult.data.id;
      currentBalance = amount;
    } else {
      walletId = walletResult.data.id;
      currentBalance = Number(walletResult.data.balance) || 0;
    }

    const balanceBefore = currentBalance;
    const balanceAfter = currentBalance + amount;

    // Create transaction
    const transactionResult = await createMstWalletTransaction({
      wallet_id: walletId,
      transaction_type: 'CREDIT',
      amount: amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: description || 'Wallet credit',
      reference: reference,
    });

    if (!transactionResult.success) {
      return {
        success: false,
        message: transactionResult.message || "Failed to create transaction",
      };
    }

    // Update wallet balance
    const updateResult = await updateMstWallet(walletId, {
      balance: balanceAfter,
      credit_amount: (Number(walletResult.data?.credit_amount) || 0) + amount,
      last_transaction_at: new Date().toISOString(),
    });

    if (!updateResult.success) {
      return {
        success: false,
        message: updateResult.message || "Failed to update wallet balance",
      };
    }

    // Update reseller validity on wallet recharge
    try {
      if (validity_date) {
        // Custom validity date provided
        const { upsertResellerValidity, createResellerValidityHistory, getResellerValidity } = await import('./resellerValidity');
        
        // Get current validity for history
        const currentValidityResult = await getResellerValidity(resellerId);
        const currentValidity = currentValidityResult.success ? currentValidityResult.data : null;

        // Calculate validity dates
        const now = new Date();
        const validityStartDate = now.toISOString();
        const validityEndDate = new Date(validity_date);
        validityEndDate.setHours(23, 59, 59, 999); // Set to end of day
        const validityDays = Math.ceil((validityEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (validityDays > 0) {
          // Upsert validity
          const validityResult = await upsertResellerValidity({
            reseller_id: resellerId,
            validity_start_date: validityStartDate,
            validity_end_date: validityEndDate.toISOString(),
            validity_days: validityDays,
            last_wallet_id: walletId,
            last_recharge_amount: amount,
            status: 'ACTIVE',
          });

          if (!validityResult.success) {
            console.warn('Failed to update reseller validity:', validityResult.message);
          } else {
            // Create history record
            const historyResult = await createResellerValidityHistory({
              reseller_id: resellerId,
              wallet_id: walletId,
              recharge_amount: amount,
              previous_validity_start: currentValidity?.validity_start_date || null,
              previous_validity_end: currentValidity?.validity_end_date || null,
              new_validity_start: validityStartDate,
              new_validity_end: validityEndDate.toISOString(),
              validity_days: validityDays,
              action: 'WALLET_RECHARGE',
            });

            if (!historyResult.success) {
              console.warn('Failed to create validity history:', historyResult.message);
            }
          }
        }
      } else {
        // Use default validity update (365 days)
        const { updateValidityOnRecharge } = await import('./resellerValidity');
        const validityResult = await updateValidityOnRecharge(
          resellerId,
          walletId,
          amount,
          'WALLET_RECHARGE_RESET',
          365 // Default validity days
        );

        if (!validityResult.success) {
          // Log warning but don't fail the wallet credit operation
          console.warn('Failed to update reseller validity:', validityResult.message);
        }
      }
    } catch (validityError) {
      // Log error but don't fail the wallet credit operation
      console.error('Error updating reseller validity:', validityError);
    }

    return {
      success: true,
      data: {
        wallet: updateResult.data,
        transaction: transactionResult.data,
      },
      message: "Wallet credited successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to credit wallet",
    };
  }
};

/**
 * Debit from wallet (creates transaction, updates balance)
 */
export const debitWallet = async (
  resellerId: string,
  amount: number,
  description?: string,
  reference?: string
) => {
  try {
    // Get wallet
    const walletResult = await getMstWalletByResellerId(resellerId);
    if (!walletResult.success || !walletResult.data) {
      return {
        success: false,
        message: "Wallet not found",
      };
    }

    const wallet = walletResult.data;
    const walletId = wallet.id;
    const currentBalance = Number(wallet.balance) || 0;

    if (currentBalance < amount) {
      return {
        success: false,
        message: "Insufficient wallet balance",
      };
    }

    const balanceBefore = currentBalance;
    const balanceAfter = currentBalance - amount;

    // Create transaction
    const transactionResult = await createMstWalletTransaction({
      wallet_id: walletId,
      transaction_type: 'DEBIT',
      amount: amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: description || 'Wallet debit',
      reference: reference,
    });

    if (!transactionResult.success) {
      return {
        success: false,
        message: transactionResult.message || "Failed to create transaction",
      };
    }

    // Update wallet balance
    const updateResult = await updateMstWallet(walletId, {
      balance: balanceAfter,
      debit_amount: (Number(wallet.debit_amount) || 0) + amount,
      last_transaction_at: new Date().toISOString(),
    });

    if (!updateResult.success) {
      return {
        success: false,
        message: updateResult.message || "Failed to update wallet balance",
      };
    }

    return {
      success: true,
      data: {
        wallet: updateResult.data,
        transaction: transactionResult.data,
      },
      message: "Wallet debited successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Failed to debit wallet",
    };
  }
};

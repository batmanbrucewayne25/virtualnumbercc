import { GraphQLClient } from 'graphql-request';

class HasuraClient {
  constructor() {
    if (!process.env.HASURA_GRAPHQL_ENDPOINT) {
      throw new Error('HASURA_GRAPHQL_ENDPOINT is not set in environment variables');
    }

    this.client = new GraphQLClient(process.env.HASURA_GRAPHQL_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.HASURA_ADMIN_SECRET && {
          'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET
        })
      }
    });
  }

  /**
   * Get user by email
   * @param {string} email 
   * @returns {Promise<object|null>}
   */
  async getUserByEmail(email) {
    const query = `
      query GetUserByEmail($email: String!) {
        mst_reseller(where: {email: {_eq: $email}}, limit: 1) {
          id
          first_name
          last_name
          email
          phone
          password_hash
          current_step
          signup_completed
          status
          is_email_verified
          is_phone_verified
          approval_date
          approved_by
          rejection_reason
          suspended_at
          suspended_reason
          created_at
          updated_at
        }
      }
    `;

    try {
      const data = await this.client.request(query, { email });
      return data.mst_reseller && data.mst_reseller.length > 0 
        ? data.mst_reseller[0] 
        : null;
    } catch (error) {
      console.error('Hasura query error:', error);
      throw new Error('Failed to query user from database');
    }
  }

  /**
   * Get user by ID
   * @param {number} id 
   * @returns {Promise<object|null>}
   */
  async getUserById(id) {
    const query = `
      query GetUserById($id: Int!) {
        mst_reseller_by_pk(id: $id) {
          id
          first_name
          last_name
          email
          phone
          password_hash
          current_step
          signup_completed
          status
          is_email_verified
          is_phone_verified
          created_at
          updated_at
        }
      }
    `;

    try {
      const data = await this.client.request(query, { id });
      return data.mst_reseller_by_pk;
    } catch (error) {
      console.error('Hasura query error:', error);
      throw new Error('Failed to query user from database');
    }
  }

  /**
   * Create new user
   * @param {object} userData 
   * @returns {Promise<object>}
   */
  async createUser(userData) {
    const mutation = `
      mutation InsertMstReseller(
        $first_name: String!
        $last_name: String!
        $email: String!
        $phone: String!
        $password_hash: String!
        $current_step: Int!
        $is_email_verified: Boolean!
        $is_phone_verified: Boolean!
        $signup_completed: Boolean!
        $status: Boolean!
      ) {
        insert_mst_reseller_one(object: {
          first_name: $first_name
          last_name: $last_name
          email: $email
          phone: $phone
          password_hash: $password_hash
          current_step: $current_step
          is_email_verified: $is_email_verified
          is_phone_verified: $is_phone_verified
          signup_completed: $signup_completed
          status: $status
        }) {
          id
          first_name
          last_name
          email
          phone
          password_hash
          current_step
          signup_completed
          status
          created_at
        }
      }
    `;

    try {
      const data = await this.client.request(mutation, userData);
      return data.insert_mst_reseller_one;
    } catch (error) {
      console.error('Hasura mutation error:', error);
      throw new Error('Failed to create user in database');
    }
  }
}

// Export singleton instance - lazy initialization
// Don't create instance on import, only when needed
let hasuraClientInstance = null;

export const getHasuraClient = () => {
  if (!hasuraClientInstance) {
    if (!process.env.HASURA_GRAPHQL_ENDPOINT) {
      throw new Error('HASURA_GRAPHQL_ENDPOINT is not set in environment variables. Make sure .env file exists and dotenv.config() is called before using HasuraClient.');
    }
    hasuraClientInstance = new HasuraClient();
  }
  return hasuraClientInstance;
};

// Export - use getHasuraClient() function instead of importing hasuraClient directly
// This ensures env vars are loaded before instantiation
export const hasuraClient = {
  get client() {
    return getHasuraClient().client;
  },
  getUserByEmail(email) {
    return getHasuraClient().getUserByEmail(email);
  },
  getUserById(id) {
    return getHasuraClient().getUserById(id);
  },
  createUser(userData) {
    return getHasuraClient().createUser(userData);
  }
};

export { HasuraClient };

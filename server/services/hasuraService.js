import { GraphQLClient } from 'graphql-request';

const HASURA_ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;

if (!HASURA_ENDPOINT) {
  throw new Error('HASURA_GRAPHQL_ENDPOINT environment variable is not set');
}

// Create GraphQL client
const client = new GraphQLClient(HASURA_ENDPOINT, {
  headers: {
    'x-hasura-admin-secret': HASURA_ADMIN_SECRET || '',
    'Content-Type': 'application/json',
  },
});

/**
 * Query user by email from Hasura
 */
export const getUserByEmail = async (email) => {
  const query = `
    query GetUserByEmail($email: String!) {
      mst_reseller(where: { email: { _eq: $email } }, limit: 1) {
        id
        first_name
        last_name
        email
        phone
        password_hash
        status
        signup_completed
        current_step
        created_at
        updated_at
      }
    }
  `;

  try {
    const data = await client.request(query, { email });
    return data.mst_reseller?.[0] || null;
  } catch (error) {
    console.error('Hasura query error:', error);
    throw new Error('Failed to query user from database');
  }
};

/**
 * Create new user in Hasura
 */
export const createUser = async (userData) => {
  const mutation = `
    mutation InsertMstReseller(
      $first_name: String!
      $last_name: String!
      $email: String!
      $phone: String!
      $password_hash: String!
    ) {
      insert_mst_reseller_one(
        object: {
          first_name: $first_name
          last_name: $last_name
          email: $email
          phone: $phone
          password_hash: $password_hash
          current_step: 1
          is_email_verified: false
          is_phone_verified: false
          signup_completed: false
          status: false
        }
      ) {
        id
        first_name
        last_name
        email
        phone
        status
        signup_completed
        current_step
        created_at
      }
    }
  `;

  try {
    const data = await client.request(mutation, userData);
    return data.insert_mst_reseller_one;
  } catch (error) {
    console.error('Hasura mutation error:', error);
    
    // Check if it's a unique constraint violation (duplicate email)
    if (error.response?.errors) {
      const hasuraError = error.response.errors[0];
      if (hasuraError.message?.includes('unique') || hasuraError.message?.includes('duplicate')) {
        throw new Error('Email already exists');
      }
    }
    
    throw new Error('Failed to create user in database');
  }
};

/**
 * Update user password in Hasura
 */
export const updateUserPassword = async (userId, passwordHash) => {
  const mutation = `
    mutation UpdateUserPassword($id: Int!, $password_hash: String!) {
      update_mst_reseller_by_pk(
        pk_columns: { id: $id }
        _set: { password_hash: $password_hash }
      ) {
        id
        email
      }
    }
  `;

  try {
    const data = await client.request(mutation, {
      id: userId,
      password_hash: passwordHash,
    });
    return data.update_mst_reseller_by_pk;
  } catch (error) {
    console.error('Hasura update error:', error);
    throw new Error('Failed to update password in database');
  }
};

export { client };

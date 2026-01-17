/**
 * Seed script to create an initial admin user
 * Run with: node src/scripts/seedAdmin.js
 */

import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { GraphQLClient } from 'graphql-request';

// Load environment variables
dotenv.config();

const HASURA_ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;

if (!HASURA_ENDPOINT) {
  console.error('❌ ERROR: HASURA_GRAPHQL_ENDPOINT is not set in .env file');
  process.exit(1);
}

const client = new GraphQLClient(HASURA_ENDPOINT, {
  headers: {
    'Content-Type': 'application/json',
    ...(HASURA_ADMIN_SECRET && {
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET
    })
  }
});

// Default admin credentials
const ADMIN_CREDENTIALS = {
  first_name: 'Admin',
  last_name: 'User',
  email: 'admin@virtualnumber.com',
  phone: '9876543210',
  password: 'Admin@123', // This will be hashed
  status: true
};

async function createAdminUser() {
  try {
    console.log('🔐 Creating admin user...\n');

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(ADMIN_CREDENTIALS.password, saltRounds);

    // Check if admin already exists
    const checkQuery = `
      query CheckAdminExists($email: String!) {
        mst_super_admin(where: { email: { _eq: $email } }, limit: 1) {
          id
          email
        }
      }
    `;

    const existingAdmin = await client.request(checkQuery, { email: ADMIN_CREDENTIALS.email });

    if (existingAdmin.mst_super_admin && existingAdmin.mst_super_admin.length > 0) {
      console.log('⚠️  Admin user already exists with this email!');
      console.log(`   Email: ${ADMIN_CREDENTIALS.email}`);
      console.log('\n📋 Login Credentials:');
      console.log(`   Email: ${ADMIN_CREDENTIALS.email}`);
      console.log(`   Password: ${ADMIN_CREDENTIALS.password}`);
      console.log('\n💡 If you want to reset the password, delete the existing admin first or use the admin panel to update it.');
      return;
    }

    // Create admin mutation
    const mutation = `
      mutation InsertAdmin(
        $first_name: String!
        $last_name: String!
        $email: String!
        $phone: String!
        $password_hash: String!
        $status: Boolean!
      ) {
          insert_mst_super_admin_one(object: {
          first_name: $first_name
          last_name: $last_name
          email: $email
          phone: $phone
          password_hash: $password_hash
          status: $status
        }) {
          id
          first_name
          last_name
          email
          phone
          status
          created_at
        }
      }
    `;

    const variables = {
      first_name: ADMIN_CREDENTIALS.first_name,
      last_name: ADMIN_CREDENTIALS.last_name,
      email: ADMIN_CREDENTIALS.email,
      phone: ADMIN_CREDENTIALS.phone,
      password_hash: password_hash,
      status: ADMIN_CREDENTIALS.status
    };

    const result = await client.request(mutation, variables);

    if (result.insert_mst_super_admin_one) {
      console.log('✅ Admin user created successfully!\n');
      console.log('📋 Login Credentials:');
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   Email:    ${ADMIN_CREDENTIALS.email}`);
      console.log(`   Password: ${ADMIN_CREDENTIALS.password}`);
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('🔐 Security Note:');
      console.log('   - Password is securely hashed using bcrypt');
      console.log('   - Store these credentials securely');
      console.log('   - Change the password after first login\n');
      console.log('📝 Admin Details:');
      console.log(`   Name:  ${ADMIN_CREDENTIALS.first_name} ${ADMIN_CREDENTIALS.last_name}`);
      console.log(`   Email: ${result.insert_mst_super_admin_one.email}`);
      console.log(`   Phone: ${result.insert_mst_super_admin_one.phone || 'N/A'}`);
      console.log(`   Status: ${result.insert_mst_super_admin_one.status ? 'Active' : 'Inactive'}`);
      console.log(`   ID: ${result.insert_mst_super_admin_one.id}\n`);
    } else {
      console.error('❌ Failed to create admin user');
    }
  } catch (error) {
    console.error('❌ Error creating admin user:');
    console.error(error.message);
    if (error.response) {
      console.error('Hasura response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

// Run the script
createAdminUser();

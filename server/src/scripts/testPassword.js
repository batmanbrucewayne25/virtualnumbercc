/**
 * Test script to verify admin password
 * Run with: node src/scripts/testPassword.js
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

const TEST_EMAIL = 'admin@virtualnumber.com';
const TEST_PASSWORD = 'Admin@123';

async function testPassword() {
  try {
    console.log('🔐 Testing password verification...\n');

    // Get admin from database
    const query = `
      query GetAdminByEmail($email: String!) {
        mst_super_admin(where: { email: { _eq: $email } }, limit: 1) {
          id
          email
          password_hash
        }
      }
    `;

    const result = await client.request(query, { email: TEST_EMAIL });
    const admin = result.mst_super_admin?.[0];

    if (!admin) {
      console.error('❌ Admin user not found with email:', TEST_EMAIL);
      process.exit(1);
    }

    console.log('✅ Admin found:');
    console.log('   Email:', admin.email);
    console.log('   ID:', admin.id);
    console.log('   Password hash exists:', !!admin.password_hash);
    console.log('   Password hash length:', admin.password_hash?.length || 0);
    console.log('   Password hash preview:', admin.password_hash ? `${admin.password_hash.substring(0, 30)}...` : 'null');
    console.log('   Hash type:', admin.password_hash?.startsWith('$2') ? 'bcrypt' : 'plain text');
    console.log('');

    // Test password
    console.log('🔑 Testing password:', TEST_PASSWORD);
    console.log('   Password length:', TEST_PASSWORD.length);
    console.log('');

    if (!admin.password_hash) {
      console.error('❌ No password hash found in database!');
      process.exit(1);
    }

    // Test bcrypt comparison
    if (admin.password_hash.startsWith('$2')) {
      console.log('🔍 Using bcrypt comparison...');
      const isValid = await bcrypt.compare(TEST_PASSWORD, admin.password_hash);
      console.log('   Result:', isValid ? '✅ VALID' : '❌ INVALID');
      
      if (!isValid) {
        console.log('');
        console.log('🔧 Debugging:');
        console.log('   Let\'s try creating a new hash and comparing...');
        const newHash = await bcrypt.hash(TEST_PASSWORD, 10);
        console.log('   New hash preview:', `${newHash.substring(0, 30)}...`);
        const newHashValid = await bcrypt.compare(TEST_PASSWORD, newHash);
        console.log('   New hash test result:', newHashValid ? '✅ VALID' : '❌ INVALID');
        console.log('');
        console.log('💡 The stored hash might have been created with a different password.');
        console.log('   Consider resetting the admin password using the seed script.');
      }
    } else {
      console.log('⚠️  Plain text password detected (not secure!)');
      const isValid = TEST_PASSWORD === admin.password_hash;
      console.log('   Result:', isValid ? '✅ VALID' : '❌ INVALID');
    }

  } catch (error) {
    console.error('❌ Error testing password:');
    console.error(error.message);
    if (error.response) {
      console.error('Hasura response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testPassword();


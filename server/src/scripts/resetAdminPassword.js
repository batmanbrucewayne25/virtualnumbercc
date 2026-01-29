/**
 * Reset admin password script
 * Run with: node src/scripts/resetAdminPassword.js
 * 
 * This will update the admin password hash in the database
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

const ADMIN_EMAIL = 'admin@virtualnumber.com';
const NEW_PASSWORD = 'Admin@123';

async function resetAdminPassword() {
  try {
    console.log('🔐 Resetting admin password...\n');

    // First, get the admin
    const getQuery = `
      query GetAdminByEmail($email: String!) {
        mst_super_admin(where: { email: { _eq: $email } }, limit: 1) {
          id
          email
          password_hash
        }
      }
    `;

    const getResult = await client.request(getQuery, { email: ADMIN_EMAIL });
    const admin = getResult.mst_super_admin?.[0];

    if (!admin) {
      console.error('❌ Admin user not found with email:', ADMIN_EMAIL);
      console.log('💡 Run the seed script first: node src/scripts/seedAdmin.js');
      process.exit(1);
    }

    console.log('✅ Admin found:');
    console.log('   Email:', admin.email);
    console.log('   ID:', admin.id);
    console.log('   Current hash preview:', admin.password_hash ? `${admin.password_hash.substring(0, 30)}...` : 'null');
    console.log('');

    // Hash the new password
    console.log('🔑 Hashing new password:', NEW_PASSWORD);
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(NEW_PASSWORD, saltRounds);
    console.log('   New hash preview:', `${newPasswordHash.substring(0, 30)}...`);
    console.log('');

    // Verify the hash works
    console.log('✅ Verifying new hash...');
    const testResult = await bcrypt.compare(NEW_PASSWORD, newPasswordHash);
    console.log('   Test result:', testResult ? '✅ VALID' : '❌ INVALID');
    console.log('');

    if (!testResult) {
      console.error('❌ Hash verification failed! This should not happen.');
      process.exit(1);
    }

    // Update the password in database
    console.log('💾 Updating password in database...');
    const updateMutation = `
      mutation UpdateAdminPassword($id: uuid!, $password_hash: String!) {
        update_mst_super_admin_by_pk(
          pk_columns: { id: $id }
          _set: { password_hash: $password_hash }
        ) {
          id
          email
        }
      }
    `;

    const updateResult = await client.request(updateMutation, {
      id: admin.id,
      password_hash: newPasswordHash
    });

    if (updateResult.update_mst_super_admin_by_pk) {
      console.log('✅ Password updated successfully!\n');
      console.log('📋 Updated Credentials:');
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   Email:    ${ADMIN_EMAIL}`);
      console.log(`   Password: ${NEW_PASSWORD}`);
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('✅ You can now login with these credentials.');
    } else {
      console.error('❌ Failed to update password');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error resetting password:');
    console.error(error.message);
    if (error.response) {
      console.error('Hasura response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

// Run the script
resetAdminPassword();


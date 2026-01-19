import dotenv from 'dotenv';
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

// Define modules and their permissions
// Each permission will have View, Create, Update, Delete checkboxes in the role form
const MODULES = {
  'Dashboard': ['Dashboard'],
  'Admin': ['Admin'],
  'Reseller': ['Reseller'],
  'Wallet': ['Wallet'],
  'Roles': ['Roles and Access', 'Assign Role'],
  'Settings': ['Admin Settings'],
};

// Generate permission code from permission name
const generatePermissionCode = (permissionName) => {
  return permissionName
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
};

async function seedPermissions() {
  try {
    console.log('🔐 Seeding permissions...\n');

    const allPermissions = [];

    // Generate permissions for each module
    for (const [module, permissionNames] of Object.entries(MODULES)) {
      for (const permissionName of permissionNames) {
        const permissionCode = generatePermissionCode(permissionName);
        allPermissions.push({
          permission_name: permissionName,
          permission_code: permissionCode,
          module: module,
          description: `${permissionName} permission for ${module} module`,
        });
      }
    }

    // Check existing permissions
    const checkQuery = `
      query CheckPermissions {
        mst_permission {
          permission_code
        }
      }
    `;

    const existingPermissions = await client.request(checkQuery);
    const existingCodes = new Set(
      existingPermissions.mst_permission?.map(p => p.permission_code) || []
    );

    // Filter out existing permissions
    const newPermissions = allPermissions.filter(
      p => !existingCodes.has(p.permission_code)
    );

    if (newPermissions.length === 0) {
      console.log('✅ All permissions already exist!');
      console.log(`   Total permissions: ${allPermissions.length}`);
      return;
    }

    console.log(`📋 Creating ${newPermissions.length} new permissions...\n`);

    // Insert permissions in batches (Hasura supports up to 1000 items per insert)
    const batchSize = 50;
    let createdCount = 0;

    for (let i = 0; i < newPermissions.length; i += batchSize) {
      const batch = newPermissions.slice(i, i + batchSize);

      const mutation = `
        mutation InsertPermissions($objects: [mst_permission_insert_input!]!) {
          insert_mst_permission(objects: $objects) {
            affected_rows
            returning {
              id
              permission_name
              permission_code
              module
            }
          }
        }
      `;

      const result = await client.request(mutation, {
        objects: batch,
      });

      const affectedRows = result.insert_mst_permission?.affected_rows || 0;
      createdCount += affectedRows;

      console.log(`   ✓ Created ${affectedRows} permissions (batch ${Math.floor(i / batchSize) + 1})`);
    }

    console.log(`\n✅ Successfully created ${createdCount} permissions!`);
    console.log(`\n📊 Summary:`);
    for (const [module, permissionNames] of Object.entries(MODULES)) {
      console.log(`   ${module}: ${permissionNames.length} permissions`);
    }
    console.log(`   Total: ${allPermissions.length} permissions\n`);

  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    if (error.response) {
      console.error('   GraphQL Response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

// Run the seed function
seedPermissions();


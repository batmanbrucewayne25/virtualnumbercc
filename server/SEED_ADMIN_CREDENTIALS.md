# Admin User Credentials

This file contains the default admin credentials created by the seed script.

## Default Admin Credentials

**⚠️ IMPORTANT: Change these credentials after first login for security!**

### Login Credentials
- **Email:** `admin@virtualnumber.com`
- **Password:** `Admin@123`

### Admin Details
- **Name:** Admin User
- **Phone:** 9876543210
- **Status:** Active

## How to Create Admin

Run the seed script to create the admin user:

```bash
cd server
npm run seed:admin
```

Or manually:

```bash
node src/scripts/seedAdmin.js
```

## Security Notes

1. ✅ Password is securely hashed using bcrypt (10 salt rounds)
2. ⚠️ Change the default password after first login
3. ⚠️ Do not commit this file with real credentials to version control
4. ⚠️ Use strong, unique passwords in production

## Using These Credentials

### To Login via API:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@virtualnumber.com",
    "password": "Admin@123"
  }'
```

### To Login via Frontend:

Navigate to `/sign-in` and use:
- Email: `admin@virtualnumber.com`
- Password: `Admin@123`

---

**Note:** If you need to create a different admin user, modify the `ADMIN_CREDENTIALS` object in `server/src/scripts/seedAdmin.js` and run the script again.

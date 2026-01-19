# Virtual Number Application - Complete Analysis

## 🏗️ Project Structure

### **Frontend (React + Vite)**
- **Location**: Root directory (`src/`)
- **Framework**: React 18 with Vite
- **Entry**: `src/main.jsx`
- **Main Layout**: `src/masterLayout/MasterLayout.jsx`
- **Pages**: `src/pages/` (122 files)
- **Components**: `src/components/` (365 files)
- **Utils**: `src/utils/api.js`, `src/utils/auth.js`
- **Hasura Client**: `src/hasura/` (GraphQL mutations/queries)

### **Backend (Express.js)**
Two separate authentication systems exist:

#### **1. New System (Recommended - `server/src/`)**
- **Entry Point**: `server/src/index.js` (configured in package.json as `main`)
- **Routes**: 
  - `server/src/routes/auth.routes.js` → uses controllers
  - `server/src/routes/admin.routes.js` → admin endpoints
- **Controllers**: `server/src/controllers/auth.controller.js`
- **Services**: 
  - `server/src/services/auth.service.js` (AuthService class)
  - `server/src/services/admin.service.js`
- **Middleware**: 
  - `server/src/middleware/auth.middleware.js`
  - `server/src/middleware/error.middleware.js`
- **Config**: `server/src/config/hasura.client.js` (HasuraClient class)
- **Features**: 
  - ✅ Supports admin login from `mst_super_admin` table
  - ✅ Supports reseller login from `mst_reseller` table
  - ⚠️ **ISSUE**: JWT_SECRET not using fallback constants

#### **2. Old System (`server/` root)**
- **Entry Point**: `server/index.js` (alternative entry)
- **Routes**: `server/routes/auth.js` → uses services directly
- **Services**: 
  - `server/services/authService.js` (function exports)
  - `server/services/hasuraService.js` (GraphQL client)
- **Middleware**: 
  - `server/middleware/authMiddleware.js`
  - `server/middleware/errorHandler.js`
- **Features**: 
  - ❌ Does NOT support admin login (only checks `mst_reseller`)
  - ✅ Has JWT_SECRET fallback configured

## 🔐 Authentication Flow Analysis

### **Current Issue: JWT_SECRET Error**

**Problem Location**: `server/src/services/auth.service.js`

**Lines 217-228**: 
```javascript
return jwt.sign(payload, process.env.JWT_SECRET, {  // ❌ No fallback!
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

return jwt.verify(token, process.env.JWT_SECRET);  // ❌ No fallback!
```

**Root Cause**: 
- Constants with fallbacks exist at top of file (lines 5-7)
- But `generateToken()` and `verifyToken()` methods use `process.env.JWT_SECRET` directly
- When `.env` file is missing or `JWT_SECRET` is undefined, JWT signing fails

### **Authentication Paths**

#### **Path 1: New System (`src/` directory)**
```
Client Request
  → server/src/index.js
  → server/src/routes/auth.routes.js
  → server/src/controllers/auth.controller.js
  → server/src/services/auth.service.js (AuthService.login)
    → Checks mst_super_admin (admin)
    → Falls back to mst_reseller (reseller)
    → Generates JWT token ⚠️ (has JWT_SECRET issue)
```

#### **Path 2: Old System (`server/` root)**
```
Client Request
  → server/index.js
  → server/routes/auth.js
  → server/services/authService.js (login function)
    → Only checks mst_reseller ❌
    → Generates JWT token ✅ (has fallback)
```

## 📊 Database Schema

### **Tables**
1. **`mst_super_admin`**: Admin users (created by `seedAdmin.js`)
   - Fields: `id`, `first_name`, `last_name`, `email`, `phone`, `password_hash`, `status`
   - Used by: Admin authentication

2. **`mst_reseller`**: Regular users/resellers
   - Fields: `id`, `first_name`, `last_name`, `email`, `phone`, `password_hash`, `status`, `approval_date`, `rejection_reason`
   - Used by: Reseller authentication

### **Seed Admin Script**
- **Location**: `server/src/scripts/seedAdmin.js`
- **Credentials**: 
  - Email: `admin@virtualnumber.com`
  - Password: `Admin@123`
- **Creates**: Admin user in `mst_super_admin` table
- **Password**: Hashed with bcrypt (starts with `$2b$`)

## ⚙️ Environment Configuration

### **Required Variables**
```env
JWT_SECRET=your-secret-key-here  # ⚠️ Currently missing or undefined
JWT_EXPIRES_IN=7d
HASURA_GRAPHQL_ENDPOINT=https://your-hasura-instance/v1/graphql
HASURA_ADMIN_SECRET=your_hasura_admin_secret
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### **dotenv Loading**
- `server/src/index.js`: Loads dotenv FIRST (line 2-3) ✅
- `server/index.js`: Loads dotenv AFTER imports (line 3, 8) ⚠️

## 🔧 Issues Found

### **Critical Issues**

1. **JWT_SECRET Error** ⚠️
   - **File**: `server/src/services/auth.service.js`
   - **Lines**: 217, 228
   - **Problem**: Uses `process.env.JWT_SECRET` directly without fallback
   - **Fix**: Use constants `JWT_SECRET` and `JWT_EXPIRES_IN` defined at top

2. **Dual Authentication Systems**
   - Two separate auth implementations exist
   - Old system doesn't support admin login
   - Causes confusion about which entry point is used

3. **Missing Admin Support in Old System**
   - `server/services/authService.js` only checks `mst_reseller`
   - Admin users created by `seedAdmin.js` cannot login via old system

### **Code Quality Issues**

1. **Inconsistent Error Handling**
   - Old system: Throws errors directly
   - New system: Uses asyncHandler wrapper

2. **Password Hash Detection**
   - Old system: Only checks `$2a$` and `$2b$`
   - New system: Checks `$2a$`, `$2b$`, and legacy plain text
   - Missing `$2y$` support in old system

## ✅ Recommendations

### **Immediate Fixes**

1. **Fix JWT_SECRET in auth.service.js**
   ```javascript
   // Change from:
   return jwt.sign(payload, process.env.JWT_SECRET, {...});
   
   // To:
   return jwt.sign(payload, JWT_SECRET, {...});
   ```

2. **Ensure .env file exists** in `server/` directory
   - Copy from `.env.example` if available
   - Set `JWT_SECRET` value

3. **Use single entry point** (recommend `server/src/index.js`)
   - Deprecate `server/index.js` or merge functionality

### **Long-term Improvements**

1. **Consolidate Authentication Systems**
   - Choose one system (recommend `src/` structure)
   - Remove duplicate code
   - Ensure admin login support

2. **Add Environment Variable Validation**
   - Validate required env vars on startup
   - Provide clear error messages if missing

3. **Standardize Password Hash Detection**
   - Support all bcrypt variants (`$2a$`, `$2b$`, `$2y$`)
   - Remove legacy plain text support (after migration)

4. **Add Logging**
   - Log authentication attempts
   - Log missing environment variables

## 🚀 Current State Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend | ✅ Working | React app with Hasura integration |
| Backend Entry (src/) | ⚠️ Has Issues | JWT_SECRET not using fallback |
| Backend Entry (root) | ✅ Working | But missing admin support |
| Admin Login | ⚠️ Partial | Only works with `src/` system |
| Reseller Login | ✅ Working | Works in both systems |
| Seed Admin Script | ✅ Working | Creates admin correctly |

## 📝 Next Steps

1. Fix JWT_SECRET usage in `auth.service.js`
2. Test admin login with seeded credentials
3. Decide on single entry point strategy
4. Add environment variable validation
5. Update documentation with correct setup steps

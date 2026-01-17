# Virtual Number API Server

Express.js backend API server for authentication and user management, integrated with Hasura GraphQL.

## Features

- ✅ **Password Hashing**: Bcrypt for secure password storage
- ✅ **JWT Authentication**: Secure token-based authentication
- ✅ **Hasura Integration**: GraphQL queries and mutations
- ✅ **Error Handling**: Comprehensive error handling middleware
- ✅ **CORS Support**: Configured for frontend integration
- ✅ **TypeScript Ready**: Can be easily migrated to TypeScript

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   └── hasura.client.js      # Hasura GraphQL client
│   ├── controllers/
│   │   └── auth.controller.js    # Authentication controllers
│   ├── middleware/
│   │   ├── auth.middleware.js    # JWT authentication middleware
│   │   └── error.middleware.js   # Global error handler
│   ├── routes/
│   │   └── auth.routes.js        # Authentication routes
│   ├── services/
│   │   └── auth.service.js       # Authentication business logic
│   ├── utils/
│   │   └── asyncHandler.js       # Async error handler utility
│   └── index.js                  # Server entry point
├── .env.example                  # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Installation

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables in `.env`:**
   ```env
   PORT=3001
   NODE_ENV=development
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=7d
   HASURA_GRAPHQL_ENDPOINT=https://your-hasura-instance/v1/graphql
   HASURA_ADMIN_SECRET=your_hasura_admin_secret
   CORS_ORIGIN=http://localhost:5173
   ```

## Running the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3001` (or your configured PORT).

## API Endpoints

### Authentication

#### `POST /api/auth/login`
Login user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "user@example.com",
      "phone": "1234567890",
      "current_step": 1,
      "signup_completed": false,
      "status": false
    }
  }
}
```

#### `POST /api/auth/register`
Register a new user.

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "user@example.com",
  "phone": "1234567890",
  "password": "password123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

#### `POST /api/auth/verify`
Verify JWT token (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

#### `POST /api/auth/refresh`
Refresh JWT token.

**Request Body:**
```json
{
  "token": "old_token_here"
}
```

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "virtualnumber-api"
}
```

## Integration with Frontend

Update your React frontend to use the new API:

```javascript
// src/utils/api.js
const API_BASE_URL = 'http://localhost:3001/api';

export const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (data.success) {
    // Store token and user data
    localStorage.setItem('authToken', data.data.token);
    localStorage.setItem('userData', JSON.stringify(data.data.user));
  }
  return data;
};
```

## Security Features

- ✅ Passwords hashed with bcrypt (10 salt rounds)
- ✅ JWT tokens with configurable expiration
- ✅ Legacy password support (for existing plain text passwords)
- ✅ Token validation middleware
- ✅ Error handling without exposing sensitive info

## Password Migration

The service supports both hashed and plain text passwords (legacy). To migrate existing plain text passwords:

1. When a user logs in with a plain text password, verify it
2. Hash the password using bcrypt
3. Update the `password_hash` field in Hasura
4. Future logins will use the hashed password

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3001` |
| `NODE_ENV` | Environment (development/production) | No | `development` |
| `JWT_SECRET` | Secret key for JWT signing | Yes | - |
| `JWT_EXPIRES_IN` | Token expiration time | No | `7d` |
| `HASURA_GRAPHQL_ENDPOINT` | Hasura GraphQL endpoint | Yes | - |
| `HASURA_ADMIN_SECRET` | Hasura admin secret | Yes | - |
| `CORS_ORIGIN` | Allowed CORS origin | No | `http://localhost:5173` |

## Troubleshooting

**Error: "HASURA_GRAPHQL_ENDPOINT is not set"**
- Make sure you've created `.env` file and set all required variables

**Error: "Invalid token"**
- Check if JWT_SECRET matches between token generation and verification
- Ensure token is not expired

**CORS errors:**
- Update `CORS_ORIGIN` in `.env` to match your frontend URL

## Next Steps

- [ ] Implement rate limiting for auth endpoints
- [ ] Add request validation (using express-validator or joi)
- [ ] Add logging (Winston or Pino)
- [ ] Set up automated tests (Jest)
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Migrate to TypeScript for type safety

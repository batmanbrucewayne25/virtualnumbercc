# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Hasura connectivity check 🔧

To connect your frontend to a Hasura GraphQL endpoint during development, create a `.env.local` file in the project root with the following variables (a `.env.example` is provided):

```
VITE_HASURA_GRAPHQL_ENDPOINT=https://your-hasura-instance/v1/graphql
VITE_HASURA_ADMIN_SECRET=your_admin_secret
```

After starting the dev server (npm run dev), open the app and navigate to `/hasura-check` to verify the connection. The page runs a small introspection query and shows success or detailed error information.


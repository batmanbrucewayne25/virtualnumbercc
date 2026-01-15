// Small helper for making GraphQL requests to Hasura (client-side)
// Uses Vite environment variables: VITE_HASURA_GRAPHQL_ENDPOINT and VITE_HASURA_ADMIN_SECRET

const HASURA_ENDPOINT = import.meta.env.VITE_HASURA_GRAPHQL_ENDPOINT;
const HASURA_ADMIN_SECRET = import.meta.env.VITE_HASURA_ADMIN_SECRET;

async function graphqlRequest(query, variables = {}) {
  if (!HASURA_ENDPOINT) {
    throw new Error("VITE_HASURA_GRAPHQL_ENDPOINT is not set in the environment");
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (HASURA_ADMIN_SECRET) {
    headers["x-hasura-admin-secret"] = HASURA_ADMIN_SECRET;
  }

  const res = await fetch(HASURA_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  return json;
}

export { graphqlRequest, HASURA_ENDPOINT };

import { graphqlFetch } from "@/lib/graphql/client";
import type { Query } from "@appliedpiper/graphql-template-contract";

// ////////////////////////////////
// GraphQL Queries
// ////////////////////////////////
const USERS_QUERY = /* GraphQL */ `
  query Users {
    users {
      _id
      email
      firstName
      lastName
      orders {
        createdAt
        total
      }
    }
  }
`;

const USER_BY_ID_QUERY = /* GraphQL */ `
  query User($id: ID!) {
    userById(id: $id) {
      _id
      email
      firstName
      lastName
      orders {
        createdAt
        total
      }
    }
  }
`;


// ////////////////////////////////
// GraphQL Query functions
// ////////////////////////////////

export async function fetchUsers() {
  const data = await graphqlFetch<Query>(USERS_QUERY);
  return data.users ? { users: data.users } : { users: [] };
}

export async function fetchUserById(id: string) {
  return graphqlFetch<Query>(USER_BY_ID_QUERY, { id });
}
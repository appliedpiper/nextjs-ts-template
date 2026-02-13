export const GET_ORDERS = /* GraphQL */ `
  query Orders {
    orders {
      _id
      createdAt
      total
      userId
    }  
  }`
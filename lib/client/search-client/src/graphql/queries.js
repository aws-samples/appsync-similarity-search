/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getProductById = /* GraphQL */ `
  query GetProductById($product_id: String!) {
    getProductById(product_id: $product_id) {
      product_id
      product_name
      category
      discounted_price
      actual_price
      discount_percentage
      rating
      rating_count
      about_product
      __typename
    }
  }
`;
export const getProductsBySimilarity = /* GraphQL */ `
  query GetProductsBySimilarity($query: String!) {
    getProductsBySimilarity(query: $query) {
      product_id
      product_name
    }
  }
`;

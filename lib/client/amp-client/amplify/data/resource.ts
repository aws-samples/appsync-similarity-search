import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Product: a.customType({
    product_id: a.string().required(),
    product_name: a.string().required(),
    category: a.string(),
    discounted_price: a.string(),
    actual_price: a.string(),
    discount_percentage: a.string(),
    rating: a.string(),
    rating_count: a.string(),
    about_product: a.string(),
  }),

  getProduct: a
    .query()
    .arguments({ product_id: a.string().required() })
    .returns(a.ref('Product'))
    .authorization((allow) => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        entry: './getProduct.js',
        dataSource: 'productInfo',
      }),
    ),
  search: a
    .query()
    .arguments({ query: a.string().required(), limit: a.integer() })
    .returns(a.ref('Product').array())
})

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ 
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 30 }
  }
});

import { toJsonObject, createPgStatement, select, sql } from '@aws-appsync/utils/rds';
import { util } from '@aws-appsync/utils';

/**
 * Send the SQL request
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {*} the request
 */
export function request(ctx) {
  const { product_id } = ctx.args;
  const statement = select({
    from: 'product_info',
    where: { product_id: { eq: product_id } },
    columns: ['product_id', 'product_name', 'category', 'discounted_price', 'actual_price', 'discount_percentage', 'rating', 'rating_count', 'about_product'],
  });

  const related = sql`
SELECT product_id, product_name
FROM product_info 
WHERE product_id != ${product_id}
ORDER BY embedding <-> (SELECT embedding FROM product_info WHERE product_id = ${product_id})
LIMIT 5`;

  console.log('>>> queries');
  const req = createPgStatement(statement);
  console.log('>>> queries', req);
  console.log('>>> queries');
  return req;
}

/**
 * Send the response
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {*} the product and related products
 */
export function response(ctx) {
  const { error, result } = ctx;
  if (error) {
    return util.appendError(error.message, error.type, result);
  }

  const object = toJsonObject(result);
  console.log('>>>', object);
  const product = object[0][0];
  product.related = object[1];
  return product;
}

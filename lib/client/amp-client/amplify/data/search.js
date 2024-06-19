import { sql, createPgStatement, toJsonObject } from '@aws-appsync/utils/rds';
import { util } from '@aws-appsync/utils';

/**
 * @param {import('@aws-appsync/utils').Context} ctx the context
 */
export function request(ctx) {
  const string = `${ctx.prev.result}`;
  console.log("Received from previous resolver ", string)
  const statement = sql`
SELECT DISTINCT product_id, product_name, about_product from (  
SELECT product_id, product_name, category, discounted_price, actual_price, discount_percentage, rating, rating_count, about_product
FROM product_info 
ORDER BY embedding <-> ${`${ctx.prev.result}`}::vector 
LIMIT ${ctx.args.limit ?? 10}) T`
;
  console.log("SQL Statememt to send ",statement);
  return createPgStatement(statement);
}

/**
 * The search results
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {*} the request
 */
export function response(ctx) {
  const { error, result } = ctx;
  if (error) {
    console.log("Error in resolver ", error)
    return util.appendError(error.message, error.type, result);
  }
  console.log("Got result ", result);
  return toJsonObject(result)[0];
}

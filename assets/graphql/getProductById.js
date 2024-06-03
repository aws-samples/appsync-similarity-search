import { sql, createPgStatement } from '@aws-appsync/utils/rds';
import { toJsonObject } from '@aws-appsync/utils/rds';

export function request(ctx) {
    const { product_id } = ctx.args;
    const statement = sql`select * from product_info where product_id = ${product_id}`;
    return createPgStatement(statement);
}

export function response(ctx) {
    const { error, result } = ctx;
    if (error) {
        return util.appendError(
            error.message,
            error.type,
            result
        )
    }
    return toJsonObject(result)[0][0]
}
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const {source, args} = ctx
  console.log('args', args)
  return {
    operation: 'Invoke',
    payload: { field: ctx.info.fieldName, arguments: args, source },
  };
}

export function response(ctx) {
    console.log('response', ctx.result)
    return JSON.parse(ctx.result); 
}
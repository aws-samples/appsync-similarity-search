import { util } from '@aws-appsync/utils';

/**
 * Send the HTTP request
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {*} the request
 */
export function request(ctx) {
  const { query } = ctx.args;
  console.log("Calling model with query ", query);
  return {
    resourcePath: `/model/${ctx.env.EMBED_MODEL_ID}/invoke`,
    method: 'POST',
    params: {
      headers: { 'Content-Type': 'application/json' },
      body: { inputText: query },
    },
  };
}

/**
 * Process the HTTP response
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {*} the publish response
 */
export function response(ctx) {
  const {
    error,
    result: { statusCode, body },
  } = ctx;

  

  if (error || !(statusCode >= 200 && statusCode < 300)) {
    return util.appendError(`Request error: ${error ?? statusCode}`);
  }
  const embedding = JSON.parse(body).embedding;
  console.log(`>>>>> received embedding (${embedding.length})`);
  return embedding;
}

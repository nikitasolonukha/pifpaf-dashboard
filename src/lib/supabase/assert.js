/** Throw if a Supabase client response includes an error. */
export function throwOnError(result, context = 'Database operation failed') {
  if (result?.error) {
    const err = result.error;
    const message = err.message || context;
    const wrapped = new Error(message);
    wrapped.code = err.code;
    wrapped.details = err.details;
    wrapped.hint = err.hint;
    wrapped.context = context;
    throw wrapped;
  }
  return result;
}

export async function dbWrite(promise, context) {
  const result = await promise;
  return throwOnError(result, context);
}

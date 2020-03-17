export default (err) => {
  if (err.errors && err.errors.length) {
    return err.errors[0].message;
  }

  const { graphQLErrors } = err;
  if (graphQLErrors && graphQLErrors.length) {
    return graphQLErrors.map((x) => x.message).join('; ');
  }

  if (err.networkError && err.networkError.result && err.networkError.result.errors && err.networkError.result.errors.length) {
    return err.networkError.result.errors[0].message;
  }

  return err.message;
};

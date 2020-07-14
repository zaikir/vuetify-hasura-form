export default ($vuetify, key, defaultTranslation) => {
  const translation = ($vuetify.lang.locales[$vuetify.lang.current].hasuraForm || {})[key];
  return translation || defaultTranslation;
};

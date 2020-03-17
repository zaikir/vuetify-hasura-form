export default ($vuetify, key, defaultTranslation) => {
  const translation = ($vuetify.lang.locales[$vuetify.lang.current].hasuraTable || {})[key];
  return translation || defaultTranslation;
};

import Form from './Form.vue';

export const HasuraForm = Form;

export default {
  install: (Vue, options = {}) => {
    // eslint-disable-next-line no-param-reassign
    Vue.$hasuraForm = options;
  },
};

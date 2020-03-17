import Table from './DataTable.vue';

export const HasuraTable = Table;

export default {
  install: (Vue, options = {}) => {
    // eslint-disable-next-line no-param-reassign
    Vue.$hasuraTable = options;
  },
};

<script>
import gql from 'graphql-tag';
import Vue from 'vue';
import {
  VCard, VCardTitle, VCardText,
} from 'vuetify/lib/components';
import { flatFields, wrapGraphqlError } from './utils';


export default {
  props: {
    value: {
      type: Object,
      default: () => ({}),
    },
    source: {
      type: String,
      required: true,
    },
    fields: {
      type: Array,
      required: true,
    },
    itemId: {
      type: null,
    },
    flat: {
      type: Boolean,
      default: false,
    },
    cardProps: {
      type: Object,
      default: () => ({}),
    },
    customSelections: {
      type: Function,
      default: (x) => x,
    },
    primaryKey: {
      type: String,
      default: 'id',
    },
    primaryKeyType: {
      type: String,
      default: 'uuid!',
    },
  },
  apollo: {
    fetchedItem: {
      query() {
        return gql(`query FetchItem($id: ${this.primaryKeyType}) { ${this.source}_by_pk (${this.primaryKey}: $id) {
          id ${this.selections.join(' ')}
        } }`);
      },
      variables() {
        return { id: this.itemId };
      },
      update(data) {
        return data[`${this.source}_by_pk`];
      },
      result() {
        this.initialLoading = false;
      },
      error(error) {
        const errorText = wrapGraphqlError(error);
        this.emitError(errorText, error);
      },
      skip() {
        return !this.itemId;
      },
    },
  },
  data() {
    return {
      fetchedItem: null,
      item: {},
      isSaving: false,
    };
  },
  computed: {
    flattenFields() {
      return flatFields(this.fields);
    },
    selections() {
      return this.customSelections(this.flattenFields.filter((x) => x.value).map((x) => x.value));
    },
    title() {
      return this.itemId ? 'Редактирование' : 'Создание';
    },
  },
  watch: {
    fetchedItem: {
      handler() {
        this.item = {
          ...this.value || {},
          ...this.fetchedItem || {},
        };
      },
      immediate: true,
    },
  },
  methods: {
    submit() {
      this.$refs.form.submit();
    },
    emitError(errorText, error) {
      if ((Vue.$hasuraForm || {}).errorHandler) {
        Vue.$hasuraForm.errorHandler(errorText, error);
      }

      this.$emit('error', errorText);
    },
    async onSubmit(item) {
      try {
        this.isSaving = true;
        const processedItem = {
          ...item,
          __typename: undefined,
        };

        if (!this.itemId) {
          const { data: { [`insert_${this.source}`]: { returning: { id } } } } = await this.$apollo.mutate({
            mutation: gql(`mutation Insert($items: [${this.source}_insert_input!]!) {
              insert_${this.source} (objects: $items) {
                returning { id }
              }
            }`),
            variables: { items: [processedItem] },
          });

          this.$emit('submit', { item: { id } });
        } else {
          this.$apollo.mutate({
            mutation: gql(`mutation Insert($id: ${this.primaryKeyType}, $item: ${this.source}_set_input!) {
              update_${this.source} (where: {id: {_eq: $id}}, _set: $item) {
                affected_rows
              }
            }`),
            variables: {
              id: item.id,
              item: processedItem,
            },
            error(error) {
              const errorText = wrapGraphqlError(error);
              this.emitError(errorText, error);
            },
          });

          this.$emit('submit', { item: { ...item, id: this.itemId } });
        }

        this.fetchedItem = null;
      } catch (error) {
        const errorText = wrapGraphqlError(error);
        this.emitError(errorText, error);
      } finally {
        this.isSaving = false;
      }
    },
  },
  render(h) {
    const params = Vue.$hasuraForm || {};
    const options = {
      ...params,
    };

    const skeletonLoading = this.$apollo.loading;

    const totalProps = {
      ...this.$props,
      ...this.$attrs,
      value: this.item,
      skeletonLoading,
    };

    const totalScopedSlots = this.$scopedSlots;

    const title = h(VCardTitle, [this.$scopedSlots.title
      ? this.$scopedSlots.title({ item: this.item, isNew: !!this.item.id })
      : this.title,
    ]);

    const text = h(VCardText, [
      h(options.form, {
        ref: 'form',
        props: totalProps,
        scopedSlots: totalScopedSlots,
        on: {
          ...this.$listeners,
          submit: this.onSubmit,
        },
      }),
    ]);

    const actions = this.$scopedSlots.actions && this.$scopedSlots.actions({
      item: {
        ...this.item,
        id: this.itemId,
      },
      isNew: !!this.itemId,
      isSaving: this.isSaving,
      submit: this.submit,
    });

    return h(VCard, {
      props: {
        flat: this.flat,
        ...this.cardProps,
      },
    }, [
      title,
      text,
      actions,
    ]);
  },
};
</script>

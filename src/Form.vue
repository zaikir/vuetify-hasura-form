<script>
import gql from 'graphql-tag';
import Vue from 'vue';
import {
  VCard, VCardTitle, VCardText,
} from 'vuetify/lib/components';
import { flatFields, wrapGraphqlError, translate } from './utils';


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
    mutation: {
      type: Function,
      default: null,
    },
    preMutation: {
      type: Function,
      default: (x) => x,
    },
    postMutation: {
      type: Function,
      default: () => {},
    },
    postFetch: {
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
          ${this.primaryKey} ${this.selections.join(' ')}
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
      submittedCallback: null,
      initialLoading: false,
    };
  },
  computed: {
    flattenFields() {
      return flatFields(this.fields);
    },
    selections() {
      return this.customSelections(this.flattenFields.filter((x) => x.selectable !== false && x.value).map((x) => x.selector || x.value));
    },
    editableFields() {
      return this.flattenFields.filter((x) => x.editable !== false && x.value).map((x) => x.value);
    },
    title() {
      return this.itemId
        ? translate(this.$vuetify, 'titleEdit', 'Edit')
        : translate(this.$vuetify, 'titleCreate', 'Create');
    },
  },
  watch: {
    itemId: {
      handler(val) {
        if (val) {
          this.initialLoading = true;
        }
      },
      immediate: true,
    },
    fetchedItem: {
      async handler() {
        this.item = await this.postFetch({
          ...this.value || {},
          ...this.fetchedItem || {},
        });
        this.$emit('input', this.item);
      },
      immediate: true,
    },
  },
  methods: {
    submit(callback) {
      this.submittedCallback = typeof callback === 'function' && callback;
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
        const processedItem = await this.preMutation({
          ...Object.fromEntries(
            Object.entries(item).filter(
              ([key, value]) => this.editableFields.includes(key) || !this.flattenFields.map((x) => x.value).includes(key),
            ),
          ),
          __typename: undefined,
        });

        const submit = async (data) => {
          const submitData = {
            ...data,
            item: {
              ...data.item,
              ...item,
            },
            prevItem: this.fetchedItem,
          };

          await this.postMutation(submitData);

          this.$emit('submit', submitData);

          if (this.submittedCallback) {
            this.submittedCallback(submitData);
          }
        };

        if (!this.itemId) {
          if (this.mutation) {
            const { [this.primaryKey]: id } = await this.mutation({ item: processedItem, isNew: true });
            await submit({
              item: {
                [this.primaryKey]: id,
              },
            });
          } else {
            const { data: { [`insert_${this.source}`]: { returning: [{ [this.primaryKey]: id }] } } } = await this.$apollo.mutate({
              mutation: gql(`mutation InsertItem($items: [${this.source}_insert_input!]!) {
              insert_${this.source} (objects: $items) {
                returning { ${this.primaryKey} }
              }
            }`),
              variables: { items: [processedItem] },
            });

            await submit({ item: { [this.primaryKey]: id } });
          }
        } else if (this.mutation) {
          await this.mutation({ item: processedItem, isNew: false });
          await submit({ item: { ...item, [this.primaryKey]: this.itemId } });
        } else {
          await this.$apollo.mutate({
            mutation: gql(`mutation UpdateItem($id: ${this.primaryKeyType}, $item: ${this.source}_set_input!) {
              update_${this.source} (where: {${this.primaryKey}: {_eq: $id}}, _set: $item) {
                affected_rows
              }
            }`),
            variables: {
              id: item[this.primaryKey],
              item: processedItem,
            },
            error(error) {
              const errorText = wrapGraphqlError(error);
              this.emitError(errorText, error);
            },
          });

          await submit({ item: { ...item, [this.primaryKey]: this.itemId } });
        }
      } catch (error) {
        if (this.mutation) {
          this.emitError(error.message, error);
        } else {
          const errorText = wrapGraphqlError(error);
          this.emitError(errorText, error);
        }
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

    const skeletonLoading = this.initialLoading;

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

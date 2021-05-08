<!-- Vue component -->
<template>
  <div style="padding-top: 4px; padding-bottom: 4px">
    <div :style="{ float: 'left', height: '100%', width: `${prefixWidth}px` }">
      {{ prefix }}
    </div>
    <multiselect
      :style="{
        float: 'left',
        height: '100%',
        width: `${width - prefixWidth}px`,
      }"
      @input="onChange"
      dense
      searchable
      :showLabels="false"
      v-model="value"
      :options="keys"
    ></multiselect>
  </div>
</template>

<script>
import Multiselect from "vue-multiselect";
import { mapState, mapGetters } from "vuex";

// register globally
//Vue.component('multiselect', Multiselect)

export default {
  // OR register locally
  components: { Multiselect },
  props: ["initialValue", "width", "prefix", "prefixWidth"],
  data() {
    return {
      value: this.initialValue,
    };
  },
  computed: {
    ...mapState({
      keys: (state) => state.numericDimensions.concat(["selected"]),
    }),
  },
  methods: {
    onChange: function (value, id) {
      this.$emit("update", value);
    },
  },
};
</script>

<!-- New step!
     Add Multiselect CSS. Can be added as a static asset or inside a component. -->
<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>

<style scoped>
::v-deep .multiselect__tags > .multiselect__single,
::v-deep .multiselect__tags > .multiselect__placeholder {
  overflow: hidden;
  white-space: nowrap;
}
</style>
<!-- Vue component -->
<template>
  <div>
    <multiselect
      
     

      :style="{'height':'30px;','width': `${(1/6.0)*width}px`}"
      collapse
      @input="onChange"
      dense
      v-model="value"
      :options="keys"
      :multiple="true"
      :close-on-select="false"
      :clear-on-select="false"
      :preserve-search="true"
      :showLabels="false"
      searchable
      
   
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
  props: ["initialValue", "width"],
  data() {
    return {
      value: this.initialValue
    };
  },
  computed: {
    ...mapState({
      keys: state => state.numericDimensions.concat(["selected"])
    })
  },
  methods: {
    onChange: function(value, id) {
      this.$emit("update", value);
    }
  }
};
</script>

<!-- New step!
     Add Multiselect CSS. Can be added as a static asset or inside a component. -->
<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>

<style > 


</style>
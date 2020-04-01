<!-- Vue component -->
<template>
  <div>
    <multiselect
      
     

      :style="{'height':'30px;','width': `${width}px`}"
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
  props: ["initialValue","keys", "width"],
  data() {
    return {
      value: this.initialValue,
     // keys: this.initialValue,
    };
  },
  computed: {

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
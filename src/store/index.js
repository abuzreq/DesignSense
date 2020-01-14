import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);



export default new Vuex.Store({
  state: {
    data: [{id:"1", value: 1, selected: false},{id:"2", value: 1, selected: false},{id:"3", value: 1, selected: false},{id:"4", value: 1, selected: false},{id:"5", value: 1, selected: false}]
  },
  mutations: {
    increment (state, i) {
        state.data[i].value += 10;
      },
      select (state, i) {
        state.data[i].selected = true;
      },
      unselect (state, i) {
        state.data[i].selected = false;
      }
  },
  actions: {
  },
  modules: {},
  getters: {
    data: state => {
        return state.data
      }

  }
});

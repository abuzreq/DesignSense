import Vue from 'vue';
import App from './App';
import router from "./router";
import store from "./store";
import vuetify from "./plugins/vuetify";


new Vue({
  router,
  store,
  vuetify,
  el: '#app',
  render: h => h(App),
});
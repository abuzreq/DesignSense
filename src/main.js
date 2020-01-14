import Vue from 'vue';
import vuetify from "./plugins/vuetify";
import App from './App';
import router from "./router";
import store from "./store";

new Vue({
  router,
  store,
  vuetify,
  el: '#app',
  render: h => h(App),
});
import Vue from "vue";
import VueRouter from "vue-router";
import App from "@/App.vue"
import Demo from "@/Demo.vue"
import Info from "@/Info.vue"
import VueAnalytics from 'vue-analytics';
import VueGtag from 'vue-gtag'

Vue.use(VueRouter);

const routes = [
    { 
        path: "/",
        name: "home",
        component: Demo
    }, 
    { 
        path: "/about",
        name: "about",
        component: Info
    }, 
    {
        path: "/demo",
        name: "demo",
        component: Demo
    }, 
    { path: '*', component: Demo }
    
]


const router = new VueRouter({
routes
});

/*
Vue.use(VueAnalytics, {
    id: 'G-R9H6P1BD0H',
    router,
    debug: {
        enabled: true, // default value
        trace: true, // default value
        sendHitTask: true // default value
      }
});*/

Vue.use(VueGtag, {
    config: {
        id: 'G-R9H6P1BD0H',
        params: {
            anonymize_ip: true
        },
        debug: {
            enabled: process.env.NODE_ENV === "development", // default value
            trace: true, // default value
            sendHitTask: true // default value
        }
    }
}, router)

export default router;
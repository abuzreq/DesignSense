import Vue from "vue";
import VueRouter from "vue-router";
import App from "@/App.vue"
import Demo from "@/Demo.vue"
import Info from "@/Info.vue"
import VueAnalytics from 'vue-analytics';

Vue.use(VueRouter);

const routes = [
    { 
        path: "/",
        name: "home",
        component: Info
    }, 
    { 
        path: "/info",
        name: "info",
        component: Info
    }, 
    {
        path: "/demo",
        name: "demo",
        component: Demo
    }, 
    { path: '*', component: Info }
    
]


const router = new VueRouter({
routes
});

Vue.use(VueAnalytics, {
    id: 'G-R9H6P1BD0H',
    router
});

export default router;
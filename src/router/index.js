import Vue from "vue";
import VueRouter from "vue-router";
import Demo from "@/Demo.vue";
import Info from "@/Info.vue";


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



export default router;
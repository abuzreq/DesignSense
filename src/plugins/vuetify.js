import Vue from "vue";
import Vuetify from "vuetify/lib";
import '@mdi/font/css/materialdesignicons.css'
import 'material-design-icons-iconfont/dist/material-design-icons.css'



import ReplaceIcon from "@/misc/ReplaceIcon.vue";
/* 
import AddIcon from "@/misc/AddIcon.vue";
import SubtractIcon from "@/misc/SubtractIcon.vue";
import IntersectIcon from "@/misc/IntersectIcon.vue";
import ToggleIcon from "@/misc/ToggleIcon.vue"; */


Vue.use(Vuetify);

export default new Vuetify({ icons: {
    iconfont: 'md', // 'mdi' || 'mdiSvg' || 'md' || 'fa' || 'fa4' || 'faSvg'
     replaceIcon: { 
      component: ReplaceIcon, 
    },/*
    addIcon: { 
      component: AddIcon, 
    },
    substractIcon: { 
      component: SubtractIcon, 
    },    
    intersectIcon: { 
      component: IntersectIcon, 
    },
    toggleIcon: { 
      component: ToggleIcon, 
    }, */


  },});
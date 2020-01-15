import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);


//https://stackoverflow.com/questions/41572974/how-to-load-all-server-side-data-on-initial-vue-js-vue-router-load
function preprocess(data)
{
    for(var el of data)
    {
        el['highlighted'] = false;
    }
    return data
}


function builder(new_data) 
{

    return new Vuex.Store({
        state: {
            data: preprocess(new_data)
        },
        mutations: {
            highlight(state, ids) 
            {

                state.data.forEach(element => {
                    if(ids.contains(element._id))
                    {
                        element['highlighted'] = true;
                    }
                
                    console.log(element)
                });
            },
            select(state, i) {
                state.data[i].selected = true;
            },
            unselect(state, i) {
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



}

export default builder;


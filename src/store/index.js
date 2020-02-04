import Vue from "vue";
import Vuex from "vuex";
import views from "@/components/constants.js";

Vue.use(Vuex);


//https://stackoverflow.com/questions/41572974/how-to-load-all-server-side-data-on-initial-vue-js-vue-router-load
function preprocess(data)
{
    for(var el of data)
    {
        el['highlighted'] = 0;
    }
    return data
}

function prepare_map(data)
{
    let map = {}
    data.forEach(element => 
    {
        map[element._id] = 0
    })
    //let mask = new Array(len).fill(0);
    return map
}

function reset_map(map)
{
    for(var key in map)
    {
        map[key] = 0
    }
    return map
}

function builder(new_data) 
{

    return new Vuex.Store({
        state: {
            data: preprocess(new_data),
            highlighted_map: prepare_map(new_data), //TODO: [Fix] Assumes data will not change, need to update the map so it includes additional data when it arrives
            highlighted_forms_map: prepare_map(new_data),
            ctrlOn: false,
            shiftOn: false
        },
        mutations: {
            
            highlight(state, args) 
            {
                let selection = args[0]
                let source =  args[1]
                

                if(source == views.SCATTERPLOT)
                {
                    state.highlighted_forms_map = reset_map(state.highlighted_forms_map);
                    selection.forEach(element => 
                    {
                        // let x  = state.highlighted_map[element._id]                
                        state.highlighted_forms_map[element._id] =  1; // &&  state.highlighted_map[element._id]               
                    })
                }
                else if(source == views.PCOORDS)
                {
                    state.highlighted_map = reset_map(state.highlighted_map);
                    selection.forEach(element => 
                    {
                        // let x  = state.highlighted_map[element._id]                
                        state.highlighted_map[element._id] =  1; // &&  state.highlighted_map[element._id]  
                        state.highlighted_forms_map[element._id] =  1;             
                    })
                }

                //console.log("highlight2",state.highlighted_map)

                /*
                //console.log("highlight",selection)
                let ids = selection.map(e => e._id)
                state.data.forEach(element => 
                {
                    if(ids.includes(element._id))
                    {
                        element['highlighted'] = 1;                 
                    } 
                });*/


            },
            unhighlight(state, selection) 
            {
                selection.forEach(element => 
                {
                    state.highlighted_map[element._id] = 0
                })
            }
        },
        actions: {
        },
        modules: {},
        getters: {
            data: state => {return state.data},     
            highlighted: state => 
            {
                var result = [];
                let it = 0;
                for(var id in state.highlighted_map)
                {
                    if( state.highlighted_map[id] == 1)
                    {
                        result.push(state.data[it])
                    }
                    it+=1;
                }          
                return result;
            },
            highlighted_forms: state => 
            {
                var result = [];
                let it = 0;
                for(var id in state.highlighted_forms_map)
                {
                    if( state.highlighted_forms_map[id] == 1)
                    {
                        result.push(state.data[it])
                    }
                    it+=1;
                }          
                return result;
            },
            highlightedMask: state => 
            {
                var result = [];
                for(var id in state.highlighted_map)
                {
                    result.push(state.highlighted_map[id] )                   
                }          
                return result;
            }
        }

    });



}

export default builder;


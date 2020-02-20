import Vue from "vue";
import Vuex from "vuex";
import views from "@/components/constants.js";
import operations from "@/components/operations.js";
import generateID from "@/components/utils.js";

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
function getSelection(marking, selection)
{
    var selected = {};
    for (var alt of selection) {
        selected[alt] = marking[alt]
    }
}

function allTheSame(selected)
{
    var atleastOneIsDifferent = false;
    var tmp = -1;
    var old = -1;
    for (var alt in selected) 
    {  
       if(tmp == -1)
       {
          old = selected[alt];
       }
       else
       {
         old = tmp;
       }
       tmp = selected[alt]

       if(old != tmp)
       {
         atleastOneIsDifferent = true;
         break;
       }
    }
    return atleastOneIsDifferent;
}
function flip(value)
{
    return value == 1?0:1
}

function operate(marking, selection, operation)
{  
    if(operation == operations.REPLACE)
    {
        for (var alt in marking) {
            marking[alt] = 0;
        }
        for (var alt of selection) {
            marking[alt] = 1;
        }
    }
    else if(operation == operations.ADD)
    {
        for (var alt of selection) {
            marking[alt] = 1;
        }
    }
    else if(operation == operations.TOGGLE)
    {
        let selected = getSelection(marking, selection)
        let areAllTheSame = allTheSame(selected)
        if(areAllTheSame)
        {
            for (var alt of selection) {
                marking[alt] = flip(marking[alt]);
            }    
        }
        else
        {
            for (var alt of selection) {
                marking[alt] = 1;
            }
        }
    }
    else
    {
       console.error('Unknown Selection Operation')
        
    }
}
function createMarkingObject(data)
{
    let marking = {}
    for (var alt of data) 
    {
        //console.log(alt._id)
        marking[alt._id] = 0;    
    }
    return marking;
}

function builder(new_data) 
{
    return new Vuex.Store({
        state: {
            defaultMarkingID: "_lqpkb07gn",//generateID(),
            data: preprocess(new_data),
            view2markingIDs: new Map(),
            markingID2views: new Map(), 
            markingsMap: {}, // markingID -> marking object. Marking object is {altID -> highlightState}
            markingsDefault: {},
            ctrlOn: false,
            shiftOn: false
        },
        mutations: 
        {
            createMarkingEntry(state)
            {
                let ID = ""
                if(Object.entries(state.markingsMap).length == 0)
                {
                    console.log("Default 123");
                    ID = state.defaultMarkingID;
                }
                else
                {
                    ID = generateID(); 
                }
                
                state.markingsMap[ID] = createMarkingObject(state.data);
                state.markingsDefault = state.markingsMap[ID]
                //TODO find a proper ID for the marking
                //TODO create a marking object (which uses all the data available now)
                //markingsMap[ID] = marking object
            },
            addMarking(state, payload)
            {
                let view = payload.view;
                let markingID = "";
                if(!(payload.hasOwnProperty("markingID")))
                {
                    console.log("default marking assigned")
                    markingID = state.defaultMarkingID;
                }
                else
                {
                    
                    markingID = payload.markingID;
                }
                console.log("markingID ",payload)
                if(!state.view2markingIDs.has(view))
                {
                    state.view2markingIDs.set(view, new Set())
                }
                
                state.view2markingIDs.get(view).add(markingID)
                console.log("markings ",state.view2markingIDs.get(view))
            },
            addView(state, payload)
            {
                let view = payload.view;
                let markingID = payload.markingID;

                if(!state.markingID2views.has(markingID))
                {
                    state.markingID2views.set(markingID, new Set())
                }
                state.markingID2views.get(markingID).add(view)
            },
            update(state, payload)
            {
                let view = payload.view;
                let selection = payload.selection;
                let operation = payload.operation;
                console.log(state.view2markingIDs)
                console.log(state.view2markingIDs.get(view))
                operate(state.markingsDefault, selection, operation);  

                /*
                state.view2markingIDs.get(view).forEach((markingID) => 
                {        
                    operate(state.markingsMap[markingID], selection, operation);           
                })
                */
            },
            /*update(state, view, selection)
            {
                let operation = 'OR'; //check cntrl and shift then decide operation
                update(view, selection, operation)
            },*/
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
            markingsDefaultGetter: state => {return state.markingsDefault},
            markingsMapGetter: (state) => (markingID) => { console.log(markingID, state.markingsMap[markingID]);return state.markingsMap[markingID]},
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


import Vue from "vue";
import Vuex from "vuex";
import views from "@/components/constants.js";
import {operations} from "@/components/operations.js";
import generateID from "@/components/utils.js";

Vue.use(Vuex);


function preprocess(data)
{
    return data;
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

function createDataMap(data)
{
    let map = {}
    data.forEach(element => 
    {
        map[element._id] = element;
    })
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
    return selected;
}

function getSelectedInMarking(marking, dataMap)
{   
    var selected = {};
    for (var alt in marking) 
    {
        if(marking[alt] == 1)
        {
            selected[alt] = dataMap[alt];
        }    
    }
    return selected;
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
    return !atleastOneIsDifferent;  
}
function flip(value)
{
    return value == 1?0:1
}

function operate(marking, selection, operation)
{  
    //TODO
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
/**
 * Finds the marking that affects the passed view
 * @param {*} markingID2views 
 * @param {*} view 
 */
function findMarkingAffectingView(markingsMap, markingID2views, view)
{
    return markingsMap[findMarkingIDForView(markingID2views, view)]
}

/**
 * Finds markingID of the marking that affects the passed view
 * @param {*} markingID2views 
 * @param {*} view 
 */
function findMarkingIDForView(markingID2views, view)
{
    let targetMarkingID = null;
    markingID2views.forEach((viewsSet, markingID) => 
    {        
        if(viewsSet.has(view))
        {
            targetMarkingID = markingID;
        }  
    }) 
    if(targetMarkingID == null)
    {
        console.error("No Marking affecting this view was found")
        return null;
    }
    else
    {
        return targetMarkingID;
    }   
}
/**
 * 
 * @param {*} view 
 * @param {*} view2markingIDs 
 * @param {*} markingID2views 
 */
function disconnectViewFromMarkings(view, view2markingIDs, markingID2views, markingsMap)
{
    view2markingIDs.delete(view);
  
    markingID2views.forEach((viewsSet, markingID) => 
    {        
        if(viewsSet.has(view))
        {
           viewsSet.delete(view)
        }

    }) 
    trimEmptyMarkings(markingID2views, view2markingIDs, markingsMap)
}

function trimEmptyMarkings(markingID2views, view2markingIDs, markingsMap)
{
    let emptyMarkings = []
    markingID2views.forEach((viewsSet, markingID) => 
    {        
        if(viewsSet.size == 0)
        {
            emptyMarkings.push(markingID)
        }
    }) 

    emptyMarkings.forEach(markingID => 
    {
        delete markingsMap[markingID]
        markingID2views.delete(markingID)
        view2markingIDs.forEach((markingsSet, view) =>
        {
            if(markingsSet.has(markingID))
            {
                markingsSet.delete(markingID)
            }
        }) 
    })
}

function map2Data(map)
{
    var result = []
    for(var key in map)
    {
        result.push(map[key]);                
    }  
    return result;
}
function filterData(dataMap, toFilter)
{  
    var dataMapCopy = JSON.parse(JSON.stringify(dataMap)); 
    for(var altID in toFilter)
    {
        delete dataMapCopy[altID];
    }
    return dataMapCopy;
}

function builder(new_data) 
{
    return new Vuex.Store({
        state: {
            defaultMarkingID: generateID(), //"_lqpkb07gn"
            rawData: new_data,
            data: preprocess(new_data),
            view2markingIDs: new Map(),
            markingID2views: new Map(), 
            markingsMap: {}, // markingID -> marking object. Marking object is {altID -> highlightState}
            viewsMap: {},
            ctrlOn: false,
            shiftOn: false,
            altOn: false,
        },
        mutations: 
        {
            setData(state, payload)
            {
                state.data = payload.newData;               
            },
            resetMarking(state, payload)
            {
                let marking  = state.markingsMap[payload.markingID];
                for (var alt in marking) 
                {
                    marking[alt] = 0; 
                }             
            },
            createView(state, payload)
            {
                let viewID = payload.view;
                let vueComponent = payload.vueComponent;
                state.viewsMap[viewID] = vueComponent;
            },
            createMarkingEntry(state, args)
            {
                let ID = ""
                if(Object.entries(state.markingsMap).length == 0)
                {
                    ID = state.defaultMarkingID;
                }
                else
                {
                    ID = generateID(); 
                }

                //TODO Uses all the currently available data (i.e. raw data) 
                state.markingsMap[ID] = createMarkingObject(state.rawData);

                if(args)
                {
                    args.markingID = ID;
                }
            },
            addMarking(state, payload)
            {
                let view = payload.view;
                let markingID = "";
                if(!(payload.hasOwnProperty("markingID")))
                {
                    markingID = state.defaultMarkingID;
                }
                else
                {           
                    markingID = payload.markingID;
                }
                if(!state.view2markingIDs.has(view))
                {
                    state.view2markingIDs.set(view, new Set())
                }
                
                state.view2markingIDs.get(view).add(markingID)
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
                console.log("operation ", operation, view, state.viewsMap[view])
                if( state.view2markingIDs.has(view))
                {
                    state.view2markingIDs.get(view).forEach((markingID) => 
                    {        
                        operate(state.markingsMap[markingID], selection, operation);           
                    })     
                }
                else
                {
                    console.log("This view does not affect any marking")
                }              
            },
        },
        actions: {
            createDefaultView(context, payload) // {commit}, payload
            {
                let view = payload.view;
                let vueComponent = payload.vueComponent;
                let markingID = context.state.defaultMarkingID;
                console.log("createDefaultView",payload)
                context.commit('addMarking', {"view": view, "markingID":markingID});
                context.commit('addView', {"view": view, "markingID":markingID});
                context.commit('createView', {"view": view, "vueComponent": vueComponent});
            },
            createDetailsView(context, payload) // {commit}, payload
            {
                console.log("createDetailsView", payload)
                let master_view = payload.master_view;
                let details_view = payload.details_view;
                //Make sure the details view is not linked to anything else first
                disconnectViewFromMarkings(details_view, 
                    context.state.view2markingIDs, 
                    context.state.markingID2views,
                    context.state.markingsMap)
                
                //Create a new marking that will be affected by master and affecting slave
                let args = {markingID:""};
                context.commit('createMarkingEntry', args)
                let newMarkingID = args.markingID;

                context.commit('addMarking', {"view": master_view, "markingID":newMarkingID});
                context.commit('addView', {"view": details_view, "markingID":newMarkingID});
            },
            zoomToSelection(context)
            {
                let dataMapSubset = context.getters.selectedInMarking(context.state.defaultMarkingID);
                let selection = map2Data(dataMapSubset)
                context.commit('setData', {newData: selection});
            },
            excludeSelection(context)
            {
                let toFilter = context.getters.selectedInMarking(context.state.defaultMarkingID);            
                let selection = map2Data(filterData(context.getters.dataMap, toFilter))
                context.commit('setData', {newData: selection});
            },
            resetData(context)
            {
                context.commit('resetMarking', {newData: context.state.defaultMarkingID});
                context.commit('setData', {newData: context.state.rawData});
            }
        },
        modules: {},
        getters: {
            getMarking : state => view => {return findMarkingAffectingView(state.markingsMap,state.markingID2views, view)},
            data: state => {return state.data},   
            dataMap: state => {return createDataMap(state.data);},
            selectedInMarking: (state, getters) => markingID => 
            {
                return getSelectedInMarking(state.markingsMap[markingID], getters.dataMap)
            },
            selectedInView: (state, getters) => view => 
            {
                let marking = findMarkingAffectingView(state.markingsMap, state.markingID2views, view);
                return getSelectedInMarking(marking, getters.dataMap)
            },
            selectedDataInView: (state, getters) => view => 
            {
                var selectedInMarking =  getters.selectedInView(view);
                var result = map2Data(selectedInMarking)
                return result;             
            },
            markingsDefaultGetter: state => {return  state.markingsMap[state.defaultMarkingID]},
            markingsMapGetter: (state) => (markingID) => {return state.markingsMap[markingID]},
        }

    });



}

//ref: https://stackoverflow.com/questions/41572974/how-to-load-all-server-side-data-on-initial-vue-js-vue-router-load
export default builder;


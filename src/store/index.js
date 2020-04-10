import Vue from "vue";
import Vuex from "vuex";
import views from "@/components/constants.js";
import { operations } from "@/components/operations.js";
import {generateID} from "@/components/utils.js";
import * as d3 from "d3";

Vue.use(Vuex);

function builder(new_data, dataTypesMap, new_layouts, new_similarity_map) {
    return new Vuex.Store({
        state: {
            colorScale: d3.scaleOrdinal(d3.schemeCategory10),
            layouts: new_layouts,
            defaultMarkingID: generateID(), //"_lqpkb07gn"
            rawData: new_data,
            data: preprocess(new_data),
            dataStack: [],
            view2markingIDs: new Map(),
            markingID2views: new Map(),
            markingsMap: {}, // markingID -> marking object. Marking object is {altID -> highlightState}
            viewsMap: {},

       
            setsIDs: [],
            setsMetadataMap: {},
            setsMap: {},
            numericDimensions: getNumeric(dataTypesMap),
            allDimensions: Object.keys(dataTypesMap),
            setsCounter: 0,

            similarity_map: new_similarity_map,

            isEditingMode: false,

            hovered: null,

            isCtrlKey: false,
            isShiftKey: false,
            isAltKey: false,
            isInspectionMode: false,
            
        },
        mutations:
        {
           /* setSimilarityMap(state, payload)
            {   
                state.similarity_map = payload.similarity_map;
            },  */
            toggleEditingMode(state, payload) {
                state.isEditingMode = !state.isEditingMode;
            },
            toggleInspectionMode(state, payload) 
            {
                
                state.isInspectionMode = !state.isInspectionMode;
                if(!state.isInspectionMode)
                {
                    state.hovered = null;
                }
            },

            
            setData(state, payload) {
                state.data = payload.newData;
            },
            resetMarking(state, payload) {
                let marking = state.markingsMap[payload.markingID];
                for (var alt in marking) {
                    marking[alt] = 0;
                }
            },
            createView(state, payload) {
                let viewID = payload.view;
                let vueComponent = payload.vueComponent;
                state.viewsMap[viewID] = vueComponent;
            },
            createMarkingEntry(state, args) {
                let ID = ""
                if (Object.entries(state.markingsMap).length == 0) {
                    ID = state.defaultMarkingID;
                }
                else {
                    ID = generateID();
                }

                //TODO Uses all the currently available data (i.e. raw data) 
                state.markingsMap[ID] = createMarkingObject(state.rawData);

                if (args) {
                    args.markingID = ID;
                }
            },
            addMarking(state, payload) {
                let view = payload.view;
                let markingID = "";
                if (!(payload.hasOwnProperty("markingID"))) {
                    markingID = state.defaultMarkingID;
                }
                else {
                    markingID = payload.markingID;
                }
                if (!state.view2markingIDs.has(view)) {
                    state.view2markingIDs.set(view, new Set())
                }

                state.view2markingIDs.get(view).add(markingID)
            },
            addView(state, payload) {
                let view = payload.view;
                let markingID = payload.markingID;

                if (!state.markingID2views.has(markingID)) {
                    state.markingID2views.set(markingID, new Set())
                }
                state.markingID2views.get(markingID).add(view)
            },
            update(state, payload) {
                let selection = payload.selection;
                let operation = payload.operation;
                if ((payload.hasOwnProperty("markingID"))) {
                    operate(state.markingsMap[payload.markingID], selection, operation);
                }
                else {
                    let view = payload.view;

                    //console.log("operation ", operation, view, state.viewsMap[view])
                    if (state.view2markingIDs.has(view)) {
                        state.view2markingIDs.get(view).forEach((markingID) => {
                            operate(state.markingsMap[markingID], selection, operation);
                        })
                    }
                    else {
                        console.log("This view does not affect any marking")
                    }
                }
            },
            hover(state, payload) {
                state.hovered = payload.hovered
            },
            popDataStack(state, payload) {
                payload.data = state.dataStack.pop();
            },
            pushDataStack(state, payload) {
                //TODO put a limit on the depth of the stack
                state.dataStack.push(payload.data);
            },

            setSetMetadata(state, payload) 
            {
                let ID = payload.setID;
                let metadata = state.setsMetadataMap[ID]

                let comment = metadata.comment;
                let name = metadata.name;
                if ((payload.hasOwnProperty("comment"))) 
                {
                    comment = payload.comment;
                }
                if ((payload.hasOwnProperty("name"))) 
                {
                    name = payload.name;
                }
                state.setsMetadataMap[ID] = {name:name, comment:comment};
            },
            addSet(state, payload) {
                state.setsCounter += 1
                let ID = 'Set #'+state.setsCounter;//generateID();

                state.setsIDs.push(ID)
                state.setsMap[ID] = payload.members;

                state.setsMetadataMap[ID] = {name: ID, comment:"Comment Here"};        
            },
            removeSet(state, payload) {
                let ID = payload.setID;

                for (var i = 0; i < state.setsIDs.length; i++) {
                    if (state.setsIDs[i] === ID) {
                        state.setsIDs.splice(i, 1);
                    }
                }             
                delete state.setsMap[ID]
                delete state.setsMetadataMap[ID]
            },
            updateCtrlKey(state, payload)
            {
                state.isCtrlKey = payload.value;
            },
            updateShiftKey(state, payload)
            {
                state.isShiftKey = payload.value;
            },
            updateAltKey(state, payload)
            {
                state.isAltKey = payload.value;
            },
        },
        actions: {
            toggleInspectionMode(context, payload)
            {
                context.commit('toggleInspectionMode');
            },
            toggleEditingMode(context, payload)
            {
                context.commit('toggleEditingMode');
            },
            updateCtrlKey(context, payload)
            {
                context.commit('updateCtrlKey', payload);
            },
            updateShiftKey(context, payload)
            {
                context.commit('updateShiftKey', payload);
            },
            updateAltKey(context, payload)
            {
                context.commit('updateAltKey', payload);
            },
            createDefaultView(context, payload) // {commit}, payload
            {
                let view = payload.view;
                let vueComponent = payload.vueComponent;
                let markingID = context.state.defaultMarkingID;
                console.log("createDefaultView", payload)
                context.commit('addMarking', { "view": view, "markingID": markingID });
                context.commit('addView', { "view": view, "markingID": markingID });
                context.commit('createView', { "view": view, "vueComponent": vueComponent });
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
                let args = { markingID: "" };
                context.commit('createMarkingEntry', args)
                let newMarkingID = args.markingID;

                context.commit('addMarking', { "view": master_view, "markingID": newMarkingID });
                context.commit('addView', { "view": details_view, "markingID": newMarkingID });
            },
            zoomToSelection(context) {
                let dataMapSubset = context.getters.selectedInMarking(context.state.defaultMarkingID);
                let selection = map2Data(dataMapSubset)

                context.commit('pushDataStack', { data: context.state.data });
                context.commit('setData', { newData: selection });
            },
            excludeSelection(context) {
                let toFilter = context.getters.selectedInMarking(context.state.defaultMarkingID);
                let selection = map2Data(filterData(context.getters.dataMap, toFilter))
                context.commit('pushDataStack', { data: context.state.data });
                context.commit('setData', { newData: selection });
            },
            invertSelection(context) {
                console.log(context.getters.unselectedInMarking(context.state.defaultMarkingID))
                console.log("2", context.getters.data)
                console.log("3", context.getters.dataMap)
                let inverted = Object.keys(context.getters.unselectedInMarking(context.state.defaultMarkingID))
                context.commit("update", {
                    markingID: context.state.defaultMarkingID,
                    selection: inverted,
                    operation: operations.REPLACE
                });
            },
            resetData(context) {
                //context.commit('resetMarking', { "markingID": context.state.defaultMarkingID });
                context.commit('setData', { newData: context.state.rawData });
            },
            resetAllMarkings(context) {
                for (var markingID in context.state.markingsMap) {
                    context.commit('resetMarking', { "markingID": markingID });
                }
            },
            undoDataTransformation(context) {
                if (context.state.dataStack.length > 0) {
                    let args = { data: "" };
                    context.commit('popDataStack', args)
                    context.commit('setData', { newData: args.data });
                }
            },
            createSet(context) {
                let members = Object.keys(context.getters.selectedInMarking(context.state.defaultMarkingID))
                context.commit('addSet', { members: members })
            },
            restoreSet(context, payload) 
            {
                context.dispatch("resetData");
                context.commit("update",
                {
                    markingID: context.state.defaultMarkingID,
                    selection: context.state.setsMap[payload.setID],
                    operation: payload.operation
                });
            },


        },
        modules: {},
        getters: {
            getEditingMode: state => state.isEditingMode,
            getMarking: state => view => { return findMarkingAffectingView(state.markingsMap, state.markingID2views, view) },
            data: state => { return state.data },
            dataMap: state => { return createDataMap(state.data); },
            selectedInMarking: (state, getters) => markingID => {
                return getSelectedInMarking(state.markingsMap[markingID], getters.dataMap)
            },
            unselectedInMarking: (state, getters) => markingID => {
                return getUnselectedInMarking(state.markingsMap[markingID], getters.dataMap)
            },
            selectedInView: (state, getters) => view => {
                let marking = findMarkingAffectingView(state.markingsMap, state.markingID2views, view);
                return getSelectedInMarking(marking, getters.dataMap)
            },
            unselectedInView: (state, getters) => view => {
                let marking = findMarkingAffectingView(state.markingsMap, state.markingID2views, view);
                return getUnselectedInMarking(marking, getters.dataMap)
            },
            selectedDataInView: (state, getters) => view => {
                var selectedInMarking = getters.selectedInView(view);
                var result = map2Data(selectedInMarking)
                return result;
            },
            markingsDefaultGetter: state => { return state.markingsMap[state.defaultMarkingID] },
            markingsMapGetter: (state) => (markingID) => { return state.markingsMap[markingID] },
            getHovered: (state) => {return state.hovered;},
            isHoveringEnabled: (state) => state.isCtrlKey || state.isInspectionMode
        }

    });



}


function preprocess(data) {
    return data;
}

function prepare_map(data) {
    let map = {}
    data.forEach(element => {
        map[element._id] = 0
    })
    //let mask = new Array(len).fill(0);
    return map
}

function createDataMap(data) {
    let map = {}
    data.forEach(element => {
        map[element._id] = element;
    })
    return map
}

function reset_map(map) {
    for (var key in map) {
        map[key] = 0
    }
    return map
}
function getSelection(marking, selection) {
    var selected = {};
    for (var alt of selection) {
        selected[alt] = marking[alt]
    }
    return selected;
}

function getSelectedInMarking(marking, dataMap) {
    var selected = {};
    for (var alt in marking) {
        if (marking[alt] == 1) {
            if (dataMap[alt]) // To make sure only the data elements being used will have their marking returned
            {
                selected[alt] = dataMap[alt];
            }

        }
    }
    return selected;
}
function getUnselectedInMarking(marking, dataMap) {
    var unselected = {};
    for (var alt in marking) {
        if (marking[alt] == 0) {
            if (dataMap[alt]) // To make sure only the data elements being used will have their marking returned
            {
                unselected[alt] = dataMap[alt];
            }

        }
    }
    return unselected;
}
function allTheSame(selected) {
    var atleastOneIsDifferent = false;
    var tmp = -1;
    var old = -1;
    for (var alt in selected) {
        if (tmp == -1) {
            old = selected[alt];
        }
        else {
            old = tmp;
        }
        tmp = selected[alt]

        if (old != tmp) {
            atleastOneIsDifferent = true;
            break;
        }
    }
    return !atleastOneIsDifferent;
}
function flip(value) {
    return value == 1 ? 0 : 1
}

function operate(marking, selection, operation) {
    //TODO
    if (operation == operations.REPLACE) {
        for (var alt in marking) {
            marking[alt] = 0;
        }
        for (var alt of selection) {
            marking[alt] = 1;
        }
    }
    else if (operation == operations.ADD) {
        for (var alt of selection) {
            marking[alt] = 1;
        }
    }
    else if (operation == operations.TOGGLE) {
        let selected = getSelection(marking, selection)
        let areAllTheSame = allTheSame(selected)
        if (areAllTheSame) {
            for (var alt of selection) {
                marking[alt] = flip(marking[alt]);
            }
        }
        else {
            for (var alt of selection) {
                marking[alt] = 1;
            }
        }
    }
    else if (operation == operations.INTERSECTION)
    {
        let selected = getSelection(marking, selection)
        console.log(selected, selection, marking)
        for (var alt in marking) 
        {
            
            if(marking[alt] == 1 && selected[alt] == 1)
            {
                marking[alt] = 1;
                console.log(alt)
            }
            else
            {
                marking[alt] = 0;
            }
                    
        }
    }
    else {
        console.error('Unknown Selection Operation')
    }
}
function createMarkingObject(data) {
    let marking = {}
    for (var alt of data) {
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
function findMarkingAffectingView(markingsMap, markingID2views, view) {
    return markingsMap[findMarkingIDForView(markingID2views, view)]
}

/**
 * Finds markingID of the marking that affects the passed view
 * @param {*} markingID2views 
 * @param {*} view 
 */
function findMarkingIDForView(markingID2views, view) {
    let targetMarkingID = null;
    markingID2views.forEach((viewsSet, markingID) => {
        if (viewsSet.has(view)) {
            targetMarkingID = markingID;
        }
    })
    if (targetMarkingID == null) {
        console.error("No Marking affecting this view was found")
        return null;
    }
    else {
        return targetMarkingID;
    }
}
/**
 * 
 * @param {*} view 
 * @param {*} view2markingIDs 
 * @param {*} markingID2views 
 */
function disconnectViewFromMarkings(view, view2markingIDs, markingID2views, markingsMap) {
    view2markingIDs.delete(view);

    markingID2views.forEach((viewsSet, markingID) => {
        if (viewsSet.has(view)) {
            viewsSet.delete(view)
        }

    })
    trimEmptyMarkings(markingID2views, view2markingIDs, markingsMap)
}

function trimEmptyMarkings(markingID2views, view2markingIDs, markingsMap) {
    let emptyMarkings = []
    markingID2views.forEach((viewsSet, markingID) => {
        if (viewsSet.size == 0) {
            emptyMarkings.push(markingID)
        }
    })

    emptyMarkings.forEach(markingID => {
        delete markingsMap[markingID]
        markingID2views.delete(markingID)
        view2markingIDs.forEach((markingsSet, view) => {
            if (markingsSet.has(markingID)) {
                markingsSet.delete(markingID)
            }
        })
    })
}

function map2Data(map) {
    var result = []
    for (var key in map) {
        if (map[key])
            result.push(map[key]);
    }
    return result;
}
function filterData(dataMap, toFilter) {
    var dataMapCopy = JSON.parse(JSON.stringify(dataMap));
    for (var altID in toFilter) {
        delete dataMapCopy[altID];
    }
    return dataMapCopy;
}


function getNumeric(typesMap) {
    var numeric = []
    for (var dim in typesMap) {
        if (typesMap[dim] == "Float" || typesMap[dim] == "Number")
        {
            numeric.push(dim);
        }
    }
    console.log(typesMap, numeric)
    return numeric;
}

//ref: https://stackoverflow.com/questions/41572974/how-to-load-all-server-side-data-on-initial-vue-js-vue-router-load
export default builder;


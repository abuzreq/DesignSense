import Vue from "vue";
import Vuex from "vuex";
import views from "@/components/constants.js";
import { operations } from "@/components/operations.js";
import { generateID } from "@/components/utils.js";
import * as d3 from "d3";
import * as d3Chromatic from 'd3-scale-chromatic';

Vue.use(Vuex);

function builder(new_data, dataTypesMap, new_layouts, new_similarity_map) {
    return new Vuex.Store({
        state: {
            currentSelectionOperation: operations.REPLACE,
            layouts: new_layouts,
            defaultMarkingID: generateID(), //"_lqpkb07gn"
            rawData: new_data,
            data: new_data,
            dataStack: [],
            view2markingIDs: new Map(),
            markingID2views: new Map(),
            markingsMap: {}, // markingID -> marking object. Marking object is {altID -> highlightState}
            previousDefaultMarkingsMap: {},
            viewsMap: {},

            setsIDs: [],
            setsMetadataMap: {},
            setsMap: {},
            numericDimensions: getNumericDimensions(dataTypesMap),
            nonNumericDimensions: getNonNumericDimensions(dataTypesMap),
            allDimensions: Object.keys(dataTypesMap),
            setsCounter: 0,

            similarity_map: new_similarity_map,

            isEditingMode: false,

            hovered: null,

            isCtrlKey: false,
            isShiftKey: false,
            isAltKey: false,
            isInspectionMode: false,

            colorRange: d3Chromatic.schemeTableau10,
            colorColumn: "year",
        },
        getters: {
            colorScale: state => d3.scaleOrdinal(state.colorRange),
            colorize: (state, getters) => dataItem => {
                return getters.colorScale(dataItem[state.colorColumn])
            },
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
            getHovered: (state) => { return state.hovered; },
            isHoveringEnabled: (state) => state.isInspectionMode,
        },
        mutations:
        {
            /* setSimilarityMap(state, payload)
             {   
                 state.similarity_map = payload.similarity_map;
             },  */

            changeSelectionOperation(state, newOperation) {
                state.currentSelectionOperation = newOperation;
            },
            changeColorColumn(state, newColorColumn) {
                state.colorColumn = newColorColumn;
            },

            changeColorRange(state, newColorRange) {
                state.colorRange = newColorRange;
            },
            toggleEditingMode(state, payload) {
                if (payload) {
                    state.isEditingMode = payload.value
                }
                else {
                    state.isEditingMode = !state.isEditingMode;
                }
            },
            toggleInspectionMode(state, payload) {
                if (payload) {
                    state.isInspectionMode = payload.value
                }
                else {
                    state.isInspectionMode = !state.isInspectionMode;
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
            reverseUpdate(state) {

                if (state.previousDefaultMarkingsMap !== {}) {
                    var selection = getSelectedIDs(state.previousDefaultMarkingsMap);
                    operate(state.markingsMap[state.defaultMarkingID], selection, operations.REPLACE);
                }

            },
            update(state, payload) {
                let selection = payload.selection;
                let operation = payload.operation;
                if ((payload.hasOwnProperty("markingID"))) {
                    if (payload.markingID === state.defaultMarkingID) {
                        state.previousDefaultMarkingsMap = Object.assign(state.previousDefaultMarkingsMap, state.markingsMap[markingID]);
                    }
                    operate(state.markingsMap[payload.markingID], selection, operation);
                }
                else {
                    let view = payload.view;

                    if (state.view2markingIDs.has(view)) {
                        state.view2markingIDs.get(view).forEach((markingID) => {
                            if (markingID === state.defaultMarkingID) {
                                state.previousDefaultMarkingsMap = Object.assign(state.previousDefaultMarkingsMap, state.markingsMap[markingID]);
                            }
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

            setSetMetadata(state, payload) {
                let ID = payload.setID;
                let metadata = state.setsMetadataMap[ID]

                let comment = metadata.comment;
                let name = metadata.name;
                if ((payload.hasOwnProperty("comment"))) {
                    comment = payload.comment;
                }
                if ((payload.hasOwnProperty("name"))) {
                    name = payload.name;
                }
                state.setsMetadataMap[ID] = { name: name, comment: comment };
            },
            addSet(state, payload) {

                let ID = "";
                if (payload && payload.setName) {
                    ID = payload.setName;
                }
                else {
                    state.setsCounter += 1
                    ID = 'Set #' + state.setsCounter;//generateID();
                }
                state.setsIDs.push(ID)
                state.setsMap[ID] = payload.members;
                let comment = payload && payload.comment ? payload.comment : "Comment Here"
                state.setsMetadataMap[ID] = { name: ID, comment: comment };
                console.log(state.setsMetadataMap)
            },
            updateSet(state, payload) {
                let ID = payload.setID;

                let setMarking = setToMarking(state.setsMap[ID], state.rawData)
                console.log(ID, state.setsMap[ID], setMarking)
                operate(setMarking, payload.members, payload.operation);
                console.log(getSelectedIDs(setMarking))
                state.setsMap[ID] = getSelectedIDs(setMarking); //Object.keys(setMarking)


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
            updateCtrlKey(state, payload) {
                state.isCtrlKey = payload.value;
            },
            updateShiftKey(state, payload) {
                state.isShiftKey = payload.value;
            },
            updateAltKey(state, payload) {
                state.isAltKey = payload.value;
            },
            updateData(state, payload) {
                state.rawData = payload.data;
                state.data = payload.data;

                state.dataTypesMap = payload.dataTypesMap;
                state.numericDimensions = getNumericDimensions(payload.dataTypesMap),
                    state.nonNumericDimensions = getNonNumericDimensions(payload.dataTypesMap),
                    state.allDimensions = Object.keys(payload.dataTypesMap)
            }
        },
        actions: {
            update(context, payload) {
                context.commit("update", payload);
            },
            reverseUpdate(context) {
                context.commit("reverseUpdate");
            },
            clearInspection(context) {
                context.commit("hover", { hovered: null });
                context.commit('toggleInspectionMode', { value: false });
            },
            toggleInspectionMode(context, payload) {
                context.commit('toggleInspectionMode');
            },
            toggleEditingMode(context, payload) {
                context.commit('toggleEditingMode');
            },
            updateCtrlKey(context, payload) {
                context.commit('updateCtrlKey', payload);
            },
            updateShiftKey(context, payload) {
                context.commit('updateShiftKey', payload);
            },
            updateAltKey(context, payload) {
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
                if (selection.length > 0) {
                    context.commit('pushDataStack', { data: context.state.data });
                    context.commit('setData', { newData: selection });
                }
            },
            excludeSelection(context) {
                let toFilter = context.getters.selectedInMarking(context.state.defaultMarkingID);
                let selection = map2Data(filterData(context.getters.dataMap, toFilter))
                context.commit('pushDataStack', { data: context.state.data });
                context.commit('setData', { newData: selection });
            },
            invertSelection(context) {
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
            createSet(context, payload) {
                let members = [];
                if (payload && payload.members) {
                    members = payload.members
                }
                else {
                    members = Object.keys(context.getters.selectedInMarking(context.state.defaultMarkingID))
                }
                console.log("members", members)
                context.commit('addSet', { members: members, setName: (payload ? payload.setName : null), comment: (payload ? payload.comment : null) })
            },
            restoreSet(context, payload) {
                context.dispatch("resetData"); //Ahmed: in case restoring is called when portions of the data is being zoomed on. Altneratives includes adding only the content of set not present
                context.commit("update",
                    {
                        markingID: context.state.defaultMarkingID,
                        selection: context.state.setsMap[payload.setID],
                        operation: payload.operation
                    });
            },
            updateSet(context, payload) {
                let members = Object.keys(context.getters.selectedInMarking(context.state.defaultMarkingID))
                context.commit("updateSet",
                    {
                        setID: payload.setID,
                        members: members,
                        operation: payload.operation
                    });
            },

        },
        modules: {},


    });
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

function getSelectedIDs(marking) {
    var selectedIDs = [];
    for (var alt in marking) {
        if (marking[alt] == 1) {
            selectedIDs.push(alt)
        }
    }
    return selectedIDs;
}

function setToMarking(IDs, data) {
    var marking = {};
    data.forEach(element => {
        marking[element._id] = 0;
    })
    for (var alt of IDs) {
        marking[alt] = 1;
    }
    return marking;
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
    else if (operation == operations.INTERSECT) {
        let selected = getSelection(marking, selection)
        for (var alt in marking) {

            if (marking[alt] == 1 && selected[alt] == 1) {
                marking[alt] = 1;
            }
            else {
                marking[alt] = 0;
            }

        }
    }
    else if (operation == operations.SUBTRACT) {
        for (var alt of selection) {
            marking[alt] = 0;
        }
    }
    else {
        console.error('Unknown Selection Operation')
    }
    return marking;
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
function getNonNumericDimensions(typesMap) {
    var nonnumeric = []
    for (var dim in typesMap) {
        if (typesMap[dim] != "Float" && typesMap[dim] != "Number") {
            nonnumeric.push(dim);
        }
    }
    return nonnumeric;
}

function getNumericDimensions(typesMap) {
    var numeric = []
    for (var dim in typesMap) {
        if (typesMap[dim] == "Float" || typesMap[dim] == "Number") {
            numeric.push(dim);
        }
    }
    return numeric;
}


//ref: https://stackoverflow.com/questions/41572974/how-to-load-all-server-side-data-on-initial-vue-js-vue-router-load
export default builder;


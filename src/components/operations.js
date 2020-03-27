const operations = {
    REPLACE: "REPLACE",
    ADD: "ADD",
    TOGGLE: "TOGGLE",
    INTERSECTION: "INTERSECTION",
};

function getOperationFromEvent(event)
{
    let operation = operations.REPLACE;
    if(event.altKey && event.shiftKey)
    {
        operation = operations.INTERSECTION;
    }
    else if(event.altKey)
    {
        operation = operations.TOGGLE;
    }
    else if(event.shiftKey)
    {
        operation = operations.ADD;
    }
    else if(event.ctrlKey)
    {
        //console.log("control")
        //operation = operations.ADD;
    }
    else
    {
        operation = operations.REPLACE;
    }

    return operation;
}
exports.operations = operations;
exports.getOperationFromEvent = getOperationFromEvent;
//export default {operations, getOperationFromEvent};
const operations = {
    REPLACE: "Replace",
    ADD: "Add",
    TOGGLE: "Toggle",
    INTERSECTION: "Intersect",
};
function getOperation(args)
{
    let operation = operations.REPLACE;
    if(args.altKey && args.shiftKey)
    {
        operation = operations.TOGGLE;
    }
    else if(args.altKey)
    {
        operation = operations.ADD ;
    }
    else if(args.shiftKey)
    {
        operation = operations.INTERSECTION;
    }
    else if(args.ctrlKey)
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
function getOperationFromEvent(event)
{
    return getOperation({altKey:event.altKey, shiftKey:event.shiftKey, ctrlKey:event.ctrlKey})
}
exports.operations = operations;
exports.getOperationFromEvent = getOperationFromEvent;
exports.getOperation = getOperation;

//export default {operations, getOperationFromEvent};
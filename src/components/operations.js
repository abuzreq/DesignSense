const operations = {
    REPLACE: "Replace",
    ADD: "Add",
    SUBTRACT: "Subtract",
    TOGGLE: "Toggle",   
    INTERSECTION: "Intersect",
};
const operations_icons = {
    REPLACE: "Replace",
    ADD: "Add",
    SUBTRACT: "Subtract",
    TOGGLE: "Toggle",   
    INTERSECTION: "Intersect",
};


function getOperationFromKey(index)
{
    let allOperations =  Object.values(operations);
    console.log(operations)
    if(index >= allOperations.length || index < 0)
    {
        return;
    }
    return allOperations[index];
}

exports.operations = operations;
exports.getOperationFromKey = getOperationFromKey;

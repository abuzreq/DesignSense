const operations = {
    REPLACE: "Replace",
    ADD: "Add",
    SUBTRACT: "Subtract",
    TOGGLE: "Toggle",   
    INTERSECT: "Intersect",
};
const operations_icons = {
    REPLACE: "Replace",
    ADD: "Add",
    SUBTRACT: "Subtract",
    TOGGLE: "Toggle",   
    INTERSECT: "Intersect",
};


function getOperationFromKey(index)
{
    let allOperations =  Object.values(operations);
    if(index >= allOperations.length || index < 0)
    {
        return;
    }
    return allOperations[index];
}

exports.operations = operations;
exports.getOperationFromKey = getOperationFromKey;

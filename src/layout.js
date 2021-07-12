
var grid;

if (screen.width < 1600) {
    grid = [{ type: "ParallelCoordinatesPlot", x: 16, y: 0, w: 14, h: 7 },
    { type: "ScatterPlot", x: 21, y: 7, w: 9, h: 9 },
    { type: "Grid", x: 4, y: 0, w: 12, h: 16 },
    { type: "Sets", x: 0, y: 0, w: 4, h: 16 },
    { type: "Clusters", x: 16, y: 7, w: 5, h: 9 }]
}
else {
    grid = [
        { type: "ParallelCoordinatesPlot", x: 22, y: 0, w: 16, h: 9 },
        { type: "ScatterPlot", x: 28, y: 9, w: 10, h: 9 },
        //   {type:"ScatterPlot", x: 12, y: 9, w: 12, h: 9},
        //   {type:"ScatterPlot", x: 12, y: 9, w: 12, h: 9},

        // {type:"SPLOM", x: 38, y: 0, w: 16, h: 18},
        { type: "Grid", x: 6, y: 0, w: 16, h: 18 },
        { type: "Sets", x: 0, y: 0, w: 6, h: 18 },
        { type: "Clusters", x: 22, y: 9, w: 6, h: 9 }
    ]
}

export default grid




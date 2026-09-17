/**
 * The label space for the assistant evaluation.
 *
 * Gold labels are structured commands, not strings, so an approach can be
 * scored on intent and on each argument separately. That is what tells you
 * *where* it fails: picking the wrong tool is a different problem from
 * resolving "the cheapest" to the wrong column.
 *
 * This file is the contract between the dataset and any parser under test.
 * Once src/assistant/commands.js exists, COMMANDS should be derived from it
 * rather than restated here, so the two cannot drift.
 */

/*
 * Argument types
 * --------------
 * dim        a column name, exactly as it appears in the CSV header
 * op         gte | lte | between | eq | ne
 *            `compileFilters` in src/store/filters.js tests with >= and <=
 *            only, so strict inequality is not part of the label space:
 *            "above 50" and "at least 50" both map to gte.
 * direction  max | min   (or top | bottom for percentiles)
 * item       an item reference, see ITEM_REFS below
 * set        a set name or "#N" index as the user said it
 */

export const ITEM_REFS = {
  id: ["id"], // "option 7074727928"
  ordinal: ["n"], // "the third one"
  extreme: ["dim", "direction"], // "the cheapest one"
  inspected: [], // "this one", when something is inspected
  text: ["query"], // "the one with the curved roof"
};

/** command id -> { required, optional } argument names. */
export const COMMANDS = {
  // ---- narrowing the collection -----------------------------------------
  "filter.range": { required: ["dim", "op"], optional: ["value", "range", "clauses"] },
  "filter.topk": { required: ["dim", "k", "direction"], optional: [] },
  "filter.percentile": { required: ["dim", "percent", "direction"], optional: [] },
  "filter.categorical": { required: ["dim", "values", "op"], optional: [] },
  "filter.clear": { required: [], optional: ["dim"] },
  "scope.zoom": { required: [], optional: [] },
  "scope.exclude": { required: [], optional: [] },
  "scope.reset": { required: [], optional: [] },
  "scope.out": { required: [], optional: [] },
  "select.invert": { required: [], optional: [] },
  "select.all": { required: [], optional: [] },

  // ---- answering, without changing anything -----------------------------
  "ask.count": { required: [], optional: ["where"] },
  "ask.stats": { required: ["dim", "stat"], optional: ["scope"] },
  "ask.extreme": { required: ["dim", "direction"], optional: ["n"] },
  "ask.compare_selection": { required: [], optional: [] },
  "ask.correlation": { required: [], optional: ["dims"] },
  "ask.explain_exclusion": { required: ["item"], optional: [] },
  "ask.compare_sets": { required: ["a", "b"], optional: [] },
  "ask.capabilities": { required: [], optional: ["topic"] },

  // ---- analysis ----------------------------------------------------------
  "analysis.pareto": { required: ["dims", "directions"], optional: [] },
  "analysis.cluster": { required: [], optional: ["k", "dims"] },
  "analysis.similar": { required: ["item"], optional: ["n"] },
  "analysis.representatives": { required: ["n"], optional: [] },

  // ---- the workspace -----------------------------------------------------
  "view.axes": { required: [], optional: ["x", "y"] },
  "view.sort": { required: ["dim"], optional: ["desc"] },
  "view.color": { required: ["dim"], optional: [] },
  "view.open": { required: ["view"], optional: [] },
  "view.close": { required: ["view"], optional: [] },
  "mode.set": { required: ["mode"], optional: [] },

  // ---- sets --------------------------------------------------------------
  "set.create": { required: [], optional: ["name"] },
  "set.restore": { required: ["set"], optional: ["operation"] },
  "set.update": { required: ["set", "operation"], optional: [] },
  "set.delete": { required: ["set"], optional: [] },
  "set.clear": { required: [], optional: [] },

  // ---- session -----------------------------------------------------------
  "history.undo": { required: [], optional: [] },
  "history.redo": { required: [], optional: [] },
  "inspect.item": { required: ["item"], optional: [] },
  "inspect.clear": { required: [], optional: [] },
  "export.csv": { required: [], optional: [] },

  // ---- more than one thing in one utterance ------------------------------
  // args.steps is a list of {command, args}; order is significant.
  sequence: { required: ["steps"], optional: [] },

  // ---- the two answers that are not commands -----------------------------
  // Asking beats guessing: a wrong column silently applied is the one failure
  // mode that costs trust.
  clarify: { required: ["slot", "candidates"], optional: [] },
  // reason: out_of_scope | unsupported | no_such_dimension | needs_data
  abstain: { required: ["reason"], optional: [] },
};

/**
 * Real headers from the datasets shipped in LoadDataModal.vue. Entity
 * resolution is scored against these, so a gold `dim` that is not listed here
 * is a bug in the dataset rather than a hard case.
 */
export const DATASETS = {
  used_cars: [
    "id", "url", "region", "region_url", "price", "year", "manufacturer",
    "model", "condition", "cylinders", "fuel", "odometer", "title_status",
    "transmission", "drive", "size", "type", "paint_color", "image_url",
    "description", "state", "lat", "long", "img",
  ],
  massing: [
    "in:ZoneRed Area", "in:ZoneGreen Area", "in:ZoneGrey Area", "in:ZoneT Area",
    "Total Area", "in:ZoneRed Number of blocks", "in:ZoneGreen Number of blocks",
    "in:ZoneGrey Number of blocks", "in:ZoneT Number of blocks",
    "in:ZoneRed total floor number", "in:ZoneGreen total floor number",
    "in:ZoneGrey total floor number", "out:Facade area", "out:FAR",
    "out:Parking Area", "out:Glazing %", "out:Timber structure use",
    "out:A/V Ratio(%)", "out:Cost", "out:sDa(%)", "out:Total Cooling (kwh/m2)",
    "img",
  ],
  solar: [
    "in:Layer ", "out:Sunshine rs", "out:SVF", "out:North_Solar",
    "out:East_Solar", "out:NE_Solar", "out:SE_Solar", "out:South_Solar",
    "out:SW_Solar", "out:West_Solar", "out:NW_Solar", "out:Roof_Solar",
    "out:A/V ratio", "img", "threeD",
  ],
  facade: [
    "in:Fillet", "in:Width", "in:form variable", "in:Fillet Base",
    "out:Floor Area Small", "out:Floor Area Large", "out:Floor Area Deviation",
    "out:Floor Area", "out: FAR", "out:Facade Area", "out:Num Panels",
    "out:Percent Planar", "out:Facade Cost", "out:Avg Solar Rad. (kWh/m2)",
    "img",
  ],
  rezoning: [
    "in:Iteration", "out:Sunshine_hrs", "out:SVF", "out:Horizontal_Solar",
    "out:Roof_Solar", "out:A/V_ratio", "out:Isovist_GP", "out:%Surface_View",
    "out:FSR", "out:Site_Cvr%", "out:Max_H", "img", "threeD",
  ],
  windows: [
    "in:Depth [ft]", "in:Height [ft]", "in:Orientation", "in:WWR [%]",
    "in:SHD", "out:Cooling[kWh]", "out:Heating[kWh]", "out:Lighting[kWh]",
    "out:EffDepth[m]", "out:DA [%]", "out:UDI [%]", "out:CDA [%]",
    "out:SDA [Area%]", "img", "threeD",
  ],
};

/**
 * How hard the column mention is, which is the stratum that matters most:
 * entity errors dominate, and they are dominated in turn by abbreviations
 * that no off-the-shelf embedding model has a useful vector for.
 */
export const ENTITY_KINDS = [
  "none", // the command names no column
  "exact", // "price", "in:Fillet"
  "morphological", // "prices", "taller", plural or comparative of the name
  "tokenized", // "surface area" -> out:surfaceArea, "floor area" -> out:Floor Area
  "synonym", // "mileage" -> odometer, "how big" -> out:volume
  "abbreviation", // "sky view factor" -> out:SVF, "site coverage" -> out:Site_Cvr%
  "typo", // "millage", "daylihgt"
  "ambiguous", // matches two or more columns; gold is usually clarify
  "absent", // named column does not exist; gold is abstain
];

export const TIERS = ["easy", "medium", "hard"];

/** Every field an item must carry. */
export const ITEM_FIELDS = [
  "id", "tier", "dataset", "utterance", "gold", "strata", "source",
];

/**
 * A few real values of the categorical columns, so an approach can recognise
 * "only toyotas" without the column being named. In the app this comes free
 * from the loaded rows; here it is listed so the harness stays offline.
 */
export const DATASET_VALUES = {
  used_cars: {
    manufacturer: ["toyota", "ford", "chevrolet", "honda", "nissan", "bmw", "jeep", "ram", "gmc", "dodge"],
    fuel: ["gas", "diesel", "hybrid", "electric", "other"],
    transmission: ["automatic", "manual", "other"],
    condition: ["excellent", "good", "fair", "like new", "salvage", "new"],
    title_status: ["clean", "rebuilt", "salvage", "lien", "missing"],
    drive: ["4wd", "fwd", "rwd"],
    type: ["sedan", "suv", "truck", "coupe", "wagon", "van", "convertible", "pickup", "hatchback"],
    paint_color: ["white", "black", "silver", "blue", "red", "grey", "green", "brown", "custom"],
  },
  massing: {}, solar: {}, facade: {}, rezoning: {}, windows: {},
};

import Vue from "vue";
import { MAX, MIN, WEIGHTED, columnKind, fileGoal } from "@/columns.js";
import { RATING_DIMENSION } from "@/ratings.js";
import { PARETO_FILTER_KEY, PARETO_LABEL, tradeOffs } from "@/analysis/pareto.js";
import { isMissingFor } from "./dimensions.js";
import { applyFilters, narrowingFilters } from "./filters.js";

/*
 * Which way is better for each dimension: "max" (higher is better) or "min"
 * (lower is better). A dimension's goal is, in order:
 *   - the user's choice in the Dimensions dialog, saved per dataset, where
 *     "none" clears a goal the file declared;
 *   - the file's, from a "min:" or "max:" column prefix (see columns.js);
 *   - its own: weighted dimensions and the rating are built so that higher
 *     is better.
 * Nothing else is assumed; a dimension with none of these has no goal.
 *
 * Choices live in localStorage under the dataset's key (see datasetKey in
 * customDimensions.js), apart from the saved work, which can be cleared on
 * its own:
 *   { version: 1, goals: { dim: "max" | "min" | "none" } }
 */

export const GOALS_PREFIX = "designsense-goals-v1:";
const GOALS_VERSION = 1;
export const NO_GOAL = "none";
const CHOICES = [MAX, MIN, NO_GOAL];

function browserStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch (e) {
    return null;
  }
}

/** The stored choices, or {} when the text is missing, malformed or from another version. */
export function parseGoals(text) {
  if (typeof text !== "string" || text === "") return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {};
  }
  if (!parsed || parsed.version !== GOALS_VERSION || !parsed.goals) return {};
  let choices = {};
  Object.keys(parsed.goals).forEach((dim) => {
    if (CHOICES.indexOf(parsed.goals[dim]) !== -1) choices[dim] = parsed.goals[dim];
  });
  return choices;
}

/** A goal the dimension has without anyone choosing it: the file's, or its own. */
function givenGoal(dim) {
  let declared = fileGoal(dim);
  if (declared) return declared;
  if (columnKind(dim) === WEIGHTED || dim === RATING_DIMENSION) return MAX;
  return null;
}

/** A dimension's goal under `choices`: "max", "min" or null. */
export function goalFor(dim, choices) {
  let choice = choices && choices[dim];
  if (choice === MAX || choice === MIN) return choice;
  if (choice === NO_GOAL) return null;
  return givenGoal(dim);
}

/**
 * Where a dimension's goal comes from: "user", "file", "fixed" (weighted
 * dimensions and the rating, which can't be changed), or null for none.
 */
export function goalSourceFor(dim, choices) {
  if (columnKind(dim) === WEIGHTED || dim === RATING_DIMENSION) return "fixed";
  let choice = choices && choices[dim];
  if (choice) return "user";
  return fileGoal(dim) ? "file" : null;
}

/** The store's goals; see the top of this file. */
export function createGoalsStore(options) {
  const storage = options && options.datasetKey ? browserStorage() : null;
  const key = storage ? GOALS_PREFIX + options.datasetKey : null;
  let saved = {};
  if (storage) {
    try {
      saved = parseGoals(storage.getItem(key));
    } catch (e) {
      saved = {};
    }
  }

  // Choices for columns the data no longer has are let go of here, so a
  // deleted custom dimension doesn't hand its goal to a new one of its name.
  function persist(state) {
    if (!storage) return;
    let goals = {};
    Object.keys(state.goalChoices).forEach((dim) => {
      if (state.allDimensions.indexOf(dim) !== -1) goals[dim] = state.goalChoices[dim];
    });
    try {
      if (Object.keys(goals).length === 0) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify({ version: GOALS_VERSION, goals: goals }));
    } catch (e) {
      /* They last until the page is reloaded. */
    }
  }

  return {
    state: {
      // { dim: "max" | "min" | "none" }: only what differs from the given goal.
      goalChoices: saved,
    },
    getters: {
      goalOf: (state) => (dim) => goalFor(dim, state.goalChoices),
      goalSource: (state) => (dim) => goalSourceFor(dim, state.goalChoices),
      /**
       * The numeric dimensions with a goal the user or the file set: what a
       * Pareto front over every goal, or a new weighted dimension, starts from.
       */
      goalDims: (state) =>
        state.numericDimensions.filter((dim) => {
          let source = goalSourceFor(dim, state.goalChoices);
          return (
            (source === "user" || source === "file") &&
            goalFor(dim, state.goalChoices) !== null
          );
        }),
      /**
       * The rows a front is found among: the current result, less a front
       * already kept, so asking again doesn't look only inside the last one.
       */
      tradeOffRows: (state) => {
        let narrowing = narrowingFilters(state.filters).filter(
          (filter) => filter.key !== PARETO_FILTER_KEY
        );
        if (narrowing.length === 0) return state.data;
        let ids = new Set(applyFilters(narrowing, state.data).map(String));
        return state.data.filter((row) => ids.has(String(row._id)));
      },
      /**
       * What the best trade-offs are judged by: `{ dims, directions, skipped }`,
       * every goal but those `skipped`, custom and weighted ones, since a
       * front kept as a filter would go out of date as their values change.
       * Fewer than two dims, and there is no trade-off to find.
       */
      tradeOffGoals: (state, getters) => {
        let dims = getters.goalDims.filter((dim) => !getters.isUnfilterable(dim));
        return {
          dims: dims,
          directions: dims.map((dim) => getters.goalOf(dim)),
          skipped: getters.goalDims.filter((dim) => getters.isUnfilterable(dim)),
        };
      },
      /** Changes whenever any dimension's goal does; views watch it to redraw. */
      goalSignature: (state) =>
        state.numericDimensions
          .map((dim) => {
            let goal = goalFor(dim, state.goalChoices);
            return goal ? dim + "=" + goal : "";
          })
          .filter(Boolean)
          .join("|"),
    },
    mutations: {
      /** `{ dim, choice }`: "max", "min", "none", or null to go back to the given goal. */
      setGoalChoice(state, payload) {
        if (payload.choice === null || payload.choice === undefined) {
          Vue.delete(state.goalChoices, payload.dim);
        } else {
          Vue.set(state.goalChoices, payload.dim, payload.choice);
        }
      },
    },
    actions: {
      /**
       * `{ dim, goal }` with goal "max", "min" or null for none. A choice that
       * matches what the dimension is given anyway isn't stored, so a goal
       * the file declares keeps following the file.
       */
      setGoal(context, payload) {
        let goal = payload.goal === MAX || payload.goal === MIN ? payload.goal : null;
        let given = givenGoal(payload.dim);
        let choice = goal === given ? null : goal || NO_GOAL;
        context.commit("setGoalChoice", { dim: payload.dim, choice: choice });
        persist(context.state);
      },
      /**
       * Keeps the best trade-offs over every goal as the "Best trade-offs"
       * filter: `{ fronts, leaveOut }`, how many fronts (see paretoFronts),
       * and ids of options not to compare, outliers say. Returns how many
       * were kept.
       */
      keepBestTradeOffs(context, payload) {
        let fronts = (payload && payload.fronts) || 2;
        let leaveOut = new Set(((payload && payload.leaveOut) || []).map(String));
        let goals = context.getters.tradeOffGoals;
        if (goals.dims.length < 2) return 0;
        let rows = context.getters.tradeOffRows.filter(
          (row) => !leaveOut.has(String(row._id))
        );
        let best = tradeOffs({
          rows: rows,
          dims: goals.dims,
          directions: goals.directions,
          fronts: fronts,
          isMissing: isMissingFor,
        });
        if (best.kept.length === 0) return 0;
        context.dispatch("applyMembersFilter", {
          key: PARETO_FILTER_KEY,
          label: PARETO_LABEL,
          ids: best.kept.map((row) => row._id),
        });
        return best.kept.length;
      },
    },
  };
}

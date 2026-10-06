/**
 * One reading per frame of a brush being dragged. Brush events come with
 * every move of the pointer, faster than frames are drawn, and each reading
 * is a filter commit that passes over the collection and redraws the views;
 * so `push(fn)` keeps only the latest `fn` and runs it on the next animation
 * frame. `cancel()` drops a pending one: at the drag's end, which commits on
 * its own, and when the view goes, so a frame never dispatches from a view
 * that is no longer there. One per chart; see ScatterplotView and
 * ParCoordsView.
 */
export function brushPreviewer() {
  let frame = null;
  let pending = null;
  return {
    push(fn) {
      pending = fn;
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        let run = pending;
        pending = null;
        if (run) run();
      });
    },
    cancel() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      pending = null;
    },
  };
}

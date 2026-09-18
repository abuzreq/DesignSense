import imageZoom from "vue-image-zoomer";

/*
 * vue-image-zoomer, with the window listener it leaks removed properly.
 *
 * Version 1.7.0 subscribes to window resizes in created() with a debounced
 * function it doesn't keep, and in destroyed() passes `this.resize()` -- the
 * result of calling resize -- to removeEventListener. So the listener was
 * never removed. Every zoomable image the inspector showed stayed subscribed,
 * kept running on every resize, and kept its component alive -- and through
 * it the whole app the component belonged to. Each dataset loaded left the
 * previous one in memory, rows, charts and all.
 *
 * The copy below replaces just those two hooks, keeping the function it adds
 * so that the same one comes off again. A copy is made before Vue has built a
 * constructor from the library's options, so nothing cached is carried over.
 */
const fixed = Object.assign({}, imageZoom, {
  created() {
    this.onWindowResize = this.debounce(() => this.resize(), 500);
    window.addEventListener("resize", this.onWindowResize);
  },
  destroyed() {
    window.removeEventListener("resize", this.onWindowResize);
  },
});
delete fixed._Ctor;

export default fixed;

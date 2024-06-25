<template>
  <div class="vue-drag-select" @mousedown="onMouseDown">
    <slot :selectedItems="selectedItems" />
    <div v-if="mouseDown" :class="selectedItems.length>0?'vue-drag-select-box':'vue-drag-select-box-empty'" :style="selectionBoxStyling"></div>
  </div>
</template>

<script>
//Adapted with minor changes from:
//https://github.com/JochenLutz/vue-drag-select

export default {
  name: "vue-drag-select",
  props: {
    selectableItems: {
      type: [Array, Function],
      required: false
    },
    scrollAccessor: null,
    selectorClass: '',
    disabled: false,
  },
  data() {
    return {
      mouseDown: false,
      changedItems: false,
      startPoint: null,
      endPoint: null,
      selectedItems: [],    
      scrollContainer: null
    };
  },
  computed: {
    selectionBox() {
      // Only set styling when necessary

      if (!this.mouseDown || !this.startPoint || !this.endPoint) return {};
      const clientRect = this.$el.getBoundingClientRect();
      const scroll = this.getScroll();
      // Calculate position and dimensions of the selection box
      const left =
        Math.min(this.startPoint.x, this.endPoint.x) -
        clientRect.left -
        scroll.x;
      const top =
        Math.min(this.startPoint.y, this.endPoint.y) -
        clientRect.top -
        scroll.y;
      const width = Math.abs(this.startPoint.x - this.endPoint.x);
      const height = Math.abs(this.startPoint.y - this.endPoint.y);
      // Return the styles to be applied

      return {
        left,
        top,
        width,
        height
      };
    },
    selectionBoxStyling() {
      // Only set styling when necessary
      if (!this.mouseDown || !this.startPoint || !this.endPoint) return {};
      const { left, top, width, height } = this.selectionBox;
      // Return the styles to be applied
      return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`
      };
    },
    items() {
      const t = typeof this.selectableItems;

      if (t == "function") {
        return this.selectableItems();
      } else if (Array.isArray(this.selectableItems)) {
        return this.selectableItems;
      } else if (t == "undefined") {
        return this.$children.length ? this.$children : this.$el.children;
      } else {
        throw `unsupported type '${t}' for property 'selectableItems'`;
      }
    }
  },
  watch: {
    disabled(val) {
      if(!val)
      {
        this.scrollContainer.classList.add("scroll-container")
      }
      else 
      {
        this.scrollContainer.classList.remove("scroll-container")
      }
      console.log(this.scrollContainer)
    },
    selectedItems(val) {
      this.$emit("change", val);
    }
  },
  methods: {
    getScroll() {
      // If we're on the server, default to 0,0
      if (typeof document === "undefined") {
        return {
          x: 0,
          y: 0
        };
      }
      return {
        x:
          this.$el.scrollLeft ||
          document.body.scrollLeft ||
          document.documentElement.scrollLeft,
        y:
          this.$el.scrollTop ||
          document.body.scrollTop ||
          document.documentElement.scrollTop
      };
    },
    onMouseDown(event) {

      if(this.disabled) return;
      // Ignore right clicks
      if (event.button === 2) return;
      // Register begin point
      this.mouseDown = true;
      this.startPoint = {
        x: event.pageX,
        y: event.pageY
      };
      // Start listening for mouse move and up events
      window.addEventListener("mousemove", this.onMouseMove);
      window.addEventListener("mouseup", this.onMouseUp);
    },
    onMouseMove(event) {
      // Update the end point position
      if (this.mouseDown) {
        this.endPoint = {
          x: event.pageX,
          y: event.pageY
        };

        const children = this.$children.length
          ? this.$children
          : this.$el.children;

        this.selectedItems =  Array.from(children).filter(item => {
          return this.isItemSelected(item.$el || item);
        }).map(item => item.$el);
        this.$emit("onmousemove", this.selectedItems);
         this.changedItems = true;
         /*
        if (this.items) {
          this.selectedItems = this.items.filter(item => {
            return this.isItemSelected(item.$el || item);
          });
          this.$emit("onmousemove", this.selectedItems);
          this.changedItems = true;
        }
        */
      }
    },
    onMouseUp(event) {
      // Clean up event listeners
      window.removeEventListener("mousemove", this.onMouseMove);
      window.removeEventListener("mouseup", this.onMouseUp);
      if (this.changedItems) this.$emit("onmouseup", this.selectedItems);
      // Reset state
      this.mouseDown = false;
      this.changedItems = false;
      this.startPoint = null;
      this.endPoint = null;
    },
    isItemSelected(el) {
      
      if (!el.classList.contains(this.selectorClass))
      {
        return false;
      }
    
      const boxA = this.selectionBox;

      if (
        el.clientWidth != 0 &&
        el.clientHeight != 0 &&
        boxA.width < el.clientWidth / 2 &&
        boxA.height < el.clientHeight / 2
      ) {
          return false;
      }

      const boxB = {
        top: el.offsetTop - this.scrollContainer.scrollTop,
        left: el.offsetLeft - this.scrollContainer.scrollLeft,
        width: el.clientWidth,
        height: el.clientHeight
      };

      let inside = !!(
        boxA.left <= boxB.left + boxB.width &&
        boxA.left + boxA.width >= boxB.left &&
        boxA.top <= boxB.top + boxB.height &&
        boxA.top + boxA.height >= boxB.top
      );
      if (!inside) {
        //console.log(boxA, boxB, el.clientWidth, el.clientHeight);
      }
      return inside;
    }
  },
  mounted() {
    /*
    this.$children.forEach(child => {
      child.$on("click", event => {
        const included = this.selectedItems.find(item => {
          return child.$el === item.$el;
        });
        if (included) {
          this.selectedItems = this.selectedItems.filter(item => {
            return child.$el !== item.$el;
          });
        } else {
          this.selectedItems.push(child);
        }
      });
    });
*/
    this.scrollContainer = this.scrollAccessor(this.$el);
    this.scrollContainer.classList.add("scroll-container")
  },
  beforeDestroy() {
    // Remove event listeners
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.$children.forEach(child => {
      child.$off("click");
    });
  }
};
</script>

<style>

.scroll-container
{
  cursor: crosshair;
}

.vue-drag-select {
  position: relative;
  user-select: none;
}

.vue-drag-select-box {
  position: absolute;
  background: rgba(0, 162, 255, 0.4);
  z-index: 99;
}
.vue-drag-select-box-empty {
  position: absolute;
  background: rgba(228, 63, 99, 0.4);
  z-index: 99;
}
</style>
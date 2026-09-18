<template>
    <div class="star-rating">
      <span
        v-for="(star, index) in stars"
        :key="index"
        :title="starTitle(index + 1)"
        :aria-label="starTitle(index + 1)"
        role="button"
        @click="setRating(index + 1)"
        @mouseover="hoverRating(index + 1)"
        @mouseleave="resetHover"
      >
        <svg
          :class="{'star-filled': (hoverRatingValue || rating) > index, 'star-empty': (hoverRatingValue || rating) <= index}"
          width="24"
          height="24"
          viewBox="0 0 24 24"
        >
          <polygon
            points="12 17.27 18.18 21 15.64 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 8.36 13.97 5.82 21 12 17.27"
          />
        </svg>
      </span>
    </div>
  </template>
  
  <script>
  export default {
    props: ["item"],
    data() {
      return {
        hoverRatingValue: 0,
        stars: [1, 2, 3, 4, 5],
      };
    },
    computed: {
      /*
       * Read from the row every time rather than copied: the same option can
       * be rated from the inspector and from Compare at once, and a copy only
       * one of them made would disagree with the other. Rows are not reactive
       * (see store/rows.js), so the version is what says the rating changed.
       * Number(): ratings loaded from a file may arrive as strings.
       */
      rating() {
        void this.$store.state.dimensionValuesVersion;
        return Number(this.item.Rating) || 0;
      },
    },
    methods: {
      // Clicking the star of the current rating clears it.
      setRating(value) {
        let next = value === this.rating ? 0 : value;
        // Otherwise the hover keeps the cleared stars lit until the mouse leaves.
        if (next === 0) this.resetHover();
        this.$emit('onRatingChanged', next);
      },
      starTitle(value) {
        if (value === this.rating) return "Clear rating";
        return value === 1 ? "Rate 1 star" : "Rate " + value + " stars";
      },
      hoverRating(value) {
        this.hoverRatingValue = value;
      },
      resetHover() {
        this.hoverRatingValue = 0;
      },
    },
  };
  </script>
  
  <style scoped>
  .star-rating {
    display: flex;
  }
  .star-filled polygon {
    fill: #ffd700;
  }
  .star-empty polygon {
    fill: #dcdcdc;
  }
  .star-rating svg {
    cursor: pointer;
  }
  </style>
  
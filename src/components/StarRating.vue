<template>
    <div class="star-rating">
      <span
        v-for="(star, index) in stars"
        :key="index"
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
        rating: this.item.Rating,
        hoverRatingValue: 0,
        stars: [1, 2, 3, 4, 5],
      };
    },
    watch: {
        item: {
            handler: function(newValue)
            {
                this.rating = newValue.Rating;
            }
        }
    },
    methods: {
      setRating(value) {
        console.log("setRating", value)
        this.rating = value;
        this.$emit('onRatingChanged', this.rating);
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
  
<template>
  <div id="content">
    <div class="article">
      <div class="pub">
        <div class="title">
          <a href="" class="at"
            >Designing with sense: A critical review and proposal for enhanced design space exploration in generative design</a
          >
        </div>
        <div class="authors">
          <span class="author"><a href="https://abuzreq.netlify.app/" class="at">Ahmed M. Abuzuraiq</a></span
          >,
          <span class="author"><a href="https://www.sfu.ca/~herhan/" class="at">Halil Erhan</a></span>
        </div>
        <div class="figure">
          
          <router-link to="/demo"> <img src="assets/design_sense_teaser.jpg" /></router-link>

         
          <div class="caption">
            The interface of DesignSense.
          </div>
        </div>
        <div class="abstract">
          <div class="heading">Abstract</div>
          <div class="text">
            Designers in the built-environment disciplines increasingly solve problems using generative design methods, which promise novel and performant solutions to design problems but produce large design spaces that are challenging to explore. Design Space Exploration (DSE) interfaces have been used to understand, refine and narrow design spaces. Still, a critical analysis of current DSE interfaces shows a gap between their features and how designers explore and make decisions. We conducted a design study with domain experts to develop a DSE interface (DesignSense) that tightly integrates and adds to several features found separately in current DSE systems. We present a formative focus group evaluation, which suggested more areas for improvement and highlighted the need to distinguish designers from scientists as two user groups of DSE systems with varying needs, amongst other findings.
          </div>
        </div>
        <div class="materials">
          <div class="heading">Materials</div>
          <div class="links">
            <router-link to="/demo">Demo</router-link> |
            <a target="_blank"  href="https://journals.sagepub.com/doi/10.1177/14780771241260854" class="link at">Paper</a> |
            
            <a href="#/about" class="link at">Feedback and Community (To come)</a>
            <!-- <a class="link at" href="">Video (To come)</a> | -->

          </div>
        </div>
        <hr />
        <!--  <div>
          Last modified: Nov. 30, 2022.
        </div>
        <p>
          Click <a href="#" @click.prevent="disableTracking">here</a>, to
          disable the tracking through Google Analytics.
        </p> -->
      </div>
    </div>
  </div>
</template>
<script>

import Teaser from "@/assets/design_sense_teaser.jpg";

export default {
  components: {
    Teaser
  },
  data() {
    return {
      publicPath: process.env.BASE_URL,
    };
  },
  created() {
    console.log(Teaser)
    console.log(this.publicPath, process.env);
  },
  methods: {
    disableTracking: function() {
      this.$ga.disable();
    },
  },
};
</script>

<style>
#content {
  padding-left: 50px;
  padding-top: 40px;
  width: 80vw;
}
</style>

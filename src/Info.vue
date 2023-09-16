<template>
  <div id="content">
    <div class="article">
      <div class="pub">
        <div class="title">
          <a href="" class="at"
            >Designing with Sense: A Critical Review and Proposal for Enhanced
            Design Space Exploration in Generative Design</a
          >
        </div>
        <div class="authors">
          <span class="author"><a href="" class="at">Anonymous 1</a></span
          >,
          <span class="author"><a href="" class="at">Anonymous 2</a></span>
        </div>
        <div class="figure">
          <router-link to="/demo"> <img src="src/assets/design_sense_teaser.jpg" /></router-link>

         
          <div class="caption">
            The interface of DesignSense.
          </div>
        </div>
        <div class="abstract">
          <div class="heading">Abstract</div>
          <div class="text">
            Practitioners in the built environments disciplines are increasingly
            solving problems with the aid of generative design methods.
            Generative design refers to the computational generation of design
            alternatives aided by optimization and building performance
            simulations. Generative design promises novel and performant
            solutions to design problems but the large size of the design spaces
            it produces makes them challenging to explore. Design space
            exploration (DSE) interfaces have been used to understand, refine
            and narrow design spaces. Still, a critical analysis of current DSE
            interfaces shows a gap between their features and the way designers
            explore and make decisions. Specifically, we conducted a design
            study with domain experts to develop a DSE interface (DesignSense)
            that tightly integrates several features found separately in current
            DSE systems and adds to them. We present a formative focus group
            evaluation which suggested more areas for improvement, and a case
            study to illustrate the utility of the interface.
          </div>
        </div>
        <div class="materials">
          <div class="heading">Materials</div>
          <div class="links">
            <!--          <a
              href="../assets/design-sense-case-study-massing-2.pdf"
              target="_blank"
              >Supplementary (Case Study)</a
            >| -->
            <router-link to="/demo">Demo</router-link> |
            <a href="" class="link at">PDF (To come)</a> |
            <!-- <a class="link at" href="">Video (To come)</a> | -->
            <a class="link at" href="">BibTeX (To come)</a>
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

export default {
  data() {
    return {
      publicPath: process.env.BASE_URL,
    };
  },
  created() {
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

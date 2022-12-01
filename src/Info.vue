<template>
  <div id="content">
    <div class="article">
      <div class="pub">
        <div class="title">
          <a href="" class="at"
            >DesignSense: A Visual Analytics Interface for Navigating Generative
            Design Datasets</a
          >
        </div>
        <div class="authors">
          <span class="author"
            ><a href="https://abuzreq.netlify.app/" class="at"
              >Ahmed M. Abuzuraiq</a
            ></span
          >,
          <span class="author"
            ><a href="http://www.sfu.ca/~herhan/" class="at"
              >Halil Erhan</a
            ></span
          >
        </div>
        <div class="figure">
          <img src="src\assets\teaser_1.jpg" />
          <div class="caption">
            The interface of DesignSense.
          </div>
        </div>
        <div class="abstract">
          <div class="heading">Abstract</div>
          <div class="text">
            In the architectural design domain, designers are increasingly
            solving problems with the aid of computational methods and
            Generative Design (GD) is a notable example. Generative Design (GD)
            refers to the computational generation of design alternatives aided
            by performance simulations. GD promises novel and performant
            solutions to architectural design problems but it produces a large
            number of design alternatives that are challenging to select from
            due to the overload of choice they create. Therefore, the success of
            GD rests on the ability to navigate through and narrow the generated
            alternatives to a smaller set, in a way that is unhindered by the
            number of alternatives and in a manner that allows designers to
            consider both the performance and the design form of their designs.
            Several interactive data visualizations and analysis interfaces have
            been proposed to support design space navigation (DSN). We identify
            shortcomings in current DSN interfaces based on a domain
            characterization which we developed in collaboration with domain
            experts. Then we present DesignSense, visual analytics DSN interface
            of coordinated and linked views, representing and coupling both the
            performance data of alternatives along with visual displays of their
            design forms. Aiding that are mechanisms for selecting from,
            navigating through, clustering, and manually grouping design
            alternatives. Finally, we evaluate the current iteration of
            DesignSense through a formative focus group with domain
            professionals and present realistic case studies of its utility.
          </div>
        </div>
        <div class="materials">
          <div class="heading">Materials</div>
          <div class="links">
            <a
              href="src\assets\files\design-sense-case-study-massing.pdf"
              class="link at"
              >Supplementary (Case Study)</a
            >
            | <router-link to="/demo">Demo</router-link> |
            <a href="" class="link at">PDF (To come)</a> |
            <a class="link at" href="">Video (To come)</a> |
            <a class="link at" href="">BibTeX (To come)</a>
          </div>
        </div>
        <hr />
        <div>
          Last modified: Nov. 30, 2022.
        </div>
        <p>
          Click <a href="#" @click.prevent="disableTracking">here</a>, to
          disable the tracking through Google Analytics.
        </p>
      </div>
    </div>
  </div>
</template>
<script>
export default {
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

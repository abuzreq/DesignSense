<template>
  <v-app :style="{ '--ds-bar-height': barHeight + 'px' }">
    <span
      id="designsense-center"
      style="display: none; position: relative; left: 50%; top: 50%"
    ></span>
    <!-- The bar, left to right: who and what (the name, loading data, the
         mode); how the collection is narrowed, which gets whatever room is
         spare; the assistant; what to do with the result, in labelled groups;
         and the occasional things (sharing, the layout, help) at the end.
         barLevel fits it to the width in one place: see its computed. -->
    <v-app-bar
      app
      dark
      dense
      flat
      short
      color=" white--text text--lighten-1"
      :height="barHeight"
      class="ds-bar"
      :class="'ds-bar--' + barLevel"
    >
      <v-toolbar-title id="designsense-title" class="ds-title">
        DesignSense<sup class="ds-stage">beta</sup>
      </v-toolbar-title>
      <v-divider vertical class="ds-divider" />

      <LoadDataModal id="loading-data-bar" compact> </LoadDataModal>
      <v-divider vertical class="ds-divider" />

      <v-tooltip bottom max-width="340">
        <template v-slot:activator="{ on }">
          <div v-on="on" id="ui-mode-toggle" class="ui-mode-toggle">
            <v-btn-toggle
              :value="uiMode"
              mandatory
              dense
              rounded
              @change="setUiMode"
            >
              <v-btn x-small value="lite">Lite</v-btn>
              <v-btn x-small value="expert">Expert</v-btn>
            </v-btn-toggle>
          </div>
        </template>
        <span v-if="isLite"
          >Lite: brush the charts to filter the options. Each filter is listed
          in the bar and can be removed. Expert adds {{ expertAdds }}.</span
        >
        <span v-else
          >Expert adds {{ expertAdds }}. Switch to Lite to simply filter and
          browse.</span
        >
      </v-tooltip>
      <v-divider vertical class="ds-divider" />

      <!-- How the collection is narrowed: filters in Lite, a selection in
           Expert, and after either the same undo, redo and clear. It never
           shrinks below what it holds, so it can't be drawn over its
           neighbours; the assistant gives way instead. -->
      <div class="ds-narrowing">
        <SelectionOperationsBar
          v-if="can('selectionOperations')"
          id="selection-operations-bar"
          :compact="barLevel !== 'roomy'"
        />
        <FilterBar v-else id="filter-bar" />
        <ToolbarGroup
          id="history-bar"
          class="ds-history"
          :names="historyActions"
          :actions="actions"
          :disabled="actionDisabled"
        />
      </div>

      <!-- Ask or command. In Lite it is a single button whose field opens
           over the toolbar, which keeps the row short enough for the
           arrangement controls; in Expert the field sits in the row, and on
           a narrow window both collapse. The suggestions float below either
           way, so the bar stays one row tall. -->
      <AssistantBar
        ref="assistant"
        id="assistant-bar"
        :compact="barLevel === 'tight' || isLite"
      />
      <v-divider vertical class="ds-divider" />

      <!-- The bar's groups run in the order of the work: navigate the
           collection, save and compare what is found, then set up the view and
           share it. -->
      <!-- Moving about the collection: into the selected, past them, to what
           they leave out, and back. -->
      <ToolbarGroup
        id="data-operations-bar"
        label="Navigate"
        :names="dataActions"
        :actions="actions"
        :disabled="actionDisabled"
      />
      <v-divider vertical class="ds-divider" />

      <!-- What to do with the selected: shortlist them, save them, compare them. -->
      <ToolbarGroup
        id="sets-operations-bar"
        label="Save & compare"
        :names="resultActions"
        :actions="actions"
        :disabled="actionDisabled"
      >
        <!-- The shortlist is reachable here too, without opening the sets' drawer. -->
        <template v-slot:start>
          <v-menu bottom left offset-y>
            <template v-slot:activator="{ on: menu }">
              <v-tooltip bottom>
                <template v-slot:activator="{ on: tooltip }">
                  <span
                    v-on="tooltip"
                    @focusin="tooltip.focus"
                    @focusout="tooltip.blur"
                  >
                    <v-btn
                      id="cart-chip"
                      icon
                      :aria-label="cartTooltip"
                      aria-haspopup="menu"
                      v-on="menu"
                    >
                      <v-badge
                        :value="cartCount > 0"
                        :content="cartCount"
                        color="orange darken-2"
                        overlap
                      >
                        <v-icon>mdi-bookmark-multiple-outline</v-icon>
                      </v-badge>
                    </v-btn>
                  </span>
                </template>
                <span>{{ cartTooltip }}</span>
              </v-tooltip>
            </template>
            <v-list dense>
              <v-list-item :disabled="actionDisabled('addSelectionToCart')" @click="addResultToCart">
                <v-list-item-icon><v-icon>mdi-playlist-plus</v-icon></v-list-item-icon>
                <v-list-item-title>Add to shortlist</v-list-item-title>
              </v-list-item>
              <v-list-item :disabled="cartCount === 0" @click="clearCart">
                <v-list-item-icon><v-icon>mdi-bookmark-off-outline</v-icon></v-list-item-icon>
                <v-list-item-title>Clear the shortlist</v-list-item-title>
              </v-list-item>
              <v-divider />
              <v-list-item :disabled="cartCount === 0" @click="compareCart">
                <v-list-item-icon><v-icon>mdi-table-column</v-icon></v-list-item-icon>
                <v-list-item-title>Compare the shortlist</v-list-item-title>
              </v-list-item>
              <v-list-item :disabled="cartCount === 0" @click="saveCartAsSet">
                <v-list-item-icon><v-icon>mdi-content-save-outline</v-icon></v-list-item-icon>
                <v-list-item-title>Save the shortlist as a set</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>
      </ToolbarGroup>
      <!-- Expert's analysis, which reads the collection as a whole rather
           than acting on it. Inspecting on hover sits on the inspector, beside
           the pin, and in the right-click menu. -->
      <template v-if="can('sensitivity')">
        <v-divider vertical class="ds-divider" />
        <ToolbarGroup
          id="analysis-bar"
          label="Analyse"
          :names="[]"
          :actions="actions"
        >
          <v-tooltip bottom max-width="340">
            <template v-slot:activator="{ on }">
              <v-btn
                id="analysis-button"
                v-on="on"
                icon
                :aria-label="accessibleName(actions['openSensitivity'].tooltip())"
                @click="actions['openSensitivity'].clickAction"
              >
                <v-icon>{{ actions["openSensitivity"].icon }}</v-icon>
              </v-btn>
            </template>
            <span>{{ actions["openSensitivity"].tooltip() }}</span>
          </v-tooltip>
        </ToolbarGroup>
      </template>
      <v-divider vertical class="ds-divider" />

      <!-- Setting up the view and passing it on: the layout, then the story,
           the summary image, the link and the download. -->
      <ToolbarGroup
        id="setup-share-bar"
        label="Setup & share"
        :names="[]"
        :actions="actions"
      >
        <!-- The arrangements themselves, one click each, ahead of the menu
             that holds the rest. On a short bar they fold back into it. -->
        <LayoutPresetBar v-if="barLevel !== 'tight'" id="layout-presets" />
        <!-- The layout: editing, presets and reset in one menu. While editing,
             a Done button stands beside it so stopping is one click. The slot
             stays either way: a Vuetify tooltip places its activator in the bar
             itself, outside what Vue tracks, so a button appearing and
             disappearing beside one shifts it out of place. -->
        <div class="ds-layout-slot">
          <v-btn
            v-if="isEditingMode"
            small
            depressed
            color="green darken-1"
            class="ds-layout-done"
            @click="actions['toggleEditingMode'].clickAction"
            >Done</v-btn
          >
        </div>
        <v-menu bottom left offset-y>
          <template v-slot:activator="{ on: menu }">
            <v-tooltip bottom>
              <template v-slot:activator="{ on: tooltip }">
                <span
                  v-on="tooltip"
                  @focusin="tooltip.focus"
                  @focusout="tooltip.blur"
                >
                  <v-btn
                    id="editing-mode"
                    icon
                    aria-label="The layout: edit, presets, reset"
                    aria-haspopup="menu"
                    :color="isEditingMode ? toolbarColor('editing') : undefined"
                    v-on="menu"
                  >
                    <v-icon>mdi-view-dashboard-edit-outline</v-icon>
                  </v-btn>
                </span>
              </template>
              <span>The layout: move and resize the panels, pick a preset, or reset it</span>
            </v-tooltip>
          </template>
          <v-list dense>
            <v-list-item
              v-if="can('layoutEditing')"
              @click="toggleLayoutEditing"
            >
              <v-list-item-icon><v-icon>{{ actions["toggleEditingMode"].icon }}</v-icon></v-list-item-icon>
              <v-list-item-title>{{
                isEditingMode ? "Stop editing the layout" : "Edit the layout"
              }}</v-list-item-title>
              <v-list-item-action-text class="ml-4">`</v-list-item-action-text>
            </v-list-item>
            <v-list-item @click="isLayoutDialogOn = true">
              <v-list-item-icon><v-icon>mdi-view-grid-outline</v-icon></v-list-item-icon>
              <v-list-item-title>Layout presets…</v-list-item-title>
            </v-list-item>
            <v-list-item @click="resetLayout">
              <v-list-item-icon><v-icon>mdi-view-dashboard-outline</v-icon></v-list-item-icon>
              <v-list-item-title>Reset layout</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <!-- Everything for passing results on, in one drawer: the story,
             the summary image, the link and the download. -->
        <v-menu bottom left offset-y max-width="380">
          <template v-slot:activator="{ on: menu, attrs }">
            <v-tooltip bottom>
              <template v-slot:activator="{ on: tooltip }">
                <span
                  v-on="tooltip"
                  @focusin="tooltip.focus"
                  @focusout="tooltip.blur"
                >
                  <v-btn
                    id="share-menu"
                    icon
                    aria-label="Share and present"
                    aria-haspopup="menu"
                    v-bind="attrs"
                    v-on="menu"
                  >
                    <v-badge
                      :value="captureCount > 0"
                      :content="captureCount"
                      color="blue-grey"
                      overlap
                    >
                      <v-icon>mdi-presentation-play</v-icon>
                    </v-badge>
                  </v-btn>
                </span>
              </template>
              <span>Share and present: capture views for a story, make a summary image or a report, share the link, download</span>
            </v-tooltip>
          </template>
          <v-list dense class="ds-share-menu">
            <v-subheader>Tell the story</v-subheader>
            <v-list-item id="capture-button" @click="actions['captureView'].clickAction">
              <v-list-item-icon><v-icon>{{ actions["captureView"].icon }}</v-icon></v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>Capture this view</v-list-item-title>
                <v-list-item-subtitle>The filters, goals and shortlist, with a note</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
            <v-list-item id="story-button" @click="actions['toggleStory'].clickAction">
              <v-list-item-icon><v-icon>{{ actions["toggleStory"].icon }}</v-icon></v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>The story{{ captureCount > 0 ? " (" + captureCount + ")" : "" }}</v-list-item-title>
                <v-list-item-subtitle>Present the captured views, or make a PDF report</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
            <v-list-item id="summary-button" @click="actions['openSummary'].clickAction">
              <v-list-item-icon><v-icon>{{ actions["openSummary"].icon }}</v-icon></v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>Summary image</v-list-item-title>
                <v-list-item-subtitle>The goals, the shortlist, charts and findings on one picture</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
            <v-divider />
            <v-subheader>Share the data</v-subheader>
            <v-list-item :disabled="!isStudySharable" @click="actions['shareStaticLink'].clickAction">
              <v-list-item-icon><v-icon>{{ actions["shareStaticLink"].icon }}</v-icon></v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>Link to this dataset</v-list-item-title>
                <v-list-item-subtitle>{{ actions["shareStaticLink"].tooltip() }}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
            <v-list-item :disabled="actionDisabled('saveToFile')" @click="actions['saveToFile'].clickAction">
              <v-list-item-icon><v-icon>{{ actions["saveToFile"].icon }}</v-icon></v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>Download (.csv)</v-list-item-title>
                <v-list-item-subtitle>{{ actions["saveToFile"].tooltip() }}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-menu>
      </ToolbarGroup>

      <v-menu bottom left offset-y>
        <template v-slot:activator="{ on: menu }">
          <v-tooltip bottom>
            <template v-slot:activator="{ on: tooltip }">
              <span
                v-on="tooltip"
                @focusin="tooltip.focus"
                @focusout="tooltip.blur"
              >
                <v-btn
                  id="help-menu"
                  icon
                  aria-label="Help, the tour, and shortcuts"
                  aria-haspopup="menu"
                  v-on="menu"
                >
                  <v-icon>mdi-help-circle-outline</v-icon>
                </v-btn>
              </span>
            </template>
            <span>Help, the tour, and shortcuts</span>
          </v-tooltip>
        </template>
        <v-list dense>
          <v-list-item id="feedback-button" @click="openFeedback(false)">
            <v-list-item-icon><v-icon>mdi-message-text-outline</v-icon></v-list-item-icon>
            <v-list-item-title>Send feedback…</v-list-item-title>
          </v-list-item>
          <v-divider />
          <v-list-item @click="requestTour">
            <v-list-item-icon><v-icon>mdi-map-marker-path</v-icon></v-list-item-icon>
            <v-list-item-title>Take the tour</v-list-item-title>
          </v-list-item>
          <v-list-item @click="isOpeningDialogOn = true">
            <v-list-item-icon><v-icon>mdi-home-outline</v-icon></v-list-item-icon>
            <v-list-item-title>Welcome screen</v-list-item-title>
          </v-list-item>
          <v-list-item @click="isShortcutsDialogOn = true">
            <v-list-item-icon><v-icon>mdi-keyboard-outline</v-icon></v-list-item-icon>
            <v-list-item-title>Keyboard shortcuts &amp; gestures</v-list-item-title>
          </v-list-item>
          <v-divider />
          <v-list-item @click="isClearWorkDialogOn = true">
            <v-list-item-icon><v-icon>mdi-delete-sweep-outline</v-icon></v-list-item-icon>
            <v-list-item-title>Clear data…</v-list-item-title>
          </v-list-item>
          <v-divider />
          <v-list-item to="/about">
            <v-list-item-icon><v-icon>mdi-information-outline</v-icon></v-list-item-icon>
            <v-list-item-title>Learn more</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-dialog v-model="isShareLinkModalOn" max-width="620px">
      <v-card>
        <v-card-title>Share this dataset</v-card-title>
        <v-card-text>
          <template v-if="shareLink">
            <p>Anyone with this link opens the same dataset.</p>
            <v-text-field
              ref="shareField"
              :value="shareLink"
              readonly
              outlined
              dense
              hide-details
              @focus="$event.target.select()"
            >
              <template v-slot:append-outer>
                <v-btn color="primary" depressed small @click="copyShareLink">
                  {{ shareCopied ? "Copied" : "Copy" }}
                </v-btn>
              </template>
            </v-text-field>
          </template>
          <p v-else>
            Only datasets opened from a link (a CSV file or a shared online
            folder) can be shared. Files from your computer can't.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="isShareLinkModalOn = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isOpeningDialogOn" max-width="650px">
      <v-card class="ds-welcome">
        <v-card-title class="text-h5">
          Welcome to DesignSense
          <v-spacer />
          <v-btn icon aria-label="Close" @click="isOpeningDialogOn = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text class="ds-welcome-body">
          <p class="ds-welcome-lead">
            Explore a collection of design options through their pictures and
            data: narrow them down to the few worth keeping, see the trade-offs
            between them, and share why.
          </p>
          <div class="ds-welcome-choices">
            <div class="ds-welcome-choice">
              <div class="ds-welcome-choice-head">
                <v-icon color="blue darken-1">mdi-map-marker-path</v-icon>
                New here?
              </div>
              <p>A short tour of the views and what they do.</p>
              <v-btn
                color="blue darken-1"
                dark
                depressed
                @click="
                  isOpeningDialogOn = false;
                  requestTour();
                "
                >Take the tour</v-btn
              >
            </div>
            <div class="ds-welcome-choice">
              <div class="ds-welcome-choice-head">
                <v-icon color="teal">mdi-eye-outline</v-icon>
                {{ welcomeDataset.title }}
              </div>
              <p>{{ welcomeDataset.text }}</p>
              <v-btn
                color="teal"
                dark
                depressed
                :disabled="loadState.loading"
                @click="isOpeningDialogOn = false"
                >Explore it</v-btn
              >
            </div>
            <div class="ds-welcome-choice">
              <div class="ds-welcome-choice-head">
                <v-icon color="red lighten-2">mdi-folder-open-outline</v-icon>
                Your own data
              </div>
              <p>A CSV from your computer, a link, or another sample.</p>
              <LoadDataModal />
            </div>
          </div>
          <div class="ds-welcome-layout">
            <div class="ds-welcome-layout-head">{{ layoutQuestion }}</div>
            <p class="ds-welcome-layout-help">
              The charts and the pictures share the screen. Pick where you
              would like them; you can change it whenever you like from the
              toolbar, or by dragging the edge between two panels.
            </p>
            <div class="ds-welcome-layout-choices">
              <button
                v-for="preset in layoutPresets"
                :key="preset.id"
                type="button"
                class="ds-welcome-layout-btn"
                :class="{
                  'ds-welcome-layout-btn--on': layoutPreset === preset.id,
                }"
                :title="preset.description"
                :aria-pressed="String(layoutPreset === preset.id)"
                @click="chooseWelcomeLayout(preset.id)"
              >
                <LayoutPresetFigure :preset="preset.id" />
                <span class="ds-welcome-layout-name">
                  {{ preset.name }}
                  <v-icon
                    v-if="layoutPreset === preset.id"
                    x-small
                    color="primary"
                    >mdi-check</v-icon
                  >
                </span>
              </button>
            </div>
          </div>
          <p class="ds-welcome-privacy">
            <v-icon small color="green darken-2">mdi-shield-check-outline</v-icon>
            Your data is read in this browser and never uploaded; your work is
            kept here too.
          </p>
          <p class="ds-welcome-note">
            DesignSense is a research project and still changing, so your
            feedback shapes what it does next.
          </p>
          <div class="ds-welcome-links">
            <router-link to="/about">Learn more</router-link>
            <span>·</span>
            <a href="#" @click.prevent="openFeedback(false)">Send feedback</a>
            <span>·</span>
            <span
              >Built by
              <a href="https://abuzreq.com/" target="_blank" rel="noopener"
                >Ahmed Abuzuraiq</a
              ></span
            >
            <span>·</span>
            <span>v{{ appVersion }}</span>
          </div>
        </v-card-text>
        <v-card-actions class="ds-welcome-actions">
          <v-checkbox
            v-model="showWelcomeAtStart"
            dense
            hide-details
            label="Show this when DesignSense opens"
          />
          <v-spacer />
          <v-btn text @click="isOpeningDialogOn = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isShortcutsDialogOn" max-width="640px" scrollable>
      <v-card>
        <v-card-title>
          Keyboard shortcuts &amp; gestures
          <v-spacer />
          <v-btn icon aria-label="Close" @click="isShortcutsDialogOn = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <h4 class="ds-shortcuts-heading">Keys</h4>
          <table class="ds-shortcuts">
            <tr v-for="row in shortcutRows.keys" :key="row[0]">
              <td><kbd>{{ row[0] }}</kbd></td>
              <td>{{ row[1] }}</td>
            </tr>
          </table>
          <h4 class="ds-shortcuts-heading">Mouse</h4>
          <table class="ds-shortcuts">
            <tr v-for="row in shortcutRows.mouse" :key="row[0]">
              <td>{{ row[0] }}</td>
              <td>{{ row[1] }}</td>
            </tr>
          </table>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isLayoutDialogOn" max-width="760px">
      <v-card>
        <v-card-title>
          Choose a layout
          <v-spacer />
          <v-btn icon aria-label="Close" @click="isLayoutDialogOn = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <p class="ds-layout-intro">
            Pick one of these, or arrange the panels yourself by dragging their
            headers and edges. Whichever you pick is remembered.
          </p>
          <div class="ds-presets">
            <button
              v-for="preset in layoutPresets"
              :key="preset.id"
              type="button"
              class="ds-preset"
              :class="{ 'ds-preset--on': layoutPreset === preset.id }"
              @click="chooseLayoutPreset(preset.id)"
            >
              <LayoutPresetFigure :preset="preset.id" labelled />
              <span class="ds-preset-name">
                {{ preset.name }}
                <v-icon v-if="layoutPreset === preset.id" x-small color="primary"
                  >mdi-check</v-icon
                >
              </span>
              <span class="ds-preset-desc">{{ preset.description }}</span>
            </button>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            v-if="can('layoutEditing')"
            text
            @click="arrangeLayoutMyself"
            >Arrange it myself</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- What of this dataset's work to delete: all of it unless some is left out. -->
    <ClearDataDialog v-model="isClearWorkDialogOn" />

    <v-dialog v-model="isTourDialogOn" max-width="460px">
      <v-card>
        <v-card-title>Start the tour?</v-card-title>
        <v-card-text>
          The tour uses the sample used-car data, so it replaces the dataset on
          screen. Your sets and ratings for this dataset are saved and come back
          when you load it again.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="isTourDialogOn = false">Cancel</v-btn>
          <v-btn
            color="primary"
            text
            @click="
              isTourDialogOn = false;
              startTour();
            "
            >Start the tour</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
    <DimensionsDialog />
    <CompareDialog />
    <SensitivityDialog />
    <SummaryDialog />
    <FeedbackDialog v-model="isFeedbackOn" :from-error="feedbackFromError" />
    <ColumnsDialog />
    <StoryReportDialog />
    <StoryPresenter />
    <v-main id="designsense-workspace" :style="{ padding: barHeight + 'px 0 0' }">
      <!-- The saved sets' rail takes a strip at the left; their drawer opens
           over the workspace from it. -->
      <div class="ds-work-area">
        <SetsDrawer />
        <div
          ref="workspace"
          class="ds-workspace"
          @contextmenu="showContextMenuHandler"
        >
          <Card
            v-for="item in layouts"
            :key="item.type"
            :initX="item.x"
            :initY="item.y"
            :initW="item.w"
            :initH="item.h"
            :unitW="unitW"
            :unitH="unitH"
            :type="item.type"
          />
          <!-- The edges between panels, draggable without entering editing.
               While editing, the panels carry their own handles instead. -->
          <LayoutSeams
            v-if="!isEditingMode"
            :layouts="layouts"
            :unitW="unitW"
            :unitH="unitH"
            @preview="onSeamPreview"
            @commit="onSeamCommit"
          />
        </div>
        <StoryPanel />
      </div>
    </v-main>

    <radial-menu
      ref="contextMenu"
      v-show="showContextMenu"
      :style="{
        position: 'absolute',
        left: `${rightClickPos.x}px`,
        top: `${rightClickPos.y}px`,
      }"
      style="
        margin: auto;
        margin-top: -15px;
        margin-left: -15px;
        background-color: white;
      "
      :itemSize="50"
      :radius="70"
      :angle-restriction="360"
    >
      <radial-menu-item
        v-for="(item, index) in contextMenuItems"
        :key="index"
        style="background-color: white"
      >
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              :color="actionType2Color(actions[item].type)"
              v-on="on"
              icon
              :aria-label="accessibleName(actions[item].tooltip())"
              @click="actions[item].clickAction"
            >
              <v-icon>{{ actions[item].icon }}</v-icon>
            </v-btn>
          </template>
          <span>{{ actions[item].tooltip() }}</span>
        </v-tooltip>
      </radial-menu-item>
    </radial-menu>
    <v-tour
      name="onboardingTour"
      :steps="onboardingStudyTourSteps"
      :options="{
        highlight: true,
        labels: {
          buttonSkip: 'Skip tour',
          buttonPrevious: 'Back',
          buttonNext: 'Next',
          buttonStop: 'Done',
        },
      }"
      :callbacks="onboardingCallbacks"
    ></v-tour>
    <!-- An error nothing handled: offered for reporting, once per error. It
         sits at the top so it never hides the store's notices below. -->
    <v-snackbar
      :value="!!latestError && !isFeedbackOn"
      color="deep-orange darken-3"
      :timeout="-1"
      top
      right
    >
      Something went wrong. Reporting it helps fix it.
      <template v-slot:action="{ attrs }">
        <v-btn text v-bind="attrs" @click="openFeedback(true)">Report</v-btn>
        <v-btn text v-bind="attrs" @click="dismissError">Dismiss</v-btn>
      </template>
    </v-snackbar>
    <!-- Store notices (a deleted set, a download) take the snackbar over the
         last load's message; a new notice replaces the one on screen. -->
    <v-snackbar
      v-if="storeNotice"
      :key="'notice-' + storeNotice.id"
      :value="true"
      color="grey darken-3"
      :timeout="storeNotice.action ? 8000 : 5000"
      bottom
      left
      @input="onNoticeInput"
    >
      {{ storeNotice.text }}
      <template v-slot:action="{ attrs }">
        <v-btn
          v-if="storeNotice.action"
          text
          color="amber"
          v-bind="attrs"
          @click="runNoticeAction"
          >Undo</v-btn
        >
        <v-btn text v-bind="attrs" @click="$store.commit('dismissNotice')"
          >Close</v-btn
        >
      </template>
    </v-snackbar>
    <v-snackbar
      v-else
      v-model="showLoadNotice"
      :color="loadState.error ? 'error' : 'grey darken-3'"
      :timeout="loadState.error ? -1 : 8000"
      bottom
      left
    >
      {{ loadNotice }}
      <template v-slot:action="{ attrs }">
        <v-btn
          v-if="ownDataLoaded && !loadState.error"
          text
          color="amber"
          v-bind="attrs"
          @click="reviewColumns"
          >Columns</v-btn
        >
        <v-btn text v-bind="attrs" @click="showLoadNotice = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style>
.v-tour {
  z-index: 8000;
}

/* Tour steps: short, left-aligned and comfortable to read. */
.v-tour .v-step {
  max-width: 340px;
  padding: 14px 16px;
  border-radius: 8px;
}
.v-tour .v-step__header {
  margin: -14px -16px 10px;
  padding: 8px 16px;
  border-radius: 8px 8px 0 0;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}
.v-tour .v-step__content {
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
}

.v-tour__target--highlighted {
  box-shadow: 0 0 0 99999px rgba(0, 0, 0, 0.4) !important;
  z-index: 30 !important;
  /*   z-index: 8000 !important;  */
}

.v-tour--active .v-card.vdr.v-tour__target--relative {
  position: absolute !important;
}

body {
  overflow: hidden; /* Hide scrollbars */
}

.v-tooltip__content,
.v-tooltip__content--fixed {
  z-index: 8002 !important;
}
.v-toolbar {
  margin-top: -5px;
}
/* The app bar is sized to what it holds, so none of it is tucked away. */
.v-app-bar.ds-bar {
  margin-top: 0;
}
.v-app-bar .v-toolbar__content {
  padding-left: 8px;
  padding-right: 8px;
}

/* The bar's icons are a size below Vuetify's 24px, so the row of buttons
   reads lighter, and its buttons 32px rather than the toolbar's 48. */
.v-app-bar .v-btn--icon.v-size--default .v-icon {
  font-size: 20px;
  width: 20px;
  height: 20px;
}
.v-app-bar .v-toolbar__content .v-btn--icon.v-size--default {
  width: 32px !important;
  height: 32px !important;
}
.ui-mode-toggle {
  margin: 0 2px;
}
.ui-mode-toggle .v-btn {
  font-size: 11px;
  letter-spacing: 0.04em;
}
.ds-layout-slot {
  display: inline-flex;
  align-items: center;
}
.ds-layout-done.v-btn {
  margin-right: 4px;
  text-transform: none;
  letter-spacing: 0;
}
.ds-title {
  flex: 0 0 auto;
  margin-right: 2px;
  font-size: 18px !important;
}
.ds-stage {
  margin-left: 2px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: deepskyblue;
}
/* Loading data happens about once a visit: an icon, red so it is found. */
#loading-data-bar .load-data-label {
  display: none;
}
#loading-data-bar .load-data-icon.v-icon {
  margin: 0;
}
#loading-data-bar .load-data-button.v-btn {
  min-width: 0 !important;
  padding: 0 8px !important;
}
/* The share menu's lines say what each does in full rather than cut short. */
.ds-share-menu .v-list-item__subtitle {
  white-space: normal;
  line-height: 1.3 !important;
}
.ds-share-menu .v-list-item__icon {
  margin-right: 16px !important;
}
.v-app-bar .v-divider--vertical.ds-divider {
  align-self: center;
  min-height: 24px;
  max-height: 24px;
  margin: 0 4px;
}
/* The badge wrapper is taller than a bare icon, which pushes the bookmark
   below the line the other toolbar icons sit on. */
#cart-chip .v-badge {
  display: flex;
  align-items: center;
  line-height: 1;
  margin-top: -2px;
}
/* The filters or the selection take whatever room the groups leave, but
   never less than they hold: squeezed further, they were drawn over their
   neighbours. */
.ds-narrowing {
  /* Shrinks last: short of room, the assistant narrows to its minimum first. */
  flex: 1 0.2 auto;
  min-width: min-content;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
/* Lite's filters take the zone's spare room but ask only for the count's:
   the hint and the chips shorten, and would otherwise count at full length
   towards the zone's minimum. Expert's strip does the same inside its bar. */
.ds-narrowing > #filter-bar {
  flex: 1 1 0;
  width: 0;
  /* The count and an "N filters" pill. */
  min-width: 180px;
}
/* Undo, redo and clear sit a size down, beside the text they act on. */
.v-app-bar .ds-history .v-btn.v-btn--icon.v-size--default {
  width: 28px !important;
  height: 28px !important;
}
.ds-history .v-btn--icon.v-size--default .v-icon {
  font-size: 18px;
  width: 18px;
  height: 18px;
}
.ds-welcome .v-card__title {
  flex-wrap: nowrap;
  word-break: normal;
}
@media (max-width: 600px) {
  .ds-welcome .v-card__title {
    font-size: 20px !important;
  }
}
.ds-welcome-body {
  padding-bottom: 8px !important;
  color: #37474f !important;
}
.ds-welcome-lead {
  font-size: 15px;
  line-height: 1.5;
}
.ds-welcome-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 4px 0 14px;
}
.ds-welcome-choice {
  flex: 1 1 180px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid #e3e8eb;
  border-radius: 8px;
}
.ds-welcome-choice-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 15px;
  font-weight: 600;
  color: #263238;
}
.ds-welcome-choice p {
  flex: 1 1 auto;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.4;
}
/* The load dialog's own button, brought in line with the other two. */
.ds-welcome-choice .container {
  padding: 0 !important;
  margin: 0;
}
.ds-welcome-privacy {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 13px;
  color: #2e7d32;
}
.ds-welcome-note {
  margin-bottom: 8px;
  font-size: 13px;
}
.ds-welcome-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 13px;
  color: #78909c;
}
.ds-welcome-actions {
  padding: 4px 16px 10px 20px !important;
  border-top: 1px solid #eceff1;
}
.ds-welcome-actions .v-input--selection-controls {
  margin-top: 0;
}
.ds-welcome-actions .v-label {
  font-size: 13px;
}
.ds-layout-intro {
  margin-bottom: 12px;
  font-size: 14px;
  color: #37474f;
}
.ds-presets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.ds-preset {
  display: block;
  padding: 8px;
  text-align: left;
  border: 1px solid #cfd8dc;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
.ds-preset:hover {
  border-color: #90caf9;
}
.ds-preset--on {
  border-color: #1565c0;
  box-shadow: 0 0 0 1px #1565c0 inset;
}
.ds-preset-name {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #263238;
}
.ds-preset-desc {
  display: block;
  font-size: 12px;
  line-height: 1.35;
  color: #546e7a;
}
/* A section of its own, not a fourth entry point: this is a choice about
   the workspace, and it has to be worth reading on the tenth visit too. */
.ds-welcome-layout {
  margin-top: 22px;
  padding: 14px 16px 16px;
  border: 1px solid #e0e6eb;
  border-radius: 10px;
  background: #fafbfc;
}
.ds-welcome-layout-head {
  font-size: 15px;
  font-weight: 600;
  color: #263238;
}
.ds-welcome-layout-help {
  margin: 4px 0 12px;
  font-size: 13px;
  line-height: 1.45;
  color: #546e7a;
}
.ds-welcome-layout-choices {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}
.ds-welcome-layout-btn {
  display: block;
  padding: 7px;
  border: 1px solid #cfd8dc;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: center;
}
.ds-welcome-layout-btn:hover {
  border-color: #90caf9;
}
.ds-welcome-layout-btn--on {
  border-color: #1565c0;
  box-shadow: 0 0 0 1px #1565c0 inset;
}
.ds-welcome-layout-name {
  display: block;
  margin-top: 7px;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.25;
  color: #37474f;
}
.ds-shortcuts-heading {
  margin: 12px 0 4px;
  color: #37474f;
}
.ds-shortcuts {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.ds-shortcuts td {
  padding: 4px 8px 4px 0;
  vertical-align: top;
  border-bottom: 1px solid #eceff1;
  color: #37474f;
}
.ds-shortcuts td:first-child {
  white-space: nowrap;
  width: 38%;
}
.ds-shortcuts kbd {
  background: #eceff1;
  color: #263238;
  box-shadow: none;
  font-size: 13px;
}
.ds-work-area {
  position: relative;
  display: flex;
  height: calc(100vh - var(--ds-bar-height));
}
.ds-workspace {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
}
/* Short of room (see barLevel): the rest gives way a little too. */
.ds-bar--tight .ds-stage {
  display: none;
}
.ds-bar--tight .v-divider--vertical.ds-divider {
  margin: 0 2px;
}

/* Expert mode: the pointer shows which operation a brush will apply. */
body[data-selection-op] .scatter-svg .overlay,
body[data-selection-op] .scatter-svg .lasso-area,
body[data-selection-op] .parcoords .brush .overlay,
body[data-selection-op] .cluster-card,
body[data-selection-op] .scroll-container {
  cursor: var(--ds-selection-cursor) !important;
}
</style>
<script>
import Vue from "vue";

import ParCoordsView from "@/components/ParCoordsView.vue";
import AugmentedGridView from "@/components/AugmentedGridView.vue";

import SPLOMView from "@/components/SPLOMView.vue";

import ScatterplotView from "@/components/ScatterplotView.vue";

import SetsDrawer from "@/components/SetsDrawer.vue";

import Card from "@/components/Card.vue";

import { mapState, mapGetters } from "vuex";

import * as d3 from "d3";

import { RadialMenu, RadialMenuItem } from "vue-radial-menu";
import LoadDataModal from "@/components/LoadDataModal.vue";
import { operations } from "@/components/operations.js";

import SelectionOperationsBar from "@/components/SelectionOperationsBar.vue";
import FilterBar from "@/components/FilterBar.vue";
import ToolbarGroup from "@/components/ToolbarGroup.vue";
import TipButton from "@/components/TipButton.vue";
import { accessibleName } from "@/components/a11y.js";
import {
  LAYOUT_COLUMNS,
  LAYOUT_PRESETS,
  LAYOUT_ROWS,
  loadLayoutAsked,
  saveLayoutAsked,
} from "@/layout.js";
import LayoutPresetBar from "@/components/LayoutPresetBar.vue";
import LayoutPresetFigure from "@/components/LayoutPresetFigure.vue";
import LayoutSeams from "@/components/LayoutSeams.vue";

// What Expert adds to Lite, said the same way in the mode tooltip and the tour.
// Outlive the workspace, which is mounted again for each dataset.
// Whether the welcome screen opens with the app: yes until the user unticks
// it. Without storage, it always does.
const SHOW_WELCOME_KEY = "designsense-show-welcome";
const welcome = { pending: readShowWelcome() };
const tour = { pending: false };

function readShowWelcome() {
  try {
    return localStorage.getItem(SHOW_WELCOME_KEY) !== "false";
  } catch (e) {
    return true;
  }
}

function writeShowWelcome(value) {
  try {
    localStorage.setItem(SHOW_WELCOME_KEY, value ? "true" : "false");
  } catch (e) {
    /* kept for this visit only */
  }
}
// The app bar's height: 32px buttons with a 10px label under them, and room
// around. Everything that sits below the bar is offset by this.
const BAR_HEIGHT = 52;
/**
 * Where the toolbar changes shape, by window width. Measured against what the
 * bar holds rather than guessed; see barLevel.
 *  - Above ROOMY, Expert's five selection operations are spread out.
 *  - Below TIGHT, the assistant becomes a button that opens over the bar.
 */
const BAR_ROOMY = 1600;
const BAR_TIGHT = { lite: 1170, expert: 1280 };
const EXPERT_ADDS =
  "selection operations and the lasso, clusters, coloring, editing sets, inspection controls, the analysis panel, and layout editing";
import { applySelectionCursor } from "@/components/selectionCursors.js";

import AssistantBar from "@/components/AssistantBar.vue";
import DimensionsDialog from "@/components/DimensionsDialog.vue";
import CompareDialog from "@/components/CompareDialog.vue";
import SensitivityDialog from "@/components/SensitivityDialog.vue";
import SummaryDialog from "@/components/SummaryDialog.vue";
import FeedbackDialog from "@/components/FeedbackDialog.vue";
import ColumnsDialog from "@/components/ColumnsDialog.vue";
import ClearDataDialog from "@/components/ClearDataDialog.vue";
import { loadColumnRoles } from "@/data/columnRoles.js";
import { errorState } from "@/errors.js";
import { APP_VERSION } from "@/feedback.js";
import { presetFor } from "@/data/presets.js";
import StoryReportDialog from "@/components/StoryReportDialog.vue";
import StoryPanel from "@/components/StoryPanel.vue";
import StoryPresenter from "@/components/StoryPresenter.vue";
import {
  DEFAULT_DATASET_URL,
  loadDataset,
  loadState,
} from "@/data/loader.js";

/**
 * One onboarding step. `mode` is the UI mode whose controls the step points
 * at; the tour switches to it first, so stepping back and forth still finds
 * its target. `setup` prepares an example for the step, and may return the
 * milliseconds its work needs before the target is in place.
 */
function tourStep(vm, mode, target, title, content, placement, setup) {
  return {
    target: target,
    header: { title: title },
    content: content,
    params: { enableScrolling: false, placement: placement },
    before: () => vm.prepareTourStep(mode, setup),
  };
}

/**
 * A step about a dialog. A dialog leaves no room beside it, so the step is
 * clamped into view over its top rather than pushed off the screen, and the
 * dialog's own scrim does the dimming a highlight would otherwise do.
 */
function dialogTourStep(vm, mode, target, title, content, setup) {
  return {
    target: target,
    header: { title: title },
    content: content,
    params: {
      enableScrolling: false,
      placement: "top",
      highlight: false,
      modifiers: [
        { name: "preventOverflow", options: { altAxis: true, padding: 12 } },
      ],
    },
    before: () => vm.prepareTourStep(mode, setup),
  };
}

export default {
  name: "Demo",
  components: {
    AssistantBar,
    DimensionsDialog,
    CompareDialog,
    SensitivityDialog,
    SummaryDialog,
    FeedbackDialog,
    ColumnsDialog,
    ClearDataDialog,
    StoryReportDialog,
    StoryPanel,
    StoryPresenter,
    LayoutPresetBar,
    LayoutPresetFigure,
    LayoutSeams,
    ParCoordsView,
    AugmentedGridView,
    SPLOMView,
    ScatterplotView,
    SetsDrawer,
    Card,
    RadialMenu,
    RadialMenuItem,
    LoadDataModal,
    SelectionOperationsBar,
    FilterBar,
    ToolbarGroup,
    TipButton,
  },

  data: function() {
    return {
      onboardingCallbacks: {
        onStart: () => (document.body.style.pointerEvents = "all"),
        onSkip: () => this.endTour(),
        onFinish: () => this.endTour(),
      },
      // Lite first, then what Expert adds. Each step names the mode it needs.
      onboardingStudyTourSteps: [
        tourStep(this, "lite", "#designsense-title", "Welcome to DesignSense",
          "Explore a collection of design options through their pictures and data: narrow them down, see the trade-offs, pick the few worth keeping, and share why. This tour takes a few minutes. Use the arrow keys or the buttons below.",
          "bottom"),
        tourStep(this, "lite", "#ui-mode-toggle", "Lite and Expert",
          "<b>Lite</b> keeps things simple: you narrow the options with filters. <b>Expert</b> adds " + EXPERT_ADDS + ". The tour starts in Lite.",
          "bottom"),
        tourStep(this, "lite", "#loading-data-bar", "Load your data",
          "Open one of the prepared datasets, a link or shared folder, or a file from your computer. It is read in your browser and never uploaded. With your own file, DesignSense then shows which columns it read as inputs, outputs and pictures, and you can correct them. This tour uses a small set of used cars.",
          "bottom"),
        tourStep(this, "lite", '.v-card[type="Grid"]', "Gallery",
          "Every option appears here as an image. Sort them from the menu at the top and change the image size on the right. Drag a box over images to keep just those; the others stay, dimmed. Click an image to inspect it, and click it again to stop.",
          "right"),
        tourStep(this, "lite", ".inspector_card", "A closer look",
          "A bigger look at the option you clicked. The first button lists its values beside the image; an option with more than one view is switched there too, and one with a 3D model opens it with the cube button. On the right you can rate it, write a note on it, and keep it aside on the shortlist. Ratings become a Rating axis you can filter by.",
          "right", () => this.inspectTourOption()),
        tourStep(this, "lite", ".v-card[type='ScatterPlot']", "Scatterplot",
          "Each dot is an option. Drag a box to filter by both axes, and choose the axes at the top. Click a dot to inspect it.",
          "left", () => this.showTourFilter()),
        tourStep(this, "lite", '.v-card[type="ParallelCoordinatesPlot"]', "Parallel coordinates",
          "Each line is an option and each axis is a dimension. Drag along an axis to filter it. Drag a title to reorder the axes, or pick them under Axes.",
          "left"),
        tourStep(this, "lite", "#dimensions-button", "Goals and your own criteria",
          "Say which way is better for each output: lower cost, higher daylight. Arrows then mark it on the axes, and Expert's analysis finds the best trade-offs. Here you can also add criteria of your own, entered by hand or weighed from others.",
          "left"),
        tourStep(this, "lite", "#filter-bar", "Your filters",
          "Each filter becomes a chip, and the count shows how many options match. Remove a chip to drop its filter. The arrows after them undo and redo, and the last button clears every filter; Esc stops inspecting, then clears too.",
          "bottom"),
        tourStep(this, "lite", "#assistant-bar", "Ask or command",
          "Type what you want in plain words, like “price under 10000” or “what do these have in common”, and the assistant does it or answers. Press / to get here from anywhere.",
          "bottom"),
        tourStep(this, "lite", "#data-operations-bar", "Navigate",
          "Zoom in on the selected options to focus on them, or exclude them instead. Invert shows everything the filters leave out. Step back undoes the last zoom, and Reset brings back the whole collection.",
          "bottom"),
        tourStep(this, "lite", "#sets-drawer", "Saved sets",
          "Save the current results along with their filters. Restore a set later to bring those filters back. They wait at the left edge: move the pointer there, or click the tab.",
          "right", () => this.openTourSets()),
        tourStep(this, "lite", "#cart-chip", "Your shortlist",
          "Options you set aside gather here, and the badge counts them. The shortlist outlasts filtering, zooming and switching modes, so it is where a few candidates wait while you keep looking. This menu shortlists everything currently shown, saves the shortlist as a set, or compares it.",
          "bottom", () => this.fillTourCart()),
        dialogTourStep(this, "lite", ".cmp-card", "Compare",
          "Up to eight options side by side, each column with its image, its rating and its own shortlist button. Rows that read the same everywhere are dimmed, and in a numeric row the highest and lowest values are marked. Click a row name to sort the columns by it.",
          () => this.openTourCompare()),
        tourStep(this, "lite", "#share-menu", "Share and present",
          "Capture views as you go, each with its filters, goals and shortlist and a note. Present them in a meeting, turn them into a PDF report, or make a one-image summary. The link to the dataset and a CSV download are here too.",
          "bottom"),
        tourStep(this, "expert", "#ui-mode-toggle", "Expert mode",
          "Expert keeps everything you have seen and adds " + EXPERT_ADDS + ". Instead of filtering, you build a selection.",
          "bottom"),
        tourStep(this, "expert", "#selection-operations-bar", "Selection operations",
          "Choose how a new selection combines with the current one: replace, add, subtract, toggle, or intersect. Hold Shift to add, Ctrl to subtract, or both to intersect.",
          "bottom"),
        tourStep(this, "expert", "#sets-operations-bar", "Save and compare",
          "Keep the selected on the shortlist, save them as a set, or compare them side by side. Inverting the selection is under Navigation, and undo, redo and clear sit beside the selection itself.",
          "bottom"),
        tourStep(this, "expert", ".v-card[type='ScatterPlot'] div.cluster-view", "Clusters",
          "Clusters group options that are similar on the dimensions you choose. Each image stands for a group. Click it to select the whole group.",
          "left", () => this.$store.commit("setClusteringPanelOpen", { value: true })),
        tourStep(this, "expert", ".inspector_card", "Inspection",
          "Click any option to inspect it, or hold Space and move over options. The pointer button here inspects on hover without holding Space, and the pin keeps an option here after you let go. Both are in the right-click menu too.",
          "right", () => this.inspectTourOption()),
        dialogTourStep(this, "expert", ".sx-card", "Analysis",
          "The whole collection at a glance, rather than what is on screen. At the top, every dimension's average, standard deviation and spread. Then the outliers, which can be left out of the reading, and the best trade-offs by the goals set under Dimensions. Below, which inputs move which outputs: name the parameters and the results, or start their columns with in: and out: and the file names them for you. Each of the three measures answers a different question, and the panel says in the open that a reading is only as good as the sampling behind it.",
          () => this.openTourSensitivity()),
        tourStep(this, "expert", "#editing-mode", "Your layout",
          "This menu turns on editing, to move and resize the panels, picks a preset arrangement, or resets it. Done, or the ` key, stops editing.",
          "bottom"),
        tourStep(this, "lite", "#designsense-title", "You're ready",
          "You're back in Lite. Switch to Expert whenever you need more control, and right-click the workspace for quick actions. The help menu has this tour and every shortcut. To tell us what works and what doesn't, use Help → Send feedback.",
          "bottom", () => this.clearTourExample()),
      ],
      operationsList: operations,
      actions: {
        undo: {
          clickAction: () => this.$store.dispatch("undo"),
          icon: "mdi-undo",
          tooltip: () =>
            this.isLite
              ? "Undo the last filter change [Ctrl+Z]"
              : "Undo the last selection change [Ctrl+Z]",
          type: "selection",
        },
        redo: {
          clickAction: () => this.$store.dispatch("redo"),
          icon: "mdi-redo",
          tooltip: () => "Redo [Ctrl+Y]",
          type: "selection",
        },
        createSet: {
          clickAction: () => this.$store.dispatch("createSet"),
          icon: "mdi-contain",
          tooltip: () =>
            this.isLite
              ? "Save the selected options and their filters as a set"
              : "Save the selected options as a set",
          type: "selection",
        },
        resetAllMarkings: {
          clickAction: () => this.$store.dispatch("resetAllMarkings"),
          icon: "mdi-select-off",
          tooltip: () =>
            this.isLite
              ? this.hasScope
                ? "Clear every filter; the zoom stays [Esc]"
                : "Clear every filter [Esc]"
              : "Clear the selection [Esc]",
          type: "selection",
        },
        invertSelection: {
          clickAction: () => this.$store.dispatch("invertSelection"),
          icon: "mdi-select-inverse",
          tooltip: () =>
            this.isLite
              ? "Invert: show everything the filters leave out"
              : "Invert the selection",
          type: "selection",
        },
        undoDataTransformation: {
          clickAction: () => this.$store.dispatch("undoDataTransformation"),
          icon: "mdi-magnify-minus-outline",
          tooltip: () => "Step back out of the last zoom or exclusion",
          type: "data",
        },
        zoomToSelection: {
          clickAction: () => this.$store.dispatch("zoomToSelection"),
          icon: "mdi-magnify-plus-outline",
          tooltip: () =>
            this.isLite
              ? "Zoom in on the selected options. Charts rescale to them and you can filter again inside them."
              : "Zoom in on the selected options",
          type: "data",
        },
        excludeSelection: {
          clickAction: () => this.$store.dispatch("excludeSelection"),
          icon: "mdi-filter-remove-outline",
          tooltip: () =>
            this.isLite
              ? "Exclude the selected options from the collection"
              : "Exclude the selected",
          type: "data",
        },
        resetData: {
          clickAction: () => this.$store.dispatch("resetData"),
          icon: "mdi-restart",
          tooltip: () =>
            this.isLite
              ? "Show the full collection again. Your filters stay."
              : "Show every option again",
          type: "data",
        },
        toggleInspectionMode: {
          clickAction: () => this.$store.dispatch("toggleInspectionMode"),
          icon: "mdi-selection-ellipse-arrow-inside",
          tooltip: () =>
            this.isInspectionMode
              ? "Inspecting on hover: click to stop"
              : "Inspect on hover, without holding Space",
          type: "inspecting",
        },
        clearInspection: {
          clickAction: () => this.$store.dispatch("clearInspection"),
          icon: "mdi-cancel",
          tooltip: () =>
            "Stop inspecting the current option [Esc]",
          type: "inspecting",
        },
        addSelectionToCart: {
          clickAction: () => this.$store.dispatch("addResultToCart"),
          icon: "mdi-playlist-plus",
          tooltip: () => "Add selection to shortlist",
          type: "selection",
        },
        compareResult: {
          clickAction: () => this.$store.dispatch("openCompare", { source: "selection" }),
          icon: "mdi-table-column",
          tooltip: () => "Compare the selected options side by side",
          type: "selection",
        },
        togglePinInspection: {
          clickAction: () => this.$store.dispatch("togglePinInspection"),
          icon: "mdi-pin",
          tooltip: () =>
            this.isInspectionPinned
              ? "Unpin the inspected option [P]"
              : "Pin the inspected option [P]",
          type: "inspectionPin",
        },
        openSensitivity: {
          clickAction: () => this.$store.dispatch("openSensitivity"),
          icon: "mdi-chart-box-outline",
          tooltip: () =>
            "Analysis: each dimension's spread, the outliers, the best trade-offs by your goals, and which inputs move which outputs",
          type: "misc",
        },
        toggleEditingMode: {
          clickAction: () => this.$store.dispatch("toggleEditingMode"),
          icon: "mdi-table-edit",
          tooltip: () =>
            this.isEditingMode
              ? "Stop editing the layout [`]"
              : "Edit the layout: move and resize the panels [`]",
          type: "editing",
        },
        saveToFile: {
          clickAction: () => this.$store.dispatch("saveSelectedToFile"),
          icon: "mdi-download",
          tooltip: () =>
            this.isLite
              ? "Download the selected options (.csv)"
              : "Download the selected options, or every option when nothing is selected (.csv)",
          type: "misc",
        },
        openSummary: {
          clickAction: () => this.$store.dispatch("openSummary"),
          icon: "mdi-image-text",
          tooltip: () =>
            "Summary image: the goals, the shortlist, a chart and key findings on one picture to share",
          type: "misc",
        },
        captureView: {
          clickAction: () => this.$store.dispatch("captureView"),
          icon: "mdi-camera-outline",
          tooltip: () =>
            "Capture this view for the story: what is filtered or selected, the goals and the shortlist, with a note",
          type: "misc",
        },
        toggleStory: {
          clickAction: () =>
            this.$store.commit("setStoryPanel", {
              open: !this.$store.state.storyPanel.open,
            }),
          icon: "mdi-book-open-page-variant-outline",
          tooltip: () =>
            this.captureCount > 0
              ? "The story: " + this.captureCount + (this.captureCount === 1 ? " captured view" : " captured views") + " to present or make into a report"
              : "The story: views you capture, to present or make into a report",
          type: "misc",
        },
        shareStaticLink: {
          clickAction: () => this.isShareLinkModalOn = true,
          icon: "mdi-share-variant-outline",
          tooltip: () =>
            this.isStudySharable
              ? "Copy a link that reopens this dataset"
              : "Only datasets opened from a link can be shared",
          type: "misc",
        },
      },
      showContextMenu: false,
      rightClickPos: { x: 0, y: 0 },
      isShareLinkModalOn: false,
      shareCopied: false,
      isShortcutsDialogOn: false,
      isFeedbackOn: false,
      // Opened from the error notice rather than the help menu.
      feedbackFromError: false,
      appVersion: APP_VERSION,
      showWelcomeAtStart: readShowWelcome(),
      isClearWorkDialogOn: false,
      isTourDialogOn: false,
      isLayoutDialogOn: false,
      // Set while editing is turned on from the layout dialog, so answering
      // the prompt doesn't raise it again.
      layoutAsked: loadLayoutAsked(),
      // The reader's own arrangement, held while the tour borrows one.
      layoutBeforeTour: null,
      layoutPresets: LAYOUT_PRESETS,
      expertAdds: EXPERT_ADDS,
      dismissedNotice: "",
      // Whether an option is inspected; follows the store only when that
      // changes, not as inspection moves from option to option.
      isInspecting: false,
      // The page minus its scrollbar gutter and the app bar, so panels
      // mount at their final size. Re-measured on mount and on window resize.
      workspaceWidth: document.documentElement.clientWidth,
      workspaceHeight: Math.max(0, document.documentElement.clientHeight - BAR_HEIGHT),
      barHeight: BAR_HEIGHT,
      // For fitting the toolbar; kept current on every resize, not debounced.
      windowWidth: window.innerWidth,
    };
  },
  destroyed() {},
  beforeDestroy() {
    if (this.workspaceObserver) this.workspaceObserver.disconnect();
    window.removeEventListener("resize", this.onWorkspaceResize);
    document.removeEventListener("click", this.onDocumentClick);
    clearTimeout(this.resizeTimer);
    clearTimeout(this.copiedTimer);
    clearTimeout(this.tourDialogTimer);
    clearTimeout(this.columnsTimer);
  },
  created() {
    document.title = "DesignSense";
    //To close the context menu when a click happens anywhere
    this.onDocumentClick = (e) => {
      //To prevent the context menu from closing when the click is on it
      let contextMenuNode = d3.select(".vue-radial-menu-container")
        ._groups[0][0];
      if (e.target !== contextMenuNode) {
        this.showContextMenu = false;
      }
    };
    document.addEventListener("click", this.onDocumentClick);

    this.track();
    // Each loaded dataset mounts a new workspace. The welcome screen stays
    // up across the startup loads of a first visit, until it is closed or
    // the user loads data of their own.
    let startup = loadState.source === null || loadState.source === "startup";
    this.$store.commit("setIsOpeningDialogOn", {
      value: welcome.pending && startup && !tour.pending,
    });
    if (!startup) welcome.pending = false;
    // A tour started from other data loads the sample first; the workspace
    // that sample mounts starts the tour.
    if (tour.pending && loadState.source === "tour") {
      tour.pending = false;
      setTimeout(() => this.$tours["onboardingTour"].start(), 300);
    }
  },
  mounted() {
    this.$watch(
      () => this.$store.state.hovered != null,
      (value) => {
        this.isInspecting = value;
      },
      { immediate: true }
    );
    this.measureWorkspace();
    // A dataset of the user's own, opened for the first time: say how its
    // columns were read, once the workspace has drawn behind the dialog.
    if (this.ownDataLoaded && !loadColumnRoles(this.$store.state.datasetKey).reviewed) {
      this.columnsTimer = setTimeout(() => {
        this.$store.commit("setColumnsDialog", { open: true });
      }, 700);
    }
    // The observer also catches size changes no window resize event reports;
    // both feed the same delayed measurement.
    window.addEventListener("resize", this.onWorkspaceResize);
    if (window.ResizeObserver) {
      this.workspaceObserver = new ResizeObserver(this.onWorkspaceResize);
      this.workspaceObserver.observe(this.$refs.workspace);
    }

    let contextMenuCenter = this.$el.getElementsByClassName(
      "vue-radial-menu-container"
    )[0];

    contextMenuCenter.addEventListener("wheel", () => {
      this.moveToNextOperation();
    });

  },
  computed: {
    ...mapState({
      currentSelectionOperation: (state) => state.currentSelectionOperation,
      layouts: (state) => state.layouts,
      isEditingMode: (state) => state.isEditingMode,
      isInspectionMode: (state) => state.isInspectionMode,
      isInspectionPinned: (state) => state.isInspectionPinned,
      shareLink:  (state) => state.shareLink,
      isStudySharable: (state) => state.isStudySharable,
      uiMode: (state) => state.uiMode,
      shownCount: (state) => state.data.length,
      dataStack: (state) => state.dataStack,
      filterHistory: (state) => state.filterHistory,
      filterFuture: (state) => state.filterFuture,
      selectionHistory: (state) => state.selectionHistory,
      selectionFuture: (state) => state.selectionFuture,
    }),
    ...mapGetters([
      "can",
      "captureCount",
      "cartCount",
      "isInCart",
      "isExpert",
      "isLite",
      "isFilterActive",
      "hasScope",
      "selectionCount",
    ]),
    isOpeningDialogOn: {
      get() {
        return this.$store.state.isOpeningDialogOn;
      },
      set(value) {
        if (!value) welcome.pending = false;
        this.$store.commit("setIsOpeningDialogOn", { value: value });
      },
    },
    /** What the welcome screen says about the data open behind it. */
    welcomeDataset() {
      if (loadState.loading) {
        return { title: "Look around", text: "The data is loading…" };
      }
      let count = this.$store.state.rawData.length;
      let options = count.toLocaleString() + (count === 1 ? " option" : " options");
      let preset = presetFor(loadState.link);
      let shared = loadState.source === "startup" && loadState.link !== DEFAULT_DATASET_URL;
      if (shared && !preset) {
        return { title: "Shared with you", text: "The link you opened holds " + options + "." };
      }
      if (preset) {
        return {
          title: shared ? "Shared with you" : "Look around",
          text: "The " + preset.name + " sample is open: " + options + ".",
        };
      }
      return { title: "Look around", text: "Your data is open: " + options + "." };
    },
    storeNotice() {
      return this.$store.state.notice;
    },
    cartTooltip() {
      if (this.cartCount === 0) {
        return "The shortlist: options you keep aside while browsing";
      }
      return (
        this.cartCount +
        (this.cartCount === 1 ? " option " : " options ") +
        "on the shortlist"
      );
    },
    layoutQuestion() {
      return this.layoutAsked
        ? "How your workspace is arranged"
        : "How would you like your workspace arranged?";
    },
    layoutPreset() {
      return this.$store.state.layoutPreset;
    },
    loadState() {
      return loadState;
    },
    shortcutRows() {
      let keys = [
        ["Esc", "Stop inspecting; press again to clear every filter (Lite) or the selection (Expert)"],
        ["Ctrl+Z", "Undo the last filter or selection change"],
        ["Ctrl+Y or Ctrl+Shift+Z", "Redo"],
        ["/ or Ctrl+K", "Ask or command in the assistant bar"],
        ["Space (hold)", "Inspect whatever the pointer is over"],
        ["P", "Pin the inspected option (Expert)"],
        ["1 to 5", "Pick a selection operation: replace, add, subtract, toggle, intersect (Expert)"],
        ["Shift / Ctrl (hold)", "Add / subtract while brushing; both to intersect (Expert)"],
        ["`", "Edit the layout (Expert)"],
      ];
      let mouse = [
        ["Click an option", "Inspect it; click it again to stop"],
        ["Drag on a chart", "Filter (Lite) or select (Expert) the options inside"],
        ["Drag again on the same chart", "Lite: add another range, matching either"],
        ["Click empty chart space", "Clear that chart's filter or selection"],
        ["Drag an axis title", "Reorder the parallel coordinates axes"],
        ["Double-click an axis title", "Flip that axis"],
        ["Right-click the workspace", "Quick actions"],
        ["Click the current star", "Clear a rating"],
      ];
      return { keys: keys, mouse: mouse };
    },
    /**
     * What the last load left to say. The load dialog shows its own errors, so
     * only a load nobody watched reports one here.
     */
    /** Whether the user loaded this dataset themselves, from a file or a link. */
    ownDataLoaded() {
      return (
        (loadState.source === "file" || loadState.source === "url") &&
        !!loadState.columns
      );
    },
    latestError() {
      return errorState.latest;
    },
    loadNotice() {
      if (loadState.error) {
        let unwatched =
          loadState.source === "startup" || loadState.source === "tour";
        return unwatched ? loadState.error : "";
      }
      return [loadState.notice]
        .concat(loadState.warnings)
        .filter(Boolean)
        .join(" ");
    },
    showLoadNotice: {
      get() {
        return this.loadNotice !== "" && this.loadNotice !== this.dismissedNotice;
      },
      set(value) {
        if (!value) this.dismissedNotice = this.loadNotice;
      },
    },
    // Panels sit on a grid stretched over the workspace, so they fill any screen.
    unitW() {
      return this.workspaceWidth / LAYOUT_COLUMNS;
    },
    unitH() {
      return this.workspaceHeight / LAYOUT_ROWS;
    },
    /**
     * Toolbar actions that would do nothing right now, by name, worked out
     * once per change for every button.
     */
    disabledActions() {
      let disabled = {};
      Object.keys(this.actions).forEach((name) => {
        disabled[name] = this.isActionDisabled(name);
      });
      return disabled;
    },
    /** Undo, redo and clear: after the filters or the selection, in both modes. */
    historyActions() {
      return ["undo", "redo", "resetAllMarkings"];
    },
    // After the shortlist, which the group draws first.
    resultActions() {
      return ["createSet", "compareResult"];
    },
    /**
     * How much the toolbar shows, from the window's width. One place decides
     * for every part of the bar, so they can't disagree: three breakpoints of
     * their own once left a band where the selection was drawn over the
     * assistant.
     */
    barLevel() {
      if (this.windowWidth < BAR_TIGHT[this.isLite ? "lite" : "expert"]) return "tight";
      if (this.isExpert && this.windowWidth >= BAR_ROOMY) return "roomy";
      return "normal";
    },
    dataActions() {
      return [
        "zoomToSelection",
        "excludeSelection",
        "invertSelection",
        "undoDataTransformation",
        "resetData",
      ];
    },
    contextMenuItems() {
      if (this.isLite) {
        return [
          "clearInspection",
          "addSelectionToCart",
          "resetAllMarkings",
          "createSet",
          "zoomToSelection",
          "excludeSelection",
          "undo",
        ];
      }
      return [
        "toggleInspectionMode",
        "togglePinInspection",
        "clearInspection",
        "addSelectionToCart",
        "resetAllMarkings",
        "createSet",
        "excludeSelection",
        "zoomToSelection",
        "undoDataTransformation",
      ];
    },
  },
  watch: {
    showWelcomeAtStart(value) {
      writeShowWelcome(value);
    },
    currentSelectionOperation: {
      immediate: true,
      handler() {
        this.updateSelectionCursor();
      },
    },
    uiMode() {
      this.updateSelectionCursor();
    },
  },
  methods: {
    accessibleName: accessibleName,
    track() {
      this.$gtag.pageview("/");
    },
    /** The tour walks through the sample data; loading it replaces other data, so ask first. */
    requestTour() {
      if (loadState.link === DEFAULT_DATASET_URL) {
        this.startTour({ reload: false });
      } else {
        this.isTourDialogOn = true;
      }
    },
    startTour(options) {
      // The tour starts in Lite, then introduces Expert.
      this.$store.dispatch("setUiMode", "lite");
      // Several steps point at a panel, and vue-tour ends the tour on a
      // step whose target is not on screen. So the tour borrows an
      // arrangement holding every panel, and endTour hands back theirs.
      this.layoutBeforeTour = {
        layouts: this.layouts.map((panel) => Object.assign({}, panel)),
        preset: this.layoutPreset,
      };
      this.$store.commit("applyLayoutPreset", { id: "balanced" });
      if (options && options.reload === false) {
        this.$store.dispatch("clearFilters");
        this.$tours["onboardingTour"].start();
        return;
      }
      tour.pending = true;
      loadDataset(DEFAULT_DATASET_URL, { source: "tour" })
        .then((dataset) => {
          if (!dataset) tour.pending = false;
        })
        .catch(() => {
          tour.pending = false;
          /* loadState.error carries the message */
        });
    },
    chooseLayoutPreset(id) {
      this.$store.commit("applyLayoutPreset", { id: id });
      this.isLayoutDialogOn = false;
    },
    /** The one way out of the dialog that turns layout editing on. */
    /**
     * The layout menu's Edit: straight to editing, since the presets that
     * editing otherwise offers first are the next item in the same menu.
     */
    openFeedback(fromError) {
      this.feedbackFromError = fromError;
      this.isOpeningDialogOn = false;
      this.isFeedbackOn = true;
    },
    reviewColumns() {
      this.showLoadNotice = false;
      this.$store.commit("setColumnsDialog", { open: true });
    },
    dismissError() {
      errorState.latest = null;
    },
    toggleLayoutEditing() {
      if (this.isEditingMode) this.$store.dispatch("toggleEditingMode");
      else this.arrangeLayoutMyself();
    },
    arrangeLayoutMyself() {
      this.isLayoutDialogOn = false;
      // The action, not the mutation: only Expert may edit the layout.
      this.$store.dispatch("toggleEditingMode", { value: true });
    },
    /** Mid-drag: show it, but don't save it or forget the preset yet. */
    onSeamPreview(layouts) {
      this.$store.commit("setLayouts", {
        layouts: layouts,
        persist: false,
        keepPreset: true,
      });
    },
    /** A seam changes the panels' proportions, so the preset still applies. */
    onSeamCommit() {
      this.$store.commit("setLayouts", {
        layouts: this.layouts,
        keepPreset: true,
      });
    },
    chooseWelcomeLayout(id) {
      this.$store.commit("applyLayoutPreset", { id: id });
      if (this.layoutAsked) return;
      this.layoutAsked = true;
      saveLayoutAsked();
    },
    resetLayout() {
      this.$store.commit("toggleEditingMode", { value: false });
      this.$store.commit("resetLayouts");
    },
    copyShareLink() {
      let done = () => {
        this.shareCopied = true;
        clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => (this.shareCopied = false), 2000);
      };
      let fallback = () => {
        let field = this.$refs.shareField;
        let input = field && field.$el.querySelector("input");
        if (!input) return;
        input.select();
        try {
          if (document.execCommand("copy")) done();
        } catch (e) {
          /* the link stays selected, to copy by hand */
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.shareLink).then(done, fallback);
      } else {
        fallback();
      }
    },
    compareCart() {
      this.$store.dispatch("openCompare", { source: "cart" });
    },
    saveCartAsSet() {
      this.$store.dispatch("saveCartAsSet", { name: "" });
    },
    addResultToCart() {
      this.$store.dispatch("addResultToCart");
    },
    clearCart() {
      this.$store.dispatch("clearCart");
    },
    onNoticeInput(value) {
      if (!value) this.$store.commit("dismissNotice");
    },
    runNoticeAction() {
      let notice = this.storeNotice;
      let action = notice ? notice.action : null;
      if (action === "undoRemoveSet") {
        this.$store.commit("restoreRemovedSet");
      } else if (action === "restoreCart") {
        this.$store.dispatch("restoreCart");
      } else if (action && action.indexOf("undoSaveCart:") === 0) {
        // The saved set's id travels in the action, so undo removes that set.
        this.$store.dispatch("undoSaveCartAsSet", {
          setID: action.slice("undoSaveCart:".length),
        });
      }
      this.$store.commit("dismissNotice");
    },
    setUiMode(mode) {
      if (mode) this.$store.dispatch("setUiMode", mode);
    },
    /** Puts the workspace in `mode` for a tour step, then runs its setup. */
    prepareTourStep(mode, setup) {
      let store = this.$store;
      store.commit("toggleEditingMode", { value: false });
      // The steps that read a dialog or the sets' drawer open it themselves;
      // every other step is about the workspace, which those cover. Closing
      // here also means stepping backwards past one leaves nothing behind.
      store.dispatch("closeCompare");
      store.dispatch("closeSensitivity");
      store.commit("setSetsDrawer", { open: false });
      let switching = store.state.uiMode !== mode;
      if (switching) store.dispatch("setUiMode", mode);
      // Give the panels time to re-render, so the step finds its target. A
      // setup that needs longer than that says so by returning the time.
      let wait = switching ? 400 : 50;
      let setupWait = setup ? setup() : 0;
      if (typeof setupWait === "number" && setupWait > wait) wait = setupWait;
      return new Promise((resolve) => setTimeout(resolve, wait));
    },
    /** Leaves nothing the tour opened behind when it is finished or skipped. */
    endTour() {
      document.body.style.pointerEvents = "all";
      if (this.layoutBeforeTour) {
        this.$store.commit("setLayouts", {
          layouts: this.layoutBeforeTour.layouts,
          keepPreset: true,
        });
        this.$store.commit("setLayoutPreset", {
          id: this.layoutBeforeTour.preset,
        });
        this.layoutBeforeTour = null;
      }
      this.$store.dispatch("closeCompare");
      this.$store.dispatch("closeSensitivity");
      this.$store.commit("setSetsDrawer", { open: false });
    },
    /** Filters the tour's used-car data, so the filter chips have something to show. */
    showTourFilter() {
      let dims = this.$store.state.numericDimensions;
      if (!dims.includes("price") || !dims.includes("year")) return;
      this.$store.dispatch("setRangeFilters", {
        ranges: { price: [4000, 12000], year: [2006, 2015] },
      });
    },
    /** A set to show, in the drawer opened to stay while the step points at it. */
    openTourSets() {
      if (this.$store.state.setsIDs.length === 0) {
        this.$store.dispatch("createSet");
      }
      this.$store.commit("setSetsDrawer", { open: true, pinned: true });
      // The drawer slides in over 0.2s; the step is placed beside it after.
      return 300;
    },
    /** Inspects one option, so the inspector is there to point at. */
    inspectTourOption() {
      let rows = this.$store.state.data;
      if (!rows || rows.length === 0) return 0;
      // An option with several views shows the switcher the step talks about.
      let several = rows.filter((row) => row.images && row.images.length > 1);
      this.$store.commit("hover", { hovered: several[0] || rows[0] });
      return 0;
    },
    /** A few options set aside, so the shortlist and Compare have content. */
    fillTourCart() {
      if (this.$store.state.cart.length > 0) return 0;
      let rows = this.$store.state.data || [];
      let ids = rows.slice(0, 4).map((row) => row._id);
      if (ids.length > 0) this.$store.commit("addToCart", { ids: ids });
      return 0;
    },
    openTourCompare() {
      this.fillTourCart();
      this.$store.dispatch("openCompare", { source: "cart" });
      return this.settleTourDialog();
    },
    openTourSensitivity() {
      this.$store.dispatch("openSensitivity");
      return this.settleTourDialog();
    },
    /**
     * A dialog grows into place over 0.3s, and the step is put beside whatever
     * size it has by then. The step follows its target on a window resize, so
     * one is sent once the dialog has stopped moving.
     */
    settleTourDialog() {
      clearTimeout(this.tourDialogTimer);
      this.tourDialogTimer = setTimeout(
        () => window.dispatchEvent(new Event("resize")),
        700
      );
      return 400;
    },
    /** The last step hands back a clear workspace, minus the tour's filters. */
    clearTourExample() {
      this.$store.dispatch("clearFilters");
      this.$store.dispatch("clearInspection");
      this.$store.commit("setSetsDrawer", { open: false });
      return 0;
    },
    measureWorkspace() {
      let el = this.$refs.workspace;
      if (!el) return;
      this.workspaceWidth = el.clientWidth;
      this.workspaceHeight = el.clientHeight;
    },
    // Resizing rebuilds every chart, so wait until the size settles.
    onWorkspaceResize() {
      this.windowWidth = window.innerWidth;
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(this.measureWorkspace, 150);
    },
    /**
     * For the toolbar groups: they call this while rendering, so the disabled
     * states are theirs to depend on, and Demo doesn't re-render with them.
     */
    actionDisabled(name) {
      return !!this.disabledActions[name];
    },
    /** Whether a toolbar action would do nothing right now. */
    isActionDisabled(name) {
      // Zoom and exclude act on the filter result in Lite, the selection in Expert.
      let count = this.isLite
        ? this.isFilterActive
          ? this.selectionCount
          : 0
        : this.selectionCount;
      switch (name) {
        case "undo":
          return (
            (this.isLite ? this.filterHistory : this.selectionHistory)
              .length === 0
          );
        case "redo":
          return (
            (this.isLite ? this.filterFuture : this.selectionFuture).length ===
            0
          );
        case "zoomToSelection":
        case "excludeSelection":
          return count === 0 || count >= this.shownCount;
        case "undoDataTransformation":
          return this.isLite ? !this.hasScope : this.dataStack.length === 0;
        case "resetData":
          return !this.hasScope;
        case "invertSelection":
          // Nothing to invert until something is filtered out.
          return this.isLite ? !this.isFilterActive : false;
        case "resetAllMarkings":
          return this.isLite ? !this.isFilterActive : false;
        case "clearInspection":
          return !this.isInspecting;
        case "addSelectionToCart":
        case "createSet":
          return count === 0;
        case "compareResult":
          return count === 0;
        case "saveToFile":
          // Lite downloads the matches, so when nothing matches there is nothing to download.
          return this.isLite && this.isFilterActive && this.selectionCount === 0;
        default:
          return false;
      }
    },
    // Toggles light up while on; other toolbar buttons keep the bar's color.
    toolbarColor(type) {
      if (
        type === "inspecting" ||
        type === "inspectionPin" ||
        type === "editing"
      ) {
        return this.actionType2Color(type);
      }
      return undefined;
    },
    updateSelectionCursor() {
      applySelectionCursor(
        document.body,
        this.can("selectionOperations") ? this.currentSelectionOperation : null
      );
    },
    moveToNextOperation() {
      if (!this.can("selectionOperations")) return;
      let current = this.$store.state.currentSelectionOperation;
      let allOperationsValues = Object.values(operations);
      let index = allOperationsValues.findIndex((x) => x == current);
      let newOperation =
        allOperationsValues[(index + 1) % allOperationsValues.length];
      this.$store.commit("changeSelectionOperation", newOperation);
    },
    actionType2Color: function(type) {
      return {
        data: "red",
        selection: "blue",
        misc: "black",
        inspecting: this.isInspectionMode ? "green accent-4" : "grey",
        inspectionPin: this.isInspectionPinned ? "green accent-4" : "grey",
        editing: this.isEditingMode ? "green accent-4" : "grey",
      }[type];
    },
    showContextMenuHandler(e) {
      //TODO: change this.
      //A cheap trick to make sure the context menu does not appear on the 3D viewer DOM.
      //console.log(e.target)
      if (
        !e.target.id.includes("inspector") &&
        e.target.localName != "canvas" &&
        e.target.localName != "textarea"
      ) {
        e.preventDefault();
        this.rightClickPos = { x: e.clientX, y: e.pageY };
        this.showContextMenu = true;
        this.$refs.contextMenu.isOpen = true;
      }
    },
    handleContextMenuClick(item) {
      // console.log(item);
    },
  },
};

// TODO create refs here in the app to the other charts so that charts can refer to each other using this.$parent.pcoords
// Or have a method in parent called highlight() which is invoked from charts to which the parent App then responds by highlighting the other charts accordingly..
//This could take into account
</script>

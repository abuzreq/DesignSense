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
        <!-- The mark itself rather than a link to the file: no second request,
             and the bar wants its own colours -- the frame lifted and the rails
             dropped, since on this grey the pale rails of the favicon would be
             the brightest thing in the bar. Hidden from a screen reader, which
             has the name beside it. -->
        <svg
          class="ds-mark"
          viewBox="0 0 48 48"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4.5 3 H24 A21 21 0 0 1 24 45 H4.5 Z"
            fill="none"
            stroke="#5b9bd0"
            stroke-width="3.5"
            stroke-linejoin="round"
          />
          <g fill="#4a5b68">
            <rect x="9" y="7.75" width="23.5" height="2.5" rx="1.25" />
            <rect x="9" y="15.25" width="30.5" height="2.5" rx="1.25" />
            <rect x="9" y="22.75" width="32.25" height="2.5" rx="1.25" />
            <rect x="9" y="30.25" width="30.5" height="2.5" rx="1.25" />
            <rect x="9" y="37.75" width="23.5" height="2.5" rx="1.25" />
          </g>
          <g fill="#f57c00">
            <rect x="18" y="6" width="14" height="6" rx="1" />
            <rect x="10" y="13.5" width="6" height="6" rx="1" />
            <rect x="10" y="21" width="22" height="6" rx="1" />
            <rect x="26" y="28.5" width="6" height="6" rx="1" />
            <rect x="10" y="36" width="14" height="6" rx="1" />
          </g>
        </svg>
        <span class="ds-wordmark"
          ><span class="ds-name-strong">design</span
          ><span class="ds-name-light">sense</span
          ><sup class="ds-stage">beta</sup></span
        >
      </v-toolbar-title>
      <v-divider vertical class="ds-divider" />

      <LoadDataModal id="loading-data-bar" ref="loadData" compact> </LoadDataModal>
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
        <!-- The layout: arrangements, editing and reset in one menu. While editing,
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
            <!-- Picking an arrangement is the common errand, so it is in the
                 menu itself. The click is stopped so trying two in a row
                 doesn't shut the menu between them; the items below close it
                 as menu items should. -->
            <div class="ds-layout-picks" id="layout-presets" @click.stop>
              <div class="ds-layout-picks-head">Arrangement</div>
              <LayoutPresetBar />
              <div class="ds-layout-tip">{{ dragTip }}</div>
            </div>
            <v-divider />
            <!-- Which views are on the workspace at all. Clicks are stopped
                 so turning two off doesn't shut the menu in between. -->
            <div class="ds-layout-picks-head ds-layout-picks-head--mid">
              Views
            </div>
            <v-list-item
              v-for="panel in panelChoices"
              :key="panel.type"
              :disabled="panel.locked"
              @click.stop="togglePanel(panel)"
            >
              <v-list-item-icon class="mr-3">
                <v-icon small :color="panel.shown ? 'primary' : undefined">{{
                  panel.shown
                    ? "mdi-checkbox-marked"
                    : "mdi-checkbox-blank-outline"
                }}</v-icon>
              </v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>{{ panel.label }}</v-list-item-title>
                <v-list-item-subtitle v-if="panel.locked">{{
                  panel.reason
                }}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
            <v-divider />
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
          <v-list-item @click="requestTour()">
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
          <v-list-item @click="openGuide()">
            <v-list-item-icon><v-icon>mdi-book-open-page-variant-outline</v-icon></v-list-item-icon>
            <v-list-item-title>Guide</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-dialog v-model="isShareLinkModalOn" max-width="620px">
      <v-card>
        <v-card-title>Share this dataset</v-card-title>
        <v-card-text>
          <template v-if="shareLink">
            <p>
              Anyone with this link opens the same dataset. It carries the
              data only: your filters, sets, shortlist, ratings and notes stay
              in this browser. To pass those on, send the summary image, the
              story's report or the CSV download.
            </p>
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
            folder) can be shared. Files from your computer can't: put the
            folder on a web server first, as
            <a
              :href="guideLinks.link"
              target="_blank"
              @click.prevent="openGuide(guideSections.link)"
              >the guide</a
            >
            shows.
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
            data: understand the design space, narrow it to the options worth
            pursuing, decide between them, and share the result.
          </p>
          <!-- Two pairs, because there are two questions a first visit asks:
               how this works, and what to look at. The tour walks it and the
               guide reads it; the sample is at hand and your own data is a
               folder away. -->
          <div class="ds-welcome-choices">
            <div class="ds-welcome-choice">
              <div class="ds-welcome-choice-head">
                <v-icon color="blue darken-1">mdi-map-marker-path</v-icon>
                New here?
              </div>
              <p>Walk through it once, or read it up front.</p>
              <div class="ds-welcome-choice-actions">
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
                <!-- A real link, so it can be opened in a tab of its own,
                     though a plain click keeps it in the dialog. -->
                <v-btn
                  color="blue darken-1"
                  outlined
                  depressed
                  :href="guideLinks.home"
                  target="_blank"
                  @click.prevent="openGuide()"
                >
                  <v-icon left small>mdi-book-open-page-variant-outline</v-icon>
                  Read the guide</v-btn
                >
              </div>
            </div>
            <div class="ds-welcome-choice">
              <div class="ds-welcome-choice-head">
                <v-icon color="teal">mdi-eye-outline</v-icon>
                {{ welcomeDataset.title }}
              </div>
              <p>Bring your own: a folder, a CSV file or a link.</p>
              <div class="ds-welcome-choice-actions">
                <v-btn
                  color="teal"
                  dark
                  depressed
                  :disabled="loadState.loading"
                  @click="isOpeningDialogOn = false"
                  >{{ welcomeDataset.action }}</v-btn
                >
                <LoadDataModal label="Load own data" />
              </div>
            </div>
          </div>
          <div class="ds-welcome-layout">
            <div class="ds-welcome-layout-head">{{ layoutQuestion }}</div>
            <p class="ds-welcome-layout-help">
              The charts and the pictures share the screen. Pick where you
              would like them; you can change it whenever you like from
              <v-icon small color="#546e7a"
                >mdi-view-dashboard-edit-outline</v-icon
              >
              in the toolbar, or by dragging the edge between two panels.
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
          <!-- The guide is a button above now, so it is not repeated here. -->
          <div class="ds-welcome-links">
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
    <!-- A link in the guide that opens a sample, with the user's own data on
         screen. -->
    <v-dialog :value="!!sampleAsked" max-width="460px" @input="sampleAsked = null">
      <v-card v-if="sampleAsked">
        <v-card-title>Open the sample?</v-card-title>
        <v-card-text>
          {{ sampleAsked.name }} replaces the dataset on screen. Your sets and
          ratings for this dataset are saved and come back when you load it
          again.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="sampleAsked = null">Cancel</v-btn>
          <v-btn color="primary" text @click="openSample(sampleAsked)"
            >Open the sample</v-btn
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
    <!-- Fetched when the guide is first asked for. -->
    <GuideDialog v-if="guideSeen" @app-link="followAppLink" />
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
  /* The mark and the name side by side; the name stays one inline run so the
     "beta" above it is still a superscript rather than a third flex item. */
  display: flex;
  align-items: center;
  gap: 8px;
}
.ds-mark {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
}
.ds-wordmark {
  font-family: "DM Sans", Roboto, sans-serif;
  letter-spacing: -0.01em;
}
/* One word, two weights: the halves are told apart by their weight rather
   than by a capital or a space. */
.ds-name-strong {
  font-weight: 700;
}
.ds-name-light {
  font-weight: 300;
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
/* The two actions in a card sit on one line, and wrap rather than squeeze. */
.ds-welcome-choice-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ds-welcome-choice {
  flex: 1 1 260px;
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
/* The arrangements at the head of the layout menu. */
.ds-layout-picks {
  padding: 6px 10px 8px;
}
.ds-layout-picks-head {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #78909c;
}
.ds-layout-picks-head--mid {
  padding: 8px 10px 2px;
}
/* The one thing the drawings cannot show. */
.ds-layout-tip {
  max-width: 230px;
  margin-top: 7px;
  font-size: 11.5px;
  line-height: 1.35;
  color: #78909c;
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
/* At the tightest bar the name gives way to the mark, which says as much in a
   third of the room -- and the room is what is short there. */
.ds-bar--tight .ds-wordmark {
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
  panelChoices,
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
// `at` is the task a link asked the tour to begin with (see appLinks.js).
const tour = { pending: false, at: null };

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
  "selection operations and the lasso, clusters, editing sets, inspection controls, the analysis panel, and layout editing";
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
import { GUIDE_SECTIONS, guideHref } from "@/guide.js";
import { presetById, presetFor } from "@/data/presets.js";
import { pendingAppLink } from "@/appLinks.js";
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
    GuideDialog: () =>
      import(/* webpackChunkName: "guide" */ "@/guide/GuideDialog.vue"),
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
      // The four tasks in turn -- understand, narrow, decide, share -- in
      // Lite, then what Expert adds. Each step names the mode it needs.
      // A step about the right-hand end of the toolbar is placed "bottom-end":
      // its right edge on its target's, where centred it would leave the window.
      onboardingStudyTourSteps: [
        tourStep(this, "lite", "#designsense-title", "Welcome to DesignSense",
          "DesignSense helps you with four tasks: <b>understand</b> a collection of design options through their pictures and data, <b>narrow</b> it to the options worth pursuing, <b>decide</b> between them, and <b>share</b> the result. This tour covers the tasks in that order and takes a few minutes. In real work you will move back and forth between them. Use the arrow keys or the buttons below to continue.",
          "bottom"),
        tourStep(this, "lite", "#ui-mode-toggle", "Lite and Expert",
          "In <b>Lite</b> mode you narrow the options with filters. <b>Expert</b> mode adds " + EXPERT_ADDS + ". The tour starts in Lite.",
          "bottom"),
        tourStep(this, "lite", "#loading-data-bar", "Load your data",
          "A study is a table with one row per option, stored with its pictures and 3D files. Colibri writes one from Grasshopper, and so can any tool of your own (<a href=\"" + guideHref(GUIDE_SECTIONS.generate) + "\" target=\"_blank\">how a study is made</a>). Here you can open a sample study, a link, or a folder or CSV file from your computer. Your data is read in your browser and is never uploaded. When you load your own data, DesignSense shows which columns it read as inputs, outputs and pictures, and you can correct them. This tour uses a small sample of used cars.",
          "bottom"),

        tourStep(this, "lite", '.v-card[type="Grid"]', "Understand · Gallery",
          "Start by looking at the options. The gallery shows every option as an image. Use the menu at the top to sort by any column and see how the designs change with it. The buttons on the right change the image size. Click an image to inspect that option, and click it again to stop inspecting.",
          "right"),
        tourStep(this, "lite", ".inspector_card", "Understand · A closer look",
          "The inspector shows the option you clicked. Its line and its dot are highlighted in the charts, so you can see its form and its performance together. The first button lists its values next to the image. If the option has several views, you can switch between them here, and if it has a 3D model, the cube button opens it. On the right you can rate the option, write a note on it, and add it to the shortlist.",
          "right", () => this.inspectTourOption()),
        tourStep(this, "lite", '.v-card[type="ParallelCoordinatesPlot"]', "Understand · Parallel coordinates",
          "Each axis is a dimension and each line is an option, so the lines together show the patterns in the whole collection. Drag an axis title to put two axes next to each other. Lines that run level between them mean the two dimensions rise together. Lines that cross mean one goes up as the other goes down. Use Axes to choose which dimensions are shown.",
          "left"),
        tourStep(this, "lite", "#colour-picker", "Understand · Colour",
          "One column sets the colours in every view: these lines, the dots in the scatterplot and the border of each image. Choose the column here, or click an axis title. The key next to it shows what the colours mean, and the palette button changes them.",
          "bottom"),
        tourStep(this, "lite", ".v-card[type='ScatterPlot']", "Understand · Scatterplot and overview",
          "Each dot is an option, positioned by the two dimensions chosen at the top, so the scatterplot shows that one relationship in detail. The overview next to it shows every pair of dimensions at once, and you can click a pair there to plot it. Click a dot to inspect that option.",
          "left", () => this.openTourOverview()),

        tourStep(this, "lite", "#filter-bar", "Narrow · Your filters",
          "To keep only the options that meet your criteria, drag along an axis, or drag a box in the scatterplot or over images in the gallery. Each filter appears here as a chip, and the count shows how many options match. Remove a chip to remove its filter. The arrows undo and redo your changes, and the last button clears every filter. Esc stops inspecting, and pressing it again clears the filters.",
          "bottom", () => this.showTourFilter()),
        tourStep(this, "lite", "#assistant-bar", "Narrow · Ask or command",
          "Type a request in plain words, such as “price under 10000” or “what do these have in common”. The assistant carries it out or answers the question. Press / to jump here from anywhere.",
          "bottom"),
        tourStep(this, "lite", "#data-operations-bar", "Narrow · Navigate",
          "Zoom in makes the remaining options the whole collection. The charts rescale to fit them, and you can filter again within them. Exclude removes those options from the collection instead. Step back undoes the last zoom or exclusion, and Reset restores the whole collection.",
          "bottom"),
        tourStep(this, "lite", "#cart-chip", "Narrow · Your shortlist",
          "An option that a filter removes may still be worth pursuing, so you can set options aside on the shortlist. The badge shows how many are on it. The shortlist is not affected by filtering, zooming or switching modes, so your candidates stay there while you keep looking. From this menu you can add everything currently shown to the shortlist, save the shortlist as a set, or compare its options.",
          "bottom-end", () => this.fillTourCart()),
        tourStep(this, "lite", "#sets-drawer", "Narrow · Saved sets",
          "A set saves the current options together with the filters that produced them. Restore a set later to continue from that point. You can keep several sets as alternative directions and compare them. Sets are kept in a drawer at the left edge. Move the pointer there or click the tab to open it.",
          "right", () => this.openTourSets()),

        dialogTourStep(this, "lite", ".dims-dialog", "Decide · Goals and your own criteria",
          "Set which direction is better for each output. In this example, a lower price and a later year are better. Arrows on the axes then show the better direction, and DesignSense can find the best trade-offs. Further down you can add criteria that are not in the data. A custom dimension holds values you enter by hand, such as a score for looks. A weighted dimension combines several columns into one score.",
          () => this.openTourDimensions()),
        tourStep(this, "lite", ".v-card[type='ScatterPlot']", "Decide · Best trade-offs",
          "When both axes have a goal, this line connects the options that no other option beats on both. The button for it is at the top right of this panel. To find the best trade-offs across all your goals at once, ask the assistant for “the best trade-offs”.",
          "left", () => this.showTourTradeOffs()),
        dialogTourStep(this, "lite", ".cmp-card", "Decide · Compare",
          "Compare shows up to eight options side by side, with their measured values and your own judgements in one table. Each column has the option's image, its rating and a shortlist button. Rows where every option has the same value are dimmed, and in numeric rows the highest and lowest values are marked. Click a row name to sort the columns by that row.",
          () => this.openTourCompare()),

        tourStep(this, "lite", "#share-menu", "Share · Share and present",
          "Capture views as you work. Each capture saves the filters, goals and shortlist, with a note. You can present your captures in a meeting or turn them into a PDF report. This menu also has a CSV download of the remaining options and a link that opens the same dataset for someone else. The link contains only the data, without your filters or sets.",
          "bottom-end"),
        dialogTourStep(this, "lite", ".sm-card", "Share · Summary image",
          "The summary puts the outcome on one image. It shows the shortlisted options, how they compare with the rest, and findings that you can edit. Download the image, or copy it into a slide, an email or a chat.",
          () => this.openTourSummary()),

        tourStep(this, "expert", "#ui-mode-toggle", "Expert mode",
          "Expert mode has everything you have seen so far and adds " + EXPERT_ADDS + ". In Expert you build a selection instead of filtering.",
          "bottom"),
        tourStep(this, "expert", "#selection-operations-bar", "Expert · Selection operations",
          "Choose how each new selection combines with the current one: replace, add, subtract, toggle or intersect. You can also hold Shift to add, Ctrl to subtract, or both to intersect.",
          "bottom"),
        tourStep(this, "expert", "#sets-operations-bar", "Expert · Save and compare",
          "Add the selected options to the shortlist, save them as a set, or compare them side by side. Inverting the selection is under Navigate. Undo, redo and clear are next to the selection.",
          "bottom"),
        tourStep(this, "expert", ".v-card[type='ScatterPlot'] div.cluster-view", "Expert · Clusters",
          "Clusters are another way to understand a large collection. They group options that are similar on the dimensions you choose. Each image represents one group. Click an image to select the whole group.",
          "left", () => this.$store.commit("setClusteringPanelOpen", { value: true })),
        tourStep(this, "expert", ".inspector_card", "Expert · Inspection",
          "Click any option to inspect it, or hold Space and move the pointer over options. The pointer button here turns on inspecting on hover, so you do not have to hold Space. The pin keeps an option in the inspector after you move away. Both are also in the right-click menu.",
          "right", () => this.inspectTourOption()),
        dialogTourStep(this, "expert", ".sx-card", "Expert · Analysis",
          "Analysis summarises the whole collection. At the top it shows the average, standard deviation and spread of every dimension. Next come the outliers, which you can leave out of the analysis, and the best trade-offs for the goals you set under Dimensions, which you can keep with one click. The last part shows which inputs affect which outputs. Tell it which columns are inputs and which are outputs, or start their names with in: and out: in the file. It offers three measures, and each answers a different question. The panel also notes that these results depend on how well the design space was sampled.",
          () => this.openTourSensitivity()),
        tourStep(this, "expert", "#editing-mode", "Expert · Your layout",
          "Use this menu to choose an arrangement of the panels and which views are shown. Drag the edge between two panels to resize them. To move a panel, turn on editing from this menu. Press Done or the ` key when you have finished.",
          "bottom-end"),
        tourStep(this, "lite", "#help-menu", "You're ready",
          "You are back in Lite. Switch to Expert whenever you need more control, and right-click the workspace for quick actions. This menu lets you take the tour again, see every keyboard shortcut, and open the guide. The guide follows a study from making the data through the same four tasks. To tell us what works and what does not, use Send feedback in this menu.",
          "bottom-end", () => this.clearTourExample()),
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
      guideSections: GUIDE_SECTIONS,
      guideLinks: { home: guideHref(), link: guideHref(GUIDE_SECTIONS.link) },
      // Whether the guide has been asked for in this workspace.
      guideSeen: false,
      showWelcomeAtStart: readShowWelcome(),
      isClearWorkDialogOn: false,
      isTourDialogOn: false,
      // The sample a link in the guide asked for, while that is confirmed.
      sampleAsked: null,
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
    clearTimeout(this.linkTimer);
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

    // Each loaded dataset mounts a new workspace, and a first visit mounts
    // two of them: main.js puts a placeholder collection up at once and then
    // replaces the whole application when the sample arrives.
    let startup = loadState.source === null || loadState.source === "startup";
    // Someone who followed a link to a sample, the tour or a dialog came
    // for that, not to be welcomed.
    if (pendingAppLink.asked) welcome.pending = false;
    // So the welcome waits for the mount that has the data. Opened on the
    // placeholder it was shown, torn down with that application and shown
    // again a moment later, which reads as the welcome arriving twice -- and
    // the wait between the two grew with the bundle until it plainly was.
    // `startup` still counts the placeholder, because the line further down
    // has to treat both mounts as one arrival.
    this.$store.commit("setIsOpeningDialogOn", {
      value: welcome.pending && loadState.source === "startup" && !tour.pending,
    });
    // Unless the second mount never comes. A startup load that fails puts its
    // reason on loadState and returns without mounting (loader.js), so this
    // placeholder application is the one the reader is left looking at, and
    // the only thing left that can open the welcome.
    if (loadState.source === null) {
      let stopWaiting = this.$watch(
        () => loadState.error,
        (error) => {
          if (!error) return;
          if (stopWaiting) stopWaiting();
          if (!welcome.pending || tour.pending) return;
          this.$store.commit("setIsOpeningDialogOn", { value: true });
        }
      );
    }
    this.$watch(
      () => this.$store.state.guideDialog.open,
      (open) => {
        if (open) this.guideSeen = true;
      }
    );
    if (!startup) welcome.pending = false;
    // A tour started from other data loads the sample first; the workspace
    // that sample mounts starts the tour.
    if (tour.pending && loadState.source === "tour") {
      tour.pending = false;
      let at = this.takeTourStart();
      setTimeout(() => this.$tours["onboardingTour"].start(at), 300);
    } else if (pendingAppLink.tour && loadState.source === "tour") {
      // The address asked for the tour: nothing has made room for it yet.
      tour.at = pendingAppLink.tour;
      pendingAppLink.tour = null;
      setTimeout(() => this.startTour({ reload: false }), 300);
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
    // A dialog the address asked for, once there is a dataset behind it.
    if (pendingAppLink.open && this.$store.state.datasetKey) {
      let what = pendingAppLink.open;
      pendingAppLink.open = null;
      this.linkTimer = setTimeout(() => this.openFromLink(what), 600);
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
      // The button closes the dialog on whatever is already loaded, which is
      // a sample at an ordinary startup but somebody else's collection when a
      // share link brought you here -- so it cannot call it a sample then.
      // A link to one of the samples is not somebody else's work, and the
      // preset list is what says so: against the default dataset alone,
      // opening the AIA building by link read as a stranger's study.
      let shared =
        loadState.source === "startup" &&
        !!loadState.link &&
        !presetFor(loadState.link);
      return shared
        ? { title: "Shared with you", action: "Look at it" }
        : { title: "Look around", action: "Try on a sample dataset" };
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
    /** Which views are on the workspace, for the layout menu's checklist. */
    panelChoices() {
      return panelChoices(this.layouts);
    },
    /** How to change the arrangement by hand, in a line. */
    dragTip() {
      return this.can("layoutEditing")
        ? "Drag the edge between two panels to resize them, or edit the layout to move one."
        : "Drag the edge between two panels to resize them.";
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
    /**
     * Whether the user loaded this dataset themselves, from a file, a folder
     * or a link.
     */
    ownDataLoaded() {
      return (
        (loadState.source === "file" ||
          loadState.source === "folder" ||
          loadState.source === "url") &&
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
    /**
     * Inverting is off the bar in Lite. Zoom and exclude are the two moves
     * that matter there and they read straight off their icons; "everything
     * the filters leave out" is a turn of thought that needs explaining, and
     * a button nobody presses costs the ones beside it room. The assistant
     * still does it on request, and Expert keeps the button.
     */
    dataActions() {
      return [
        "zoomToSelection",
        "excludeSelection",
        ...(this.isLite ? [] : ["invertSelection"]),
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
    /**
     * The tour walks through the sample data; loading it replaces other data,
     * so ask first. `at` is the task to begin with, from the start if none.
     */
    requestTour(at) {
      tour.at = typeof at === "string" ? at : null;
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
        // The scatterplot's side panel: the tour shows the overview, then
        // the clusters in its place.
        matrix: this.$store.state.isMatrixPanelOpen,
        clusters: this.$store.state.isClusteringPanelOpen,
      };
      this.$store.commit("applyLayoutPreset", { id: "balanced" });
      if (options && options.reload === false) {
        this.$store.dispatch("clearFilters");
        this.$tours["onboardingTour"].start(this.takeTourStart());
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
    /**
     * The guide over the workspace: at `section` (one of guide.js's), or
     * where it was last left.
     */
    openGuide(section) {
      this.$store.dispatch(
        "openGuide",
        typeof section === "string" ? { section: section } : undefined
      );
    },
    /**
     * The step the tour was asked to begin with: the first of a task's,
     * which sets up what it shows by itself. Asked once, then forgotten.
     */
    takeTourStart() {
      let task = tour.at;
      tour.at = null;
      if (!task || task === "start") return 0;
      let prefix = task.charAt(0).toUpperCase() + task.slice(1) + " ·";
      let index = this.onboardingStudyTourSteps.findIndex(
        (step) => step.header.title.indexOf(prefix) === 0
      );
      return index > 0 ? index : 0;
    },
    /**
     * A link in the guide that asks something of the app (see appLinks.js):
     * the guide steps aside, and the app does it here, on this screen.
     */
    followAppLink(link) {
      this.$store.dispatch("closeGuide");
      if (link.tour) {
        this.requestTour(link.tour);
      } else if (link.sample) {
        let preset = presetById(link.sample);
        if (!preset || loadState.link === preset.url) return;
        // A sample's own work is kept either way; data of the user's own
        // is not swapped out without a word.
        if (this.ownDataLoaded) this.sampleAsked = preset;
        else this.openSample(preset);
      } else if (link.open) {
        this.openFromLink(link.open);
      }
    },
    openSample(preset) {
      this.sampleAsked = null;
      loadDataset(preset.url, { source: "preset" }).catch(() => {
        /* loadState.error carries the message */
      });
    },
    /** A dialog a link names: "load" or "dimensions". */
    openFromLink(what) {
      if (what === "load" && this.$refs.loadData) {
        this.$refs.loadData.dialog = true;
      } else if (what === "dimensions") {
        this.$store.dispatch("openDimensionDialog", { mode: "manage" });
      }
    },
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
    /** The action, not the mutation: only Expert may edit the layout. */
    toggleLayoutEditing() {
      this.$store.dispatch("toggleEditingMode", {
        value: !this.isEditingMode,
      });
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
    togglePanel(panel) {
      if (panel.locked) return;
      this.$store.commit(panel.shown ? "closeLayout" : "openLayout", {
        type: panel.type,
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
      this.closeTourDialogs();
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
        this.$store.commit("setClusteringPanelOpen", {
          value: this.layoutBeforeTour.clusters,
        });
        this.$store.commit("setMatrixPanelOpen", {
          value: this.layoutBeforeTour.matrix,
        });
        this.layoutBeforeTour = null;
      }
      this.closeTourDialogs();
      this.$store.commit("setSetsDrawer", { open: false });
    },
    /** Every dialog a step of the tour opens. */
    closeTourDialogs() {
      this.$store.dispatch("closeCompare");
      this.$store.dispatch("closeSensitivity");
      this.$store.dispatch("closeDimensionDialog");
      this.$store.dispatch("closeSummary");
      this.$store.dispatch("closeGuide");
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
    /** The overview of dimension pairs, beside the scatterplot. */
    openTourOverview() {
      this.$store.commit("setMatrixPanelOpen", { value: true });
      return 300;
    },
    /**
     * Goals for the tour's used-car data, so the arrows, the Dimensions
     * dialog and the best trade-offs have something to show. Only where
     * nothing has been said yet: a goal the user set or took away is theirs.
     */
    setTourGoals() {
      let store = this.$store;
      let dims = store.state.numericDimensions;
      [["price", "min"], ["year", "max"]].forEach((pair) => {
        if (!dims.includes(pair[0])) return;
        if (store.getters.goalSource(pair[0]) !== null) return;
        store.dispatch("setGoal", { dim: pair[0], goal: pair[1] });
      });
    },
    openTourDimensions() {
      this.setTourGoals();
      this.$store.dispatch("openDimensionDialog", { mode: "manage" });
      return this.settleTourDialog();
    },
    /** The two dimensions with goals on the scatterplot, which then draws their front. */
    showTourTradeOffs() {
      this.setTourGoals();
      let store = this.$store;
      let dims = store.state.numericDimensions;
      if (dims.includes("price") && dims.includes("year")) {
        store.commit("setViewSetting", { key: "scatterX", value: "year" });
        store.commit("setViewSetting", { key: "scatterY", value: "price" });
      }
      return 300;
    },
    openTourSummary() {
      this.fillTourCart();
      this.$store.dispatch("openSummary");
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
    /**
     * A workspace of no width is the element not laid out yet, not a real
     * size: it is measured on mount, which a dialog over it or a style still
     * loading can beat. Taking it would make every panel zero and every
     * chart a negative width, so the window's own size, which the data
     * started from, is kept until there is something true to replace it.
     */
    measureWorkspace() {
      let el = this.$refs.workspace;
      if (!el) return;
      if (el.clientWidth > 0) this.workspaceWidth = el.clientWidth;
      if (el.clientHeight > 0) this.workspaceHeight = el.clientHeight;
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

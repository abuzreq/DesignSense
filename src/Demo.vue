<template>
  <v-app>
    <span
      id="designsense-center"
      style="display: none; position: relative; left: 50%; top: 50%"
    ></span>
    <v-app-bar
      app
      dark
      dense
      flat
      short
      color=" white--text text--lighten-1"
      height="60"
    >
      <v-toolbar-title id="designsense-title" class="ds-title">
        DesignSense
        <span class="ds-stage" style="font-size: 14px; color: deepskyblue"
          >beta</span
        >
      </v-toolbar-title>
      <v-divider vertical class="ds-divider" />

      <!-- Getting data in and out -->
      <LoadDataModal id="loading-data-bar" compact> </LoadDataModal>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <span v-on="on">
            <v-btn
              icon
              :disabled="actionDisabled('saveToFile')"
              @click="actions['saveToFile'].clickAction"
            >
              <v-icon>{{ actions["saveToFile"].icon }}</v-icon>
            </v-btn>
          </span>
        </template>
        <span>{{ actions["saveToFile"].tooltip() }}</span>
      </v-tooltip>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <!-- A disabled button swallows pointer events, so the span carries the tooltip. -->
          <span v-on="on">
            <v-btn
              :disabled="!isStudySharable"
              icon
              @click="actions['shareStaticLink'].clickAction"
            >
              <v-icon>{{ actions["shareStaticLink"].icon }}</v-icon>
            </v-btn>
          </span>
        </template>
        <span>{{ actions["shareStaticLink"].tooltip() }}</span>
      </v-tooltip>
      <v-divider vertical class="ds-divider" />

      <!-- Arranging the panels is about the workspace as a whole rather than
           about any one group of tools, so it stands on its own here. The
           wrapper stays whichever mode is on: a Vuetify tooltip places its
           activator in the bar itself, outside what Vue tracks, so appearing
           and disappearing beside one shifts it out of place. -->
      <div class="ds-layout-slot">
        <TipButton
          v-if="can('layoutEditing')"
          id="editing-mode"
          :icon="actions['toggleEditingMode'].icon"
          :tooltip="actions['toggleEditingMode'].tooltip()"
          :color="toolbarColor(actions['toggleEditingMode'].type)"
          @click="actions['toggleEditingMode'].clickAction"
        />
        <v-divider v-if="can('layoutEditing')" vertical class="ds-divider" />
      </div>

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
              <v-btn small value="lite">Lite</v-btn>
              <v-btn small value="expert">Expert</v-btn>
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

      <!-- How the collection is narrowed: filters in Lite, a selection in Expert -->
      <div class="ds-narrowing">
        <SelectionOperationsBar
          v-if="can('selectionOperations')"
          id="selection-operations-bar"
        />
        <FilterBar v-else id="filter-bar" />
      </div>

      <!-- Ask or command, in the same row: the list of suggestions floats
           below, so the bar stays one row tall. -->
      <AssistantBar ref="assistant" id="assistant-bar" />

      <v-divider vertical class="ds-divider" />
      <!-- The shortlist is reachable even when the Sets panel is closed. -->
      <v-menu bottom left offset-y>
        <template v-slot:activator="{ on: menu }">
          <v-tooltip bottom>
            <template v-slot:activator="{ on: tooltip }">
              <span v-on="tooltip">
                <v-btn id="cart-chip" icon v-on="menu">
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
          <v-list-item @click="addResultToCart">
            <v-list-item-icon><v-icon>mdi-playlist-plus</v-icon></v-list-item-icon>
            <v-list-item-title>Add the selected</v-list-item-title>
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
      <ToolbarGroup
        id="sets-operations-bar"
        :label="isLite ? 'Results' : 'Selection'"
        :names="selectionActions"
        :actions="actions"
        :disabled="actionDisabled"
      />
      <v-divider vertical class="ds-divider" />
      <ToolbarGroup
        id="data-operations-bar"
        label="Zoom"
        :names="dataActions"
        :actions="actions"
        :disabled="actionDisabled"
      />
      <!-- Lite inspects by clicking and stops with Esc or the inspector's
           close button, so only Expert has inspection controls and the
           analysis tools. -->
      <template v-if="isExpert">
        <v-divider vertical class="ds-divider" />
        <ToolbarGroup
          id="inspection-bar"
          label="Inspection"
          :names="inspectionActions"
          :actions="actions"
          :color="toolbarColor"
          :disabled="actionDisabled"
        />
        <v-divider vertical class="ds-divider" />
        <!-- Reading the collection as a whole rather than acting on it.
             Sensitivity is the first of these; others will join it. -->
        <ToolbarGroup id="analysis-bar" label="Analysis" :actions="actions">
          <v-tooltip v-if="can('sensitivity')" bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                id="sensitivity-button"
                v-on="on"
                icon
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
      <v-menu bottom left offset-y>
        <template v-slot:activator="{ on: menu }">
          <v-tooltip bottom>
            <template v-slot:activator="{ on: tooltip }">
              <span v-on="tooltip">
                <v-btn id="help-menu" icon v-on="menu">
                  <v-icon>mdi-help-circle-outline</v-icon>
                </v-btn>
              </span>
            </template>
            <span>Help, the tour, and shortcuts</span>
          </v-tooltip>
        </template>
        <v-list dense>
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
          <v-list-item @click="isLayoutDialogOn = true">
            <v-list-item-icon><v-icon>mdi-view-grid-outline</v-icon></v-list-item-icon>
            <v-list-item-title>Layout presets…</v-list-item-title>
          </v-list-item>
          <v-list-item @click="resetLayout">
            <v-list-item-icon><v-icon>mdi-view-dashboard-outline</v-icon></v-list-item-icon>
            <v-list-item-title>Reset layout</v-list-item-title>
          </v-list-item>
          <v-list-item @click="isClearWorkDialogOn = true">
            <v-list-item-icon><v-icon>mdi-delete-sweep-outline</v-icon></v-list-item-icon>
            <v-list-item-title>Clear saved work…</v-list-item-title>
          </v-list-item>
          <v-divider />
          <v-list-item to="/about">
            <v-list-item-icon><v-icon>mdi-information-outline</v-icon></v-list-item-icon>
            <v-list-item-title>About</v-list-item-title>
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
          <p>
            Explore a collection of design options through their images and
            data.
          </p>
          <div class="ds-welcome-choices">
            <div class="ds-welcome-choice">
              <p>First time here? Start with the short tour.</p>
              <v-btn
                color="blue darken-1"
                dark
                @click="
                  isOpeningDialogOn = false;
                  requestTour();
                "
                >Take the tour</v-btn
              >
            </div>
            <div class="ds-welcome-choice">
              <p>Been here before? Open your data.</p>
              <LoadDataModal />
            </div>
          </div>
          <p class="ds-welcome-note">
            <em
              >This is an ongoing research project, so we would appreciate your
              feedback!</em
            >
          </p>
          <div class="ds-welcome-links">
            <router-link to="/about">About</router-link>
            <span>|</span>
            <a href="mailto:abuzreq@gmail.com">Contact</a>
          </div>
          <div class="ds-welcome-credit">
            Built by
            <a href="https://abuzreq.netlify.app/" target="_blank"
              >Ahmed Abuzuraiq</a
            >
            · v1.2.0 beta
          </div>
        </v-card-text>
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
              <span class="ds-preset-figure">
                <span
                  v-for="panel in presetPanels(preset)"
                  :key="panel.type"
                  class="ds-preset-panel"
                  :style="panel.style"
                  >{{ panel.label }}</span
                >
              </span>
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
          <v-btn text @click="arrangeLayoutMyself">Arrange it myself</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isClearWorkDialogOn" max-width="460px">
      <v-card>
        <v-card-title>Clear saved work?</v-card-title>
        <v-card-text>
          This removes the saved sets, their notes, the shortlist, every rating
          and every value entered in a custom dimension for this dataset, here
          and in this browser's storage. It can't be undone.
        </v-card-text>
        <v-card-text class="pt-0">
          The custom and weighted dimensions themselves stay, emptied: a
          weighted one is read again from whatever its terms still hold.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="isClearWorkDialogOn = false">Cancel</v-btn>
          <v-btn color="error" text @click="clearSavedWork">Clear</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
    <v-main id="designsense-workspace" style="padding: 60px 0px 0px">
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

.ui-mode-toggle {
  margin: 0 2px;
}
.ds-layout-slot {
  display: inline-flex;
  align-items: center;
}
.ds-title {
  flex: 0 0 auto;
  margin-right: 4px;
}
.v-app-bar .v-divider--vertical.ds-divider {
  align-self: center;
  min-height: 32px;
  max-height: 32px;
  margin: 0 8px;
}
/* The filters or selection operations take whatever room the groups leave. */
/* The badge wrapper is taller than a bare icon, which pushes the bookmark
   below the line the other toolbar icons sit on. */
#cart-chip .v-badge {
  display: flex;
  align-items: center;
  line-height: 1;
  margin-top: -2px;
}
.ds-narrowing {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  justify-content: center;
}
.ds-welcome-body {
  font-size: 16px;
}
.ds-welcome-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 8px 0 12px;
}
.ds-welcome-choice {
  flex: 1 1 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  text-align: center;
}
.ds-welcome-note {
  margin-top: 12px;
  font-size: 14px;
}
.ds-welcome-links {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
}
.ds-welcome-credit {
  margin-top: 8px;
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
/* A scale drawing of the preset, on the same 48x24 grid as the workspace. */
.ds-preset-figure {
  position: relative;
  display: block;
  width: 100%;
  padding-top: 50%;
  background: #eceff1;
  border-radius: 4px;
  overflow: hidden;
}
.ds-preset-panel {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1px;
  font-size: 9px;
  line-height: 1;
  color: #37474f;
  text-align: center;
  background: #fff;
  border: 1px solid #b0bec5;
  overflow: hidden;
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
.ds-workspace {
  position: relative;
  width: 100%;
  height: calc(100vh - 60px);
}
/* Below 1500px Expert's toolbar needs every pixel, so labels give way to icons. */
@media (max-width: 1500px) {
  .v-app-bar .v-toolbar__content {
    padding-left: 8px;
    padding-right: 8px;
  }
  .ds-stage {
    display: none;
  }
  #loading-data-bar .load-data-label {
    display: none;
  }
  #loading-data-bar .load-data-icon.v-icon {
    margin: 0;
  }
  #loading-data-bar .load-data-button.v-btn {
    min-width: 0 !important;
    padding: 0 10px !important;
  }
  .v-app-bar .v-divider--vertical.ds-divider {
    margin: 0 2px;
  }
  .v-app-bar .v-btn.v-btn--icon.v-size--default {
    width: 34px !important;
    height: 34px !important;
  }
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

import SetsView from "@/components/SetsView.vue";

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
import { LAYOUT_COLUMNS, LAYOUT_PRESETS, LAYOUT_ROWS } from "@/layout.js";

// Short names for the panels drawn in a preset's thumbnail.
const PANEL_LABELS = {
  Grid: "Gallery",
  ScatterPlot: "Scatter",
  ParallelCoordinatesPlot: "PCP",
  Sets: "Sets",
  SPLOM: "SPLOM",
};

// What Expert adds to Lite, said the same way in the mode tooltip and the tour.
// Outlive the workspace, which is mounted again for each dataset.
const welcome = { pending: isFirstVisit() };
const tour = { pending: false };

function isFirstVisit() {
  try {
    if (localStorage.getItem("wasOpeningDialogShown") === "true") return false;
    localStorage.setItem("wasOpeningDialogShown", "true");
  } catch (e) {
    /* without storage, every visit counts as the first */
  }
  return true;
}
const EXPERT_ADDS =
  "selection operations and the lasso, clusters, coloring, editing sets, inspection controls, the sensitivity reading, and layout editing";
import { applySelectionCursor } from "@/components/selectionCursors.js";

import AssistantBar from "@/components/AssistantBar.vue";
import DimensionsDialog from "@/components/DimensionsDialog.vue";
import CompareDialog from "@/components/CompareDialog.vue";
import SensitivityDialog from "@/components/SensitivityDialog.vue";
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
    ParCoordsView,
    AugmentedGridView,
    SPLOMView,
    ScatterplotView,
    SetsView,
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
          "Explore a collection of design options through their images and data. This tour takes about three minutes. Use the arrow keys or the buttons below.",
          "bottom"),
        tourStep(this, "lite", "#ui-mode-toggle", "Lite and Expert",
          "<b>Lite</b> keeps things simple: you narrow the options with filters. <b>Expert</b> adds " + EXPERT_ADDS + ". The tour starts in Lite.",
          "bottom"),
        tourStep(this, "lite", "#loading-data-bar", "Load your data",
          "Open a collection from your computer or from a shared folder. This tour uses a small set of used cars.",
          "bottom"),
        tourStep(this, "lite", '.v-card[type="Grid"]', "Gallery",
          "Every option appears here as an image. Sort them from the menu at the top and change the image size on the right. Click an image to inspect it, and click it again to stop.",
          "right"),
        tourStep(this, "lite", ".inspector_card", "A closer look",
          "A bigger look at the option you clicked. The first button lists its values beside the image; an option with more than one view is switched there too, and one with a 3D model opens it with the cube button. On the right you can rate it, and keep it aside on the shortlist.",
          "right", () => this.inspectTourOption()),
        tourStep(this, "lite", ".v-card[type='ScatterPlot']", "Scatterplot",
          "Each dot is an option. Drag a box to filter by both axes, and choose the axes at the top. Click a dot to inspect it.",
          "left", () => this.showTourFilter()),
        tourStep(this, "lite", '.v-card[type="ParallelCoordinatesPlot"]', "Parallel coordinates",
          "Each line is an option and each axis is a dimension. Drag along an axis to filter it. Drag a title to reorder the axes, or pick them under Axes.",
          "left"),
        tourStep(this, "lite", "#filter-bar", "Your filters",
          "Each filter becomes a chip, and the count shows how many options match. Remove a chip to drop its filter. Press Esc to stop inspecting, then again to clear every filter.",
          "bottom"),
        tourStep(this, "lite", "#data-operations-bar", "Zoom",
          "Zoom in on the selected options to focus on them, or exclude them instead. Reset brings back the whole collection.",
          "bottom"),
        tourStep(this, "lite", '.v-card[type="Sets"]', "Saved sets",
          "Save the current results along with their filters. Restore a set later to bring those filters back.",
          "right", () => this.saveTourSet()),
        tourStep(this, "lite", "#cart-chip", "Your shortlist",
          "Options you set aside gather here, and the badge counts them. The shortlist outlasts filtering, zooming and switching modes, so it is where a few candidates wait while you keep looking. This menu shortlists everything currently shown, saves the shortlist as a set, or compares it.",
          "bottom", () => this.fillTourCart()),
        dialogTourStep(this, "lite", ".cmp-card", "Compare",
          "Up to eight options side by side, each column with its image, its rating and its own shortlist button. Rows that read the same everywhere are dimmed, and in a numeric row the highest and lowest values are marked. Click a row name to sort the columns by it.",
          () => this.openTourCompare()),
        tourStep(this, "expert", "#ui-mode-toggle", "Expert mode",
          "Expert keeps everything you have seen and adds " + EXPERT_ADDS + ". Instead of filtering, you build a selection.",
          "bottom"),
        tourStep(this, "expert", "#selection-operations-bar", "Selection operations",
          "Choose how a new selection combines with the current one: replace, add, subtract, toggle, or intersect. Hold Shift to add, Ctrl to subtract, or both to intersect.",
          "bottom"),
        tourStep(this, "expert", "#sets-operations-bar", "Selection tools",
          "Undo, redo, clear, or invert the selection.",
          "bottom"),
        tourStep(this, "expert", ".v-card[type='ScatterPlot'] div.cluster-view", "Clusters",
          "Clusters group options that are similar on the dimensions you choose. Each image stands for a group. Click it to select the whole group.",
          "left", () => this.$store.commit("setClusteringPanelOpen", { value: true })),
        tourStep(this, "expert", "#inspection-bar", "Inspection",
          "Hold Space and move over any option to inspect it. Pin keeps it inspected after you let go, and the last button inspects without holding Space.",
          "bottom"),
        dialogTourStep(this, "expert", ".sx-card", "Sensitivity",
          "Which inputs move which outputs, read over the whole collection rather than over what is on screen. Name the parameters and the results here, or start their columns with in: and out: and the file names them for you. Each of the three measures answers a different question, explained beside its numbers, and the panel says in the open that a reading is only as good as the sampling behind it.",
          () => this.openTourSensitivity()),
        tourStep(this, "expert", "#editing-mode", "Your layout",
          "Turn on editing to move and resize the panels.",
          "bottom"),
        tourStep(this, "lite", "#designsense-title", "You're ready",
          "You're back in Lite. Switch to Expert whenever you need more control, and right-click the workspace for quick actions. The help menu has this tour and every shortcut. Feedback is welcome at abuzreq@gmail.com.",
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
              ? "Clear every filter [Esc]"
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
              ? "Stop inspecting on hover"
              : "Inspect options on hover without holding Space (or hold Space to inspect while hovering)",
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
          icon: "mdi-tune-variant",
          tooltip: () =>
            "Sensitivity: which inputs move which outputs, across the whole collection",
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
      isClearWorkDialogOn: false,
      isTourDialogOn: false,
      isLayoutDialogOn: false,
      // Set while editing is turned on from the layout dialog, so answering
      // the prompt doesn't raise it again.
      arrangeRequested: false,
      layoutPresets: LAYOUT_PRESETS,
      expertAdds: EXPERT_ADDS,
      dismissedNotice: "",
      // Whether an option is inspected; follows the store only when that
      // changes, not as inspection moves from option to option.
      isInspecting: false,
      // The page minus its scrollbar gutter and the 60px app bar, so panels
      // mount at their final size. Re-measured on mount and on window resize.
      workspaceWidth: document.documentElement.clientWidth,
      workspaceHeight: Math.max(0, document.documentElement.clientHeight - 60),
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
    selectionActions() {
      // Lite's undo and redo already sit in the filter bar.
      return this.isLite
        ? ["resetAllMarkings", "invertSelection", "compareResult", "createSet"]
        : ["undo", "redo", "resetAllMarkings", "invertSelection", "compareResult"];
    },
    dataActions() {
      return [
        "zoomToSelection",
        "excludeSelection",
        "undoDataTransformation",
        "resetData",
      ];
    },
    inspectionActions() {
      // Pinning and continuous inspection are Expert's; Lite inspects by clicking.
      return this.can("inspectionControls")
        ? ["togglePinInspection", "clearInspection", "toggleInspectionMode"]
        : ["clearInspection"];
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
    currentSelectionOperation: {
      immediate: true,
      handler() {
        this.updateSelectionCursor();
      },
    },
    uiMode() {
      this.updateSelectionCursor();
    },
    // Editing usually starts because the layout isn't right, so offer the
    // presets first; they are one click, rearranging by hand is many.
    isEditingMode(value) {
      if (!value) {
        this.arrangeRequested = false;
        return;
      }
      // Editing asked for from the dialog itself is the answer to the prompt,
      // not another reason to show it.
      if (this.arrangeRequested) {
        this.arrangeRequested = false;
        return;
      }
      // A preset is one click and covers most of what editing gets opened for,
      // so the presets come first and editing waits until it is chosen.
      this.$store.commit("toggleEditingMode", { value: false });
      this.isLayoutDialogOn = true;
    },
  },
  methods: {
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
    /** The preset's panels as percentages, for its thumbnail. */
    presetPanels(preset) {
      return preset.build(this.workspaceWidth).map((panel) => ({
        type: panel.type,
        label: PANEL_LABELS[panel.type] || panel.type,
        style: {
          left: (panel.x / LAYOUT_COLUMNS) * 100 + "%",
          top: (panel.y / LAYOUT_ROWS) * 100 + "%",
          width: (panel.w / LAYOUT_COLUMNS) * 100 + "%",
          height: (panel.h / LAYOUT_ROWS) * 100 + "%",
        },
      }));
    },
    chooseLayoutPreset(id) {
      this.$store.commit("applyLayoutPreset", { id: id });
      this.isLayoutDialogOn = false;
    },
    /** The one way out of the dialog that turns layout editing on. */
    arrangeLayoutMyself() {
      this.isLayoutDialogOn = false;
      this.arrangeRequested = true;
      this.$store.commit("toggleEditingMode", { value: true });
    },
    resetLayout() {
      this.$store.commit("toggleEditingMode", { value: false });
      this.$store.commit("resetLayouts");
    },
    clearSavedWork() {
      this.isClearWorkDialogOn = false;
      this.$store.dispatch("clearSavedWork");
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
      // The two steps that read a dialog open it themselves; every other step
      // is about the workspace, which those dialogs cover. Closing here also
      // means stepping backwards past one leaves nothing behind.
      store.dispatch("closeCompare");
      store.dispatch("closeSensitivity");
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
      this.$store.dispatch("closeCompare");
      this.$store.dispatch("closeSensitivity");
    },
    /** Filters the tour's used-car data, so the filter chips have something to show. */
    showTourFilter() {
      let dims = this.$store.state.numericDimensions;
      if (!dims.includes("price") || !dims.includes("year")) return;
      this.$store.dispatch("setRangeFilters", {
        ranges: { price: [4000, 12000], year: [2006, 2015] },
      });
    },
    saveTourSet() {
      if (this.$store.state.setsIDs.length === 0) {
        this.$store.dispatch("createSet");
      }
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

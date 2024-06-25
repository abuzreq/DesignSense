import axios from "axios";

var isLogging = false;

export default function createLogger(store) {
  if (process.env.NODE_ENV === "development" && isLogging) {
    store.subscribeAction((action, state) => {
      console.log("LOG", action, state)
      var payloadClone = Object.assign({}, action.payload);
      delete payloadClone.vueComponent;

      if(action.type == "createDefaultView")
      {
        return;
      }
      if(action.type == "createDefaultEntry")
      {
          //TODO create new file?
      }
      if(action.type == "update")
        {
            var viewType = store.state.viewsMap[action.payload.view]._props.type;
            payloadClone.viewType = viewType;
        }

      // Send action and state to the Node.js server
      axios
        .post("http://localhost:3001/log", {
          action: action.type,
          payload: payloadClone,
        })
        .then((response) => {
          // console.log("Log entry sent to server");
        })
        .catch((error) => {
           console.error("Error sending log entry to server", error);
        });
    });
  }
}

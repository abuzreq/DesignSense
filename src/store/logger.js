import axios from "axios";

export default function createLogger(store) {
  if (process.env.NODE_ENV === "development") {
    store.subscribeAction((action, state) => {

      var payloadClone = Object.assign({}, action.payload);
      delete payloadClone.vueComponent;

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

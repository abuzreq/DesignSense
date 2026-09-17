/** A loading failure, with a message that can be shown to the user as is. */
export class LoadError extends Error {
  constructor(userMessage, cause) {
    super(userMessage);
    this.name = "LoadError";
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

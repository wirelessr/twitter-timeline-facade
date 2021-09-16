class TimelineError extends Error {
  constructor(message) {
    super(message);

    // needed for CustomError instanceof Error => true
    Object.setPrototypeOf(this, new.target.prototype);

    // Set the name
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
class RecommendationPostError extends TimelineError {}

module.exports = {
  TimelineError,
  RecommendationPostError
};

"use strict"

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex]
    ];
  }

  return array;
}

class TwitterTimelineFacade {
  #MAX_RECOMMEND_LENGTH;
  #CELEBRITY_FOLLOWER_THRESHOLD;
  #INACTIVE_DAY_THRESHOLD;

  constructor(recommendationRepo, followerRepo, conf = {}) {
    this.#MAX_RECOMMEND_LENGTH = conf?.MaxRecommendLength ?? 800;
    this.#CELEBRITY_FOLLOWER_THRESHOLD =
      conf?.CelebrityFollowerThreshold ?? 1000;
    this.#INACTIVE_DAY_THRESHOLD = conf?.InactiveDayThreshold ?? 7;

    this.recommendationRepo = recommendationRepo;
    this.followerRepo = followerRepo;
  }

  #isCelebrity(userId) {
    const followerCount = this.followerRepo.countFollowers(userId);
    if (followerCount > this.#CELEBRITY_FOLLOWER_THRESHOLD) {
      return true;
    }
    return false;
  }

  #isInactiveUser(userId) {
    return (
      this.followerRepo.getLastLoginDays(userId) > this.#INACTIVE_DAY_THRESHOLD
    );
  }

  #getFollowers(userId) {
    const followers = this.followerRepo.getFollowers(userId);
    return followers.filter((follower) => {
      return !this.#isInactiveUser(follower);
    });
  }

  #assembleTimeline(fromOwned, fromCelebrities) {
    return shuffle(fromOwned.concat(fromCelebrities));
  }

  post(authorId, postId, postMeta) {
    if (this.#isCelebrity(authorId)) {
      // single update
      this.recommendationRepo.appendPost(
        authorId,
        postId,
        postMeta,
        this.#MAX_RECOMMEND_LENGTH
      );
    } else {
      // fan-out
      const followers = this.#getFollowers(authorId);
      followers.forEach((follower) =>
        this.recommendationRepo.appendRecommendation(
          follower,
          postId,
          postMeta,
          this.#MAX_RECOMMEND_LENGTH
        )
      );
    }
  }

  retrieve(userId) {
    const followees = this.followerRepo.getFollowees(userId);
    const celebrities = followees.filter((followee) => {
      return this.#isCelebrity(followee);
    });
    const fromOwned = this.recommendationRepo.getRecommendations(userId);
    const fromCelebrities = this.recommendationRepo.getPosts(celebrities);
    return this.#assembleTimeline(fromOwned, fromCelebrities);
  }
}

module.exports.TwitterTimelineFacade = TwitterTimelineFacade;
"use strict";

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

  async #isCelebrity(userId) {
    const followerCount = await this.followerRepo.countFollowers(userId);
    if (followerCount > this.#CELEBRITY_FOLLOWER_THRESHOLD) {
      return true;
    }
    return false;
  }

  #isInactiveUser(lastLoginDays) {
    return lastLoginDays > this.#INACTIVE_DAY_THRESHOLD;
  }

  async #getActiveFollowers(userId) {
    const followers = await this.followerRepo.getFollowers(userId);
    const followerLoginMap = await this.followerRepo.listLastLoginDays(
      followers
    );
    const ret = [];
    for (const [follower, lastLoginDays] of followerLoginMap.entries()) {
      if (!this.#isInactiveUser(lastLoginDays)) {
        ret.push(follower);
      }
    }
    return ret;
  }

  #assembleTimeline(fromOwned, fromCelebrities) {
    return shuffle(fromOwned.concat(fromCelebrities));
  }

  async post(authorId, postId, postMeta) {
    if (await this.#isCelebrity(authorId)) {
      // single update
      await this.recommendationRepo.appendPost(
        authorId,
        postId,
        postMeta,
        this.#MAX_RECOMMEND_LENGTH
      );
    } else {
      // fan-out
      const followers = await this.#getActiveFollowers(authorId);
      followers.forEach(
        async (follower) =>
          await this.recommendationRepo.appendRecommendation(
            follower,
            postId,
            postMeta,
            this.#MAX_RECOMMEND_LENGTH
          )
      );
    }
  }

  async retrieve(userId) {
    const followees = await this.followerRepo.getFollowees(userId);
    const celebrities = [];
    for (const followee of followees) {
      if (await this.#isCelebrity(followee)) {
        celebrities.push(followee);
      }
    }
    const fromOwned = await this.recommendationRepo.getRecommendations(userId);
    const fromCelebrities = await this.recommendationRepo.getPosts(celebrities);
    return this.#assembleTimeline(fromOwned, fromCelebrities);
  }

  async deletePost(userId, postId) {
    if (await this.#isCelebrity(userId)) {
      // single update
      await this.recommendationRepo.deletePost(userId, postId);
    } else {
      const followers = await this.followerRepo.getFollowers(userId);
      followers.forEach(
        async (follower) =>
          await this.recommendationRepo.deleteRecommendation(follower, postId)
      );
    }
  }
}

module.exports.TwitterTimelineFacade = TwitterTimelineFacade;

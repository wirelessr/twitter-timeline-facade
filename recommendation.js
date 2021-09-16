"use strict";

const Redis = require("ioredis");
const { RecommendationError } = require("./error");

/*
  Assume all posts and recommendations are stored into Redis with the data type: list 
*/
class RecommendationRepo {
  #POST_KEY_PREFIX;
  #RECOMMENDATION_KEY_PREFIX;
  #redis;

  constructor(conf) {
    this.#POST_KEY_PREFIX = "timeline.post.";
    this.#RECOMMENDATION_KEY_PREFIX = "timeline.recommendation.";
    let redis;
    if (!conf) {
      redis = new Redis();
    } else {
      redis = new Redis({
        host: conf?.redisHost ?? "localhost",
        port: conf?.redisPort ?? 6379
      });
    }
    this.#redis = redis;
  }

  #postKey(authorId) {
    return `${this.#POST_KEY_PREFIX}${authorId}`;
  }
  #recommendationKey(follower) {
    return `${this.#RECOMMENDATION_KEY_PREFIX}${follower}`;
  }

  async #appendData(key, postId, postMeta, limit) {
    const data = JSON.stringify({
      postId,
      postMeta
    });
    const results = await this.#redis
      .multi()
      .rpush(key, data)
      .ltrim(key, -limit, -1)
      .exec();
    for (const [err, result] of results) {
      if (err) {
        throw new RecommendationError("appendData failed");
      }
    }
  }

  async appendPost(authorId, postId, postMeta, limit) {
    const key = this.#postKey(authorId);
    this.#appendData(key, postId, postMeta, limit);
  }
  async getPosts(celebrities) {
    const pipeline = this.#redis.pipeline();
    for (const celebrity of celebrities) {
      const key = this.#postKey(celebrity);
      pipeline.lrange(key, 0, -1);
    }
    let ret = [];
    const results = await pipeline.exec();

    for (const [err, result] of results) {
      if (err) {
        throw new RecommendationPostError("getPosts failed");
      }
      ret = ret.concat(result.map(JSON.parse));
    }

    return ret;
  }
  async appendRecommendation(follower, postId, postMeta, limit) {
    const key = this.#recommendationKey(follower);
    this.#appendData(key, postId, postMeta, limit);
  }
  async getRecommendations(userId) {
    const key = this.#recommendationKey(userId);
    const results = await this.#redis.lrange(key, 0, -1);
    return results.map(JSON.parse);
  }
}

module.exports.RecommendationRepo = RecommendationRepo;

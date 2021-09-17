"use strict";

const Redis = require("ioredis");
const { RecommendationError } = require("./error");

/*
  Assume all posts and recommendations are stored into Redis with the data type: sorted set
  And, all metas are in KV format
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
  #metaKey(key, postId) {
    return `${key}.${postId}`;
  }

  async #appendData(key, postId, postMeta, limit) {
    const metaKey = this.#metaKey(key, postId);
    const created = postMeta?.created ?? Date.now();
    const results = await this.#redis
      .multi()
      .set(metaKey, JSON.stringify(postMeta))
      .zadd(key, created, postId)
      .zremrangebyrank(key, 0, -(limit + 1))
      .exec();
    for (const [err, result] of results) {
      if (err) {
        throw new RecommendationError("appendData failed");
      }
    }
  }
  async #getData(keys) {
    const pipeline = this.#redis.pipeline();
    for (const key of keys) {
      pipeline.zrange(key, 0, -1);
    }
    const rPostIds = await pipeline.exec();
    let allPosts = new Map();
    for (let i = 0; i < rPostIds.length; i++) {
      const [err, postIds] = rPostIds[i];
      if (err) {
        throw new RecommendationError("get posts failed");
      }
      allPosts.set(keys[i], postIds);
    }

    const pipeline2 = this.#redis.pipeline();
    const ret = [];
    for (const [key, postIds] of allPosts.entries()) {
      for (const postId of postIds) {
        const metaKey = this.#metaKey(key, postId);
        pipeline2.get(metaKey);
        ret.push(postId);
      }
    }
    const rMeta = await pipeline2.exec();
    for (let i = 0; i < rMeta.length; i++) {
      const [err, meta] = rMeta[i];
      if (err) {
        throw new RecommendationError("get meta failed");
      }
      ret[i] = { postId: ret[i], postMeta: JSON.parse(meta) };
    }
    return ret;
  }
  async #deleteData(key, postId) {
    await this.#redis.zrem(key, postId);
  }

  async appendPost(authorId, postId, postMeta, limit) {
    const key = this.#postKey(authorId);
    await this.#appendData(key, postId, postMeta, limit);
  }

  async getPosts(celebrities) {
    const keys = [];
    for (const celebrity of celebrities) {
      const key = this.#postKey(celebrity);
      keys.push(key);
    }
    return await this.#getData(keys);
  }

  async appendRecommendation(follower, postId, postMeta, limit) {
    const key = this.#recommendationKey(follower);
    await this.#appendData(key, postId, postMeta, limit);
  }

  async getRecommendations(userId) {
    const key = this.#recommendationKey(userId);
    return await this.#getData([key]);
  }

  async deletePost(userId, postId) {
    const key = this.#postKey(userId);
    await this.#deleteData(key, postId);
  }

  async deleteRecommendation(userId, postId) {
    const key = this.#recommendationKey(userId);
    await this.#deleteData(key, postId);
  }
}

module.exports.RecommendationRepo = RecommendationRepo;

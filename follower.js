"use strict";

const Redis = require("ioredis");
const { FollowerError } = require("./error");

class FollowerRepo {
  #redis;
  #FOLLOWER_KEY_PREFIX;
  #LAST_LOGIN_KEY_PREFIX;
  #FOLLOWEE_KEY_PREFIX;

  constructor(conf) {
    this.#FOLLOWER_KEY_PREFIX = "timeline.follower.";
    this.#LAST_LOGIN_KEY_PREFIX = "timeline.last.login.";
    this.#FOLLOWEE_KEY_PREFIX = "timeline.followee.";
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

  #followerKey(userId) {
    return `${this.#FOLLOWER_KEY_PREFIX}${userId}`;
  }
  #lastLoginKey(userId) {
    return `${this.#LAST_LOGIN_KEY_PREFIX}${userId}`;
  }
  #followeeKey(userId) {
    return `${this.#FOLLOWEE_KEY_PREFIX}${userId}`;
  }
  async countFollowers(userId) {
    const key = this.#followerKey(userId);
    const count = await this.#redis.scard(key);
    return count;
  }
  async getFollowers(userId) {
    const key = this.#followerKey(userId);
    const followers = await this.#redis.smembers(key);
    return followers;
  }
  async getLastLoginDays(follower) {
    const key = this.#lastLoginKey(follower);
    const lastLoginTime = await this.#redis.get(key);
    const now = Date.now();
    return Math.floor((now - lastLoginTime) / 1000 / 86400);
  }
  async getFollowees(userId) {
    const key = this.#followeeKey(userId);
    const followees = await this.#redis.smembers(key);
    return followees;
  }
}

module.exports.FollowerRepo = FollowerRepo;

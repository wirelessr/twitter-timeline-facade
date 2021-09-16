const expect = require("chai").expect;
const faker = require("faker");
const Redis = require("ioredis");
const { RecommendationRepo } = require("../recommendation");
const { FollowerRepo } = require("../follower");
const { TwitterTimelineFacade } = require("../");

before(() => {
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;
  console.log(`redisHost: ${redisHost}, redisPort: ${redisPort}`);
  this.redis = new Redis({
    host: redisHost,
    port: redisPort
  });
  const recommendation = new RecommendationRepo({
    redisHost,
    redisPort
  });
  const follower = new FollowerRepo({
    redisHost,
    redisPort
  });
  this.timeline = new TwitterTimelineFacade(recommendation, follower, {
    CelebrityFollowerThreshold: 1
  });
});

after(() => {
  this.redis.disconnect();
});

describe("timeline.integration.testsuite", () => {
  afterEach(async () => {
    await this.redis.flushdb();
  });
  it("timeline.integration.infra.test", async () => {
    const empty = await this.redis.get("foo");
    expect(empty).to.be.null;

    await this.redis.set("foo", "bar");
    const bar = await this.redis.get("foo");
    expect(bar).to.be.equal("bar");
  });

  it("timeline.integration.normal", async () => {
    const user1 = faker.datatype.uuid();
    const user2 = faker.datatype.uuid();
    const user3 = faker.datatype.uuid();
    const user4 = faker.datatype.uuid();
    const user5 = faker.datatype.uuid();

    // user1 has 2 followers: user2 & user3, so user1 is a celebrity
    // user1 follows user4 & user5
    await this.redis.sadd(`timeline.follower.${user1}`, user2, user3);
    await this.redis.sadd(`timeline.follower.${user4}`, user1);
    await this.redis.sadd(`timeline.follower.${user5}`, user1);

    await this.redis.sadd(`timeline.followee.${user1}`, user4, user5);
    await this.redis.sadd(`timeline.followee.${user2}`, user1);
    await this.redis.sadd(`timeline.followee.${user3}`, user1);

    // set last login time
    const now = Date.now();
    await this.redis.set(`timeline.last.login.${user1}`, now);
    await this.redis.set(`timeline.last.login.${user2}`, now);
    await this.redis.set(`timeline.last.login.${user3}`, now);
    await this.redis.set(`timeline.last.login.${user4}`, now);
    await this.redis.set(`timeline.last.login.${user5}`, now);

    // posts
    await this.timeline.post(user1, "post1", {});
    await this.timeline.post(user2, "post2", {});
    await this.timeline.post(user3, "post3", {});
    await this.timeline.post(user4, "post4", {});
    await this.timeline.post(user5, "post5", {});

    // verification
    const cmp = (a, b) => (a.postId > b.postId ? 1 : -1);
    expect((await this.timeline.retrieve(user1)).sort(cmp)).to.deep.equal(
      [
        { postId: "post4", postMeta: {} },
        { postId: "post5", postMeta: {} }
      ].sort(cmp)
    );
    expect(await this.timeline.retrieve(user2)).to.deep.equal([
      { postId: "post1", postMeta: {} }
    ]);
    expect(await this.timeline.retrieve(user3)).to.deep.equal([
      { postId: "post1", postMeta: {} }
    ]);
    expect(await this.timeline.retrieve(user4)).to.deep.equal([]);
    expect(await this.timeline.retrieve(user5)).to.deep.equal([]);
  });

  it("timeline.integration.inactive.user", async () => {
    const user1 = faker.datatype.uuid();
    const user2 = faker.datatype.uuid();

    // user1 and user2 follow each other
    await this.redis.sadd(`timeline.followee.${user1}`, user2);
    await this.redis.sadd(`timeline.followee.${user2}`, user1);
    await this.redis.sadd(`timeline.follower.${user1}`, user2);
    await this.redis.sadd(`timeline.follower.${user2}`, user1);

    // but user2 is inactive
    const now = Date.now();
    await this.redis.set(`timeline.last.login.${user1}`, now);

    // posts
    await this.timeline.post(user1, "post1", {});
    await this.timeline.post(user2, "post2", {});

    // verification
    expect(await this.timeline.retrieve(user1)).to.deep.equal([
      { postId: "post2", postMeta: {} }
    ]);
    expect(await this.timeline.retrieve(user2)).to.deep.equal([]);
  });
});

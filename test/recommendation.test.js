const expect = require("chai").expect;
const faker = require("faker");
const Redis = require("ioredis");
const { RecommendationRepo } = require("../recommendation");

before(() => {
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;
  console.log(`redisHost: ${redisHost}, redisPort: ${redisPort}`);
  this.redis = new Redis({
    host: redisHost,
    port: redisPort
  });
  this.repo = new RecommendationRepo({
    redisHost,
    redisPort
  });
});

after(() => {
  this.redis.disconnect();
});

describe("timeline.repo.recommendation.testsuite", () => {
  afterEach(async () => {
    await this.redis.flushdb();
  });
  it("timeline.repo.infra.test", async () => {
    const empty = await this.redis.get("foo");
    expect(empty).to.be.null;

    await this.redis.set("foo", "bar");
    const bar = await this.redis.get("foo");
    expect(bar).to.be.equal("bar");
  });

  it("timeline.repo.recommendation.post.one", async () => {
    const postId = faker.datatype.uuid();
    await this.repo.appendPost(1, postId, {}, 1);

    const posts = await this.repo.getPosts([1]);
    expect(posts).to.deep.equal([{ postId, postMeta: {} }]);
  });

  it("timeline.repo.recommendation.post.exceed.limit", async () => {
    const postId1 = faker.datatype.uuid();
    const postId2 = faker.datatype.uuid();
    const postId3 = faker.datatype.uuid();

    await this.repo.appendPost(1, postId1, {}, 2);
    await this.repo.appendPost(1, postId2, {}, 2);
    await this.repo.appendPost(1, postId3, {}, 2);

    const posts = await this.repo.getPosts([1]);
    expect(posts).to.deep.equal([
      { postId: postId2, postMeta: {} },
      { postId: postId3, postMeta: {} }
    ]);
  });

  it("timeline.repo.recommendation.post.multi.user", async () => {
    const postId1 = faker.datatype.uuid();
    const postId2 = faker.datatype.uuid();
    const postId3 = faker.datatype.uuid();

    await this.repo.appendPost(1, postId1, {}, 2);
    await this.repo.appendPost(2, postId2, {}, 2);
    await this.repo.appendPost(2, postId3, {}, 2);

    const posts = await this.repo.getPosts([1, 2]);
    expect(posts).to.deep.equal([
      { postId: postId1, postMeta: {} },
      { postId: postId2, postMeta: {} },
      { postId: postId3, postMeta: {} }
    ]);
  });

  it("timeline.repo.recommendation.recommendation.normal", async () => {
    const postId1 = faker.datatype.uuid();
    const postId2 = faker.datatype.uuid();
    const postId3 = faker.datatype.uuid();

    await this.repo.appendRecommendation(1, postId1, {}, 2);
    await this.repo.appendRecommendation(2, postId2, {}, 2);
    await this.repo.appendRecommendation(2, postId3, {}, 2);

    const r1 = await this.repo.getRecommendations(1);
    expect(r1).to.deep.equal([{ postId: postId1, postMeta: {} }]);

    const r2 = await this.repo.getRecommendations(2);
    expect(r2).to.deep.equal([
      { postId: postId2, postMeta: {} },
      { postId: postId3, postMeta: {} }
    ]);
  });
});
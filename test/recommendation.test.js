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

after(async () => {
  await this.redis.disconnect();
});

describe("timeline.repo.recommendation.testsuite", () => {
  beforeEach(() => {
    this.cmp = (a, b) => (a.postId > b.postId ? 1 : -1);
  });
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

    await this.repo.appendPost(1, postId1, { created: 1 }, 2);
    await this.repo.appendPost(1, postId2, { created: 2 }, 2);
    await this.repo.appendPost(1, postId3, { created: 3 }, 2);

    const posts = await this.repo.getPosts([1]);
    expect(posts).to.deep.equal([
      { postId: postId2, postMeta: { created: 2 } },
      { postId: postId3, postMeta: { created: 3 } }
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
    expect(r2.sort(this.cmp)).to.deep.equal(
      [
        { postId: postId2, postMeta: {} },
        { postId: postId3, postMeta: {} }
      ].sort(this.cmp)
    );
  });

  it("timeline.repo.recommendation.delete.normal", async () => {
    const postId1 = faker.datatype.uuid();
    const postId2 = faker.datatype.uuid();
    const postId3 = faker.datatype.uuid();
    const postId4 = faker.datatype.uuid();

    await this.repo.appendRecommendation(1, postId1, {}, 2);
    await this.repo.appendRecommendation(2, postId2, {}, 2);
    await this.repo.appendPost(3, postId3, {}, 2);
    await this.repo.appendPost(3, postId4, {}, 2);

    // delete non-exist data
    await this.repo.deletePost(3, postId1);
    await this.repo.deleteRecommendation(1, postId4);
    expect(await this.repo.getRecommendations(1)).to.deep.equal([
      { postId: postId1, postMeta: {} }
    ]);
    expect((await this.repo.getPosts([3])).sort(this.cmp)).to.deep.equal(
      [
        { postId: postId3, postMeta: {} },
        { postId: postId4, postMeta: {} }
      ].sort(this.cmp)
    );

    // delete one
    await this.repo.deletePost(3, postId3);
    await this.repo.deleteRecommendation(1, postId1);
    expect(await this.repo.getRecommendations(1)).to.deep.equal([]);
    expect(await this.repo.getPosts([3])).to.deep.equal([
      { postId: postId4, postMeta: {} }
    ]);
  });
});

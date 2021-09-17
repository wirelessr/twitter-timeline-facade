const expect = require("chai").expect;
const faker = require("faker");
const Redis = require("ioredis");
const { FollowerRepo } = require("../follower");

before(() => {
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;
  console.log(`redisHost: ${redisHost}, redisPort: ${redisPort}`);
  this.redis = new Redis({
    host: redisHost,
    port: redisPort
  });
  this.repo = new FollowerRepo({
    redisHost,
    redisPort
  });
});

after(async () => {
  await this.redis.disconnect();
});

describe("timeline.repo.follower.testsuite", () => {
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

  it("timeline.repo.follower.followee.normal", async () => {
    const user1 = faker.datatype.uuid();
    const user2 = faker.datatype.uuid();
    const user3 = faker.datatype.uuid();
    const user4 = faker.datatype.uuid();
    await this.redis.sadd("timeline.followee.1", user1, user2);
    await this.redis.sadd("timeline.followee.2", user3);
    await this.redis.sadd("timeline.follower.1", user4);

    const r1 = await this.repo.getFollowees(1);
    expect(r1.sort()).to.deep.equal([user1, user2].sort());

    const r2 = await this.repo.getFollowees(2);
    expect(r2).to.deep.equal([user3]);

    const r3 = await this.repo.getFollowees(3);
    expect(r3).to.deep.equal([]);
  });

  it("timeline.repo.follower.follower.normal", async () => {
    const user1 = faker.datatype.uuid();
    const user2 = faker.datatype.uuid();
    const user3 = faker.datatype.uuid();
    const user4 = faker.datatype.uuid();
    await this.redis.sadd("timeline.follower.1", user1, user2);
    await this.redis.sadd("timeline.follower.2", user3);
    await this.redis.sadd("timeline.followee.1", user4);

    const r1 = await this.repo.getFollowers(1);
    expect(r1.sort()).to.deep.equal([user1, user2].sort());
    const cnt1 = await this.repo.countFollowers(1);
    expect(cnt1).to.be.equal(2);

    const r2 = await this.repo.getFollowers(2);
    expect(r2).to.deep.equal([user3]);
    const cnt2 = await this.repo.countFollowers(2);
    expect(cnt2).to.be.equal(1);

    const r3 = await this.repo.getFollowers(3);
    expect(r3).to.deep.equal([]);
    const cnt3 = await this.repo.countFollowers(3);
    expect(cnt3).to.be.equal(0);
  });

  it("timeline.repo.follower.last.login.list", async () => {
    const now = Date.now();

    await this.redis.set("timeline.last.login.1", now);
    await this.redis.set("timeline.last.login.2", now - 86400 * 1000 * 1.5);
    await this.redis.set("timeline.last.login.3", now + 86400 * 1000 * 1.5);
    await this.redis.set("timeline.last.login.4", now - 100);

    const rMap = await this.repo.listLastLoginDays([1, 2, 3, 4, 5]);
    expect(rMap.get(1)).to.be.equal(0);
    expect(rMap.get(2)).to.be.equal(1);
    expect(rMap.get(3)).to.be.equal(-2);
    expect(rMap.get(4)).to.be.equal(0);
    expect(rMap.get(5)).to.be.greaterThan(999);
  });
});

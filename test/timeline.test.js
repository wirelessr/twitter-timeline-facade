"use strict";

const expect = require("chai").expect;
const faker = require("faker");
const { TwitterTimelineFacade } = require("../");

class MockRecommendationRepo {
  constructor() {
    this.db = {
      post: {},
      recommendation: {}
    };
  }

  appendPost(authorId, postId, postMeta, limit) {
    if (!(authorId in this.db.post)) {
      this.db.post[authorId] = [];
    }
    this.db.post[authorId].push(postId);
  }
  appendRecommendation(follower, postId, postMeta, limit) {
    if (!(follower in this.db.recommendation)) {
      this.db.recommendation[follower] = [];
    }
    this.db.recommendation[follower].push(postId);
  }
  getRecommendations(userId) {
    return this.db.recommendation[userId] ?? [];
  }
  getPosts(celebrities) {
    let ret = [];
    for (const celebrity of celebrities) {
      ret = ret.concat(this.db.post[celebrity] ?? []);
    }
    return ret;
  }
}

describe("timeline.mock.recommendation.testsuite", () => {
  it("timeline.mock.recommendation.post.single", () => {
    const mockRepo = new MockRecommendationRepo();
    mockRepo.appendPost(1, 1, {}, 100);
    mockRepo.appendPost(1, 2, {}, 100);
    mockRepo.appendPost(1, 3, {}, 100);
    const result = mockRepo.getPosts([1]);
    expect(result).to.deep.equal([1, 2, 3]);
  });
  it("timeline.mock.recommendation.post.normal", () => {
    const mockRepo = new MockRecommendationRepo();
    mockRepo.appendPost(1, 1, {}, 100);
    mockRepo.appendPost(2, 2, {}, 100);
    mockRepo.appendPost(3, 3, {}, 100);
    const result1 = mockRepo.getPosts([1, 3]);
    expect(result1).to.deep.equal([1, 3]);

    const result2 = mockRepo.getPosts([4]);
    expect(result2).to.deep.equal([]);
  });
  it("timeline.mock.recommendation.recommendation.single", () => {
    const mockRepo = new MockRecommendationRepo();
    mockRepo.appendRecommendation(1, 1, {}, 100);
    mockRepo.appendRecommendation(1, 2, {}, 100);
    mockRepo.appendRecommendation(1, 3, {}, 100);
    const result = mockRepo.getRecommendations(1);
    expect(result).to.deep.equal([1, 2, 3]);
  });
  it("timeline.mock.recommendation.recommendation.normal", () => {
    const mockRepo = new MockRecommendationRepo();
    mockRepo.appendRecommendation(1, 1, {}, 100);
    mockRepo.appendRecommendation(2, 2, {}, 100);
    mockRepo.appendRecommendation(2, 3, {}, 100);
    const result1 = mockRepo.getRecommendations(2);
    expect(result1).to.deep.equal([2, 3]);

    const result2 = mockRepo.getRecommendations(4);
    expect(result2).to.deep.equal([]);
  });
});

class MockFollowerRepo {
  constructor(follower, followee, lastLogin) {
    this.db = {
      follower: follower,
      followee: followee,
      lastLogin: lastLogin
    };
  }
  countFollowers(userId) {
    if (!this.db.follower) {
      return 0;
    }
    return this.db.follower[userId]?.length ?? 0;
  }
  getFollowers(userId) {
    if (!this.db.follower) {
      return [];
    }
    return this.db.follower[userId] ?? [];
  }
  getLastLoginDays(follower) {
    if (!this.db.lastLogin) {
      return 999;
    }
    return this.db.lastLogin[follower] ?? 999;
  }
  getFollowees(userId) {
    if (!this.db.followee) {
      return [];
    }
    return this.db.followee[userId] ?? [];
  }
}

describe("timeline.mock.follower.testsuite", () => {
  it("timeline.mock.follower.follower.normal", () => {
    const mockRepo = new MockFollowerRepo(
      { 1: [2, 3, 4], 2: [5] },
      undefined,
      undefined
    );
    expect(mockRepo.getFollowers(1)).to.deep.equal([2, 3, 4]);
    expect(mockRepo.getFollowers(2)).to.deep.equal([5]);
    expect(mockRepo.getFollowers(3)).to.deep.equal([]);

    expect(mockRepo.countFollowers(1)).to.be.equal(3);
    expect(mockRepo.countFollowers(2)).to.be.equal(1);
    expect(mockRepo.countFollowers(3)).to.be.equal(0);
  });
  it("timeline.mock.follower.followee.normal", () => {
    const mockRepo = new MockFollowerRepo(
      undefined,
      { 1: [2, 3, 4], 2: [5] },
      undefined
    );
    expect(mockRepo.getFollowers(1)).to.deep.equal([]);
    expect(mockRepo.getFollowees(1)).to.deep.equal([2, 3, 4]);
    expect(mockRepo.getFollowees(2)).to.deep.equal([5]);
    expect(mockRepo.getFollowees(3)).to.deep.equal([]);
  });
  it("timeline.mock.follower.lastlogin.normal", () => {
    const mockRepo = new MockFollowerRepo(undefined, undefined, {
      1: 7,
      2: 99
    });
    expect(mockRepo.getLastLoginDays(1)).to.be.equal(7);
    expect(mockRepo.getLastLoginDays(2)).to.be.equal(99);
    expect(mockRepo.getLastLoginDays(3)).to.be.equal(999);
  });
});

describe("timeline.testsuite", () => {
  it("timeline.process.normal", () => {
    const recommendationRepo = new MockRecommendationRepo();
    const followerRepo = new MockFollowerRepo(
      {
        1: [2, 3, 4],
        2: [5],
        3: [6]
      },
      {
        2: [1],
        5: [2]
      },
      { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 99 }
    );
    const conf = {
      CelebrityFollowerThreshold: 1
    };
    const timeline = new TwitterTimelineFacade(
      recommendationRepo,
      followerRepo,
      conf
    );

    // post(userId, postId)
    // celebrity
    const postId1 = faker.datatype.uuid();
    timeline.post(1, postId1);
    expect(recommendationRepo.db.post[1]).to.deep.equal([postId1]);
    expect(timeline.retrieve(2)).to.deep.equal([postId1]);

    // normal user
    const postId2 = faker.datatype.uuid();
    timeline.post(2, postId2);
    expect(recommendationRepo.db.post[2]).to.be.undefined;
    expect(recommendationRepo.db.recommendation[5]).to.deep.equal([postId2]);
    expect(timeline.retrieve(5)).to.deep.equal([postId2]);

    // inactive user
    const postId3 = faker.datatype.uuid();
    timeline.post(3, postId3);
    expect(recommendationRepo.db.post[3]).to.be.undefined;
    expect(recommendationRepo.db.recommendation[6]).to.be.undefined;
  });

  it("timeline.retrieve.assemble.result", () => {
    const recommendationRepo = new MockRecommendationRepo();
    const followerRepo = new MockFollowerRepo(
      {
        1: [2, 3, 4],
        2: [3]
      },
      {
        3: [1, 2]
      },
      { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }
    );
    const conf = {
      CelebrityFollowerThreshold: 1
    };
    const timeline = new TwitterTimelineFacade(
      recommendationRepo,
      followerRepo,
      conf
    );

    const postId1 = faker.datatype.uuid();
    timeline.post(1, postId1);
    const postId2 = faker.datatype.uuid();
    timeline.post(2, postId2);

    const result = timeline.retrieve(3);
    expect(result).to.have.members([postId1, postId2]);
    expect(result).to.be.length(2);
  });
});

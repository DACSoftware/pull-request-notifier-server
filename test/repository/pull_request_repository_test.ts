import {PullRequestRepository} from "../../lib/repository/pull_request_repository";
import {Project, PullRequest, User, PullRequestState} from "../../lib/model";
import {Config} from "../../lib/config";
import {ProjectFaker, ReviewerFaker, PullRequestFaker} from '../faker/model_faker';
import chaiAsPromised = require('chai-as-promised');
import * as nock from 'nock';
import * as chai from 'chai';

describe("PullRequestRepository", () => {
    const expect = chai.expect;
    const basicAuth = {
        user: 'my.user',
        pass: 'topsecret'
    };
    const projectFaker = new ProjectFaker();
    const reviewerFaker = new ReviewerFaker();
    const prFaker = new PullRequestFaker();

    beforeEach(() => {
        chai.use(chaiAsPromised);
        PullRequestRepository.pullRequests = {};

        const appConfig = {
            baseUrl: 'http://example.com',
            teamName: 'bitbucket',
            user: 'my.user',
            password: 'topsecret',
            webhook_port: 1234,
            socket_port: 4321
        };

        Config.setUp({config: appConfig});
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('should fetch open pull requests by requesting for them', (done) => {
        const project = new Project();
        project.fullName = 'bitbucket/bitbucket';
        project.pullRequestsUrl = 'http://example.com/bitbucket/bitbucket/pullrequests';

        const pullRequests: any = {
            size: 19,
            pagelen: 10,
            next: 'http://example.com/bitbucket/bitbucket/pullrequests?page=2&state=OPEN',
            values: [
                {
                    links: {
                        self: {
                            href: 'http://example.com/bitbucket/bitbucket/pullrequests/1'
                        }
                    }
                }
            ]
        };

        const pullRequestOne = {
            author: {
                username: 'john.smith',
                display_name: 'John Smith'
            },
            source: {
                branch: {
                    name: 'next'
                }
            },
            destination: {
                repository: {
                    full_name: 'bitbucket/bitbucket',
                    name: 'bitbucket'
                },
                branch: {
                    name: 'master'
                }
            },
            title: 'Fixed bugs',
            description: 'This is a special pull request',
            participants: [
                {
                    role: 'REVIEWER',
                    user: {
                        username: 'jon.snow',
                        display_name: 'Jon Snow'
                    },
                    approved: true
                }
            ],
            state: 'OPEN',
            links: {
                self: {
                    href: 'http://example.com/bitbucket/bitbucket/pullrequests/1'
                }
            }
        };

        const secondPrs: any = {
            values: [
                {
                    links: {
                        self: {
                            href: 'http://example.com/bitbucket/bitbucket/pullrequests/2'
                        }
                    }
                }
            ]
        };

        const pullRequestTwo = {
            author: {
                username: 'john.smith',
                display_name: 'John Smith'
            },
            source: {
                branch: {
                    name: 'next'
                }
            },
            destination: {
                repository: {
                    full_name: 'bitbucket/bitbucket',
                    name: 'bitbucket'
                },
                branch: {
                    name: 'master'
                }
            },
            title: 'Fixed bugs',
            description: 'This is a special pull request',
            participants: [
                {
                    role: 'REVIEWER',
                    user: {
                        username: 'jon.snow',
                        display_name: 'Jon Snow'
                    },
                    approved: true
                }
            ],
            state: 'OPEN',
            links: {
                self: {
                    href: 'http://example.com/bitbucket/bitbucket/pullrequests/2'
                }
            }
        };

        nock('http://example.com')
            .get('/bitbucket/bitbucket/pullrequests')
            .query({state: 'OPEN'})
            .basicAuth(basicAuth)
            .reply(200, JSON.stringify(pullRequests));
        nock('http://example.com')
            .get('/bitbucket/bitbucket/pullrequests')
            .query({page: '2', state: 'OPEN'})
            .basicAuth(basicAuth)
            .reply(200, JSON.stringify(secondPrs));

        nock('http://example.com')
            .get('/bitbucket/bitbucket/pullrequests/1')
            .basicAuth(basicAuth)
            .reply(200, JSON.stringify(pullRequestOne));
        nock('http://example.com')
            .get('/bitbucket/bitbucket/pullrequests/2')
            .basicAuth(basicAuth)
            .reply(200, JSON.stringify(pullRequestTwo));

        PullRequestRepository.fetchByProject(project).then((prs: PullRequest[]) => {
            expect(prs).to.have.length(2);
            const pullRequest = prs[0];
            expect(pullRequest).to.be.instanceOf(PullRequest);
            expect(pullRequest.author).to.be.instanceOf(User);
            expect(pullRequest.state).to.eq(PullRequestState.Open);
            expect(pullRequest.reviewers).to.be.lengthOf(1);

            expect(PullRequestRepository.pullRequests['bitbucket/bitbucket']).to.eq(prs);

            done();
        }).catch((error) => {
            done(error);
        });
    });

    it('should throw an error when request has failed', (done) => {
        nock('http://example.com')
            .get('/bitbucket/bitbucket/pullrequests')
            .basicAuth(basicAuth)
            .replyWithError('something wrong happened');

        const project = new Project();
        project.fullName = 'bitbucket/bitbucket';
        project.pullRequestsUrl = 'http://example.com/bitbucket/bitbucket/pullrequests';

        expect(PullRequestRepository.fetchByProject(project)).to.be.rejectedWith(Error).and.notify(done);
    });

    it('should throw an error when authorization data is incorrect', (done) => {
        nock('http://example.com')
            .get('/bitbucket/bitbucket/pullrequests')
            .basicAuth(basicAuth)
            .reply(403, 'Forbidden');

        const project = new Project();
        project.fullName = 'bitbucket/bitbucket';
        project.pullRequestsUrl = 'http://example.com/bitbucket/bitbucket/pullrequests';

        expect(PullRequestRepository.fetchByProject(project)).to.be.rejectedWith(Error).and.notify(done);
    });

    it('should fetch single pull request by its project and id', (done) => {
        const pullRequestId = 1;
        const project = new Project();
        project.fullName = 'bitbucket/bitbucket';

        const prEncoded = {
            id: 1,
            author: {
                username: 'john.smith',
                display_name: 'John Smith'
            },
            source: {
                branch: {
                    name: 'next'
                }
            },
            destination: {
                repository: {
                    full_name: 'bitbucket/bitbucket',
                    name: 'bitbucket'
                },
                branch: {
                    name: 'master'
                }
            },
            title: 'Fixed bugs',
            description: 'This is a special pull request',
            participants: [
                {
                    role: 'REVIEWER',
                    user: {
                        username: 'jon.snow',
                        display_name: 'Jon Snow'
                    },
                    approved: true
                }
            ],
            state: 'OPEN',
            links: {
                self: {
                    href: 'http://example.com/bitbucket/bitbucket/pullrequests/2'
                }
            }
        };

        nock('http://example.com')
            .get('/repositories/bitbucket/bitbucket/pullrequests/1')
            .basicAuth(basicAuth)
            .reply(200, JSON.stringify(prEncoded));

        PullRequestRepository.fetchOne(project, pullRequestId).then((pr: PullRequest) => {
            expect(pr.id).to.eq(pullRequestId);
            done();
        }).catch((e) => {
            done(e);
        });
    });

    it('should fetch single pull request by prepared link', (done) => {
        const prEncoded = {
            id: 1,
            author: {
                username: 'john.smith',
                display_name: 'John Smith'
            },
            source: {
                branch: {
                    name: 'next'
                }
            },
            destination: {
                repository: {
                    full_name: 'bitbucket/bitbucket',
                    name: 'bitbucket'
                },
                branch: {
                    name: 'master'
                }
            },
            title: 'Fixed bugs',
            description: 'This is a special pull request',
            participants: [
                {
                    role: 'REVIEWER',
                    user: {
                        username: 'jon.snow',
                        display_name: 'Jon Snow'
                    },
                    approved: true
                }
            ],
            state: 'OPEN',
            links: {
                self: {
                    href: 'http://example.com/repositories/bitbucket/bitbucket/pullrequests/1'
                }
            }
        };

        nock('http://example.com')
            .get('/repositories/bitbucket/bitbucket/pullrequests/1')
            .basicAuth(basicAuth)
            .reply(200, JSON.stringify(prEncoded));

        PullRequestRepository.fetchOne('http://example.com/repositories/bitbucket/bitbucket/pullrequests/1')
            .then((pr: PullRequest) => {
                expect(pr.id).to.eq(1);
                expect(pr.title).to.eq('Fixed bugs');
                done();
            }).catch((e) => {
            done(e);
        });
    });

    xit('should throw on error during requesting');

    it('should find all known pull requests', () => {
        PullRequestRepository.pullRequests['bitbucket/bitbucket'] = [
            new PullRequest(),
            new PullRequest()
        ];

        const pullRequests = PullRequestRepository.findAll();
        expect(pullRequests).to.have.length(2);
    });

    it('should find all known pull requests even if they are from different repositories', () => {
        PullRequestRepository.pullRequests['aaa/bbb'] = [
            new PullRequest(),
            new PullRequest()
        ];

        PullRequestRepository.pullRequests['ccc/ddd'] = [
            new PullRequest(),
            new PullRequest()
        ];

        const prs = PullRequestRepository.findAll();
        expect(prs).to.have.length(4);
    });

    it('should find pull requests assigned to user by its username', () => {
        const reviewerUserName = 'john.smith';
        const reviewer = reviewerFaker.fake({user: {username: reviewerUserName}});

        const prOne = prFaker.fake({reviewers: [reviewer]});
        const prTwo = prFaker.fake();

        PullRequestRepository.pullRequests['bitbucket/bitbucket'] = [
            prOne,
            prTwo
        ];

        const pullRequests = PullRequestRepository.findByReviewer(reviewerUserName);

        expect(pullRequests).to.have.length(1);
        expect(pullRequests[0].reviewers[0].user.username).to.eq(reviewerUserName);
    });

    it('should find pull requests by their author', () => {
        const authorUsername = 'john.smith';
        const prOne = prFaker.fake({author: {username: authorUsername}});
        const prTwo = prFaker.fake();

        PullRequestRepository.pullRequests['bitbucket/bitbucket'] = [
            prOne,
            prTwo
        ];

        const pullRequests = PullRequestRepository.findByAuthor(authorUsername);
        expect(pullRequests).to.have.length(1);
        expect(pullRequests[0].author.username).to.eq(authorUsername);
    });

    it('should find all pull requests belonging to user (assigned and authored)', () => {
        const userName = 'john.smith';
        const prOne = prFaker.fake({author: {username: userName}});

        const reviewer = reviewerFaker.fake({user: {username: userName}});
        const prTwo = prFaker.fake({reviewers: [reviewer]});

        PullRequestRepository.pullRequests['bitbucket/bitbucket'] = [
            prOne,
            prTwo
        ];

        const pullRequests = PullRequestRepository.findByUserUuid(userName);
        expect(pullRequests).to.have.length(2);
        expect(pullRequests[0].author.username).to.eq(userName);
        expect(pullRequests[1].reviewers[0].user.username).to.eq(userName);
    });

    it('should not return duplicated pull requests when requesting for user pull requests', () => {
        const userName = 'john.smith';
        const reviewer = reviewerFaker.fake({user: {username: userName}});
        const prOne = prFaker.fake({author: {username: userName}, reviewers: [reviewer]});
        const prTwo = prFaker.fake({author: {username: userName}, reviewers: [reviewer]});

        PullRequestRepository.pullRequests['bitbucket/bitbucket'] = [
            prOne,
            prTwo
        ];

        const pullRequests = PullRequestRepository.findByUserUuid(userName);
        expect(pullRequests).to.have.length(2);
    });

    it('should allow to add new pull request', () => {
        const pullRequest = prFaker.fake();

        PullRequestRepository.add(pullRequest);

        const actualPullRequests: PullRequest[] = PullRequestRepository.findAll();

        expect(actualPullRequests).to.have.length(1);
        expect(actualPullRequests[0]).to.eq(pullRequest);
    });

    it('should allow to update a pull request', () => {
        const projectName = 'team_name/repo_name';
        const project = projectFaker.fake({fullName: projectName});

        const prId = 1;

        const existentPullRequest = prFaker.fake({id: prId, targetRepository: project});
        const newPullRequest = prFaker.fake({id: prId, targetRepository: project, state: PullRequestState.Open});

        PullRequestRepository.pullRequests[projectName] = [existentPullRequest];
        PullRequestRepository.update(newPullRequest);

        const pullRequests = PullRequestRepository.findAll();
        expect(pullRequests.length).to.eq(1);
        expect(pullRequests[0].id).to.eq(prId);
    });

    it('should add a new pull request on update if it doesn\'t exist', () => {
        const projectName = 'team_name/repo_name';
        const project = projectFaker.fake({fullName: projectName});

        const prId = 1;
        const newPullRequest = prFaker.fake({id: prId, targetRepository: project, state: PullRequestState.Open});

        expect(PullRequestRepository.findAll().length).to.eq(0);

        PullRequestRepository.update(newPullRequest);

        const pullRequests = PullRequestRepository.findAll();
        expect(pullRequests.length).to.eq(1);
        expect(pullRequests[0].id).to.eq(prId);
    });

    it('should update a PullRequest only when its status is OPEN', () => {
        const incomingPr = prFaker.fake({state: PullRequestState.Merged});

        PullRequestRepository.pullRequests = {};
        PullRequestRepository.update(incomingPr);

        const pullRequests = PullRequestRepository.findAll();
        expect(pullRequests.length).to.eq(0);
    });

    it('should remove a pull request if its status is not OPEN', () => {
        const projectName = 'team_name/repo_name';
        const project = projectFaker.fake({fullName: projectName});

        const prId = 1;

        const existentPullRequest = prFaker.fake({id: prId, targetRepository: project, state: PullRequestState.Open});
        const incomingPr = prFaker.fake({id: prId, targetRepository: project, state: PullRequestState.Merged});

        PullRequestRepository.pullRequests[projectName] = [existentPullRequest];
        PullRequestRepository.update(incomingPr);

        const pullRequests = PullRequestRepository.findAll();
        expect(pullRequests.length).to.eq(0);
    });

    it('should be able to remove given pull request', () => {
        const projectName = 'team_name/repo_name';
        const project = projectFaker.fake({fullName: projectName});

        const prId = 1;

        const pullRequest = prFaker.fake({id: prId, targetRepository: project, state: PullRequestState.Open});

        PullRequestRepository.pullRequests['team_name/repo_name'] = [pullRequest];

        PullRequestRepository.remove(pullRequest);

        expect(PullRequestRepository.findAll().length).to.eq(0);
    });
});

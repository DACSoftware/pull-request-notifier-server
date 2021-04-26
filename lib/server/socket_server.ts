import * as Server from 'socket.io';
import {PullRequestRepository} from '../repository';
import {
    SocketClientEvent, PullRequest, PullRequestEvent, SocketServerEvent, Reviewer, WebhookEvent, PullRequestWithActor
} from '../model';
import {EventDispatcher} from '../events/event_dispatcher';
import logger from './../logger';
import {Config} from '../config';
import * as _ from 'lodash';
import {PullRequestWithComment} from "../model/pull_request_with_comment";

export class SocketServer {
    static io: SocketIO.Server;
    static startSocketServer(): void {
        const config = Config.getConfig();
        const socketPort = config.socket_port;

        logger.logSocketServerStart(socketPort.toString());
        this.io = Server(socketPort);
        const dispatcher = EventDispatcher.getInstance();

        this.io.on('connection', (socket) => {
            logger.logClientConnected();

            socket.on(SocketClientEvent.INTRODUCE, (userUuid: string) => {
                logger.logClientIntroduced(userUuid);
                socket.join(userUuid);

                const userPullRequests = new PullRequestEvent();
                userPullRequests.sourceEvent = SocketClientEvent.INTRODUCE;
                userPullRequests.pullRequests = PullRequestRepository.findByUserUuid(userUuid);

                logger.logEmittingEventToUser(SocketServerEvent.INTRODUCED, userUuid);
                this.io.to(userUuid).emit(SocketServerEvent.INTRODUCED, userPullRequests);
            });

            socket.on(SocketClientEvent.REMIND, (pullRequest: PullRequest) => {
                logger.logReminderReceived();
                const reviewersToRemind: string[] = _.map(
                    _.filter(pullRequest.reviewers, (reviewer: Reviewer) => {
                        return !reviewer.approved;
                    }),
                    (reviewer: Reviewer) => {
                        return reviewer.user.uuid;
                    }
                );

                let reviewerIdx = 0, reviewersLen = reviewersToRemind.length;
                for (; reviewerIdx < reviewersLen; reviewerIdx++) {
                    const reviewerUuid = reviewersToRemind[reviewerIdx];
                    logger.logSendingReminderToUser(reviewerUuid);
                    this.io.to(reviewerUuid).emit(SocketServerEvent.REMIND, pullRequest);
                }
            });
        });

        dispatcher.on(WebhookEvent.PULLREQUEST_CREATED, (body: PullRequestWithActor) => {
            SocketServer.onWebhookEvent(WebhookEvent.PULLREQUEST_CREATED, body);
        });
        dispatcher.on(WebhookEvent.PULLREQUEST_UPDATED, (body: PullRequestWithActor) => {
            SocketServer.onWebhookEvent(WebhookEvent.PULLREQUEST_UPDATED, body);
        });

        dispatcher.on(WebhookEvent.PULLREQUEST_UPDATED, SocketServer.onWebhookPullRequestUpdated);

        dispatcher.on(WebhookEvent.PULLREQUEST_APPROVED, (body: PullRequestWithActor) => {
            SocketServer.onWebhookEvent(WebhookEvent.PULLREQUEST_APPROVED, body);
        });
        dispatcher.on(WebhookEvent.PULLREQUEST_UNAPPROVED, (body: PullRequestWithActor) => {
            SocketServer.onWebhookEvent(WebhookEvent.PULLREQUEST_UNAPPROVED, body);
        });
        dispatcher.on(WebhookEvent.PULLREQUEST_FULFILLED, (body: PullRequestWithActor) => {
            SocketServer.onWebhookEvent(WebhookEvent.PULLREQUEST_FULFILLED, body);
        });
        dispatcher.on(WebhookEvent.PULLREQUEST_REJECTED, (body: PullRequestWithActor) => {
            SocketServer.onWebhookEvent(WebhookEvent.PULLREQUEST_REJECTED, body);
        });

        dispatcher.on(WebhookEvent.PULLREQUEST_COMMENTED, SocketServer.onWebhookPullReqeustCommented)
    }

    static stopSocketServer(): void {
        this.io.close();
    }

    private static onWebhookEvent(eventName: string, pullRequestWithActor: PullRequestWithActor): void {
        logger.logWebhookEventReceived(eventName);
        const pullRequest = pullRequestWithActor.pullRequest;
        const actor = pullRequestWithActor.actor;
        const authorUuid = pullRequest.author.uuid;

        const userPullRequests = new PullRequestEvent();
        userPullRequests.actor = actor;
        userPullRequests.sourceEvent = eventName;
        userPullRequests.context = pullRequest;
        // @todo Bring back authored and assigned pull requests
        userPullRequests.pullRequests = PullRequestRepository.findByUserUuid(authorUuid);

        logger.logEmittingEventToUser(SocketServerEvent.PULLREQUESTS_UPDATED, authorUuid);
        SocketServer.io.to(authorUuid).emit(SocketServerEvent.PULLREQUESTS_UPDATED, userPullRequests);

        const reviewers: Reviewer[] = pullRequest.reviewers || [];

        let reviewerIdx = 0, reviewersLength = reviewers.length;
        for (; reviewerIdx < reviewersLength; reviewerIdx++) {
            const reviewerUserUuid = reviewers[reviewerIdx].user.uuid;
            const reviewerPr = new PullRequestEvent();
            reviewerPr.sourceEvent = eventName;
            reviewerPr.actor = actor;
            reviewerPr.context = pullRequest;
            // @todo Bring back authored and assigned pull requests
            reviewerPr.pullRequests = PullRequestRepository.findByUserUuid(reviewerUserUuid);

            logger.logEmittingEventToUser(SocketServerEvent.PULLREQUESTS_UPDATED, reviewerUserUuid);
            SocketServer.io.to(reviewerUserUuid).emit(SocketServerEvent.PULLREQUESTS_UPDATED, reviewerPr);
        }
    }

    private static onWebhookPullRequestUpdated(pullRequestWithActor: PullRequestWithActor) {
        const pullRequest = pullRequestWithActor.pullRequest;
        logger.logSinglePullRequestUpdated(pullRequest);

        const reviewers = pullRequest.reviewers || [];
        for (const reviewer of reviewers) {
            const reviewerUserUuid = reviewer.user.uuid;
            logger.logSendingUpdateNotification(pullRequest, reviewerUserUuid);
            SocketServer.io.to(reviewerUserUuid).emit(SocketServerEvent.PULLREQUEST_UPDATED, pullRequest);
        }
    }

    private static onWebhookPullReqeustCommented(pullRequestWithComment: PullRequestWithComment) {
        const authorUserUuid = pullRequestWithComment.pullRequest.author.uuid;
        SocketServer.io.to(authorUserUuid).emit(SocketServerEvent.NEW_COMMENT, pullRequestWithComment);
    }
}

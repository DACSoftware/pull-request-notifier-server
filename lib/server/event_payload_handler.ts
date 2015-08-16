///<reference path="../../typings/tsd.d.ts"/>

import repositories = require('./../repositories');
import factories = require('./../factories');
import logger = require('./../logger');
import eventDispatcher = require('./../events/event_dispatcher');
import models = require('./../models');
import q = require('q');

export interface HandlerInterface {
    supportedEvents: Array<string>;
    handlePayload(type: string, bodyDecoded: any): q.Promise<any>;
    prepareBody(bodyEncoded: any): q.Promise<any>;
}

export class PullRequestHandler implements HandlerInterface {
    supportedEvents: Array<string> = [
        'pullrequest:created',
        'pullrequest:updated',
        'pullrequest:fulfilled',
        'pullrequest:rejected',
        'pullrequest:approved',
        'pullrequest:unapproved',
    ];

    private PULLREQUEST_CREATED: string = 'pullrequest:created';
    private PULLREQUEST_UPDATED: string = 'pullrequest:updated';

    private PULLREQUEST_FULFILLED: string = 'pullrequest:fulfilled';
    private PULLREQUEST_REJECTED: string = 'pullrequest:rejected';

    private PULLREQUEST_APPROVED: string = 'pullrequest:approved';
    private PULLREQUEST_UNAPPROVED: string = 'pullrequest:unapproved';

    handlePayload(type: string, pullRequest: models.PullRequest): q.Promise<models.PullRequest> {
        var deferred = q.defer<models.PullRequest>();

        switch (type) {
            case this.PULLREQUEST_CREATED:
                this.onPullRequestCreated(pullRequest).then(() => {
                    deferred.resolve(pullRequest);
                });
                break;
            case this.PULLREQUEST_UPDATED:
            case this.PULLREQUEST_APPROVED:
            case this.PULLREQUEST_UNAPPROVED:
                this.onPullRequestUpdated(pullRequest).then(() => {
                    deferred.resolve(pullRequest);
                });
                break;
            case this.PULLREQUEST_FULFILLED:
            case this.PULLREQUEST_REJECTED:
                this.onPullRequestClosed(pullRequest).then(() => {
                    deferred.resolve(pullRequest);
                });
                break;
            default:
                logger.info('Unhandled event payload: ' + type);
                deferred.resolve(pullRequest);
                return;
        }

        return deferred.promise;
    }

    prepareBody(bodyDecoded): q.Promise<models.PullRequest> {
        var deferred = q.defer<models.PullRequest>();
        var pullRequest = factories.PullRequestFactory.create(bodyDecoded.pullrequest);
        deferred.resolve(pullRequest);
        return deferred.promise;
    }

    private onPullRequestCreated(pullRequest: models.PullRequest): q.Promise<models.PullRequest> {
        var deferred = q.defer<models.PullRequest>();
        logger.info('Adding a pull request to the repository');
        repositories.PullRequestRepository.add(pullRequest);
        deferred.resolve(pullRequest);
        return deferred.promise;
    }

    private onPullRequestUpdated(pullRequest: models.PullRequest): q.Promise<models.PullRequest> {
        var deferred = q.defer<models.PullRequest>();
        logger.info('Updating a pull request');
        repositories.PullRequestRepository.update(pullRequest);
        deferred.resolve(pullRequest);
        return deferred.promise;
    }

    private onPullRequestClosed(pullRequest: models.PullRequest): q.Promise<models.PullRequest> {
        var deferred = q.defer<models.PullRequest>();
        logger.info('Closing a pull request');
        repositories.PullRequestRepository.remove(pullRequest);
        deferred.resolve(pullRequest);
        return deferred.promise;
    }
}

export class EventPayloadHandler {
    private static handlers: Array<HandlerInterface> = [
        new PullRequestHandler()
    ];

    static handlePayload(type: string, bodyEncoded: string): q.Promise<any> {
        var bodyDecoded = JSON.parse(bodyEncoded);
        var deferred = q.defer();
        var handlers: Array<HandlerInterface> = this.handlers.filter((handler: HandlerInterface) => {
             return handler.supportedEvents.indexOf(type) !== -1;
        });

        q.all(
            handlers.map((handler: HandlerInterface) => {
                var handlerDefer = q.defer();

                handler.prepareBody(bodyDecoded).then((preparedBody) => {
                    handler.handlePayload(type, preparedBody).then(() => {
                        this.triggerEvent(type, preparedBody);
                        handlerDefer.resolve(true);
                    });
                });

                return handlerDefer.promise;
            })
        ).then(() => {
            deferred.resolve(true);
        });

        return deferred.promise;
    }

    private static triggerEvent(payloadType: string, contents: any = {}): void {
        var eventName = 'webhook:' + payloadType;
        eventDispatcher.EventDispatcher.getInstance().emit(eventName, contents);
    }
}

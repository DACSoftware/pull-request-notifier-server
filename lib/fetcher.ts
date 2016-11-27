///<reference path="../typings/index.d.ts"/>

import q = require('q');

import {Project} from './models';
import {ProjectRepository, PullRequestRepository} from './repositories';
import logger = require('./logger');

export class Fetcher {
    static initPullRequestCollection(): q.Promise<any> {
        logger.logInitializingPullRequests();

        const deferred = q.defer();

        ProjectRepository.fetchAll().then((projects: Project[]) => {
            q.all(
                projects.map((project: Project) => {
                    return PullRequestRepository.fetchByProject(project);
                })
            ).done((_) => {
                logger.logPullRequestsInitialized(PullRequestRepository.findAll().length);
                deferred.resolve(null);
            });
        }).catch((error) => {
            logger.logInitializationFailed();
            deferred.reject(error);
        });

        return deferred.promise;
    }
}

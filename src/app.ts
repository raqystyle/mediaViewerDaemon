/// <reference path="../typings/index.d.ts" />
/// <reference path="./definitions/index.d.ts" />

import { UserConfig } from './interfaces';
import { compose, map, append } from 'ramda';
import { readDirRecursively, processFile, watchDir, unwatchDirs } from './service';
import { fromArray, fromEvent } from 'baconjs'
import { isPhoto } from './helpers'
import { logger } from './logger';
import * as Future from 'fluture';

const userConfig:UserConfig = require('../config/user-config.json');

const fromFuture = <L, R>(future:Future<L, R>):Bacon.EventStream<L, R> =>
    Bacon.fromBinder(sink => {
        future.bimap(err => new Bacon.Error(err), res => new Bacon.Next(res))
        return () => {};
    });

const sigterm = fromEvent(process, 'SIGTERM')
    .doAction(x => logger.info('SIGTERM: stopping the process'));

const filesToProcess = fromArray(userConfig.srcPaths)
    .flatMap(readDirRecursively).filter(isPhoto).log();

const dirsToWatch = fromArray(userConfig.srcPaths)
    .doAction(x => logger.log('log', 'watch dir', x))
    .map(watchDir)
    .scan([], append)
    .sampledBy(sigterm)
    .onValue(unwatchDirs);

filesToProcess
    .takeUntil(sigterm)
    .map(processFile)
    .onValue(x => x.fork(logger.error, logger.info));   
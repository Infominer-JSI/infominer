/***********************************************
 * Process Control
 * This is the class that stores the metadata
 * and enables communcation with the child
 * processes.
 */

// import interfaces
import {
    TGeneralCallback,
    EParentCmd,
    IChildH,
    ICallbackH,
    IProcessSendParams,
    IChildMsg,
    IProcessControlParams,
} from "../interfaces";

// import modules
import { fork } from "child_process";
import { BadRequest, ServerError, UserNotAuthorized } from "./ErrorDefs";

function setError(statusCode?: number, message?: string) {
    switch (statusCode) {
        case 400:
            return new BadRequest(message as string);
        case 401:
            return new UserNotAuthorized(message as string);
        case 500:
            return new ServerError(message as string);
        default:
            return message ? new Error(message) : undefined;
    }
}

// child process control instance
export default class ProcessControl {
    private _currentReqId: number;
    private _childH: Map<number, IChildH>;
    private _callbackH: Map<number, ICallbackH>;
    private _processPath: string;
    private _processMaxAge: number;
    private _cleanupInterval: NodeJS.Timeout;

    // construct the process control
    constructor(params: IProcessControlParams) {
        //set default variables
        this._currentReqId = 0;
        this._childH = new Map();
        this._callbackH = new Map();

        // initialize parameters
        this._processPath = params.processPath;
        this._processMaxAge = params.processMaxAge;

        // set the cleanup interval (default: 1 hour)
        const cleanupInterval = params.cleanupInterval || 60 * 60 * 1000;
        this._cleanupInterval = setInterval(() => {
            this._cleanupProcesses();
        }, cleanupInterval);
    }

    // initialize the child process
    createChild(childId: number) {
        // create the child process
        const child = fork(this._processPath, [], {
            silent: false,
            // development mode: used with start:dev
            ...(process.env.TS_NODE_DEV && {
                execArgv: ["-r", "ts-node/register"],
            }),
        });
        this._childH.set(childId, { child, connected: true, lastCall: 0 });

        child.on("message", (message: IChildMsg) => {
            // get the message request ID and callback
            const { requestId, results, error: eMessage, statusCode } = message;
            const callbackH = this._callbackH.get(requestId);
            if (callbackH) {
                // get the callback function
                const callback = callbackH.callback;
                // get the error object (if any)
                const error = setError(statusCode, eMessage);
                // envoke the callback
                callback(error, results);
                // delete the callback hash
                this._callbackH.delete(requestId);
            }
        });

        child.on("exit", () => {
            this._childH.delete(childId);
        });
    }

    // check if the child exists
    doesChildExist(childId: number) {
        return !!this._getChild(childId);
    }

    // get the child process if it exists
    _getChild(childId: number) {
        return this._childH.get(childId);
    }

    // update the last call of the process
    _updateLastCall(childId: number, process: IChildH) {
        process.lastCall = Date.now();
        this._childH.set(childId, process);
    }

    // sent the message to the child process. response is requested
    sendAndWait(childId: number, params: IProcessSendParams, callback: TGeneralCallback<any>) {
        const childH = this._getChild(childId);
        if (!childH) {
            return callback(new Error("Child process does not exist"));
        }
        // update child process
        this._updateLastCall(childId, childH);
        // store the callback
        this._callbackH.set(this._currentReqId, {
            timestamp: Date.now(),
            retriesLeft: 10,
            callback,
        });
        // prepare the message
        const message = {
            requestId: this._currentReqId++,
            body: params,
        };
        if (childH.connected) {
            // send the child the message
            childH.child.send(message);
        } else {
            callback(new Error("Child process is disconnected"));
        }
        // TODO: handle request cleanup
        if (this._currentReqId % 100) {
            this._cleanRequestMap();
        }
    }

    // cleans the request mapping
    _cleanRequestMap() {
        // the maximum duration of the callback
        const maxDuration = 2 * 60 * 1000;
        for (const key of this._callbackH.keys()) {
            const now = Date.now();
            // check if the callback is "maxDuration" old
            const callbackH = this._callbackH.get(key);
            if (callbackH && now - callbackH.timestamp > maxDuration && callbackH.retriesLeft) {
                // the callback still has some retries left
                callbackH.timestamp = Date.now();
                callbackH.retriesLeft--;
                this._callbackH.set(key, callbackH);
            } else if (callbackH && now - callbackH.timestamp > maxDuration) {
                // no retries left - request a timeout
                const callback = callbackH.callback;
                this._callbackH.delete(key);
                callback(new Error("Request timeout"));
            }
        }
    }

    // stop the process
    _stopProcess(childId: number) {
        return new Promise((resolve, reject) => {
            console.log("Running stop process tasks for child id=", childId);
            try {
                this.sendAndWait(childId, { cmd: EParentCmd.SHUTDOWN }, (error) =>
                    error ? reject(error) : resolve(null)
                );
            } catch (xerror) {
                return reject(xerror);
            }
        });
    }

    // cleans up the process
    _cleanupProcesses() {
        // iterate through the processes and close the old ones
        for (const key of this._childH.keys()) {
            const now = Date.now();
            const child = this._getChild(key);
            if (child && now - child.lastCall > this._processMaxAge) {
                // send to process to shutdown. this will remove the child from the hash
                this._stopProcess(key).catch((error) => console.log(error.message));
            }
        }
    }

    // closes all processes
    async closeProcesses() {
        const tasks = [];
        for (const key of this._childH.keys()) {
            tasks.push(key ? this._stopProcess(key) : null);
        }
        // clear the cleanup interval
        clearInterval(this._cleanupInterval);
        // wait for all processses to settle
        return await Promise.allSettled(tasks);
    }
}

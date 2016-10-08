/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Promise, TPromise } from 'vs/base/common/winjs.base';
import { IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import Event, { Emitter } from 'vs/base/common/event';

enum MessageType {
	RequestCommon,
	RequestCancel,
	ResponseInitialize,
	ResponseSuccess,
	ResponseProgress,
	ResponseError,
	ResponseErrorObj
}

function isResponse(messageType: MessageType): boolean {
	return messageType >= MessageType.ResponseInitialize;
}

interface IRawMessage {
	id: number;
	type: MessageType;
}

interface IRawRequest extends IRawMessage {
	channelName?: string;
	name?: string;
	arg?: any;
}

interface IRequest {
	raw: IRawRequest;
	emitter?: Emitter<any>;
	flush?: () => void;
}

interface IRawResponse extends IRawMessage {
	data: any;
}

interface IHandler {
	(response: IRawResponse): void;
}

export interface IMessagePassingProtocol {
	send(request: any): void;
	onMessage: Event<any>;
}

enum State {
	Uninitialized,
	Idle
}

export interface IChannel {
	call(command: string, arg?: any): TPromise<any>;
}

export interface IChannelServer {
	registerChannel(channelName: string, channel: IChannel): void;
}

export interface IChannelClient {
	getChannel<T extends IChannel>(channelName: string): T;
}

export interface IClientRouter {
	routeCall(command: string, arg: any): string;
}

export interface IRoutingChannelClient {
	getChannel<T extends IChannel>(channelName: string, router: IClientRouter): T;
}

export class ChannelServer {

	private channels: { [name: string]: IChannel };
	private activeRequests: { [id: number]: IDisposable; };
	private protocolListener: IDisposable;

	constructor(private protocol: IMessagePassingProtocol) {
		this.channels = Object.create(null);
		this.activeRequests = Object.create(null);
		this.protocolListener = this.protocol.onMessage(r => this.onMessage(r));
		this.protocol.send(<IRawResponse>{ type: MessageType.ResponseInitialize });
	}

	registerChannel(channelName: string, channel: IChannel): void {
		this.channels[channelName] = channel;
	}

	private onMessage(request: IRawRequest): void {
		switch (request.type) {
			case MessageType.RequestCommon:
				this.onCommonRequest(request);
				break;

			case MessageType.RequestCancel:
				this.onCancelRequest(request);
				break;
		}
	}

	private onCommonRequest(request: IRawRequest): void {
		const channel = this.channels[request.channelName];
		let promise: Promise;

		try {
			promise = channel.call(request.name, request.arg);
		} catch (err) {
			promise = Promise.wrapError(err);
		}

		const id = request.id;

		const requestPromise = promise.then(data => {
			this.protocol.send(<IRawResponse>{ id, data, type: MessageType.ResponseSuccess });
			delete this.activeRequests[request.id];
		}, data => {
			if (data instanceof Error) {
				this.protocol.send(<IRawResponse>{
					id, data: {
						message: data.message,
						name: data.name,
						stack: data.stack ? data.stack.split('\n') : void 0
					}, type: MessageType.ResponseError
				});
			} else {
				this.protocol.send(<IRawResponse>{ id, data, type: MessageType.ResponseErrorObj });
			}

			delete this.activeRequests[request.id];
		}, data => {
			this.protocol.send(<IRawResponse>{ id, data, type: MessageType.ResponseProgress });
		});

		this.activeRequests[request.id] = toDisposable(() => requestPromise.cancel());
	}

	private onCancelRequest(request: IRawRequest): void {
		const disposable = this.activeRequests[request.id];

		if (disposable) {
			disposable.dispose();
			delete this.activeRequests[request.id];
		}
	}

	public dispose(): void {
		this.protocolListener.dispose();
		this.protocolListener = null;

		Object.keys(this.activeRequests).forEach(id => {
			this.activeRequests[<any>id].dispose();
		});

		this.activeRequests = null;
	}
}

export class ChannelClient implements IChannelClient, IDisposable {

	private state: State;
	private activeRequests: Promise[];
	private bufferedRequests: IRequest[];
	private handlers: { [id: number]: IHandler; };
	private lastRequestId: number;
	private protocolListener: IDisposable;

	constructor(private protocol: IMessagePassingProtocol) {
		this.state = State.Uninitialized;
		this.activeRequests = [];
		this.bufferedRequests = [];
		this.handlers = Object.create(null);
		this.lastRequestId = 0;
		this.protocolListener = this.protocol.onMessage(r => this.onMessage(r));
	}

	getChannel<T extends IChannel>(channelName: string): T {
		const call = (command, arg) => this.request(channelName, command, arg);
		return { call } as T;
	}

	private request(channelName: string, name: string, arg: any): Promise {
		const request = {
			raw: {
				id: this.lastRequestId++,
				type: MessageType.RequestCommon,
				channelName,
				name,
				arg
			}
		};

		const activeRequest = this.state === State.Uninitialized
			? this.bufferRequest(request)
			: this.doRequest(request);

		this.activeRequests.push(activeRequest);

		activeRequest
			.then(null, _ => null)
			.done(() => this.activeRequests = this.activeRequests.filter(i => i !== activeRequest));

		return activeRequest;
	}

	private doRequest(request: IRequest): Promise {
		const id = request.raw.id;

		return new Promise((c, e, p) => {
			this.handlers[id] = response => {
				switch (response.type) {
					case MessageType.ResponseSuccess:
						delete this.handlers[id];
						c(response.data);
						break;

					case MessageType.ResponseError:
						delete this.handlers[id];
						const error = new Error(response.data.message);
						(<any>error).stack = response.data.stack;
						error.name = response.data.name;
						e(error);
						break;

					case MessageType.ResponseErrorObj:
						delete this.handlers[id];
						e(response.data);
						break;

					case MessageType.ResponseProgress:
						p(response.data);
						break;
				}
			};

			this.send(request.raw);
		},
			() => this.send({ id, type: MessageType.RequestCancel }));
	}

	private bufferRequest(request: IRequest): Promise {
		let flushedRequest: Promise = null;

		return new Promise((c, e, p) => {
			this.bufferedRequests.push(request);

			request.flush = () => {
				request.flush = null;
				flushedRequest = this.doRequest(request).then(c, e, p);
			};
		}, () => {
			request.flush = null;

			if (this.state !== State.Uninitialized) {
				if (flushedRequest) {
					flushedRequest.cancel();
					flushedRequest = null;
				}

				return;
			}

			const idx = this.bufferedRequests.indexOf(request);

			if (idx === -1) {
				return;
			}

			this.bufferedRequests.splice(idx, 1);
		});
	}

	private onMessage(response: IRawResponse): void {
		if (!isResponse(response.type)) {
			return;
		}

		if (this.state === State.Uninitialized && response.type === MessageType.ResponseInitialize) {
			this.state = State.Idle;
			this.bufferedRequests.forEach(r => r.flush && r.flush());
			this.bufferedRequests = null;
			return;
		}

		const handler = this.handlers[response.id];
		if (handler) {
			handler(response);
		}
	}

	private send(raw: IRawRequest) {
		try {
			this.protocol.send(raw);
		} catch (err) {
			// noop
		}
	}

	dispose(): void {
		this.protocolListener.dispose();
		this.protocolListener = null;

		this.activeRequests.forEach(r => r.cancel());
		this.activeRequests = [];
	}
}

export function getDelayedChannel<T extends IChannel>(promise: TPromise<T>): T {
	const call = (command, arg) => promise.then(c => c.call(command, arg));
	return { call } as T;
}

export function getNextTickChannel<T extends IChannel>(channel: T): T {
	let didTick = false;

	const call = (command, arg) => {
		if (didTick) {
			return channel.call(command, arg);
		}

		return TPromise.timeout(0)
			.then(() => didTick = true)
			.then(() => channel.call(command, arg));
	};

	return { call } as T;
}

export type Serializer<T, R> = (obj: T) => R;
export type Deserializer<T, R> = (raw: R) => T;

export function eventToCall<T>(event: Event<T>, serializer: Serializer<T, any> = t => t): TPromise<void> {
	let disposable: IDisposable;

	return new Promise(
		(c, e, p) => disposable = event(t => p(serializer(t))),
		() => disposable.dispose()
	);
}

export function eventFromCall<T>(channel: IChannel, name: string, arg: any = null, deserializer: Deserializer<T, any> = t => t): Event<T> {
	let promise: Promise;

	const emitter = new Emitter<any>({
		onFirstListenerAdd: () => {
			promise = channel.call(name, arg)
				.then(null, err => null, e => emitter.fire(deserializer(e)));
		},
		onLastListenerRemove: () => {
			promise.cancel();
			promise = null;
		}
	});

	return emitter.event;
}
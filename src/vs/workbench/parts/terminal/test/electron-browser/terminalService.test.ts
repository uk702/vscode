/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

//import * as assert from 'assert';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
//import { TerminalInstance } from 'vs/workbench/parts/terminal/electron-browser/terminalInstance';
import { TerminalService } from 'vs/workbench/parts/terminal/electron-browser/terminalService';
import { TERMINAL_DEFAULT_SHELL_LINUX, TERMINAL_DEFAULT_SHELL_OSX, TERMINAL_DEFAULT_SHELL_WINDOWS } from 'vs/workbench/parts/terminal/common/terminal';
import { TestInstantiationService } from 'vs/test/utils/instantiationTestUtils';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { TPromise } from 'vs/base/common/winjs.base';

class TestTerminalService extends TerminalService {
	public showPanel(focus?: boolean): TPromise<void> {
		return TPromise.as(void 0);
	}

	public hidePanel(): void { }
}

suite('Workbench - TerminalService', () => {
	let instantiationService: TestInstantiationService;
	let configurationService: TestConfigurationService;
	let service: TerminalService;

	setup(() => {
		configurationService = new TestConfigurationService();
		configurationService.setUserConfiguration('terminal', {
			integrated: {
				shell: {
					linux: TERMINAL_DEFAULT_SHELL_LINUX,
					osx: TERMINAL_DEFAULT_SHELL_OSX,
					windows: TERMINAL_DEFAULT_SHELL_WINDOWS
				},
				setLocaleVariables: false
			}
		});
		instantiationService = new TestInstantiationService();
		instantiationService.stub(IContextKeyService, { createKey: () => null });
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(IInstantiationService, instantiationService);
		instantiationService.stub(IWorkspaceContextService, { getWorkspace: () => null });
		service = instantiationService.createInstance(TestTerminalService);
	});

	// TODO@Tyriar: Re-enable these tests after testing them on Windows
	// suite('createInstance', () => {
	// 	test('should return the new instance', () => {
	// 		assert.ok(service.createInstance() instanceof TerminalInstance);
	// 	});

	// 	test('should register the new instance on the service', () => {
	// 		const instance = service.createInstance();
	// 		assert.deepEqual(service.terminalInstances, [instance]);
	// 	});

	// 	test('should deregister an instance from the service when it\'s disposed', () => {
	// 		const instance = service.createInstance();
	// 		assert.equal(service.terminalInstances.length, 1);

	// 		instance.dispose();
	// 		assert.equal(service.terminalInstances.length, 0);
	// 	});

	// 	test('should only automatically set the first instance as the active instance', () => {
	// 		const first = service.createInstance();
	// 		assert.equal(service.getActiveInstance(), first);

	// 		service.createInstance();
	// 		assert.equal(service.getActiveInstance(), first);
	// 	});
	// });

	// suite('onInstancesChanged event', () => {
	// 	test('should fire when an instance is created', () => {
	// 		let count = 0;
	// 		service.onInstancesChanged(() => { count++; });
	// 		service.createInstance();
	// 		assert.equal(count, 1);
	// 		service.createInstance();
	// 		assert.equal(count, 2);
	// 	});

	// 	test('should fire when an instance is disposed', () => {
	// 		let count = 0;
	// 		service.onInstancesChanged(() => { count++; });
	// 		service.createInstance().dispose();
	// 		assert.equal(count, 2);
	// 	});
	// });

	// suite('onInstanceDisposed event', () => {
	// 	test('should fire when an instance is disposed', () => {
	// 		let count = 0;
	// 		service.onInstanceDisposed(() => { count++; });
	// 		service.createInstance().dispose();
	// 		assert.equal(count, 1);
	// 	});
	// });
});
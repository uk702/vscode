/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import errors = require('vs/base/common/errors');
import { TPromise } from 'vs/base/common/winjs.base';
import { IAction } from 'vs/base/common/actions';
import { SelectActionItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IDebugService, State } from 'vs/workbench/parts/debug/common/debug';

export class DebugSelectActionItem extends SelectActionItem {

	constructor(
		action: IAction,
		@IDebugService private debugService: IDebugService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(null, action, [], -1);

		this.toDispose.push(configurationService.onDidUpdateConfiguration(e => {
			this.updateOptions(true).done(null, errors.onUnexpectedError);
		}));
		this.toDispose.push(this.debugService.getViewModel().onDidSelectConfigurationName(name => {
			this.updateOptions(false).done(null, errors.onUnexpectedError);
		}));
		this.toDispose.push(this.debugService.onDidChangeState(() => {
			this.enabled = this.debugService.state === State.Inactive;
		}));
	}

	public render(container: HTMLElement): void {
		super.render(container);
		this.updateOptions(true).done(null, errors.onUnexpectedError);
		this.enabled = this.debugService.state === State.Inactive;
	}

	private updateOptions(changeDebugConfiguration: boolean): TPromise<any> {
		const configurationManager = this.debugService.getConfigurationManager();
		return configurationManager.loadLaunchConfig().then(config => {
			if (!config || !config.configurations || config.configurations.length === 0) {
				this.setOptions([nls.localize('noConfigurations', "No Configurations")], 0);
				return changeDebugConfiguration ? this.actionRunner.run(this._action, null) : null;
			}

			const configurationNames = config.configurations.filter(cfg => !!cfg.name).map(cfg => cfg.name);
			const selected = configurationNames.indexOf(this.debugService.getViewModel().selectedConfigurationName);
			this.setOptions(configurationNames, selected);

			if (changeDebugConfiguration) {
				return this.actionRunner.run(this._action, this.getSelected());
			}
		});
	}
}

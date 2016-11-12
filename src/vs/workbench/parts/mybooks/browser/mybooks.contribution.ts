/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/mybooks.contribution';
import { Registry } from 'vs/platform/platform';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor } from 'vs/workbench/browser/viewlet';

import nls = require('vs/nls');
import * as Constants from 'vs/workbench/parts/mybooks/common/constants';

// 注册到最左侧的切换条上
// Register Books Viewlet
(<ViewletRegistry>Registry.as(ViewletExtensions.Viewlets)).registerViewlet(new ViewletDescriptor(
	'vs/workbench/parts/mybooks/browser/mybooksViewlet',
	'MybooksViewlet',
	Constants.VIEWLET_ID,
	nls.localize('name', "我的知识库"),
	'mybooks',
	200
));

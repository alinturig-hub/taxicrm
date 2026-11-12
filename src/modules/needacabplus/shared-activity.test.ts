import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {activityLabel} from './shared-activity-label';
test('renders unavailable timestamps without suggesting a failure',()=>assert.equal(activityLabel(null),'No record available'));
test('uses London time including daylight saving',()=>assert.equal(activityLabel(new Date('2026-06-01T10:00:00Z')),'1 Jun 2026, 11:00 · London'));

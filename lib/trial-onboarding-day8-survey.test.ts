import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatDay8Survey,
  parseDay8SurveyResponse,
} from './trial-onboarding-day8-survey';

describe('parseDay8SurveyResponse', () => {
  it('parses numbered replies', () => {
    assert.equal(parseDay8SurveyResponse('1'), 'price');
    assert.equal(parseDay8SurveyResponse('3'), 'not_useful');
    assert.equal(parseDay8SurveyResponse('5'), 'not_used');
  });

  it('parses text replies', () => {
    assert.equal(parseDay8SurveyResponse('Es el precio'), 'price');
    assert.equal(parseDay8SurveyResponse('faltan features'), 'features');
    assert.equal(parseDay8SurveyResponse('no tuve tiempo'), 'no_time');
  });

  it('returns null for unrelated text', () => {
    assert.equal(parseDay8SurveyResponse('hola'), null);
  });
});

describe('formatDay8Survey', () => {
  it('includes all five options', () => {
    const body = formatDay8Survey({ trial_user_name: 'Ana', trial_user_email: 'a@b.com' });
    assert.match(body, /Precio/);
    assert.match(body, /features/);
    assert.match(body, /No me sirvió/);
    assert.match(body, /No tuve tiempo/);
    assert.match(body, /No la usé/);
  });
});

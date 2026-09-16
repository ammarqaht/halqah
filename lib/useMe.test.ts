import { describe, expect, it } from 'vitest';
import { shortGreetingName, greeting } from './useMe';

/* الرئيسية greeted every supervisor as «أبا عبدالله» — a literal in the page,
   correct for one account and wrong for four. */
describe('shortGreetingName', () => {
  it('يأخذ الاسم الأول', () => {
    expect(shortGreetingName('تركي جمعة داود الجميعة')).toBe('تركي');
    expect(shortGreetingName('ناصر عبدالله بوقرصين')).toBe('ناصر');
  });

  it('ولا يقطع «عبد» عمّا بعدها', () => {
    /* «محمد عبد الرحمن الغامدي» came back «محمد عبد» when this took two words. */
    expect(shortGreetingName('محمد عبد الرحمن الغامدي')).toBe('محمد');
    expect(shortGreetingName('عبد الرحمن السالم')).toBe('عبد الرحمن');
    expect(shortGreetingName('أبو بكر الصديق')).toBe('أبو بكر');
  });

  it('ويحتمل الاسم المفرد والفراغ', () => {
    expect(shortGreetingName('عبدالله')).toBe('عبدالله');
    expect(shortGreetingName('  ')).toBe('');
  });
});

describe('greeting', () => {
  it('صباحًا ومساءً', () => {
    expect(greeting(new Date('2026-09-16T08:00:00'))).toBe('صباح الخير');
    expect(greeting(new Date('2026-09-16T16:00:00'))).toBe('مساء الخير');
  });
});

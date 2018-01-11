/* eslint-disable no-mixed-operators */
import moment from 'moment';
import 'moment-timezone';
import recurrenceIterator, {
  compareStart,
  stringToRRuleDate,
  realDateToRRuleDate,
} from './recurrenceIterator';

describe('compareStart', () => {
  it('should compare start datetimes', () => {
    expect(
      compareStart(
        { start: new Date('2017-01-01T00:00') },
        { start: new Date('2017-01-02T00:00') },
      ),
    ).toBe(-1);
    expect(
      compareStart(
        { start: new Date('2017-01-02T00:00') },
        { start: new Date('2017-01-01T00:00') },
      ),
    ).toBe(1);
    expect(
      compareStart(
        { start: new Date('2017-01-01T00:00') },
        { start: new Date('2017-01-01T00:00') },
      ),
    ).toBe(0);
  });
  it('should treat null start times as larger than real values', () => {
    expect(
      compareStart({ start: new Date('2017-01-01T00:00') }, { start: null }),
    ).toBe(-1);
    expect(
      compareStart({ start: null }, { start: new Date('2017-01-01T00:00') }),
    ).toBe(1);
  });
  it('should treat null start times as equal', () => {
    expect(compareStart({ start: null }, { start: null })).toBe(0);
  });
});

describe('stringToRRuleDate', () => {
  it('should create a local time for the UTC time (JavaScript ISO)', () => {
    const date = stringToRRuleDate('2017-01-02T08:07:06');
    expect(moment(date).format('YYYY-MM-DD HH:mm:ss')).toBe(
      '2017-01-02 08:07:06',
    );
  });
  it('should create a local time for the UTC time (RRULE ISO)', () => {
    const date = stringToRRuleDate('20170102T080706');
    expect(moment(date).format('YYYY-MM-DD HH:mm:ss')).toBe(
      '2017-01-02 08:07:06',
    );
  });
});

describe('recurrenceIterator', () => {
  it('should exit if sequences is empty', () => {
    const ri = recurrenceIterator([]);
    const next = ri.next();
    expect(next.value).toBe(undefined);
    expect(next.done).toBe(true);
  });
  it('should return a single value for a single non-recurring rule', () => {
    const seq1 = { start_datetime: '2017-01-01T00:00Z' };
    const ri = recurrenceIterator([seq1]);
    let next = ri.next();
    expect(next.value.sequence).toBe(seq1);
    expect(next.value.start.toISOString()).toBe('2017-01-01T00:00:00.000Z');
    expect(next.done).toBe(false);
    next = ri.next();
    expect(next.value).toBe(undefined);
    expect(next.done).toBe(true);
  });
  it('should return a sorted values for multiple non-recurring rules', () => {
    const seq1 = { start_datetime: '2017-01-01T00:00Z' };
    const seq2 = { start_datetime: '2017-01-02T00:00Z' };
    const seq3 = { start_datetime: '2017-01-02T01:00Z' };
    const ri = recurrenceIterator([seq1, seq3, seq2]);
    let next = ri.next();
    expect(next.value.sequence).toBe(seq1);
    expect(next.value.start.toISOString()).toBe('2017-01-01T00:00:00.000Z');
    next = ri.next();
    expect(next.value.sequence).toBe(seq2);
    expect(next.value.start.toISOString()).toBe('2017-01-02T00:00:00.000Z');
    next = ri.next();
    expect(next.value.sequence).toBe(seq3);
    expect(next.value.start.toISOString()).toBe('2017-01-02T01:00:00.000Z');
    next = ri.next();
    expect(next.value).toBe(undefined);
    expect(next.done).toBe(true);
  });
  it('should return an empty list if the start is after the sequences complete', () => {
    const seq1 = {
      start_datetime: '2017-01-01T00:00Z',
      end_datetime: '2017-01-01T01:00Z',
    };
    const seq2 = {
      start_datetime: '2017-01-02T00:00Z',
      end_datetime: '2017-01-01T01:00Z',
    };
    const seq3 = {
      start_datetime: '2017-01-02T01:00Z',
      end_datetime: '2017-01-01T01:00Z',
    };
    const ri = recurrenceIterator(
      [seq1, seq3, seq2],
      new Date('2017-01-03T00:00Z'),
    );
    const next = ri.next();
    expect(next.value).toBe(undefined);
    expect(next.done).toBe(true);
  });
  it('should return multiple values for a recurring rule (UTC)', () => {
    const seq = {
      start_datetime: '2017-01-01T08:00',
      end_datetime: '2017-01-01T09:00',
      recurrence_rule: {
        freq: 'weekly',
        byday: ['SU', 'TU'],
        dtstart: '2017-01-01T08:00',
      },
      tzid: 'UTC',
    };
    const ri = recurrenceIterator([seq], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T08:00:00.000Z');
    expect(next.value.sequence).toBe(seq);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-03T08:00:00.000Z');
    expect(next.value.sequence).toBe(seq);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-08T08:00:00.000Z');
    expect(next.value.sequence).toBe(seq);
  });
  it('should return multiple values for a recurring rule (with timezone)', () => {
    const seq = {
      start_datetime: '2017-01-01T08:00',
      end_datetime: '2017-01-01T09:00',
      recurrence_rule: {
        freq: 'weekly',
        byday: ['SU', 'TU'],
        // Use St. Johns since the half-hour offset makes it useful for tests
        dtstart: '2017-01-01T08:00',
      },
      tzid: 'America/St_Johns',
    };
    const ri = recurrenceIterator([seq], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    expect(next.value.start.toString()).toBe(
      new Date(Date.UTC(2017, 0, 1, 11, 30)).toString(),
    );
    expect(next.value.sequence).toBe(seq);
    next = ri.next();
    expect(next.value.start.toString()).toBe(
      new Date(Date.UTC(2017, 0, 3, 11, 30)).toString(),
    );
    expect(next.value.sequence).toBe(seq);
    next = ri.next();
    expect(next.value.start.toString()).toBe(
      new Date(Date.UTC(2017, 0, 8, 11, 30)).toString(),
    );
    expect(next.value.sequence).toBe(seq);
  });
  it('should return multiple values for a recurring rule (with daylight savings)', () => {
    const seq = {
      start_datetime: '2017-01-02T08:00',
      end_datetime: '2017-01-02T09:00',
      recurrence_rule: {
        freq: 'weekly',
        byday: ['MO'],
        dtstart: '2017-01-02T08:00',
      },
      tzid: 'Pacific/Easter',
    };
    const ri = recurrenceIterator([seq], new Date('2017-08-07T00:00Z'));
    let next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-08-07T14:00:00.000Z');
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-08-14T13:00:00.000Z');
  });
  it('should return multiple values for multiple recurring rules', () => {
    const seq1 = {
      start_datetime: '2017-01-01T01:00Z',
      recurrence_rule: { freq: 'weekly', byday: ['SU', 'TU', 'TH'] },
    };
    const seq2 = {
      start_datetime: '2017-01-01T02:00Z',
      recurrence_rule: { freq: 'weekly', byday: ['SA', 'SU'] },
    };
    const ri = recurrenceIterator([seq1, seq2], '2017-01-01T00:00Z');
    let next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T02:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-03T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-05T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-07T02:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
  });
  it('should use updated_at as a tiebreaker', () => {
    const seq1 = {
      start_datetime: '2017-01-01T01:00Z',
      updated_at: '2017-01-01T00:00Z',
      recurrence_rule: { freq: 'weekly', byday: ['SU', 'TU', 'TH'] },
    };
    const seq2 = {
      start_datetime: '2017-01-01T01:00Z',
      updated_at: '2017-01-01T00:01Z',
      recurrence_rule: { freq: 'weekly', byday: ['TH', 'SU'] },
    };
    const seq3 = {
      start_datetime: '2017-01-01T01:00Z',
      updated_at: '2017-01-01T00:02Z',
    };
    const ri = recurrenceIterator([seq1, seq2, seq3], '2017-01-01T00:00Z');
    let next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq3);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-03T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-05T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-05T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
  });
  it('should calculate durations', () => {
    const seq1 = {
      start_datetime: '2017-01-01T01:00Z',
      end_datetime: '2017-01-01T01:30Z',
    };
    const seq2 = {
      start_datetime: '2017-01-01T23:00Z',
      end_datetime: '2017-01-02T00:00Z',
    };
    const seq3 = {
      start_datetime: '2017-01-01T23:00Z',
      end_datetime: '2017-01-02T23:00Z',
      recurrence_rule: { freq: 'weekly', byday: ['TH', 'SU'] },
    };
    let ri = recurrenceIterator([seq1], '2017-01-01T00:00Z');
    let next = ri.next();
    // 30 minutes
    expect(next.value.end - next.value.start).toBe(30 * 60 * 1000);

    ri = recurrenceIterator([seq2], '2017-01-01T00:00Z');
    next = ri.next();
    // 1 hour
    expect(next.value.end - next.value.start).toBe(60 * 60 * 1000);

    ri = recurrenceIterator([seq3], '2017-01-01T00:00Z');
    next = ri.next();
    // 24 hours
    expect(next.value.end - next.value.start).toBe(24 * 60 * 60 * 1000);
  });
  it('should handle sequences with different timezones', () => {
    const seq1 = {
      start_datetime: '2017-01-01T01:00',
      end_datetime: '2017-01-01T02:00',
      updated_at: '2017-01-01T00:00Z',
      tzid: 'America/Los_Angeles',
    };
    const seq2 = {
      start_datetime: '2017-01-01T01:00',
      end_datetime: '2017-01-01T02:00',
      updated_at: '2017-01-01T00:00Z',
      tzid: 'UTC',
    };
    const ri = recurrenceIterator([seq1, seq2], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T09:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
  });
  it("should use the start_datetime as a recurrence even if it does't match the recurrence", () => {
    const seq = {
      start_datetime: '2017-01-01T01:00Z', // Sunday
      end_datetime: '2017-01-01T02:00',
      updated_at: '2017-01-01T00:00Z',
      recurrence_rule: { freq: 'weekly', byday: ['MO'] },
    };
    const ri = recurrenceIterator([seq], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    // Sunday
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    next = ri.next();
    // Monday
    expect(next.value.start.toISOString()).toBe('2017-01-02T01:00:00.000Z');
    next = ri.next();
    // The following Monday
    expect(next.value.start.toISOString()).toBe('2017-01-09T01:00:00.000Z');
  });
  it('should handle long recurrences', () => {
    const seq1 = {
      start_datetime: '2017-01-01T14:00:00',
      end_datetime: '2025-01-01T14:15:00',
      updated_at: '2017-01-01T00:00:00',
      tzid: 'America/New_York',
      recurrence_rule: {
        freq: 'weekly',
        dtstart: '2017-01-01T14:00:00',
        interval: 1,
        byday: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'],
      },
    };
    const seq2 = {
      ...seq1,
      start_datetime: '2017-01-01T00:00:00',
      end_datetime: '2025-01-01T00:15:00',
      updated_at: '2017-01-01T00:00:01',
      tzid: 'America/New_York',
      recurrence_rule: {
        freq: 'weekly',
        dtstart: '2017-01-01T00:00:00',
        interval: 1,
        byday: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'],
      },
    };
    const ri = recurrenceIterator([seq1, seq2], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T05:00:00.000Z');
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-01T19:00:00.000Z');
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-02T05:00:00.000Z');
    next = ri.next();
    expect(next.value.start.toISOString()).toBe('2017-01-02T19:00:00.000Z');
  });
});

describe('realDateToRRuleDate', () => {
  it('should be a no-op for matching timezones', () => {
    const date = new Date();
    const rruleDate = realDateToRRuleDate(date, moment.tz.guess());
    expect(date.toISOString()).toBe(rruleDate.toISOString());
  });
  it('should translate the local time into the timezone Pacific/Pago_Pago', () => {
    const date = new Date();
    const offsetHere = moment.tz.zone(moment.tz.guess()).offset(date.getTime());
    const offsetPPP = moment.tz
      .zone('Pacific/Pago_Pago')
      .offset(date.getTime());
    const rruleDate = realDateToRRuleDate(date, 'Pacific/Pago_Pago');
    expect(date.getTime() + offsetHere * 60 * 1000).toBe(
      rruleDate.getTime() + offsetPPP * 60 * 1000,
    );
  });
  it('should translate the local time into the timezone Pacific/Tongatapu', () => {
    const date = new Date();
    const offsetHere = moment.tz.zone(moment.tz.guess()).offset(date.getTime());
    const offsetPT = moment.tz.zone('Pacific/Tongatapu').offset(date.getTime());
    const rruleDate = realDateToRRuleDate(date, 'Pacific/Tongatapu');
    expect(date.getTime() + offsetHere * 60 * 1000).toBe(
      rruleDate.getTime() + offsetPT * 60 * 1000,
    );
  });
});

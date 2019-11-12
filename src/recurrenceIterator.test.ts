/* eslint-disable no-mixed-operators */
import * as moment from 'moment-timezone/builds/moment-timezone-with-data-2012-2022';
import { RRule } from 'rrule';
import recurrenceIterator, {
  compareStart,
  stringToRRuleDate,
  currentOrNextRRuleStart,
} from './recurrenceIterator';
import { Frequency, WeekDay, Sequence } from './types';
import createSequence from './factories/createSequence';

const toLocalISOString = (str: string) =>
  moment(str.replace('Z', ''))
    .tz(moment.tz.guess())
    .toISOString();

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

describe('currentOrNextRRuleStart', () => {
  const rrule = new RRule({
    freq: RRule.WEEKLY,
    byweekday: [RRule.SU, RRule.TU],
    dtstart: new Date('2017-01-01T08:00Z'),
  });
  it('should return the previous recurrence on overlap', () => {
    const date = new Date('2017-01-03T08:07:06Z');
    const next = currentOrNextRRuleStart({
      start: date,
      rrule,
      duration: 10 * 60 * 1000, // 10 minutes
    });
    expect(next.toISOString()).toBe('2017-01-03T08:00:00.000Z');
  });
  it('should return the next recurrence when there is no overlap', () => {
    const date = new Date('2017-01-03T08:07:06Z');
    const next = currentOrNextRRuleStart({
      start: date,
      rrule,
      duration: 5 * 60 * 1000, // 5 minutes
    });
    expect(next.toISOString()).toBe('2017-01-08T08:00:00.000Z');
  });
  it('should return the current recurrence on equal dates', () => {
    const date = new Date('2017-01-03T08:00:00Z');
    const next = currentOrNextRRuleStart({
      start: date,
      rrule,
      duration: 10 * 60 * 1000,
    });
    expect(next.toISOString()).toBe('2017-01-03T08:00:00.000Z');
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
    const seq1 = createSequence({ start_datetime: '2017-01-01T00:00Z' });
    const ri = recurrenceIterator([seq1]);
    let next = ri.next();
    if (!next.value) return;
    expect(next.value.sequence).toBe(seq1);
    expect(next.value.start.toISOString()).toBe('2017-01-01T00:00:00.000Z');
    expect(next.done).toBe(false);
    next = ri.next();
    expect(next.value).toBe(undefined);
    expect(next.done).toBe(true);
  });
  it('should return a sorted values for multiple non-recurring rules', () => {
    const seq1 = createSequence({ start_datetime: '2017-01-01T00:00Z' });
    const seq2 = createSequence({ start_datetime: '2017-01-02T00:00Z' });
    const seq3 = createSequence({ start_datetime: '2017-01-02T01:00Z' });
    const ri = recurrenceIterator([seq1, seq3, seq2]);
    let next = ri.next();
    if (!next.value) return;
    expect(next.value.sequence).toBe(seq1);
    expect(next.value.start.toISOString()).toBe('2017-01-01T00:00:00.000Z');
    next = ri.next();
    if (!next.value) return;
    expect(next.value.sequence).toBe(seq2);
    expect(next.value.start.toISOString()).toBe('2017-01-02T00:00:00.000Z');
    next = ri.next();
    if (!next.value) return;
    expect(next.value.sequence).toBe(seq3);
    expect(next.value.start.toISOString()).toBe('2017-01-02T01:00:00.000Z');
    next = ri.next();
    expect(next.value).toBe(undefined);
    expect(next.done).toBe(true);
  });
  it('should return an empty list if the start is after the sequences complete', () => {
    const seq1 = createSequence({
      start_datetime: '2017-01-01T00:00Z',
      end_datetime: '2017-01-01T01:00Z',
    });
    const seq2 = createSequence({
      start_datetime: '2017-01-02T00:00Z',
      end_datetime: '2017-01-01T01:00Z',
    });
    const seq3 = createSequence({
      start_datetime: '2017-01-02T01:00Z',
      end_datetime: '2017-01-01T01:00Z',
    });
    const ri = recurrenceIterator(
      [seq1, seq3, seq2],
      new Date('2017-01-03T00:00Z'),
    );
    const next = ri.next();
    expect(next.value).toBe(undefined);
    expect(next.done).toBe(true);
  });
  it('should return multiple values for a recurring rule (UTC)', () => {
    const seq = createSequence({
      start_datetime: '2017-01-01T08:00',
      end_datetime: '2017-01-01T09:00',
      recurrence_rule: {
        freq: Frequency.WEEKLY,
        byday: [WeekDay.SU, WeekDay.TU],
        dtstart: '2017-01-01T08:00',
      },
      tzid: 'UTC',
    });

    const ri = recurrenceIterator([seq], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe(
      toLocalISOString('2017-01-01T08:00:00.000Z'),
    );
    expect(next.value.sequence).toBe(seq);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe(
      toLocalISOString('2017-01-03T08:00:00.000Z'),
    );
    expect(next.value.sequence).toBe(seq);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe(
      toLocalISOString('2017-01-08T08:00:00.000Z'),
    );
    expect(next.value.sequence).toBe(seq);
  });
  // it('should return multiple values for a recurring rule (with timezone)', () => {
  //   const seq = createSequence({
  //     start_datetime: '2017-01-01T08:00',
  //     end_datetime: '2017-01-01T09:00',
  //     recurrence_rule: {
  //       freq: Frequency.WEEKLY,
  //       byday: [WeekDay.SU, WeekDay.TU],
  //       // Use St. Johns since the half-hour offset makes it useful for tests
  //       dtstart: '2017-01-01T08:00',
  //     },
  //     tzid: 'America/St_Johns',
  //   });
  //   const ri = recurrenceIterator([seq], new Date('2017-01-02T00:00Z'));
  //   let next = ri.next();
  //   if (!next.value) return;
  //   expect(next.value.start.toISOString()).toBe(
  //     new Date(Date.UTC(2017, 0, 1, 11, 30)).toISOString(),
  //   );
  //   expect(next.value.sequence).toBe(seq);
  //   next = ri.next();
  //   if (!next.value) return;
  //   expect(next.value.start.toString()).toBe(
  //     new Date(Date.UTC(2017, 0, 3, 11, 30)).toString(),
  //   );
  //   expect(next.value.sequence).toBe(seq);
  //   next = ri.next();
  //   if (!next.value) return;
  //   expect(next.value.start.toString()).toBe(
  //     new Date(Date.UTC(2017, 0, 8, 11, 30)).toString(),
  //   );
  //   if (!next.value) return;
  //   expect(next.value.sequence).toBe(seq);
  // });
  // it('should return multiple values for a recurring rule (with daylight savings)', () => {
  //   const seq = createSequence({
  //     start_datetime: '2017-01-02T08:00',
  //     end_datetime: '2017-01-02T09:00',
  //     recurrence_rule: {
  //       freq: Frequency.WEEKLY,
  //       byday: [WeekDay.MO],
  //       dtstart: '2017-01-02T08:00',
  //     },
  //     tzid: 'Pacific/Easter',
  //   });
  //   const ri = recurrenceIterator([seq], new Date('2017-08-07T00:00Z'));
  //   let next = ri.next();
  //   if (!next.value) return;
  //   expect(next.value.start.toISOString()).toBe('2017-08-07T14:00:00.000Z');
  //   next = ri.next();
  //   if (!next.value) return;
  //   expect(next.value.start.toISOString()).toBe('2017-08-14T13:00:00.000Z');
  // });
  it('should return multiple values for multiple recurring rules', () => {
    const seq1 = createSequence({
      start_datetime: '2017-01-01T01:00Z',
      recurrence_rule: {
        freq: Frequency.WEEKLY,
        byday: [WeekDay.SU, WeekDay.TU, WeekDay.TH],
        dtstart: '2017-01-01T01:00Z',
      },
    });
    const seq2 = createSequence({
      start_datetime: '2017-01-01T02:00Z',
      recurrence_rule: {
        freq: Frequency.WEEKLY,
        byday: [WeekDay.SA, WeekDay.SU],
        dtstart: '2017-01-01T02:00Z',
      },
    });
    const ri = recurrenceIterator([seq1, seq2], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-01T02:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-03T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-05T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-07T02:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
  });
  it('should use updated_at as a tiebreaker', () => {
    const seq1 = createSequence({
      start_datetime: '2017-01-01T01:00Z',
      updated_at: '2017-01-01T00:00Z',
      recurrence_rule: {
        freq: Frequency.WEEKLY,
        byday: [WeekDay.SU, WeekDay.TU, WeekDay.TH],
      },
    });
    const seq2 = createSequence({
      start_datetime: '2017-01-01T01:00Z',
      updated_at: '2017-01-01T00:01Z',
      recurrence_rule: {
        freq: Frequency.WEEKLY,
        byday: [WeekDay.TH, WeekDay.SU],
      },
    });
    const seq3 = createSequence({
      start_datetime: '2017-01-01T01:00Z',
      updated_at: '2017-01-01T00:02Z',
    });
    const ri = recurrenceIterator(
      [seq1, seq2, seq3],
      new Date('2017-01-01T00:00Z'),
    );
    let next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq3);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-03T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-05T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-05T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
  });
  it('should calculate durations', () => {
    const seq1 = createSequence({
      start_datetime: '2017-01-01T01:00Z',
      end_datetime: '2017-01-01T01:30Z',
    });
    const seq2 = createSequence({
      start_datetime: '2017-01-01T23:00Z',
      end_datetime: '2017-01-02T00:00Z',
    });
    const seq3 = createSequence({
      start_datetime: '2017-01-01T23:00Z',
      end_datetime: '2017-01-02T23:00Z',
      recurrence_rule: {
        freq: Frequency.WEEKLY,
        byday: [WeekDay.TH, WeekDay.SU],
      },
    });
    let ri = recurrenceIterator([seq1], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    if (!next.value) return;
    // 30 minutes
    expect(+next.value.end - +next.value.start).toBe(30 * 60 * 1000);

    ri = recurrenceIterator([seq2], new Date('2017-01-01T00:00Z'));
    next = ri.next();
    if (!next.value) return;
    // 1 hour
    expect(+next.value.end - +next.value.start).toBe(60 * 60 * 1000);

    ri = recurrenceIterator([seq3], new Date('2017-01-01T00:00Z'));
    next = ri.next();
    if (!next.value) return;
    // 24 hours
    expect(+next.value.end - +next.value.start).toBe(24 * 60 * 60 * 1000);
  });
  it('should handle sequences with different timezones', () => {
    const seq1 = createSequence({
      start_datetime: '2017-01-01T01:00',
      end_datetime: '2017-01-01T02:00',
      updated_at: '2017-01-01T00:00Z',
      tzid: 'America/Los_Angeles',
    });
    const seq2 = createSequence({
      start_datetime: '2017-01-01T01:00',
      end_datetime: '2017-01-01T02:00',
      updated_at: '2017-01-01T00:00Z',
      tzid: 'UTC',
    });
    const ri = recurrenceIterator([seq1, seq2], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    expect(next.value.sequence).toBe(seq2);
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-01T09:00:00.000Z');
    expect(next.value.sequence).toBe(seq1);
  });
  it("should use the start_datetime as a recurrence even if it doesn't match the recurrence", () => {
    const seq = createSequence({
      start_datetime: '2017-01-01T01:00Z', // Sunday
      end_datetime: '2017-01-01T02:00',
      updated_at: '2017-01-01T00:00Z',
      recurrence_rule: { freq: Frequency.WEEKLY, byday: [WeekDay.MO] },
    });
    const ri = recurrenceIterator([seq], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    if (!next.value) return;
    // Sunday
    expect(next.value.start.toISOString()).toBe('2017-01-01T01:00:00.000Z');
    next = ri.next();
    if (!next.value) return;
    // Monday
    expect(next.value.start.toISOString()).toBe('2017-01-02T01:00:00.000Z');
    next = ri.next();
    if (!next.value) return;
    // The following Monday
    expect(next.value.start.toISOString()).toBe('2017-01-09T01:00:00.000Z');
  });
  it('should handle long recurrences', () => {
    const seq1 = createSequence({
      start_datetime: '2017-01-01T14:00:00',
      end_datetime: '2025-01-01T14:15:00',
      updated_at: '2017-01-01T00:00:00',
      tzid: 'America/New_York',
      recurrence_rule: {
        freq: Frequency.WEEKLY,
        dtstart: '2017-01-01T14:00:00',
        interval: 1,
        byday: [
          WeekDay.SU,
          WeekDay.MO,
          WeekDay.TU,
          WeekDay.WE,
          WeekDay.TH,
          WeekDay.FR,
          WeekDay.SA,
        ],
      },
    });
    const seq2 = createSequence({
      ...seq1,
      start_datetime: '2017-01-01T00:00:00',
      end_datetime: '2025-01-01T00:15:00',
      updated_at: '2017-01-01T00:00:01',
      tzid: 'America/New_York',
      recurrence_rule: {
        freq: Frequency.WEEKLY,
        dtstart: '2017-01-01T00:00:00',
        interval: 1,
        byday: [
          WeekDay.SU,
          WeekDay.MO,
          WeekDay.TU,
          WeekDay.WE,
          WeekDay.TH,
          WeekDay.FR,
          WeekDay.SA,
        ],
      },
    });
    const ri = recurrenceIterator([seq1, seq2], new Date('2017-01-01T00:00Z'));
    let next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-01T05:00:00.000Z');
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-01T19:00:00.000Z');
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-02T05:00:00.000Z');
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2017-01-02T19:00:00.000Z');
  });
  it('should return past recurrences if they are still "open"', () => {
    const seq1 = createSequence({
      start_datetime: '2017-01-01T00:00:00',
      end_datetime: '2017-01-07T00:00:00',
      updated_at: '2017-01-01T00:00:00',
      tzid: 'UTC',
      recurrence_rule: {
        freq: Frequency.MONTHLY,
        dtstart: '2017-01-01T00:00:00',
        interval: 1,
        bymonthday: [1],
      },
    });
    const seq2 = createSequence({
      start_datetime: '2017-01-07T00:00:00',
      end_datetime: '2017-01-14T00:00:00',
      updated_at: '2017-01-01T00:00:01',
      tzid: 'UTC',
      recurrence_rule: {
        freq: Frequency.MONTHLY,
        dtstart: '2017-01-07T00:00:00',
        interval: 1,
        bymonthday: [7],
      },
    });
    let ri = recurrenceIterator([seq1, seq2], new Date('2017-01-02T00:00Z'));
    let next = ri.next();
    if (!next.value) return;
    // Expect the Jan. 1 recurrence to get returned, even though it's Jan. 2
    expect(next.value.start.toISOString()).toBe(
      toLocalISOString('2017-01-01T00:00:00.000Z'),
    );
    next = ri.next();
    if (!next.value) return;
    // Let's just make sure the rest of the sequence matches expectations
    expect(next.value.start.toISOString()).toBe(
      toLocalISOString('2017-01-07T00:00:00.000Z'),
    );
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe(
      toLocalISOString('2017-02-01T00:00:00.000Z'),
    );
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe(
      toLocalISOString('2017-02-07T00:00:00.000Z'),
    );

    // Make sure the recurrence start date is respected; even though the
    // recurrence makes sense in 2016, it shouldn't start until 2017.
    ri = recurrenceIterator([seq1, seq2], new Date('2016-01-02T00:00Z'));
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe(
      toLocalISOString('2017-01-01T00:00:00.000Z'),
    );

    // Make sure if we ask for the next recurrence when now === the previous
    // recurrence's end time, we return the next recurrence.
    ri = recurrenceIterator([seq1, seq2], new Date('2017-01-07T00:00Z'));
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe(
      toLocalISOString('2017-01-07T00:00:00.000Z'),
    );
  });
});

// describe('realDateToRRuleDate', () => {
//   it('should be a no-op for matching timezones', () => {
//     const date = new Date();
//     const rruleDate = realDateToRRuleDate(date);
//     expect(date.toISOString()).toBe(rruleDate.toISOString());
//   });
//   it('should translate the local time into the timezone Pacific/Pago_Pago', () => {
//     const date = new Date();
//     const offsetHere = moment.tz
//       .zone(moment.tz.guess())
//       .utcOffset(date.getTime());
//     const offsetPPP = moment.tz
//       .zone('Pacific/Pago_Pago')
//       .utcOffset(date.getTime());
//     const rruleDate = realDateToRRuleDate(date);
//     expect(date.getTime() + offsetHere * 60 * 1000).toBe(
//       rruleDate.getTime() + offsetPPP * 60 * 1000,
//     );
//   });
//   it('should translate the local time into the timezone Pacific/Tongatapu', () => {
//     const date = new Date();
//     const offsetHere = moment.tz
//       .zone(moment.tz.guess())
//       .utcOffset(date.getTime());
//     const offsetPT = moment.tz
//       .zone('Pacific/Tongatapu')
//       .utcOffset(date.getTime());
//     const rruleDate = realDateToRRuleDate(date);
//     expect(date.getTime() + offsetHere * 60 * 1000).toBe(
//       rruleDate.getTime() + offsetPT * 60 * 1000,
//     );
//   });
// });

// Test to confirm 1-day behind bug with rrule-alt (now using rrule)
describe('Daylight Savings -> Standard Time switchover (Nov 3rd, 2019)', () => {
  it('should generate recurrence on correct days', () => {
    // const rule = new RRule({
    //   dtstart: new Date('2019-11-03T09:00:00.000Z'),
    //   interval: 1,
    //   freq: RRule.WEEKLY,
    //   byweekday: [RRule.FR],
    // });

    // console.log(
    //   rule
    //     .all((_, i) => i < 10)
    //     .map(r => r.toString())
    //     .join('\n'),
    // );

    const seq = createSequence({
      start_datetime: '2019-11-02 09:00:00',
      end_datetime: '2019-11-02 16:00:00',
      tzid: 'America/New_York',
      recurrence_rule: {
        freq: Frequency.WEEKLY,
        byday: [WeekDay.TH],
        dtstart: '2019-11-04T09:00:00.000Z',
      },
    });
    const ri = recurrenceIterator([seq], new Date('2019-11-03T09:00:00.000Z'));
    let next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2019-11-07T09:00:00.000Z');
    next = ri.next();
    if (!next.value) return;
    expect(next.value.start.toISOString()).toBe('2019-11-14T09:00:00.000Z');
  });
});

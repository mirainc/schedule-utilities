// Takes in a collection of sequences.
// Returns a series of sequences in the order in which they'll run.
import { RRule } from 'rrule-alt';
import * as moment from 'moment-timezone/builds/moment-timezone-with-data-2012-2022';
import Sequence from './types/Sequence';

const dayOfWeekMap = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

const frequencyMap = {
  yearly: RRule.YEARLY,
  monthly: RRule.MONTHLY,
  weekly: RRule.WEEKLY,
  daily: RRule.DAILY,
  hourly: RRule.HOURLY,
  minutely: RRule.MINUTELY,
  secondly: RRule.SECONDLY,
};

const isNullOrEmptyObject = (o: void | object) => !o || !Object.keys(o).length;

export const compareDates = (a: Date, b: Date) => {
  if (a && b) {
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  }
  if (a) {
    return -1;
  }
  return b ? 1 : 0;
};

// Compare start/end timestamps.
// Falsy timestamps should appear at the end, so are treated as
// greater than "real" timestamps.
export const compareDateField = (field: 'start' | 'end') => (
  as: { start?: Date; end?: Date; updatedAt?: Date } & object,
  bs: { start?: Date; end?: Date; updatedAt?: Date } & object,
) => {
  const result = compareDates(as[field], bs[field]);
  if (result === 0) {
    // updatedAt is the tiebreaker
    // In this case, later (larger) should appear first so swap the args
    return compareDates(bs.updatedAt, as.updatedAt);
  }
  return result;
};

export const compareStart = compareDateField('start');
export const compareEnd = compareDateField('end');

// When dealing with RRules, create dates independent of their timezone.
// We need to deal with recurrences like they're in their original timezones
// and translate them back to the browser timezone when done.
// We remove trailing Zs here as the API will sometimes return datetimes
// with the UTC marker (Z) even though these datetimes are timezoned.
export const stringToRRuleDate = (dt: string) =>
  moment(dt.replace(/Z/, '')).toDate();

// Start dates are passed in as local time, and we need to move them into
// the RRule no-timezone bubble universe. We take the local time, translate
// into the sequence's timezone, export as string, and create a new local
// date object based on that.
// This is probably a bit hard to wrap your head around, but basically we're
// looking for 8am PST to get translated into 11am EST, but we then sleaze
// that into 11am PST to make the rrule logic work.
export const realDateToRRuleDate = (date: Date, rruleTZ: string) =>
  moment(
    moment(date)
      .tz(rruleTZ)
      .format('YYYYMMDDTHHmmss.SSS'),
  ).toDate();

// Translate an RRuleDate from its weird timezone-free bubble universe
// into a real date.
export const rRuleDateToRealDate = (date: Date, tzid: string) => {
  if (!date) {
    return null;
  }
  const dt = moment(date).format('YYYYMMDDTHHmmss.SSS');
  return moment.tz(dt, tzid).toDate();
};

const getNonrecurrenceIterator = (sequence: Sequence, startDate: Date) => {
  const tzid = sequence.tzid || 'UTC';

  // If we're already past this sequence, bail.
  if (moment.tz(sequence.end_datetime, tzid).toDate() <= startDate) {
    return null;
  }
  // Generate an iterator
  const rruleStart = stringToRRuleDate(sequence.start_datetime);
  const start = rRuleDateToRealDate(rruleStart, tzid);
  return {
    rruleStart,
    start,
    duration: sequence.end_datetime
      ? +stringToRRuleDate(sequence.end_datetime) - +rruleStart
      : 0,
    updatedAt: new Date(sequence.updated_at),
    tzid,
    sequence,
    next: () => null as null,
  };
};

// Figure out the first recurrence we care about.
// We care about a recurrence if we are currently in the time window
// OR it's starting >= now.
export const currentOrNextRRuleStart = ({
  rrule,
  start,
  duration,
}: {
  rrule: RRule;
  start: Date;
  duration: number;
}) => {
  const rrulePrev = rrule.before(start, true);
  if (!rrulePrev || rrulePrev.getTime() + duration <= start.getTime()) {
    return rrule.after(start);
  }
  return rrulePrev;
};

export default function* getRecurrenceIterator(
  sequences: Sequence[],
  startDate?: Date,
) {
  if (!sequences || !sequences.length) {
    return;
  }
  // Initialize
  const rules = sequences
    .map(sequence => {
      const tzid = sequence.tzid || 'UTC';
      const nri = getNonrecurrenceIterator(sequence, startDate);

      if (isNullOrEmptyObject(sequence.recurrence_rule)) {
        // It's a non-recurrence, so we only need to worry about the base case.
        return nri;
      }
      // Massage the recurrence rule into a format that RRule digs
      // NOTES:
      // we need to strip out tzid, or RRule complains (tzid is not an expected field)
      // We need to transform `byday` to the nonstandard `byweekday`.
      const {
        tzid: _tzid,
        freq,
        byday,
        ...recurrenceRule
      } = sequence.recurrence_rule;
      const byweekday = byday ? byday.map(d => dayOfWeekMap[d]) : null;
      const dtstartStr = recurrenceRule.dtstart || sequence.start_datetime;
      const dtstart = stringToRRuleDate(dtstartStr);
      const rruleDefn = {
        ...recurrenceRule,
        freq: frequencyMap[freq],
        byweekday,
        dtstart,
      };
      // Create the RRule
      let rrule: RRule;
      try {
        rrule = new RRule(rruleDefn);
      } catch (e) {
        // Bad recurrence rule.
        console.error('Could not parse recurrence rule', rruleDefn, e); // eslint-disable-line no-console
        // Remove it from our list
        return null;
      }
      const duration = sequence.end_datetime
        ? +stringToRRuleDate(sequence.end_datetime) -
          +stringToRRuleDate(sequence.start_datetime)
        : 0;
      // If the initial start/end pair is valid, use that.
      // Otherwise, calculate the current/next recurrence.
      const rruleStart = nri
        ? nri.rruleStart
        : currentOrNextRRuleStart({
            start: realDateToRRuleDate(startDate, tzid),
            duration,
            rrule,
          });
      const start = nri ? nri.start : rRuleDateToRealDate(rruleStart, tzid);
      return {
        rruleStart,
        start,
        duration,
        updatedAt: new Date(sequence.updated_at),
        tzid,
        sequence,
        next() {
          return rrule.after(this.rruleStart);
        },
      };
    })
    .filter(r => !!r);
  if (!rules.length) {
    return;
  }
  rules.sort(compareStart);
  while (rules[0].start) {
    const { sequence, start, tzid, duration } = rules[0];
    rules[0].rruleStart = rules[0].next();
    rules[0].start = rRuleDateToRealDate(rules[0].rruleStart, tzid);
    rules.sort(compareStart);
    yield {
      sequence,
      start,
      end: new Date(start.getTime() + duration),
      updatedAt: new Date(sequence.updated_at),
      id: sequence.id,
    };
  }
}

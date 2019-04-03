import * as moment from 'moment-timezone/builds/moment-timezone-with-data-2012-2022';
import { Frequency, RecurrenceRule, WeekDay } from '../types';

const createRecurrenceRule = (
  overrides: Partial<RecurrenceRule> = {},
): RecurrenceRule => ({
  dtstart: moment()
    .startOf('day')
    .add(9, 'hours')
    .toISOString(),
  freq: Frequency.WEEKLY,
  interval: 1,
  tzid: moment().zoneName(),
  ...overrides,
});

export default createRecurrenceRule;

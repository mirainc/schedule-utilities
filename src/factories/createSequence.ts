import * as moment from 'moment-timezone/builds/moment-timezone-with-data-2012-2022';
import { Sequence } from '../types';
import createRecurrenceRule from './createRecurrenceRule';

let id = 1;

const createSequence = (
  overrides: { [P in keyof Sequence]?: Partial<Sequence[P]> } = {},
): Sequence => {
  const {
    start_datetime = moment()
      .startOf('day')
      .add(9, 'hours')
      .toISOString(),
  } = overrides;
  return {
    created_at: new Date().toISOString(),
    description: 'sequence description',
    device_group_id: 'device_group_id',
    device_id: 'device_id',
    start_datetime,
    end_datetime: moment()
      .startOf('day')
      .add(17, 'hours')
      .toISOString(),
    id: `sequence_${id++}`,
    name: 'sequence name',
    presentations: [],
    tzid: moment().zoneName(),
    updated_at: new Date().toISOString(),
    user_id: 'user_id',
    ...overrides,
    recurrence_rule: overrides.recurrence_rule
      ? createRecurrenceRule({
          ...overrides.recurrence_rule,
          dtstart: overrides.recurrence_rule.dtstart || start_datetime,
        })
      : null,
  };
};

export default createSequence;

import * as moment from 'moment-timezone/builds/moment-timezone-with-data-2012-2022';
import { Occurrence } from '../types';
import createSequence from './createSequence';

let id = 1;

const createOccurrence = (overrides: Partial<Occurrence> = {}): Occurrence => ({
  start: moment()
    .startOf('day')
    .add(9, 'hours')
    .toDate(),
  end: moment()
    .startOf('day')
    .add(17, 'hours')
    .toDate(),
  updatedAt: new Date(),
  id: `occurrence_${id++}`,
  sequence: createSequence(),
  ...overrides,
});

export default createOccurrence;

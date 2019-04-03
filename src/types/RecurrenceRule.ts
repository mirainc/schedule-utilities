import Frequency from './Frequency';
import WeekDay from './WeekDay';

interface RecurrenceRule {
  byday?: WeekDay[];
  byhour?: number;
  byminute?: number;
  bymonthday?: number[];
  dtstart: string;
  freq: Frequency;
  interval: number;
  tzid: string;
}

export default RecurrenceRule;

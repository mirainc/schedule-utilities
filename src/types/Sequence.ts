import Frequency from './Frequency';
import WeekDay from './WeekDay';

interface RecurrenceRule {
  byday?: WeekDay[];
  byhour?: number;
  byminute?: number;
  dtstart: string;
  freq: Frequency;
  interval: number;
  tzid: string;
}

export interface Sequence {
  created_at: string;
  description: string;
  device_group_id: string | null;
  device_id: string | null;
  end_datetime: string;
  id: string;
  name: string;
  presentations: string[];
  recurrence_rule: RecurrenceRule | null;
  start_datetime: string;
  tzid: string;
  updated_at: string;
  user_id: string;
}

export default Sequence;

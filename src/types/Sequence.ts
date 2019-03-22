import Frequency from './Frequency';
import WeekDay from './WeekDay';

type Sequence = Partial<{
  created_at: string;
  description: string;
  device_group_id: null | string;
  device_id: null | string;
  id: string;
  name: string;
  presentations: string[];
  tzid: string;
  end_datetime: string;
  start_datetime: string;
  updated_at: string;
  recurrence_rule: null | Partial<{
    tzid: string;
    freq: Frequency;
    byday: WeekDay[];
    dtstart: string;
    interval: number;
  }>;
}>;

export default Sequence;

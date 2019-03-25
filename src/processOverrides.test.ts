import processOverrides from './processOverrides';
import recurrenceIterator from './recurrenceIterator';
import { Frequency, Sequence, WeekDay } from './types';

describe('processOverrides', () => {
  it('returns an empty list for an empty list', () => {
    expect(processOverrides([])).toEqual([]);
  });

  it('returns the same data if there are no conflicts', () => {
    const noConflicts = [
      {
        start: new Date('2017-01-01T01:00'),
        end: new Date('2017-01-01T01:30'),
        updatedAt: new Date('2017-01-01T00:30'),
        id: '1',
      },
      {
        start: new Date('2017-01-01T01:30'),
        end: new Date('2017-01-01T02:00'),
        updatedAt: new Date('2017-01-01T00:30'),
        id: '2',
      },
      {
        start: new Date('2017-01-02T01:00'),
        end: new Date('2017-01-02T02:00'),
        updatedAt: new Date('2017-01-02T00:30'),
        id: '3',
      },
    ];
    expect(processOverrides(noConflicts)).toEqual(noConflicts);
  });

  it('uses updatedAt to figure out the "winner" in a direct conflict', () => {
    const winner = {
      start: new Date('2017-01-01T01:00'),
      end: new Date('2017-01-01T01:30'),
      updatedAt: new Date('2017-01-01T00:01'),
      id: 'winner',
    };
    const loser = {
      start: new Date('2017-01-01T01:00'),
      end: new Date('2017-01-01T01:30'),
      updatedAt: new Date('2017-01-01T00:00'),
      id: 'loser',
    };
    const startConflict1 = [loser, winner];
    const startConflict2 = [winner, loser];

    [startConflict1, startConflict2].forEach(startConflict => {
      const retval = processOverrides(startConflict);
      // Conflict is removed
      expect(retval.length).toBe(1);
      // Winner wins
      expect(retval[0].id).toEqual('winner');
      // Loser is moved into the overrides array
      expect(retval[0].overrides.length).toBe(1);
      expect(retval[0].overrides[0].id).toBe('loser');
    });
  });

  it('splits iff necessary when we have a start conflict', () => {
    const start = new Date('2017-01-01T01:00');
    const end1 = new Date('2017-01-01T01:15');
    const end2 = new Date('2017-01-01T01:30');

    // This will cause a split, as the short occurrence takes priority
    const startSplit = [
      {
        start,
        end: end2,
        updatedAt: new Date('2017-01-01T00:00'),
        id: 'long',
      },
      {
        start,
        end: end1,
        updatedAt: new Date('2017-01-01T00:01'),
        id: 'short',
      },
    ];
    // This won't cause a split, as the long occurrence takes priority
    const startNoSplit = [
      {
        start,
        end: end2,
        updatedAt: new Date('2017-01-01T00:01'),
        id: 'long',
      },
      {
        start,
        end: end1,
        updatedAt: new Date('2017-01-01T00:00'),
        id: 'short',
      },
    ];

    const split = processOverrides(startSplit);
    expect(split.length).toEqual(2);
    expect(split[0].id).toBe('short');
    expect(split[0].start).toEqual(start);
    expect(split[0].end).toEqual(end1);
    // The overridden chunk of "long" should start at the same time
    // but end at the earlier time
    expect(split[0].overrides[0].id).toBe('long');
    expect(split[0].overrides[0].start).toEqual(start);
    expect(split[0].overrides[0].end).toEqual(end1);
    // The non-overridden chunk of "long" should start when the
    // override ends, and end at its original end time.
    expect(split[1].id).toBe('long');
    expect(split[1].start).toEqual(end1);
    expect(split[1].end).toEqual(end2);

    // If we don't need to split "long", we want it to be in a single
    // chunk with "short" in its override list.
    const noSplit = processOverrides(startNoSplit);
    expect(noSplit.length).toBe(1);
    expect(noSplit[0].id).toBe('long');
    expect(noSplit[0].start).toEqual(start);
    expect(noSplit[0].end).toEqual(end2);
    expect(noSplit[0].overrides[0].id).toEqual('short');
    expect(noSplit[0].overrides[0].start).toEqual(start);
    expect(noSplit[0].overrides[0].end).toEqual(end1);
  });

  it('splits iff necessary when we have an end conflict', () => {
    const start1 = new Date('2017-01-01T01:00');
    const start2 = new Date('2017-01-01T01:15');
    const end = new Date('2017-01-01T01:30');

    // This will cause a split, as the short occurrence takes priority
    const endSplit = [
      {
        start: start1,
        end,
        updatedAt: new Date('2017-01-01T00:00'),
        id: 'long',
      },
      {
        start: start2,
        end,
        updatedAt: new Date('2017-01-01T00:01'),
        id: 'short',
      },
    ];
    // This won't cause a split, as the long occurrence takes priority
    const endNoSplit = [
      {
        start: start1,
        end,
        updatedAt: new Date('2017-01-01T00:01'),
        id: 'long',
      },
      {
        start: start2,
        end,
        updatedAt: new Date('2017-01-01T00:00'),
        id: 'short',
      },
    ];

    const split = processOverrides(endSplit);
    expect(split.length).toEqual(2);
    // The non-overridden chunk of "long" should end when the
    // override starts, and start at its original start time.
    expect(split[0].id).toBe('long');
    expect(split[0].start).toEqual(start1);
    expect(split[0].end).toEqual(start2);
    // Now, in comes the short occurrence
    expect(split[1].id).toBe('short');
    expect(split[1].start).toEqual(start2);
    expect(split[1].end).toEqual(end);
    // The overridden chunk of "long" should start and end at the same time
    // as the short one
    expect(split[1].overrides[0].id).toBe('long');
    expect(split[1].overrides[0].start).toEqual(start2);
    expect(split[1].overrides[0].end).toEqual(end);

    // If we don't need to split "long", we want it to be in a single
    // chunk with "short" in its override list.
    const noSplit = processOverrides(endNoSplit);
    expect(noSplit.length).toBe(1);
    expect(noSplit[0].id).toBe('long');
    expect(noSplit[0].start).toEqual(start1);
    expect(noSplit[0].end).toEqual(end);
    expect(noSplit[0].overrides[0].id).toEqual('short');
    expect(noSplit[0].overrides[0].start).toEqual(start2);
    expect(noSplit[0].overrides[0].end).toEqual(end);
  });

  it('splits in 3 for conflicts in the middle', () => {
    const start1 = new Date('2017-01-01T01:00');
    const start2 = new Date('2017-01-01T01:15');
    const end2 = new Date('2017-01-01T01:30');
    const end1 = new Date('2017-01-01T01:45');

    // This will cause a split, as the short occurrence takes priority
    const middleSplit = [
      {
        start: start1,
        end: end1,
        updatedAt: new Date('2017-01-01T00:00'),
        id: 'long',
      },
      {
        start: start2,
        end: end2,
        updatedAt: new Date('2017-01-01T00:01'),
        id: 'short',
      },
    ];
    // This won't cause a split, as the long occurrence takes priority
    const middleNoSplit = [
      {
        start: start1,
        end: end1,
        updatedAt: new Date('2017-01-01T00:01'),
        id: 'long',
      },
      {
        start: start2,
        end: end2,
        updatedAt: new Date('2017-01-01T00:00'),
        id: 'short',
      },
    ];

    const split = processOverrides(middleSplit);
    expect(split.length).toEqual(3);
    // The non-overridden chunk of "long" should end when the
    // override starts, and start at its original start time.
    expect(split[0].id).toBe('long');
    expect(split[0].start).toEqual(start1);
    expect(split[0].end).toEqual(start2);
    // Now, in comes the short occurrence
    expect(split[1].id).toBe('short');
    expect(split[1].start).toEqual(start2);
    expect(split[1].end).toEqual(end2);
    // The overridden chunk of "long" should start and end at the same time
    // as the short one
    expect(split[1].overrides[0].id).toBe('long');
    expect(split[1].overrides[0].start).toEqual(start2);
    expect(split[1].overrides[0].end).toEqual(end2);
    // Finally, the last chunk of long
    expect(split[2].id).toBe('long');
    expect(split[2].start).toEqual(end2);
    expect(split[2].end).toEqual(end1);

    // If we don't need to split "long", we want it to be in a single
    // chunk with "short" in its override list.
    const noSplit = processOverrides(middleNoSplit);
    expect(noSplit.length).toBe(1);
    expect(noSplit[0].id).toBe('long');
    expect(noSplit[0].start).toEqual(start1);
    expect(noSplit[0].end).toEqual(end1);
    expect(noSplit[0].overrides[0].id).toEqual('short');
    expect(noSplit[0].overrides[0].start).toEqual(start2);
    expect(noSplit[0].overrides[0].end).toEqual(end2);
  });

  it('splits correctly for multiple overlapping conflicts', () => {
    // Start with a low priority
    // Medium and high priority start
    // High priority ends
    // Low priority ends
    // Expect 3 chunks (low -> high -> medium)
    const start1 = new Date('2017-01-01T01:00');
    const start2 = new Date('2017-01-01T01:15');
    const start3 = new Date('2017-01-01T01:15');
    const end1 = new Date('2017-01-01T01:30');
    const end2 = new Date('2017-01-01T01:45');
    const end3 = new Date('2017-01-01T01:20');

    const split = processOverrides([
      {
        start: start1,
        end: end1,
        updatedAt: new Date('2017-01-01T00:00'),
        id: 'low',
      },
      {
        start: start2,
        end: end2,
        updatedAt: new Date('2017-01-01T00:01'),
        id: 'medium',
      },
      {
        start: start3,
        end: end3,
        updatedAt: new Date('2017-01-01T00:02'),
        id: 'high',
      },
    ]);

    expect(split.length).toEqual(3);
    // The non-overridden chunk of "low" should end when the
    // override starts.
    expect(split[0].id).toBe('low');
    expect(split[0].start).toEqual(start1);
    expect(split[0].end).toEqual(start2);
    // Now, "high" is in effect
    expect(split[1].id).toBe('high');
    expect(split[1].start).toEqual(start3);
    expect(split[1].end).toEqual(end3);
    // High overrides "low" and "medium"
    expect(split[1].overrides.length).toBe(2);
    split[1].overrides.forEach(o => {
      expect(o.id).toEqual(expect.stringMatching(/low|medium/));
      expect(o.start).toEqual(start3);
      expect(o.end).toEqual(end3);
    });
    // Finally, the last chunk of "medium"
    expect(split[2].id).toBe('medium');
    expect(split[2].start).toEqual(end3);
    expect(split[2].end).toEqual(end2);
    expect(split[2].overrides.length).toBe(1);
    expect(split[2].overrides[0].id).toBe('low');
    expect(split[2].overrides[0].start).toEqual(end3);
    expect(split[2].overrides[0].end).toEqual(end1);
  });

  it('handles super-long recurrences that conflict with themselves and others', () => {
    const sequences: Sequence[] = [
      {
        created_at: '2017-11-15T19:52:10.051756Z',
        description: '',
        device_group_id: 'f08903d5-e986-4032-8dbc-faac5726a9f9',
        device_id: null,
        end_datetime: '2035-03-01T12:15:00',
        id: '2bdb2378-bf4e-42e9-8a12-caac83f56714',
        name: 'Wut',
        presentations: ['caa9a84d-f05c-4500-ae75-759b8092cebd'],
        recurrence_rule: {
          byday: [
            WeekDay.SU,
            WeekDay.MO,
            WeekDay.TU,
            WeekDay.WE,
            WeekDay.TH,
            WeekDay.FR,
            WeekDay.SA,
          ],
          dtstart: '2017-11-15T12:00:00',
          freq: Frequency.WEEKLY,
          interval: 1,
          tzid: 'America/Los_Angeles',
        },
        start_datetime: '2017-11-15T12:00:00',
        tzid: 'America/Los_Angeles',
        updated_at: '2017-11-15T19:52:10.051756Z',
      },
      {
        created_at: '2017-11-15T19:52:55.909715Z',
        description: '',
        device_group_id: 'f08903d5-e986-4032-8dbc-faac5726a9f9',
        device_id: null,
        end_datetime: '2029-11-08T12:15:00',
        id: '4a43f1e0-80db-4cf0-9eac-70f70cef89d8',
        name: 'Wut2',
        presentations: ['ba333db1-055d-44f4-a36e-761535b89c2a'],
        recurrence_rule: {
          byday: [
            WeekDay.SU,
            WeekDay.MO,
            WeekDay.TU,
            WeekDay.WE,
            WeekDay.TH,
            WeekDay.FR,
            WeekDay.SA,
          ],
          dtstart: '2017-11-15T23:55:00',
          freq: Frequency.WEEKLY,
          interval: 1,
          tzid: 'America/Los_Angeles',
        },
        start_datetime: '2017-11-15T23:55:00',
        tzid: 'America/Los_Angeles',
        updated_at: '2017-11-15T19:52:55.909715Z',
      },
    ];
    const ri = recurrenceIterator(sequences, new Date('2017-01-01T00:00Z'));
    const occurrences = [];
    const NUM_OCCURRENCES = 50;
    for (let i = 0; i < NUM_OCCURRENCES; i += 1) {
      occurrences.push(ri.next().value);
    }
    const split = processOverrides(occurrences);
    expect(split.length).toBe(NUM_OCCURRENCES + 1);
    split.forEach((s, i) => {
      if (i === 0) {
        // The first occurrence is the non-overlapping portion of the first recurrence.
        // It's the only occurrence (besides the last) that isn't in conflict.
        expect(s.start).toEqual(new Date('2017-11-15T20:00:00Z'));
        expect(s.end).toEqual(new Date('2017-11-16T07:55:00Z'));
        expect(s.overrides).toEqual(undefined);
      } else {
        // We expect the first conflict to conflict with every other chunk.
        // Each subsequent chunk has one fewer chunk to conflict with.
        expect(s.overrides.length).toBe(NUM_OCCURRENCES - i);
      }
    });
  });
});

import Occurrence from './types/Occurrence';

// Some functions that mutate occurrences.
// We clone the inbound occurrence list, so we shouldn't have any
// unintended side effects by doing so.

/* eslint-disable no-param-reassign */

const addOverride = (sequence: Occurrence, overridden: Occurrence) => {
  let overrides = sequence.overrides || [];
  overrides.push(overridden);
  if (overridden.overrides) {
    overrides = overrides.concat(overridden.overrides);
  }
  sequence.overrides = overrides;
};

const trimOccurrenceStartOrEnd = (startOrEnd: 'start' | 'end') => (
  occurrence: Occurrence,
  time: Date,
) => {
  occurrence[startOrEnd] = time;
  if (occurrence.overrides) {
    // Trim all overrides as well
    occurrence.overrides = occurrence.overrides
      .map(o => {
        o[startOrEnd] = time;
        return o;
      })
      .filter(o => o.end > o.start);
  }
};

const trimOccurrenceStart = trimOccurrenceStartOrEnd('start');
const trimOccurrenceEnd = trimOccurrenceStartOrEnd('end');

const spliceOccurrenceByStart = (
  occurrences: Occurrence[],
  occurrence: Occurrence,
) => {
  // Find the first item with a start time greater than the current
  let idx = occurrences.findIndex(o => o.start > occurrence.start);
  // If we can't find such a thing, append to the end
  if (idx < 0) idx = occurrences.length;
  occurrences.splice(idx, 0, occurrence);
};

const cloneOccurrence: (occurrence: Occurrence) => Occurrence = occurrence => ({
  ...occurrence,
  overrides: occurrence.overrides
    ? occurrence.overrides.map(o => cloneOccurrence(o))
    : [],
});

/* eslint-enable no-param-reassign */

export default (inOccurrences: Occurrence[]) => {
  // Clone the input as a shallow copy. We only manipulate the top-level props
  // (start, end, overrides) so this is sufficient.
  const occurrences = inOccurrences.map(o => ({ ...o }));
  // We mutate the schedule inside the loop if we run into a scheduling conflict,
  // so the loop length is variable.
  let numOccurrences = occurrences.length;
  for (let i = 0; i < numOccurrences; i += 1) {
    const value = occurrences[i];
    if (!value.overridden) {
      // Find split points.
      // We split a scheduled event if a future event takes precedence over this
      // one, or this one takes precedence over a future event.
      // This way, we never need to look back.
      let i2 = i + 1;
      while (i2 < numOccurrences) {
        const laterOccurrence = occurrences[i2];
        if (laterOccurrence.start >= value.end) {
          // The next start is beyond our boundaries, so move on.
          break;
        }
        if (laterOccurrence.updatedAt > value.updatedAt) {
          // The later occurrence takes precedence.
          // Split this occurrence if required.

          // First, split off the last part if it extends beyond the end of the conflict.
          if (value.end > laterOccurrence.end) {
            const splitOccurrence = cloneOccurrence(value);
            trimOccurrenceStart(splitOccurrence, laterOccurrence.end);
            trimOccurrenceEnd(value, laterOccurrence.end);

            // Push the "new" occurrence onto the array after the one overriding it.
            // Don't add it to the override list yet...
            // We'll process it further as we roll through this loop.
            spliceOccurrenceByStart(occurrences, splitOccurrence);
            numOccurrences = occurrences.length;
          }
          if (value.start < laterOccurrence.start) {
            // Truncate the first part if it's before the start of the conflict.
            // Split off the conflicting portion and mark as overridden.
            const splitOccurrence = cloneOccurrence(value);
            splitOccurrence.overridden = true;
            trimOccurrenceEnd(value, laterOccurrence.start);
            trimOccurrenceStart(splitOccurrence, laterOccurrence.start);
            addOverride(laterOccurrence, splitOccurrence);
          } else {
            // The whole occurrence is in conflict, so mark it as such.
            value.overridden = true;
            addOverride(laterOccurrence, value);
            // We're done with this value, move on.
            break;
          }
        } else {
          // This occurrence takes precedence.
          // Since the array is in order of start time, we don't need to split off
          // the first part, since we know laterOccurence.start >= value.start.
          // Split the future occurrence at this occurrence's end, if required.
          if (value.end < laterOccurrence.end) {
            // laterOccurrence now ends at the end of this occurrence.
            // splitOccurrence starts at the end of this occurrence, and
            // ends whenever it used to end.
            const splitOccurrence = cloneOccurrence(laterOccurrence);
            trimOccurrenceEnd(laterOccurrence, value.end);
            trimOccurrenceStart(splitOccurrence, value.end);

            spliceOccurrenceByStart(occurrences, splitOccurrence);
            numOccurrences = occurrences.length;
          }
          laterOccurrence.overridden = true;
          addOverride(value, laterOccurrence);
        }
        i2 += 1;
      }
    }
  }
  // Remove any overidden occurrences.
  // Otherwise, they get in the way of the logic that figures out if the following
  // occurrence happens right after this one.
  return occurrences.filter(r => !r.overridden);
};

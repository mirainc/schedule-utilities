import scheduleUtilities from './index';

describe('scheduleUtilities', () => {
  it('should have a recurrenceIterator method', () => {
    expect(typeof scheduleUtilities.recurrenceIterator).toEqual('function');
  });

  it('should have a processOverrides method', () => {
    expect(typeof scheduleUtilities.processOverrides).toEqual('function');
  });
});

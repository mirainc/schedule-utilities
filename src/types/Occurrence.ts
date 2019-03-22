import Sequence from './Sequence';

interface Occurrence {
  start: Date;
  end: Date;
  updatedAt: Date;
  id: string;
  sequence?: Sequence;
  overridden?: true;
  overrides?: Occurrence[];
}

export default Occurrence;

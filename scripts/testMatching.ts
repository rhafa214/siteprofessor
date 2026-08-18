import { calculateStudentMatchConfidence } from '../src/data/mappers/legacyMappers';
import { Student } from '../src/domain';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error('FAIL: ' + msg);
    process.exit(1);
  } else {
    console.log('PASS: ' + msg);
  }
}

const baseStudent: Student = {
  id: '',
  classGroupId: 'class_1',
  name: 'Joao',
  number: 1,
  status: 'ACTIVE',
  createdAt: 0,
  updatedAt: 0,
  metadata: {},
  migrationMetadata: {}
};

assert(
  calculateStudentMatchConfidence({...baseStudent, id: '123'}, {...baseStudent, id: '123'}).confidence === 'EXACT',
  'A) EXACT when ids match'
);

assert(
  calculateStudentMatchConfidence({...baseStudent, classGroupId: 'class_1'}, {...baseStudent, classGroupId: 'class_2'}).confidence === 'DISTINCT',
  'B) DISTINCT when same name but different classes'
);

assert(
  calculateStudentMatchConfidence({...baseStudent, name: 'Joao Silva'}, {...baseStudent, name: 'Joaozinho'}).confidence === 'AMBIGUOUS',
  'C) AMBIGUOUS when different names but same explicit number in same class'
);

assert(
  calculateStudentMatchConfidence({...baseStudent, number: 0}, {...baseStudent, number: undefined as any}).confidence === 'AMBIGUOUS',
  'D) AMBIGUOUS when numbers are missing but same name and class (updated rule)'
);

assert(
  calculateStudentMatchConfidence({...baseStudent, number: 1}, {...baseStudent, number: 0}).confidence === 'HIGH_CONFIDENCE',
  'E) HIGH_CONFIDENCE when number missing in one but same name and class'
);

assert(
  calculateStudentMatchConfidence({...baseStudent, number: 1}, {...baseStudent, number: 2}).confidence === 'AMBIGUOUS',
  'F) AMBIGUOUS when same name but explicitly different numbers'
);

console.log('ALL TESTS PASSED');

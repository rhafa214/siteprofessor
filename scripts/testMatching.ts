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

// A) mesmo aluno em duas fontes com identificador forte igual (id canonical ja mapeado)
assert(
  calculateStudentMatchConfidence({...baseStudent, id: '123'}, {...baseStudent, id: '123'}) === 'EXACT',
  'A) EXACT when ids match'
);

// B) nomes iguais de pessoas diferentes (classes diferentes)
assert(
  calculateStudentMatchConfidence({...baseStudent, classGroupId: 'class_1'}, {...baseStudent, classGroupId: 'class_2'}) === 'DISTINCT',
  'B) DISTINCT when same name but different classes'
);

// C) nomes parecidos -> DISTINCT ou HIGH_CONFIDENCE dependendo?
// Only exact name matches are AMBIGUOUS/HIGH_CONFIDENCE. If names differ, it depends on number.
assert(
  calculateStudentMatchConfidence({...baseStudent, name: 'Joao Silva'}, {...baseStudent, name: 'Joaozinho'}) === 'AMBIGUOUS',
  'C) AMBIGUOUS when different names but same explicit number in same class'
);

// D) number ausente em ambas as fontes
assert(
  calculateStudentMatchConfidence({...baseStudent, number: 0}, {...baseStudent, number: undefined}) === 'HIGH_CONFIDENCE',
  'D) HIGH_CONFIDENCE when numbers are missing but same name and class'
);

// E) number presente em uma e ausente em outra
assert(
  calculateStudentMatchConfidence({...baseStudent, number: 1}, {...baseStudent, number: 0}) === 'HIGH_CONFIDENCE',
  'E) HIGH_CONFIDENCE when number missing in one but same name and class'
);

// F) mesmo nome + numbers realmente diferentes (SAME_NAME_DIFFERENT_NUMBER)
assert(
  calculateStudentMatchConfidence({...baseStudent, number: 1}, {...baseStudent, number: 2}) === 'AMBIGUOUS',
  'F) AMBIGUOUS when same name but explicitly different numbers'
);

console.log('ALL TESTS PASSED');

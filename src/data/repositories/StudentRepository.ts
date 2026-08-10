import { Student } from '../../domain';

export interface StudentRepository {
  getByClassGroup(classGroupId: string): Promise<Student[]>;
  getById(id: string): Promise<Student | null>;
  create(student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<Student>;
  update(id: string, student: Partial<Student>): Promise<Student>;
  archive(id: string): Promise<void>;
}

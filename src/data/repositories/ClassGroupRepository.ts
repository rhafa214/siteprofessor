import { ClassGroup } from '../../domain';

export interface ClassGroupRepository {
  getAll(): Promise<ClassGroup[]>;
  getById(id: string): Promise<ClassGroup | null>;
  create(classGroup: Omit<ClassGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<ClassGroup>;
  update(id: string, classGroup: Partial<ClassGroup>): Promise<ClassGroup>;
  archive(id: string): Promise<void>;
}

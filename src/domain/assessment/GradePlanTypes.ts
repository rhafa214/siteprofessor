export type GradePlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type GradeSourceType = 'MANUAL' | 'SALA_FUTURO' | 'MATIFIC' | 'TASK_ANALYSIS' | 'PROVA_PAULISTA' | 'CUSTOM';
export type ResolverStatus = 'SUPPORTED' | 'PENDING_INTEGRATION' | 'MANUAL_ENTRY_REQUIRED';

export interface CanonicalGradePlan {
  id: string;
  uid: string;
  academicYearId: string;
  termId: string;
  classGroupId: string;
  version: number;
  status: GradePlanStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CanonicalGradeComponent {
  id: string;
  gradePlanId: string;
  key: string;
  label: string;
  weight: number; 
  sourceType: GradeSourceType;
  sourceKey?: string;
  enabled: boolean;
  order: number;
}

export function getSourceResolverStatus(sourceType: GradeSourceType): ResolverStatus {
  switch (sourceType) {
    case 'MANUAL':
    case 'MATIFIC':
    case 'TASK_ANALYSIS':
    case 'PROVA_PAULISTA':
      return 'SUPPORTED';
    case 'SALA_FUTURO':
    case 'CUSTOM':
      return 'PENDING_INTEGRATION';
    default:
      return 'PENDING_INTEGRATION';
  }
}

export interface Student {
  id: string;
  name: string;
  normalizedName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';
  externalIds?: {
    ra?: string;
    raDigit?: string;
    [key: string]: string | undefined;
  };
  
  /** 
   * @deprecated Na nova arquitetura, o vínculo com a turma ocorre através da entidade Enrollment.
   * Não utilize este campo em novos desenvolvimentos.
   */
  classGroupId?: string;
  
  /** 
   * @deprecated Na nova arquitetura, o número de chamada (callNumber) pertence à entidade Enrollment.
   * Não utilize este campo em novos desenvolvimentos.
   */
  number?: number;
  
  metadata?: unknown;
  migrationMetadata?: any;
  createdAt: number;
  updatedAt: number;
}

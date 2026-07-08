// types/branch.ts
export interface Branch {
  id: string;
  name: string;
  location: string;
  contactPerson: string | null;
  contactPhone: string | null;
  email: string | null;
  accountantId: string | null;
  managerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    users: number;
    accounts: number;
    loans: number;
    floatAllocations: number;
  };
}

export interface BranchCreateDTO {
  name: string;
  location: string;
  contactPerson?: string;
  contactPhone?: string;
  email?: string;
  accountantId?: string;
  managerId?: string;
}

export interface BranchUpdateDTO extends Partial<BranchCreateDTO> {
  id: string;
}

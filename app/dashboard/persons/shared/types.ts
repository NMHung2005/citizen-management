export interface Person {
  id: string
  fullName: string
  dateOfBirth: string
  gender: string
  idNumber: string | null
  relationship: string | null
  status: string
  household: {
    id: string
    householdId: string
    address: string
    districtRelation: {
      id: string
      name: string
    }
  }
  createdAt: string
}

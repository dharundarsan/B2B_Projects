export interface Row {
  id: string;
  propertyId: string;
  revision: number;
  createdAt: string;
}
export interface Property {
  id: string;
  name: string;
  address: string;
  timezone: string;
  units: number;
}
export interface Unit {
  id: string;
  propertyId: string;
  label: string;
  blockId?: string | null;
  floor?: number | null;
}
export interface Block extends Row {
  name: string;
}
export interface Delivery extends Row {
  recipientName?: string;
  destination?: string;
  userId: string;
  sellerId?: string | null;
  unitId?: string | null;
  name: string;
  reference: string;
  notes: string;
  packages: number;
  bulk: boolean;
  expectedAt: string;
  approval: string;
  status: string;
  acceptedAt?: string;
  receivedAt?: string;
}
export interface Party extends Row {
  name: string;
  kind: string;
  userId?: string;
}
export interface Ownership extends Row {
  unitId: string;
  partyId: string;
  share: number;
  incomeShare: number;
  expenseShare: number;
  startsOn: string;
  endsOn?: string;
}
export interface Agreement extends Row {
  kind: string;
  debtorPartyId: string;
  creditorPartyId: string;
  parentId?: string;
  occupancyId?: string;
  unitIds: string[];
  startsOn: string;
  endsOn: string;
  rent: number;
  deposit: number;
  currency: string;
  dueDay: number;
  status: string;
}
export interface Charge extends Row {
  agreementId: string;
  kind: string;
  period: string;
  dueOn: string;
  amount: number;
  currency: string;
  verifiedPaid: number;
}
export interface Payment extends Row {
  chargeId: string;
  amount: number;
  reference: string;
  status: string;
  userId: string;
  submissionId: string;
  verifiedBy?: string;
}
export interface Allocation {
  expenseId?: string;
  partyId: string;
  amount: number;
}
export interface Expense extends Row {
  scope: string;
  unitId?: string;
  partyId?: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  incurredOn: string;
  paidStatus: string;
  userId: string;
  allocations: Allocation[];
}
export interface Seller extends Row {
  userId: string;
  name: string;
  kind: string;
  status: string;
  pickup: string;
}
export interface Product extends Row {
  sellerId: string;
  name: string;
  description: string;
  kind: string;
  ingredients: string;
  allergens: string;
  price: number;
  currency: string;
  stock: number;
  status: string;
}
export interface Order extends Row {
  productId: string;
  sellerId: string;
  userId: string;
  groupId?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  status: string;
  paymentStatus: string;
  submissionId: string;
}
export interface GroupBuy extends Row {
  productId: string;
  sellerId: string;
  unitPrice: number;
  currency: string;
  minimum: number;
  maximum: number;
  closesAt: string;
  pickup: string;
  status: string;
  committed: number;
  myQuantity: number;
}
export interface GateEntry extends Row {
  kind: string;
  name: string;
  unitId: string;
  occupancyId: string;
  residentUserId: string;
  expectedAt: string;
  approval: string;
  status: string;
  arrivedAt?: string;
  departedAt?: string;
  acceptedAt?: string;
  receivedAt?: string;
  userId: string;
}
export interface Facility extends Row {
  name: string;
  capacity: number;
  slotMinutes: number;
  price: number;
  currency: string;
  rules: string;
  status: string;
}
export interface Booking extends Row {
  facilityId: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  price: number;
  currency: string;
  submissionId: string;
}
export interface Note extends Row {
  kind: string;
  title: string;
  body: string;
  userId: string;
  assignedUserId?: string;
  status: string;
}
export interface Point {
  x: number;
  y: number;
}
export interface Shape {
  id: string;
  kind: string;
  label: string;
  unitId?: string | null;
  points: Point[];
}
export interface Layout extends Row {
  blockId?: string | null;
  floor: number;
  name: string;
  shapes: Shape[];
  publishedAt?: string;
}
export interface Audit extends Row {
  userId: string;
  entityId: string;
  action: string;
}
export interface Receipt extends Row {
  expenseId: string;
  name: string;
  contentType: string;
  size: number;
  status: string;
}
export interface CommunityContext {
  role: string;
  userId: string;
  properties: Property[];
  userContext: 1 | 2 | 3;
  canSwitchContext: boolean;
}
export interface CommunityData {
  userContext: 1 | 2 | 3;
  role: string;
  property: Property;
  units: Unit[];
  blocks?: Block[];
  deliveries?: Delivery[];
  canManage: boolean;
  canGate: boolean;
  userId: string;
  myPartyIds: string[];
  myUnitIds: string[];
  parties: Party[];
  ownerships: Ownership[];
  agreements: Agreement[];
  charges: Charge[];
  payments: Payment[];
  expenses: Expense[];
  sellers: Seller[];
  products: Product[];
  orders: Order[];
  services: Service[];
  serviceRequests: ServiceRequest[];
  groups: GroupBuy[];
  gateEntries: GateEntry[];
  facilities: Facility[];
  bookings: Booking[];
  notes: Note[];
  layouts: Layout[];
  audit: Audit[];
  receipts: Receipt[];
}
export interface Service extends Row {
  sellerId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  priceUnit: string;
  status: string;
}
export interface ServiceRequest extends Row {
  serviceId: string;
  sellerId: string;
  userId: string;
  serviceName: string;
  description: string;
  preferredAt: string;
  price: number;
  currency: string;
  priceUnit: string;
  status: string;
  submissionId: string;
}

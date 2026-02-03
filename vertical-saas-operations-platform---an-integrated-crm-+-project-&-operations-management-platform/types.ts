
export type CustomerStatus = 'lead' | 'quoted' | 'active' | 'completed' | 'dormant';

export interface ActivityLogEntry {
  id: string;
  date: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  content: string;
}

export interface ImportantDate {
  label: string;
  date: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  emails: string[];
  phones: string[];
  address: string;
  lastContactDate: string;
  lastContactNotes: string;
  childrenNames: string[];
  spouseName: string;
  importantDates: ImportantDate[];
  tags: string[];
  status: CustomerStatus;
  notes: string;
  activityLog: ActivityLogEntry[];
}

export type QuoteStatus = 'draft' | 'sent' | 'revised' | 'approved' | 'rejected';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  version: number;
  dateCreated: string;
  scopeSummary: string;
  lineItems: LineItem[];
  totalValue: number;
  margin: number;
  poNumber?: string;
  probability: number;
  status: QuoteStatus;
  pdfAttachment?: {
    name: string;
    data: string; // Base64 encoded string
  };
}

export type ProjectStatus = 'on track' | 'at risk' | 'delayed';

export interface Task {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}

// Updated Categories for To-do list
export type TodoCategory = 
  | 'Email' | 'Call' | 'Quote' | 'Take off' | 'Design' // Sales
  | 'Build Load' | 'Restock' | 'Clean up' | 'Inventory' | 'Maintenance' // Yard
  | 'Dispatching' | 'Scheduling' | 'Fleet' // Dispatch
  | 'General';

export interface DailyTask {
  id: string;
  title: string;
  category: TodoCategory;
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface Phase {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  targetEndDate: string;
  completed: boolean;
  tasks: Task[];
}

export interface Project {
  id: string;
  customerId: string;
  quoteId: string;
  projectName: string;
  startDate: string;
  targetCompletionDate: string;
  currentPhase: string;
  status: ProjectStatus;
  phases: Phase[];
  trussDeliveryDate?: string;
  floorSystemDeliveryDate?: string;
  shipDate?: string;
}

// --- Logistics Expansion ---

export type UserRole = 'ADMIN' | 'DISPATCH' | 'SALES' | 'YARD';
export type DeliveryWindow = 'AM' | 'PM' | 'ANYTIME' | 'TWO_HOUR';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CONVERTED';
export type DeliveryStatus = 'REQUESTED' | 'CONFIRMED' | 'PICKED' | 'LOADED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
export type LoadType = 'BOOM' | 'FLATBED' | 'PICKUP' | 'COURIER';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branch?: string;
  isActive: boolean;
}

export interface DeliveryRequest {
  id: string;
  projectId: string;
  customerId: string;
  requestedDate: string;
  requestedWindow: DeliveryWindow;
  notes: string;
  createdByUserId: string;
  createdAt: string;
  status: RequestStatus;
}

export interface Delivery {
  id: string;
  requestId?: string;
  projectId: string;
  customerId: string;
  scheduledDate: string;
  scheduledWindow: DeliveryWindow;
  status: DeliveryStatus;
  loadType: LoadType;
  truck?: string;
  driver?: string;
  stopSequence: number;
  dispatchNotes: string;
  yardNotes: string;
  createdByUserId: string;
  updatedAt: string;
}

export interface TrackingResult {
  id: string;
  status: string;
  orderDate: string;
  estimatedDelivery: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  vendor: string;
  customer: string;
  deliveryAddress: string;
  timeline: Array<{
    status: string;
    title: string;
    timestamp: string;
    description: string;
    completed: boolean;
  }>;
}

export interface TrackingUpdate {
  status: string;
  notes: string;
  updated_at: string;
}
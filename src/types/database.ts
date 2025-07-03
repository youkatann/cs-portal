export interface Database {
  public: {
    Jobs: JobData;  
    // інші таблиці…
  };
}

export type JobData = {
  job_id: number;
  customer_name: string;
  email: string;
  phone1_number: string;
  phone2_number: string | null;
  order_status: string;
  pickup_date: string;
  actual_volume: number;
  pickup_address1: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  delivery_address1: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  delivery_apartment: string | null;
  pickup_flights: string | null;
  pickup_entrance: string | null;
  delivery_flights: string | null;
  delivery_entrance: string | null;
};

export type ChatMessage = {
  id: number;
  session_id: string;
  user_id: string | null;
  text: string;
  created_at: string;
  slack_ts: string | null;
};

export type ChatThread = {
  session_id: string;
  slack_ts: string;
  status: 'resolved' | 'unresolved';
  resolved_by: string | null;
  updated_at: string;
};
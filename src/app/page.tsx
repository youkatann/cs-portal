'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Chat } from '@/components/Chat';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DocumentsTab } from '@/components/Documents';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// Оновлений тип відповідно до ваших колонок
type RawJob = {
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
  pickup_flights?: number;
  pickup_entrance?: string;
  pickup_zip: string;
  delivery_address1: string;
  delivery_city: string;
  delivery_state: string;
  delivery_flights?: number;
  delivery_entrance?: string;
  delivery_zip: string;
  delivery_apartment: string | null;
};

export default function HomePage() {
  const [orderId, setOrderId] = useState('');
  const [password, setPassword] = useState('');
  const [order, setOrder] = useState<RawJob | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);

    const idNum = parseInt(orderId, 10);
    if (isNaN(idNum)) {
      setError('Order ID must be a valid number.');
      setLoading(false);
      return;
    }

    // Тепер шукаємо по job_id
    const { data: allJobs, error: fetchErr } = await supabase
      .from('Jobs')
      .select('*');
    setLoading(false);
    if (fetchErr) {
      setError('Server error. Please try again later.');
      return;
    }

    const found = allJobs?.find(j => j.job_id === idNum);
    if (!found) {
      setError('No order found with that Order ID.');
      return;
    }

    // Тепер паролем є email
    if (found.email !== password) {
      setError('Incorrect password (email).');
      return;
    }

    // Успіх!
    setOrder(found);
    setSessionId(`${found.job_id}-${Date.now()}`);
  };

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Track by OrderID</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="orderId" className="block mb-1 font-medium">
                  Order ID
                </label>
                <Input
                  id="orderId"
                  type="number"
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                  placeholder="e.g. 15720"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block mb-1 font-medium">
                  Password (your email)
                </label>
                <Input
                  id="password"
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="e.g. you@example.com"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Checking…' : 'Track order'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Order #{order.job_id}</h2>
        <Button
          variant="outline"
          onClick={() => {
            setOrder(null);
            setOrderId('');
            setPassword('');
            setSessionId('');
          }}
        >
          Exit
        </Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Order Info</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          {/* Customer & Contact */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Customer & Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium">Customer Name</p>
                <p>{order.customer_name}</p>
              </div>
              <div>
                <p className="font-medium">Email</p>
                <p>{order.email}</p>
              </div>
              <div>
                <p className="font-medium">Phone 1</p>
                <p>{order.phone1_number}</p>
              </div>
              <div>
                <p className="font-medium">Phone 2</p>
                <p>{order.phone2_number ?? <em>Not specified</em>}</p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Order Info */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="flex space-x-4">
              <Badge variant="outline">Status: {order.order_status}</Badge>
              <Badge variant="outline">
                Move Date: {new Date(order.pickup_date).toLocaleDateString()}
              </Badge>
              <Badge variant="outline">Volume: {order.actual_volume}</Badge>
            </CardContent>
          </Card>

          <Separator />

          {/* Pickup & Delivery */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Pickup Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>
                  <span className="font-medium">Address:</span> {order.pickup_address1}
                </p>
                <p>
                  <span className="font-medium">City:</span> {order.pickup_city}
                </p>
                <p>
                  <span className="font-medium">State:</span> {order.pickup_state}
                </p>
                <p>
                  <span className="font-medium">ZIP:</span> {order.pickup_zip}
                </p>
                {/* Якщо додаткові поля flight/entrance є */}
                {order.pickup_flights != null && (
                  <p>
                    <span className="font-medium">Flights:</span> {order.pickup_flights}
                  </p>
                )}
                {order.pickup_entrance && (
                  <p>
                    <span className="font-medium">Entrance:</span> {order.pickup_entrance}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>
                  <span className="font-medium">Address:</span> {order.delivery_address1}
                </p>
                <p>
                  <span className="font-medium">City:</span> {order.delivery_city}
                </p>
                <p>
                  <span className="font-medium">State:</span> {order.delivery_state}
                </p>
                <p>
                  <span className="font-medium">ZIP:</span> {order.delivery_zip}
                </p>
                <p>
                  <span className="font-medium">Apartment:</span>{' '}
                  {order.delivery_apartment ?? <em>Not specified</em>}
                </p>
                {order.delivery_flights != null && (
                  <p>
                    <span className="font-medium">Flights:</span> {order.delivery_flights}
                  </p>
                )}
                {order.delivery_entrance && (
                  <p>
                    <span className="font-medium">Entrance:</span> {order.delivery_entrance}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="chat">
    <Chat
    sessionId={sessionId}
    userId={order.customer_name}           // або ваш реальний user_id
    job={{
      job_id: order.job_id,
      customer_name: order.customer_name,
      email: order.email,
      phone1_number: order.phone1_number,
    }}
  />
        </TabsContent>
        <TabsContent value="documents">
  <DocumentsTab jobId={order.job_id} />
</TabsContent>
      </Tabs>
    </div>
  );
}

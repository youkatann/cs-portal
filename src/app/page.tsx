// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Chat } from '@/components/Chat';
import { DocumentsTab } from '@/components/Documents';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Truck } from 'lucide-react';

type RawJob = {
  job_id: number;
  customer_name: string;
  email: string;
  phone1_number: string;
  phone2_number: string | null;
  current_location: string | null;
  order_status: string;
  pickup_date: string;
  actual_volume: number;
  pickup_address1: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  pickup_flights: string;
  pickup_apartment: string;
  pickup_entrance: string;
  delivery_address1: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  delivery_flights: string;
  delivery_apartment: string;
  delivery_entrance: string;
  delivery_date_from: string;
  delivery_date_to: string;
};

function sanitizeEmail(raw: string): string {
  return (
    raw
      .split(',')
      .map((e) => e.trim())
      .filter((e) => !e.startsWith('qt@'))
      [0] || ''
  );
}

function formatPhone(digits: string): string {
  return digits.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
}

interface StatusProgressProps {
  status: string;
}

const segments = [
  ['Booked', 'Delay'],
  ['Picked Up'],
  ['On Trip'],
  ['Delivered'],
];

function getStage(status: string) {
  const idx = segments.findIndex((group) => group.includes(status));
  return idx >= 0 ? idx : 0;
}

const StatusProgress: React.FC<StatusProgressProps> = ({ status }) => {
  const stage = getStage(status);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block relative my-4">
        <div className="flex h-1 rounded overflow-hidden">
          {segments.map((_, i) => (
            <div
              key={i}
              className={`flex-1 ${i <= stage ? 'bg-primary' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <div className="absolute inset-0 flex">
          {segments.map((_, i) => (
            <div key={i} className="flex-1 relative">
              {i === stage && (
                <div className="absolute -top-8 left-1/2 flex w-max -translate-x-1/2 flex-col items-center">
                  <Truck className="text-primary" size={24} />
                  <span className="mt-4 text-sm font-medium">{status}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Mobile */}
      <div className="md:hidden flex flex-col w-full my-4">
        <div className="w-full h-1 rounded bg-primary" />
        <div className="mt-2 flex flex-col items-center">
          <Truck className="text-primary" size={20} />
          <span className="mt-1 text-sm font-medium">{status}</span>
        </div>
      </div>
    </>
  );
};

export default function HomePage() {
  const [orderId, setOrderId] = useState('');
  const [password, setPassword] = useState('');
  const [order, setOrder] = useState<RawJob | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // login logic extracted so it can be re-used
  const doLogin = useCallback(
    async (idNum: number, rawEmail: string) => {
      setLoading(true);
      setError('');
      setOrder(null);
      const { data: allJobs, error: fetchErr } = await supabase
        .from('Jobs')
        .select('*');
      setLoading(false);
      if (fetchErr) {
        setError('Server error. Please try again later.');
        return;
      }
      const found = allJobs?.find((j) => j.job_id === idNum);
      if (!found) {
        setError('No order found with that Order ID.');
        return;
      }
      const primaryEmail = sanitizeEmail(found.email);
      if (primaryEmail !== sanitizeEmail(rawEmail)) {
        setError('Incorrect password (email).');
        return;
      }
      setOrder(found);
      const newSession = `${found.job_id}-${Date.now()}`;
      setSessionId(newSession);
      localStorage.setItem('portalOrder', JSON.stringify(found));
      localStorage.setItem('portalSession', newSession);
    },
    []
  );

  // rehydrate from localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem('portalOrder');
    const savedSession = localStorage.getItem('portalSession');
    if (savedOrder && savedSession) {
      setOrder(JSON.parse(savedOrder));
      setSessionId(savedSession);
    }
  }, []);

  // auto-login via URL params ?job=123&email=foo@bar.com
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobParam = params.get('job');
    const emailParam = params.get('email');
    if (jobParam && emailParam && !order) {
      const idNum = parseInt(jobParam, 10);
      if (!isNaN(idNum)) {
        setOrderId(jobParam);
        setPassword(sanitizeEmail(emailParam));
        doLogin(idNum, emailParam);
      }
    }
  }, [doLogin, order]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const idNum = parseInt(orderId, 10);
    if (isNaN(idNum)) {
      setError('Order ID must be a valid number.');
      return;
    }
    doLogin(idNum, password);
  };

  const handleLogout = () => {
    setOrder(null);
    setOrderId('');
    setPassword('');
    setSessionId('');
    localStorage.removeItem('portalOrder');
    localStorage.removeItem('portalSession');
  };

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Track by Order ID</CardTitle>
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
                  onChange={(e) => setOrderId(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
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
    <div className="min-h-screen flex flex-col p-6 md:p-12">
      <header className="flex flex-col md:flex-row items-center justify-between mb-6">
        <div className="text-center md:text-left">
          <h2 className="text-lg tracking-tight uppercase opacity-50">
            Order
          </h2>
          <span className="block text-4xl md:text-7xl text-primary font-bold">
            #{order.job_id}
          </span>
        </div>
        <Button variant="outline" onClick={handleLogout} className="mt-4 md:mt-0">
          Exit
        </Button>
      </header>

      <Tabs defaultValue="info" className="flex-1 flex flex-col">
        <div className="mb-4 overflow-x-auto">
          <TabsList className="space-x-2">
            <TabsTrigger value="info">Order Info</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="chat">Support Chat</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-auto">
          <TabsContent value="info" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="uppercase text-xl md:text-3xl">
                  Customer & Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-bold">Name</p>
                  <p>{order.customer_name}</p>
                </div>
                <div>
                  <p className="font-bold">Email</p>
                  <p>{sanitizeEmail(order.email)}</p>
                </div>
                <div>
                  <p className="font-bold">Contact Phones</p>
                  <div className="space-y-1">
                    <p>{formatPhone(order.phone1_number)}</p>
                    {order.phone2_number && (
                      <p>{formatPhone(order.phone2_number)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="uppercase text-xl md:text-3xl">
                  Order Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatusProgress status={order.order_status} />
                <Badge variant="outline">Volume: {order.actual_volume}</Badge>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="uppercase text-xl md:text-3xl">
                    Pickup Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>
                    <span className="font-bold">Pickup Date:</span>{' '}
                    {format(new Date(order.pickup_date), 'MM/dd/yyyy')}
                  </p>
                  <p className="text-sm md:text-base">
                    <span className="font-bold">Address:</span>{' '}
                    {`${order.pickup_address1}, ${order.pickup_city.toUpperCase()}, ${order.pickup_state}, ${order.pickup_zip}${order.pickup_flights ? `, fl:${order.pickup_flights}` : ''}${order.pickup_entrance ? `, ent:${order.pickup_entrance}` : ''}`}
                  </p>
                  {order.current_location && (
                    <p>
                      <span className="font-bold">Current Location:</span>{' '}
                      {order.current_location}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="uppercase text-xl md:text-3xl">
                    Delivery Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {order.delivery_date_to && (
                    <p>
                      <span className="font-bold">Estimated Delivery:</span>{' '}
                      {`${format(new Date(order.delivery_date_from), 'MM/dd/yyyy')} – ${format(
                        new Date(order.delivery_date_to),
                        'MM/dd/yyyy'
                      )}`}
                    </p>
                  )}
                  <p className="text-sm md:text-base">
                    <span className="font-bold">Address:</span>{' '}
                    {`${order.delivery_address1}, ${order.delivery_city.toUpperCase()}, ${order.delivery_state}, ${order.delivery_zip}${order.delivery_flights ? `, fl:${order.delivery_flights}` : ''}${order.delivery_entrance ? `, ent:${order.delivery_entrance}` : ''}`}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="chat" className="h-full">
            <Chat
              sessionId={sessionId}
              userId={order.customer_name}
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
        </div>
      </Tabs>
    </div>
  );
}

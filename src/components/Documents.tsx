// src/components/Documents.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Table, TableHeader, TableRow, TableHead,
  TableBody, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface Contract {
  document_name: string;
  document_type: string;
  file_path: string; // наприклад 'contracts/15503/…pdf'
}

export function DocumentsTab({ jobId }: { jobId: number }) {
  const [docs, setDocs] = useState<(Contract & { url?: string; error?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 1) витягнути записи з БД
      const { data, error } = await supabase
        .from('Contracts')
        .select('document_name, document_type, file_path')
        .eq('job_id', jobId);

      if (error) {
        console.error('Fetch contracts error', error);
        setLoading(false);
        return;
      }
      if (!data || !data.length) {
        setDocs([]);
        setLoading(false);
        return;
      }

      // 2) для кожного документа — запитати ваш /api/signed-url
      const withUrls = await Promise.all(
        data.map(async (doc) => {
          try {
            const res = await fetch('/api/signed-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: doc.file_path }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || res.statusText);
            return { ...doc, url: json.url as string };
          } catch (e: unknown) {
            let errorMessage = 'Unknown error';
            if (e instanceof Error) {
              errorMessage = e.message;
            }
            console.error('Signed URL failed', doc.file_path, e);
            return { ...doc, error: errorMessage };
}
        })
      );

      setDocs(withUrls);
      setLoading(false);
    }

    load();
  }, [jobId]);

  if (loading) return <p>Loading documents…</p>;
  if (!docs.length) return <p>Documents not found.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.map((d) => (
          <TableRow key={d.file_path}>
            <TableCell>{d.document_name}</TableCell>
            <TableCell>{d.document_type}</TableCell>
            <TableCell>
              {d.url ? (
                <Button asChild>
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    Download
                  </a>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  {d.error ? 'No access' : 'Generating'}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

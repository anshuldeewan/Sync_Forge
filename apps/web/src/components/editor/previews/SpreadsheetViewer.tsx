'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Download, Table as TableIcon } from 'lucide-react';

interface SpreadsheetViewerProps {
  blobUrl: string;
  filename: string;
  onDownload: () => void;
}

export function SpreadsheetViewer({ blobUrl, filename, onDownload }: SpreadsheetViewerProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [htmlData, setHtmlData] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function loadSpreadsheet() {
      try {
        setLoading(true);
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // Read workbook
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (isMounted) {
          setWorkbook(wb);
          if (wb.SheetNames.length > 0) {
            setActiveSheet(wb.SheetNames[0]);
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to parse spreadsheet');
          setLoading(false);
        }
      }
    }

    loadSpreadsheet();

    return () => {
      isMounted = false;
    };
  }, [blobUrl]);

  useEffect(() => {
    if (workbook && activeSheet) {
      const worksheet = workbook.Sheets[activeSheet];
      if (worksheet) {
        // Generate HTML table from the active sheet
        const html = XLSX.utils.sheet_to_html(worksheet, { id: 'spreadsheet-table' });
        // The sheet_to_html returns a full HTML body sometimes or just the table.
        // We can just extract the table or use it directly as it's safe (XLSX sanitizes basics).
        // Let's ensure it's wrapped properly.
        setHtmlData(html);
      }
    }
  }, [workbook, activeSheet]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Loading spreadsheet preview...
      </div>
    );
  }

  if (error || !workbook) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Preview Unavailable</h3>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <button 
          onClick={onDownload}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <Download size={16} /> Download {filename}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-black">
      {workbook.SheetNames.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto p-2 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 shrink-0">
          <TableIcon size={16} className="text-gray-500 ml-1" />
          {workbook.SheetNames.map(sheet => (
            <button
              key={sheet}
              onClick={() => setActiveSheet(sheet)}
              className={`px-3 py-1 text-sm rounded whitespace-nowrap transition-colors ${
                activeSheet === sheet 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800'
              }`}
            >
              {sheet}
            </button>
          ))}
        </div>
      )}
      
      <div className="flex-1 overflow-auto p-2 spreadsheet-container">
        {/* We apply scoped styles to the rendered table to make it look like a spreadsheet */}
        <style dangerouslySetInnerHTML={{__html: `
          .spreadsheet-container table {
            border-collapse: collapse;
            width: max-content;
            min-width: 100%;
            font-size: 0.875rem;
          }
          .spreadsheet-container td, .spreadsheet-container th {
            border: 1px solid var(--border-color, #e5e7eb);
            padding: 4px 8px;
            white-space: nowrap;
          }
          .dark .spreadsheet-container td, .dark .spreadsheet-container th {
            --border-color: #27272a;
          }
          .spreadsheet-container tr:first-child td {
            background-color: var(--header-bg, #f3f4f6);
            font-weight: 600;
          }
          .dark .spreadsheet-container tr:first-child td {
            --header-bg: #18181b;
          }
        `}} />
        <div 
          className="text-gray-800 dark:text-gray-200"
          dangerouslySetInnerHTML={{ __html: htmlData }} 
        />
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import DOMPurify from 'dompurify';
import { Download } from 'lucide-react';

interface DocxViewerProps {
  blobUrl: string;
  filename: string;
  onDownload: () => void;
}

export function DocxViewer({ blobUrl, filename, onDownload }: DocxViewerProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function loadDocx() {
      try {
        setLoading(true);
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        if (isMounted) {
          // Sanitize the HTML before rendering to prevent XSS
          const cleanHtml = DOMPurify.sanitize(result.value);
          setHtmlContent(cleanHtml);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to parse DOCX file');
          setLoading(false);
        }
      }
    }

    loadDocx();

    return () => {
      isMounted = false;
    };
  }, [blobUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Loading document preview...
      </div>
    );
  }

  if (error) {
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
    <div className="w-full h-full overflow-y-auto bg-gray-100 dark:bg-zinc-950 p-4 sm:p-8 flex justify-center">
      <div 
        className="w-full max-w-4xl bg-white dark:bg-black shadow-sm rounded border border-gray-200 dark:border-zinc-800 p-8 sm:p-12 docx-preview prose dark:prose-invert prose-blue"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}

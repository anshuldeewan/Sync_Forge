'use client';

import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { Download, Presentation } from 'lucide-react';

interface PresentationViewerProps {
  blobUrl: string;
  filename: string;
  onDownload: () => void;
}

export function PresentationViewer({ blobUrl, filename, onDownload }: PresentationViewerProps) {
  const [slideCount, setSlideCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function loadPresentation() {
      try {
        setLoading(true);
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // PPTX files are ZIP archives. We can parse them using JSZip.
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Check for docProps/app.xml to get slide count
        const appXmlFile = zip.file('docProps/app.xml');
        if (appXmlFile) {
          const appXmlText = await appXmlFile.async('text');
          
          // Basic XML string matching to find Slides count
          // <Slides>3</Slides>
          const slidesMatch = appXmlText.match(/<Slides>(\d+)<\/Slides>/);
          if (slidesMatch && slidesMatch[1] && isMounted) {
            setSlideCount(parseInt(slidesMatch[1], 10));
          }
        }
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to parse presentation');
          setLoading(false);
        }
      }
    }

    loadPresentation();

    return () => {
      isMounted = false;
    };
  }, [blobUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Inspecting presentation...
      </div>
    );
  }

  // We offer a clean Presentation placeholder with the metadata we found
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800">
      <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500 mb-4">
        <Presentation size={32} />
      </div>
      <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-1">{filename}</h3>
      <p className="text-sm text-gray-500 mb-6">
        PowerPoint Presentation {slideCount !== null ? `• ${slideCount} Slides` : ''}
      </p>
      
      <div className="max-w-md text-sm text-gray-600 dark:text-gray-400 mb-8">
        Full visual slide rendering is not supported locally. 
        Please download the presentation to view its complete layout, graphics, and formatting.
      </div>
      
      <button 
        onClick={onDownload}
        className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition-colors"
      >
        <Download size={18} /> Download Presentation
      </button>
    </div>
  );
}

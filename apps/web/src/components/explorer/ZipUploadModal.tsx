import { X, FolderOpen, FileArchive } from 'lucide-react';

interface ZipUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtract: () => void;
  onUploadAsFile: () => void;
  filename: string;
}

export function ZipUploadModal({ isOpen, onClose, onExtract, onUploadAsFile, filename }: ZipUploadModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">ZIP File Detected</h2>
          <button onClick={onClose} className="text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 p-1 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            You are uploading <span className="font-semibold text-gray-800 dark:text-gray-200">{filename}</span>. 
            How would you like to handle this archive?
          </p>

          <div className="flex flex-col gap-3">
            <button 
              onClick={onExtract}
              className="flex items-start gap-3 p-4 border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-colors text-left"
            >
              <FolderOpen className="text-blue-500 shrink-0 mt-0.5" size={24} />
              <div>
                <div className="font-semibold text-blue-700 dark:text-blue-400">Extract into project (Recommended)</div>
                <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">Unzips the contents and creates editable folders and files in your workspace.</div>
              </div>
            </button>

            <button 
              onClick={onUploadAsFile}
              className="flex items-start gap-3 p-4 border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left"
            >
              <FileArchive className="text-gray-500 shrink-0 mt-0.5" size={24} />
              <div>
                <div className="font-semibold text-gray-700 dark:text-gray-300">Upload as single .zip</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Preserves the archive as a single binary file. You can preview its contents later.</div>
              </div>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

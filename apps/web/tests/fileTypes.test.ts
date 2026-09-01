import { getFileCategory, getFileCategoryDisplayName, getMonacoLanguage, FileCategory } from '../src/utils/fileTypes';

describe('fileTypes Utility', () => {
  describe('getFileCategory', () => {
    it('should identify code and text files by extension', () => {
      expect(getFileCategory('app.tsx')).toBe(FileCategory.TEXT);
      expect(getFileCategory('style.css')).toBe(FileCategory.TEXT);
      expect(getFileCategory('data.json')).toBe(FileCategory.TEXT);
      expect(getFileCategory('config.yaml')).toBe(FileCategory.TEXT);
      expect(getFileCategory('script.py')).toBe(FileCategory.TEXT);
    });

    it('should identify exact extensionless text files', () => {
      expect(getFileCategory('README')).toBe(FileCategory.TEXT);
      expect(getFileCategory('Dockerfile')).toBe(FileCategory.TEXT);
      expect(getFileCategory('Makefile')).toBe(FileCategory.TEXT);
    });

    it('should identify images', () => {
      expect(getFileCategory('photo.png')).toBe(FileCategory.IMAGE);
      expect(getFileCategory('logo.svg')).toBe(FileCategory.IMAGE);
      expect(getFileCategory('pic.jpeg')).toBe(FileCategory.IMAGE);
    });

    it('should identify PDFs', () => {
      expect(getFileCategory('doc.pdf')).toBe(FileCategory.PDF);
    });

    it('should identify audio and video files', () => {
      expect(getFileCategory('song.mp3')).toBe(FileCategory.AUDIO);
      expect(getFileCategory('clip.mp4')).toBe(FileCategory.VIDEO);
      expect(getFileCategory('recording.wav')).toBe(FileCategory.AUDIO);
    });

    it('should identify office documents', () => {
      expect(getFileCategory('report.docx')).toBe(FileCategory.DOCUMENT);
      expect(getFileCategory('report.doc')).toBe(FileCategory.DOCUMENT);
      expect(getFileCategory('presentation.pptx')).toBe(FileCategory.PRESENTATION);
      expect(getFileCategory('data.xlsx')).toBe(FileCategory.SPREADSHEET);
      expect(getFileCategory('data.csv')).toBe(FileCategory.CSV);
    });

    it('should identify archives', () => {
      expect(getFileCategory('backup.zip')).toBe(FileCategory.ARCHIVE);
      expect(getFileCategory('archive.tar.gz')).toBe(FileCategory.ARCHIVE); // .gz

    });

    it('should fallback to mimetype if extension is unknown', () => {
      expect(getFileCategory('unknown_ext.abc', 'image/png')).toBe(FileCategory.IMAGE);
      expect(getFileCategory('unknown_ext.abc', 'application/zip')).toBe(FileCategory.ARCHIVE);
      expect(getFileCategory('unknown_ext.abc', 'text/plain')).toBe(FileCategory.TEXT);
    });

    it('should return UNKNOWN for unrecognized files', () => {
      expect(getFileCategory('binary.dat')).toBe(FileCategory.UNKNOWN);
    });
  });

  describe('getFileCategoryDisplayName', () => {
    it('should return nice names for categories', () => {
      expect(getFileCategoryDisplayName('app.tsx', FileCategory.TEXT)).toBe('Typescript');
      expect(getFileCategoryDisplayName('README', FileCategory.TEXT)).toBe('Text / Code');
      expect(getFileCategoryDisplayName('photo.png', FileCategory.IMAGE)).toBe('PNG Image');
      expect(getFileCategoryDisplayName('doc.pdf', FileCategory.PDF)).toBe('PDF Document');
      expect(getFileCategoryDisplayName('song.mp3', FileCategory.AUDIO)).toBe('MP3 Audio');
      expect(getFileCategoryDisplayName('report.docx', FileCategory.DOCUMENT)).toBe('Word Document');
      expect(getFileCategoryDisplayName('archive.zip', FileCategory.ARCHIVE)).toBe('ZIP Archive');
      expect(getFileCategoryDisplayName('binary.dat', FileCategory.UNKNOWN)).toBe('DAT File');
    });
  });

  describe('getMonacoLanguage', () => {
    it('should return correct language strings', () => {
      expect(getMonacoLanguage('app.tsx')).toBe('typescript');
      expect(getMonacoLanguage('style.css')).toBe('css');
      expect(getMonacoLanguage('script.py')).toBe('python');
      expect(getMonacoLanguage('README')).toBe('markdown');
      expect(getMonacoLanguage('Dockerfile')).toBe('dockerfile');
      expect(getMonacoLanguage('Makefile')).toBe('shell');
      expect(getMonacoLanguage('unknown.abc')).toBe('plaintext');
    });
  });
});

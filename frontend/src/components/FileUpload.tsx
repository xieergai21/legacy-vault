import { useState, useCallback } from 'react';

interface FileUploadProps {
  maxSize: number;
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const c = {
  bg: '#0F0F12',
  bgCard: '#1A1A1F',
  bgMuted: '#252529',
  text: '#F0F0F2',
  textSecondary: '#A0A0A8',
  textMuted: '#606068',
  accent: '#E8E8EC',
  danger: '#F87171',
  border: '#2A2A30',
  borderLight: '#3a3a42',
};

export function FileUpload({ maxSize, onFilesSelected, disabled }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);
    const newTotal = totalSize + fileArray.reduce((sum, f) => sum + f.size, 0);
    if (newTotal > maxSize) {
      setError(`Total size exceeds ${maxSizeMB} MB limit`);
      return;
    }
    setError(null);
    const updated = [...files, ...fileArray];
    setFiles(updated);
    onFilesSelected(updated);
  }, [files, totalSize, maxSize, maxSizeMB, onFilesSelected]);

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesSelected(updated);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div>
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragOver ? c.accent : c.border}`,
          borderRadius: '12px',
          padding: '32px 24px',
          textAlign: 'center',
          backgroundColor: dragOver ? c.bgMuted : 'transparent',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        <input
          type="file" multiple id="file-upload" disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <label htmlFor="file-upload" style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
          <p style={{ color: c.textSecondary, fontSize: '14px', margin: 0 }}>
            Drag & drop files here or <span style={{ color: c.accent, textDecoration: 'underline' }}>browse</span>
          </p>
          <p style={{ color: c.textMuted, fontSize: '12px', marginTop: '8px' }}>
            {formatSize(totalSize)} / {maxSizeMB} MB used
          </p>
        </label>
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: c.danger, fontSize: '13px', marginTop: '12px' }}>{error}</p>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {files.map((file, index) => (
            <div key={index} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', backgroundColor: c.bgMuted,
              border: `1px solid ${c.border}`, borderRadius: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>
                  {file.type.startsWith('image/') ? '🖼️' : 
                   file.type.startsWith('video/') ? '🎬' : 
                   file.type === 'application/pdf' ? '📄' : '📎'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ 
                    color: c.text, fontSize: '13px', fontWeight: '500', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>{file.name}</p>
                  <p style={{ color: c.textMuted, fontSize: '11px', margin: 0 }}>{formatSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button" onClick={() => removeFile(index)}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  backgroundColor: 'transparent', border: `1px solid ${c.border}`,
                  color: c.danger, cursor: 'pointer', fontSize: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginLeft: '12px'
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

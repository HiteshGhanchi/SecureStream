import './UploadStatusModal.css'

interface UploadStatusModalProps {
  fileName: string
  state: 'uploading' | 'processing' | 'ready' | 'error' | 'hidden'
  progress: number
  message: string
  onClose: () => void
  onCancel: () => void
}

const stateLabel: Record<Exclude<UploadStatusModalProps['state'], 'hidden'>, string> = {
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Ready to watch',
  error: 'Upload failed',
}

export default function UploadStatusModal({
  fileName,
  state,
  progress,
  message,
  onClose,
  onCancel,
}: UploadStatusModalProps) {
  if (state === 'hidden') {
    return null
  }

  return (
    <div className="upload-status-modal-backdrop visible" role="dialog" aria-modal="true">
      <div className="upload-status-modal-shell">
        <div className="modal-header">
          <div>
            <p className="modal-section-label">{stateLabel[state]}</p>
            <p className="modal-file-name">{fileName}</p>
          </div>
          {state === 'ready' ? (
            <button type="button" className="modal-close-button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          ) : null}
        </div>

        {state === 'uploading' && (
          <>
            <div className="progress-section">
              <div className="progress-shell">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-label">{progress}%</span>
              </div>
              <p className="modal-message">{message}</p>
            </div>
            <button type="button" className="modal-button" onClick={onCancel}>
              Cancel upload
            </button>
          </>
        )}

        {state === 'processing' && (
          <>
            <div className="progress-section">
              <p className="modal-message">{message}</p>
              <div className="step-row">
                <div className="step-item step-item--complete">
                  <span className="step-indicator">✓</span>
                  <span>Uploaded</span>
                </div>
                <div className="step-divider" />
                <div className="step-item step-item--active">
                  <span className="step-indicator">⟳</span>
                  <span>Processing</span>
                </div>
                <div className="step-divider" />
                <div className="step-item">
                  <span className="step-indicator">3</span>
                  <span>Ready</span>
                </div>
              </div>
            </div>
          </>
        )}

        {state === 'ready' && (
          <>
            <p className="modal-message success">{message}</p>
            <div className="modal-actions">
              <button type="button" className="modal-button" onClick={onClose} style={{ background: 'var(--accent)', color: '#0D0D0D', borderColor: 'var(--accent)' }}>
                Watch now
              </button>
              <button type="button" className="modal-button" onClick={onClose}>
                Go to dashboard
              </button>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <p className="modal-message error">{message}</p>
            <div className="modal-actions">
              <button type="button" className="modal-button" onClick={onCancel}>
                Try again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

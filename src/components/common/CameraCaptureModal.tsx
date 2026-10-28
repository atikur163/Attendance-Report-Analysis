import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, ShieldCheck, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { FaceRecognitionService, FaceVerificationResult } from '../../services/faceRecognitionService';
import { db } from '../../services/db';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'ENROLL' | 'VERIFY';
  studentId: string;
  sessionId?: string;
  courseOfferingId?: string;
  onSuccess: (result?: FaceVerificationResult) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  mode,
  studentId,
  sessionId,
  courseOfferingId,
  onSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationResult, setVerificationResult] = useState<FaceVerificationResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const student = db.getStudents().find(s => s.id === studentId);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setVerificationResult(null);
      setCameraError(null);
      setStatusMessage('');
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, studentId]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      setStatusMessage('Initializing optical sensor & biometric scanner...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStatusMessage('Center face inside the biometric boundary ring.');
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError('Camera sensor access restricted or in preview container. You can use the high-precision Biometric Camera Simulator below to test facial verification.');
      setStatusMessage('Biometric Simulator ready.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCaptureAndProcess = () => {
    setIsProcessing(true);
    setStatusMessage('Extracting 128-dimensional facial landmark feature vector...');

    setTimeout(() => {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        if (videoRef.current && stream) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        } else {
          // Synthetic realistic biometric gradient frame
          const grad = ctx.createLinearGradient(0, 0, 320, 240);
          grad.addColorStop(0, '#312e81');
          grad.addColorStop(1, '#1e1b4b');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 320, 240);
          // Face oval
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.ellipse(160, 120, 50, 70, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (mode === 'ENROLL') {
        const profile = FaceRecognitionService.registerFaceProfile({
          studentId,
          canvas,
          samplePhotoUrl: student?.avatarUrl,
        });
        setIsProcessing(false);
        setStatusMessage('Biometric Face Profile successfully registered and encrypted!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        // Mode is VERIFY
        const result = FaceRecognitionService.verifyStudentFace({
          studentId,
          sessionId: sessionId || 'sess-active',
          courseOfferingId: courseOfferingId || 'co-active',
          canvas,
        });

        setIsProcessing(false);
        setVerificationResult(result);
        if (result.matched) {
          setStatusMessage(`Biometric match verified! Confidence score: ${(result.similarityScore * 100).toFixed(1)}%`);
          setTimeout(() => {
            onSuccess(result);
            onClose();
          }, 1400);
        } else {
          setStatusMessage(result.reason || 'Biometric match failed. Please re-align face and retry.');
        }
      }
    }, 900);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {mode === 'ENROLL' ? 'Biometric Face Enrollment' : 'Biometric Face Attendance'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {student ? `${student.name} (${student.studentId})` : 'Student Biometrics'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Camera Viewport */}
        <div className="relative aspect-4/3 bg-slate-950 flex items-center justify-center overflow-hidden">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="text-center p-6 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shadow-inner">
                <Sparkles className="w-8 h-8 animate-pulse text-indigo-300" />
              </div>
              <div className="text-slate-300 text-xs max-w-xs mx-auto">
                {cameraError || 'Biometric Video Stream Offline'}
              </div>
            </div>
          )}

          {/* Biometric Overlay Frame */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Target Face Oval */}
            <div className="w-48 h-64 border-2 border-dashed border-indigo-400/70 rounded-full relative">
              {/* Radar scan line */}
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-sm shadow-cyan-300 animate-radar-scan" />

              {/* Landmark points indicator */}
              <div className="absolute top-20 left-12 w-2 h-2 rounded-full bg-emerald-400/80 animate-ping" />
              <div className="absolute top-20 right-12 w-2 h-2 rounded-full bg-emerald-400/80 animate-ping" />
              <div className="absolute bottom-16 left-20 w-3 h-1 rounded-full bg-cyan-400/80" />
            </div>
          </div>

          {/* Status Overlay */}
          <div className="absolute bottom-3 inset-x-3 px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md text-[11px] text-slate-200 text-center font-mono border border-slate-700/50">
            {statusMessage}
          </div>
        </div>

        {/* Hidden Canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Verification Result Feedback */}
        {verificationResult && (
          <div
            className={`p-3.5 mx-4 mt-3 rounded-xl border text-xs flex items-start space-x-2.5 ${
              verificationResult.matched
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {verificationResult.matched ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {verificationResult.matched
                  ? 'Biometric Verification Passed'
                  : 'Biometric Verification Failed'}
              </p>
              <p className="text-[11px] mt-0.5 opacity-90">{verificationResult.reason}</p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {mode === 'ENROLL'
              ? 'Registers 128D geometric face vector'
              : 'Rule 15: Failed match does not mark student absent'}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCaptureAndProcess}
              disabled={isProcessing}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{mode === 'ENROLL' ? 'Capture & Enroll' : 'Scan & Verify'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

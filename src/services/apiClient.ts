/**
 * Centralized HTTP Client for Python FastAPI Backend.
 * Automatically injects Firebase Auth Bearer ID Tokens and handles API responses.
 */
import { auth } from './firebase';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_FASTAPI_URL ||
  ''
).replace(/\/$/, '');

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('Failed to retrieve Firebase ID Token for API call:', err);
  }
  return headers;
}

export class ApiClient {
  public static getBaseUrl(): string {
    return API_BASE_URL;
  }

  public static getUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${cleanPath}`;
  }

  // Generic request handler
  public static async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const url = this.getUrl(path);
    const authHeaders = await getAuthHeaders();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        errorMsg = errorJson.detail || errorJson.error || errorJson.message || errorMsg;
      } catch {
        // Fallback
      }
      throw new Error(errorMsg);
    }

    return response.json() as Promise<T>;
  }

  // 1. Hardware Attendance IoT Scan
  public static async processHardwareScan(data: {
    deviceId: string;
    credentialId: string;
    credentialType?: string;
    apiKey?: string;
    timestamp?: string;
  }) {
    return this.request('/api/hardware/scan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 2. Attendance Corrections
  public static async correctAttendance(data: {
    attendanceRecordId?: string;
    sessionId?: string;
    studentId?: string;
    courseOfferingId?: string;
    newStatus: string;
    changedBy: string;
    reason: string;
    userRole?: string;
    teacherId?: string;
  }) {
    return this.request('/api/attendance/correct', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async bulkCorrectAttendance(data: {
    courseOfferingId: string;
    sessionId?: string;
    updates: Array<{ studentId: string; newStatus: string; attendanceRecordId?: string; reason?: string }>;
    changedBy: string;
    reason: string;
    userRole?: string;
    teacherId?: string;
  }) {
    return this.request('/api/attendance/bulk-correct', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 3. Class Count Adjustments
  public static async adjustClassCount(data: {
    courseOfferingId: string;
    newConductedCount: number;
    changedBy: string;
    reason: string;
    userRole?: string;
    teacherId?: string;
  }) {
    return this.request('/api/classes/adjust-count', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async cancelSession(data: {
    sessionId: string;
    changedBy: string;
    reason: string;
    userRole?: string;
    teacherId?: string;
  }) {
    return this.request('/api/classes/cancel-session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 4. Course Enrollment Windows
  public static async getEnrollmentWindows() {
    return this.request('/api/enrollment/windows');
  }

  public static async selfEnroll(data: { studentId: string; courseOfferingId: string; isRetake?: boolean }) {
    return this.request('/api/enrollment/self-enroll', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async selfDrop(data: { studentId: string; courseOfferingId: string; reason?: string }) {
    return this.request('/api/enrollment/self-drop', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async adminOverrideEnrollment(data: {
    studentId: string;
    courseOfferingId: string;
    action: string;
    adminName: string;
    reason: string;
    isRetake?: boolean;
  }) {
    return this.request('/api/enrollment/admin-override', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 5. Outbound Email Service
  public static async getEmailStatus() {
    return this.request('/api/email/status');
  }

  public static async sendEmail(data: {
    to: string;
    recipientName?: string;
    recipientRole?: string;
    type?: string;
    subject: string;
    text?: string;
    html?: string;
    dedupKey?: string;
  }) {
    return this.request('/api/email/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async verifySmtp() {
    return this.request('/api/email/verify-smtp');
  }

  public static async retryEmail(logId: string) {
    return this.request('/api/email/retry', {
      method: 'POST',
      body: JSON.stringify({ logId }),
    });
  }

  public static async testWarningDelivery(data: {
    to: string;
    studentName?: string;
    studentRoll?: string;
    courseCode?: string;
    courseName?: string;
  }) {
    return this.request('/api/email/test-warning-delivery', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getHealth() {
    return this.request('/health');
  }

  // 6. Analytics & Projections
  public static async getCourseAnalytics(offeringId: string) {
    return this.request(`/api/analytics/course/${offeringId}`);
  }

  public static async getStudentAnalytics(studentId: string) {
    return this.request(`/api/analytics/student/${studentId}`);
  }

  public static async getDepartmentRisk(departmentId: string) {
    return this.request(`/api/analytics/department/${departmentId}`);
  }

  // 7. Report File Downloads
  public static async downloadExcelReport(offeringId: string, courseCode: string) {
    const url = this.getUrl(`/api/reports/export/excel?course_offering_id=${encodeURIComponent(offeringId)}`);
    const authHeaders = await getAuthHeaders();
    const res = await fetch(url, { headers: authHeaders });
    if (!res.ok) throw new Error('Failed to download Excel report');
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Attendance_${courseCode}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  public static async downloadPdfReport(offeringId: string, courseCode: string) {
    const url = this.getUrl(`/api/reports/export/pdf?course_offering_id=${encodeURIComponent(offeringId)}`);
    const authHeaders = await getAuthHeaders();
    const res = await fetch(url, { headers: authHeaders });
    if (!res.ok) throw new Error('Failed to download PDF clearance sheet');
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Exam_Clearance_${courseCode}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

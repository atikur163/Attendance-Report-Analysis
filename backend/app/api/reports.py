"""Report Export Endpoints: Excel (.xlsx), CSV (.csv), and PDF (.pdf)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from app.core.security import require_teacher, AuthUser
from app.services.report_service import report_service

router = APIRouter(prefix="/reports", tags=["Report Generation & Exports"])


@router.get("/export/excel")
async def export_excel_report(course_offering_id: str = Query(...), user: AuthUser = Depends(require_teacher)):
    """Downloads formatted Excel attendance register generated via OpenPyXL."""
    excel_stream = report_service.generate_excel_course_report(course_offering_id)
    filename = f"UniAttend_Report_{course_offering_id}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/csv")
async def export_csv_report(course_offering_id: str = Query(...), user: AuthUser = Depends(require_teacher)):
    """Downloads plain tabular CSV attendance data generated via Pandas."""
    csv_data = report_service.generate_csv_course_report(course_offering_id)
    filename = f"UniAttend_Report_{course_offering_id}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/pdf")
async def export_pdf_report(course_offering_id: str = Query(...), user: AuthUser = Depends(require_teacher)):
    """Downloads official examination clearance attendance PDF generated via ReportLab."""
    pdf_stream = report_service.generate_pdf_exam_clearance(course_offering_id)
    filename = f"UniAttend_Exam_Clearance_{course_offering_id}.pdf"
    return StreamingResponse(
        pdf_stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

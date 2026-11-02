"""Report Generation Service: Excel (OpenPyXL), CSV (Pandas), and PDF (ReportLab)."""
import io
from typing import Dict, Any, List
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.services.analytics_service import analytics_service


class ReportService:
    def generate_excel_course_report(self, course_offering_id: str) -> io.BytesIO:
        """Generates a styled Excel workbook using OpenPyXL."""
        analytics = analytics_service.get_course_analytics(course_offering_id)
        students = analytics.get("students", [])

        wb = Workbook()
        ws = wb.active
        ws.title = "Attendance Analysis"

        # University Header
        ws.merge_cells("A1:I1")
        ws["A1"] = "MAWLANA BHASHANI SCIENCE AND TECHNOLOGY UNIVERSITY"
        ws["A1"].font = Font(name="Arial", size=14, bold=True, color="1E3A8A")
        ws["A1"].alignment = Alignment(horizontal="center")

        ws.merge_cells("A2:I2")
        ws["A2"] = f"Official Course Attendance & Examination Eligibility Sheet: {analytics.get('course_code')} - {analytics.get('course_name')}"
        ws["A2"].font = Font(name="Arial", size=11, bold=True)
        ws["A2"].alignment = Alignment(horizontal="center")

        ws.merge_cells("A3:I3")
        ws["A3"] = f"Planned Lectures: {analytics.get('planned_classes')} | Conducted Lectures: {analytics.get('conducted_classes')} | Total Enrolled: {analytics.get('total_enrolled')}"
        ws["A3"].font = Font(name="Arial", size=9, italic=True)
        ws["A3"].alignment = Alignment(horizontal="center")

        ws.append([])  # Blank row

        # Table Column Headers
        headers = [
            "SL", "Student Roll", "Full Name", "Conducted", "Attended",
            "Penalties", "Effective Attended", "Attendance %", "Exam Eligibility"
        ]
        ws.append(headers)

        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")

        header_row = 5
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=header_row, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1")
        )

        eligible_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
        ineligible_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")

        for idx, s in enumerate(students, 1):
            row_data = [
                idx,
                s.get("student_roll"),
                s.get("student_name"),
                s.get("conducted_classes"),
                s.get("present_count") + s.get("late_count"),
                s.get("penalty_count"),
                s.get("effective_presents"),
                f"{s.get('current_percentage'):.1f}%",
                "ELIGIBLE" if s.get("is_eligible") else "INELIGIBLE (<60%)"
            ]
            ws.append(row_data)
            current_row = ws.max_row

            for col_idx in range(1, len(row_data) + 1):
                c = ws.cell(row=current_row, column=col_idx)
                c.border = thin_border
                c.font = Font(name="Arial", size=9)
                if col_idx in (1, 2, 4, 5, 6, 7, 8):
                    c.alignment = Alignment(horizontal="center")
                if col_idx == 9:
                    c.alignment = Alignment(horizontal="center")
                    c.fill = eligible_fill if s.get("is_eligible") else ineligible_fill
                    c.font = Font(name="Arial", size=9, bold=True, color="065F46" if s.get("is_eligible") else "991B1B")

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    def generate_csv_course_report(self, course_offering_id: str) -> str:
        """Generates plain tabular CSV data using Pandas."""
        analytics = analytics_service.get_course_analytics(course_offering_id)
        students = analytics.get("students", [])

        if not students:
            return "Student Roll,Student Name,Conducted,Attended,Penalties,Effective,Percentage,Status\n"

        df = pd.DataFrame(students)
        export_df = pd.DataFrame({
            "Student Roll": df["student_roll"],
            "Student Name": df["student_name"],
            "Conducted Classes": df["conducted_classes"],
            "Presents": df["present_count"],
            "Lates": df["late_count"],
            "3-Late Penalties": df["penalty_count"],
            "Effective Presents": df["effective_presents"],
            "Attendance Rate (%)": df["current_percentage"],
            "Exam Clearance": df["is_eligible"].apply(lambda v: "ELIGIBLE" if v else "BARRED (<60%)"),
            "Risk Category": df["risk_level"]
        })
        return export_df.to_csv(index=False)

    def generate_pdf_exam_clearance(self, course_offering_id: str) -> io.BytesIO:
        """Generates formal examination clearance PDF using ReportLab."""
        analytics = analytics_service.get_course_analytics(course_offering_id)
        students = analytics.get("students", [])

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=16,
            leading=20,
            alignment=1,
            textColor=colors.HexColor("#1E293B")
        )
        sub_style = ParagraphStyle(
            "DocSubtitle",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            alignment=1,
            textColor=colors.HexColor("#64748B")
        )

        elements = [
            Paragraph("MAWLANA BHASHANI SCIENCE AND TECHNOLOGY UNIVERSITY", title_style),
            Paragraph("OFFICE OF THE CONTROLLER OF EXAMINATIONS", sub_style),
            Paragraph(f"Semester Final Examination Attendance Clearance List: {analytics.get('course_code')} ({analytics.get('course_name')})", sub_style),
            Spacer(1, 16)
        ]

        table_data = [
            ["SL", "Roll / ID", "Student Name", "Held", "Attended", "Penalties", "Effective", "%", "Exam Status"]
        ]

        for idx, s in enumerate(students, 1):
            table_data.append([
                str(idx),
                str(s.get("student_roll")),
                str(s.get("student_name")),
                str(s.get("conducted_classes")),
                str(s.get("present_count") + s.get("late_count")),
                str(s.get("penalty_count")),
                str(s.get("effective_presents")),
                f"{s.get('current_percentage'):.1f}%",
                "ELIGIBLE" if s.get("is_eligible") else "BARRED (<60%)"
            ])

        col_widths = [30, 80, 180, 45, 55, 55, 55, 55, 110]
        t = Table(table_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ALIGN", (2, 1), (2, -1), "LEFT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))

        elements.append(t)
        doc.build(elements)

        buffer.seek(0)
        return buffer


report_service = ReportService()
